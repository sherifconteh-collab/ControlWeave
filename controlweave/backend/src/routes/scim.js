'use strict';

/**
 * SCIM 2.0 user provisioning (RFC 7643 / 7644) for Okta, Microsoft Entra ID
 * and other identity providers, plus management of the bearer tokens they use.
 *
 *   /api/v1/scim/v2/...     SCIM endpoints, authenticated by a SCIM token
 *   /api/v1/scim/tokens     token management (settings.manage)
 *
 * Deprovisioning (active=false or DELETE) deactivates the user and ends their
 * sessions immediately; records they created stay for the audit trail.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const pool = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { isUuid } = require('../middleware/validate');
const auditService = require('../services/auditService');
const { encrypt, decrypt, hashForLookup, hashToken } = require('../utils/encrypt');
const { log, serializeError } = require('../utils/logger');
const { requireFeature, assertSeatAvailable } = require('../services/entitlementService');

router.use(rateLimit({ windowMs: 60 * 1000, max: 600 }));

const USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
const LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
const ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
const PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';
const PROVISIONABLE_ROLES = new Set(['user', 'auditor', 'analyst', 'viewer']);

// ─── Token management (org admins) ──────────────────────────────────────────

router.get('/tokens', authenticate, requirePermission('settings.manage'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, token_prefix, created_at, last_used_at, revoked_at
         FROM scim_tokens WHERE organization_id = $1 ORDER BY created_at DESC`,
      [req.user.organization_id]
    );
    res.json({ success: true, data: { tokens: rows, base_url: `${(process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/+$/, '')}/api/v1/scim/v2` } });
  } catch (error) {
    log('error', 'scim.tokens_list_failed', { error: serializeError(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/tokens', authenticate, requirePermission('settings.manage'), requireFeature('scim'), async (req, res) => {
  try {
    const name = String((req.body && req.body.name) || '').trim().slice(0, 100) || 'SCIM token';
    const token = `scim_${crypto.randomBytes(32).toString('base64url')}`;
    const { rows } = await pool.query(
      `INSERT INTO scim_tokens (organization_id, name, token_hash, token_prefix, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, token_prefix, created_at`,
      [req.user.organization_id, name, hashToken(token), token.slice(0, 10), req.user.id]
    );
    await auditService.logFromRequest(req, {
      eventType: 'scim.token_created', resourceType: 'scim_token', resourceId: rows[0].id, details: { name }
    });
    // The token is shown once; only its hash is stored.
    res.status(201).json({ success: true, data: { ...rows[0], token } });
  } catch (error) {
    log('error', 'scim.token_create_failed', { error: serializeError(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/tokens/:id', authenticate, requirePermission('settings.manage'), async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid token id' });
    const { rows } = await pool.query(
      `UPDATE scim_tokens SET revoked_at = NOW()
        WHERE organization_id = $1 AND id = $2 AND revoked_at IS NULL RETURNING id`,
      [req.user.organization_id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Token not found' });
    await auditService.logFromRequest(req, { eventType: 'scim.token_revoked', resourceType: 'scim_token', resourceId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    log('error', 'scim.token_revoke_failed', { error: serializeError(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── SCIM protocol ──────────────────────────────────────────────────────────

const scim = express.Router();
router.use('/v2', scim);

scim.use(express.json({ type: ['application/json', 'application/scim+json'], limit: '1mb' }));

function scimError(res, status, detail, scimType) {
  return res.status(status).type('application/scim+json').json({
    schemas: [ERROR_SCHEMA], status: String(status), detail, ...(scimType ? { scimType } : {})
  });
}

async function scimAuth(req, res, next) {
  try {
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return scimError(res, 401, 'Bearer token required');
    const { rows } = await pool.query(
      `UPDATE scim_tokens SET last_used_at = NOW()
        WHERE token_hash = $1 AND revoked_at IS NULL
        RETURNING id, organization_id, created_by`,
      [hashToken(token)]
    );
    if (!rows.length) return scimError(res, 401, 'Invalid or revoked token');
    req.scim = { organizationId: rows[0].organization_id, tokenId: rows[0].id, actorId: rows[0].created_by };
    return next();
  } catch (error) {
    log('error', 'scim.auth_failed', { error: serializeError(error) });
    return scimError(res, 500, 'Internal server error');
  }
}
scim.use(scimAuth);
scim.use(requireFeature('scim'));

function baseUrl(req) {
  return `${(process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '')}/api/v1/scim/v2`;
}

function toScimUser(req, row) {
  const email = row.email ? decrypt(row.email) : null;
  return {
    schemas: [USER_SCHEMA],
    id: row.id,
    externalId: row.scim_external_id || undefined,
    userName: email,
    name: { givenName: row.first_name || '', familyName: row.last_name || '', formatted: `${row.first_name || ''} ${row.last_name || ''}`.trim() },
    displayName: `${row.first_name || ''} ${row.last_name || ''}`.trim() || email,
    emails: email ? [{ value: email, type: 'work', primary: true }] : [],
    active: row.is_active,
    meta: {
      resourceType: 'User',
      created: row.created_at,
      lastModified: row.updated_at || row.created_at,
      location: `${baseUrl(req)}/Users/${row.id}`
    }
  };
}

const USER_COLUMNS = 'id, email, first_name, last_name, is_active, scim_external_id, created_at, updated_at';

async function findUser(orgId, id) {
  if (!isUuid(id)) return null;
  const { rows } = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE organization_id = $1 AND id = $2`, [orgId, id]);
  return rows[0] || null;
}

// Supported filters: userName eq "x", externalId eq "x", emails[...] eq "x".
function parseFilter(filter) {
  if (!filter) return null;
  const match = /^\s*(userName|externalId|emails(?:\.value|\[type eq "work"\]\.value)?)\s+eq\s+"([^"]*)"\s*$/i.exec(String(filter));
  if (!match) return { unsupported: true };
  return { attribute: match[1].toLowerCase().startsWith('externalid') ? 'externalId' : 'userName', value: match[2] };
}

scim.get('/ServiceProviderConfig', (req, res) => {
  res.type('application/scim+json').json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [{ type: 'oauthbearertoken', name: 'OAuth Bearer Token', description: 'SCIM token created in ControlWeave settings', primary: true }]
  });
});

scim.get('/ResourceTypes', (req, res) => {
  res.type('application/scim+json').json({
    schemas: [LIST_SCHEMA], totalResults: 1, itemsPerPage: 1, startIndex: 1,
    Resources: [{ schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'], id: 'User', name: 'User', endpoint: '/Users', schema: USER_SCHEMA }]
  });
});

scim.get('/Schemas', (req, res) => {
  res.type('application/scim+json').json({
    schemas: [LIST_SCHEMA], totalResults: 1, itemsPerPage: 1, startIndex: 1,
    Resources: [{ id: USER_SCHEMA, name: 'User', attributes: ['userName', 'name', 'displayName', 'emails', 'active', 'externalId'].map((name) => ({ name })) }]
  });
});

scim.get('/Users', async (req, res) => {
  try {
    const orgId = req.scim.organizationId;
    const startIndex = Math.max(1, parseInt(req.query.startIndex, 10) || 1);
    const count = Math.min(200, Math.max(0, parseInt(req.query.count, 10) || 100));
    const filter = parseFilter(req.query.filter);
    if (filter && filter.unsupported) return scimError(res, 400, 'Unsupported filter', 'invalidFilter');
    let where = 'organization_id = $1';
    const params = [orgId];
    if (filter && filter.attribute === 'userName') {
      params.push(hashForLookup(filter.value.toLowerCase()));
      where += ` AND email_hash = $${params.length}`;
    } else if (filter) {
      params.push(filter.value);
      where += ` AND scim_external_id = $${params.length}`;
    }
    const total = await pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE ${where}`, params);
    const { rows } = await pool.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE ${where} ORDER BY created_at, id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, count, startIndex - 1]
    );
    res.type('application/scim+json').json({
      schemas: [LIST_SCHEMA], totalResults: total.rows[0].n, itemsPerPage: rows.length, startIndex,
      Resources: rows.map((row) => toScimUser(req, row))
    });
  } catch (error) {
    log('error', 'scim.users_list_failed', { error: serializeError(error) });
    return scimError(res, 500, 'Internal server error');
  }
});

scim.get('/Users/:id', async (req, res) => {
  try {
    const user = await findUser(req.scim.organizationId, req.params.id);
    if (!user) return scimError(res, 404, 'User not found');
    res.type('application/scim+json').json(toScimUser(req, user));
  } catch (error) {
    log('error', 'scim.user_get_failed', { error: serializeError(error) });
    return scimError(res, 500, 'Internal server error');
  }
});

function readUserInput(body) {
  const input = body || {};
  const primaryEmail = Array.isArray(input.emails) ? (input.emails.find((e) => e && e.primary) || input.emails[0]) : null;
  const email = String(input.userName || (primaryEmail && primaryEmail.value) || '').trim().toLowerCase();
  const name = input.name || {};
  const display = String(input.displayName || '').trim();
  return {
    email,
    firstName: String(name.givenName || display.split(' ')[0] || '').slice(0, 100),
    lastName: String(name.familyName || display.split(' ').slice(1).join(' ') || '').slice(0, 100),
    active: input.active === undefined ? true : !(input.active === false || String(input.active).toLowerCase() === 'false'),
    externalId: input.externalId ? String(input.externalId).slice(0, 255) : null
  };
}

async function endSessions(userId) {
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

async function audit(req, eventType, userId, details) {
  await auditService.createAuditLog({
    organizationId: req.scim.organizationId,
    userId: req.scim.actorId,
    eventType,
    resourceType: 'user',
    resourceId: userId,
    details: { via: 'scim', token_id: req.scim.tokenId, ...details },
    success: true
  }).catch((error) => log('error', 'scim.audit_failed', { error: serializeError(error) }));
}

scim.post('/Users', async (req, res) => {
  try {
    const orgId = req.scim.organizationId;
    const input = readUserInput(req.body);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return scimError(res, 400, 'userName must be an email address', 'invalidValue');
    const emailHash = hashForLookup(input.email);
    const existing = await pool.query('SELECT id FROM users WHERE email_hash = $1', [emailHash]);
    if (existing.rows.length) return scimError(res, 409, 'A user with this userName already exists', 'uniqueness');
    if (input.active) {
      try {
        await assertSeatAvailable(orgId);
      } catch (seatError) {
        if (seatError.code !== 'SEAT_LIMIT') throw seatError;
        return scimError(res, 403, seatError.message);
      }
    }
    const sso = await pool.query('SELECT default_role FROM sso_configurations WHERE organization_id = $1', [orgId]);
    const role = PROVISIONABLE_ROLES.has(sso.rows[0] && sso.rows[0].default_role) ? sso.rows[0].default_role : 'user';
    // Provisioned users sign in through SSO; the random password is never disclosed.
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 14);
    const { rows } = await pool.query(
      `INSERT INTO users (email, email_hash, first_name, last_name, organization_id, role, is_active, password_hash, scim_external_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${USER_COLUMNS}`,
      [encrypt(input.email), emailHash, input.firstName || 'User', input.lastName, orgId, role, input.active, passwordHash, input.externalId]
    );
    await audit(req, 'user.provisioned', rows[0].id, { role, active: input.active });
    res.status(201).type('application/scim+json').location(`${baseUrl(req)}/Users/${rows[0].id}`).json(toScimUser(req, rows[0]));
  } catch (error) {
    log('error', 'scim.user_create_failed', { error: serializeError(error) });
    return scimError(res, 500, 'Internal server error');
  }
});

class ScimProtectedError extends Error {
  constructor(message) {
    super(message);
    this.code = 'SCIM_PROTECTED';
  }
}

/**
 * Deprovisioning through SCIM must not lock the organization out: the last
 * active administrator (who keeps the break-glass sign-in when SSO is
 * required) and platform administrators are refused. The admin rows are
 * locked so two concurrent deactivations cannot both pass the check.
 */
