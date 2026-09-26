'use strict';

const { invalidateCachedPattern } = require('./redisCache');

/**
 * Drop an organization's cached dashboard aggregates (routes/dashboard.js,
 * 30s TTL when Redis is configured) so a control status change shows up on
 * the dashboard immediately instead of after the TTL expires.
 */
function invalidateDashboardCache(organizationId) {
  if (!organizationId) return Promise.resolve();
  return invalidateCachedPattern(`cw:dashboard:${organizationId}:*`).catch(() => {});
}

module.exports = { invalidateDashboardCache };
