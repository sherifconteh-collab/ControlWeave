'use strict';

/**
 * Runs the dependency check on a schedule (default every 24 hours, first run
 * five minutes after startup). DEPENDENCY_CHECK_ENABLED=false turns it off,
 * for example on air-gapped installs; checks can still be run on demand.
 * Multi-replica safe: runCheck takes an advisory lock and skips when busy.
 */

const pool = require('../config/database');
const { runCheck } = require('./dependencyTracker');
const { log, serializeError } = require('../utils/logger');

function startDependencyScheduler() {
  if (String(process.env.DEPENDENCY_CHECK_ENABLED || 'true').toLowerCase() === 'false' || !pool.isConfigured) {
    log('info', 'dependencies.scheduler.disabled');
    return () => {};
  }
  const hours = Math.max(1, Number(process.env.DEPENDENCY_CHECK_INTERVAL_HOURS) || 24);
  const run = () => runCheck({ trigger: 'scheduled' })
    .catch((error) => log('warn', 'dependencies.scheduled_check_failed', { error: serializeError(error) }));
  const first = setTimeout(run, 5 * 60 * 1000);
  const interval = setInterval(run, hours * 60 * 60 * 1000);
  first.unref();
  interval.unref();
  log('info', 'dependencies.scheduler.started', { intervalHours: hours });
  return () => {
    clearTimeout(first);
    clearInterval(interval);
  };
}

module.exports = { startDependencyScheduler };
