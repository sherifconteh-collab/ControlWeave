'use strict';

/**
 * "Require single sign-on" (sso_configurations.enforce_sso), applied the same
 * way on every sign-in path that does not go through the organization's own
 * identity provider: password, passkey and social (Google, Microsoft, Apple,
 * GitHub) sign-in. Organization administrators and platform administrators
 * keep a break-glass path in case the IdP is unavailable.
 *
 * Fails closed: if the policy cannot be read, the sign-in is refused rather
 * than allowed. TEVV-SEC-7 checks that every token-issuing sign-in route calls
 * this helper.
 */

const pool = require('../config/database');

const SSO_REQUIRED_MESSAGE = 'Your organization requires single sign-on. Use "Sign in with SSO".';

/** True when this user must sign in through their organization's IdP. */
async function ssoRequiredFor(user) {
  if (!user || !user.organization_id) return false;
  if (user.is_platform_admin || user.role === 'admin') return false;
  const { rows } = await pool.query(
    'SELECT 1 FROM sso_configurations WHERE organization_id = $1 AND enabled = true AND enforce_sso = true LIMIT 1',
    [user.organization_id]
  );
  return rows.length > 0;
}

module.exports = { ssoRequiredFor, SSO_REQUIRED_MESSAGE };