async function assertMayDeactivate(client, organizationId, userId) {
  const { rows } = await client.query(
    `SELECT id, role, is_platform_admin FROM users
      WHERE organization_id = $1 AND is_active = true AND (role = 'admin' OR id = $2)
      FOR UPDATE`,
    [organizationId, userId]
  );
  const target = rows.find((row) => row.id === userId);
  if (!target) return;
  if (target.is_platform_admin) throw new ScimProtectedError('Platform administrators cannot be deprovisioned through SCIM');
  if (target.role === 'admin' && !rows.some((row) => row.id !== userId && row.role === 'admin')) {
    throw new ScimProtectedError('This user is the organization\'s last active administrator; assign another administrator in ControlWeave before deprovisioning them');
  }
}

async function applyUpdate(req, user, changes) {
  if (!user.is_active && changes.active) await assertSeatAvailable(req.scim.organizationId);
  const next = {
    firstName: changes.firstName !== undefined ? changes.firstName : user.first_name,
    lastName: changes.lastName !== undefined ? changes.lastName : user.last_name,
    active: changes.active !== undefined ? changes.active : user.is_active,
    externalId: changes.externalId !== undefined ? changes.externalId : user.scim_external_id
  };
  const deactivating = user.is_active && !next.active;
  const client = await pool.connect();
  let rows;
  try {
    await client.query('BEGIN');
    if (deactivating) await assertMayDeactivate(client, req.scim.organizationId, user.id);
    ({ rows } = await client.query(
      `UPDATE users SET first_name = $3, last_name = $4, is_active = $5, scim_external_id = $6, updated_at = NOW()
        WHERE organization_id = $1 AND id = $2 RETURNING ${USER_COLUMNS}`,
      [req.scim.organizationId, user.id, next.firstName, next.lastName, next.active, next.externalId]
    ));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === 'SCIM_PROTECTED') await audit(req, 'user.deprovision_refused', user.id, { reason: error.message });
    throw error;
  } finally {
    client.release();
  }
  if (deactivating) {
    await endSessions(user.id);
    await audit(req, 'user.deprovisioned', user.id, {});
  } else if (!user.is_active && next.active) {
    await audit(req, 'user.reactivated', user.id, {});
  } else {
    await audit(req, 'user.updated', user.id, {});
  }
  return rows[0];
}

