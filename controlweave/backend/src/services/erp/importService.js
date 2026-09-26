'use strict';

/**
 * ERP entitlement imports from CSV. Works with any ERP: export users, roles,
 * user-role assignments and either role-to-function or role-to-permission plus
 * permission-to-function mappings, and load them here.
 *
 * Modes:
 *   merge   - upsert the rows in the file, leave everything else alone
 *   replace - the file is a full snapshot: users and roles missing from it are
 *             marked not present, and assignments or mappings missing from it
 *             are removed for that system
 *
 * Rows are validated individually; bad rows are reported with their line
 * number and skipped, and the rest are written with set-based statements so a
 * 100k-row extract is a handful of queries.
 *
 * Rows can also arrive already parsed (`rows` instead of `csv`), which is how
 * the direct connectors (services/erp/syncService.js) load their extracts, and
 * SAP standard table extracts (USR02, AGR_USERS, AGR_1251) are translated by
 * services/erp/sapExtract.js into the users, assignments and role permission
 * kinds.
 */

const pool = require('../../config/database');
const { parseCsvDocument } = require('../../utils/csv');
const sapExtract = require('./sapExtract');

const MAX_ROWS = 200000;
const KINDS = {
  users: { required: ['username'], key: ['username'] },
  roles: { required: ['role_name'], key: ['role_name'] },
  assignments: { required: ['username', 'role_name'], key: ['username', 'role_name'] },
  role_functions: { required: ['role_name', 'function_code'], key: ['role_name', 'function_code'] },
  role_permissions: { required: ['role_name', 'permission'], key: ['role_name', 'permission'] },
  function_map: { required: ['permission', 'function_code'], key: ['permission', 'function_code'] },
  emergency_sessions: { required: ['username', 'emergency_id', 'started_at'], key: ['emergency_id', 'started_at'] },
  transactions: { required: ['txn_type', 'external_id'], key: ['txn_type', 'external_id'] },
  config: { required: ['config_key'], key: ['config_key'] }
};

const TXN_TYPES = ['payment', 'invoice', 'journal_entry', 'vendor_change', 'purchase_order', 'goods_receipt'];
const numeric = (value) => value === undefined || String(value).trim() === '' || Number.isFinite(Number(String(value).replace(/,/g, '')));

class ImportError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const clip = (value, max = 200) => {
  const text = value === undefined || value === null ? '' : String(value).trim();
  return text ? text.slice(0, max) : null;
};

