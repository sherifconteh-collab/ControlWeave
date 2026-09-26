'use strict';

/**
 * Function-level segregation of duties analysis over imported ERP entitlements.
 *
 * A role's functions come from erp_role_functions directly and from
 * erp_role_permissions through the system's permission-to-function map and
 * ControlWeave's starter map for the platform (see roleFunctions.js). A user
 * holds a function through any active, unexpired role assignment. A rule fires:
 *   - at role level when one role grants both of its functions (a design flaw
 *     that puts every holder in conflict), and
 *   - at user level when a user holds both functions through any roles.
 *
 * Each run upserts current conflicts and resolves those no longer present.
 * Mitigated and accepted conflicts keep their decision while they persist; a
 * resolved conflict that reappears is reopened.
 */

const pool = require('../../config/database');
const { roleFunctionsSql } = require('./roleFunctions');

class SodError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const ACTIVE_RULES_CTE = `
  active_rules AS (
    SELECT r.* FROM erp_sod_rules r
      LEFT JOIN erp_sod_rule_settings s ON s.rule_id = r.id AND s.organization_id = $1
     WHERE (r.organization_id IS NULL OR r.organization_id = $1)
       AND COALESCE(s.is_active, r.is_active)
  )`;

/**
 * Materialize role and user functions into indexed, analyzed temp tables.
 * Planning the conflict joins over CTEs goes badly wrong right after a large
 * import, when the base tables' statistics are stale.
 */
async function stageEntitlements(client, systemId) {
  await client.query(
    `CREATE TEMP TABLE sod_role_functions ON COMMIT DROP AS ${roleFunctionsSql('$1')}`,
    [systemId]
  );
  await client.query(
    `CREATE TEMP TABLE sod_user_functions ON COMMIT DROP AS
       SELECT ur.user_id, rf.function_code, ro.role_name
         FROM erp_user_roles ur
         JOIN erp_users u ON u.id = ur.user_id AND u.is_present AND u.status = 'active'
         JOIN erp_roles ro ON ro.id = ur.role_id
         JOIN sod_role_functions rf ON rf.role_id = ur.role_id
        WHERE ur.system_id = $1 AND (ur.expires_at IS NULL OR ur.expires_at >= CURRENT_DATE)`,
    [systemId]
  );
  await client.query('CREATE INDEX ON sod_role_functions (function_code, role_id)');
  await client.query('CREATE INDEX ON sod_user_functions (function_code, user_id)');
  await client.query('ANALYZE sod_role_functions');
  await client.query('ANALYZE sod_user_functions');
}

