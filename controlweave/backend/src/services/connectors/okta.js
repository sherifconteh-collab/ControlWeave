'use strict';

/**
 * Okta connector. Reads users, their enrolled MFA factors and administrator
 * role assignments through the Okta Management API using a read-only API
 * token (an administrator with the Read-Only Administrator role is enough).
 *
 * Config: { domain: 'acme.okta.com', apiToken, inactiveDays?, maxUsers? }
 */

const { requestJson, mapLimit } = require('./http');
const { assessIdentities } = require('./identityFindings');

function baseUrl(domain) {
  const host = String(domain || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/^[a-z0-9.-]+(:\d{2,5})?$/i.test(host)) throw new Error('Okta domain is required (for example acme.okta.com)');
  return `https://${host}`;
}

function nextLink(headers) {
  const link = headers.get('link') || '';
  const match = link.split(',').find((part) => /rel="next"/.test(part));
  return match ? match.slice(match.indexOf('<') + 1, match.indexOf('>')) : null;
}

async function listUsers(base, headers, maxUsers) {
  const users = [];
  let url = `${base}/api/v1/users?limit=200&filter=${encodeURIComponent('status eq "ACTIVE" or status eq "PASSWORD_EXPIRED" or status eq "LOCKED_OUT" or status eq "RECOVERY"')}`;
  while (url && users.length < maxUsers) {
    const response = await requestJson(url, { headers });
    users.push(...(response.data || []));
    const next = nextLink(response.headers);
    url = next && next.startsWith(base) ? next : null;
  }
  return users.slice(0, maxUsers);
}

async function listAdminIds(base, headers) {
  try {
    const ids = new Set();
    let url = `${base}/api/v1/iam/assignees/users?limit=200`;
    while (url) {
      const response = await requestJson(url, { headers });
      const rows = (response.data && response.data.value) || [];
      rows.forEach((row) => ids.add(row.id));
      const next = response.data && response.data._links && response.data._links.next && response.data._links.next.href;
      url = next && next.startsWith(base) ? next : null;
    }
    return ids;
  } catch (error) {
    if (error.status === 403 || error.status === 404) return null;
    throw error;
  }
}

async function syncFindings(config) {
  if (!config.apiToken) throw new Error('Okta API token is required');
  const base = baseUrl(config.domain);
  const headers = { Authorization: `SSWS ${config.apiToken}` };
  const maxUsers = Math.min(20000, Math.max(1, Number(config.maxUsers) || 5000));
  const [rawUsers, adminIds] = await Promise.all([listUsers(base, headers, maxUsers), listAdminIds(base, headers)]);
  const factorCounts = await mapLimit(rawUsers, 5, async (user) => {
    const response = await requestJson(`${base}/api/v1/users/${encodeURIComponent(user.id)}/factors`, { headers });
    return (response.data || []).filter((f) => f.status === 'ACTIVE' && f.factorType !== 'password').length;
  });
  const users = rawUsers.map((user, index) => ({
    id: user.id,
    login: (user.profile && user.profile.login) || user.id,
    enabled: user.status !== 'SUSPENDED' && user.status !== 'DEPROVISIONED',
    isAdmin: adminIds ? adminIds.has(user.id) : false,
    mfaRegistered: factorCounts[index] > 0,
    lastLoginAt: user.lastLogin,
    createdAt: user.created
  }));
  const { findings, metrics } = assessIdentities(users, { inactiveDays: Number(config.inactiveDays) || 90 });
  return {
    findings,
    metrics: { ...metrics, admin_roles_visible: adminIds !== null, truncated: rawUsers.length >= maxUsers }
  };
}

module.exports = { syncFindings };
