'use strict';

/**
 * SAML 2.0 service provider (per organization) on @node-saml/node-saml.
 *
 * Each organization gets its own SP entity ID and ACS URL, so one deployment
 * can serve many IdPs:
 *   entity ID / metadata: {BACKEND_URL}/api/v1/sso/saml/{orgId}/metadata
 *   ACS (HTTP-POST):      {BACKEND_URL}/api/v1/sso/saml/{orgId}/acs
 *
 * Responses must be signed by the configured IdP certificate, addressed to
 * this SP (audience), unexpired, and - unless IdP-initiated sign-in is
 * enabled - answer an AuthnRequest this deployment issued (InResponseTo,
 * tracked in saml_request_cache so it works across replicas).
 */

const { SAML, ValidateInResponseTo } = require('@node-saml/node-saml');
const pool = require('../config/database');

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/+$/, '');
const REQUEST_TTL_MS = 10 * 60 * 1000;

const EMAIL_ATTRIBUTES = [
  'email', 'mail', 'emailAddress', 'Email',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  'urn:oid:0.9.2342.19200300.100.1.3'
];
const NAME_ATTRIBUTES = [
  'displayName', 'name', 'cn',
  'http://schemas.microsoft.com/identity/claims/displayname',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
  'urn:oid:2.16.840.1.113730.3.1.241'
];

// node-saml cache provider backed by Postgres (InResponseTo validation).
const cacheProvider = {
  async saveAsync(key, value) {
    await pool.query(
      `INSERT INTO saml_request_cache (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING`,
      [key, value]
    );
    await pool.query("DELETE FROM saml_request_cache WHERE created_at < NOW() - INTERVAL '1 hour'").catch(() => {});
    return { value, createdAt: Date.now() };
  },
  async getAsync(key) {
    const { rows } = await pool.query(
      `SELECT value FROM saml_request_cache
        WHERE key = $1 AND created_at > NOW() - ($2::int * INTERVAL '1 millisecond')`,
      [key, REQUEST_TTL_MS]
    );
    return rows[0] ? rows[0].value : null;
  },
  async removeAsync(key) {
    const { rows } = await pool.query('DELETE FROM saml_request_cache WHERE key = $1 RETURNING value', [key]);
    return rows[0] ? rows[0].value : null;
  }
};

function spUrls(organizationId) {
  const base = `${BACKEND_URL}/api/v1/sso/saml/${organizationId}`;
  return { entityId: `${base}/metadata`, metadataUrl: `${base}/metadata`, acsUrl: `${base}/acs` };
}

function normalizeCert(cert) {
  return String(cert || '')
    .replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, '');
}

function isSamlReady(config) {
  return Boolean(config && config.provider_type === 'saml' && config.saml_entry_point && config.saml_idp_cert);
}

function buildSaml(config) {
  const urls = spUrls(config.organization_id);
  return new SAML({
    entryPoint: config.saml_entry_point,
    issuer: config.sp_entity_id || urls.entityId,
    callbackUrl: urls.acsUrl,
    audience: config.sp_entity_id || urls.entityId,
    idpCert: normalizeCert(config.saml_idp_cert),
    idpIssuer: config.saml_idp_issuer || undefined,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    acceptedClockSkewMs: 2 * 60 * 1000,
    maxAssertionAgeMs: 10 * 60 * 1000,
    requestIdExpirationPeriodMs: REQUEST_TTL_MS,
    validateInResponseTo: config.saml_allow_idp_initiated ? ValidateInResponseTo.ifPresent : ValidateInResponseTo.always,
    cacheProvider,
    disableRequestedAuthnContext: true
  });
}

function firstAttribute(profile, names) {
  for (const name of names) {
    const value = profile[name] !== undefined ? profile[name] : (profile.attributes || {})[name];
    const single = Array.isArray(value) ? value[0] : value;
    if (typeof single === 'string' && single.trim()) return single.trim();
  }
  return null;
}

/** Email, display name and subject from a validated SAML profile. */
function identityFromProfile(profile, config) {
  const emailNames = config.saml_email_attribute ? [config.saml_email_attribute, ...EMAIL_ATTRIBUTES] : EMAIL_ATTRIBUTES;
  const nameNames = config.saml_name_attribute ? [config.saml_name_attribute, ...NAME_ATTRIBUTES] : NAME_ATTRIBUTES;
  let email = firstAttribute(profile, emailNames);
  if (!email && /@/.test(profile.nameID || '')) email = profile.nameID;
  const given = firstAttribute(profile, ['firstName', 'givenName', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname']);
  const family = firstAttribute(profile, ['lastName', 'sn', 'surname', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname']);
  const name = firstAttribute(profile, nameNames) || [given, family].filter(Boolean).join(' ') || email;
  return { email: email ? email.toLowerCase() : null, name, subject: profile.nameID };
}

async function getAuthorizeUrl(config, relayState) {
  return buildSaml(config).getAuthorizeUrlAsync(relayState || '', undefined, {});
}

async function validateResponse(config, body) {
  const { profile, loggedOut } = await buildSaml(config).validatePostResponseAsync({
    SAMLResponse: body.SAMLResponse,
    RelayState: body.RelayState
  });
  if (loggedOut || !profile) throw new Error('SAML response did not contain an assertion');
  await consumeAssertion(config.organization_id, profile);
  return profile;
}

/** The signed assertion's ID attribute, or null. */
function assertionId(profile) {
  const xml = typeof profile.getAssertionXml === 'function' ? profile.getAssertionXml() : '';
  const match = /<(?:[\w-]+:)?Assertion\b[^>]*?\sID="([^"]+)"/.exec(xml || '');
  return match ? match[1] : null;
}

/**
 * Accept each assertion once. An IdP-initiated response has no InResponseTo to
 * consume, so without this a captured response could be posted again until it
 * ages out (maxAssertionAgeMs). The ID is kept in saml_request_cache, shared by
 * every replica, for longer than an assertion can stay valid.
 */
async function consumeAssertion(organizationId, profile) {
  const id = assertionId(profile);
  if (!id) throw new Error('SAML assertion has no ID');
  const { rows } = await pool.query(
    `INSERT INTO saml_request_cache (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO NOTHING RETURNING key`,
    [`assertion:${organizationId}:${id}`, 'used']
  );
  if (!rows.length) throw new Error('SAML assertion was already used');
}

function metadata(config) {
  return buildSaml({ ...config, saml_entry_point: config.saml_entry_point || 'https://idp.invalid/sso', saml_idp_cert: config.saml_idp_cert || 'MIIB' })
    .generateServiceProviderMetadata(null, null);
}

module.exports = { spUrls, isSamlReady, getAuthorizeUrl, validateResponse, identityFromProfile, metadata, normalizeCert, cacheProvider, assertionId, consumeAssertion };
