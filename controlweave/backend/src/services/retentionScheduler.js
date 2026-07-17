// @tier: community
// Periodic sweep that actually runs evidence retention cleanup. Without
// this, jobService.runRetentionCleanup() existed and was correct, but the
// only caller was the manual POST /ops/retention/run endpoint -- nothing
// ever invoked it on its own, so the "retention enforcement" claim depended
// on an operator remembering to hit that endpoint. Modeled on
// services/reminderService.js's setInterval sweep pattern.
const pool = require('../config/database');
const { log } = require('../utils/logger');
const { runRetentionCleanup } = require('./jobService');

let schedulerHandle = null;

async function runRetentionSweep() {
  try {
    const orgsWithPolicy = await pool.query(
      `SELECT DISTINCT organization_id
         FROM data_retention_policies
        WHERE active = true
          AND auto_enforce = true
          AND resource_type = 'evidence'`
    );

    let totalRemoved = 0;
    for (const row of orgsWithPolicy.rows) {
      try {
        const result = await runRetentionCleanup({ organizationId: row.organization_id });
        totalRemoved += result.removed || 0;
      } catch (error) {
        log('error', 'retention.sweep.org_failed', {
          organizationId: row.organization_id,
          error: error.message
        });
      }
    }

    if (orgsWithPolicy.rows.length > 0) {
      log('info', 'retention.sweep.completed', {
        organizations: orgsWithPolicy.rows.length,
        removed: totalRemoved
      });
    }
  } catch (error) {
    log('error', 'retention.sweep.failed', { error: error.message });
  }
}

function startRetentionScheduler() {
  const enabled = (process.env.ENABLE_RETENTION_ENFORCEMENT || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    log('info', 'retention.scheduler.disabled');
    return () => {};
  }

  if (!pool.isConfigured) {
    log('info', 'retention.scheduler.skipped', { reason: 'database_not_configured' });
    return () => {};
  }

  const parsedInterval = Number(process.env.RETENTION_SWEEP_INTERVAL_HOURS);
  const intervalHours = Number.isFinite(parsedInterval) ? Math.max(1, parsedInterval) : 24;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  runRetentionSweep();
  schedulerHandle = setInterval(runRetentionSweep, intervalMs);

  log('info', 'retention.scheduler.started', { intervalHours });

  return () => {
    if (schedulerHandle) {
      clearInterval(schedulerHandle);
      schedulerHandle = null;
      log('info', 'retention.scheduler.stopped');
    }
  };
}

module.exports = {
  startRetentionScheduler,
  runRetentionSweep
};
