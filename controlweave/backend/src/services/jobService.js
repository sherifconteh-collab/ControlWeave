const fs = require('fs');
const pool = require('../config/database');
const { processPendingWebhookDeliveries } = require('./webhookService');

async function enqueueJob({ organizationId = null, jobType, payload = {}, createdBy = null, runAfter = null }) {
  const result = await pool.query(
    `INSERT INTO platform_jobs (
       organization_id, job_type, payload, status, run_after, created_by
     )
     VALUES ($1, $2, $3::jsonb, 'queued', COALESCE($4, NOW()), $5)
     RETURNING *`,
    [organizationId, jobType, JSON.stringify(payload || {}), runAfter, createdBy]
  );
  return result.rows[0];
}

async function runRetentionCleanup({ organizationId }) {
  const policyResult = await pool.query(
    `SELECT id, retention_days
     FROM data_retention_policies
     WHERE organization_id = $1
       AND active = true
       AND auto_enforce = true
       AND resource_type = 'evidence'
     ORDER BY retention_days ASC`,
    [organizationId]
  );

  if (policyResult.rows.length === 0) {
    return { removed: 0, skipped: 0, reason: 'No active evidence retention policy.' };
  }

  const strictestDays = Math.min(...policyResult.rows.map((p) => Number(p.retention_days || 365)));

  const candidates = await pool.query(
    `SELECT e.id, e.file_path
     FROM evidence e
     WHERE e.organization_id = $1
       AND (
         e.retention_until < CURRENT_DATE
         OR e.created_at < NOW() - ($2 || ' days')::interval
       )`,
    [organizationId, String(strictestDays)]
  );

  let removed = 0;
  let skipped = 0;

  for (const row of candidates.rows) {
    const holdResult = await pool.query(
      `SELECT 1
       FROM legal_holds
       WHERE organization_id = $1
         AND active = true
         AND resource_type = 'evidence'
         AND (resource_id IS NULL OR resource_id = $2)
       LIMIT 1`,
      [organizationId, row.id]
    );

    if (holdResult.rows.length > 0) {
      skipped += 1;
      continue;
    }

    await pool.query(
      `DELETE FROM evidence
       WHERE organization_id = $1 AND id = $2`,
      [organizationId, row.id]
    );

    if (row.file_path && fs.existsSync(row.file_path)) {
      try {
        fs.unlinkSync(row.file_path);
      } catch (error) {
        // Ignore file delete errors, DB record is removed.
      }
    }

    removed += 1;
  }

  return { removed, skipped, policy_days: strictestDays };
}

async function runJob(jobRow) {
  const payload = jobRow.payload || {};
  switch (jobRow.job_type) {
    case 'webhook_flush':
      return processPendingWebhookDeliveries({
        organizationId: jobRow.organization_id || payload.organizationId || null,
        limit: payload.limit || 50
      });
    case 'retention_cleanup':
      if (!jobRow.organization_id) {
        return { removed: 0, skipped: 0, reason: 'No organization_id on job.' };
      }
      return runRetentionCleanup({ organizationId: jobRow.organization_id });
    case 'integration_sync':
      return { synced: true, connector_id: payload.connectorId || null, mode: payload.mode || 'manual' };
    default:
      return { noop: true, reason: `Unsupported job type: ${jobRow.job_type}` };
  }
}

async function processPendingJobs({ organizationId = null, limit = 20 } = {}) {
  const boundedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const params = [];
  let where = `
    status = 'queued'
    AND run_after <= NOW()
  `;

  if (organizationId) {
    params.push(organizationId);
    where += ` AND organization_id = $${params.length}`;
  }

  params.push(boundedLimit);

  const jobsResult = await pool.query(
    `SELECT *
     FROM platform_jobs
     WHERE ${where}
     ORDER BY created_at ASC
     LIMIT $${params.length}`,
    params
  );

  let completed = 0;
  let failed = 0;
  const details = [];

  for (const job of jobsResult.rows) {
    await pool.query(
      `UPDATE platform_jobs
       SET status = 'running',
           attempts = attempts + 1,
           started_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [job.id]
    );

    try {
      const result = await runJob(job);
      await pool.query(
        `UPDATE platform_jobs
         SET status = 'completed',
             result = $2::jsonb,
             finished_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [job.id, JSON.stringify(result || {})]
      );
      completed += 1;
      details.push({ id: job.id, status: 'completed', result });
    } catch (error) {
      const maxAttempts = Number(job.max_attempts || 5);
      const nextStatus = Number(job.attempts || 0) + 1 >= maxAttempts ? 'failed' : 'queued';
      await pool.query(
        `UPDATE platform_jobs
         SET status = $2,
             error_message = $3,
             run_after = CASE WHEN $2 = 'queued' THEN NOW() + interval '5 minutes' ELSE run_after END,
             finished_at = CASE WHEN $2 = 'failed' THEN NOW() ELSE NULL END,
             updated_at = NOW()
         WHERE id = $1`,
        [job.id, nextStatus, String(error.message || error).slice(0, 2000)]
      );
      failed += 1;
      details.push({ id: job.id, status: nextStatus, error: error.message });
    }
  }

  return {
    attempted: jobsResult.rows.length,
    completed,
    failed,
    details
  };
}

module.exports = {
  enqueueJob,
  processPendingJobs,
  runRetentionCleanup
};
