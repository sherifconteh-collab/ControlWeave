-- Migration 101: Device Push Tokens
-- Stores APNs (iOS) and FCM (Android) device tokens for push notification delivery.
-- Each device token is globally unique — a token is reassigned to the most recent
-- authenticated user on registration, preventing cross-account push delivery on
-- shared or re-used devices.
--
-- Platform must be 'ios' or 'android'; additional platforms can be added via
-- a future migration rather than widening the CHECK constraint here.

CREATE TABLE IF NOT EXISTS device_push_tokens (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token            text        NOT NULL,
  platform         text        NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user ON device_push_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_device_push_tokens_org  ON device_push_tokens (organization_id);

COMMENT ON TABLE device_push_tokens IS
  'APNs and FCM device tokens for iOS/Android push notification delivery. '
  'One row per device token. Tokens are upserted on app launch and reassigned '
  'to the most recent authenticated user, ensuring a device only receives pushes '
  'for the currently logged-in account.';