function parseDate(value) {
  const text = clip(value, 40);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function parseBool(value) {
  return ['yes', 'y', 'true', '1'].includes(String(value || '').trim().toLowerCase());
}

function normalizeStatus(value) {
  const text = String(value || 'active').trim().toLowerCase();
  if (['active', 'enabled', 'open', ''].includes(text)) return 'active';
  if (['locked', 'suspended'].includes(text)) return 'locked';
  return 'inactive';
}

/** Validate rows for a kind. Returns { valid, errors } with 1-based CSV line numbers. */
function validateRows(kind, rows, knownFunctions) {
  const spec = KINDS[kind];
  const valid = [];
  const errors = [];
  rows.forEach((row, index) => {
    const line = index + 2;
    const missing = spec.required.filter((f) => !clip(row[f]));
    if (missing.length) { errors.push({ line, error: `Missing ${missing.join(', ')}` }); return; }
    if (row.function_code !== undefined) {
      const code = String(row.function_code).trim().toUpperCase();
      if (!knownFunctions.has(code)) { errors.push({ line, error: `Unknown function code ${code.slice(0, 60)}` }); return; }
      row.function_code = code;
    }
    if (kind === 'transactions') {
      const type = String(row.txn_type).trim().toLowerCase();
      if (!TXN_TYPES.includes(type)) { errors.push({ line, error: `txn_type must be one of: ${TXN_TYPES.join(', ')}` }); return; }
      row.txn_type = type;
      if (!numeric(row.amount)) { errors.push({ line, error: 'Invalid amount' }); return; }
      if (!numeric(row.quantity)) { errors.push({ line, error: 'Invalid quantity' }); return; }
      if (type === 'goods_receipt') {
        if (!clip(row.reference)) { errors.push({ line, error: 'reference (the purchase order number) is required for a goods receipt' }); return; }
        if (!clip(row.amount) && !clip(row.quantity)) { errors.push({ line, error: 'amount or quantity is required' }); return; }
      } else if (type !== 'vendor_change' && !clip(row.amount)) { errors.push({ line, error: 'amount is required' }); return; }
    }
    for (const field of ['last_login_at', 'end_date', 'granted_at', 'expires_at', 'started_at', 'ended_at', 'txn_date', 'posted_at', 'changed_at']) {
      if (row[field] !== undefined && parseDate(row[field]) === undefined) { errors.push({ line, error: `Invalid date in ${field}` }); return; }
    }
    valid.push(row);
  });
  // The same key twice in one file: the later row wins, as it would in a
  // sequence of single-row updates.
  const byKey = new Map(valid.map((row) => [spec.key.map((f) => clip(row[f])).join('\u0000'), row]));
  return { valid: [...byKey.values()], errors };
}

async function knownFunctionCodes(executor, organizationId) {
  const { rows } = await executor.query('SELECT code FROM erp_functions WHERE organization_id IS NULL OR organization_id = $1', [organizationId]);
  return new Set(rows.map((r) => r.code));
}

async function upsertUsers(client, ctx, rows) {
  await client.query(
    `INSERT INTO erp_users (organization_id, system_id, username, full_name, email, department, manager, status, last_login_at, end_date, is_present, last_seen_at)
     SELECT $1, $2, u.username, u.full_name, u.email, u.department, u.manager, u.status, u.last_login_at::timestamptz, u.end_date::date, TRUE, NOW()
       FROM UNNEST($3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::text[])
            AS u(username, full_name, email, department, manager, status, last_login_at, end_date)
     ON CONFLICT (system_id, username) DO UPDATE
       SET full_name = COALESCE(EXCLUDED.full_name, erp_users.full_name), email = COALESCE(EXCLUDED.email, erp_users.email),
           department = COALESCE(EXCLUDED.department, erp_users.department), manager = COALESCE(EXCLUDED.manager, erp_users.manager),
           status = EXCLUDED.status, last_login_at = COALESCE(EXCLUDED.last_login_at, erp_users.last_login_at),
           end_date = COALESCE(EXCLUDED.end_date, erp_users.end_date), is_present = TRUE, last_seen_at = NOW()`,
    [ctx.orgId, ctx.systemId,
      rows.map((r) => clip(r.username)), rows.map((r) => clip(r.full_name)), rows.map((r) => clip(r.email)),
      rows.map((r) => clip(r.department)), rows.map((r) => clip(r.manager)), rows.map((r) => normalizeStatus(r.status)),
      rows.map((r) => parseDate(r.last_login_at)), rows.map((r) => parseDate(r.end_date))]
  );
  if (ctx.mode === 'replace') {
    await client.query(
      'UPDATE erp_users SET is_present = FALSE WHERE system_id = $1 AND organization_id = $2 AND NOT (username = ANY($3::text[]))',
      [ctx.systemId, ctx.orgId, rows.map((r) => clip(r.username))]
    );
  }
}

async function upsertRoles(client, ctx, rows) {
  await client.query(
    `INSERT INTO erp_roles (organization_id, system_id, role_name, description, is_privileged, is_present)
     SELECT $1, $2, r.role_name, r.description, r.is_privileged, TRUE
       FROM UNNEST($3::text[], $4::text[], $5::boolean[]) AS r(role_name, description, is_privileged)
     ON CONFLICT (system_id, role_name) DO UPDATE
       SET description = COALESCE(EXCLUDED.description, erp_roles.description), is_privileged = EXCLUDED.is_privileged, is_present = TRUE`,
    [ctx.orgId, ctx.systemId, rows.map((r) => clip(r.role_name)), rows.map((r) => clip(r.description, 1000)), rows.map((r) => parseBool(r.is_privileged))]
  );
  if (ctx.mode === 'replace') {
    await client.query(
      'UPDATE erp_roles SET is_present = FALSE WHERE system_id = $1 AND organization_id = $2 AND NOT (role_name = ANY($3::text[]))',
      [ctx.systemId, ctx.orgId, rows.map((r) => clip(r.role_name))]
    );
  }
}

/** Create any users or roles referenced by name that do not exist yet. */
async function ensureNames(client, ctx, usernames, roleNames) {
  if (usernames.length) {
    await client.query(
      `INSERT INTO erp_users (organization_id, system_id, username)
       SELECT $1, $2, u FROM UNNEST($3::text[]) AS u ON CONFLICT (system_id, username) DO NOTHING`,
      [ctx.orgId, ctx.systemId, [...new Set(usernames)]]
    );
  }
  if (roleNames.length) {
    await client.query(
      `INSERT INTO erp_roles (organization_id, system_id, role_name)
       SELECT $1, $2, r FROM UNNEST($3::text[]) AS r ON CONFLICT (system_id, role_name) DO NOTHING`,
      [ctx.orgId, ctx.systemId, [...new Set(roleNames)]]
    );
  }
}

async function upsertAssignments(client, ctx, rows) {
  const usernames = rows.map((r) => clip(r.username));
  const roleNames = rows.map((r) => clip(r.role_name));
  await ensureNames(client, ctx, usernames, roleNames);
  if (ctx.mode === 'replace') {
    await client.query('DELETE FROM erp_user_roles WHERE system_id = $1 AND organization_id = $2', [ctx.systemId, ctx.orgId]);
  }
  await client.query(
    `INSERT INTO erp_user_roles (organization_id, system_id, user_id, role_id, granted_at, expires_at)
     SELECT $1, $2, u.id, r.id, a.granted_at::date, a.expires_at::date
       FROM UNNEST($3::text[], $4::text[], $5::text[], $6::text[]) AS a(username, role_name, granted_at, expires_at)
       JOIN erp_users u ON u.system_id = $2 AND u.username = a.username
       JOIN erp_roles r ON r.system_id = $2 AND r.role_name = a.role_name
     ON CONFLICT (user_id, role_id) DO UPDATE
       SET granted_at = COALESCE(EXCLUDED.granted_at, erp_user_roles.granted_at), expires_at = EXCLUDED.expires_at`,
    [ctx.orgId, ctx.systemId, usernames, roleNames, rows.map((r) => parseDate(r.granted_at)), rows.map((r) => parseDate(r.expires_at))]
  );
}

async function upsertRoleMapping(client, ctx, rows, { table, column }) {
  const roleNames = rows.map((r) => clip(r.role_name));
  await ensureNames(client, ctx, [], roleNames);
  if (ctx.mode === 'replace') {
    await client.query(`DELETE FROM ${table} WHERE system_id = $1 AND organization_id = $2`, [ctx.systemId, ctx.orgId]);
  }
  await client.query(
    `INSERT INTO ${table} (organization_id, system_id, role_id, ${column})
     SELECT DISTINCT $1::uuid, $2::uuid, r.id, m.value
       FROM UNNEST($3::text[], $4::text[]) AS m(role_name, value)
       JOIN erp_roles r ON r.system_id = $2 AND r.role_name = m.role_name
     ON CONFLICT DO NOTHING`,
    [ctx.orgId, ctx.systemId, roleNames, rows.map((r) => clip(r[column], 200))]
  );
}

async function upsertFunctionMap(client, ctx, rows) {
  if (ctx.mode === 'replace') {
    await client.query('DELETE FROM erp_function_permissions WHERE system_id = $1 AND organization_id = $2', [ctx.systemId, ctx.orgId]);
  }
  await client.query(
    `INSERT INTO erp_function_permissions (organization_id, system_id, permission, function_code)
     SELECT DISTINCT $1::uuid, $2::uuid, m.permission, m.function_code
       FROM UNNEST($3::text[], $4::text[]) AS m(permission, function_code)
     ON CONFLICT DO NOTHING`,
    [ctx.orgId, ctx.systemId, rows.map((r) => clip(r.permission)), rows.map((r) => r.function_code)]
  );
}

async function upsertEmergencySessions(client, ctx, rows) {
  await client.query(
    `INSERT INTO erp_emergency_sessions (organization_id, system_id, username, emergency_id, reason, started_at, ended_at, activity_count, activity_summary)
     SELECT $1, $2, s.username, s.emergency_id, s.reason, s.started_at::timestamptz, s.ended_at::timestamptz, s.activity_count, s.activity_summary
       FROM UNNEST($3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::int[], $9::text[])
            AS s(username, emergency_id, reason, started_at, ended_at, activity_count, activity_summary)
     ON CONFLICT (system_id, emergency_id, started_at) DO UPDATE
       SET ended_at = EXCLUDED.ended_at, activity_count = EXCLUDED.activity_count,
           activity_summary = EXCLUDED.activity_summary, reason = COALESCE(EXCLUDED.reason, erp_emergency_sessions.reason)`,
    [ctx.orgId, ctx.systemId, rows.map((r) => clip(r.username)), rows.map((r) => clip(r.emergency_id)),
      rows.map((r) => clip(r.reason, 1000)), rows.map((r) => parseDate(r.started_at)), rows.map((r) => parseDate(r.ended_at)),
      rows.map((r) => (Number.isInteger(Number(r.activity_count)) && r.activity_count !== '' ? Number(r.activity_count) : null)),
      rows.map((r) => clip(r.activity_summary, 4000))]
  );
}

/**
 * Mark revocations from access reviews as verified once the roles are gone
 * (or the user is no longer present) in the latest data.
 */
async function verifyRevocations(client, ctx) {
  const { rowCount } = await client.query(
    `UPDATE erp_access_review_items i
        SET revocation_verified_at = NOW()
       FROM erp_access_reviews rv
      WHERE rv.id = i.review_id AND rv.system_id = $1 AND i.organization_id = $2
        AND i.decision = 'revoke' AND i.revocation_verified_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM erp_users u
            JOIN erp_user_roles ur ON ur.user_id = u.id
            JOIN erp_roles r ON r.id = ur.role_id
           WHERE u.system_id = $1 AND u.username = i.username AND u.is_present AND u.status = 'active'
             AND (cardinality(i.roles_to_revoke) = 0 OR r.role_name = ANY(i.roles_to_revoke))
        )`,
    [ctx.systemId, ctx.orgId]
  );
  return rowCount;
}

// Tables each import kind writes. After a large load their planner statistics
// are stale until autovacuum catches up, and the analysis and review queries
// that follow an import pick nested-loop plans that take minutes instead of
// milliseconds, so large imports refresh them directly.
const ANALYZE_TABLES = {
  users: ['erp_users'],
  roles: ['erp_roles'],
  assignments: ['erp_users', 'erp_roles', 'erp_user_roles'],
  role_functions: ['erp_roles', 'erp_role_functions'],
  role_permissions: ['erp_roles', 'erp_role_permissions'],
  function_map: ['erp_function_permissions'],
  emergency_sessions: ['erp_emergency_sessions'],
  transactions: ['erp_transactions'],
  config: ['erp_config_items']
};
const ANALYZE_THRESHOLD = 1000;

async function upsertTransactions(client, ctx, rows) {
  const amount = (r) => {
    const text = String(r.amount === undefined ? '' : r.amount).replace(/,/g, '').trim();
    return text === '' ? null : text;
  };
  const day = (r) => {
    const d = parseDate(r.txn_date) || parseDate(r.posted_at);
    return d ? d.slice(0, 10) : null;
  };
  const quantity = (r) => {
    const text = String(r.quantity === undefined ? '' : r.quantity).replace(/,/g, '').trim();
    return text === '' ? null : text;
  };
  await client.query(
    `INSERT INTO erp_transactions (organization_id, system_id, txn_type, external_id, document_number, reference, vendor_id, vendor_name,
                                   amount, currency, txn_date, posted_at, created_by, approved_by, change_field, quantity, imported_at)
     SELECT $1, $2, t.txn_type, t.external_id, t.document_number, t.reference, t.vendor_id, t.vendor_name,
            t.amount::numeric, t.currency, t.txn_date::date, t.posted_at::timestamptz, t.created_by, t.approved_by, t.change_field, t.quantity::numeric, NOW()
       FROM UNNEST($3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::text[],
                   $11::text[], $12::text[], $13::text[], $14::text[], $15::text[], $16::text[])
            AS t(txn_type, external_id, document_number, reference, vendor_id, vendor_name, amount, currency, txn_date, posted_at, created_by, approved_by, change_field, quantity)
     ON CONFLICT (system_id, txn_type, external_id) DO UPDATE
       SET document_number = EXCLUDED.document_number, reference = EXCLUDED.reference, vendor_id = EXCLUDED.vendor_id,
           vendor_name = EXCLUDED.vendor_name, amount = EXCLUDED.amount, currency = EXCLUDED.currency, txn_date = EXCLUDED.txn_date,
           posted_at = EXCLUDED.posted_at, created_by = EXCLUDED.created_by, approved_by = EXCLUDED.approved_by,
           change_field = EXCLUDED.change_field, quantity = EXCLUDED.quantity, imported_at = NOW()`,
    [ctx.orgId, ctx.systemId, rows.map((r) => r.txn_type), rows.map((r) => clip(r.external_id)), rows.map((r) => clip(r.document_number)),
      rows.map((r) => clip(r.reference)), rows.map((r) => clip(r.vendor_id)), rows.map((r) => clip(r.vendor_name)), rows.map(amount),
      rows.map((r) => clip(r.currency, 3)), rows.map(day), rows.map((r) => parseDate(r.posted_at)),
      rows.map((r) => clip(r.created_by)), rows.map((r) => clip(r.approved_by)), rows.map((r) => clip(r.change_field)), rows.map(quantity)]
  );
}

/**
 * Current configuration values. A value that differs from the stored one is
 * recorded in erp_config_changes (a key seen for the first time is not a
 * change). In replace mode keys missing from the extract are marked not
 * present and their removal is recorded as a change to NULL.
 */
async function upsertConfig(client, ctx, rows) {
  const keys = rows.map((r) => clip(r.config_key, 300));
  const values = rows.map((r) => (r.value === undefined || r.value === null ? null : String(r.value).trim().slice(0, 4000)));
  const changedAt = rows.map((r) => parseDate(r.changed_at));
  const changedBy = rows.map((r) => clip(r.changed_by));
  await client.query(
    `INSERT INTO erp_config_changes (organization_id, system_id, config_key, old_value, new_value, changed_at, changed_by)
     SELECT $1, $2, i.config_key, e.value, i.value, i.changed_at::timestamptz, i.changed_by
       FROM UNNEST($3::text[], $4::text[], $5::text[], $6::text[]) AS i(config_key, value, changed_at, changed_by)
       JOIN erp_config_items e ON e.system_id = $2 AND e.config_key = i.config_key
      WHERE e.value IS DISTINCT FROM i.value OR NOT e.is_present`,
    [ctx.orgId, ctx.systemId, keys, values, changedAt, changedBy]
  );
  await client.query(
    `INSERT INTO erp_config_items (organization_id, system_id, config_key, category, value, description, last_changed_at, last_changed_by)
     SELECT $1, $2, i.config_key, i.category, i.value, i.description, i.changed_at::timestamptz, i.changed_by
       FROM UNNEST($3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[])
            AS i(config_key, value, changed_at, changed_by, category, description)
     ON CONFLICT (system_id, config_key) DO UPDATE
       SET category = COALESCE(EXCLUDED.category, erp_config_items.category),
           description = COALESCE(EXCLUDED.description, erp_config_items.description),
           last_changed_at = CASE WHEN erp_config_items.value IS DISTINCT FROM EXCLUDED.value OR NOT erp_config_items.is_present
                                  THEN COALESCE(EXCLUDED.last_changed_at, NOW()) ELSE erp_config_items.last_changed_at END,
           last_changed_by = CASE WHEN erp_config_items.value IS DISTINCT FROM EXCLUDED.value OR NOT erp_config_items.is_present
                                  THEN EXCLUDED.last_changed_by ELSE erp_config_items.last_changed_by END,
           value = EXCLUDED.value, is_present = TRUE, last_seen_at = NOW()`,
    [ctx.orgId, ctx.systemId, keys, values, changedAt, changedBy, rows.map((r) => clip(r.category)), rows.map((r) => clip(r.description, 1000))]
  );
  if (ctx.mode === 'replace') {
    await client.query(
      `WITH gone AS (
         UPDATE erp_config_items SET is_present = FALSE, last_changed_at = NOW(), last_changed_by = NULL
          WHERE system_id = $2 AND organization_id = $1 AND is_present AND NOT (config_key = ANY($3::text[]))
          RETURNING config_key, value
       )
       INSERT INTO erp_config_changes (organization_id, system_id, config_key, old_value, new_value, changed_at)
       SELECT $1, $2, config_key, value, NULL, NOW() FROM gone`,
      [ctx.orgId, ctx.systemId, keys]
    );
  }
}

const WRITERS = {
  users: upsertUsers,
  roles: upsertRoles,
  assignments: upsertAssignments,
  role_functions: (c, ctx, rows) => upsertRoleMapping(c, ctx, rows, { table: 'erp_role_functions', column: 'function_code' }),
  role_permissions: (c, ctx, rows) => upsertRoleMapping(c, ctx, rows, { table: 'erp_role_permissions', column: 'permission' }),
  function_map: upsertFunctionMap,
  emergency_sessions: upsertEmergencySessions,
  transactions: upsertTransactions,
  config: upsertConfig
};

const ALL_KINDS = [...Object.keys(KINDS), ...Object.keys(sapExtract.SAP_KINDS)];

async function sapLibraryCodes(executor) {
  const { rows } = await executor.query("SELECT DISTINCT permission FROM erp_permission_library WHERE platform = 'sap' ORDER BY permission");
  return rows.map((r) => r.permission);
}

/**
 * Import one kind of data into a system. Pass `csv` (a CSV document) or
 * `rows` (already parsed objects keyed by column name). `client`, when given,
 * runs the import inside the caller's transaction (the caller holds the
 * system lock and commits).
 */
async function runImport({ organizationId, userId, systemId, kind, csv, rows: providedRows, mode = 'merge', source = 'file', client: outerClient }) {
  if (!ALL_KINDS.includes(kind)) throw new ImportError(400, `kind must be one of: ${ALL_KINDS.join(', ')}`);
  if (!['merge', 'replace'].includes(mode)) throw new ImportError(400, 'mode must be merge or replace');
  if (['emergency_sessions', 'transactions'].includes(kind) && mode === 'replace') throw new ImportError(400, `${kind.replace('_', ' ')} are imported in merge mode`);
  let rows = providedRows || parseCsvDocument(csv).rows;
  if (!rows.length) throw new ImportError(400, 'No data rows found');
  if (rows.length > MAX_ROWS) throw new ImportError(413, `At most ${MAX_ROWS} rows per import`);

  const client = outerClient || await pool.connect();
  try {
    if (!outerClient) await client.query('BEGIN');
    const { rows: [system] } = await client.query('SELECT id FROM erp_systems WHERE id = $1 AND organization_id = $2 FOR UPDATE', [systemId, organizationId]);
    if (!system) throw new ImportError(404, 'ERP system not found');
    const sourceKind = kind;
    let privilegedRoles = [];
    if (sapExtract.SAP_KINDS[kind]) {
      let translated;
      try {
        translated = sapExtract.translate(kind, rows, await sapLibraryCodes(client));
      } catch (error) {
        throw new ImportError(error.status || 400, error.message);
      }
      ({ kind, rows } = translated);
      privilegedRoles = translated.privilegedRoles;
      if (!rows.length) throw new ImportError(400, 'The extract has no rows ControlWeaver can use (AGR_1251: S_TCODE / TCD values)');
    }
    const functions = await knownFunctionCodes(client, organizationId);
    const { valid, errors } = validateRows(kind, rows, functions);
    if (mode === 'replace' && errors.length) {
      throw new ImportError(400, `A full snapshot must be valid in every row; ${errors.length} row(s) failed (first: line ${errors[0].line}, ${errors[0].error})`);
    }
    const ctx = { orgId: organizationId, systemId, mode };
    if (valid.length) await WRITERS[kind](client, ctx, valid);
    if (privilegedRoles.length) {
      await client.query(
        'UPDATE erp_roles SET is_privileged = TRUE WHERE system_id = $1 AND organization_id = $2 AND role_name = ANY($3::text[])',
        [systemId, organizationId, privilegedRoles]
      );
    }
    const verified = ['assignments', 'users'].includes(kind) ? await verifyRevocations(client, ctx) : 0;
    const label = sourceKind === kind ? kind : `${kind} (${sourceKind.slice(4).toUpperCase()})`;
    const { rows: [run] } = await client.query(
      `INSERT INTO erp_import_runs (organization_id, system_id, kind, mode, row_count, error_count, errors, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8) RETURNING *`,
      [organizationId, systemId, source === 'file' ? label : `${label} via ${source}`, mode, valid.length, errors.length, JSON.stringify(errors.slice(0, 200)), userId]
    );
    await client.query('UPDATE erp_systems SET last_import_at = NOW(), updated_at = NOW() WHERE id = $1', [systemId]);
    if (!outerClient) await client.query('COMMIT');
    if (!outerClient && valid.length >= ANALYZE_THRESHOLD) {
      for (const table of ANALYZE_TABLES[kind]) await client.query(`ANALYZE ${table}`);
    }
    return { ...run, errors: errors.slice(0, 200), revocations_verified: verified, analyze_tables: valid.length >= ANALYZE_THRESHOLD ? ANALYZE_TABLES[kind] : [] };
  } catch (error) {
    if (!outerClient) await client.query('ROLLBACK');
    throw error;
  } finally {
    if (!outerClient) client.release();
  }
}

module.exports = { KINDS, ALL_KINDS, TXN_TYPES, ImportError, runImport, validateRows, normalizeStatus };
