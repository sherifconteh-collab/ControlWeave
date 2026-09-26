'use strict';

/**
 * Direct ERP connectors and scheduled runs.
 *
 * A system can have one connector (Workday RaaS, SCIM 2.0 or the Oracle
 * E-Business Suite database). A sync pulls a full snapshot of users, role
 * assignments and, where the connector provides them, role permissions, and
 * loads them in one transaction in replace mode, so a user or assignment that
 * disappeared from the ERP disappears here and pending revocations are
 * verified. After a sync, or on a schedule without a connector, the system
 * can run SoD analysis, the monitoring rules and a revocation-ticket status
 * refresh.
 *
 * Credentials are encrypted per value (utils/encrypt) and never returned.
 * One run per system at a time (advisory lock).
 */

const pool = require('../../config/database');
const { encrypt, decrypt, isEncrypted } = require('../../utils/encrypt');
const { validateUrlSettings } = require('../connectors');
const importService = require('./importService');
const sod = require('./sodService');
const ccm = require('./ccmService');
const tickets = require('./ticketService');
const { log, serializeError } = require('../../utils/logger');

const MASK = '********';

const TEMPLATES = Object.freeze({
  workday_raas: {
    label: 'Workday (Report-as-a-Service)',
    required: ['usersReportUrl', 'username', 'password'],
    optional: ['assignmentsReportUrl', 'permissionsReportUrl', 'allowEmptyAssignments'],
    secrets: ['password'],
    load: () => require('./connectors/workdayRaas')
  },
  scim: {
    label: 'SCIM 2.0 (Oracle Fusion Cloud ERP, SAP Cloud Identity Services)',
    required: ['baseUrl'],
    optional: ['token', 'username', 'password', 'allowEmptyAssignments'],
    secrets: ['token', 'password'],
    load: () => require('./connectors/scim')
  },
  oracle_ebs_db: {
    label: 'Oracle E-Business Suite (database, read-only)',
    required: ['host', 'serviceName', 'username', 'password'],
    optional: ['port', 'schema', 'allowEmptyAssignments'],
    secrets: ['password'],
    load: () => require('./connectors/oracleEbs')
  }
});

const SCHEDULES = ['manual', 'daily', 'weekly'];

class SyncError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function listTemplates() {
  return Object.entries(TEMPLATES).map(([type, t]) => ({ type, label: t.label, required: t.required, optional: t.optional, secrets: t.secrets }));
}

/** Next scheduled run: the configured UTC hour, today or later (weekly: at least six days out). */
function nextRunAt(schedule, hourUtc, from = new Date()) {
  if (schedule === 'manual') return null;
  const base = new Date(from.getTime() + (schedule === 'weekly' ? 6 * 86400000 : 0));
  const next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hourUtc, 0, 0));
  if (next <= base) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

/** System row as returned by the API: connector credentials replaced by flags. */
function redact(system) {
  if (!system) return system;
  const { connector_auth: auth, ...rest } = system;
  return {
    ...rest,
    connector_auth: Object.fromEntries(Object.keys(auth || {}).map((key) => [key, MASK])),
    connector_credentials_set: Object.keys(auth || {}),
    connector_label: system.connector_type && TEMPLATES[system.connector_type] ? TEMPLATES[system.connector_type].label : null
  };
}

/**
 * Save the connector for a system. `settings` holds every value; secrets are
 * encrypted and kept when submitted blank or masked. Passing
 * connector_type null removes the connector.
 */
