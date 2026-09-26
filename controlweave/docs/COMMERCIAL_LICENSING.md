# Commercial Licensing and Billing (Open-Core)

ControlWeave runs in one of two modes.

| Mode | Setting | Behavior |
|---|---|---|
| Open source (default) | `COMMERCIAL_MODE` unset or `false` | Every feature is available and there are no user limits. The plan page says so. |
| Commercial | `COMMERCIAL_MODE=true` | Plans, seat limits and gated features are enforced for SaaS subscriptions or self-hosted licenses. |

## Plans

| Plan | Users | Adds |
|---|---|---|
| Community (free) | 10 | Core GRC: frameworks and crosswalks, controls, evidence, assessments and audits, financial audit readiness (risk-control matrix, control testing, NFRs), risks, POA&M, policies, reports, audit trail, AI with your own keys |
| Pro | 100 | Single sign-on (SAML/OIDC), connectors (Okta, Entra ID, Jira, AWS Security Hub, Qualys, ITSM), HIPAA security risk assessment |
| Enterprise | Unlimited | SCIM provisioning, Require SSO, priority support |
| Government | Unlimited | Enterprise, delivered as a self-hosted license for federal and defense environments |

The catalog is defined in `backend/src/config/plans.js`.

## Add-on modules

Add-ons are licensed separately from the plan. They are not included in any plan, Enterprise and Government included, and they can be added to any plan, Community included.

| Add-on | Key | Feature | Stripe lookup keys | Covers |
|---|---|---|---|---|
| ERP Governance | `erp` | `erp_governance` | `erp_monthly`, `erp_annual` | ERP connectors (Workday, SCIM for Oracle Fusion Cloud and SAP Cloud Identity Services, Oracle E-Business Suite) and CSV/SAP table imports, function-level SoD, access certification with manager routing and revocation tickets, emergency access review, scheduled syncs, and transaction and configuration monitoring |

- **SaaS:** administrators add the module from **Plan & Billing → Add-on modules**. It opens its own Stripe Checkout, so it is a separate subscription from the plan. The webhook records it in `organization_addons` and never changes the plan for an add-on-only subscription.
- **Self-hosted:** issue the license with `--addons erp`. The key's `addons` claim grants the module, whatever the tier.
- **Complimentary:** a platform administrator can grant or revoke an add-on for an organization, for a set number of months or open-ended, with `PUT /api/v1/platform-admin/organizations/:id/addons/:addon` (`{ "action": "grant", "months": 12 }`).

Without the add-on, every change under `/api/v1/erp` (creating systems, imports, syncs, analysis, reviews and their decisions, monitoring runs, baselines, exception updates) returns HTTP 402 with `code: "addon_required"` and `required_addon: "erp"`. Reads and exports stay open, so an organization whose add-on lapses can still see and export what it recorded. Scheduled syncs for a lapsed organization are skipped and resume when the add-on is back. The ERP pages show what the module does and link to the plan page.

Financial audit readiness (risk-control matrix, control testing, sampling, NFRs and readiness) is core GRC and stays in Community.

Downgrading never hides existing data. Only starting new gated work is blocked, for example creating a SCIM token or starting a new HIPAA assessment. Those requests return HTTP 402 with `code: "plan_upgrade_required"`.

Organizations that existed before commercial mode are `enterprise` / `comped` (migration 106), so they keep every feature.

Plans are read from the organization on every check, so an upgrade, cancellation, trial expiry or platform-admin change applies at once on every server instance. License signature checks are the only thing remembered between requests, for up to a minute, and a new or removed license key applies at once.

## SaaS: Stripe

1. Create products in Stripe with recurring prices whose lookup keys are `pro_monthly`, `pro_annual`, `enterprise_monthly` and `enterprise_annual`, plus `erp_monthly` and `erp_annual` for the ERP Governance add-on.
2. Set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` and `STRIPE_WEBHOOK_SECRET`, plus `COMMERCIAL_MODE=true`.
3. Add a webhook endpoint `https://<backend>/api/v1/billing/webhook` for these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Enable the Stripe customer portal. Plan changes, payment methods, invoices and cancellation happen there.

Administrators choose a plan under **Plan & Billing**, which opens Stripe Checkout. Webhooks are signature-verified and processed once each (`stripe_webhook_events`). They set `organizations.tier` and `billing_status`:

| Stripe subscription status | `billing_status` |
|---|---|
| active | `active_paid` |
| active, set to cancel at period end | `canceling` |
| trialing | `trial` |
| past_due (still entitled during dunning) | `past_due` |
| canceled or unpaid | `canceled`, which means Community |

## Self-hosted: license keys

License keys are RS256 JWTs signed with an RSA-3072 key held only by the vendor. They are verified offline, so air-gapped installs work.

```bash
# once, on an offline machine
node scripts/issue-license.js keygen --out ./license-keys
# per customer
node scripts/issue-license.js issue --key ./license-keys/license-private.pem \
  --licensee "Acme Health" --tier enterprise --seats 250 --maintenance 2027-12-31
# the same, with the ERP Governance add-on
node scripts/issue-license.js issue --key ./license-keys/license-private.pem \
  --licensee "Agency X" --tier govcloud --seats -1 --addons erp
```

The customer deployment sets:

- `COMMERCIAL_MODE=true`
- `CONTROLWEAVE_LICENSE_PUBKEY` to the contents of `license-public.pem`
- `LICENSE_KEY` to the issued key, or an administrator activates the key under Settings → License

A license applies to the whole deployment. Its `--seats` value replaces the plan's user limit, and `-1` means unlimited. Omit `--expires` for a perpetual license. `--maintenance` records how long the customer is entitled to updates and support; it does not switch anything off.

## Seats

A seat is an active user. Creating a user, accepting an invitation, SSO just-in-time provisioning, SCIM provisioning and reactivating a user are all refused once the limit is reached. The refusal is HTTP 402 with `code: "seat_limit"`, or a SCIM 403 error. Deactivated users do not count.

## Not included yet

- Usage metering (AI tokens) to Stripe.
- Hybrid post-quantum (ML-DSA) license signatures. The community edition has an implementation in `utils/pqc.js`; RSA-3072 meets current NIST and CNSA 1.0 guidance.
