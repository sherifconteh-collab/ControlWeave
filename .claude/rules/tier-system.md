# Tier System (open-core)

ControlWeaver ships as open-core. By default (`COMMERCIAL_MODE` unset) every feature is available to every authenticated user with no seat limits, exactly like the fully open-source build. Setting `COMMERCIAL_MODE=true` turns on plan entitlements for SaaS or licensed self-hosted deployments.

## How entitlements work

- Plan catalog: `controlweave/backend/src/config/plans.js` (Community, Pro, Enterprise, Government) with features and user limits.
- Resolution: `services/entitlementService.js`, in this order:
  1. a valid self-hosted license key (`LICENSE_KEY` or activated via `/api/v1/license`); its seat count overrides the plan's user limit
  2. the organization's subscription (`organizations.tier` plus `billing_status` `active_paid`, `past_due`, `canceling`, `comped` or `license`), or an unexpired trial
  3. otherwise Community
- Gate a route with `requireFeature('<feature>')` from `services/entitlementService`. When the plan lacks the feature it returns HTTP 402 `{ code: 'plan_upgrade_required', feature, required_plan }`, and it is a no-op when commercial mode is off.
- Seats: call `assertSeatAvailable(orgId)` before creating or reactivating a user. It throws `code: 'SEAT_LIMIT'`; respond 402 (`seat_limit`).
- Billing: `routes/billing.js` (Stripe Checkout, customer portal, signed idempotent webhook).
- Licenses: `scripts/issue-license.js`. RSA-3072 RS256 keys are verified offline by `services/licenseService.js`.

Currently gated: `sso` (Pro), `connectors` (Pro), `hipaa_sra` (Pro), `scim` and `sso_enforcement` (Enterprise).

## Add-on modules

Some modules are sold on their own, outside every plan: `ADDONS` in `plans.js`. Today that is `erp` (feature `erp_governance`). An add-on is granted by the license key's `addons` claim, or by an `organization_addons` row (Stripe webhook or platform-admin grant), never by the plan tier. `requireFeature()` returns 402 `{ code: 'addon_required', required_addon }` for add-on features. The ERP routers gate every non-GET request at the router level; reads stay open. Do not add add-on features to a plan's `features` array.

## Rules for new code

- Core GRC stays in Community: frameworks, controls, evidence, assessments, financial audit readiness (RCM, control testing, NFRs), risks, POA&M, policies, reports and the audit trail. Do not gate it.
- Gate only features listed in `plans.js` `FEATURES`, and only with `requireFeature()`. Add a new feature key there first, and document it in `docs/COMMERCIAL_LICENSING.md`.
- Gate write or "start" actions, not reads: an organization that downgrades must still see and export its existing data.
- The legacy `requireTier()`, `requireProEdition()` and `checkTierLimit()` middleware remain no-ops. Do not revive them; use `requireFeature()`.
- Existing organizations were set to `enterprise` / `comped` by migration 106, so turning on commercial mode never removes features from them.

The `// @tier:` comment convention is historical and has no enforcement effect.