scim.put('/Users/:id', async (req, res) => {
  try {
    const user = await findUser(req.scim.organizationId, req.params.id);
    if (!user) return scimError(res, 404, 'User not found');
    const input = readUserInput(req.body);
    const updated = await applyUpdate(req, user, { firstName: input.firstName, lastName: input.lastName, active: input.active, externalId: input.externalId });
    res.type('application/scim+json').json(toScimUser(req, updated));
  } catch (error) {
    if (error.code === 'SEAT_LIMIT') return scimError(res, 403, error.message);
    if (error.code === 'SCIM_PROTECTED') return scimError(res, 400, error.message, 'mutability');
    log('error', 'scim.user_replace_failed', { error: serializeError(error) });
    return scimError(res, 500, 'Internal server error');
  }
});

// PATCH accepts both Okta style ({op:'replace', value:{active:false}}) and
// Entra style ({op:'Replace', path:'active', value:'False'}).
function patchChanges(operations) {
  const changes = {};
  const toBool = (v) => !(v === false || String(v).toLowerCase() === 'false');
  const assign = (path, value) => {
    const key = String(path || '').toLowerCase();
    if (key === 'active') changes.active = toBool(value);
    else if (key === 'name.givenname') changes.firstName = String(value || '').slice(0, 100);
    else if (key === 'name.familyname') changes.lastName = String(value || '').slice(0, 100);
    else if (key === 'externalid') changes.externalId = value ? String(value).slice(0, 255) : null;
    else if (key === 'name' && value && typeof value === 'object') {
      if (value.givenName !== undefined) assign('name.givenName', value.givenName);
      if (value.familyName !== undefined) assign('name.familyName', value.familyName);
    }
  };
  for (const op of operations || []) {
    const kind = String(op.op || '').toLowerCase();
    if (kind !== 'replace' && kind !== 'add') continue;
    if (op.path) assign(op.path, op.value);
    else if (op.value && typeof op.value === 'object') Object.entries(op.value).forEach(([k, v]) => assign(k, v));
  }
  return changes;
}

