'use strict';

/**
 * QA self-test runner.
 *
 * Runs registered checks for one organization, bounds each by a timeout so a
 * self-test can never hang, and persists the run to qa_test_runs. Checks are
 * grouped into suites; each returns { status, detail, remediation? } where
 * status is pass | warn | fail | skip.
 *
 * Checks must be non-destructive to customer data: functional checks create,
 * verify and remove their own "[QA]" records through the public API, and
 * never change the status of the organization's own controls.
 */

const path = require('path');
const pool = require('../../config/database');
const { log, serializeError } = require('../../utils/logger');
const { createApiClient } = require('./apiClient');

const SUITES = Object.freeze([
  { id: 'platform', title: 'Platform health', description: 'Database, migrations, security configuration, storage, email and cache.' },
  { id: 'frameworks', title: 'Frameworks & compliance data', description: 'Framework catalogs, crosswalk credits, and that every screen reports the same compliance numbers.' },
  { id: 'audit', title: 'Audit trail', description: 'Audit events are written, read back, exported, append-only, and the hash chain is intact.' },
  { id: 'functional', title: 'Core workflows', description: 'Risk, evidence, assessment and vendor workflows round-trip through the live API, and reports generate.' },
  { id: 'access', title: 'Access control', description: 'Role permissions match the expected least-privilege matrix; admin MFA adoption.' },
  { id: 'ai', title: 'AI providers', description: 'Configured bring-your-own-key providers accept their keys and expose the default model.' },
  { id: 'performance', title: 'Performance', description: 'Response times of the most-used API endpoints.' }
]);

const CHECK_TIMEOUT_MS = Math.max(5000, parseInt(process.env.QA_CHECK_TIMEOUT_MS || '30000', 10));

function loadChecks() {
  return [
    ...require('./checks/platform'),
    ...require('./checks/frameworks'),
    ...require('./checks/audit'),
    ...require('./checks/functional'),
    ...require('./checks/access'),
    ...require('./checks/ai'),
    ...require('./checks/performance')
  ];
}

function listChecks() {
  return loadChecks().map(({ id, suite, title, description }) => ({ id, suite, title, description }));
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} did not finish within ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runCheck(check, ctx) {
  const started = Date.now();
  try {
    const outcome = await withTimeout(Promise.resolve().then(() => check.run(ctx)), CHECK_TIMEOUT_MS, check.title);
    return {
      id: check.id,
      suite: check.suite,
      title: check.title,
      status: outcome.status,
      detail: outcome.detail || '',
      remediation: outcome.remediation || null,
      metrics: outcome.metrics || null,
      durationMs: Date.now() - started
    };
  } catch (error) {
    return {
      id: check.id,
      suite: check.suite,
      title: check.title,
      status: 'fail',
      detail: `Check errored: ${String(error.message || error).slice(0, 300)}`,
      remediation: null,
      metrics: null,
      durationMs: Date.now() - started
    };
  }
}

function summarize(results) {
  const counts = { pass: 0, warn: 0, fail: 0, skip: 0 };
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  const status = counts.fail > 0 ? 'failed' : counts.warn > 0 ? 'passed_with_warnings' : 'passed';
  return { status, counts, total: results.length };
}

function appVersion() {
  try {
    return require(path.resolve(__dirname, '../../../package.json')).version || null;
  } catch {
    return null;
  }
}

/**
 * @param {{ organizationId: string, userId: string, authorization: string, suites?: string[] }} options
 */
async function runSelfTest({ organizationId, userId, authorization, suites }) {
  const requested = Array.isArray(suites) && suites.length > 0
    ? SUITES.map((s) => s.id).filter((id) => suites.includes(id))
    : SUITES.map((s) => s.id);
  const checks = loadChecks().filter((c) => requested.includes(c.suite));

  const runRow = await pool.query(
    `INSERT INTO qa_test_runs (organization_id, started_by, suites, status, app_version)
     VALUES ($1, $2, $3, 'running', $4) RETURNING id, started_at`,
    [organizationId, userId, requested, appVersion()]
  );
  const runId = runRow.rows[0].id;
  const ctx = {
    runId,
    organizationId,
    userId,
    api: createApiClient({ authorization, runId }),
    shared: {}
  };

  const results = [];
  for (const check of checks) {
    // Sequential on purpose: functional checks create and clean up records,
    // and timings are only meaningful without self-inflicted contention.
    results.push(await runCheck(check, ctx));
  }

  const summary = summarize(results);
  await pool.query(
    `UPDATE qa_test_runs
     SET status = $2, summary = $3::jsonb, results = $4::jsonb, finished_at = NOW()
     WHERE id = $1 AND organization_id = $5`,
    [runId, summary.status, JSON.stringify(summary), JSON.stringify(results), organizationId]
  ).catch((error) => log('error', 'qa.run_persist_failed', { runId, error: serializeError(error) }));

  return { id: runId, started_at: runRow.rows[0].started_at, suites: requested, ...summary, results };
}

module.exports = { SUITES, listChecks, runSelfTest, summarize, CHECK_TIMEOUT_MS };
