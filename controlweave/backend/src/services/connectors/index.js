'use strict';

/**
 * Connector registry: templates, credential handling, sync dispatch and the
 * evidence snapshot each successful sync produces.
 *
 * Credentials (auth_config) are encrypted per value with utils/encrypt and
 * never returned by the API; responses carry only which keys are set.
 */

const path = require('path');
const { createHash } = require('crypto');
const pool = require('../../config/database');
const { encrypt, decrypt, isEncrypted } = require('../../utils/encrypt');
const { UPLOADS_DIR } = require('../../config/uploads');
const storageService = require('../storageService');
const { assertSafeUrl } = require('../../utils/netGuard');

const MASK = '********';

const TEMPLATES = [
  { type: 'okta', label: 'Okta', category: 'Identity', required: ['domain', 'apiToken'], optional: ['inactiveDays'], secrets: ['apiToken'],
    description: 'Checks MFA enrollment, administrators without MFA and inactive accounts. Needs a read-only administrator API token.' },
  { type: 'entra_id', label: 'Microsoft Entra ID', category: 'Identity', required: ['tenantId', 'clientId', 'clientSecret'], optional: ['inactiveDays'], secrets: ['clientSecret'],
    description: 'Checks MFA registration, administrators and sign-in inactivity through Microsoft Graph (User.Read.All, AuditLog.Read.All).' },
  { type: 'jira', label: 'Jira', category: 'Ticketing', required: ['baseUrl', 'projectKey'], optional: ['email', 'apiToken', 'personalAccessToken', 'jql', 'issueType'], secrets: ['apiToken', 'personalAccessToken'],
    description: 'Tracks remediation tickets (open, overdue, time to resolve), opens tickets from POA&M items and keeps their status in sync.' },
  { type: 'aws_security_hub', label: 'AWS Security Hub', category: 'Cloud Security', required: ['region', 'accessKeyId', 'secretAccessKey'], optional: ['assumeRoleArn'], secrets: ['secretAccessKey'],
    description: 'AWS Security Hub findings, mapped to NIST and CIS controls.' },
  { type: 'qualys_vmdr', label: 'Qualys VMDR', category: 'Vulnerability Scanner', required: ['baseUrl', 'username', 'password'], optional: ['tagIds'], secrets: ['password'],
    description: 'Qualys VMDR vulnerability detections.' },
  { type: 'servicenow', label: 'ITSM / Change Management', category: 'Ticketing', required: ['instanceUrl', 'username', 'password'], optional: ['changeTableName', 'incidentTableName'], secrets: ['password'], // ip-hygiene:ignore
    description: 'Incident and change records as evidence of change management.' }
];

const SYNC_HANDLERS = Object.freeze({
  okta: () => require('./okta').syncFindings,
  entra_id: () => require('./entraId').syncFindings,
  jira: () => require('./jira').syncFindings,
  aws_security_hub: () => require('../awsSecurityHubService').syncFindings,
  qualys_vmdr: () => require('../qualysService').syncFindings,
  servicenow: () => require('../serviceNowService').syncFindings // ip-hygiene:ignore
});

// Controls each connector's snapshot is evidence for. Only controls in
// frameworks the organization has selected are linked.
const IDENTITY_CONTROLS = [
  ['nist_800_53', 'AC-2'], ['nist_800_53', 'AC-2(3)'], ['nist_800_53', 'IA-2'], ['nist_800_53', 'IA-2(1)'], ['nist_800_53', 'IA-2(2)'],
  ['nist_800_171', '03.01.01'], ['nist_800_171', '03.05.03'],
  ['cmmc_2.0', 'AC.L2-3.1.1'], ['cmmc_2.0', 'IA.L2-3.5.3'],
  ['soc2', 'CC6.1'], ['soc2', 'CC6.2'], ['soc2', 'CC6.3'],
  ['iso_27001', 'A.5.16'], ['iso_27001', 'A.5.18'], ['iso_27001', 'A.8.5'],
  ['hipaa', 'HIPAA-164.312(d)'], ['hipaa', 'HIPAA-164.312(a)(2)(i)'], ['hipaa', 'HIPAA-164.308(a)(4)(ii)(C)'], ['hipaa', 'HIPAA-164.308(a)(3)(ii)(C)']
];
const EVIDENCE_CONTROLS = {
  okta: IDENTITY_CONTROLS,
  entra_id: IDENTITY_CONTROLS,
  jira: [
    ['nist_800_53', 'SI-2'], ['nist_800_53', 'CA-5'], ['nist_800_53', 'PM-4'], ['nist_800_53', 'RA-5'],
    ['nist_800_171', '03.14.01'], ['cmmc_2.0', 'SI.L2-3.14.1'], ['cmmc_2.0', 'CA.L2-3.12.2'],
    ['soc2', 'CC7.4'], ['iso_27001', 'A.8.8'], ['iso_27001', 'A.5.26'],
    ['hipaa', 'HIPAA-164.308(a)(1)(ii)(B)']
  ]
};

