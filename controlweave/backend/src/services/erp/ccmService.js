'use strict';

/**
 * Continuous controls monitoring over imported ERP transactions.
 *
 * Each rule is a set-based query over erp_transactions for one system that
 * returns exceptions with a stable fingerprint, so re-running a rule updates
 * existing exceptions instead of duplicating them, and a closed exception
 * (resolved or false positive) stays closed. When an organization ties a rule
 * to a risk-control matrix entry, every run also records a completed
 * full-population operating effectiveness test for that control.
 *
 * Rule families: accounts payable (AP), general ledger (GL), purchasing and
 * three-way match between purchase orders, goods receipts and invoices (P2P;
 * invoices and receipts carry the purchase order number in `reference`), and
 * configuration against approved baselines (CFG; population is the system's
 * configuration items, see configService).
 */

const pool = require('../../config/database');
const { COMPLIES_SQL, EXPECTATION_SQL } = require('./configService');

class CcmError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validTimeZone(value) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const PARAM_TYPES = {
  number: (v, spec) => typeof v === 'number' && Number.isFinite(v) && v >= (spec.min ?? -Infinity) && v <= (spec.max ?? Infinity),
  integer: (v, spec) => Number.isInteger(v) && v >= (spec.min ?? -Infinity) && v <= (spec.max ?? Infinity),
  boolean: (v) => typeof v === 'boolean',
  timezone: (v) => typeof v === 'string' && v.length <= 64 && validTimeZone(v)
};