async function configureConnector(organizationId, systemId, input) {
  const { rows: [system] } = await pool.query('SELECT * FROM erp_systems WHERE id = $1 AND organization_id = $2', [systemId, organizationId]);
  if (!system) throw new SyncError(404, 'ERP system not found');
  if (input.connector_type === null || input.connector_type === '') {
    const { rows: [updated] } = await pool.query(
      `UPDATE erp_systems SET connector_type = NULL, connector_config = '{}'::jsonb, connector_auth = '{}'::jsonb, updated_at = NOW()
        WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [systemId, organizationId]
    );
    return redact(updated);
  }
  const template = TEMPLATES[input.connector_type];
  if (!template) throw new SyncError(400, `connector_type must be one of: ${Object.keys(TEMPLATES).join(', ')}`);
  // Secrets saved for the same connector type are kept unless replaced.
  const auth = system.connector_type === input.connector_type ? { ...(system.connector_auth || {}) } : {};
  const settings = {};
  const allowed = new Set([...template.required, ...template.optional]);
  for (const [key, raw] of Object.entries(input.settings || {})) {
    if (!allowed.has(key)) continue;
    const value = raw === null || raw === undefined ? '' : String(raw).trim();
    if (template.secrets.includes(key)) {
      if (value && value !== MASK) auth[key] = encrypt(value);
    } else if (value) {
      settings[key] = value.slice(0, 2000);
    }
  }
  const missing = template.required.filter((key) => !settings[key] && !auth[key]);
  if (missing.length) throw new SyncError(400, `Missing settings: ${missing.join(', ')}`);
  if (input.connector_type === 'scim' && !auth.token && !(settings.username && auth.password)) {
    throw new SyncError(400, 'Set a bearer token, or a username and password');
  }
  const urlError = await validateUrlSettings(settings);
  if (urlError) throw new SyncError(400, urlError);
  const { rows: [updated] } = await pool.query(
    `UPDATE erp_systems SET connector_type = $3, connector_config = $4::jsonb, connector_auth = $5::jsonb, updated_at = NOW()
      WHERE id = $1 AND organization_id = $2 RETURNING *`,
    [systemId, organizationId, input.connector_type, JSON.stringify(settings), JSON.stringify(auth)]
  );
  return redact(updated);
}

async function configureSchedule(organizationId, systemId, input) {
  const schedule = input.sync_schedule;
  if (schedule !== undefined && !SCHEDULES.includes(schedule)) throw new SyncError(400, `sync_schedule must be one of: ${SCHEDULES.join(', ')}`);
  if (input.sync_hour_utc !== undefined && !(Number.isInteger(input.sync_hour_utc) && input.sync_hour_utc >= 0 && input.sync_hour_utc <= 23)) {
    throw new SyncError(400, 'sync_hour_utc must be an hour from 0 to 23');
  }
  if (input.ticket_connector_id) {
    const { rows } = await pool.query(
      "SELECT 1 FROM integration_connectors WHERE id = $1 AND organization_id = $2 AND connector_type = ANY($3::text[])",
      [input.ticket_connector_id, organizationId, tickets.TICKET_CONNECTOR_TYPES]
    );
    if (!rows.length) throw new SyncError(400, 'Ticketing connector not found; add a Jira or ITSM connector under Integrations first');
  }
  const { rows: [current] } = await pool.query('SELECT * FROM erp_systems WHERE id = $1 AND organization_id = $2', [systemId, organizationId]);
  if (!current) throw new SyncError(404, 'ERP system not found');
  const merged = {
    sync_schedule: schedule !== undefined ? schedule : current.sync_schedule,
    sync_hour_utc: input.sync_hour_utc !== undefined ? input.sync_hour_utc : current.sync_hour_utc,
    auto_analyze: typeof input.auto_analyze === 'boolean' ? input.auto_analyze : current.auto_analyze,
    auto_monitor: typeof input.auto_monitor === 'boolean' ? input.auto_monitor : current.auto_monitor,
    use_library_map: typeof input.use_library_map === 'boolean' ? input.use_library_map : current.use_library_map,
    ticket_connector_id: input.ticket_connector_id !== undefined ? (input.ticket_connector_id || null) : current.ticket_connector_id
  };
  const { rows: [updated] } = await pool.query(
    `UPDATE erp_systems
        SET sync_schedule = $3, sync_hour_utc = $4, auto_analyze = $5, auto_monitor = $6, use_library_map = $7,
            ticket_connector_id = $8, next_sync_at = $9, updated_at = NOW()
      WHERE id = $1 AND organization_id = $2 RETURNING *`,
    [systemId, organizationId, merged.sync_schedule, merged.sync_hour_utc, merged.auto_analyze, merged.auto_monitor,
      merged.use_library_map, merged.ticket_connector_id, nextRunAt(merged.sync_schedule, merged.sync_hour_utc)]
  );
  return redact(updated);
}

function runtimeConfig(system) {
  const auth = Object.fromEntries(Object.entries(system.connector_auth || {}).map(([k, v]) => [k, isEncrypted(v) ? decrypt(v) : v]));
  return { ...(system.connector_config || {}), ...auth };
}

// Connector rows carry dates in whatever format the source uses; one that
// does not parse is dropped rather than failing a full-snapshot import.
const DATE_FIELDS = ['last_login_at', 'end_date', 'granted_at', 'expires_at'];
function cleanDates(rows) {
  return rows.map((row) => {
    const out = { ...row };
    for (const field of DATE_FIELDS) {
      if (out[field] && Number.isNaN(new Date(out[field]).getTime())) out[field] = '';
    }
    return out;
  });
}

/** Load a connector extract as full snapshots, in one transaction. */
async function loadExtract(organizationId, userId, system, extract) {
  const client = await pool.connect();
  const loaded = {};
  const analyzeTables = new Set();
  try {
    await client.query('BEGIN');
    for (const kind of ['users', 'assignments', 'role_permissions']) {
      const rows = extract[kind];
      if (!Array.isArray(rows)) continue;
      if (!rows.length && kind !== 'assignments') continue;
      if (!rows.length) {
        // An empty assignment list is a real snapshot: nobody holds a role.
        await client.query('DELETE FROM erp_user_roles WHERE system_id = $1 AND organization_id = $2', [system.id, organizationId]);
        loaded[kind] = 0;
        continue;
      }
      const run = await importService.runImport({
        organizationId, userId, systemId: system.id, kind, rows: cleanDates(rows), mode: 'replace',
        source: system.connector_type, client
      });
      loaded[kind] = run.row_count;
      if (run.revocations_verified) loaded.revocations_verified = (loaded.revocations_verified || 0) + run.revocations_verified;
      run.analyze_tables.forEach((t) => analyzeTables.add(t));
    }
    await client.query('COMMIT');
    for (const table of analyzeTables) await client.query(`ANALYZE ${table}`);
    return loaded;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function transactionAndConfigCount(organizationId, systemId) {
  const { rows: [r] } = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM erp_transactions WHERE system_id = $1 AND organization_id = $2)
          + (SELECT COUNT(*)::int FROM erp_config_items WHERE system_id = $1 AND organization_id = $2) AS n`,
    [systemId, organizationId]
  );
  return r.n;
}

/**
 * A sync replaces the system's users and assignments with the extract, marks
 * everything missing as removed and verifies pending revocations against it.
 * Loading a partial extract would do all of that wrongly and file false
 * evidence, so refuse anything the connector cannot vouch for as complete:
 * truncated or short paging, no users, or users with no role assignments at
 * all (almost always a report or connector missing its role data). The last
 * case can be allowed per system with allowEmptyAssignments=true.
 * TEVV-SEC-9 checks that this runs.
 */
function assertCompleteExtract(extract, config = {}) {
  const fail = (reason) => {
    const error = new Error(`${reason}; nothing was changed`);
    error.status = 422;
    throw error;
  };
  if (!extract || extract.complete !== true) fail(`The connector returned an incomplete extract (${(extract && extract.incompleteReason) || 'completeness not reported'})`);
  if (!Array.isArray(extract.users) || !extract.users.length) fail('The connector returned no users');
  const allowEmpty = String(config.allowEmptyAssignments || '').toLowerCase() === 'true';
  if (!allowEmpty && (!Array.isArray(extract.assignments) || !extract.assignments.length)) {
    fail(`The connector returned ${extract.users.length} user(s) but no role assignments. Check that the source includes role data, or set allowEmptyAssignments=true if the system really has none`);
  }
}

/** Fills `summary` as it goes, so a refused or failed run still records what was extracted. */
async function executeRun(system, userId, summary) {
  if (system.connector_type) {
    const config = runtimeConfig(system);
    const extract = await TEMPLATES[system.connector_type].load().fetchExtract(config);
    summary.extracted = Object.fromEntries(Object.entries(extract).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length]));
    assertCompleteExtract(extract, config);
    summary.loaded = await loadExtract(system.organization_id, userId, system, extract);
  }
  if (system.auto_analyze) summary.analysis = await sod.runAnalysis(system.organization_id, system.id);
  if (system.auto_monitor && await transactionAndConfigCount(system.organization_id, system.id)) {
    const monitoring = await ccm.runRules(system.organization_id, userId, system.id);
    summary.monitoring = {
      run_id: monitoring.run_id,
      detected: monitoring.results.reduce((n, r) => n + r.detected, 0),
      new_exceptions: monitoring.results.reduce((n, r) => n + r.new_exceptions, 0)
    };
  }
  if (system.ticket_connector_id) summary.tickets_refreshed = await tickets.refreshStatuses(system.organization_id, system.id);
  return summary;
}

