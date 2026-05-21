---
description: Tier system — open source, no feature gates
globs:
  - "controlweave/backend/src/middleware/auth.js"
  - "controlweave/backend/src/middleware/edition.js"
  - "controlweave/backend/src/config/tierPolicy.js"
  - "controlweave/backend/src/routes/**"
---
# Tier System

ControlWeaver is open source. All features are available to all authenticated users — there are no paid tiers, feature gates, or upgrade prompts.

## What Was Removed

The original tier system (Community / Pro / Enterprise / Gov Cloud) has been fully removed:

- `requireTier()` and `requireProEdition()` middleware are no-ops — they always call `next()`
- `checkTierLimit()` middleware is a no-op
- All inline tier checks in route business logic have been removed
- Frontend `hasTierAtLeast()` always returns `true`
- Frontend `requiresBillingResolution()` always returns `false`
- Billing/Stripe infrastructure has been stubbed out (returns 410 Gone for checkout/portal)
- Database migration 106 set all organizations to `tier = 'enterprise'` with `billing_status = 'comped'`

## What Remains (Backward Compat Only)

- `organizations.tier` column still exists — value is informational only, not enforced
- `tierPolicy.js` still exports helper functions — all limits are set to unlimited (`-1`)
- `edition.js` still exports functions for backward compat — all checks pass through
- `EDITION` is hardcoded to `'open'`

## Adding New Features

All new features must be available to all authenticated users. Do **not** add `requireTier()` or `requireProEdition()` calls to new routes. The CI pipeline's TEVV-API-6 check no longer enforces tier gating — only RBAC (`requirePermission()`) remains as the access control layer.

The `// @tier: community` comment convention is kept for historical context but has no enforcement effect.
