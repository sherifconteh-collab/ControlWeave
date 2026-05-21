// @tier: exclude
/**
 * DISA STIG Version Check — Quarterly Verification
 *
 * Compares the STIG versions seeded in the database against the latest
 * known versions in stig-version-manifest.json.  Produces a Markdown
 * report suitable for the GitHub Actions step summary.
 *
 * Exit codes:
 *   0 — all STIGs up-to-date (or DB unavailable — skipped gracefully)
 *   1 — one or more STIGs are outdated (warning, not failure)
 *
 * Usage:
 *   node scripts/check-stig-versions.js            # check against DB
 *   node scripts/check-stig-versions.js --offline   # check seed scripts only (no DB)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(__dirname, '../config/stig-version-manifest.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Manifest file not found: ${MANIFEST_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

/** Parse "V5R3" → { major: 5, release: 3 } */
function parseVersion(v) {
  const m = String(v).match(/^V(\d+)R(\d+)$/i);
  if (!m) {
    console.warn(`  Warning: could not parse version string "${v}" — expected format VnRn`);
    return null;
  }
  return { major: Number(m[1]), release: Number(m[2]) };
}

/** Return true when seeded < manifest */
function isOutdated(seededVersion, manifestVersion) {
  const s = parseVersion(seededVersion);
  const m = parseVersion(manifestVersion);
  if (!s || !m) return false;            // unparseable → skip
  if (s.major < m.major) return true;
  if (s.major === m.major && s.release < m.release) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Offline check — compare manifest against seed-script constants
// ---------------------------------------------------------------------------

function checkOffline(manifest) {
  console.log('Running offline STIG version check (seed scripts vs manifest)...\n');

  const results = [];

  for (const entry of manifest.stigs) {
    const scriptPath = path.join(__dirname, entry.seed_script);
    if (!fs.existsSync(scriptPath)) {
      results.push({ ...entry, seeded_version: 'MISSING', status: '❌ Seed script not found' });
      continue;
    }

    // Read the script and extract the version string
    const src = fs.readFileSync(scriptPath, 'utf8');
    const vMatch = src.match(/version:\s*'(V\d+R\d+)'/i);
    const seededVersion = vMatch ? vMatch[1] : 'UNKNOWN';

    if (seededVersion === entry.current_version) {
      results.push({ ...entry, seeded_version: seededVersion, status: '✅ Current' });
    } else if (isOutdated(seededVersion, entry.current_version)) {
      results.push({ ...entry, seeded_version: seededVersion, status: `⚠️ Update available → ${entry.current_version}` });
    } else {
      results.push({ ...entry, seeded_version: seededVersion, status: '✅ Current' });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Online check — compare manifest against database rows
// ---------------------------------------------------------------------------

async function checkOnline(manifest) {
  console.log('Running online STIG version check (database vs manifest)...\n');

  const { Pool } = require('pg');
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  const results = [];
  const client = await pool.connect();

  try {
    for (const entry of manifest.stigs) {
      const res = await client.query(
        'SELECT version FROM frameworks WHERE code = $1 LIMIT 1',
        [entry.code]
      );

      if (res.rows.length === 0) {
        results.push({ ...entry, seeded_version: 'NOT SEEDED', status: '❌ Not seeded — run ' + entry.seed_script });
        continue;
      }

      const seededVersion = res.rows[0].version;

      if (seededVersion === entry.current_version) {
        results.push({ ...entry, seeded_version: seededVersion, status: '✅ Current' });
      } else if (isOutdated(seededVersion, entry.current_version)) {
        results.push({ ...entry, seeded_version: seededVersion, status: `⚠️ Update available → ${entry.current_version}` });
      } else {
        results.push({ ...entry, seeded_version: seededVersion, status: '✅ Current' });
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  return results;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function printReport(results, manifest) {
  const now = new Date().toISOString().replace('T', ' ').split('.')[0] + ' UTC';

  console.log('='.repeat(80));
  console.log('DISA STIG QUARTERLY VERSION CHECK');
  console.log('='.repeat(80));
  console.log(`Date:            ${now}`);
  console.log(`Manifest source: ${manifest.source}`);
  console.log(`Last reviewed:   ${manifest.last_reviewed}`);
  console.log('');

  const outdated = [];

  for (const r of results) {
    const flag = r.status.startsWith('✅') ? '  ' : '⚠ ';
    console.log(`${flag}${r.name}`);
    console.log(`   Code:      ${r.code}`);
    console.log(`   Seeded:    ${r.seeded_version}`);
    console.log(`   Latest:    ${r.current_version}`);
    console.log(`   Status:    ${r.status}`);
    console.log('');

    if (!r.status.startsWith('✅')) {
      outdated.push(r);
    }
  }

  console.log('-'.repeat(80));
  if (outdated.length === 0) {
    console.log('✅ All DISA STIGs are up-to-date.');
  } else {
    console.log(`⚠️  ${outdated.length} STIG(s) need attention:`);
    outdated.forEach(r => console.log(`   - ${r.code}: ${r.status}`));
  }
  console.log('');

  // GitHub Actions step-summary markdown (if running in CI)
  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = [];
    md.push('## DISA STIG Quarterly Version Check');
    md.push('');
    md.push(`**Date:** ${now}`);
    md.push(`**Manifest last reviewed:** ${manifest.last_reviewed}`);
    md.push(`**Source:** [DISA STIG Downloads](${manifest.source})`);
    md.push('');
    md.push('| STIG | Code | Seeded | Latest | Status |');
    md.push('|------|------|--------|--------|--------|');
    for (const r of results) {
      md.push(`| ${r.name} | \`${r.code}\` | ${r.seeded_version} | ${r.current_version} | ${r.status} |`);
    }
    md.push('');
    if (outdated.length > 0) {
      md.push('### ⚠️ Action Required');
      md.push('');
      md.push('The following STIGs need to be updated. Download the latest from DISA, update the seed script, bump `stig-version-manifest.json`, and re-seed:');
      md.push('');
      for (const r of outdated) {
        md.push(`- **${r.code}**: seeded ${r.seeded_version} → latest ${r.current_version} ([download](${r.disa_url}))`);
      }
    } else {
      md.push('### ✅ All STIGs Current');
      md.push('');
      md.push('No updates required this quarter.');
    }

    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n') + '\n');
  }

  return outdated.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const manifest = loadManifest();
  const offline = process.argv.includes('--offline');

  let results;
  if (offline) {
    results = checkOffline(manifest);
  } else {
    try {
      results = await checkOnline(manifest);
    } catch (err) {
      console.warn(`Database unavailable (${err.message}) — falling back to offline check.\n`);
      results = checkOffline(manifest);
    }
  }

  const outdatedCount = printReport(results, manifest);

  // Exit 1 when outdated so the workflow step shows a warning annotation
  if (outdatedCount > 0) {
    console.log('::warning::One or more DISA STIG frameworks are outdated. Review the version check report above.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('STIG version check failed:', err);
  process.exit(1);
});
