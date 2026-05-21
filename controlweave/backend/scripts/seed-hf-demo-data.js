// @tier: exclude
/**
 * seed-hf-demo-data.js
 *
 * Pulls realistic CVE examples from multiple Hugging Face datasets and seeds
 * tier-specific vulnerability data for all demo accounts.
 *
 * Target demo accounts (created by seed-demo-accounts.js):
 *   admin@community.com
 *   admin@pro.com
 *   admin@enterprise.com
 *   admin@govcloud.com
 *
 * Idempotent — uses seed_tag cleanup so re-runs replace previous demo data.
 *
 * Run:
 *   npm run seed:demo:hf
 *
 * Optional:
 *   npm run seed:demo:hf:govcloud
 *   node scripts/seed-hf-demo-data.js --targets=admin@govcloud.com
 *   HF_DEMO_TARGET_EMAILS=admin@govcloud.com npm run seed:demo:hf
 *   HF_DEMO_TARGET_EMAILS=govcloud npm run seed:demo:hf
 */
require('dotenv').config();
const https = require('https');
const pool = require('../src/config/database');
const { mapCweToOwasp2025 } = require('../src/utils/owaspMapping');
const {
  HF_DEMO_TARGET_ACCOUNTS,
  HF_FINDINGS_BY_TIER
} = require('./lib/demo-account-config');

const HF_TIMEOUT_MS = Math.max(3000, Number(process.env.HF_DEMO_TIMEOUT_MS || 30000));
const HF_ROWS_LENGTH = Math.max(20, Math.min(100, Number(process.env.HF_DEMO_ROWS_LENGTH || 100)));
const HF_ROWS_OFFSET = Math.max(0, Number(process.env.HF_DEMO_ROWS_OFFSET || 25000));

const PRIMARY_DATASET = Object.freeze({
  dataset: process.env.HF_DEMO_DATASET || 'navin-hariharan/cve-dataset',
  config: process.env.HF_DEMO_CONFIG || 'default',
  split: process.env.HF_DEMO_SPLIT || 'train',
  offset: HF_ROWS_OFFSET,
  length: HF_ROWS_LENGTH
});

const DEFAULT_DATASET_SPECS = Object.freeze([
  PRIMARY_DATASET,
  {
    dataset: 'zefang-liu/cve-and-cwe-mapping-dataset',
    config: 'default',
    split: 'train',
    offset: 0,
    length: HF_ROWS_LENGTH
  },
  {
    dataset: 'iamthierno/cvedataset.jsonl',
    config: 'default',
    split: 'train',
    offset: 0,
    length: HF_ROWS_LENGTH
  },
  {
    dataset: 'JavIndra/attack-cves-data',
    config: 'default',
    split: 'train',
    offset: 0,
    length: HF_ROWS_LENGTH
  }
]);

const DEMO_ACCOUNTS = HF_DEMO_TARGET_ACCOUNTS;

const SOURCE_BY_TIER = Object.freeze({
  community: ['SAST', 'SCAP'],
  pro: ['ACAS', 'SBOM', 'SCAP', 'SAST'],
  enterprise: ['ACAS', 'SBOM', 'SCAP', 'STIG', 'SAST'],
  govcloud: ['ACAS', 'SBOM', 'SCAP', 'STIG', 'SAST']
});

const STATUS_BY_TIER = Object.freeze({
  community: ['open', 'in_progress'],
  pro: ['open', 'in_progress', 'risk_accepted', 'remediated'],
  enterprise: ['open', 'in_progress', 'risk_accepted', 'false_positive', 'remediated'],
  govcloud: ['open', 'in_progress', 'risk_accepted', 'false_positive', 'remediated']
});

const SEVERITY_ORDER = Object.freeze(['critical', 'high', 'medium', 'low', 'info']);

function resolveTargetAccounts() {
  const cliTargetsArg = process.argv
    .map((arg) => String(arg || '').trim())
    .find((arg) => arg.startsWith('--targets='));
  const cliTargets = cliTargetsArg ? cliTargetsArg.slice('--targets='.length) : '';
  const rawTargets = String(cliTargets || process.env.HF_DEMO_TARGET_EMAILS || '').trim();
  if (!rawTargets) return DEMO_ACCOUNTS;

  const requested = new Set(
    rawTargets
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );

  const selected = DEMO_ACCOUNTS.filter((account) => (
    requested.has(String(account.email || '').toLowerCase())
    || requested.has(String(account.tier || '').toLowerCase())
  ));

  if (!selected.length) {
    throw new Error(
      `HF_DEMO_TARGET_EMAILS did not match any demo accounts: ${rawTargets}`
    );
  }

  return selected;
}

