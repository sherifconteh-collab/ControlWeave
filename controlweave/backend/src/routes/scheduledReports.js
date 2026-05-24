const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { enqueueJob } = require('../services/jobService');
const { log } = require('../utils/logger');

router.use(authenticate);

function nextRunAt(schedule) {
  const now = new Date();
  switch (schedule) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'monthly': {
      const d = new Date(now);
      d.setMonth(d.getMonth() + 1);
      return d;
    }
    case 'quarterly': {
      const d = new Date(now);
      d.setMonth(d.getMonth() + 3);
      return d;
    }
    default:
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}

// GET /api/v1/reports/scheduled
router.get('/', requirePermission('reports.read'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sr.*, u.email AS created_by_email
         FROM scheduled_reports sr
         LEFT JOIN users u ON u.id = sr.created_by
        WHERE sr.organization_id = $1
        ORDER BY sr.created_at DESC`,
      [req.user.organization_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    log('error', 'scheduled_reports.list_failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/reports/scheduled
router.post('/', requirePermission('reports.read'), async (req, res) => {
  const { name, report_type, schedule, format = 'pdf', recipients = [], filters = {} } = req.body;
  const validTypes = ['compliance_summary', 'framework_gap', 'evidence_status', 'audit_trail', 'executive'];
  const validSchedules = ['daily', 'weekly', 'monthly', 'quarterly'];
  const validFormats = ['pdf', 'csv', 'json'];
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!validTypes.includes(report_type)) {
    return res.status(400).json({ error: `report_type must be one of: ${validTypes.join(', ')}` });
  }
  if (!validSchedules.includes(schedule)) {
    return res.status(400).json({ error: `schedule must be one of: ${validSchedules.join(', ')}` });
  }
  if (!validFormats.includes(format)) {
    return res.status(400).json({ error: `format must be one of: ${validFormats.join(', ')}` });
  }
  try {
    const result = await pool.query(
      `INSERT INTO scheduled_reports
         (organization_id, name, report_type, schedule, format, recipients, filters, next_run_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.organization_id, name.trim(), report_type, schedule, format,
       JSON.stringify(recipients), JSON.stringify(filters), nextRunAt(schedule), req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    log('error', 'scheduled_reports.create_failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/reports/scheduled/:id
router.put('/:id', requirePermission('reports.read'), async (req, res) => {
  const { name, schedule, format, recipients, filters, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE scheduled_reports
          SET name = COALESCE($3, name),
              schedule = COALESCE($4, schedule),
              format = COALESCE($5, format),
              recipients = COALESCE($6::jsonb, recipients),
              filters = COALESCE($7::jsonb, filters),
              is_active = COALESCE($8, is_active),
              next_run_at = CASE WHEN $4 IS NOT NULL THEN $9 ELSE next_run_at END,
              updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING *`,
      [req.params.id, req.user.organization_id,
       name || null, schedule || null, format || null,
       recipients ? JSON.stringify(recipients) : null,
       filters ? JSON.stringify(filters) : null,
       is_active !== undefined ? is_active : null,
       schedule ? nextRunAt(schedule) : null]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled report not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    log('error', 'scheduled_reports.update_failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/reports/scheduled/:id
router.delete('/:id', requirePermission('reports.read'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM scheduled_reports WHERE id = $1 AND organization_id = $2 RETURNING id',
      [req.params.id, req.user.organization_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled report not found' });
    }
    res.json({ success: true });
  } catch (error) {
    log('error', 'scheduled_reports.delete_failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/reports/scheduled/:id/run — trigger manual run
router.post('/:id/run', requirePermission('reports.read'), async (req, res) => {
  try {
    const check = await pool.query(
      'SELECT id FROM scheduled_reports WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.user.organization_id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled report not found' });
    }
    await enqueueJob({
      organizationId: req.user.organization_id,
      jobType: 'scheduled_report_run',
      payload: { scheduledReportId: req.params.id },
      createdBy: req.user.id
    });
    res.json({ success: true, message: 'Report queued for delivery' });
  } catch (error) {
    log('error', 'scheduled_reports.run_failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