const RULES = [
  {
    code: 'CCM-AP-01', name: 'Duplicate payments (same vendor, amount and invoice reference)', txn_type: 'payment', severity: 'high',
    description: 'Two or more payments to the same vendor for the same amount against the same invoice reference.',
    params: {},
    sql: () => `
      SELECT 'ref:' || vendor_id || '|' || amount || '|' || LOWER(reference) AS fingerprint,
             'Duplicate payments to ' || COALESCE(MAX(vendor_name), vendor_id) || ' for invoice ' || MAX(reference) AS title,
             ARRAY_AGG(id ORDER BY txn_date, external_id) AS txn_ids,
             amount * (COUNT(*) - 1) AS amount,
             jsonb_build_object('vendor_id', vendor_id, 'reference', MAX(reference), 'payments', COUNT(*),
                                'documents', ARRAY_AGG(external_id ORDER BY txn_date, external_id)) AS details
        FROM erp_transactions
       WHERE system_id = $1 AND txn_type = 'payment' AND vendor_id IS NOT NULL AND reference IS NOT NULL AND amount IS NOT NULL
       GROUP BY vendor_id, amount, LOWER(reference)
      HAVING COUNT(*) > 1`
  },
  {
    code: 'CCM-AP-02', name: 'Possible duplicate payments (same vendor and amount within a window)', txn_type: 'payment', severity: 'medium',
    description: 'Pairs of payments to the same vendor for the same amount within a few days, with different or missing references.',
    params: { window_days: { type: 'integer', min: 1, max: 90, default: 7 }, min_amount: { type: 'number', min: 0, max: 1e12, default: 1000 } },
    sql: (p) => `
      SELECT 'pair:' || LEAST(a.id, b.id) || '|' || GREATEST(a.id, b.id) AS fingerprint,
             'Possible duplicate payment to ' || COALESCE(a.vendor_name, a.vendor_id) || ' of ' || a.amount AS title,
             ARRAY[a.id, b.id] AS txn_ids, a.amount AS amount,
             jsonb_build_object('vendor_id', a.vendor_id, 'documents', ARRAY[a.external_id, b.external_id],
                                'dates', ARRAY[a.txn_date, b.txn_date], 'references', ARRAY[a.reference, b.reference]) AS details
        FROM erp_transactions a
        JOIN erp_transactions b ON b.system_id = a.system_id AND b.txn_type = 'payment' AND b.vendor_id = a.vendor_id
                               AND b.amount = a.amount AND b.id > a.id
                               AND ABS(b.txn_date - a.txn_date) <= ${p.window_days}
                               AND LOWER(COALESCE(b.reference, '')) IS DISTINCT FROM LOWER(COALESCE(a.reference, '~'))
       WHERE a.system_id = $1 AND a.txn_type = 'payment' AND a.vendor_id IS NOT NULL AND a.amount >= ${p.min_amount}`
  },
  {
    code: 'CCM-AP-03', name: 'Duplicate supplier invoices', txn_type: 'invoice', severity: 'high',
    description: 'Invoices from the same vendor whose invoice numbers match once punctuation, spacing and case are ignored.',
    params: {},
    sql: () => `
      SELECT 'inv:' || vendor_id || '|' || REGEXP_REPLACE(LOWER(document_number), '[^a-z0-9]', '', 'g') AS fingerprint,
             'Duplicate invoice ' || MIN(document_number) || ' from ' || COALESCE(MAX(vendor_name), vendor_id) AS title,
             ARRAY_AGG(id ORDER BY txn_date, external_id) AS txn_ids,
             SUM(amount) - MIN(amount) AS amount,
             jsonb_build_object('vendor_id', vendor_id, 'invoice_numbers', ARRAY_AGG(document_number ORDER BY txn_date), 'count', COUNT(*)) AS details
        FROM erp_transactions
       WHERE system_id = $1 AND txn_type = 'invoice' AND vendor_id IS NOT NULL
         AND REGEXP_REPLACE(LOWER(COALESCE(document_number, '')), '[^a-z0-9]', '', 'g') <> ''
       GROUP BY vendor_id, REGEXP_REPLACE(LOWER(document_number), '[^a-z0-9]', '', 'g')
      HAVING COUNT(*) > 1`
  },
  {
    code: 'CCM-AP-04', name: 'Payment shortly after a vendor bank account change', txn_type: 'payment', severity: 'critical',
    description: 'A payment to a vendor within a few days after its bank details changed, the pattern behind most payment-redirection fraud.',
    params: { window_days: { type: 'integer', min: 1, max: 90, default: 14 } },
    sql: (p) => `
      SELECT 'bank:' || c.id || '|' || pay.id AS fingerprint,
             'Payment to ' || COALESCE(pay.vendor_name, pay.vendor_id) || ' ' || (pay.txn_date - c.txn_date) || ' day(s) after a bank change' AS title,
             ARRAY[c.id, pay.id] AS txn_ids, pay.amount AS amount,
             jsonb_build_object('vendor_id', pay.vendor_id, 'change', c.external_id, 'changed_by', c.created_by, 'changed_on', c.txn_date,
                                'payment', pay.external_id, 'paid_on', pay.txn_date) AS details
        FROM erp_transactions c
        JOIN erp_transactions pay ON pay.system_id = c.system_id AND pay.txn_type = 'payment' AND pay.vendor_id = c.vendor_id
                                 AND pay.txn_date BETWEEN c.txn_date AND c.txn_date + ${p.window_days}
       WHERE c.system_id = $1 AND c.txn_type = 'vendor_change' AND c.change_field ILIKE '%bank%'`
  },
  {
    code: 'CCM-AP-05', name: 'Vendor changed and paid by the same person', txn_type: 'payment', severity: 'critical',
    description: 'The user who changed a vendor record also entered or approved a payment to that vendor: a segregation of duties conflict that was exercised.',
    params: { window_days: { type: 'integer', min: 1, max: 365, default: 90 } },
    sql: (p) => `
      SELECT 'sod:' || c.id || '|' || pay.id AS fingerprint,
             c.created_by || ' changed vendor ' || COALESCE(pay.vendor_name, pay.vendor_id) || ' and processed its payment' AS title,
             ARRAY[c.id, pay.id] AS txn_ids, pay.amount AS amount,
             jsonb_build_object('user', c.created_by, 'vendor_id', pay.vendor_id, 'change', c.external_id, 'change_field', c.change_field,
                                'payment', pay.external_id, 'payment_role', CASE WHEN LOWER(pay.approved_by) = LOWER(c.created_by) THEN 'approver' ELSE 'preparer' END) AS details
        FROM erp_transactions c
        JOIN erp_transactions pay ON pay.system_id = c.system_id AND pay.txn_type = 'payment' AND pay.vendor_id = c.vendor_id
                                 AND pay.txn_date BETWEEN c.txn_date AND c.txn_date + ${p.window_days}
                                 AND (LOWER(pay.created_by) = LOWER(c.created_by) OR LOWER(pay.approved_by) = LOWER(c.created_by))
       WHERE c.system_id = $1 AND c.txn_type = 'vendor_change' AND c.created_by IS NOT NULL`
  },
  {
    code: 'CCM-AP-06', name: 'Invoice entered and its payment approved by the same person', txn_type: 'payment', severity: 'high',
    description: 'The user who entered an invoice also approved the payment that settled it.',
    params: {},
    sql: () => `
      SELECT 'inv-pay:' || i.id || '|' || pay.id AS fingerprint,
             i.created_by || ' entered invoice ' || i.document_number || ' and approved its payment' AS title,
             ARRAY[i.id, pay.id] AS txn_ids, pay.amount AS amount,
             jsonb_build_object('user', i.created_by, 'vendor_id', i.vendor_id, 'invoice', i.document_number, 'payment', pay.external_id) AS details
        FROM erp_transactions i
        JOIN erp_transactions pay ON pay.system_id = i.system_id AND pay.txn_type = 'payment' AND pay.vendor_id = i.vendor_id
                                 AND LOWER(pay.reference) = LOWER(i.document_number) AND LOWER(pay.approved_by) = LOWER(i.created_by)
       WHERE i.system_id = $1 AND i.txn_type = 'invoice' AND i.created_by IS NOT NULL`
  },
  {
    code: 'CCM-GL-01', name: 'Journal entries over the review threshold', txn_type: 'journal_entry', severity: 'medium',
    description: 'Manual journal entries at or above an amount that requires specific review.',
    params: { threshold: { type: 'number', min: 0, max: 1e15, default: 1000000 } },
    sql: (p) => `
      SELECT 'je:' || id AS fingerprint, 'Journal entry ' || COALESCE(document_number, external_id) || ' of ' || amount AS title,
             ARRAY[id] AS txn_ids, amount,
             jsonb_build_object('document', COALESCE(document_number, external_id), 'created_by', created_by, 'approved_by', approved_by, 'posted_at', posted_at) AS details
        FROM erp_transactions
       WHERE system_id = $1 AND txn_type = 'journal_entry' AND ABS(amount) >= ${p.threshold}`
  },
  {
    code: 'CCM-GL-02', name: 'Self-approved journal entries', txn_type: 'journal_entry', severity: 'high',
    description: 'Journal entries approved by the same user who created them.',
    params: {},
    sql: () => `
      SELECT 'je-self:' || id AS fingerprint, 'Journal entry ' || COALESCE(document_number, external_id) || ' created and approved by ' || created_by AS title,
             ARRAY[id] AS txn_ids, amount,
             jsonb_build_object('document', COALESCE(document_number, external_id), 'user', created_by, 'posted_at', posted_at) AS details
        FROM erp_transactions
       WHERE system_id = $1 AND txn_type = 'journal_entry' AND created_by IS NOT NULL AND LOWER(created_by) = LOWER(approved_by)`
  },
  {
    code: 'CCM-GL-03', name: 'Journal entries posted outside business hours', txn_type: 'journal_entry', severity: 'low',
    description: 'Journal entries posted late at night, early in the morning or, optionally, at weekends.',
    params: {
      time_zone: { type: 'timezone', default: 'UTC' },
      start_hour: { type: 'integer', min: 0, max: 23, default: 7 },
      end_hour: { type: 'integer', min: 1, max: 24, default: 19 },
      include_weekends: { type: 'boolean', default: true }
    },
    values: (p) => [p.time_zone],
    sql: (p) => `
      SELECT 'je-hours:' || id AS fingerprint,
             'Journal entry ' || COALESCE(document_number, external_id) || ' posted ' || TO_CHAR(posted_at AT TIME ZONE $2, 'Dy YYYY-MM-DD HH24:MI') AS title,
             ARRAY[id] AS txn_ids, amount,
             jsonb_build_object('document', COALESCE(document_number, external_id), 'created_by', created_by, 'posted_local', TO_CHAR(posted_at AT TIME ZONE $2, 'YYYY-MM-DD HH24:MI'), 'time_zone', $2::text) AS details
        FROM erp_transactions
       WHERE system_id = $1 AND txn_type = 'journal_entry' AND posted_at IS NOT NULL
         AND (EXTRACT(HOUR FROM posted_at AT TIME ZONE $2) < ${p.start_hour}
              OR EXTRACT(HOUR FROM posted_at AT TIME ZONE $2) >= ${p.end_hour}
              ${p.include_weekends ? 'OR EXTRACT(ISODOW FROM posted_at AT TIME ZONE $2) IN (6, 7)' : ''})`
  },
  {
    code: 'CCM-GL-04', name: 'Round-amount journal entries', txn_type: 'journal_entry', severity: 'low',
    description: 'Large journal entries in exact round amounts, a common indicator of estimates or manipulation.',
    params: { min_amount: { type: 'number', min: 0, max: 1e15, default: 10000 }, round_to: { type: 'number', min: 1, max: 1e9, default: 1000 } },
    sql: (p) => `
      SELECT 'je-round:' || id AS fingerprint, 'Round-amount journal entry ' || COALESCE(document_number, external_id) || ' of ' || amount AS title,
             ARRAY[id] AS txn_ids, amount,
             jsonb_build_object('document', COALESCE(document_number, external_id), 'created_by', created_by) AS details
        FROM erp_transactions
       WHERE system_id = $1 AND txn_type = 'journal_entry' AND ABS(amount) >= ${p.min_amount} AND MOD(ABS(amount), ${p.round_to}) = 0`
  },
  {
    code: 'CCM-GL-05', name: 'Journal entries without an approver', txn_type: 'journal_entry', severity: 'high',
    description: 'Journal entries at or above a threshold with no recorded approver.',
    params: { min_amount: { type: 'number', min: 0, max: 1e15, default: 0 } },
    sql: (p) => `
      SELECT 'je-noappr:' || id AS fingerprint, 'Journal entry ' || COALESCE(document_number, external_id) || ' has no approver' AS title,
             ARRAY[id] AS txn_ids, amount,
             jsonb_build_object('document', COALESCE(document_number, external_id), 'created_by', created_by) AS details
        FROM erp_transactions
       WHERE system_id = $1 AND txn_type = 'journal_entry' AND COALESCE(approved_by, '') = '' AND ABS(COALESCE(amount, 0)) >= ${p.min_amount}`
  },
  {
    code: 'CCM-P2P-01', name: 'Invoiced amount exceeds the purchase order', txn_type: 'purchase_order', severity: 'high',
    description: 'Invoices against a purchase order add up to more than the order, beyond a tolerance.',
    params: { tolerance_pct: { type: 'number', min: 0, max: 100, default: 5 }, min_variance: { type: 'number', min: 0, max: 1e12, default: 100 } },
    sql: (p) => `
      WITH inv AS (
        SELECT reference, SUM(amount) AS total, ARRAY_AGG(id ORDER BY txn_date, external_id) AS ids,
               ARRAY_AGG(COALESCE(document_number, external_id) ORDER BY txn_date, external_id) AS docs
          FROM erp_transactions WHERE system_id = $1 AND txn_type = 'invoice' AND reference IS NOT NULL AND amount IS NOT NULL
         GROUP BY reference
      )
      SELECT 'po-over:' || po.id AS fingerprint,
             'Invoiced ' || inv.total || ' against purchase order ' || po.document_number || ' of ' || po.amount AS title,
             ARRAY[po.id] || inv.ids AS txn_ids, inv.total - po.amount AS amount,
             jsonb_build_object('purchase_order', po.document_number, 'vendor_id', po.vendor_id, 'po_amount', po.amount,
                                'invoiced', inv.total, 'invoices', inv.docs) AS details
        FROM erp_transactions po
        JOIN inv ON inv.reference = po.document_number
       WHERE po.system_id = $1 AND po.txn_type = 'purchase_order' AND po.amount IS NOT NULL
         AND inv.total > po.amount * (1 + ${p.tolerance_pct} / 100.0) AND inv.total - po.amount >= ${p.min_variance}`
  },
  {
    code: 'CCM-P2P-02', name: 'Invoiced but not received (three-way match)', txn_type: 'purchase_order', severity: 'high',
    description: 'Invoices against a purchase order with no goods receipt, or for more than was received (by value, or by quantity when receipts carry quantities only), beyond a tolerance.',
    params: { tolerance_pct: { type: 'number', min: 0, max: 100, default: 5 }, min_variance: { type: 'number', min: 0, max: 1e12, default: 100 } },
    sql: (p) => `
      WITH inv AS (
        SELECT reference, SUM(amount) AS total, SUM(quantity) AS qty, ARRAY_AGG(id ORDER BY txn_date, external_id) AS ids
          FROM erp_transactions WHERE system_id = $1 AND txn_type = 'invoice' AND reference IS NOT NULL
         GROUP BY reference
      ),
      gr AS (
        SELECT reference, SUM(amount) AS received, SUM(quantity) AS qty, BOOL_OR(amount IS NULL) AS value_missing,
               ARRAY_AGG(id ORDER BY txn_date, external_id) AS ids
          FROM erp_transactions WHERE system_id = $1 AND txn_type = 'goods_receipt'
         GROUP BY reference
      )
      SELECT 'gr-short:' || po.id AS fingerprint,
             CASE WHEN gr.reference IS NULL THEN 'Purchase order ' || po.document_number || ' invoiced (' || inv.total || ') with no goods receipt'
                  WHEN gr.value_missing THEN 'Purchase order ' || po.document_number || ' invoiced for quantity ' || inv.qty || ', received ' || gr.qty
                  ELSE 'Purchase order ' || po.document_number || ' invoiced ' || inv.total || ', received ' || gr.received END AS title,
             ARRAY[po.id] || inv.ids || COALESCE(gr.ids, '{}'::uuid[]) AS txn_ids,
             CASE WHEN gr.reference IS NULL THEN inv.total WHEN gr.value_missing THEN NULL ELSE inv.total - gr.received END AS amount,
             jsonb_build_object('purchase_order', po.document_number, 'vendor_id', po.vendor_id, 'invoiced', inv.total, 'invoiced_quantity', inv.qty,
                                'received', gr.received, 'received_quantity', gr.qty, 'receipts', COALESCE(cardinality(gr.ids), 0)) AS details
        FROM erp_transactions po
        JOIN inv ON inv.reference = po.document_number
        LEFT JOIN gr ON gr.reference = po.document_number
       WHERE po.system_id = $1 AND po.txn_type = 'purchase_order'
         AND (gr.reference IS NULL
              OR (NOT gr.value_missing AND inv.total > gr.received * (1 + ${p.tolerance_pct} / 100.0) AND inv.total - gr.received >= ${p.min_variance})
              OR (gr.value_missing AND inv.qty IS NOT NULL AND gr.qty IS NOT NULL AND inv.qty > gr.qty * (1 + ${p.tolerance_pct} / 100.0)))`
  },
  {
    code: 'CCM-P2P-03', name: 'Invoices without a purchase order', txn_type: 'invoice', severity: 'medium',
    description: 'Invoices at or above a threshold that do not reference a purchase order in the extract. Runs only once purchase orders have been imported.',
    params: { min_amount: { type: 'number', min: 0, max: 1e15, default: 5000 } },
    sql: (p) => `
      SELECT 'non-po:' || i.id AS fingerprint,
             'Invoice ' || COALESCE(i.document_number, i.external_id) || ' from ' || COALESCE(i.vendor_name, i.vendor_id, 'unknown vendor') || ' of ' || i.amount || ' has no purchase order' AS title,
             ARRAY[i.id] AS txn_ids, i.amount,
             jsonb_build_object('invoice', COALESCE(i.document_number, i.external_id), 'vendor_id', i.vendor_id, 'reference', i.reference, 'created_by', i.created_by) AS details
        FROM erp_transactions i
       WHERE i.system_id = $1 AND i.txn_type = 'invoice' AND i.amount >= ${p.min_amount}
         AND EXISTS (SELECT 1 FROM erp_transactions x WHERE x.system_id = $1 AND x.txn_type = 'purchase_order')
         AND NOT EXISTS (SELECT 1 FROM erp_transactions po WHERE po.system_id = $1 AND po.txn_type = 'purchase_order' AND po.document_number = i.reference)`
  },
  {
    code: 'CCM-P2P-04', name: 'Purchase order raised after the invoice', txn_type: 'purchase_order', severity: 'medium',
    description: 'A purchase order dated after the first invoice against it: the commitment was recorded after the fact.',
    params: {},
    sql: () => `
      SELECT 'po-after:' || po.id AS fingerprint,
             'Purchase order ' || po.document_number || ' dated ' || po.txn_date || ', after invoice dated ' || MIN(i.txn_date) AS title,
             ARRAY[po.id] || ARRAY_AGG(i.id ORDER BY i.txn_date) AS txn_ids, po.amount,
             jsonb_build_object('purchase_order', po.document_number, 'po_date', po.txn_date, 'first_invoice_date', MIN(i.txn_date), 'created_by', po.created_by) AS details
        FROM erp_transactions po
        JOIN erp_transactions i ON i.system_id = po.system_id AND i.txn_type = 'invoice' AND i.reference = po.document_number AND i.txn_date IS NOT NULL
       WHERE po.system_id = $1 AND po.txn_type = 'purchase_order' AND po.txn_date IS NOT NULL
       GROUP BY po.id
      HAVING po.txn_date > MIN(i.txn_date)`
  },
  {
    code: 'CCM-P2P-05', name: 'Purchase order created and approved by the same person', txn_type: 'purchase_order', severity: 'high',
    description: 'Purchase orders whose approver is the user who created them.',
    params: {},
    sql: () => `
      SELECT 'po-self:' || id AS fingerprint, 'Purchase order ' || COALESCE(document_number, external_id) || ' created and approved by ' || created_by AS title,
             ARRAY[id] AS txn_ids, amount,
             jsonb_build_object('purchase_order', COALESCE(document_number, external_id), 'user', created_by, 'vendor_id', vendor_id) AS details
        FROM erp_transactions
       WHERE system_id = $1 AND txn_type = 'purchase_order' AND created_by IS NOT NULL AND LOWER(created_by) = LOWER(approved_by)`
  },
  {
    code: 'CCM-P2P-06', name: 'Goods received by the purchase order creator', txn_type: 'goods_receipt', severity: 'medium',
    description: 'The user who created a purchase order also recorded its goods receipt.',
    params: {},
    sql: () => `
      SELECT 'gr-self:' || gr.id AS fingerprint,
             gr.created_by || ' created purchase order ' || po.document_number || ' and recorded its receipt' AS title,
             ARRAY[po.id, gr.id] AS txn_ids, gr.amount,
             jsonb_build_object('purchase_order', po.document_number, 'receipt', COALESCE(gr.document_number, gr.external_id), 'user', gr.created_by) AS details
        FROM erp_transactions gr
        JOIN erp_transactions po ON po.system_id = gr.system_id AND po.txn_type = 'purchase_order' AND po.document_number = gr.reference
       WHERE gr.system_id = $1 AND gr.txn_type = 'goods_receipt' AND gr.created_by IS NOT NULL AND LOWER(gr.created_by) = LOWER(po.created_by)`
  },
  {
    code: 'CCM-CFG-01', name: 'Configuration outside the approved baseline', txn_type: 'config', severity: 'high', rowSeverity: true,
    description: 'A monitored setting whose current value breaks its baseline, or that the latest extract did not report. Severity comes from the baseline.',
    params: {},
    sql: () => `
      SELECT 'cfg:' || b.id || '|' || md5(COALESCE(ci.value, '') || '|' || COALESCE(ci.is_present::text, 'missing')) AS fingerprint,
             CASE WHEN ci.id IS NULL OR NOT ci.is_present THEN b.config_key || ' is not reported by the system'
                  ELSE b.config_key || ' is ' || COALESCE(NULLIF(ci.value, ''), '(blank)') || '; expected ' || ${EXPECTATION_SQL} END AS title,
             '{}'::uuid[] AS txn_ids, NULL::numeric AS amount, b.severity AS severity,
             jsonb_build_object('config_key', b.config_key, 'value', ci.value, 'comparison', b.comparison, 'expected', b.expected_value,
                                'rationale', b.rationale, 'last_changed_at', ci.last_changed_at, 'last_changed_by', ci.last_changed_by) AS details
        FROM erp_config_baselines b
        LEFT JOIN erp_config_items ci ON ci.system_id = b.system_id AND ci.config_key = b.config_key
       WHERE b.system_id = $1 AND NOT ${COMPLIES_SQL}`
  },
  {
    code: 'CCM-CFG-02', name: 'Change to a monitored setting', txn_type: 'config', severity: 'medium',
    description: 'Every change to a setting that has a baseline, so each one can be matched to an approved change record.',
    params: { window_days: { type: 'integer', min: 1, max: 3650, default: 90 } },
    sql: (p) => `
      SELECT 'cfg-change:' || c.id AS fingerprint,
             c.config_key || ' changed from ' || COALESCE(NULLIF(c.old_value, ''), '(blank)') || ' to ' || COALESCE(NULLIF(c.new_value, ''), '(removed)') AS title,
             '{}'::uuid[] AS txn_ids, NULL::numeric AS amount,
             jsonb_build_object('config_key', c.config_key, 'old_value', c.old_value, 'new_value', c.new_value,
                                'changed_by', c.changed_by, 'changed_at', c.changed_at, 'detected_at', c.detected_at) AS details
        FROM erp_config_changes c
        JOIN erp_config_baselines b ON b.system_id = c.system_id AND b.config_key = c.config_key
       WHERE c.system_id = $1 AND c.detected_at >= NOW() - make_interval(days => ${p.window_days})`
  }
];