function findingsCountForContext(accountContext) {
  const targetByEmail = DEMO_ACCOUNTS.find((entry) => entry.email === accountContext.email);
  if (targetByEmail?.findings) return targetByEmail.findings;

  const tier = String(accountContext.tier || '').toLowerCase();
  return HF_FINDINGS_BY_TIER[tier] || 10;
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: HF_TIMEOUT_MS }, (res) => {
      let body = '';
      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Hugging Face request failed (${res.statusCode})`));
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Failed to parse Hugging Face response JSON: ${error.message}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Hugging Face request timed out'));
    });

    req.on('error', (error) => {
      reject(error);
    });
  });
}

function truncateText(value, maxLength) {
  const text = String(value || '');
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength);
}

function stripText(value, fallback = '') {
  const text = String(value || '').trim();
  return text.length ? text : fallback;
}

function firstSentence(value, fallback = '') {
  const text = stripText(value, fallback);
  if (!text) return fallback;
  const pieces = text.split(/(?<=[.!?])\s+/);
  return pieces[0] || text;
}

function extractCveFromText(value) {
  const match = String(value || '').match(/CVE-\d{4}-\d+/i);
  return match ? match[0].toUpperCase() : null;
}

function extractCweFromText(value) {
  const match = String(value || '').match(/CWE-\d+/i);
  if (!match) return null;
  return match[0].toUpperCase();
}

function inferSeverityFromText(value) {
  const text = String(value || '').toLowerCase();
  if (!text) return 'medium';
  if (/(critical|rce|remote code execution|arbitrary code|privilege escalation|command injection)/i.test(text)) {
    return 'high';
  }
  if (/(sql injection|xss|cross-site|csrf|directory traversal|path traversal|denial of service|dos|overflow)/i.test(text)) {
    return 'medium';
  }
  if (/(information disclosure|sensitive information|low risk|minor)/i.test(text)) {
    return 'low';
  }
  return 'medium';
}

function parseCvss(rawScore) {
  const numeric = Number(rawScore);
  if (!Number.isFinite(numeric)) return null;
  const bounded = Math.max(0, Math.min(10, numeric));
  return Number(bounded.toFixed(1));
}

function mapSeverity(rawSeverity, rawScore) {
  const value = String(rawSeverity || '').trim().toLowerCase();
  if (SEVERITY_ORDER.includes(value)) {
    if (value === 'info') return 'low';
    return value;
  }

  const score = Number(rawScore);
  if (!Number.isFinite(score)) return 'medium';
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

function dueDateForSeverity(severity, status) {
  if (status === 'remediated' || status === 'false_positive') {
    return null;
  }

  const date = new Date();
  if (severity === 'critical') date.setDate(date.getDate() + 14);
  else if (severity === 'high') date.setDate(date.getDate() + 30);
  else if (severity === 'medium') date.setDate(date.getDate() + 45);
  else date.setDate(date.getDate() + 60);
  return date.toISOString().slice(0, 10);
}

function timestampDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function pickCycle(values, index) {
  return values[index % values.length];
}

function buildRowsUrl(spec, offsetOverride = null) {
  const query = new URLSearchParams({
    dataset: spec.dataset,
    config: spec.config,
    split: spec.split,
    offset: String(offsetOverride ?? spec.offset),
    length: String(spec.length)
  });
  return `https://datasets-server.huggingface.co/rows?${query.toString()}`;
}

