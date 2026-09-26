'use strict';

/**
 * Dependency tracker API for the platform operations team (platform owner
 * only): the latest check, on-demand checks, upgrade decisions, POA&M items
 * for planned upgrades, and a CSV export. See services/dependencyTracker.js.
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const pool = require('../config/database');
const { authenticate, requirePlatformOwner } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const auditService = require('../services/auditService');
const tracker = require('../services/dependencyTracker');
const { log, serializeError } = require('../utils/logger');

router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
router.use(authenticate);
router.use(requirePlatformOwner);

const DECISIONS = ['open', 'planned', 'accepted', 'snoozed', 'done'];
// Remediation windows by severity (days), in line with CISA BOD 22-01 and
// FedRAMP vulnerability-scanning timelines.
const DUE_DAYS = { critical: 15, high: 30, moderate: 90, low: 180 };
const PRIORITY = { critical: 'critical', high: 'high', moderate: 'medium', low: 'low' };

function failed(res, error, event) {
  log('error', event, { error: serializeError(error) });
  return res.status(500).json({ success: false, error: 'Internal server error' });
}

function cleanKey(body) {
  const component = typeof body.component === 'string' ? body.component.trim().slice(0, 50) : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 300) : '';
  return component && name ? { component, name } : null;
}

// GET /platform/dependencies -- latest report, summary and recent runs
router.get('/', async (req, res) => {
  try {
    const report = await tracker.latestReport();
    const runs = await pool.query(
      `SELECT id, trigger, status, started_at, finished_at, summary, errors
         FROM dependency_check_runs ORDER BY started_at DESC LIMIT 10`
    );
    res.json({
      success: true,
      data: {
        ...report,
        runs: runs.rows,
        schedule: {
          enabled: String(process.env.DEPENDENCY_CHECK_ENABLED || 'true').toLowerCase() !== 'false',
          interval_hours: Math.max(1, Number(process.env.DEPENDENCY_CHECK_INTERVAL_HOURS) || 24)
        }
      }
    });
  } catch (error) {
    return failed(res, error, 'dependencies.report_failed');
  }
});

// POST /platform/dependencies/check -- run a check now
router.post('/check', createRateLimiter({ label: 'dependency-check', windowMs: 60 * 60 * 1000, max: 12 }), async (req, res) => {
  try {
    const result = await tracker.runCheck({ trigger: 'manual', userId: req.user.id });
    if (result.busy) return res.status(409).json({ success: false, error: 'A dependency check is already running.' });
    await auditService.logFromRequest(req, {
      eventType: 'dependencies.check_run', resourceType: 'dependency_check', resourceId: result.id,
      details: { status: result.status, summary: result.summary }
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    return failed(res, error, 'dependencies.check_failed');
  }
});

// PUT /platform/dependencies/decision -- record what the team decided
router.put('/decision', async (req, res) => {
  try {
    const key = cleanKey(req.body || {});
    if (!key) return res.status(400).json({ success: false, error: 'component and name are required' });
    const status = req.body.status;
    if (!DECISIONS.includes(status)) return res.status(400).json({ success: false, error: `status must be one of: ${DECISIONS.join(', ')}` });
    const note = typeof req.body.note === 'string' ? req.body.note.slice(0, 2000) : null;
    if (status === 'accepted' && !note) {
      return res.status(400).json({ success: false, error: 'Accepting the risk requires a justification note' });
    }
    const snooze = status === 'snoozed' ? String(req.body.snooze_until || '') : null;
    if (status === 'snoozed' && !/^\d{4}-\d{2}-\d{2}$/.test(snooze)) {
      return res.status(400).json({ success: false, error: 'snooze_until (YYYY-MM-DD) is required to snooze' });
    }
    const target = typeof req.body.target_version === 'string' ? req.body.target_version.slice(0, 100) : null;
    const { rows } = await pool.query(
      `INSERT INTO dependency_decisions (component, name, status, note, target_version, snooze_until, decided_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (component, name) DO UPDATE SET
         status = EXCLUDED.status, note = EXCLUDED.note, target_version = EXCLUDED.target_version,
         snooze_until = EXCLUDED.snooze_until, decided_by = EXCLUDED.decided_by, updated_at = NOW()
       RETURNING *`,
      [key.component, key.name, status, note, target, snooze, req.user.id]
    );
    await auditService.logFromRequest(req, {
      eventType: 'dependencies.decision_recorded', resourceType: 'dependency', resourceId: null,
      details: { ...key, status, target_version: target, snooze_until: snooze }
    });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    return failed(res, error, 'dependencies.decision_failed');
  }
});

// POST /platform/dependencies/poam -- track an upgrade as a POA&M item in the
// operator's own organization (evidence for SI-2 / CM-3).
router.post('/poam', async (req, res) => {
  const client = await pool.connect();
  try {
    const key = cleanKey(req.body || {});
    if (!key) return res.status(400).json({ success: false, error: 'component and name are required' });
    const report = await tracker.latestReport();
    const finding = report.findings.find((f) => f.component === key.component && f.name === key.name);
    if (!finding) return res.status(404).json({ success: false, error: 'Dependency not found in the latest check' });
    if (finding.poam_item_id) return res.status(409).json({ success: false, error: 'A POA&M item already tracks this upgrade' });

    const endOfLife = finding.eol_date && new Date(finding.eol_date).getTime() < Date.now();
    const severity = finding.max_severity || (endOfLife ? 'high' : 'low');
    const due = new Date(Date.now() + DUE_DAYS[severity] * 86400000).toISOString().slice(0, 10);
    const target = finding.latest || 'a supported version';
    const reasons = [
      ...(finding.advisories || []).map((a) => `${a.severity}: ${a.title} (${a.url})`),
      endOfLife ? `End of life since ${new Date(finding.eol_date).toISOString().slice(0, 10)}` : null,
      finding.note
    ].filter(Boolean);

    await client.query('BEGIN');
    const { rows: [item] } = await client.query(
      `INSERT INTO poam_items (organization_id, title, description, source_type, status, priority, remediation_plan, due_date, created_by, owner_id)
       VALUES ($1, $2, $3, 'dependency_tracker', 'open', $4, $5, $6, $7, $7)
       RETURNING id, title, priority, due_date`,
      [
        req.user.organization_id,
        (finding.ecosystem === 'docker'
          ? `Update the ${finding.name.split(':')[0]} base image from ${finding.installed} to ${target}`
          : `Upgrade ${finding.name} (${finding.component}) from ${finding.installed || 'current'} to ${target}`).slice(0, 250),
        reasons.join('\n') || 'Newer version available.',
        PRIORITY[severity],
        `Upgrade to ${target}, run the test suite and the QA self-test, deploy, and confirm the next dependency check no longer reports it.`,
        due,
        req.user.id
      ]
    );
    await client.query(
      `INSERT INTO dependency_decisions (component, name, status, target_version, poam_item_id, decided_by, updated_at)
       VALUES ($1, $2, 'planned', $3, $4, $5, NOW())
       ON CONFLICT (component, name) DO UPDATE SET status = 'planned', target_version = EXCLUDED.target_version,
         poam_item_id = EXCLUDED.poam_item_id, decided_by = EXCLUDED.decided_by, updated_at = NOW()`,
      [key.component, key.name, finding.latest, item.id, req.user.id]
    );
    await client.query('COMMIT');
    await auditService.logFromRequest(req, {
      eventType: 'dependencies.poam_created', resourceType: 'poam_item', resourceId: item.id,
      details: { ...key, severity, due_date: due }
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return failed(res, error, 'dependencies.poam_failed');
  } finally {
    client.release();
  }
});

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

// GET /platform/dependencies/export -- CSV of the latest check (CM-8 inventory)
router.get('/export', async (req, res) => {
  try {
    const { run, findings } = await tracker.latestReport();
    const header = ['Component', 'Ecosystem', 'Name', 'Direct', 'Installed', 'Declared range', 'Latest', 'Update', 'Severity', 'Advisories', 'End of life', 'Decision', 'Note'];
    const rows = findings.map((f) => [
      f.component, f.ecosystem, f.name, f.direct ? 'yes' : 'no', f.installed, f.wanted, f.latest, f.update_type,
      f.max_severity, (f.advisories || []).map((a) => a.url).join(' '),
      f.eol_date ? new Date(f.eol_date).toISOString().slice(0, 10) : '', f.decision_status, f.decision_note || f.note
    ]);
    const stamp = run ? new Date(run.started_at).toISOString().slice(0, 10) : 'none';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="controlweave-dependencies-${stamp}.csv"`);
    res.send([header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n'));
  } catch (error) {
    return failed(res, error, 'dependencies.export_failed');
  }
});

module.exports = router;