async function runAnalysis(organizationId, systemId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [system] } = await client.query('SELECT id FROM erp_systems WHERE id = $1 AND organization_id = $2 FOR UPDATE', [systemId, organizationId]);
    if (!system) throw new SodError(404, 'ERP system not found');
    await stageEntitlements(client, systemId);

    // Every conflict found in this run gets last_detected_at = NOW(), the
    // transaction timestamp; anything older afterwards was not found.
    const { rows: [counts] } = await client.query(
      `WITH ${ACTIVE_RULES_CTE},
       found AS (
         SELECT ar.id AS rule_id, 'role'::text AS level, NULL::uuid AS user_id, ro.id AS role_id,
                ARRAY[ro.role_name] AS roles_a, ARRAY[ro.role_name] AS roles_b
           FROM active_rules ar
           JOIN sod_role_functions fa ON fa.function_code = ar.function_a
           JOIN sod_role_functions fb ON fb.function_code = ar.function_b AND fb.role_id = fa.role_id
           JOIN erp_roles ro ON ro.id = fa.role_id AND ro.is_present
         UNION ALL
         SELECT ar.id, 'user', a.user_id, NULL::uuid,
                ARRAY_AGG(DISTINCT a.role_name ORDER BY a.role_name), ARRAY_AGG(DISTINCT b.role_name ORDER BY b.role_name)
           FROM active_rules ar
           JOIN sod_user_functions a ON a.function_code = ar.function_a
           JOIN sod_user_functions b ON b.function_code = ar.function_b AND b.user_id = a.user_id
          GROUP BY ar.id, a.user_id
       ),
       up AS (
         INSERT INTO erp_sod_conflicts (organization_id, system_id, rule_id, level, user_id, role_id, roles_a, roles_b)
         SELECT $1, $2, f.rule_id, f.level, f.user_id, f.role_id, f.roles_a, f.roles_b FROM found f
         ON CONFLICT ON CONSTRAINT erp_sod_conflicts_unique DO UPDATE
           SET roles_a = EXCLUDED.roles_a, roles_b = EXCLUDED.roles_b, last_detected_at = NOW(),
               status = CASE WHEN erp_sod_conflicts.status = 'resolved' THEN 'open' ELSE erp_sod_conflicts.status END,
               resolved_at = NULL
         RETURNING (xmax = 0) AS inserted
       )
       SELECT COUNT(*) FILTER (WHERE inserted)::int AS new_conflicts, COUNT(*)::int AS detected FROM up`,
      [organizationId, systemId]
    );

    const { rowCount: resolved } = await client.query(
      `UPDATE erp_sod_conflicts SET status = 'resolved', resolved_at = NOW()
        WHERE system_id = $1 AND organization_id = $2 AND status <> 'resolved' AND last_detected_at < NOW()`,
      [systemId, organizationId]
    );
    await client.query('UPDATE erp_systems SET last_analysis_at = NOW() WHERE id = $1', [systemId]);
    await client.query('COMMIT');
    return { detected: counts.detected, new_conflicts: counts.new_conflicts, resolved };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listConflicts(organizationId, { systemId, status, severity, level, process, limit = 100, offset = 0 }) {
  const where = ['c.organization_id = $1'];
  const params = [organizationId];
  const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };
  if (systemId) add('c.system_id = ?', systemId);
  if (status) add('c.status = ?', status); else where.push("c.status <> 'resolved'");
  if (severity) add('r.severity = ?', severity);
  if (level) add('c.level = ?', level);
  if (process) add('r.process = ?', process);
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT c.*, r.code AS rule_code, r.name AS rule_name, r.process, r.severity, r.function_a, r.function_b, r.risk_description,
            s.name AS system_name, u.username, u.full_name, u.department, ro.role_name,
            m.name AS mitigating_control_name, COUNT(*) OVER () AS total_count
       FROM erp_sod_conflicts c
       JOIN erp_sod_rules r ON r.id = c.rule_id
       JOIN erp_systems s ON s.id = c.system_id AND s.organization_id = c.organization_id
       LEFT JOIN erp_users u ON u.id = c.user_id
       LEFT JOIN erp_roles ro ON ro.id = c.role_id
       LEFT JOIN erp_mitigating_controls m ON m.id = c.mitigating_control_id AND m.organization_id = c.organization_id
      WHERE ${where.join(' AND ')}
      ORDER BY CASE r.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, c.level DESC, r.code, u.username
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { rows: rows.map(({ total_count, ...rest }) => rest), total: rows.length ? Number(rows[0].total_count) : 0 };
}

async function decideConflict(organizationId, userId, conflictId, input) {
  const action = input.action;
  const notes = typeof input.notes === 'string' ? input.notes.trim().slice(0, 4000) : '';
  if (!['mitigate', 'accept', 'reopen'].includes(action)) throw new SodError(400, 'action must be mitigate, accept or reopen');
  const { rows: [conflict] } = await pool.query('SELECT * FROM erp_sod_conflicts WHERE id = $1 AND organization_id = $2', [conflictId, organizationId]);
  if (!conflict) throw new SodError(404, 'Conflict not found');
  if (conflict.status === 'resolved') throw new SodError(409, 'The conflict is resolved; it no longer exists in the latest analysis');

  if (action === 'reopen') {
    const { rows: [row] } = await pool.query(
      `UPDATE erp_sod_conflicts SET status = 'open', mitigating_control_id = NULL, accepted_until = NULL,
              decision_notes = NULLIF($3, ''), decided_by = $4, decided_at = NOW()
        WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [conflictId, organizationId, notes, userId]
    );
    return row;
  }
  if (action === 'mitigate') {
    const { rows: [control] } = await pool.query('SELECT id FROM erp_mitigating_controls WHERE id = $1 AND organization_id = $2', [input.mitigating_control_id, organizationId]);
    if (!control) throw new SodError(400, 'A mitigating control from this organization is required');
  }
  if (action === 'accept' && !notes) throw new SodError(400, 'Record the business justification for accepting the conflict');
  const acceptedUntil = action === 'accept' && input.accepted_until ? String(input.accepted_until).slice(0, 10) : null;
  try {
    const { rows: [row] } = await pool.query(
      `UPDATE erp_sod_conflicts
          SET status = $3, mitigating_control_id = $4, accepted_until = $5::date,
              decision_notes = NULLIF($6, ''), decided_by = $7, decided_at = NOW()
        WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [conflictId, organizationId, action === 'mitigate' ? 'mitigated' : 'accepted',
        action === 'mitigate' ? input.mitigating_control_id : null, acceptedUntil, notes, userId]
    );
    return row;
  } catch (error) {
    if (error.code === '22007' || error.code === '22008') throw new SodError(400, 'Invalid accepted_until date');
    throw error;
  }
}

