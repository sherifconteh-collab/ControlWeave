'use strict';

/**
 * Dependency tracker: what ControlWeave runs on, what is out of date, what
 * has known vulnerabilities and what is past end of life.
 *
 * Inventory
 *   backend    package.json + package-lock.json of this service (runtime)
 *   frontend   dependency-manifest.json (generated at build time)
 *   runtime    the running Node.js version
 *   database   the connected PostgreSQL server version
 *   container  Dockerfile base images (from the manifest)
 *
 * Sources: the npm registry (latest versions) and its bulk advisory API (the
 * GitHub Advisory Database data behind `npm audit`) for every resolved
 * package; nodejs.org for Node.js releases. End-of-life dates for Node.js and
 * PostgreSQL follow their published release policies (table below). A source
 * that cannot be reached marks the run 'partial' instead of failing it, so
 * air-gapped installs still get the inventory and end-of-life view.
 */

const fs = require('fs');
const path = require('path');
const semver = require('semver');
const pool = require('../config/database');
const { lockPackages, directDependencies } = require('../utils/dependencyInventory');
const { log, serializeError } = require('../utils/logger');

const ROOT = path.join(__dirname, '../..');
const NPM_REGISTRY = (process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org').replace(/\/+$/, '');
const NODE_DIST = 'https://nodejs.org/dist/index.json';
const HTTP_TIMEOUT_MS = 10000;
const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, low: 1 };

// End of life by major version. Node.js: nodejs.org release schedule (even
// majors, 30 months of support). PostgreSQL: five years after first release
// (postgresql.org versioning policy). Review when a new major ships.
const NODE_EOL = { 16: '2023-09-11', 18: '2025-04-30', 20: '2026-04-30', 22: '2027-04-30', 24: '2028-04-30', 26: '2029-04-30' };
const POSTGRES_EOL = { 12: '2024-11-21', 13: '2025-11-13', 14: '2026-11-12', 15: '2027-11-11', 16: '2028-11-09', 17: '2029-11-08', 18: '2030-11-14' };

async function getJson(url, init = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS), headers: { Accept: 'application/json', ...(init.headers || {}) } });
  if (!response.ok) {
    const error = new Error(`${new URL(url).host} returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function updateType(installed, latest) {
  const a = semver.valid(semver.coerce(installed));
  const b = semver.valid(semver.coerce(latest));
  if (!a || !b) return 'unknown';
  if (!semver.gt(b, a)) return 'none';
  return semver.diff(a, b).replace('pre', '');
}

function maxSeverity(advisories) {
  return advisories.reduce((best, adv) => (SEVERITY_RANK[adv.severity] > (SEVERITY_RANK[best] || 0) ? adv.severity : best), null);
}

/** npm components: { component, direct[], packages{} }. */
function npmInventory() {
  const components = [];
  const pkg = readJson(path.join(ROOT, 'package.json'));
  const lock = readJson(path.join(ROOT, 'package-lock.json'));
  if (pkg && lock) components.push({ component: 'backend', direct: directDependencies(pkg, lock), packages: lockPackages(lock) });
  const manifest = readJson(path.join(ROOT, 'dependency-manifest.json'));
  if (manifest && manifest.frontend) {
    components.push({ component: 'frontend', direct: manifest.frontend.direct, packages: manifest.frontend.packages });
  }
  return { components, containers: (manifest && manifest.containers) || {} };
}

async function latestVersions(names) {
  const latest = new Map();
  const failures = [];
  await mapLimit(names, 8, async (name) => {
    try {
      const data = await getJson(`${NPM_REGISTRY}/${name.startsWith('@') ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name)}/latest`);
      if (data && data.version) latest.set(name, data.version);
    } catch (error) {
      failures.push(name);
    }
  });
  return { latest, failures };
}

/** Advisories affecting the given resolved versions: name -> [{...advisory, versions}]. */
async function advisoriesFor(packages) {
  const names = Object.keys(packages);
  const result = new Map();
  for (let i = 0; i < names.length; i += 250) {
    const body = Object.fromEntries(names.slice(i, i + 250).map((n) => [n, packages[n]]));
    const data = await getJson(`${NPM_REGISTRY}/-/npm/v1/security/advisories/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    for (const [name, list] of Object.entries(data || {})) {
      const affected = (list || []).map((adv) => ({
        id: adv.id,
        title: adv.title,
        url: adv.url,
        severity: adv.severity,
        vulnerable_versions: adv.vulnerable_versions,
        versions: packages[name].filter((v) => {
          try { return semver.satisfies(v, adv.vulnerable_versions, { includePrerelease: true }); } catch { return false; }
        })
      })).filter((adv) => adv.versions.length && SEVERITY_RANK[adv.severity]);
      if (affected.length) result.set(name, affected);
    }
  }
  return result;
}