/**
 * Run a sync (or, without a connector, the scheduled analysis and
 * monitoring) for one system. Returns the erp_sync_runs row; a concurrent run
 * for the same system returns { busy: true }.
 */
async function runSync(organizationId, systemId, { userId = null, trigger = 'manual' } = {}) {
  const { rows: [system] } = await pool.query('SELECT * FROM erp_systems WHERE id = $1 AND organization_id = $2', [systemId, organizationId]);
  if (!system) throw new SyncError(404, 'ERP system not found');
  if (trigger === 'manual' && !system.connector_type && !system.auto_analyze && !system.auto_monitor) {
    throw new SyncError(409, 'Set up a connector, or switch on analysis or monitoring, before running');
  }
  const lockClient = await pool.connect();
  try {
    const { rows: [lock] } = await lockClient.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [`erp-sync:${systemId}`]);
    if (!lock.ok) return { busy: true };
    const { rows: [run] } = await pool.query(
      'INSERT INTO erp_sync_runs (organization_id, system_id, trigger, started_by) VALUES ($1, $2, $3, $4) RETURNING id',
      [organizationId, systemId, trigger, userId]
    );
    let status = 'success';
    const summary = {};
    let errorText = null;
    try {
      await executeRun(system, userId, summary);
    } catch (error) {
      status = 'failed';
      // Connector and import errors are written for the user (HTTP errors
      // never carry response bodies); database errors are not shown.
      errorText = error.severity ? 'The run failed; see the server log for details' : String(error.message || 'The run failed').slice(0, 500);
      log('warn', 'erp.sync_failed', { systemId, trigger, error: serializeError(error) });
    }
    const { rows: [finished] } = await pool.query(
      `UPDATE erp_sync_runs SET status = $2, summary = $3::jsonb, error = $4, finished_at = NOW() WHERE id = $1 RETURNING *`,
      [run.id, status, JSON.stringify(summary), errorText]
    );
    await pool.query(
      `UPDATE erp_systems SET last_sync_at = NOW(), last_sync_status = $3, last_sync_error = $4,
              next_sync_at = CASE WHEN sync_schedule = 'manual' THEN NULL ELSE $5::timestamptz END
        WHERE id = $1 AND organization_id = $2`,
      [systemId, organizationId, status, errorText, nextRunAt(system.sync_schedule, system.sync_hour_utc)]
    );
    return finished;
  } finally {
    await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [`erp-sync:${systemId}`]).catch(() => {});
    lockClient.release();
  }
}

async function listRuns(organizationId, systemId) {
  const { rows } = await pool.query(
    `SELECT id, trigger, status, summary, error, started_at, finished_at FROM erp_sync_runs
      WHERE system_id = $1 AND organization_id = $2 ORDER BY started_at DESC LIMIT 50`,
    [systemId, organizationId]
  );
  return rows;
}

module.exports = {
  SyncError, TEMPLATES, SCHEDULES, MASK, listTemplates, assertCompleteExtract, nextRunAt, redact, configureConnector, configureSchedule,
  runSync, listRuns, runtimeConfig
};
