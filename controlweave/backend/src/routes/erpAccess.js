'use strict';

/**
 * ERP access governance (services/erp/*).
 *
 *   GET    /erp/summary                         counts for the dashboard
 *   GET    /erp/systems                         list ERP systems
 *   POST   /erp/systems                         register a system
 *   PATCH  /erp/systems/:id                     update a system
 *   DELETE /erp/systems/:id                     remove a system and its imported data
 *   POST   /erp/systems/:id/import              import users, roles, assignments, mappings or emergency sessions (CSV)
 *   GET    /erp/systems/:id/imports             import history
 *   GET    /erp/systems/:id/users               imported users with role and conflict counts
 *   GET    /erp/systems/:id/users/:userId       one user's roles, functions and conflicts
 *   POST   /erp/systems/:id/analyze             run SoD analysis
 *   GET    /erp/connectors                      direct connector types and their settings
 *   PUT    /erp/systems/:id/connector           set or remove a system's connector (credentials encrypted)
 *   PUT    /erp/systems/:id/schedule            schedule, automatic analysis and monitoring, starter map, ticketing
 *   POST   /erp/systems/:id/sync                run the connector (and analysis and monitoring) now
 *   GET    /erp/systems/:id/sync-runs           sync history
 *   GET    /erp/permission-library              ControlWeave starter maps (SAP transactions, Oracle EBS functions)
 *   GET    /erp/ticket-connectors               Jira and ITSM connectors usable for revocation tickets
 *   GET    /erp/functions                       business function catalog
 *   GET    /erp/sod/rules                       library and organization rules
 *   POST   /erp/sod/rules                       add an organization rule
 *   PATCH  /erp/sod/rules/:id                   edit an organization rule, or switch a library rule on or off
 *   GET    /erp/sod/conflicts                   conflicts (open, mitigated and accepted by default)
 *   PATCH  /erp/sod/conflicts/:id               mitigate, accept or reopen
 *   GET    /erp/mitigating-controls             list mitigating controls
 *   POST   /erp/mitigating-controls             add a mitigating control
 *   GET    /erp/reviews                         access reviews
 *   POST   /erp/reviews                         start a review over a system's active users
 *   GET    /erp/reviews/:id                     review with items (?mine=true: items assigned to me)
 *   PATCH  /erp/reviews/:id/items/:itemId       certify or revoke
 *   POST   /erp/reviews/:id/complete            close the review, file evidence and open revocation tickets
 *   POST   /erp/reviews/:id/tickets             open revocation tickets for revoked items without one
 *   GET    /erp/reviews/:id/export              decisions as CSV
 *   GET    /erp/emergency-sessions              firefighter sessions
 *   PATCH  /erp/emergency-sessions/:id          record the after-the-fact review
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
const importService = require('../services/erp/importService');
const { roleFunctionsSql } = require('../services/erp/roleFunctions');
const sod = require('../services/erp/sodService');
const reviews = require('../services/erp/reviewService');
const syncService = require('../services/erp/syncService');
const tickets = require('../services/erp/ticketService');
const { log, serializeError } = require('../utils/logger');

router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 600 }));
router.use(authenticate);
router.use(createOrgRateLimiter({ label: 'erp', windowMs: 15 * 60 * 1000, max: 1000 }));

const canRead = requirePermission('erp.read');
const canManage = requirePermission('erp.manage');
// ERP Governance is a separately licensed add-on. Every change is behind the
// wall; reads stay open so an organization that lets the add-on lapse can
// still see and export what it recorded. A no-op unless COMMERCIAL_MODE=true.
const licensed = requireFeature('erp_governance');
router.use((req, res, next) => (['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? next() : licensed(req, res, next)));
const ERP_TYPES = ['oracle_ebs', 'oracle_cloud_erp', 'sap_ecc', 'sap_s4hana', 'workday', 'netsuite', 'dynamics_365', 'peoplesoft', 'other'];
const MAX_CSV_BYTES = 25 * 1024 * 1024;
const KNOWN_ERRORS = [importService.ImportError, sod.SodError, reviews.ReviewError, syncService.SyncError];

function failed(res, error, event) {
  if (KNOWN_ERRORS.some((E) => error instanceof E)) return res.status(error.status).json({ success: false, error: error.message });
  log('error', event, { error: serializeError(error) });
  return res.status(500).json({ success: false, error: 'Internal server error' });
}

function uuidParams(...names) {
  return (req, res, next) => {
    const bad = names.find((n) => !isUuid(req.params[n]));
    return bad ? res.status(400).json({ success: false, error: `Invalid ${bad}` }) : next();
  };
}

function hasPermission(req, permission) {
  const perms = req.user.permissions || [];
  return perms.includes('*') || perms.includes(permission);
}

// ---------------------------------------------------------------- summary

router.get('/summary', canRead, async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { rows: [data] } = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM erp_systems WHERE organization_id = $1) AS systems,
         (SELECT COUNT(*)::int FROM erp_users WHERE organization_id = $1 AND is_present AND status = 'active') AS active_users,
         (SELECT COUNT(*)::int FROM erp_sod_conflicts WHERE organization_id = $1 AND status = 'open') AS open_conflicts,
         (SELECT COUNT(*)::int FROM erp_sod_conflicts c JOIN erp_sod_rules r ON r.id = c.rule_id
           WHERE c.organization_id = $1 AND c.status = 'open' AND r.severity = 'critical') AS critical_conflicts,
         (SELECT COUNT(*)::int FROM erp_sod_conflicts WHERE organization_id = $1 AND status = 'mitigated') AS mitigated_conflicts,
         (SELECT COUNT(*)::int FROM erp_sod_conflicts WHERE organization_id = $1 AND status = 'accepted' AND accepted_until < CURRENT_DATE) AS expired_acceptances,
         (SELECT COUNT(*)::int FROM erp_access_reviews WHERE organization_id = $1 AND status = 'active') AS active_reviews,
         (SELECT COUNT(*)::int FROM erp_access_review_items WHERE organization_id = $1 AND decision = 'revoke' AND revocation_verified_at IS NULL) AS unverified_revocations,
         (SELECT COUNT(*)::int FROM erp_emergency_sessions WHERE organization_id = $1 AND review_status = 'pending') AS pending_emergency_reviews`,
      [orgId]
    );
    res.json({ success: true, data });
  } catch (error) {
    return failed(res, error, 'erp.summary_failed');
  }
});

// ---------------------------------------------------------------- systems

router.get('/systems', canRead, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*,
              (SELECT COUNT(*)::int FROM erp_users u WHERE u.system_id = s.id AND u.is_present AND u.status = 'active') AS active_users,
              (SELECT COUNT(*)::int FROM erp_roles r WHERE r.system_id = s.id AND r.is_present) AS roles,
              (SELECT COUNT(*)::int FROM erp_sod_conflicts c WHERE c.system_id = s.id AND c.status = 'open') AS open_conflicts
         FROM erp_systems s WHERE s.organization_id = $1 ORDER BY s.name`,
      [req.user.organization_id]
    );
    res.json({ success: true, data: rows.map(syncService.redact) });
  } catch (error) {
    return failed(res, error, 'erp.systems_list_failed');
  }
});

router.post('/systems', canManage, async (req, res) => {
  try {
    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '';
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    if (!ERP_TYPES.includes(body.erp_type)) return res.status(400).json({ success: false, error: `erp_type must be one of: ${ERP_TYPES.join(', ')}` });
    const environment = body.environment === 'non_production' ? 'non_production' : 'production';
    const { rows: [system] } = await pool.query(
      `INSERT INTO erp_systems (organization_id, name, erp_type, environment, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.organization_id, name, body.erp_type, environment, typeof body.description === 'string' ? body.description.slice(0, 2000) : null, req.user.id]
    );
    await auditService.logFromRequest(req, { eventType: 'erp_system.created', resourceType: 'erp_system', resourceId: system.id, details: { name, erp_type: body.erp_type } });
    res.status(201).json({ success: true, data: syncService.redact(system) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, error: 'A system with that name already exists' });
    return failed(res, error, 'erp.system_create_failed');
  }
});

router.patch('/systems/:id', canManage, uuidParams('id'), async (req, res) => {
  try {
    const body = req.body || {};
    const updates = {};
    if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim().slice(0, 200);
    if (body.erp_type !== undefined) {
      if (!ERP_TYPES.includes(body.erp_type)) return res.status(400).json({ success: false, error: 'Invalid erp_type' });
      updates.erp_type = body.erp_type;
    }
    if (body.environment !== undefined) updates.environment = body.environment === 'non_production' ? 'non_production' : 'production';
    if (body.description !== undefined) updates.description = body.description ? String(body.description).slice(0, 2000) : null;
    const keys = Object.keys(updates);
    if (!keys.length) return res.status(400).json({ success: false, error: 'No changes supplied' });
    const { rows: [system] } = await pool.query(
      `UPDATE erp_systems SET ${keys.map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_at = NOW()
        WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [req.params.id, req.user.organization_id, ...keys.map((k) => updates[k])]
    );
    if (!system) return res.status(404).json({ success: false, error: 'ERP system not found' });
    await auditService.logFromRequest(req, { eventType: 'erp_system.updated', resourceType: 'erp_system', resourceId: system.id, details: { fields: keys } });
    res.json({ success: true, data: syncService.redact(system) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, error: 'A system with that name already exists' });
    return failed(res, error, 'erp.system_update_failed');
  }
});

router.delete('/systems/:id', canManage, uuidParams('id'), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM erp_systems WHERE id = $1 AND organization_id = $2 RETURNING name', [req.params.id, req.user.organization_id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'ERP system not found' });
    await auditService.logFromRequest(req, { eventType: 'erp_system.deleted', resourceType: 'erp_system', resourceId: req.params.id, details: { name: rows[0].name } });
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    return failed(res, error, 'erp.system_delete_failed');
  }
});

// ---------------------------------------------------------------- imports

router.post('/systems/:id/import', canManage, uuidParams('id'), async (req, res) => {
  try {
    const { kind, csv, mode } = req.body || {};
    if (typeof csv !== 'string' || !csv.trim()) return res.status(400).json({ success: false, error: 'csv text is required' });
    if (Buffer.byteLength(csv) > MAX_CSV_BYTES) return res.status(413).json({ success: false, error: 'CSV exceeds 25 MB' });
    const run = await importService.runImport({ organizationId: req.user.organization_id, userId: req.user.id, systemId: req.params.id, kind, csv, mode: mode || 'merge' });
    await auditService.logFromRequest(req, { eventType: 'erp.imported', resourceType: 'erp_system', resourceId: req.params.id, details: { kind, mode: run.mode, rows: run.row_count, rejected: run.error_count } });
    res.json({ success: true, data: run });
  } catch (error) {
    return failed(res, error, 'erp.import_failed');
  }
});

router.get('/systems/:id/imports', canRead, uuidParams('id'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.kind, r.mode, r.row_count, r.error_count, r.created_at,
              TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS imported_by
         FROM erp_import_runs r LEFT JOIN users u ON u.id = r.created_by
        WHERE r.system_id = $1 AND r.organization_id = $2 ORDER BY r.created_at DESC LIMIT 50`,
      [req.params.id, req.user.organization_id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    return failed(res, error, 'erp.imports_list_failed');
  }
});

router.get('/systems/:id/users', canRead, uuidParams('id'), async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const params = [req.params.id, req.user.organization_id];
    let search = '';
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      params.push(`%${req.query.search.trim().slice(0, 100).replace(/[%_\\]/g, '\\$&')}%`);
      search = `AND (u.username ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR u.department ILIKE $${params.length})`;
    }
    params.push(limit, offset);
    const { rows } = await pool.query(
      `WITH page AS (
         SELECT u.*, COALESCE(c.open_conflicts, 0) AS open_conflicts, COUNT(*) OVER () AS total_count
           FROM erp_users u
           LEFT JOIN (
             SELECT user_id, COUNT(*)::int AS open_conflicts FROM erp_sod_conflicts
              WHERE system_id = $1 AND organization_id = $2 AND level = 'user' AND status = 'open'
              GROUP BY user_id
           ) c ON c.user_id = u.id
          WHERE u.system_id = $1 AND u.organization_id = $2 ${search}
          ORDER BY open_conflicts DESC, u.username
          LIMIT $${params.length - 1} OFFSET $${params.length}
       )
       SELECT p.id, p.username, p.full_name, p.email, p.department, p.manager, p.status, p.last_login_at, p.is_present,
              p.open_conflicts, p.total_count,
              (SELECT COUNT(*)::int FROM erp_user_roles ur WHERE ur.user_id = p.id) AS role_count
         FROM page p ORDER BY p.open_conflicts DESC, p.username`,
      params
    );
    res.json({ success: true, data: rows.map(({ total_count, ...r }) => r), pagination: { total: rows.length ? Number(rows[0].total_count) : 0, limit, offset } });
  } catch (error) {
    return failed(res, error, 'erp.users_list_failed');
  }
});

router.get('/systems/:id/users/:userId', canRead, uuidParams('id', 'userId'), async (req, res) => {
  try {
    const { rows: [user] } = await pool.query('SELECT * FROM erp_users WHERE id = $1 AND system_id = $2 AND organization_id = $3', [req.params.userId, req.params.id, req.user.organization_id]);
    if (!user) return res.status(404).json({ success: false, error: 'ERP user not found' });
    const { rows: roles } = await pool.query(
      `WITH role_functions AS (${roleFunctionsSql('$2')})
       SELECT r.role_name, r.is_privileged, ur.granted_at, ur.expires_at,
              ARRAY(SELECT DISTINCT rf.function_code FROM role_functions rf WHERE rf.role_id = r.id ORDER BY 1) AS functions
         FROM erp_user_roles ur JOIN erp_roles r ON r.id = ur.role_id
        WHERE ur.user_id = $1 ORDER BY r.role_name`,
      [user.id, req.params.id]
    );
    const conflicts = await sod.listConflicts(req.user.organization_id, { systemId: req.params.id, status: null, limit: 500 });
    res.json({ success: true, data: { ...user, roles, conflicts: conflicts.rows.filter((c) => c.user_id === user.id) } });
  } catch (error) {
    return failed(res, error, 'erp.user_get_failed');
  }
});

router.post('/systems/:id/analyze', canManage, uuidParams('id'), async (req, res) => {
  try {
    const result = await sod.runAnalysis(req.user.organization_id, req.params.id);
    await auditService.logFromRequest(req, { eventType: 'erp.sod_analyzed', resourceType: 'erp_system', resourceId: req.params.id, details: result });
    res.json({ success: true, data: result });
  } catch (error) {
    return failed(res, error, 'erp.analysis_failed');
  }
});

// ---------------------------------------------------------------- connectors and schedules

router.get('/connectors', canRead, (_req, res) => {
  res.json({ success: true, data: { connectors: syncService.listTemplates(), schedules: syncService.SCHEDULES } });
});

router.put('/systems/:id/connector', canManage, uuidParams('id'), async (req, res) => {
  try {
    const body = req.body || {};
    const system = await syncService.configureConnector(req.user.organization_id, req.params.id, { connector_type: body.connector_type, settings: body.settings });
    // Setting names only: values, and credentials above all, are never logged.
    await auditService.logFromRequest(req, {
      eventType: 'erp_system.connector_configured', resourceType: 'erp_system', resourceId: req.params.id,
      details: { connector_type: system.connector_type, settings: Object.keys(system.connector_config || {}), credentials: system.connector_credentials_set }
    });
    res.json({ success: true, data: system });
  } catch (error) {
    return failed(res, error, 'erp.connector_configure_failed');
  }
});

router.put('/systems/:id/schedule', canManage, uuidParams('id'), async (req, res) => {
  try {
    const body = req.body || {};
    if (body.ticket_connector_id && !isUuid(body.ticket_connector_id)) return res.status(400).json({ success: false, error: 'Invalid ticket_connector_id' });
    const system = await syncService.configureSchedule(req.user.organization_id, req.params.id, body);
    await auditService.logFromRequest(req, {
      eventType: 'erp_system.schedule_updated', resourceType: 'erp_system', resourceId: req.params.id,
      details: { sync_schedule: system.sync_schedule, sync_hour_utc: system.sync_hour_utc, auto_analyze: system.auto_analyze, auto_monitor: system.auto_monitor, use_library_map: system.use_library_map, ticket_connector_id: system.ticket_connector_id }
    });
    res.json({ success: true, data: system });
  } catch (error) {
    return failed(res, error, 'erp.schedule_update_failed');
  }
});

router.post('/systems/:id/sync', canManage, uuidParams('id'), async (req, res) => {
  try {
    const run = await syncService.runSync(req.user.organization_id, req.params.id, { userId: req.user.id, trigger: 'manual' });
    if (run.busy) return res.status(409).json({ success: false, error: 'A run for this system is already in progress' });
    await auditService.logFromRequest(req, {
      eventType: 'erp.synced', resourceType: 'erp_system', resourceId: req.params.id,
      details: { run_id: run.id, status: run.status, summary: run.summary }, success: run.status === 'success'
    });
    res.status(run.status === 'success' ? 200 : 502).json(run.status === 'success'
      ? { success: true, data: run }
      : { success: false, error: run.error || 'The run failed', data: run });
  } catch (error) {
    return failed(res, error, 'erp.sync_failed');
  }
});

router.get('/systems/:id/sync-runs', canRead, uuidParams('id'), async (req, res) => {
  try {
    res.json({ success: true, data: await syncService.listRuns(req.user.organization_id, req.params.id) });
  } catch (error) {
    return failed(res, error, 'erp.sync_runs_failed');
  }
});

router.get('/permission-library', canRead, async (req, res) => {
  try {
    const platform = ['sap', 'oracle_ebs'].includes(req.query.platform) ? req.query.platform : null;
    const { rows } = await pool.query(
      `SELECT pl.platform, pl.permission, pl.function_code, f.name AS function_name
         FROM erp_permission_library pl
         LEFT JOIN erp_functions f ON f.code = pl.function_code AND f.organization_id IS NULL
        WHERE ($1::text IS NULL OR pl.platform = $1) ORDER BY pl.platform, pl.function_code, pl.permission`,
      [platform]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    return failed(res, error, 'erp.permission_library_failed');
  }
});

router.get('/ticket-connectors', canRead, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, connector_type FROM integration_connectors
        WHERE organization_id = $1 AND connector_type = ANY($2::text[]) ORDER BY name`,
      [req.user.organization_id, tickets.TICKET_CONNECTOR_TYPES]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    return failed(res, error, 'erp.ticket_connectors_failed');
  }
});

// ---------------------------------------------------------------- SoD

router.get('/functions', canRead, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT code, name, process, description, (organization_id IS NULL) AS is_library
         FROM erp_functions WHERE organization_id IS NULL OR organization_id = $1 ORDER BY process, code`,
      [req.user.organization_id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    return failed(res, error, 'erp.functions_list_failed');
  }
});

router.get('/sod/rules', canRead, async (req, res) => {
  try {
    res.json({ success: true, data: await sod.listRules(req.user.organization_id) });
  } catch (error) {
    return failed(res, error, 'erp.rules_list_failed');
  }
});

router.post('/sod/rules', canManage, async (req, res) => {
  try {
    const rule = await sod.createRule(req.user.organization_id, req.user.id, req.body || {});
    await auditService.logFromRequest(req, { eventType: 'erp.sod_rule_created', resourceType: 'erp_sod_rule', resourceId: rule.id, details: { code: rule.code } });
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    return failed(res, error, 'erp.rule_create_failed');
  }
});

router.patch('/sod/rules/:id', canManage, uuidParams('id'), async (req, res) => {
  try {
    const rule = await sod.updateRule(req.user.organization_id, req.user.id, req.params.id, req.body || {});
    await auditService.logFromRequest(req, { eventType: 'erp.sod_rule_updated', resourceType: 'erp_sod_rule', resourceId: req.params.id, details: { fields: Object.keys(req.body || {}) } });
    res.json({ success: true, data: rule });
  } catch (error) {
    return failed(res, error, 'erp.rule_update_failed');
  }
});

router.get('/sod/conflicts', canRead, async (req, res) => {
  try {
    const q = req.query;
    const limit = Math.min(500, Math.max(1, parseInt(q.limit, 10) || 100));
    const offset = Math.max(0, parseInt(q.offset, 10) || 0);
    const result = await sod.listConflicts(req.user.organization_id, {
      systemId: isUuid(q.system_id) ? q.system_id : null,
      status: ['open', 'mitigated', 'accepted', 'resolved'].includes(q.status) ? q.status : null,
      severity: ['low', 'medium', 'high', 'critical'].includes(q.severity) ? q.severity : null,
      level: ['user', 'role'].includes(q.level) ? q.level : null,
      process: typeof q.process === 'string' && /^[a-z_]{1,40}$/.test(q.process) ? q.process : null,
      limit,
      offset
    });
    res.json({ success: true, data: result.rows, pagination: { total: result.total, limit, offset } });
  } catch (error) {
    return failed(res, error, 'erp.conflicts_list_failed');
  }
});

router.patch('/sod/conflicts/:id', canManage, uuidParams('id'), async (req, res) => {
  try {
    const body = req.body || {};
    if (body.mitigating_control_id && !isUuid(body.mitigating_control_id)) return res.status(400).json({ success: false, error: 'Invalid mitigating_control_id' });
    const conflict = await sod.decideConflict(req.user.organization_id, req.user.id, req.params.id, body);
    await auditService.logFromRequest(req, { eventType: `erp.sod_conflict_${body.action}`, resourceType: 'erp_sod_conflict', resourceId: conflict.id, details: { status: conflict.status, mitigating_control_id: conflict.mitigating_control_id } });
    res.json({ success: true, data: conflict });
  } catch (error) {
    return failed(res, error, 'erp.conflict_update_failed');
  }
});

router.get('/mitigating-controls', canRead, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*, r.control_ref, TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS owner_name,
              (SELECT COUNT(*)::int FROM erp_sod_conflicts c WHERE c.mitigating_control_id = m.id AND c.status = 'mitigated') AS conflicts_covered
         FROM erp_mitigating_controls m
         LEFT JOIN rcm_entries r ON r.id = m.rcm_entry_id AND r.organization_id = m.organization_id
         LEFT JOIN users u ON u.id = m.owner_user_id
        WHERE m.organization_id = $1 ORDER BY m.name`,
      [req.user.organization_id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    return failed(res, error, 'erp.mitigations_list_failed');
  }
});

router.post('/mitigating-controls', canManage, async (req, res) => {
  try {
    const body = req.body || {};
    const orgId = req.user.organization_id;
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '';
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 4000) : '';
    if (!name || !description) return res.status(400).json({ success: false, error: 'name and description are required' });
    const frequency = body.frequency || 'monthly';
    if (!['annual', 'quarterly', 'monthly', 'weekly', 'daily', 'recurring', 'as_needed'].includes(frequency)) return res.status(400).json({ success: false, error: 'Invalid frequency' });
    for (const [field, table] of [['owner_user_id', 'users'], ['rcm_entry_id', 'rcm_entries']]) {
      if (!body[field]) continue;
      if (!isUuid(body[field])) return res.status(400).json({ success: false, error: `Invalid ${field}` });
      const { rows } = await pool.query(`SELECT 1 FROM ${table} WHERE id = $1 AND organization_id = $2`, [body[field], orgId]);
      if (!rows.length) return res.status(400).json({ success: false, error: `${field} not found in this organization` });
    }
    const { rows: [control] } = await pool.query(
      `INSERT INTO erp_mitigating_controls (organization_id, name, description, frequency, owner_user_id, rcm_entry_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [orgId, name, description, frequency, body.owner_user_id || null, body.rcm_entry_id || null, req.user.id]
    );
    await auditService.logFromRequest(req, { eventType: 'erp.mitigating_control_created', resourceType: 'erp_mitigating_control', resourceId: control.id, details: { name } });
    res.status(201).json({ success: true, data: control });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, error: 'A mitigating control with that name already exists' });
    return failed(res, error, 'erp.mitigation_create_failed');
  }
});

// ---------------------------------------------------------------- reviews

router.get('/reviews', canRead, async (req, res) => {
  try {
    res.json({ success: true, data: await reviews.listReviews(req.user.organization_id) });
  } catch (error) {
    return failed(res, error, 'erp.reviews_list_failed');
  }
});

router.post('/reviews', canManage, async (req, res) => {
  try {
    const body = req.body || {};
    if (!isUuid(body.system_id)) return res.status(400).json({ success: false, error: 'system_id is required' });
    if (body.reviewer_id && !isUuid(body.reviewer_id)) return res.status(400).json({ success: false, error: 'Invalid reviewer_id' });
    const review = await reviews.createReview(req.user.organization_id, req.user.id, body);
    await auditService.logFromRequest(req, { eventType: 'erp.access_review_started', resourceType: 'erp_access_review', resourceId: review.id, details: { system_id: body.system_id, items: review.item_count } });
    res.status(201).json({ success: true, data: review });
  } catch (error) {
    return failed(res, error, 'erp.review_create_failed');
  }
});

router.get('/reviews/:id', canRead, uuidParams('id'), async (req, res) => {
  try {
    const decision = ['pending', 'certified', 'revoke'].includes(req.query.decision) ? req.query.decision : null;
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const reviewerId = req.query.mine === 'true' ? req.user.id : null;
    const review = await reviews.getReview(req.user.organization_id, req.params.id, { decision, reviewerId, limit, offset });
    if (!review) return res.status(404).json({ success: false, error: 'Review not found' });
    res.json({ success: true, data: review });
  } catch (error) {
    return failed(res, error, 'erp.review_get_failed');
  }
});

router.patch('/reviews/:id/items/:itemId', canRead, uuidParams('id', 'itemId'), async (req, res) => {
  try {
    const item = await reviews.decideItem(req.user.organization_id, req.user, req.params.id, req.params.itemId, req.body || {}, { canManage: hasPermission(req, 'erp.manage') });
    await auditService.logFromRequest(req, { eventType: 'erp.access_review_decision', resourceType: 'erp_access_review_item', resourceId: item.id, details: { username: item.username, decision: item.decision, roles_to_revoke: item.roles_to_revoke } });
    res.json({ success: true, data: item });
  } catch (error) {
    return failed(res, error, 'erp.review_decision_failed');
  }
});

router.post('/reviews/:id/complete', canManage, uuidParams('id'), async (req, res) => {
  try {
    const review = await reviews.completeReview(req.user.organization_id, req.user.id, req.params.id);
    // The review is closed whatever happens to the tickets; failures are
    // recorded on the items and can be retried from POST /reviews/:id/tickets.
    const ticketResult = review.counts.revoked ? await tickets.createForReview(req.user.organization_id, review.id).catch((error) => {
      log('warn', 'erp.review_tickets_failed', { reviewId: review.id, error: serializeError(error) });
      return { created: 0, failed: review.counts.revoked, reason: 'Ticket creation failed' };
    }) : null;
    await auditService.logFromRequest(req, { eventType: 'erp.access_review_completed', resourceType: 'erp_access_review', resourceId: review.id, details: { ...review.counts, evidence_id: review.evidence_id, tickets: ticketResult } });
    res.json({ success: true, data: { ...review, tickets: ticketResult } });
  } catch (error) {
    return failed(res, error, 'erp.review_complete_failed');
  }
});

router.post('/reviews/:id/tickets', canManage, uuidParams('id'), async (req, res) => {
  try {
    const result = await tickets.createForReview(req.user.organization_id, req.params.id);
    if (!result) return res.status(404).json({ success: false, error: 'Review not found' });
    await auditService.logFromRequest(req, { eventType: 'erp.revocation_tickets_created', resourceType: 'erp_access_review', resourceId: req.params.id, details: result });
    res.json({ success: true, data: result });
  } catch (error) {
    return failed(res, error, 'erp.review_tickets_failed');
  }
});

router.get('/reviews/:id/export', canRead, uuidParams('id'), async (req, res) => {
  try {
    const csv = await reviews.exportReview(req.user.organization_id, req.params.id);
    if (csv === null) return res.status(404).json({ success: false, error: 'Review not found' });
    await auditService.logFromRequest(req, { eventType: 'erp.access_review_exported', resourceType: 'erp_access_review', resourceId: req.params.id, details: {} });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="erp-access-review.csv"');
    res.send(csv);
  } catch (error) {
    return failed(res, error, 'erp.review_export_failed');
  }
});

// ---------------------------------------------------------------- emergency access

router.get('/emergency-sessions', canRead, async (req, res) => {
  try {
    const data = await reviews.listEmergencySessions(req.user.organization_id, {
      status: ['pending', 'approved', 'escalated'].includes(req.query.status) ? req.query.status : null,
      systemId: isUuid(req.query.system_id) ? req.query.system_id : null
    });
    res.json({ success: true, data });
  } catch (error) {
    return failed(res, error, 'erp.emergency_list_failed');
  }
});

router.patch('/emergency-sessions/:id', canManage, uuidParams('id'), async (req, res) => {
  try {
    const session = await reviews.reviewEmergencySession(req.user.organization_id, req.user.id, req.params.id, req.body || {});
    await auditService.logFromRequest(req, { eventType: 'erp.emergency_session_reviewed', resourceType: 'erp_emergency_session', resourceId: session.id, details: { review_status: session.review_status, username: session.username } });
    res.json({ success: true, data: session });
  } catch (error) {
    return failed(res, error, 'erp.emergency_review_failed');
  }
});

module.exports = router;
