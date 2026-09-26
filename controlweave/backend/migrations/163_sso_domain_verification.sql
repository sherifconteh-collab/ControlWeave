-- Migration 163: SSO email domain verification
--
-- An organization's email domains route "Sign in with SSO" (discovery by
-- email address) to that organization's identity provider. Until now a claim
-- was accepted when the admin's own address was on the domain, and the first
-- organization to claim a domain held it. Neither proves control of the
-- domain: an address on a domain is not ownership of it, and a squatter could
-- block the real owner or route its users to an IdP the squatter runs.
--
-- A claim is now pending until the organization publishes a DNS TXT record
-- carrying its verification token (routes/sso.js, POST /sso/domains/verify).
-- Only verified domains are used for discovery, and a domain can be verified
-- by one organization only; unverified claims no longer block anyone.
-- Existing claims start unverified: discovery for them resumes once the TXT
-- record is published and verified. Supports NIST 800-53 IA-2 and IA-8.

ALTER TABLE sso_email_domains
  ADD COLUMN IF NOT EXISTS verification_token TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

UPDATE sso_email_domains
   SET verification_token = encode(gen_random_bytes(16), 'hex')
 WHERE verification_token IS NULL;

ALTER TABLE sso_email_domains ALTER COLUMN verification_token SET NOT NULL;

-- Several organizations may hold a pending claim; one may hold it verified.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sso_email_domains_pkey'
              AND conrelid = 'sso_email_domains'::regclass
              AND array_length(conkey, 1) = 1) THEN
    ALTER TABLE sso_email_domains DROP CONSTRAINT sso_email_domains_pkey;
    ALTER TABLE sso_email_domains ADD CONSTRAINT sso_email_domains_pkey PRIMARY KEY (domain, organization_id);
  END IF;
END $$;

-- SECURITY: one verified owner per domain, so no other tenant can route that
-- domain's users to its own IdP.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sso_email_domains_verified
  ON sso_email_domains (domain) WHERE verified_at IS NOT NULL;