async function npmFindings(inventory, errors) {
  const findings = [];
  const directNames = [...new Set(inventory.components.flatMap((c) => c.direct.map((d) => d.name)))];
  const { latest, failures } = await latestVersions(directNames);
  if (failures.length) errors.push({ source: 'npm registry', detail: `latest version unavailable for ${failures.length} package(s)` });

  for (const comp of inventory.components) {
    let advisories = new Map();
    try {
      advisories = await advisoriesFor(comp.packages);
    } catch (error) {
      errors.push({ source: 'npm advisories', detail: `${comp.component}: ${error.message}` });
    }
    const directSet = new Set(comp.direct.map((d) => d.name));
    for (const dep of comp.direct) {
      const advs = advisories.get(dep.name) || [];
      const newest = latest.get(dep.name) || null;
      findings.push({
        component: comp.component, ecosystem: 'npm', name: dep.name, direct: true,
        installed: dep.installed, wanted: dep.range, latest: newest,
        update_type: newest ? updateType(dep.installed, newest) : 'unknown',
        advisories: advs, max_severity: maxSeverity(advs), eol_date: null,
        note: dep.dev ? 'Development dependency (not shipped in the production image)' : null
      });
    }
    for (const [name, advs] of advisories) {
      if (directSet.has(name)) continue;
      findings.push({
        component: comp.component, ecosystem: 'npm', name, direct: false,
        installed: comp.packages[name].join(', '), wanted: null, latest: null, update_type: 'unknown',
        advisories: advs, max_severity: maxSeverity(advs), eol_date: null,
        note: 'Transitive dependency: upgrade the package that brings it in, or pin a fixed version with an npm override'
      });
    }
  }
  return findings;
}

function eolNote(eol, label) {
  if (!eol) return null;
  const days = Math.floor((new Date(eol).getTime() - Date.now()) / 86400000);
  if (days < 0) return `${label} reached end of life on ${eol}; it no longer receives security fixes`;
  if (days <= 180) return `${label} reaches end of life on ${eol} (${days} days)`;
  return null;
}

async function runtimeFindings(inventory, errors) {
  const findings = [];
  let releases = [];
  try {
    releases = await getJson(NODE_DIST);
  } catch (error) {
    errors.push({ source: 'nodejs.org', detail: error.message });
  }
  const lts = releases.filter((r) => r.lts);
  const latestLtsMajor = lts.length ? semver.major(lts[0].version) : null;
  const latestInMajor = (major) => {
    const match = releases.find((r) => semver.major(r.version) === major);
    return match ? match.version.replace(/^v/, '') : null;
  };

  const running = process.version.replace(/^v/, '');
  const major = semver.major(running);
  const inMajor = latestInMajor(major);
  const eol = NODE_EOL[major] || null;
  findings.push({
    component: 'runtime', ecosystem: 'node', name: 'Node.js', direct: true,
    installed: running, wanted: `${major}.x`, latest: inMajor,
    update_type: inMajor ? updateType(running, inMajor) : 'unknown',
    advisories: [], max_severity: null, eol_date: eol,
    note: [eolNote(eol, `Node.js ${major}`), latestLtsMajor && latestLtsMajor > major ? `Latest LTS line is Node.js ${latestLtsMajor}` : null].filter(Boolean).join('. ') || null
  });

  for (const [service, images] of Object.entries(inventory.containers || {})) {
    for (const image of images) {
      const match = /^node:(\d+)/.exec(image);
      const imageMajor = match ? Number(match[1]) : null;
      const imageEol = imageMajor ? NODE_EOL[imageMajor] || null : null;
      findings.push({
        component: 'container', ecosystem: 'docker', name: `${service}: ${image}`, direct: true,
        installed: image, wanted: null,
        latest: imageMajor && latestLtsMajor ? `node:${latestLtsMajor}-alpine` : null,
        update_type: imageMajor && latestLtsMajor ? (latestLtsMajor > imageMajor ? 'major' : 'none') : 'unknown',
        advisories: [], max_severity: null, eol_date: imageEol,
        note: eolNote(imageEol, `Node.js ${imageMajor} base image`)
      });
    }
  }

  try {
    const { rows } = await pool.query("SELECT current_setting('server_version') AS v");
    const version = String(rows[0].v).split(' ')[0];
    const pgMajor = Number(version.split('.')[0]);
    const pgEol = POSTGRES_EOL[pgMajor] || null;
    findings.push({
      component: 'database', ecosystem: 'postgresql', name: 'PostgreSQL', direct: true,
      installed: version, wanted: `${pgMajor}.x`, latest: null, update_type: 'unknown',
      advisories: [], max_severity: null, eol_date: pgEol,
      note: [eolNote(pgEol, `PostgreSQL ${pgMajor}`), 'Apply the latest minor release of your major version (postgresql.org/support/versioning)'].filter(Boolean).join('. ')
    });
  } catch (error) {
    errors.push({ source: 'database', detail: error.message });
  }
  return findings;
}

