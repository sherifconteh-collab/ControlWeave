'use strict';

/**
 * ERP transaction monitoring (services/erp/ccmService.js). Transactions are
 * imported through POST /erp/systems/:id/import with kind=transactions.
 *
 *   GET    /erp/monitoring/summary              open exceptions by rule and severity
 *   GET    /erp/monitoring/rules                rules with this organization's settings
 *   PUT    /erp/monitoring/rules/:code          enable, tune thresholds, tie to a matrix control
 *   POST   /erp/monitoring/systems/:id/run      run the active rules over a system's transactions
 *   GET    /erp/monitoring/runs                 run history
 *   GET    /erp/monitoring/exceptions           exceptions (open and investigating by default)
 *   GET    /erp/monitoring/exceptions/export    exceptions as CSV
 *   PATCH  /erp/monitoring/exceptions/:id       assign, investigate, resolve or mark false positive
 *   GET    /erp/monitoring/systems/:id/config            settings with baseline compliance (import kind=config)
 *   GET    /erp/monitoring/systems/:id/config/changes    changes seen between extracts
 *   PUT    /erp/monitoring/systems/:id/baselines         add or edit a baseline (by config_key)
 *   DELETE /erp/monitoring/systems/:id/baselines/:baselineId
 *   POST   /erp/monitoring/systems/:id/baselines/adopt-library   copy the recommended settings for the platform
 *   GET    /erp/monitoring/baseline-library              recommended settings (SAP, Oracle E-Business Suite)
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const pool = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { createOrgRateLimiter } = require('../middleware/rateLimit');
const { isUuid } = require('../middleware/validate');
const auditService = require('../services/auditService');
const { requireFeature } = require('../services/entitlementService');
const ccm = require('../services/erp/ccmService');
const configService = require('../services/erp/configService');
const { toCsvDocument } = require('../utils/csv');
const { log, serializeError } = require('../utils/logger');

router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 600 }));
router.use(authenticate);
router.use(createOrgRateLimiter({ label: 'erp-monitoring', windowMs: 15 * 60 * 1000, max: 1000 }));

const canRead = requirePermission('erp.read');
const canManage = requirePermission('erp.manage');
// ERP Governance is a separately licensed add-on. Every change is behind the
// wall; reads stay open so an organization that lets the add-on lapse can
// still see and export what it recorded. A no-op unless COMMERCIAL_MODE=true.
const licensed = requireFeature('erp_governance');
router.use((req, res, next) => (['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? next() : licensed(req, res, next)));
const STATUSES = ['open', 'investigating', 'resolved', 'false_positive'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];

function failed(res, error, event) {
  if (error instanceof ccm.CcmError || error instanceof configService.ConfigError) return res.status(error.status).json({ success: false, error: error.message });
  log('error', event, { error: serializeError(error) });
  return res.status(500).json({ success: false, error: 'Internal server error' });
}

function exceptionFilters(query) {
  return {
    systemId: isUuid(query.system_id) ? query.system_id : null,
    ruleCode: typeof query.rule_code === 'string' && /^CCM-[A-Z0-9]{2,4}-\d{2}$/.test(query.rule_code) ? query.rule_code : null,
    status: STATUSES.includes(query.status) ? query.status : null,
    severity: SEVERITIES.includes(query.severity) ? query.severity : null
  };
}

router.get('/summary', canRead, async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { rows: byRule } = await pool.query(
      `SELECT rule_code, severity, COUNT(*)::int AS open, COALESCE(SUM(amount), 0)::numeric AS exposure
         FROM erp_ccm_exceptions WHERE organization_id = $1 AND status IN ('open', 'investigating')
        GROUP BY rule_code, severity ORDER BY rule_code`,
      [orgId]
    );
    const { rows: [totals] } = await pool.query(
      `SELECT (SELECT COUNT(*)::int FROM erp_transactions WHERE organization_id = $1) AS transactions,
              (SELECT MAX(started_at) FROM erp_ccm_runs WHERE organization_id = $1) AS last_run_at,
              (SELECT COUNT(*)::int FROM erp_ccm_exceptions WHERE organization_id = $1 AND status IN ('open', 'investigating')) AS open_exceptions,
              (SELECT COUNT(*)::int FROM erp_ccm_exceptions WHERE organization_id = $1 AND status IN ('open', 'investigating') AND severity = 'critical') AS critical_exceptions`,
      [orgId]
    );
    res.json({ success: true, data: { ...totals, by_rule: byRule } });
  } catch (error) {
    return failed(res, error, 'erp_monitoring.summary_failed');
  }
});

router.get('/rules', canRead, async (req, res) => {
  try {
    res.json({ success: true, data: await ccm.listRules(req.user.organization_id) });
  } catch (error) {
    return failed(res, error, 'erp_monitoring.rules_list_failed');
  }
});

router.put('/rules/:code', canManage, async (req, res) => {
  try {
    const body = req.body || {};
    if (body.rcm_entry_id && !isUuid(body.rcm_entry_id)) return res.status(400).json({ success: false, error: 'Invalid rcm_entry_id' });
    const rule = await ccm.updateRule(req.user.organization_id, req.user.id, String(req.params.code).slice(0, 20), body);
    await auditService.logFromRequest(req, { eventType: 'erp_monitoring.rule_updated', resourceType: 'erp_ccm_rule', resourceId: null, details: { rule_code: rule.code, is_active: rule.is_active, parameters: rule.parameters, rcm_entry_id: rule.rcm_entry_id } });
    res.json({ success: true, data: rule });
  } catch (error) {
    return failed(res, error, 'erp_monitoring.rule_update_failed');
  }
});

router.post('/systems/:id/run', canManage, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid id' });
    const result = await ccm.runRules(req.user.organization_id, req.user.id, req.params.id);
    await auditService.logFromRequest(req, {
      eventType: 'erp_monitoring.run', resourceType: 'erp_system', resourceId: req.params.id,
      details: { run_id: result.run_id, detected: result.results.reduce((n, r) => n + r.detected, 0), new_exceptions: result.results.reduce((n, r) => n + r.new_exceptions, 0) }
    });
    res.json({ success: true, data: result });
  } catch (error) {
    return failed(res, error, 'erp_monitoring.run_failed');
  }
});

router.get('/runs', canRead, async (req, res) => {
  try {
    const params = [req.user.organization_id];
    let filter = '';
    if (isUuid(req.query.system_id)) { params.push(req.query.system_id); filter = 'AND r.system_id = $2'; }
    const { rows } = await pool.query(
      `SELECT r.*, s.name AS system_name, TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS started_by_name
         FROM erp_ccm_runs r JOIN erp_systems s ON s.id = r.system_id LEFT JOIN users u ON u.id = r.started_by
        WHERE r.organization_id = $1 ${filter} ORDER BY r.started_at DESC LIMIT 50`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    return failed(res, error, 'erp_monitoring.runs_list_failed');
  }
});

router.get('/exceptions', canRead, async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const result = await ccm.listExceptions(req.user.organization_id, { ...exceptionFilters(req.query), limit, offset });
    res.json({ success: true, data: result.rows, pagination: { total: result.total, limit, offset } });
  } catch (error) {
    return failed(res, error, 'erp_monitoring.exceptions_list_failed');
  }
});

router.get('/exceptions/export', canRead, async (req, res) => {
  try {
    const result = await ccm.listExceptions(req.user.organization_id, { ...exceptionFilters(req.query), limit: 50000, offset: 0 });
    const header = ['rule_code', 'rule_name', 'severity', 'status', 'title', 'amount', 'system_name', 'assigned_to_name', 'first_detected_at', 'resolution_notes', 'details'];
    const csv = toCsvDocument(header, result.rows.map((e) => ({
      ...e,
      first_detected_at: new Date(e.first_detected_at).toISOString(),
      details: JSON.stringify(e.details)
    })));
    await auditService.logFromRequest(req, { eventType: 'erp_monitoring.exceptions_exported', resourceType: 'erp_ccm_exception', details: { rows: result.rows.length } });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="erp-monitoring-exceptions.csv"');
    res.send(csv);
  } catch (error) {
    return failed(res, error, 'erp_monitoring.export_failed');
  }
});

router.patch('/exceptions/:id', canManage, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid id' });
    const body = req.body || {};
    if (body.assigned_to && !isUuid(body.assigned_to)) return res.status(400).json({ success: false, error: 'Invalid assigned_to' });
    const exception = await ccm.updateException(req.user.organization_id, req.user.id, req.params.id, body);
    await auditService.logFromRequest(req, { eventType: 'erp_monitoring.exception_updated', resourceType: 'erp_ccm_exception', resourceId: exception.id, details: { status: exception.status, assigned_to: exception.assigned_to } });
    res.json({ success: true, data: exception });
  } catch (error) {
    return failed(res, error, 'erp_monitoring.exception_update_failed');
  }
});

// ---------------------------------------------------------------- configuration

function systemParam(req, res) {
  if (isUuid(req.params.id)) return true;
  res.status(400).json({ success: false, error: 'Invalid id' });
  return false;
}

router.get('/systems/:id/config', canRead, async (req, res) => {
  try {
    if (!systemParam(req, res)) return undefined;
    const rows = await configService.listItems(req.user.organization_id, req.params.id, { onlyBaselined: req.query.monitored === 'true' });
    res.json({ success: true, data: rows });
  } catch (error) {
    return failed(res, error, 'erp_monitoring.config_list_failed');
  }
});

router.get('/systems/:id/config/changes', canRead, async (req, res) => {
  try {
    if (!systemParam(req, res)) return undefined;
    const limit = parseInt(req.query.limit, 10) || 200;
    res.json({ success: true, data: await configService.listChanges(req.user.organization_id, req.params.id, { limit }) });
  } catch (error) {
    return failed(res, error, 'erp_monitoring.config_changes_failed');
  }
});

router.put('/systems/:id/baselines', canManage, async (req, res) => {
  try {
    if (!systemParam(req, res)) return undefined;
    const baseline = await configService.upsertBaseline(req.user.organization_id, req.user.id, req.params.id, req.body || {});
    await auditService.logFromRequest(req, {
      eventType: 'erp_monitoring.baseline_saved', resourceType: 'erp_system', resourceId: req.params.id,
      details: { config_key: baseline.config_key, comparison: baseline.comparison, expected_value: baseline.expected_value, severity: baseline.severity }
    });
    res.json({ success: true, data: baseline });
  } catch (error) {
    return failed(res, error, 'erp_monitoring.baseline_save_failed');
  }
});

router.delete('/systems/:id/baselines/:baselineId', canManage, async (req, res) => {
  try {
    if (!systemParam(req, res)) return undefined;
    if (!isUuid(req.params.baselineId)) return res.status(400).json({ success: false, error: 'Invalid baselineId' });
    await configService.deleteBaseline(req.user.organization_id, req.params.id, req.params.baselineId);
    await auditService.logFromRequest(req, { eventType: 'erp_monitoring.baseline_deleted', resourceType: 'erp_system', resourceId: req.params.id, details: { baseline_id: req.params.baselineId } });
    res.json({ success: true, data: { id: req.params.baselineId } });
  } catch (error) {
    return failed(res, error, 'erp_monitoring.baseline_delete_failed');
  }
});

router.post('/systems/:id/baselines/adopt-library', canManage, async (req, res) => {
  try {
    if (!systemParam(req, res)) return undefined;
    const result = await configService.adoptLibrary(req.user.organization_id, req.user.id, req.params.id);
    await auditService.logFromRequest(req, { eventType: 'erp_monitoring.baselines_adopted', resourceType: 'erp_system', resourceId: req.params.id, details: result });
    res.json({ success: true, data: result });
  } catch (error) {
    return failed(res, error, 'erp_monitoring.baselines_adopt_failed');
  }
});

router.get('/baseline-library', canRead, async (req, res) => {
  try {
    const platform = ['sap', 'oracle_ebs'].includes(req.query.platform) ? req.query.platform : null;
    res.json({ success: true, data: await configService.listLibrary(platform) });
  } catch (error) {
    return failed(res, error, 'erp_monitoring.baseline_library_failed');
  }
});

module.exports = router;
