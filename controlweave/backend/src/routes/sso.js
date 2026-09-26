// @tier: enterprise
'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const dns = require('dns').promises;
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { authenticate, requirePermission, requireTier } = require('../middleware/auth');
const SSO_TIER = 'pro'; // SSO available on pro+
const sso = require('../services/ssoService');
const ssoPolicy = require('../services/ssoPolicy');
const auditService = require('../services/auditService');
const { JWT_SECRET, JWT_ALGORITHM } = require('../config/security');
const { validateBody, requireFields } = require('../middleware/validate');
const { hashForLookup, hashToken } = require('../utils/encrypt');
const { verifyTotpOrBackupCode } = require('../services/secondFactorService');
const { createRateLimiter } = require('../middleware/rateLimit');
const { log } = require('../utils/logger');
const refreshCookie = require('../utils/refreshCookie');
const { hasPublicColumn } = require('../utils/schema');
const { resolveExpiryTimestampFromNow } = require('../utils/sessionExpiry');
const { X509Certificate } = require('crypto');
const saml = require('../services/samlService');
const { isUuid } = require('../middleware/validate');
const { requireFeature, hasFeature, commercialMode } = require('../services/entitlementService');

const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Escape special characters in LIKE patterns to prevent wildcard injection
function escapeLike(str) {
  return String(str).replace(/[%_\\]/g, '\\$&');
}

function issueTokens(userId) {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { algorithm: JWT_ALGORITHM, expiresIn: ACCESS_EXPIRY });
  const refreshToken = jwt.sign({ userId, type: 'refresh', jti: crypto.randomBytes(16).toString('hex') }, JWT_SECRET, { algorithm: JWT_ALGORITHM, expiresIn: REFRESH_EXPIRY });
  return { accessToken, refreshToken };
}

// Single-use code the SSO callback hands to the frontend in place of tokens.
// Tokens are only released by POST /sso/exchange, which also enforces TOTP.
const HANDOFF_TTL_SECONDS = 60;

async function redirectWithHandoffCode(res, userId, authMethod) {
  const code = crypto.randomBytes(32).toString('base64url');
  await pool.query(
    `INSERT INTO sso_handoff_codes (code_hash, user_id, auth_method, expires_at)
     VALUES ($1, $2, $3, NOW() + ($4::int * INTERVAL '1 second'))`,
    [hashToken(code), userId, authMethod, HANDOFF_TTL_SECONDS]
  );
  return res.redirect(`${FRONTEND_URL}/login/sso-callback#code=${encodeURIComponent(code)}`);
}

// OIDC providers send email_verified as a boolean; Apple sends the string "true".
function isEmailVerifiedClaim(value) {
  return value === true || value === 'true';
}

// email_hash column availability cache for SSO route (checked once per process)
let ssoEmailHashColumnAvailable = null;
async function hasSsoEmailHashCol() {
  if (ssoEmailHashColumnAvailable === null) {
    ssoEmailHashColumnAvailable = await hasPublicColumn('users', 'email_hash');
  }
  return ssoEmailHashColumnAvailable;
}

// SHA-384 (CNSA Suite 1.0), matching the /auth/refresh lookup.
function hashRefreshToken(token) {
  return hashToken(token);
}

async function storeSession(userId, refreshToken) {
  const sessionExpiresAt = resolveExpiryTimestampFromNow(REFRESH_EXPIRY, 'JWT_REFRESH_EXPIRY');
  await pool.query(
    'INSERT INTO sessions (user_id, refresh_token, expires_at) VALUES ($1, $2, $3)',
    [userId, hashRefreshToken(refreshToken), sessionExpiresAt]
  );
}

function callbackUrl(provider) {
  return `${BACKEND_URL}/api/v1/sso/callback/${provider}`;
}

// ─── SSO Config management (admin only) ─────────────────────────────────────

