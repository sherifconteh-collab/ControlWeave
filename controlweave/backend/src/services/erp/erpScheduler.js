'use strict';

/**
 * Runs scheduled ERP syncs (syncService.runSync with trigger 'scheduled') for
 * systems whose next_sync_at has passed. Checks every ten minutes; one
 * replica does the work per tick (advisory lock) and each system has its own
 * run lock. Organizations that no longer hold the ERP Governance add-on are
 * skipped (their schedule stays, and resumes when the add-on is back).
 * ERP_SCHEDULER_ENABLED=false turns it off.
 */

const pool = require('../../config/database');
const entitlements = require('../entitlementService');
const syncService = require('./syncService');
const { log, serializeError } = require('../../utils/logger');

const TICK_MS = 10 * 60 * 1000;
const BATCH = 20;

async function tick() {
  const lockClient = await pool.connect();
  try {
    const { rows: [lock] } = await lockClient.query("SELECT pg_try_advisory_lock(hashtext('erp-scheduler')) AS ok");
    if (!lock.ok) return { skipped: true };
    const { rows: due } = await pool.query(
      `SELECT id, organization_id FROM erp_systems
        WHERE sync_schedule <> 'manual' AND next_sync_at IS NOT NULL AND next_sync_at <= NOW()
        ORDER BY next_sync_at LIMIT ${BATCH}`
    );
    let ran = 0;
    for (const system of due) {
      if (!(await entitlements.hasFeature(system.organization_id, 'erp_governance'))) {
        // Check again in a day rather than every tick.
        await pool.query("UPDATE erp_systems SET next_sync_at = NOW() + INTERVAL '1 day' WHERE id = $1", [system.id]);
        continue;
      }
      try {
        const run = await syncService.runSync(system.organization_id, system.id, { trigger: 'scheduled' });
        if (!run.busy) ran += 1;
      } catch (error) {
        log('warn', 'erp.scheduled_sync_failed', { systemId: system.id, error: serializeError(error) });
      }
    }
    return { due: due.length, ran };
  } finally {
    await lockClient.query("SELECT pg_advisory_unlock(hashtext('erp-scheduler'))").catch(() => {});
    lockClient.release();
  }
}

function startErpScheduler() {
  if (String(process.env.ERP_SCHEDULER_ENABLED || 'true').toLowerCase() === 'false' || !pool.isConfigured) {
    log('info', 'erp.scheduler.disabled');
    return () => {};
  }
  const run = () => tick().catch((error) => log('warn', 'erp.scheduler_tick_failed', { error: serializeError(error) }));
  const first = setTimeout(run, 2 * 60 * 1000);
  const interval = setInterval(run, TICK_MS);
  first.unref();
  interval.unref();
  log('info', 'erp.scheduler.started', { tickMinutes: TICK_MS / 60000 });
  return () => {
    clearTimeout(first);
    clearInterval(interval);
  };
}

module.exports = { startErpScheduler, tick };
