'use strict';

/**
 * ERP configuration monitoring: current settings (imported as the `config`
 * kind), the changes seen between extracts, and approved baselines to check
 * them against. The monitoring rules CCM-CFG-01/02 (ccmService) raise
 * exceptions from the same comparison used here for the compliance view.
 *
 * Comparisons: equals, not_equals, in (comma-separated list), min, max,
 * range ("low..high"). Text comparisons ignore case and surrounding spaces;
 * numeric comparisons fail for a value that is not a number, so a blank
 * "unlimited" setting does not pass a maximum.
 */

const pool = require('../../config/database');
const { platformFor } = require('./roleFunctions');

class ConfigError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const COMPARISONS = ['equals', 'not_equals', 'in', 'min', 'max', 'range'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * SQL boolean: does item alias `ci` satisfy baseline alias `b`? NULL-safe
 * (a missing or non-numeric value is FALSE). Only baseline values validated
 * by validateBaseline reach the numeric casts.
 */
const COMPLIES_SQL = `COALESCE(CASE b.comparison
    WHEN 'equals' THEN LOWER(TRIM(ci.value)) = LOWER(TRIM(b.expected_value))
    WHEN 'not_equals' THEN LOWER(TRIM(ci.value)) IS DISTINCT FROM LOWER(TRIM(b.expected_value))
    WHEN 'in' THEN LOWER(TRIM(ci.value)) = ANY(string_to_array(LOWER(REPLACE(b.expected_value, ' ', '')), ','))
    WHEN 'min' THEN (CASE WHEN TRIM(ci.value) ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN TRIM(ci.value)::numeric END) >= b.expected_value::numeric
    WHEN 'max' THEN (CASE WHEN TRIM(ci.value) ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN TRIM(ci.value)::numeric END) <= b.expected_value::numeric
    WHEN 'range' THEN (CASE WHEN TRIM(ci.value) ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN TRIM(ci.value)::numeric END)
                      BETWEEN split_part(b.expected_value, '..', 1)::numeric AND split_part(b.expected_value, '..', 2)::numeric
  END AND ci.is_present, FALSE)`;

/** Plain-language expectation, for titles and the UI. */
const EXPECTATION_SQL = `CASE b.comparison
    WHEN 'equals' THEN b.expected_value
    WHEN 'not_equals' THEN 'not ' || b.expected_value
    WHEN 'in' THEN 'one of ' || b.expected_value
    WHEN 'min' THEN 'at least ' || b.expected_value
    WHEN 'max' THEN 'at most ' || b.expected_value
    WHEN 'range' THEN 'between ' || REPLACE(b.expected_value, '..', ' and ')
  END`;

function validateBaseline(input) {
  const configKey = typeof input.config_key === 'string' ? input.config_key.trim().slice(0, 300) : '';
  if (!configKey) throw new ConfigError(400, 'config_key is required');
  if (!COMPARISONS.includes(input.comparison)) throw new ConfigError(400, `comparison must be one of: ${COMPARISONS.join(', ')}`);
  const expected = typeof input.expected_value === 'string' || typeof input.expected_value === 'number' ? String(input.expected_value).trim().slice(0, 1000) : '';
  if (!expected) throw new ConfigError(400, 'expected_value is required');
  if (['min', 'max'].includes(input.comparison) && !NUMBER.test(expected)) throw new ConfigError(400, 'expected_value must be a number');
  if (input.comparison === 'range') {
    const [low, high] = expected.split('..');
    if (!NUMBER.test(low || '') || !NUMBER.test(high || '') || Number(low) > Number(high)) throw new ConfigError(400, 'A range is written low..high, for example 1..5');
  }
  const severity = input.severity === undefined ? 'high' : input.severity;
  if (!SEVERITIES.includes(severity)) throw new ConfigError(400, `severity must be one of: ${SEVERITIES.join(', ')}`);
  const rationale = typeof input.rationale === 'string' ? input.rationale.trim().slice(0, 2000) || null : null;
  return { configKey, comparison: input.comparison, expected, severity, rationale };
}

async function assertSystem(organizationId, systemId) {
  const { rows: [system] } = await pool.query('SELECT id, erp_type FROM erp_systems WHERE id = $1 AND organization_id = $2', [systemId, organizationId]);
  if (!system) throw new ConfigError(404, 'ERP system not found');
  return system;
}

/** Current settings with their baseline and whether they comply, plus baselines with no reported value. */
async function listItems(organizationId, systemId, { onlyBaselined = false } = {}) {
  await assertSystem(organizationId, systemId);
  const { rows } = await pool.query(
    `SELECT COALESCE(ci.config_key, b.config_key) AS config_key, ci.category, ci.value, ci.description, ci.is_present,
            ci.last_changed_at, ci.last_changed_by, ci.last_seen_at,
            b.id AS baseline_id, b.comparison, b.expected_value, b.severity, b.rationale,
            CASE WHEN b.id IS NULL THEN NULL ELSE ${EXPECTATION_SQL} END AS expectation,
            CASE WHEN b.id IS NULL THEN NULL ELSE ${COMPLIES_SQL} END AS complies
       FROM (SELECT * FROM erp_config_items WHERE system_id = $1 AND organization_id = $2) ci
       FULL OUTER JOIN (SELECT * FROM erp_config_baselines WHERE system_id = $1 AND organization_id = $2) b
         ON b.config_key = ci.config_key
      WHERE $3::boolean IS FALSE OR b.id IS NOT NULL
      ORDER BY (CASE WHEN b.id IS NOT NULL AND NOT ${COMPLIES_SQL} THEN 0 ELSE 1 END), COALESCE(ci.config_key, b.config_key)
      LIMIT 5000`,
    [systemId, organizationId, onlyBaselined]
  );
  return rows;
}

async function listChanges(organizationId, systemId, { limit = 200 } = {}) {
  await assertSystem(organizationId, systemId);
  const { rows } = await pool.query(
    `SELECT c.id, c.config_key, c.old_value, c.new_value, c.changed_at, c.changed_by, c.detected_at, (b.id IS NOT NULL) AS monitored
       FROM erp_config_changes c
       LEFT JOIN erp_config_baselines b ON b.system_id = c.system_id AND b.config_key = c.config_key
      WHERE c.system_id = $1 AND c.organization_id = $2
      ORDER BY c.detected_at DESC, c.config_key LIMIT $3`,
    [systemId, organizationId, Math.min(1000, Math.max(1, limit))]
  );
  return rows;
}

async function upsertBaseline(organizationId, userId, systemId, input) {
  await assertSystem(organizationId, systemId);
  const b = validateBaseline(input);
  const { rows: [row] } = await pool.query(
    `INSERT INTO erp_config_baselines (organization_id, system_id, config_key, comparison, expected_value, severity, rationale, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT ON CONSTRAINT erp_config_baselines_unique DO UPDATE
       SET comparison = EXCLUDED.comparison, expected_value = EXCLUDED.expected_value, severity = EXCLUDED.severity,
           rationale = EXCLUDED.rationale, updated_at = NOW()
     WHERE erp_config_baselines.organization_id = EXCLUDED.organization_id
     RETURNING *`,
    [organizationId, systemId, b.configKey, b.comparison, b.expected, b.severity, b.rationale, userId]
  );
  if (!row) throw new ConfigError(404, 'ERP system not found');
  return row;
}

async function deleteBaseline(organizationId, systemId, baselineId) {
  const { rowCount } = await pool.query(
    'DELETE FROM erp_config_baselines WHERE id = $1 AND system_id = $2 AND organization_id = $3',
    [baselineId, systemId, organizationId]
  );
  if (!rowCount) throw new ConfigError(404, 'Baseline not found');
}

/** Copy the recommended settings for the system's platform; existing baselines are kept. */
async function adoptLibrary(organizationId, userId, systemId) {
  const system = await assertSystem(organizationId, systemId);
  const platform = platformFor(system.erp_type);
  if (!platform) throw new ConfigError(409, 'ControlWeaver has recommended settings for SAP and Oracle E-Business Suite systems only; add baselines for this system yourself');
  const { rowCount } = await pool.query(
    `INSERT INTO erp_config_baselines (organization_id, system_id, config_key, comparison, expected_value, severity, rationale, created_by)
     SELECT $1, $2, l.config_key, l.comparison, l.expected_value, l.severity, l.rationale, $3
       FROM erp_config_baseline_library l WHERE l.platform = $4
     ON CONFLICT ON CONSTRAINT erp_config_baselines_unique DO NOTHING`,
    [organizationId, systemId, userId, platform]
  );
  return { added: rowCount, platform };
}

async function listLibrary(platform) {
  const { rows } = await pool.query(
    'SELECT * FROM erp_config_baseline_library WHERE ($1::text IS NULL OR platform = $1) ORDER BY platform, config_key',
    [platform || null]
  );
  return rows;
}

module.exports = {
  ConfigError, COMPARISONS, COMPLIES_SQL, EXPECTATION_SQL, validateBaseline, listItems, listChanges,
  upsertBaseline, deleteBaseline, adoptLibrary, listLibrary
};