async function listRules(organizationId) {
  const { rows } = await pool.query(
    `SELECT r.*, (r.organization_id IS NULL) AS is_library, COALESCE(s.is_active, r.is_active) AS effective_active,
            (SELECT COUNT(*)::int FROM erp_sod_conflicts c WHERE c.rule_id = r.id AND c.organization_id = $1 AND c.status <> 'resolved') AS open_conflicts
       FROM erp_sod_rules r
       LEFT JOIN erp_sod_rule_settings s ON s.rule_id = r.id AND s.organization_id = $1
      WHERE r.organization_id IS NULL OR r.organization_id = $1
      ORDER BY r.process, r.code`,
    [organizationId]
  );
  return rows;
}

async function knownFunction(organizationId, code) {
  const { rows } = await pool.query('SELECT 1 FROM erp_functions WHERE code = $1 AND (organization_id IS NULL OR organization_id = $2)', [code, organizationId]);
  return rows.length > 0;
}

async function createRule(organizationId, userId, input) {
  const fields = ['code', 'name', 'process', 'function_a', 'function_b', 'risk_description'];
  const values = Object.fromEntries(fields.map((f) => [f, typeof input[f] === 'string' ? input[f].trim() : '']));
  const missing = fields.filter((f) => !values[f]);
  if (missing.length) throw new SodError(400, `Missing ${missing.join(', ')}`);
  values.function_a = values.function_a.toUpperCase();
  values.function_b = values.function_b.toUpperCase();
  if (values.function_a === values.function_b) throw new SodError(400, 'A rule needs two different functions');
  for (const f of [values.function_a, values.function_b]) {
    if (!(await knownFunction(organizationId, f))) throw new SodError(400, `Unknown function code ${f.slice(0, 60)}`);
  }
  const severity = input.severity || 'high';
  if (!['low', 'medium', 'high', 'critical'].includes(severity)) throw new SodError(400, 'Invalid severity');
  const { rows: library } = await pool.query('SELECT 1 FROM erp_sod_rules WHERE organization_id IS NULL AND code = $1', [values.code]);
  if (library.length) throw new SodError(409, 'That code is used by a library rule');
  try {
    const { rows: [rule] } = await pool.query(
      `INSERT INTO erp_sod_rules (organization_id, code, name, process, function_a, function_b, risk_description, severity, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [organizationId, values.code.slice(0, 40), values.name.slice(0, 200), values.process.slice(0, 60), values.function_a, values.function_b,
        values.risk_description.slice(0, 2000), severity, userId]
    );
    return rule;
  } catch (error) {
    if (error.code === '23505') throw new SodError(409, 'A rule with that code already exists');
    throw error;
  }
}

/**
 * Library rules can only be switched on or off for the organization. The
 * organization's own rules can also be edited; each edit bumps the version.
 */
async function updateRule(organizationId, userId, ruleId, input) {
  const { rows: [rule] } = await pool.query('SELECT * FROM erp_sod_rules WHERE id = $1 AND (organization_id IS NULL OR organization_id = $2)', [ruleId, organizationId]);
  if (!rule) throw new SodError(404, 'Rule not found');
  if (rule.organization_id === null) {
    if (typeof input.is_active !== 'boolean') throw new SodError(400, 'Library rules can only be enabled or disabled');
    await pool.query(
      `INSERT INTO erp_sod_rule_settings (organization_id, rule_id, is_active, updated_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, rule_id) DO UPDATE SET is_active = EXCLUDED.is_active, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [organizationId, ruleId, input.is_active, userId]
    );
    return { ...rule, effective_active: input.is_active, is_library: true };
  }
  const updates = {};
  for (const f of ['name', 'risk_description', 'process']) if (typeof input[f] === 'string' && input[f].trim()) updates[f] = input[f].trim().slice(0, 2000);
  if (input.severity !== undefined) {
    if (!['low', 'medium', 'high', 'critical'].includes(input.severity)) throw new SodError(400, 'Invalid severity');
    updates.severity = input.severity;
  }
  if (typeof input.is_active === 'boolean') updates.is_active = input.is_active;
  const keys = Object.keys(updates);
  if (!keys.length) throw new SodError(400, 'No changes supplied');
  const { rows: [updated] } = await pool.query(
    `UPDATE erp_sod_rules SET ${keys.map((k, i) => `${k} = $${i + 3}`).join(', ')}, version = version + 1, updated_at = NOW()
      WHERE id = $1 AND organization_id = $2 RETURNING *`,
    [ruleId, organizationId, ...keys.map((k) => updates[k])]
  );
  return updated;
}

module.exports = { SodError, runAnalysis, listConflicts, decideConflict, listRules, createRule, updateRule };
