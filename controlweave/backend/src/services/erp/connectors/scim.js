'use strict';

/**
 * SCIM 2.0 (RFC 7643/7644) identity extract. Covers ERPs whose users and
 * role memberships are exposed through SCIM:
 *   Oracle Fusion Cloud ERP  https://<host>/hcmRestApi/scim
 *   SAP Cloud Identity Services (S/4HANA Cloud, BTP)
 *                            https://<tenant>.accounts.ondemand.com/service/scim
 *
 * Users come from /Users (paged with startIndex/count). A user's roles come
 * from its `roles` and `groups` attributes; when no user carries either, the
 * connector reads /Roles and /Groups and uses their `members`.
 *
 * Settings: baseUrl, and either token (bearer) or username + password (basic).
 */

const { requestJson } = require('../../connectors/http');
const { text, status, basicAuth, requireSettings } = require('./shared');

const PAGE_SIZE = 200;
const MAX_RESOURCES = 200000;
const ENTERPRISE = 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User';

function base(config) {
  const url = String(config.baseUrl || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) throw new Error('The SCIM base URL must start with https://');
  return url;
}

function headers(config) {
  if (config.token) return { Authorization: `Bearer ${config.token}`, Accept: 'application/scim+json, application/json' };
  if (config.username && config.password) return { Authorization: basicAuth(config.username, config.password), Accept: 'application/scim+json, application/json' };
  throw new Error('Set a bearer token, or a username and password, for the SCIM endpoint');
}

/**
 * Every resource of a type, following SCIM paging. Returns
 * { resources, total, complete, reason }, or null when the endpoint does not
 * exist. `complete` is false when the server stopped short of the
 * totalResults it reported, or the type exceeds MAX_RESOURCES: the sync must
 * not treat a partial list as the full set of users.
 */
async function listAll(config, resource, { optional = false } = {}) {
  const out = [];
  let startIndex = 1;
  let total = null;
  for (;;) {
    const url = `${base(config)}/${resource}?startIndex=${startIndex}&count=${PAGE_SIZE}`;
    let data;
    try {
      ({ data } = await requestJson(url, { headers: headers(config), timeoutMs: 60000 }));
    } catch (error) {
      if (optional && (error.status === 404 || error.status === 400 || error.status === 501)) return null;
      throw error;
    }
    const page = Array.isArray(data && data.Resources) ? data.Resources : [];
    if (data && data.totalResults !== undefined && Number.isFinite(Number(data.totalResults))) total = Number(data.totalResults);
    out.push(...page);
    if (out.length > MAX_RESOURCES) {
      return { resources: out.slice(0, MAX_RESOURCES), total, complete: false, reason: `more than ${MAX_RESOURCES} ${resource}` };
    }
    if (!page.length) {
      const short = total !== null && out.length < total;
      return { resources: out, total, complete: !short, reason: short ? `the server reported ${total} ${resource} but returned ${out.length}` : null };
    }
    if (total !== null && out.length >= total) return { resources: out, total, complete: true, reason: null };
    startIndex += page.length;
  }
}

function fullName(user) {
  if (user.displayName) return text(user.displayName);
  const name = user.name || {};
  return text(name.formatted) || [text(name.givenName), text(name.familyName)].filter(Boolean).join(' ');
}

function primaryEmail(user) {
  const emails = Array.isArray(user.emails) ? user.emails : [];
  const primary = emails.find((e) => e && e.primary) || emails[0];
  return primary ? text(primary.value) : '';
}

function userRow(user) {
  const enterprise = user[ENTERPRISE] || {};
  return {
    username: text(user.userName),
    full_name: fullName(user),
    email: primaryEmail(user),
    department: text(enterprise.department),
    manager: text(enterprise.manager && (enterprise.manager.displayName || enterprise.manager.value)),
    status: status(user.active)
  };
}

async function fetchExtract(config) {
  requireSettings(config, ['baseUrl']);
  const listed = await listAll(config, 'Users');
  const users = listed.resources;
  const incomplete = listed.complete ? [] : [listed.reason];
  const byId = new Map();
  const userRows = [];
  const assignments = [];
  for (const user of users) {
    const row = userRow(user);
    if (!row.username) continue;
    byId.set(String(user.id), row.username);
    userRows.push(row);
    for (const entry of [...(Array.isArray(user.roles) ? user.roles : []), ...(Array.isArray(user.groups) ? user.groups : [])]) {
      const role = text(entry && (entry.display || entry.value));
      if (role) assignments.push({ username: row.username, role_name: role });
    }
  }
  if (!assignments.length) {
    for (const resource of ['Roles', 'Groups']) {
      const groups = await listAll(config, resource, { optional: true });
      if (groups && !groups.complete) incomplete.push(groups.reason);
      for (const group of groups ? groups.resources : []) {
        const role = text(group.displayName || group.id);
        for (const member of Array.isArray(group.members) ? group.members : []) {
          const username = byId.get(String(member && member.value));
          if (role && username) assignments.push({ username, role_name: role });
        }
      }
    }
  }
  return {
    users: userRows,
    assignments,
    complete: incomplete.length === 0,
    total: { users: listed.total },
    incompleteReason: incomplete.join('; ') || null
  };
}

module.exports = { fetchExtract, userRow, listAll };
