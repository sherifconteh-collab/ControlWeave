// @tier: community
/**
 * Bulk asset import and inventory export.
 *
 * CMDB.md documented an "Import Assets" workflow with a Dry Run button and
 * POST /cmdb/import/analyze + /import/commit endpoints. None of it existed --
 * assets could only be entered one form at a time, which is not a usable way
 * to load a real estate of any size. This service is the implementation of
 * what the guide had been promising.
 *
 * The two-phase shape is deliberate and matches what the guide described:
 * analyze is a pure dry run that writes nothing and returns a per-row verdict,
 * so an operator can see exactly what a file will do before committing it.
 * Commit re-validates from scratch rather than trusting an analyze result --
 * the two calls are separate HTTP requests and the estate can change between
 * them, so an analyze token would be a lie about freshness.
 */

const pool = require('../config/database');
const { parseCsvDocument, toCsvDocument } = require('../utils/csv');

// Columns an operator may set on import. Deliberately a subset of the assets
// table: ownership by UUID, metadata JSON and the AI governance fields are not
// safely settable from a spreadsheet, so they stay on the form and the API.
const IMPORT_COLUMNS = [
  'name', 'asset_tag', 'serial_number', 'model', 'manufacturer',
  'location', 'status', 'criticality', 'security_classification',
  'ip_address', 'hostname', 'fqdn', 'mac_address',
  'version', 'license_key', 'license_expiry',
  'cloud_provider', 'cloud_region',
  'acquisition_date', 'deployment_date', 'end_of_life_date',
  'documentation_url', 'notes'
];

// Resolved by name to a UUID during import so the CSV stays human-writable.
const LOOKUP_COLUMNS = ['environment', 'owner_email'];

const VALID_STATUS = ['planning', 'active', 'maintenance', 'deprecated', 'decommissioned'];
const VALID_CRITICALITY = ['low', 'medium', 'high', 'critical'];
const VALID_CLASSIFICATION = ['public', 'internal', 'confidential', 'secret'];
const DATE_COLUMNS = ['license_expiry', 'acquisition_date', 'deployment_date', 'end_of_life_date'];

const MAX_IMPORT_ROWS = 5000;

function templateHeader() {
  return [...IMPORT_COLUMNS, ...LOOKUP_COLUMNS];
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Build the org-scoped lookup tables the CSV's human-readable columns resolve
 * against. One query each rather than per row -- a 5000-row import would
 * otherwise issue 10000 queries.
 */
async function loadLookups(orgId) {
  const [environments, users] = await Promise.all([
    pool.query('SELECT id, name FROM environments WHERE organization_id = $1', [orgId]),
    pool.query('SELECT id, email FROM users WHERE organization_id = $1 AND is_active = true', [orgId])
  ]);
  return {
    environments: new Map(environments.rows.map((row) => [row.name.toLowerCase(), row.id])),
    users: new Map(users.rows.map((row) => [row.email.toLowerCase(), row.id]))
  };
}

/**
 * Validate one parsed CSV row. Returns { valid, values, errors } -- never
 * throws, so one bad row reports itself instead of aborting the file.
 */
function validateRow(record, lookups, seenNames) {
  const errors = [];
  const values = {};

  const name = (record.name || '').trim();
  if (!name) {
    errors.push('name is required');
  } else if (seenNames.has(name.toLowerCase())) {
    errors.push(`duplicate name "${name}" appears earlier in this file`);
  }
  values.name = name;

  for (const column of IMPORT_COLUMNS) {
    if (column === 'name') continue;
    const raw = (record[column] || '').trim();
    if (raw === '') { values[column] = null; continue; }

    if (DATE_COLUMNS.includes(column) && !isIsoDate(raw)) {
      errors.push(`${column} must be YYYY-MM-DD, got "${raw}"`);
      continue;
    }
    values[column] = raw;
  }

  if (values.status && !VALID_STATUS.includes(values.status)) {
    errors.push(`status must be one of: ${VALID_STATUS.join(', ')}`);
  }
  if (values.criticality && !VALID_CRITICALITY.includes(values.criticality)) {
    errors.push(`criticality must be one of: ${VALID_CRITICALITY.join(', ')}`);
  }
  if (values.security_classification && !VALID_CLASSIFICATION.includes(values.security_classification)) {
    errors.push(`security_classification must be one of: ${VALID_CLASSIFICATION.join(', ')}`);
  }

  const environment = (record.environment || '').trim();
  if (environment) {
    const envId = lookups.environments.get(environment.toLowerCase());
    if (!envId) errors.push(`environment "${environment}" is not registered`);
    else values.environment_id = envId;
  }

  const ownerEmail = (record.owner_email || '').trim();
  if (ownerEmail) {
    const ownerId = lookups.users.get(ownerEmail.toLowerCase());
    if (!ownerId) errors.push(`owner_email "${ownerEmail}" is not an active user in this organization`);
    else values.owner_id = ownerId;
  }

  return { valid: errors.length === 0, values, errors };
}

/**
 * Dry run. Parses, validates and reports -- writes nothing.
 */
async function analyze({ orgId, csv }) {
  const { headers, rows } = parseCsvDocument(csv);

  if (headers.length === 0) {
    return { ok: false, error: 'The file is empty.', headers: [], rows: [], summary: null };
  }

  const known = new Set(templateHeader());
  const unknownHeaders = headers.filter((header) => !known.has(header));

  if (!headers.includes('name')) {
    return {
      ok: false,
      error: 'A "name" column is required.',
      headers,
      unknownHeaders,
      rows: [],
      summary: null
    };
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `File has ${rows.length} rows; the limit is ${MAX_IMPORT_ROWS} per import.`,
      headers,
      unknownHeaders,
      rows: [],
      summary: null
    };
  }

  const lookups = await loadLookups(orgId);
  const seenNames = new Set();
  const analyzed = rows.map((record, index) => {
    const result = validateRow(record, lookups, seenNames);
    if (result.values.name) seenNames.add(result.values.name.toLowerCase());
    return {
      line: index + 2, // +1 for zero-index, +1 for the header row
      name: result.values.name,
      valid: result.valid,
      errors: result.errors
    };
  });

  const validCount = analyzed.filter((row) => row.valid).length;
  return {
    ok: true,
    headers,
    unknownHeaders,
    rows: analyzed,
    summary: {
      total: analyzed.length,
      valid: validCount,
      invalid: analyzed.length - validCount,
      willImport: validCount
    }
  };
}