const RULES_BY_CODE = new Map(RULES.map((r) => [r.code, r]));

/** Merge saved parameters over defaults, rejecting anything out of range. */
function resolveParams(rule, saved = {}) {
  const out = {};
  for (const [name, spec] of Object.entries(rule.params)) {
    const value = saved[name] === undefined ? spec.default : saved[name];
    if (!PARAM_TYPES[spec.type](value, spec)) throw new CcmError(400, `${rule.code}: invalid ${name}`);
    out[name] = value;
  }
  return out;
}

async function listRules(organizationId) {
  const { rows } = await pool.query(
    `SELECT s.*, r.control_ref FROM erp_ccm_rule_settings s
       LEFT JOIN rcm_entries r ON r.id = s.rcm_entry_id AND r.organization_id = s.organization_id
      WHERE s.organization_id = $1`,
    [organizationId]
  );
  const settings = new Map(rows.map((r) => [r.rule_code, r]));
  return RULES.map((rule) => {
    const s = settings.get(rule.code);
    return {
      code: rule.code, name: rule.name, description: rule.description, txn_type: rule.txn_type, severity: rule.severity,
      is_active: s ? s.is_active : true,
      parameters: resolveParams(rule, s ? s.parameters : {}),
      parameter_specs: rule.params,
      rcm_entry_id: s ? s.rcm_entry_id : null,
      control_ref: s ? s.control_ref : null
    };
  });
}

