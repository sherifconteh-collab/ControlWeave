'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { authenticate, authorizePermission, requireTier } = require('../middleware/auth');
const SSO_TIER = 'professional'; // SSO available on professional+
const sso = require('../services/ssoService');
const { JWT_SECRET } = require('../config/security');
const { validateBody, requireFields } = require('../middleware/validate');

const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

function issueTokens(userId) {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_EXPIRY });
  const refreshToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: REFRESH_EXPIRY });
  return { accessToken, refreshToken };
}

function callbackUrl(provider) {
  return `${BACKEND_URL}/api/v1/sso/callback/${provider}`;
}

// ─── SSO Config management (admin only) ─────────────────────────────────────

// GET /sso/config
router.get('/config', authenticate, requireTier(SSO_TIER), authorizePermission('settings.manage'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, provider_type, display_name, discovery_url, client_id,
              scopes, metadata_url, sp_entity_id, auto_provision, default_role, enabled
       FROM sso_configurations
       WHERE organization_id = $1 LIMIT 1`,
      [req.user.organization_id]
    );
    return res.json({ data: result.rows[0] || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /sso/config
router.put(
  '/config',
  authenticate,
  requireTier(SSO_TIER),
  authorizePermission('settings.manage'),
  validateBody((body) => requireFields(body, ['provider_type'])),
  async (req, res) => {
    try {
      await sso.saveOrgSsoConfig(req.user.organization_id, req.body);
      return res.json({ data: { saved: true } });
    } catch (err) {
      return res.status(500).json({ error: err.message });
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

    return res.status(400).json({ error: 'SAML not yet implemented via this endpoint.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /sso/callback/org
router.get('/callback/org', async (req, res) => {
  try {
    const { state, code } = req.query;

    // Retrieve stored state
    const stateResult = await pool.query(
      `DELETE FROM passkey_challenges
       WHERE challenge LIKE $1 AND type = 'authentication' AND expires_at > NOW()
       RETURNING challenge`,
      [`%"state":"${state}"%`]
    );
    if (stateResult.rows.length === 0) {
      return res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
    }

    const { nonce, org_id } = JSON.parse(stateResult.rows[0].challenge);
    const config = await sso.getOrgSsoConfig(org_id);
    if (!config) return res.redirect(`${FRONTEND_URL}/login?error=sso_not_configured`);

    const { userinfo } = await sso.exchangeOidcCode(
      config.discovery_url,
      config.client_id,
      config.client_secret,
      callbackUrl('org'),
      req.query,
      { state, nonce }
    );

    const email = userinfo.email;
    if (!email) return res.redirect(`${FRONTEND_URL}/login?error=no_email`);

    const userId = await sso.provisionUser(
      org_id, email,
      userinfo.name || userinfo.preferred_username || email,
      config.default_role,
      `oidc:${config.id}`, userinfo.sub,
      null, null, null
    );

    const { accessToken, refreshToken } = issueTokens(userId);
    return res.redirect(
      `${FRONTEND_URL}/login/sso-callback?at=${encodeURIComponent(accessToken)}&rt=${encodeURIComponent(refreshToken)}`
    );
  } catch (err) {
    console.error('SSO callback error:', err);
    return res.redirect(`${FRONTEND_URL}/login?error=sso_failed`);
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
    return res.status(500).json({ error: err.message });
  }
});

// GET /sso/callback/:provider
router.get('/callback/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { state, code } = req.query;

    const stateResult = await pool.query(
      `DELETE FROM passkey_challenges
       WHERE challenge LIKE $1 AND type = 'authentication' AND expires_at > NOW()
       RETURNING challenge`,
      [`%"state":"${state}"%`]
    );
    if (stateResult.rows.length === 0) {
      return res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
    }

    const { nonce } = JSON.parse(stateResult.rows[0].challenge);
    const cfg = sso.SOCIAL_PROVIDERS[provider];
    if (!cfg) return res.redirect(`${FRONTEND_URL}/login?error=unknown_provider`);

    let email, name, providerUserId, accessToken;

    if (provider === 'github') {
      const ghUser = await sso.exchangeGitHubCode(code, callbackUrl(provider));
      ({ email, name, providerUserId, accessToken } = ghUser);
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
    }

    if (!email) return res.redirect(`${FRONTEND_URL}/login?error=no_email`);

    // Find or create user — for social logins, users can belong to any org
    // First check if the social login already exists
    const existingSocial = await pool.query(
      `SELECT ul.user_id FROM user_social_logins ul
       WHERE ul.provider = $1 AND ul.provider_user_id = $2`,
      [provider, providerUserId]
    );

    let userId;
    if (existingSocial.rows.length > 0) {
      userId = existingSocial.rows[0].user_id;
      await pool.query(
        `UPDATE user_social_logins SET access_token=$1, updated_at=NOW()
         WHERE provider=$2 AND provider_user_id=$3`,
        [accessToken, provider, providerUserId]
      );
    } else {
      // Check if user exists by email (must already have an account)
      const existingUser = await pool.query(
        `SELECT id FROM users WHERE email = $1 LIMIT 1`,
        [email.toLowerCase()]
      );
      if (existingUser.rows.length === 0) {
        // No existing account — redirect to register with pre-filled email
        return res.redirect(
          `${FRONTEND_URL}/register?email=${encodeURIComponent(email)}&social_provider=${provider}&error=account_required`
        );
      }
      userId = existingUser.rows[0].id;
      await pool.query(
        `INSERT INTO user_social_logins (user_id, provider, provider_user_id, email, access_token)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (provider, provider_user_id) DO NOTHING`,
        [userId, provider, providerUserId, email, accessToken]
      );
    }

    const { accessToken: at, refreshToken: rt } = issueTokens(userId);
    return res.redirect(
      `${FRONTEND_URL}/login/sso-callback?at=${encodeURIComponent(at)}&rt=${encodeURIComponent(rt)}`
    );
  } catch (err) {
    console.error(`Social ${req.params.provider} callback error:`, err);
    return res.redirect(`${FRONTEND_URL}/login?error=social_failed`);
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
    return res.status(500).json({ error: err.message });
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
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