// GET /sso/config
function validateSsoInput(body) {
  if (!['oidc', 'saml'].includes(body.provider_type)) return 'provider_type must be oidc or saml';
  if (body.provider_type === 'saml') {
    if (!/^https:\/\//i.test(String(body.saml_entry_point || ''))) return 'SAML sign-on URL must be an https URL';
    if (body.saml_idp_cert) {
      try {
        const b64 = saml.normalizeCert(body.saml_idp_cert);
        // eslint-disable-next-line no-new
        new X509Certificate(`-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----`);
      } catch {
        return 'SAML signing certificate is not a valid X.509 certificate';
      }
    }
  }
  return null;
}

// Email domains route "Sign in with SSO" to this organization once verified.
// A claim is pending until the organization proves control of the domain with
// a DNS TXT record (POST /sso/domains/verify); pending claims are never used
// for discovery and do not block other organizations, so nobody can squat a
// domain or route its users to an IdP they run.
const DOMAIN_PATTERN = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const DOMAIN_TXT_PREFIX = '_controlweave-verification';

function domainTxtRecord(domain, token) {
  return { name: `${DOMAIN_TXT_PREFIX}.${domain}`, value: `controlweave-verification=${token}` };
}

async function saveEmailDomains(req, input) {
  if (input === undefined) return null;
  const domains = [...new Set((Array.isArray(input) ? input : String(input).split(/[\s,]+/))
    .map((d) => String(d).trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean))];
  const invalid = domains.filter((d) => !DOMAIN_PATTERN.test(d));
  if (invalid.length) return `Invalid domain: ${invalid.join(', ')}`;
  if (domains.length > 50) return 'At most 50 email domains';
  const taken = await pool.query(
    'SELECT domain FROM sso_email_domains WHERE domain = ANY($1::text[]) AND organization_id <> $2 AND verified_at IS NOT NULL',
    [domains, req.user.organization_id]
  );
  if (taken.rows.length) return `Already verified by another organization: ${taken.rows.map((r) => r.domain).join(', ')}`;
  await pool.query('DELETE FROM sso_email_domains WHERE organization_id = $1 AND NOT (domain = ANY($2::text[]))', [req.user.organization_id, domains]);
  for (const domain of domains) {
    await pool.query(
      `INSERT INTO sso_email_domains (domain, organization_id, created_by, verification_token) VALUES ($1, $2, $3, $4)
       ON CONFLICT (domain, organization_id) DO NOTHING`,
      [domain, req.user.organization_id, req.user.id, crypto.randomBytes(16).toString('hex')]
    );
  }
  return null;
}

async function listEmailDomains(organizationId) {
  const { rows } = await pool.query(
    'SELECT domain, verification_token, verified_at FROM sso_email_domains WHERE organization_id = $1 ORDER BY domain',
    [organizationId]
  );
  return rows.map((row) => ({
    domain: row.domain,
    verified: Boolean(row.verified_at),
    verified_at: row.verified_at,
    txt_record: domainTxtRecord(row.domain, row.verification_token)
  }));
}

router.get('/config', authenticate, requireTier(SSO_TIER), requirePermission('settings.manage'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, provider_type, display_name, discovery_url, client_id,
              scopes, metadata_url, sp_entity_id, auto_provision, default_role, enabled,
              saml_entry_point, saml_idp_issuer, (saml_idp_cert IS NOT NULL) AS saml_idp_cert_set,
              saml_email_attribute, saml_name_attribute, saml_allow_idp_initiated, enforce_sso
       FROM sso_configurations
       WHERE organization_id = $1 LIMIT 1`,
      [req.user.organization_id]
    );
    const domains = await listEmailDomains(req.user.organization_id);
    const urls = saml.spUrls(req.user.organization_id);
    return res.json({
      data: result.rows[0] ? { ...result.rows[0], email_domains: domains.map((d) => d.domain), email_domain_status: domains } : null,
      service_provider: {
        entity_id: (result.rows[0] && result.rows[0].sp_entity_id) || urls.entityId,
        acs_url: urls.acsUrl,
        metadata_url: urls.metadataUrl,
        oidc_redirect_uri: callbackUrl('org')
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve SSO configuration' });
  }
});

// PUT /sso/config
router.put(
  '/config',
  authenticate,
  requireTier(SSO_TIER),
  requirePermission('settings.manage'),
  requireFeature('sso'),
  validateBody((body) => requireFields(body, ['provider_type'])),
  async (req, res) => {
    try {
      const validationError = validateSsoInput(req.body);
      if (validationError) return res.status(400).json({ error: validationError });
      if (req.body.enforce_sso === true && commercialMode() && !(await hasFeature(req.user.organization_id, 'sso_enforcement'))) {
        return res.status(402).json({ error: 'Requiring SSO is part of the Enterprise plan.', code: 'plan_upgrade_required', feature: 'sso_enforcement' });
      }
      const domainError = await saveEmailDomains(req, req.body.email_domains);
      if (domainError) return res.status(409).json({ error: domainError });
      await sso.saveOrgSsoConfig(req.user.organization_id, req.body);
      await sso.saveSamlSettings(req.user.organization_id, {
        ...req.body,
        saml_idp_cert: req.body.saml_idp_cert ? saml.normalizeCert(req.body.saml_idp_cert) : null
      });
      
      // Log SSO configuration change
      const context = auditService.extractAuditContext(req);
      await auditService.logSsoConfigChange({
        organizationId: req.user.organization_id,
        userId: req.user.id,
        action: 'updated',
        provider: req.body.provider_type,
        details: {
          display_name: req.body.display_name,
          enabled: req.body.enabled !== false
        },
        ...context,
        actorName: auditService.getActorName(req.user)
      });
      
      return res.json({ data: { saved: true } });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save SSO configuration' });
    }
  }
);

// POST /sso/domains/verify { domain } -- check the TXT record that proves this
// organization controls the domain, and mark the claim verified. The first
// organization to verify holds the domain; other organizations' pending
// claims for it are removed.
const domainVerifyLimiter = createRateLimiter({ label: 'sso-domain-verify', windowMs: 60 * 1000, max: 20 });

async function txtRecordMatches(record) {
  let answers;
  try {
    answers = await dns.resolveTxt(record.name);
  } catch (error) {
    if (['ENOTFOUND', 'ENODATA', 'ESERVFAIL', 'ETIMEOUT', 'EREFUSED'].includes(error.code)) return false;
    throw error;
  }
  return answers.some((chunks) => chunks.join('').trim() === record.value);
}

router.post(
  '/domains/verify',
  authenticate,
  domainVerifyLimiter,
  requireTier(SSO_TIER),
  requirePermission('settings.manage'),
  requireFeature('sso'),
  async (req, res) => {
    const domain = String((req.body && req.body.domain) || '').trim().toLowerCase();
    if (!DOMAIN_PATTERN.test(domain)) return res.status(400).json({ error: 'A valid domain is required' });
    try {
      const { rows: [claim] } = await pool.query(
        'SELECT domain, verification_token, verified_at FROM sso_email_domains WHERE organization_id = $1 AND domain = $2',
        [req.user.organization_id, domain]
      );
      if (!claim) return res.status(404).json({ error: 'Add the domain to your SSO configuration first' });
      const record = domainTxtRecord(domain, claim.verification_token);
      if (claim.verified_at) return res.json({ success: true, data: { domain, verified: true, verified_at: claim.verified_at, txt_record: record } });
      if (!(await txtRecordMatches(record))) {
        return res.status(422).json({ error: `TXT record not found. Publish ${record.name} with the value ${record.value}, allow time for DNS to update, then try again.`, code: 'domain_txt_missing', txt_record: record });
      }
      const client = await pool.connect();
      let verifiedAt;
      try {
        await client.query('BEGIN');
        const { rows: [updated] } = await client.query(
          'UPDATE sso_email_domains SET verified_at = NOW() WHERE organization_id = $1 AND domain = $2 AND verified_at IS NULL RETURNING verified_at',
          [req.user.organization_id, domain]
        );
        verifiedAt = updated && updated.verified_at;
        await client.query('DELETE FROM sso_email_domains WHERE domain = $1 AND organization_id <> $2 AND verified_at IS NULL', [domain, req.user.organization_id]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if (error.code === '23505') return res.status(409).json({ error: 'Another organization has already verified this domain' });
        throw error;
      } finally {
        client.release();
      }
      await auditService.logFromRequest(req, {
        eventType: 'sso.domain_verified', resourceType: 'sso_email_domain', details: { domain }, success: true
      });
      return res.json({ success: true, data: { domain, verified: true, verified_at: verifiedAt, txt_record: record } });
    } catch (error) {
      log('error', 'sso.domain_verify_failed', { error: error.message });
      return res.status(500).json({ error: 'Failed to verify the domain' });
    }
  }
);

// ─── Org OIDC SSO flow ───────────────────────────────────────────────────────

// GET /sso/login/:orgSlug  (or use org_id)
router.get('/login/org', async (req, res) => {
  try {
    const { org_id } = req.query;
    if (!org_id) return res.status(400).json({ error: 'org_id is required.' });

    const config = await sso.getOrgSsoConfig(org_id);
    if (!config) return res.status(404).json({ error: 'SSO not configured for this organization.' });

    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');

    // Store state+nonce temporarily in passkey_challenges table (reuse the mechanism)
    await pool.query(
      `INSERT INTO passkey_challenges (challenge, type, user_id)
       VALUES ($1, 'authentication', NULL)`,
      [JSON.stringify({ state, nonce, org_id })]
    );

    if (config.provider_type === 'oidc') {
      const authUrl = await sso.getOidcAuthUrl(
        config.discovery_url,
        config.client_id,
        config.client_secret,
        callbackUrl('org'),
        state,
        nonce,
        config.scopes
      );
      return res.redirect(authUrl);
    }

    if (saml.isSamlReady(config)) {
      return res.redirect(await saml.getAuthorizeUrl(config, ''));
    }
    return res.redirect(`${FRONTEND_URL}/login?error=sso_not_configured`);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to initiate SSO login' });
  }
});

// GET /sso/callback/org
router.get('/callback/org', async (req, res) => {
  const context = auditService.extractAuditContext(req);
  let org_id, userId, email, ssoProviderName;

  try {
    const { state, code } = req.query;

    // Retrieve stored state
    const stateResult = await pool.query(
      `DELETE FROM passkey_challenges
       WHERE challenge LIKE $1 AND type = 'authentication' AND expires_at > NOW()
       RETURNING challenge`,
      [`%"state":"${escapeLike(state)}"%`]
    );
    if (stateResult.rows.length === 0) {
      return res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
    }

    const { nonce, org_id: orgId } = JSON.parse(stateResult.rows[0].challenge);
    org_id = orgId;
    const config = await sso.getOrgSsoConfig(org_id);
    if (!config) return res.redirect(`${FRONTEND_URL}/login?error=sso_not_configured`);

    ssoProviderName = config.display_name || config.provider_type || 'oidc';

    const { userinfo } = await sso.exchangeOidcCode(
      config.discovery_url,
      config.client_id,
      config.client_secret,
      callbackUrl('org'),
      req.query,
      { state, nonce }
    );

    email = userinfo.email;
    if (!email) return res.redirect(`${FRONTEND_URL}/login?error=no_email`);

    userId = await sso.provisionUser(
      org_id, email,
      userinfo.name || userinfo.preferred_username || email,
      config.default_role,
      // provider is varchar(32): keep it short and scope the subject by config.
      'oidc', `${config.id}:${userinfo.sub}`,
      null, null, null,
      { autoProvision: config.auto_provision !== false }
    );

    // Log successful SSO authentication
    await auditService.logAuthentication({
      organizationId: org_id,
      userId,
      email,
      authMethod: 'sso',
      ssoProvider: ssoProviderName,
      success: true,
      ...context,
      actorName: userinfo.name || email
    });

    return redirectWithHandoffCode(res, userId, 'sso');
  } catch (err) {
    console.error('SSO callback error:', err);
    
    // Log failed SSO authentication
    if (org_id) {
      try {
        await auditService.logAuthentication({
          organizationId: org_id,
          userId: userId || null,
          email: email || 'unknown',
          authMethod: 'sso',
          ssoProvider: ssoProviderName || 'unknown',
          success: false,
          failureReason: err.message,
          ...context
        });
      } catch (auditErr) {
        console.error('Failed to log SSO failure:', auditErr);
      }
    }
    
    const errorCode = err.message === 'Account is disabled'
      ? 'account_disabled'
      : err.message === 'Account not provisioned' ? 'not_provisioned' : err.code === 'SEAT_LIMIT' ? 'seat_limit' : 'sso_failed';
    return res.redirect(`${FRONTEND_URL}/login?error=${errorCode}`);
  }
});

// ─── SSO discovery and SAML ──────────────────────────────────────────────────

const discoverLimiter = createRateLimiter({ label: 'sso-discover', windowMs: 60 * 1000, max: 30 });

// GET /sso/discover?email= -- is this email's domain signed in through an
// organization's IdP? Answers by domain only, so it reveals nothing about
// whether a particular account exists.
router.get('/discover', discoverLimiter, async (req, res) => {
  try {
    const match = await sso.findSsoByEmail(req.query.email);
    if (!match) return res.json({ data: { sso: false } });
    return res.json({
      data: {
        sso: true,
        enforced: match.enforce_sso,
        display_name: match.display_name,
        login_url: `${BACKEND_URL}/api/v1/sso/login/org?org_id=${match.organization_id}`
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'SSO discovery failed' });
  }
});

// GET /sso/saml/:orgId/metadata -- service provider metadata for the IdP admin.
router.get('/saml/:orgId/metadata', async (req, res) => {
  try {
    if (!isUuid(req.params.orgId)) return res.status(404).end();
    const { rows } = await pool.query('SELECT * FROM sso_configurations WHERE organization_id = $1', [req.params.orgId]);
    const config = rows[0] || { organization_id: req.params.orgId };
    res.type('application/samlmetadata+xml');
    return res.send(saml.metadata({ ...config, organization_id: req.params.orgId }));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate SAML metadata' });
  }
});

// POST /sso/saml/:orgId/acs -- assertion consumer service (HTTP-POST binding).
router.post('/saml/:orgId/acs', createRateLimiter({ label: 'saml-acs', windowMs: 60 * 1000, max: 60 }), async (req, res) => {
  const context = auditService.extractAuditContext(req);
  const orgId = req.params.orgId;
  let identity = {};
  try {
    if (!isUuid(orgId) || !req.body || typeof req.body.SAMLResponse !== 'string') {
      return res.redirect(`${FRONTEND_URL}/login?error=sso_failed`);
    }
    const config = await sso.getOrgSsoConfig(orgId);
    if (!saml.isSamlReady(config)) return res.redirect(`${FRONTEND_URL}/login?error=sso_not_configured`);
    const profile = await saml.validateResponse(config, req.body);
    identity = saml.identityFromProfile(profile, config);
    if (!identity.email) return res.redirect(`${FRONTEND_URL}/login?error=no_email`);
    const userId = await sso.provisionUser(
      orgId, identity.email, identity.name, config.default_role,
      'saml', `${config.id}:${identity.subject || identity.email}`,
      null, null, null,
      { autoProvision: config.auto_provision !== false }
    );
    await auditService.logAuthentication({
      organizationId: orgId, userId, email: identity.email, authMethod: 'sso',
      ssoProvider: config.display_name || 'saml', success: true, ...context, actorName: identity.name
    });
    return redirectWithHandoffCode(res, userId, 'sso');
  } catch (err) {
    log('warn', 'sso.saml_failed', { detail: err.message });
    await auditService.logAuthentication({
      organizationId: isUuid(orgId) ? orgId : null, userId: null, email: identity.email || 'unknown', authMethod: 'sso',
      ssoProvider: 'saml', success: false, failureReason: err.message, ...context
    }).catch(() => {});
    const code = err.message === 'Account is disabled' ? 'account_disabled'
      : err.message === 'Account not provisioned' ? 'not_provisioned' : err.code === 'SEAT_LIMIT' ? 'seat_limit' : 'sso_failed';
    return res.redirect(`${FRONTEND_URL}/login?error=${code}`);
  }
});

// ─── Social login flows ───────────────────────────────────────────────────────

// GET /sso/social/:provider  — initiates OAuth2 flow
router.get('/social/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const validProviders = ['google', 'microsoft', 'apple', 'github'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: 'Unknown provider.' });
    }

    const cfg = sso.SOCIAL_PROVIDERS[provider];
    if (!cfg?.clientId) {
      return res.status(503).json({ error: `${provider} sign-in is not configured on this server.` });
    }

    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');

    await pool.query(
      `INSERT INTO passkey_challenges (challenge, type, user_id)
       VALUES ($1, 'authentication', NULL)`,
      [JSON.stringify({ state, nonce, provider })]
    );

    if (provider === 'github') {
      return res.redirect(sso.getGitHubAuthUrl(callbackUrl(provider), state));
    }

    // All others are OIDC
    const authUrl = await sso.getOidcAuthUrl(
      cfg.discoveryUrl,
      cfg.clientId,
      cfg.clientSecret,
      callbackUrl(provider),
      state,
      nonce,
      cfg.scopes
    );
    return res.redirect(authUrl);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to initiate social login' });
  }
});

// GET /sso/callback/:provider
router.get('/callback/:provider', async (req, res) => {
  const context = auditService.extractAuditContext(req);
  let email, userId, orgId;

  try {
    const { provider } = req.params;
    const { state, code } = req.query;

    const stateResult = await pool.query(
      `DELETE FROM passkey_challenges
       WHERE challenge LIKE $1 AND type = 'authentication' AND expires_at > NOW()
       RETURNING challenge`,
      [`%"state":"${escapeLike(state)}"%`]
    );
    if (stateResult.rows.length === 0) {
      return res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
    }

    const { nonce } = JSON.parse(stateResult.rows[0].challenge);
    const cfg = sso.SOCIAL_PROVIDERS[provider];
    if (!cfg) return res.redirect(`${FRONTEND_URL}/login?error=unknown_provider`);

    let name, providerUserId, accessToken, emailVerified;

    if (provider === 'github') {
      const ghUser = await sso.exchangeGitHubCode(code, callbackUrl(provider));
      ({ email, name, providerUserId, accessToken, emailVerified } = ghUser);
    } else {
      const { tokenSet, userinfo } = await sso.exchangeOidcCode(
        cfg.discoveryUrl,
        cfg.clientId,
        cfg.clientSecret,
        callbackUrl(provider),
        req.query,
        { state, nonce }
      );
      email = userinfo.email;
      name = userinfo.name || userinfo.preferred_username;
      providerUserId = userinfo.sub;
      accessToken = tokenSet.access_token;
      emailVerified = isEmailVerifiedClaim(userinfo.email_verified);
    }

    if (!email) return res.redirect(`${FRONTEND_URL}/login?error=no_email`);

    // Find or create user — for social logins, users can belong to any org
    // First check if the social login already exists
    const existingSocial = await pool.query(
      `SELECT ul.user_id, u.is_active
       FROM user_social_logins ul
       JOIN users u ON u.id = ul.user_id
       WHERE ul.provider = $1 AND ul.provider_user_id = $2`,
      [provider, providerUserId]
    );

    if (existingSocial.rows.length > 0) {
      if (!existingSocial.rows[0].is_active) {
        return res.redirect(`${FRONTEND_URL}/login?error=account_disabled`);
      }

      userId = existingSocial.rows[0].user_id;
      await pool.query(
        `UPDATE user_social_logins SET access_token=$1, updated_at=NOW()
         WHERE provider=$2 AND provider_user_id=$3`,
        [accessToken, provider, providerUserId]
      );
    } else {
      // Linking a new provider identity to an existing account by email is
      // only safe when the provider vouches that the address is verified;
      // otherwise anyone who can set an arbitrary email on a provider account
      // could sign in as the matching ControlWeave user.
      if (!emailVerified) {
        return res.redirect(`${FRONTEND_URL}/login?error=email_not_verified`);
      }

      // Check if user exists by email (must already have an account)
      const ssoEmailHash = (await hasSsoEmailHashCol()) ? hashForLookup(email.toLowerCase()) : null;
      let existingUser;
      if (ssoEmailHash) {
        existingUser = await pool.query(
          `SELECT id, is_active FROM users WHERE email_hash = $1 LIMIT 1`,
          [ssoEmailHash]
        );
        // Fallback for pre-migration rows (email_hash IS NULL)
        if (existingUser.rows.length === 0) {
          existingUser = await pool.query(
            `SELECT id, is_active FROM users WHERE email = $1 AND email_hash IS NULL LIMIT 1`,
            [email.toLowerCase()]
          );
        }
      } else {
        existingUser = await pool.query(
          `SELECT id, is_active FROM users WHERE email = $1 LIMIT 1`,
          [email.toLowerCase()]
        );
      }
      if (existingUser.rows.length === 0) {
        // No existing account — redirect to register with pre-filled email
        return res.redirect(
          `${FRONTEND_URL}/register?email=${encodeURIComponent(email)}&social_provider=${provider}&error=account_required`
        );
      }
      if (!existingUser.rows[0].is_active) {
        return res.redirect(`${FRONTEND_URL}/login?error=account_disabled`);
      }

      userId = existingUser.rows[0].id;
      await pool.query(
        `INSERT INTO user_social_logins (user_id, provider, provider_user_id, email, access_token)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (provider, provider_user_id) DO NOTHING`,
        [userId, provider, providerUserId, email, accessToken]
      );
    }

    // Get organization ID for audit logging
    const userOrgResult = await pool.query(
      `SELECT organization_id FROM users WHERE id = $1`,
      [userId]
    );
    orgId = userOrgResult.rows[0]?.organization_id;

    // Log successful social login
    if (orgId) {
      await auditService.logAuthentication({
        organizationId: orgId,
        userId,
        email,
        authMethod: 'sso',
        ssoProvider: provider,
        success: true,
        ...context,
        actorName: name || email
      });
    }

    return redirectWithHandoffCode(res, userId, `social:${provider}`);
  } catch (err) {
    console.error(`Social ${req.params.provider} callback error:`, err);
    
    // Log failed social login (only if we have orgId, which requires successful user lookup)
    // Early-stage failures (invalid state, missing email) cannot be logged without org context
    if (orgId && email) {
      try {
        await auditService.logAuthentication({
          organizationId: orgId,
          userId: userId || null,
          email,
          authMethod: 'sso',
          ssoProvider: req.params.provider,
          success: false,
          failureReason: err.message,
          ...context
        });
      } catch (auditErr) {
        console.error('Failed to log social login failure:', auditErr);
      }
    }
    
    const errorCode = err.message === 'Account is disabled'
      ? 'account_disabled'
      : 'social_failed';
    return res.redirect(`${FRONTEND_URL}/login?error=${errorCode}`);
  }
});

// GET /sso/providers — returns which social providers are enabled on this server
router.get('/providers', async (req, res) => {
  const providers = [];
  for (const [name, cfg] of Object.entries(sso.SOCIAL_PROVIDERS)) {
    if (cfg.clientId) providers.push(name);
  }
  return res.json({ data: providers });
});

// GET /sso/social-logins — list social logins for current user
router.get('/social-logins', authenticate, requireTier(SSO_TIER), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, provider, email, created_at FROM user_social_logins WHERE user_id = $1`,
      [req.user.id]
    );
    return res.json({ data: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve social logins' });
  }
});

// DELETE /sso/social-logins/:provider — unlink a social provider
router.delete('/social-logins/:provider', authenticate, requireTier(SSO_TIER), async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM user_social_logins WHERE user_id = $1 AND provider = $2`,
      [req.user.id, req.params.provider]
    );
    return res.json({ data: { unlinked: true } });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to unlink social login' });
  }
});

// POST /sso/exchange -- trade a single-use SSO handoff code for tokens.
// Public by design: the caller has no session yet, and the 256-bit code is the
// credential. A TOTP-enabled user must also supply totp_code; the code is only
// consumed on success or on a wrong second factor (which forces a fresh SSO
// round-trip rather than allowing unlimited TOTP guesses).
const exchangeLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, label: 'sso-exchange' });

router.post('/exchange', exchangeLimiter, async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim();
    const totpCode = String(req.body?.totp_code || '').trim();
    if (!code) {
      return res.status(400).json({ success: false, error: 'code is required' });
    }
    const codeHash = hashToken(code);

    const pending = await pool.query(
      `SELECT h.user_id, h.auth_method, u.is_active, u.organization_id, u.role, u.is_platform_admin,
              COALESCE(u.totp_enabled, false) AS totp_enabled,
              u.totp_secret, u.totp_backup_codes
       FROM sso_handoff_codes h
       JOIN users u ON u.id = h.user_id
       WHERE h.code_hash = $1 AND h.expires_at > NOW()`,
      [codeHash]
    );
    const user = pending.rows[0];
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired sign-in code' });
    }
    if (!user.is_active) {
      await pool.query('DELETE FROM sso_handoff_codes WHERE code_hash = $1', [codeHash]);
      return res.status(401).json({ success: false, error: 'Account is disabled' });
    }
    // Social sign-in does not satisfy "Require SSO"; the organization's own
    // IdP (auth_method 'sso') does.
    if (user.auth_method !== 'sso' && (await ssoPolicy.ssoRequiredFor(user))) {
      await pool.query('DELETE FROM sso_handoff_codes WHERE code_hash = $1', [codeHash]);
      return res.status(403).json({ success: false, error: ssoPolicy.SSO_REQUIRED_MESSAGE, code: 'sso_required' });
    }

    if (user.totp_enabled) {
      if (!totpCode) {
        return res.json({
          success: false,
          totp_required: true,
          message: 'Enter the 6-digit code from your authenticator app to complete sign-in.'
        });
      }
      const valid = await verifyTotpOrBackupCode({ ...user, id: user.user_id }, totpCode);
      if (!valid) {
        await pool.query('DELETE FROM sso_handoff_codes WHERE code_hash = $1', [codeHash]);
        return res.status(401).json({ success: false, error: 'Invalid authenticator code. Please sign in again.' });
      }
    }

    // Consume atomically so a code can never be redeemed twice.
    const consumed = await pool.query(
      'DELETE FROM sso_handoff_codes WHERE code_hash = $1 AND expires_at > NOW() RETURNING user_id',
      [codeHash]
    );
    if (consumed.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid or expired sign-in code' });
    }

    const { accessToken, refreshToken } = issueTokens(user.user_id);
    await storeSession(user.user_id, refreshToken);
    return res.json({ success: true, data: { accessToken, refreshToken: refreshCookie.deliverRefreshToken(req, res, refreshToken) } });
  } catch (err) {
    log('error', 'sso.exchange_failed', { error: err.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