function templateFor(type) {
  return TEMPLATES.find((t) => t.type === type) || null;
}

function listTemplates() {
  return TEMPLATES.map((t) => ({ ...t, sync_available: Boolean(SYNC_HANDLERS[t.type]) }));
}

function isSecretKey(type, key) {
  const template = templateFor(type);
  if (template && template.secrets.includes(key)) return true;
  return /secret|password|token|apikey|api_key|privatekey/i.test(key);
}

/**
 * Split submitted settings into encrypted credentials and plain settings.
 * Secret-looking keys are always treated as credentials, wherever they were
 * submitted. `existingAuth` supplies values for keys left blank or masked.
 */
function prepareConfig(type, { authConfig = {}, connectorConfig = {} }, existingAuth = {}) {
  const auth = { ...existingAuth };
  const settings = {};
  const entries = [...Object.entries(connectorConfig || {}), ...Object.entries(authConfig || {})];
  for (const [key, raw] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)) continue;
    const value = raw === null || raw === undefined ? '' : String(raw).trim();
    if (isSecretKey(type, key)) {
      if (value && value !== MASK) auth[key] = encrypt(value);
    } else if (value) {
      settings[key] = value.slice(0, 2000);
    }
  }
  return { auth, settings };
}

function missingRequired(type, auth, settings) {
  const template = templateFor(type);
  if (!template) return [];
  return template.required.filter((key) => !auth[key] && !settings[key]);
}

/**
 * Reject URL settings (baseUrl, instanceUrl, domain) that point at private
 * networks, at save time rather than only when a sync runs. Returns an error
 * message or null.
 */
const DNS_UNRESOLVED = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ENODATA']);

async function validateUrlSettings(settings) {
  for (const [key, value] of Object.entries(settings || {})) {
    if (!/url$|domain$/i.test(key) || !value) continue;
    const candidate = /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`;
    try {
      await assertSafeUrl(candidate);
    } catch (error) {
      // A host that does not resolve yet (not provisioned, or only resolvable
      // from the network the sync runs in) is saved; every outbound request
      // re-runs assertSafeUrl, so it still cannot reach a private address.
      if (DNS_UNRESOLVED.has(error.code)) continue;
      return `${key}: ${error.message}`;
    }
  }
  return null;
}

/** Connector row as returned by the API: credentials replaced by flags. */
function redact(row) {
  if (!row) return row;
  const auth = row.auth_config || {};
  const template = templateFor(row.connector_type);
  return {
    ...row,
    auth_config: Object.fromEntries(Object.keys(auth).map((key) => [key, MASK])),
    credentials_set: Object.keys(auth),
    label: template ? template.label : row.connector_type,
    category: template ? template.category : 'Other',
    sync_available: Boolean(SYNC_HANDLERS[row.connector_type])
  };
}

/** Decrypted settings for a sync. Legacy plaintext values are passed through. */
function runtimeConfig(row) {
  const auth = Object.fromEntries(Object.entries(row.auth_config || {}).map(([k, v]) => [k, isEncrypted(v) ? decrypt(v) : v]));
  return { ...(row.connector_config || {}), ...auth };
}

function severityCounts(findings) {
  return findings.reduce((acc, f) => ({ ...acc, [f.severity || 'informational']: (acc[f.severity || 'informational'] || 0) + 1 }), {});
}

async function writeEvidence({ row, userId, outcome }) {
  const mappings = EVIDENCE_CONTROLS[row.connector_type];
  if (!mappings) return null;
  const template = templateFor(row.connector_type);
  const collectedAt = new Date().toISOString();
  const payload = {
    source: template.label,
    connector_id: row.id,
    connector_name: row.name,
    collected_at: collectedAt,
    metrics: outcome.metrics || {},
    findings_by_severity: severityCounts(outcome.findings || []),
    findings: (outcome.findings || []).slice(0, 5000)
  };
  const body = Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
  const hash = createHash('sha256').update(body).digest('hex');
  const filePath = path.join(UPLOADS_DIR, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${row.connector_type}.json`);
  await storageService.writeFile(filePath, body, { contentType: 'application/json' });
  const fileName = `${row.connector_type}-snapshot-${collectedAt.slice(0, 10)}.json`;
  const { rows } = await pool.query(
    `INSERT INTO evidence (organization_id, uploaded_by, file_name, file_path, file_size, mime_type,
                           description, tags, integrity_hash_sha256, evidence_version, integrity_verified_at)
     VALUES ($1, $2, $3, $4, $5, 'application/json', $6, $7, $8, 1, NOW())
     RETURNING id`,
    [
      row.organization_id, userId, fileName, filePath, body.length,
      `${template.label} snapshot collected by connector "${row.name}" on ${collectedAt.slice(0, 10)}`,
      ['connector', row.connector_type], hash
    ]
  );
  const evidenceId = rows[0].id;
  await pool.query(
    `INSERT INTO evidence_control_links (evidence_id, control_id, notes, organization_id)
     SELECT $1, fc.id, $4, $2
       FROM framework_controls fc
       JOIN frameworks f ON f.id = fc.framework_id
       JOIN organization_frameworks ofw ON ofw.framework_id = f.id AND ofw.organization_id = $2
       JOIN unnest($3::text[]) AS m(pair) ON f.code || '|' || fc.control_id = m.pair
     ON CONFLICT DO NOTHING`,
    [evidenceId, row.organization_id, mappings.map(([fw, ctl]) => `${fw}|${ctl}`), `Collected by ${template.label} connector`]
  );
  return evidenceId;
}

