-- Migration 160: SAML 2.0 single sign-on, SSO domain discovery and SCIM 2.0
--
-- Enterprise, hospital and federal buyers require SAML sign-in through their
-- identity provider and automatic user provisioning and deprovisioning
-- (SCIM) from it; both were missing (SAML returned "not implemented").
--
-- * sso_configurations gains the SAML identity provider settings and an
--   option to require SSO instead of passwords for the organization.
-- * sso_email_domains maps an email domain to the organization whose IdP
--   signs its users in. A domain belongs to one organization only.
-- * saml_request_cache stores outstanding AuthnRequest ids so responses are
--   validated against a request this deployment sent (InResponseTo), across
--   replicas.
-- * scim_tokens holds hashed bearer tokens for the IdP's SCIM client.
-- * users.scim_external_id keeps the IdP's identifier for a provisioned user.
-- * user_social_logins accepts the oidc and saml providers (see the end).

ALTER TABLE sso_configurations
  ADD COLUMN IF NOT EXISTS saml_entry_point TEXT,
  ADD COLUMN IF NOT EXISTS saml_idp_issuer TEXT,
  ADD COLUMN IF NOT EXISTS saml_idp_cert TEXT,
  ADD COLUMN IF NOT EXISTS saml_email_attribute TEXT,
  ADD COLUMN IF NOT EXISTS saml_name_attribute TEXT,
  ADD COLUMN IF NOT EXISTS saml_allow_idp_initiated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enforce_sso BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS sso_email_domains (
  domain TEXT PRIMARY KEY CHECK (domain = lower(domain) AND domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sso_email_domains_org ON sso_email_domains (organization_id);

CREATE TABLE IF NOT EXISTS saml_request_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saml_request_cache_created ON saml_request_cache (created_at);

CREATE TABLE IF NOT EXISTS scim_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_scim_tokens_org ON scim_tokens (organization_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS scim_external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_org_scim_external_id
  ON users (organization_id, scim_external_id) WHERE scim_external_id IS NOT NULL;

-- Organization SSO links a user through user_social_logins, whose provider
-- check (migration 041) only allowed the social providers, so an OIDC sign-in
-- could never complete. Allow the organization SSO providers.
ALTER TABLE user_social_logins DROP CONSTRAINT IF EXISTS user_social_logins_provider_check;
ALTER TABLE user_social_logins ADD CONSTRAINT user_social_logins_provider_check
  CHECK (provider IN ('google', 'microsoft', 'apple', 'github', 'oidc', 'saml'));
