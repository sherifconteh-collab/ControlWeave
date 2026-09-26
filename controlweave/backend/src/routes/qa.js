'use strict';

/**
 * QA / self-test routes. Lets an organization's QA or acceptance testers run
 * the platform self-test suite (services/qa) against their own deployment and
 * keep the results as acceptance-test evidence.
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const pool = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { isUuid } = require('../middleware/validate');
const auditService = require('../services/auditService');
const { log, serializeError } = require('../utils/logger');
const { SUITES, listChecks, runSelfTest } = require('../services/qa/runner');

// express-rate-limit router-wide, ahead of authenticate (CodeQL-visible; see
// TEVV-SEC-4). The self-test run itself has a tighter per-org limit below.
router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
router.use(authenticate);
router.use(requirePermission('qa.run'));

const runLimiter = createRateLimiter({
  label: 'qa-run',
  windowMs: 60 * 1000,
  max: 6,
  keyGenerator: (req) => `org:${req.user && req.user.organization_id}`
});

// GET /qa/checks — the suites and checks available to run
router.get('/checks', (req, res) => {
  res.json({ success: true, data: { suites: SUITES, checks: listChecks() } });
});

// POST /qa/runs — run the self-test suite (all suites, or those listed)
router.post('/runs', runLimiter, async (req, res) => {
  try {
    const requested = Array.isArray(req.body && req.body.suites) ? req.body.suites : [];
    const known = new Set(SUITES.map((s) => s.id));
    const unknown = requested.filter((s) => !known.has(s));
    if (unknown.length) {
      return res.status(400).json({ success: false, error: `Unknown suite(s): ${unknown.join(', ')}` });
    }
    const run = await runSelfTest({
      organizationId: req.user.organization_id,
      userId: req.user.id,
      authorization: req.headers.authorization,
      suites: requested
    });
    await auditService.logFromRequest(req, {
      eventType: 'qa.run_completed',
      resourceType: 'qa_run',
      resourceId: run.id,
      details: { suites: run.suites, status: run.status, counts: run.counts }
    }).catch((error) => log('error', 'qa.run_audit_failed', { error: serializeError(error) }));
    res.status(201).json({ success: true, data: run });
  } catch (error) {
    log('error', 'qa.run_failed', { error: serializeError(error) });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /qa/runs — run history
router.get('/runs', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const result = await pool.query(
      `SELECT r.id, r.suites, r.status, r.summary, r.app_version, r.started_at, r.finished_at,
              TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS started_by_name
         FROM qa_test_runs r
         LEFT JOIN users u ON u.id = r.started_by
        WHERE r.organization_id = $1
        ORDER BY r.started_at DESC
        LIMIT $2`,
      [req.user.organization_id, limit]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    log('error', 'qa.list_runs_failed', { error: serializeError(error) });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

async function loadRun(orgId, id) {
  const result = await pool.query(
    `SELECT r.*, TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS started_by_name
       FROM qa_test_runs r
       LEFT JOIN users u ON u.id = r.started_by
      WHERE r.organization_id = $1 AND r.id = $2`,
    [orgId, id]
  );
  return result.rows[0] || null;
}

// GET /qa/runs/:id — one run with full results
router.get('/runs/:id', async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid run id' });
    const run = await loadRun(req.user.organization_id, req.params.id);
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });
    res.json({ success: true, data: run });
  } catch (error) {
    log('error', 'qa.get_run_failed', { error: serializeError(error) });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  // Neutralize spreadsheet formula injection and quote every cell.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

// GET /qa/runs/:id/export?format=csv|json — acceptance-test evidence
router.get('/runs/:id/export', async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid run id' });
    const run = await loadRun(req.user.organization_id, req.params.id);
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });
    const stamp = new Date(run.started_at).toISOString().replace(/[:.]/g, '-');
    await auditService.logFromRequest(req, {
      eventType: 'qa.run_exported',
      resourceType: 'qa_run',
      resourceId: run.id,
      details: { format: req.query.format === 'csv' ? 'csv' : 'json' }
    }).catch(() => {});
    if (req.query.format === 'csv') {
      const header = ['suite', 'check', 'status', 'detail', 'remediation', 'duration_ms'];
      const rows = (run.results || []).map((r) => [r.suite, r.title, r.status, r.detail, r.remediation, r.durationMs]);
      const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="controlweave-self-test-${stamp}.csv"`);
      return res.send(csv);
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="controlweave-self-test-${stamp}.json"`);
    res.send(JSON.stringify(run, null, 2));
  } catch (error) {
    log('error', 'qa.export_run_failed', { error: serializeError(error) });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