scim.patch('/Users/:id', async (req, res) => {
  try {
    if (!req.body || !Array.isArray(req.body.Operations)) return scimError(res, 400, `Body must be a ${PATCH_SCHEMA} request`, 'invalidSyntax');
    const user = await findUser(req.scim.organizationId, req.params.id);
    if (!user) return scimError(res, 404, 'User not found');
    const updated = await applyUpdate(req, user, patchChanges(req.body.Operations));
    res.type('application/scim+json').json(toScimUser(req, updated));
  } catch (error) {
    if (error.code === 'SEAT_LIMIT') return scimError(res, 403, error.message);
    if (error.code === 'SCIM_PROTECTED') return scimError(res, 400, error.message, 'mutability');
    log('error', 'scim.user_patch_failed', { error: serializeError(error) });
    return scimError(res, 500, 'Internal server error');
  }
});

scim.delete('/Users/:id', async (req, res) => {
  try {
    const user = await findUser(req.scim.organizationId, req.params.id);
    if (!user) return scimError(res, 404, 'User not found');
    // Deactivate rather than delete: the user's actions stay attributable in
    // the audit trail (AU-10), and the IdP can reactivate them.
    await applyUpdate(req, user, { active: false });
    res.status(204).end();
  } catch (error) {
    if (error.code === 'SCIM_PROTECTED') return scimError(res, 400, error.message, 'mutability');
    log('error', 'scim.user_delete_failed', { error: serializeError(error) });
    return scimError(res, 500, 'Internal server error');
  }
});

// Groups are not provisioned (roles are assigned in ControlWeave). An empty
// list lets IdP connection tests pass.
scim.get('/Groups', (req, res) => {
  res.type('application/scim+json').json({ schemas: [LIST_SCHEMA], totalResults: 0, itemsPerPage: 0, startIndex: 1, Resources: [] });
});

scim.use((req, res) => scimError(res, 404, 'Resource not supported'));

module.exports = router;
module.exports.patchChanges = patchChanges;
module.exports.parseFilter = parseFilter;
