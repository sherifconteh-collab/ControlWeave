-- Migration 168: separately licensed add-on modules
--
-- Why: ERP Governance is sold as its own module rather than as part of a
-- plan, so an organization on any plan (Community included) can add it, and
-- an Enterprise organization does not get it without buying it. The plan
-- stays on organizations.tier; add-ons live here, one row per organization and
-- add-on, kept in sync by the Stripe webhook (source 'subscription') or
-- granted by a platform administrator (source 'comped'). Self-hosted
-- deployments license add-ons through the license key's `addons` claim and do
-- not use this table. Only consulted when COMMERCIAL_MODE=true.
-- Ships with the ERP Governance add-on release.

CREATE TABLE IF NOT EXISTS organization_addons (
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  addon                  TEXT NOT NULL CHECK (addon ~ '^[a-z][a-z0-9_]{1,39}$'),
  status                 TEXT NOT NULL CHECK (status IN ('active', 'trial', 'past_due', 'canceling', 'canceled', 'comped')),
  source                 TEXT NOT NULL DEFAULT 'subscription' CHECK (source IN ('subscription', 'comped')),
  stripe_subscription_id TEXT,
  trial_ends_at          TIMESTAMPTZ,
  expires_at             TIMESTAMPTZ,
  granted_by             UUID REFERENCES users(id) ON DELETE SET NULL,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, addon)
);

CREATE INDEX IF NOT EXISTS idx_organization_addons_subscription
  ON organization_addons (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
