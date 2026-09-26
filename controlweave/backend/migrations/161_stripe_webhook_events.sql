-- Migration 161: Stripe webhook idempotency
--
-- Stripe retries webhooks and can deliver an event more than once. Recording
-- each processed event id lets the billing webhook apply subscription changes
-- exactly once. Part of the open-core commercial mode (COMMERCIAL_MODE=true).

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