/** Refresh the ticket status of POA&M items pushed through this Jira connector. */
async function refreshPoamTickets(row, config) {
  const { rows } = await pool.query(
    `SELECT id, external_ticket_key FROM poam_items
      WHERE organization_id = $1 AND external_ticket_connector_id = $2 AND external_ticket_key IS NOT NULL
      LIMIT 500`,
    [row.organization_id, row.id]
  );
  if (!rows.length) return 0;
  const statuses = await require('./jira').getStatuses(config, rows.map((r) => r.external_ticket_key));
  let updated = 0;
  for (const item of rows) {
    if (!statuses.has(item.external_ticket_key)) continue;
    await pool.query(
      `UPDATE poam_items SET external_ticket_status = $3, external_ticket_synced_at = NOW()
        WHERE organization_id = $1 AND id = $2`,
      [row.organization_id, item.id, statuses.get(item.external_ticket_key)]
    );
    updated += 1;
  }
  return updated;
}

/**
 * Run a connector sync. Returns { failed, summary, error }. Only one run per
 * connector proceeds at a time (advisory lock); a concurrent attempt is
 * reported as busy rather than queued.
 */
async function runSync(row, userId) {
  const handlerFactory = SYNC_HANDLERS[row.connector_type];
  if (!handlerFactory) return { unavailable: true };
  const lockClient = await pool.connect();
  try {
    const lock = await lockClient.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [`connector:${row.id}`]);
    if (!lock.rows[0].ok) return { busy: true };
    const config = runtimeConfig(row);
    let outcome;
    try {
      outcome = await handlerFactory()(config);
    } catch (error) {
      outcome = { error: error.message, findings: [] };
    }
    if (outcome.error) {
      return { failed: true, error: String(outcome.error).slice(0, 500), summary: { connector_type: row.connector_type, error: 'Connector sync failed' } };
    }
    const findings = outcome.findings || [];
    const evidenceId = await writeEvidence({ row, userId, outcome });
    const ticketsRefreshed = row.connector_type === 'jira' ? await refreshPoamTickets(row, config) : undefined;
    return {
      failed: false,
      summary: {
        connector_type: row.connector_type,
        findings_retrieved: findings.length,
        by_severity: severityCounts(findings),
        metrics: outcome.metrics || undefined,
        evidence_id: evidenceId || undefined,
        poam_tickets_refreshed: ticketsRefreshed,
        completed_at: new Date().toISOString()
      }
    };
  } finally {
    await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [`connector:${row.id}`]).catch(() => {});
    lockClient.release();
  }
}

module.exports = {
  MASK,
  listTemplates,
  templateFor,
  prepareConfig,
  missingRequired,
  validateUrlSettings,
  redact,
  runtimeConfig,
  runSync,
  EVIDENCE_CONTROLS
};