async function updateRule(organizationId, userId, code, input) {
  const rule = RULES_BY_CODE.get(code);
  if (!rule) throw new CcmError(404, 'Monitoring rule not found');
  const { rows: [current] } = await pool.query('SELECT * FROM erp_ccm_rule_settings WHERE organization_id = $1 AND rule_code = $2', [organizationId, code]);
  const parameters = { ...(current ? current.parameters : {}) };
  if (input.parameters && typeof input.parameters === 'object') {
    for (const [name, value] of Object.entries(input.parameters)) {
      if (!rule.params[name]) throw new CcmError(400, `${code} has no parameter ${String(name).slice(0, 40)}`);
      parameters[name] = value;
    }
  }
  resolveParams(rule, parameters);
  let rcmEntryId = current ? current.rcm_entry_id : null;
  if (input.rcm_entry_id !== undefined) {
    if (input.rcm_entry_id) {
      const { rows } = await pool.query('SELECT 1 FROM rcm_entries WHERE id = $1 AND organization_id = $2', [input.rcm_entry_id, organizationId]);
      if (!rows.length) throw new CcmError(400, 'Risk-control matrix entry not found');
    }
    rcmEntryId = input.rcm_entry_id || null;
  }
  const isActive = typeof input.is_active === 'boolean' ? input.is_active : (current ? current.is_active : true);
  await pool.query(
    `INSERT INTO erp_ccm_rule_settings (organization_id, rule_code, is_active, parameters, rcm_entry_id, updated_by)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6)
     ON CONFLICT (organization_id, rule_code) DO UPDATE
       SET is_active = EXCLUDED.is_active, parameters = EXCLUDED.parameters, rcm_entry_id = EXCLUDED.rcm_entry_id,
           updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [organizationId, code, isActive, JSON.stringify(parameters), rcmEntryId, userId]
  );
  return (await listRules(organizationId)).find((r) => r.code === code);
}

async function recordControlTest(client, { organizationId, userId, rule, rcmEntryId, systemId, population }) {
  const { rows: [counts] } = await client.query(
    `SELECT COUNT(*) FILTER (WHERE status IN ('open', 'investigating'))::int AS unresolved, COUNT(*)::int AS total
       FROM erp_ccm_exceptions WHERE system_id = $1 AND rule_code = $2 AND organization_id = $3`,
    [systemId, rule.code, organizationId]
  );
  const conclusion = counts.unresolved ? 'ineffective' : (counts.total ? 'effective_with_exceptions' : 'effective');
  await client.query(
    `INSERT INTO control_tests (organization_id, rcm_entry_id, test_type, fiscal_year, population_size, sample_size, sample_method,
                                status, conclusion, procedures, notes, tester_id, created_by, completed_at)
     VALUES ($1, $2, 'operating_effectiveness', EXTRACT(YEAR FROM NOW())::int, $3, $3, 'full_population',
             'completed', $4, $5, $6, $7, $7, NOW())`,
    [organizationId, rcmEntryId, population, conclusion,
      `Full-population analytic ${rule.code} (${rule.name}) over ${population} ${rule.txn_type === 'config' ? 'configuration setting' : rule.txn_type.replace('_', ' ')} record(s).`,
      `${counts.total} exception(s) found to date, ${counts.unresolved} not yet resolved.`, userId]
  );
  return conclusion;
}

async function runRules(organizationId, userId, systemId) {
  const rules = (await listRules(organizationId)).filter((r) => r.is_active);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [system] } = await client.query('SELECT id FROM erp_systems WHERE id = $1 AND organization_id = $2 FOR UPDATE', [systemId, organizationId]);
    if (!system) throw new CcmError(404, 'ERP system not found');
    const { rows: populationRows } = await client.query(
      'SELECT txn_type, COUNT(*)::int AS n FROM erp_transactions WHERE system_id = $1 AND organization_id = $2 GROUP BY txn_type',
      [systemId, organizationId]
    );
    const population = Object.fromEntries(populationRows.map((r) => [r.txn_type, r.n]));
    const { rows: [configCount] } = await client.query(
      'SELECT COUNT(*)::int AS n FROM erp_config_items WHERE system_id = $1 AND organization_id = $2',
      [systemId, organizationId]
    );
    population.config = configCount.n;
    const { rows: [run] } = await client.query(
      'INSERT INTO erp_ccm_runs (organization_id, system_id, started_by) VALUES ($1, $2, $3) RETURNING id',
      [organizationId, systemId, userId]
    );
    const results = [];
    for (const setting of rules) {
      const rule = RULES_BY_CODE.get(setting.code);
      const values = [systemId, ...(rule.values ? rule.values(setting.parameters) : [])];
      const base = values.length;
      const { rows: [r] } = await client.query(
        `WITH found AS (${rule.sql(setting.parameters)}),
         up AS (
           INSERT INTO erp_ccm_exceptions (organization_id, system_id, rule_code, fingerprint, severity, title, details, transaction_ids, amount, last_run_id)
           SELECT $${base + 1}, $1, $${base + 2}, f.fingerprint, ${rule.rowSeverity ? `COALESCE(f.severity, $${base + 3}::text)` : `$${base + 3}`}, LEFT(f.title, 500), f.details, f.txn_ids, f.amount, $${base + 4} FROM found f
           ON CONFLICT ON CONSTRAINT erp_ccm_exceptions_unique DO UPDATE
             SET details = EXCLUDED.details, transaction_ids = EXCLUDED.transaction_ids, amount = EXCLUDED.amount,
                 title = EXCLUDED.title, severity = EXCLUDED.severity, last_detected_at = NOW(), last_run_id = EXCLUDED.last_run_id
           RETURNING (xmax = 0) AS inserted
         )
         SELECT COUNT(*)::int AS detected, COUNT(*) FILTER (WHERE inserted)::int AS new_exceptions FROM up`,
        [...values, organizationId, rule.code, rule.severity, run.id]
      );
      const result = { rule_code: rule.code, population: population[rule.txn_type] || 0, detected: r.detected, new_exceptions: r.new_exceptions };
      if (setting.rcm_entry_id && result.population) {
        result.control_test = await recordControlTest(client, {
          organizationId, userId, rule, rcmEntryId: setting.rcm_entry_id, systemId, population: result.population
        });
      }
      results.push(result);
    }
    await client.query('UPDATE erp_ccm_runs SET finished_at = NOW(), results = $2::jsonb WHERE id = $1', [run.id, JSON.stringify(results)]);
    await client.query('COMMIT');
    return { run_id: run.id, results };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listExceptions(organizationId, { systemId, ruleCode, status, severity, limit = 100, offset = 0 }) {
  const where = ['e.organization_id = $1'];
  const params = [organizationId];
  const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };
  if (systemId) add('e.system_id = ?', systemId);
  if (ruleCode) add('e.rule_code = ?', ruleCode);
  if (status) add('e.status = ?', status); else where.push("e.status IN ('open', 'investigating')");
  if (severity) add('e.severity = ?', severity);
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT e.*, s.name AS system_name, TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS assigned_to_name,
            COUNT(*) OVER () AS total_count
       FROM erp_ccm_exceptions e
       JOIN erp_systems s ON s.id = e.system_id
       LEFT JOIN users u ON u.id = e.assigned_to
      WHERE ${where.join(' AND ')}
      ORDER BY CASE e.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, e.amount DESC NULLS LAST, e.first_detected_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return {
    rows: rows.map(({ total_count, ...rest }) => ({ ...rest, rule_name: RULES_BY_CODE.get(rest.rule_code)?.name || rest.rule_code })),
    total: rows.length ? Number(rows[0].total_count) : 0
  };
}

async function updateException(organizationId, userId, exceptionId, input) {
  const { rows: [current] } = await pool.query('SELECT * FROM erp_ccm_exceptions WHERE id = $1 AND organization_id = $2', [exceptionId, organizationId]);
  if (!current) throw new CcmError(404, 'Exception not found');
  const status = input.status || current.status;
  if (!['open', 'investigating', 'resolved', 'false_positive'].includes(status)) throw new CcmError(400, 'Invalid status');
  const notes = typeof input.resolution_notes === 'string' ? input.resolution_notes.trim().slice(0, 4000) : current.resolution_notes;
  const closing = ['resolved', 'false_positive'].includes(status);
  if (closing && !notes) throw new CcmError(400, 'Record the investigation outcome in resolution_notes');
  let assignedTo = current.assigned_to;
  if (input.assigned_to !== undefined) {
    if (input.assigned_to) {
      const { rows } = await pool.query('SELECT 1 FROM users WHERE id = $1 AND organization_id = $2 AND is_active = true', [input.assigned_to, organizationId]);
      if (!rows.length) throw new CcmError(400, 'Assignee not found in this organization');
    }
    assignedTo = input.assigned_to || null;
  }
  const { rows: [updated] } = await pool.query(
    `UPDATE erp_ccm_exceptions
        SET status = $3, resolution_notes = $4, assigned_to = $5,
            resolved_by = CASE WHEN $6 THEN $7::uuid ELSE NULL END,
            resolved_at = CASE WHEN $6 THEN COALESCE(resolved_at, NOW()) ELSE NULL END
      WHERE id = $1 AND organization_id = $2 RETURNING *`,
    [exceptionId, organizationId, status, notes, assignedTo, closing, userId]
  );
  return updated;
}

module.exports = { CcmError, RULES, resolveParams, listRules, updateRule, runRules, listExceptions, updateException };