function datasetAlias(dataset) {
  return String(dataset || '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function parseDatasetSpec(rawSpec) {
  const parts = String(rawSpec || '')
    .split('|')
    .map((item) => item.trim());
  if (!parts[0]) return null;
  return {
    dataset: parts[0],
    config: parts[1] || 'default',
    split: parts[2] || 'train',
    offset: Math.max(0, Number(parts[3] || 0)),
    length: Math.max(20, Math.min(100, Number(parts[4] || HF_ROWS_LENGTH)))
  };
}

function resolveDatasetSpecs() {
  const raw = String(process.env.HF_DEMO_DATASETS || '').trim();
  if (!raw) return DEFAULT_DATASET_SPECS;

  const parsed = raw
    .split(/[;,]/)
    .map((entry) => parseDatasetSpec(entry))
    .filter(Boolean);

  return parsed.length ? parsed : DEFAULT_DATASET_SPECS;
}

function normalizeSingleRow(spec, rawRowEntry) {
  const rowIdx = Number(rawRowEntry?.row_idx || 0);
  const row = rawRowEntry?.row || {};
  const combinedText = `${stripText(row.instruction)}\n${stripText(row.input)}\n${stripText(row.output)}`;

  let cve = null;
  let title = null;
  let description = null;
  let severity = 'medium';
  let cvss = null;
  let cwe = null;

  if (row.CVE || row.Score || row.Severity) {
    cve = extractCveFromText(row.CVE);
    title = stripText(row.Vulnerability, `Demo finding for ${cve || 'CVE'}`);
    description = stripText(row.Description, title);
    severity = mapSeverity(row.Severity, row.Score);
    cvss = parseCvss(row.Score);
    cwe = stripText(row.CWE, null);
  } else if (row['CVE-ID'] || row['CVSS-V2'] || row.SEVERITY) {
    cve = extractCveFromText(row['CVE-ID']);
    description = stripText(row.DESCRIPTION, '');
    title = firstSentence(description, `Demo finding for ${cve || 'CVE'}`);
    severity = mapSeverity(row.SEVERITY, row['CVSS-V2']);
    cvss = parseCvss(row['CVSS-V2'] ?? row['CVSS-V3']);
    cwe = stripText(row['CWE-ID'], null);
  } else if (row.instruction || row.output || row.input) {
    cve = extractCveFromText(combinedText);
    description = stripText(row.output || row.instruction || row.input, '');
    title = firstSentence(row.instruction || description, `Demo finding for ${cve || 'CVE'}`);
    severity = inferSeverityFromText(description || row.instruction || '');
    cvss = parseCvss((description || '').match(/CVSS[^0-9]*([0-9]+(?:\.[0-9])?)/i)?.[1]);
    cwe = extractCweFromText(description);
  }

  if (!cve || !/^CVE-\d{4}-\d+/i.test(cve)) {
    return null;
  }

  if (!description) {
    description = `Imported from Hugging Face dataset ${spec.dataset}.`;
  }

  return {
    dataset: spec.dataset,
    config: spec.config,
    split: spec.split,
    rowIdx,
    cve: cve.toUpperCase(),
    title: truncateText(title || `Demo finding for ${cve}`, 1000),
    description: truncateText(description, 6000),
    severity,
    cvss,
    cwe: truncateText(stripText(cwe || '', ''), 64) || null
  };
}

function dedupeDatasetRows(normalizedRows) {
  const map = new Map();
  for (const row of normalizedRows) {
    const key = `${row.dataset}::${row.cve}`;
    const existing = map.get(key);
    if (!existing || String(row.description || '').length > String(existing.description || '').length) {
      map.set(key, row);
    }
  }
  return Array.from(map.values());
}

async function fetchDatasetRows(spec) {
  const primaryUrl = buildRowsUrl(spec);
  const primaryPayload = await requestJson(primaryUrl);
  let rows = Array.isArray(primaryPayload.rows) ? primaryPayload.rows : [];

  if (!rows.length && spec.offset > 0) {
    const fallbackUrl = buildRowsUrl(spec, 0);
    const fallbackPayload = await requestJson(fallbackUrl);
    rows = Array.isArray(fallbackPayload.rows) ? fallbackPayload.rows : [];
  }

  const normalized = dedupeDatasetRows(
    rows
      .map((entry) => normalizeSingleRow(spec, entry))
      .filter(Boolean)
  );

  return normalized;
}

async function collectDatasetRows(specs) {
  const aggregated = [];

  for (const spec of specs) {
    try {
      const rows = await fetchDatasetRows(spec);
      if (rows.length) {
        aggregated.push(...rows);
      }
      console.log(`  - ${spec.dataset} (${spec.config}/${spec.split}) -> ${rows.length} normalized rows`);
    } catch (error) {
      console.warn(`  - ${spec.dataset} failed: ${error.message}`);
    }
  }

  const dedupedAcrossSources = new Map();
  for (const row of aggregated) {
    const key = `${row.dataset}::${row.cve}`;
    if (!dedupedAcrossSources.has(key)) dedupedAcrossSources.set(key, row);
  }

  return Array.from(dedupedAcrossSources.values());
}

async function getDemoAccountContext(client, email) {
  const result = await client.query(
    `SELECT
       u.id AS user_id,
       u.email,
       o.id AS organization_id,
       o.name AS organization_name,
       o.tier
     FROM users u
     JOIN organizations o ON o.id = u.organization_id
     WHERE u.email = $1
     LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function getSoftwareCategoryId(client) {
  const result = await client.query(
    `SELECT id
     FROM asset_categories
     WHERE code = 'software'
     LIMIT 1`
  );
  if (!result.rows.length) {
    throw new Error('Missing asset category: software');
  }
  return result.rows[0].id;
}

async function resolveTierAssets(client, { organizationId, userId, tier, softwareCategoryId }) {
  const existing = await client.query(
    `SELECT
       a.id,
       ac.code AS category_code
     FROM assets a
     JOIN asset_categories ac ON ac.id = a.category_id
     WHERE a.organization_id = $1
       AND ac.code IN ('software', 'hardware', 'cloud', 'database')
     ORDER BY
       CASE ac.code
         WHEN 'software' THEN 1
         WHEN 'hardware' THEN 2
         WHEN 'cloud' THEN 3
         WHEN 'database' THEN 4
         ELSE 5
       END,
       a.created_at ASC
     LIMIT 1`,
    [organizationId]
  );

  if (existing.rows.length > 0) {
    return existing.rows;
  }

  const fallbackName = `HF Demo Service (${tier})`;
  const inserted = await client.query(
    `INSERT INTO assets (
       organization_id, category_id, name, owner_id, status, security_classification, criticality, metadata
     )
     VALUES (
       $1, $2, $3, $4, 'active', 'confidential', 'high', $5::jsonb
     )
     RETURNING id`,
    [
      organizationId,
      softwareCategoryId,
      fallbackName,
      userId,
      JSON.stringify({
        seed_tag: 'hf_demo_tier_seed',
        source: 'huggingface',
        note: 'Fallback asset created because no CMDB assets were present'
      })
    ]
  );

  return [{ id: inserted.rows[0].id, category_code: 'software' }];
}

async function clearPreviousSeedData(client, organizationId) {
  await client.query(
    `DELETE FROM vulnerability_findings
     WHERE organization_id = $1
       AND metadata->>'seed_tag' = 'hf_demo_tier_seed'`,
    [organizationId]
  );

  await client.query(
    `DELETE FROM notifications
     WHERE organization_id = $1
       AND type = 'system'
       AND title = 'Demo: Hugging Face Security Dataset Loaded'`,
    [organizationId]
  );

  await client.query(
    `DELETE FROM audit_logs
     WHERE organization_id = $1
       AND details->>'seed_tag' = 'hf_demo_tier_seed'`,
    [organizationId]
  );
}

async function seedOrgFindings(client, accountContext, datasetRows, softwareCategoryId, startIndex) {
  const { organization_id: organizationId, organization_name: organizationName, user_id: userId } = accountContext;
  const tier = String(accountContext.tier || '').toLowerCase();
  const desiredCount = findingsCountForContext(accountContext);

  const sourceCycle = SOURCE_BY_TIER[tier] || SOURCE_BY_TIER.community;
  const statusCycle = STATUS_BY_TIER[tier] || STATUS_BY_TIER.community;
  const assetPool = await resolveTierAssets(client, { organizationId, userId, tier, softwareCategoryId });

  await clearPreviousSeedData(client, organizationId);

  let insertedCount = 0;
  let highRiskCount = 0;
  let criticalCount = 0;

  for (let i = 0; i < desiredCount; i++) {
    const datasetEntry = datasetRows[(startIndex + i) % datasetRows.length];
    if (!datasetEntry?.cve) continue;

    const severity = datasetEntry.severity || 'medium';
    const cvss = datasetEntry.cvss;
    const status = pickCycle(statusCycle, i);
    const assetEntry = assetPool[(startIndex + i) % assetPool.length];
    const source = pickCycle(sourceCycle, i);
    const daysAgo = 2 + ((i * 9 + Number(datasetEntry.rowIdx || 0)) % 180);
    const firstSeenDaysAgo = Math.max(daysAgo + 14, daysAgo);
    const dueDate = dueDateForSeverity(severity, status);
    const fixedAt = (status === 'remediated' || status === 'false_positive')
      ? timestampDaysAgo(Math.max(1, daysAgo - 1))
      : null;
    const datasetKey = datasetAlias(datasetEntry.dataset);

    await client.query(
      `INSERT INTO vulnerability_findings (
         organization_id, asset_id, source, standard, finding_key, vulnerability_id,
         title, description, severity, cvss_score, status,
         first_seen_at, last_seen_at, detected_at, due_date, fixed_at,
         package_name, component_name, cwe_id, owasp_top10_2025_category, metadata
       )
       VALUES (
         $1, $2, $3, 'CVE/NVD', $4, $5,
         $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15,
         $16, $17, $18, $19, $20::jsonb
       )`,
      [
        organizationId,
        assetEntry.id,
        source,
        `hf_demo:${tier}:${datasetKey}:${datasetEntry.cve}`,
        datasetEntry.cve,
        datasetEntry.title,
        datasetEntry.description,
        severity,
        cvss,
        status,
        timestampDaysAgo(firstSeenDaysAgo),
        timestampDaysAgo(daysAgo),
        timestampDaysAgo(daysAgo),
        dueDate,
        fixedAt,
        `huggingface-${datasetKey}`,
        truncateText(datasetEntry.title || 'huggingface-sample', 255),
        datasetEntry.cwe,
        mapCweToOwasp2025(datasetEntry.cwe),
        JSON.stringify({
          seed_tag: 'hf_demo_tier_seed',
          seed_source: 'huggingface',
          dataset: datasetEntry.dataset,
          config: datasetEntry.config,
          split: datasetEntry.split,
          dataset_row_idx: datasetEntry.rowIdx,
          asset_category: assetEntry.category_code,
          hf_dataset_url: `https://huggingface.co/datasets/${datasetEntry.dataset}`
        })
      ]
    );

    insertedCount += 1;
    if (severity === 'critical') criticalCount += 1;
    if (severity === 'critical' || severity === 'high') highRiskCount += 1;
  }

  await client.query(
    `INSERT INTO notifications (organization_id, user_id, type, title, message, link, is_read, created_at)
     VALUES ($1, $2, 'system', 'Demo: Hugging Face Security Dataset Loaded', $3, '/dashboard/vulnerabilities', false, NOW())`,
    [
      organizationId,
      userId,
      `Loaded ${insertedCount} realistic vulnerability findings from multiple Hugging Face datasets (${highRiskCount} high/critical, ${criticalCount} critical) for ${organizationName}.`
    ]
  );

  await client.query(
    `INSERT INTO audit_logs (organization_id, user_id, event_type, resource_type, details, success)
     VALUES ($1, $2, 'hf_demo_seed_loaded', 'vulnerability', $3::jsonb, true)` ,
    [
      organizationId,
      userId,
      JSON.stringify({
        seed_tag: 'hf_demo_tier_seed',
        findings_inserted: insertedCount,
        high_or_critical: highRiskCount,
        critical: criticalCount
      })
    ]
  );

  return {
    tier,
    organizationName,
    insertedCount,
    highRiskCount,
    criticalCount
  };
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('\nImporting Hugging Face security demo data...\n');
    const targetAccounts = resolveTargetAccounts();
    console.log(`Target demo accounts: ${targetAccounts.map((entry) => `${entry.email} (${entry.tier})`).join(', ')}\n`);

    const datasetSpecs = resolveDatasetSpecs();
    console.log('Datasets:');
    for (const spec of datasetSpecs) {
      console.log(`  - ${spec.dataset} (${spec.config}/${spec.split}) offset=${spec.offset} length=${spec.length}`);
    }
    console.log('');

    const datasetRows = await collectDatasetRows(datasetSpecs);
    if (!datasetRows.length) {
      throw new Error('No usable CVE rows returned from configured Hugging Face datasets');
    }
    console.log(`Total normalized rows available: ${datasetRows.length}\n`);

    const softwareCategoryId = await getSoftwareCategoryId(client);
    let startIndex = 0;
    const results = [];

    for (const account of targetAccounts) {
      const context = await getDemoAccountContext(client, account.email);
      if (!context) {
        console.log(`  - Skipped ${account.email}: account not found`);
        continue;
      }

      await client.query('BEGIN');
      try {
        const seeded = await seedOrgFindings(client, context, datasetRows, softwareCategoryId, startIndex);
        await client.query('COMMIT');
        startIndex += account.findings;
        results.push(seeded);
        console.log(
          `  ✓ ${seeded.tier.padEnd(12)} ${seeded.organizationName} -> ${seeded.insertedCount} findings (${seeded.highRiskCount} high/critical)`
        );
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`  ✗ Failed for ${account.email}: ${error.message}`);
      }
    }

    if (!results.length) {
      console.log('\nNo demo accounts were available to seed.\n');
      return;
    }

    const total = results.reduce((sum, item) => sum + item.insertedCount, 0);
    const totalHighRisk = results.reduce((sum, item) => sum + item.highRiskCount, 0);
    const totalCritical = results.reduce((sum, item) => sum + item.criticalCount, 0);

    console.log('\n✅ Hugging Face demo data import complete.\n');
    console.log(`  Total findings inserted: ${total}`);
    console.log(`  High/Critical findings:  ${totalHighRisk}`);
    console.log(`  Critical findings:       ${totalCritical}\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error('\n❌ Hugging Face demo seed failed:', error.message);
  process.exit(1);
});