/**
 * Commit. Re-validates from scratch, then inserts every valid row in a single
 * transaction so a partial file cannot leave a half-loaded inventory behind.
 * Invalid rows are reported, not silently dropped.
 */
async function commit({ orgId, categoryId, csv }) {
  const preview = await analyze({ orgId, csv });
  if (!preview.ok) return { ok: false, error: preview.error, imported: 0, rows: [] };

  const { rows } = parseCsvDocument(csv);
  const lookups = await loadLookups(orgId);
  const seenNames = new Set();

  const prepared = rows.map((record) => {
    const result = validateRow(record, lookups, seenNames);
    if (result.values.name) seenNames.add(result.values.name.toLowerCase());
    return result;
  });

  const insertable = prepared.filter((row) => row.valid);
  if (insertable.length === 0) {
    return { ok: true, imported: 0, skipped: prepared.length, rows: preview.rows, summary: preview.summary };
  }

  const columns = [...IMPORT_COLUMNS, 'environment_id', 'owner_id'];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let imported = 0;
    for (const row of insertable) {
      const values = columns.map((column) => row.values[column] ?? null);
      const placeholders = columns.map((_, index) => `$${index + 3}`).join(',');
      await client.query(
        `INSERT INTO assets (organization_id, category_id, ${columns.join(',')})
         VALUES ($1,$2,${placeholders})`,
        [orgId, categoryId, ...values]
      );
      imported += 1;
    }
    await client.query('COMMIT');
    return {
      ok: true,
      imported,
      skipped: prepared.length - imported,
      rows: preview.rows,
      summary: preview.summary
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Inventory export. Emits exactly the columns the importer accepts, so an
 * export can be edited and fed straight back in.
 */
async function exportCsv({ orgId, categoryId }) {
  const params = [orgId];
  let categoryFilter = '';
  if (categoryId) { params.push(categoryId); categoryFilter = 'AND a.category_id = $2'; }

  const { rows } = await pool.query(`
    SELECT a.*, e.name AS environment, u.email AS owner_email, ac.name AS category
    FROM assets a
    LEFT JOIN environments e ON e.id = a.environment_id
    LEFT JOIN users u ON u.id = a.owner_id
    JOIN asset_categories ac ON ac.id = a.category_id
    WHERE a.organization_id = $1 ${categoryFilter}
    ORDER BY ac.name, a.name`,
    params
  );

  const header = ['category', ...templateHeader()];
  const formatted = rows.map((row) => {
    const record = {};
    for (const column of header) {
      const value = row[column];
      record[column] = value instanceof Date ? value.toISOString().slice(0, 10) : value;
    }
    return record;
  });

  return toCsvDocument(header, formatted);
}

function templateCsv() {
  return toCsvDocument(templateHeader(), []);
}

module.exports = {
  analyze,
  commit,
  exportCsv,
  templateCsv,
  templateHeader,
  IMPORT_COLUMNS,
  MAX_IMPORT_ROWS
};
