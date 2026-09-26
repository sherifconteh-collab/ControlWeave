'use strict';

/**
 * Microsoft Entra ID connector. Uses an app registration with the
 * client-credentials flow and these Microsoft Graph application permissions
 * (admin consent required): User.Read.All, AuditLog.Read.All (sign-in activity
 * and MFA registration details; needs Entra ID P1 or P2).
 *
 * Config: { tenantId, clientId, clientSecret, inactiveDays?, maxUsers? }
 */

const { requestJson } = require('./http');
const { assessIdentities } = require('./identityFindings');

const GRAPH = 'https://graph.microsoft.com/v1.0';
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getToken(config) {
  const tenant = String(config.tenantId || '').trim();
  if (!GUID.test(tenant) && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(tenant)) throw new Error('Entra tenant ID is required');
  if (!config.clientId || !config.clientSecret) throw new Error('Entra client ID and client secret are required');
  const response = await requestJson(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    form: {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    }
  });
  return response.data.access_token;
}

async function pageAll(url, headers, max) {
  const rows = [];
  let next = url;
  while (next && rows.length < max) {
    const response = await requestJson(next, { headers });
    rows.push(...((response.data && response.data.value) || []));
    const link = response.data && response.data['@odata.nextLink'];
    next = link && link.startsWith(GRAPH) ? link : null;
  }
  return rows.slice(0, max);
}

async function listUsers(headers, max) {
  const select = 'id,userPrincipalName,accountEnabled,createdDateTime,userType';
  try {
    return { users: await pageAll(`${GRAPH}/users?$top=999&$select=${select},signInActivity`, headers, max), signInVisible: true };
  } catch (error) {
    // signInActivity needs AuditLog.Read.All and a P1 license; fall back without it.
    if (error.status !== 403 && error.status !== 400) throw error;
    return { users: await pageAll(`${GRAPH}/users?$top=999&$select=${select}`, headers, max), signInVisible: false };
  }
}

async function listRegistration(headers, max) {
  try {
    const rows = await pageAll(`${GRAPH}/reports/authenticationMethods/userRegistrationDetails?$top=999`, headers, max);
    return new Map(rows.map((row) => [row.id, row]));
  } catch (error) {
    if (error.status === 403 || error.status === 400) return null;
    throw error;
  }
}

async function syncFindings(config) {
  const token = await getToken(config);
  const headers = { Authorization: `Bearer ${token}` };
  const max = Math.min(50000, Math.max(1, Number(config.maxUsers) || 20000));
  const [{ users: rawUsers, signInVisible }, registration] = await Promise.all([listUsers(headers, max), listRegistration(headers, max)]);
  const users = rawUsers
    .filter((user) => user.userType !== 'Guest' || config.includeGuests)
    .map((user) => {
      const reg = registration ? registration.get(user.id) : null;
      const activity = user.signInActivity || {};
      return {
        id: user.id,
        login: user.userPrincipalName,
        enabled: user.accountEnabled !== false,
        isAdmin: Boolean(reg && reg.isAdmin),
        mfaRegistered: reg ? Boolean(reg.isMfaRegistered) : null,
        lastLoginAt: signInVisible ? (activity.lastSuccessfulSignInDateTime || activity.lastSignInDateTime || null) : null,
        createdAt: signInVisible ? user.createdDateTime : null
      };
    });
  const { findings, metrics } = assessIdentities(users, { inactiveDays: Number(config.inactiveDays) || 90 });
  return {
    findings,
    metrics: { ...metrics, sign_in_activity_visible: signInVisible, mfa_registration_visible: registration !== null, truncated: rawUsers.length >= max }
  };
}

module.exports = { syncFindings };