function summarize(findings) {
  const security = { critical: 0, high: 0, moderate: 0, low: 0 };
  const outdated = { major: 0, minor: 0, patch: 0 };
  let eol = 0;
  let eolSoon = 0;
  const today = Date.now();
  for (const f of findings) {
    if (f.max_severity) security[f.max_severity] += 1;
    if (f.direct && outdated[f.update_type] !== undefined) outdated[f.update_type] += 1;
    if (f.eol_date) {
      const t = new Date(f.eol_date).getTime();
      if (t < today) eol += 1;
      else if (t - today < 180 * 86400000) eolSoon += 1;
    }
  }
  return { total: findings.length, security, outdated, end_of_life: eol, end_of_life_within_180_days: eolSoon };
}

async function insertFindings(runId, findings) {
  for (let i = 0; i < findings.length; i += 200) {
    const chunk = findings.slice(i, i + 200);
    const values = [];
    const params = [];
    chunk.forEach((f, idx) => {
      const b = idx * 13;
      values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10}::jsonb,$${b + 11},$${b + 12},$${b + 13})`);
      params.push(runId, f.component, f.ecosystem, f.name, f.direct, f.installed, f.wanted, f.latest, f.update_type,
        JSON.stringify(f.advisories || []), f.max_severity, f.eol_date, f.note);
    });
    await pool.query(
      `INSERT INTO dependency_findings (run_id, component, ecosystem, name, direct, installed, wanted, latest, update_type, advisories, max_severity, eol_date, note)
       VALUES ${values.join(',')}`,
      params
    );
  }
}

/** Advisory keys (component|name|advisory id) of critical/high findings in a run. */
async function seriousAdvisoryKeys(runId) {
  const { rows } = await pool.query(
    `SELECT component, name, adv->>'id' AS id
       FROM dependency_findings f, jsonb_array_elements(f.advisories) adv
      WHERE f.run_id = $1 AND adv->>'severity' IN ('critical', 'high')`,
    [runId]
  );
  return new Set(rows.map((r) => `${r.component}|${r.name}|${r.id}`));
}

async function notifyPlatformAdmins(newCount, runId) {
  try {
    const { createNotification } = require('./notificationService');
    const { rows } = await pool.query('SELECT id, organization_id FROM users WHERE is_platform_admin = true AND is_active = true');
    for (const admin of rows) {
      await createNotification(
        admin.organization_id, admin.id, 'system',
        'New dependency vulnerabilities',
        `${newCount} new critical or high severity advisor${newCount === 1 ? 'y affects' : 'ies affect'} ControlWeave dependencies.`,
        '/dashboard/platform/dependencies'
      );
    }
  } catch (error) {
    log('warn', 'dependencies.notify_failed', { runId, error: serializeError(error) });
  }
}

/**
 * Run a full check. Only one runs at a time across replicas (advisory lock);
 * a concurrent request returns { busy: true }.
 */
async function runCheck({ trigger = 'manual', userId = null } = {}) {
  const lockClient = await pool.connect();
  try {
    const lock = await lockClient.query("SELECT pg_try_advisory_lock(hashtext('dependency-check')) AS ok");
    if (!lock.rows[0].ok) return { busy: true };
    const previous = await pool.query("SELECT id FROM dependency_check_runs WHERE status IN ('completed', 'partial') ORDER BY started_at DESC LIMIT 1");
    const { rows: [run] } = await pool.query(
      'INSERT INTO dependency_check_runs (trigger, started_by) VALUES ($1, $2) RETURNING id',
      [trigger, userId]
    );
    const errors = [];
    try {
      const inventory = npmInventory();
      if (!inventory.components.length) errors.push({ source: 'inventory', detail: 'No package-lock.json or dependency-manifest.json found' });
      const findings = [...(await npmFindings(inventory, errors)), ...(await runtimeFindings(inventory, errors))];
      await insertFindings(run.id, findings);
      // A planned upgrade is done once the check no longer finds anything to act
      // on (installed version current, no advisories, not end of life).
      await pool.query(
        `UPDATE dependency_decisions d SET status = 'done', updated_at = NOW()
          WHERE d.status = 'planned' AND EXISTS (
            SELECT 1 FROM dependency_findings f
             WHERE f.run_id = $1 AND f.component = d.component AND f.name = d.name
               AND f.update_type IN ('none', 'unknown') AND f.max_severity IS NULL
               AND (f.eol_date IS NULL OR f.eol_date >= CURRENT_DATE))`,
        [run.id]
      );
      const summary = summarize(findings);
      const status = errors.length ? 'partial' : 'completed';
      await pool.query(
        'UPDATE dependency_check_runs SET status = $2, finished_at = NOW(), summary = $3::jsonb, errors = $4::jsonb WHERE id = $1',
        [run.id, status, JSON.stringify(summary), JSON.stringify(errors)]
      );
      if (previous.rows[0]) {
        const before = await seriousAdvisoryKeys(previous.rows[0].id);
        const after = await seriousAdvisoryKeys(run.id);
        const fresh = [...after].filter((key) => !before.has(key)).length;
        if (fresh > 0) await notifyPlatformAdmins(fresh, run.id);
      }
      log('info', 'dependencies.check_completed', { runId: run.id, status, summary });
      return { id: run.id, status, summary, errors };
    } catch (error) {
      await pool.query(
        "UPDATE dependency_check_runs SET status = 'failed', finished_at = NOW(), errors = $2::jsonb WHERE id = $1",
        [run.id, JSON.stringify([...errors, { source: 'check', detail: error.message }])]
      );
      throw error;
    }
  } finally {
    await lockClient.query("SELECT pg_advisory_unlock(hashtext('dependency-check'))").catch(() => {});
    lockClient.release();
  }
}

/** Latest finished run with its findings and the team's decisions. */
async function latestReport() {
  const { rows: [run] } = await pool.query(
    `SELECT r.*, TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS started_by_name
       FROM dependency_check_runs r LEFT JOIN users u ON u.id = r.started_by
      WHERE r.status IN ('completed', 'partial') ORDER BY r.started_at DESC LIMIT 1`
  );
  if (!run) return { run: null, findings: [] };
  const { rows } = await pool.query(
    `SELECT f.*,
            CASE WHEN d.status = 'snoozed' AND d.snooze_until < CURRENT_DATE THEN 'open' ELSE COALESCE(d.status, 'open') END AS decision_status,
            d.note AS decision_note, d.target_version, d.snooze_until, d.poam_item_id, d.updated_at AS decided_at
       FROM dependency_findings f
       LEFT JOIN dependency_decisions d ON d.component = f.component AND d.name = f.name
      WHERE f.run_id = $1
      ORDER BY CASE f.max_severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'moderate' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
               (f.eol_date IS NOT NULL AND f.eol_date < CURRENT_DATE) DESC,
               CASE f.update_type WHEN 'major' THEN 0 WHEN 'minor' THEN 1 WHEN 'patch' THEN 2 ELSE 3 END,
               f.component, f.name`,
    [run.id]
  );
  return { run, findings: rows };
}

module.exports = { runCheck, latestReport, summarize, updateType, maxSeverity, eolNote, advisoriesFor, NODE_EOL, POSTGRES_EOL };
