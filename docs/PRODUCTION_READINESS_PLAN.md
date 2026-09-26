# ControlWeaver: Production-Readiness & Commercialization Plan

## Context

You want to sell ControlWeaver as **hosted SaaS and as a self-hosted commercial license**, to **hospitals/clinics (HIPAA), SMB/mid-market (SOC 2), large enterprise, and US federal/DoD contractors (FedRAMP / CMMC)**, using an **open-core model** (core GRC stays AGPL; enterprise features need a paid plan or signed license key). Both repos are in scope: **ControlWeaver-Pro** (v4.11.3, the flagship product: 87 route files, 146 migrations, 101 pages) and **ai-grc-platform** (v4.2.2, the older community edition).

The audit found a strong base: HS384 JWT with a pinned algorithm list, bcrypt cost 14, 15-character password policy, account lockout, hashed reset tokens, AES-256-GCM encryption for sensitive fields, CSP/HSTS, an append-only audit log with a hash chain, OIDC SSO, TOTP, passkeys, data export, webhooks, a license-key service and dormant Stripe code.

It also found **stop-ship problems**: a public demo admin password is seeded into production on every boot, social login can take over accounts, and a generated admin password is written to the logs. CI blocks on almost nothing. And a buyer's security review would expect several things we don't have: SAML/SCIM, durable file storage, org deletion, a BAA/DPA, SECURITY.md, and multi-replica-safe operations.

A feature audit also found integrations that **fabricate results**: simulated connector runs, and placeholder "collected" evidence auto-linked to controls. It also found that the Policies module has no UI, that NIST 800-171 and HIPAA control content is incomplete, and that list pages cap at 100 rows with no sorting. Phase 1B addresses these.

Below, ControlWeaver-Pro backend paths are relative to `controlweave/backend/src/`. The work is ordered so every phase can ship on its own: **Phases 0–1 go first on `claude/control-weaver-production-ready-t82g2v` as one draft PR per repo.** Later phases follow as separate PRs, each one run against the relevant standard (OWASP ASVS L2, SOC 2 CC6–CC8, HIPAA §164.312, NIST 800-53 Moderate / 800-171).

---

## Phase 0: Stop-ship security fixes (Critical, first PR)

1. **Demo accounts off in production.**
   - `ensureDemoAccountsSeeded` (`server.js:794`) should default to off when `NODE_ENV=production`.
   - Move `ControlWeave!2026` out of `scripts/lib/demo-account-config.js` into the `DEMO_ACCOUNT_PASSWORD` env var.
   - Match demo users by exact email allow-list, not by domains like `healthcare.com`/`enterprise.com` (`isDemoEmail`, lines 283–305).
   - Remove the demo exemptions from lockout and TOTP (`routes/auth.js:769, 871`).
2. **Platform admin hardening.**
   - Delete the plaintext password log (`server.js:731`). A generated password should go only to a one-time reset link sent by email, or to stdout once and only when `PLATFORM_ADMIN_PRINT_ONCE=true`.
   - Stop re-activating and re-promoting the admin on every boot (`server.js:705`).
   - Remove the lockout and MFA exemptions for platform admins, and make `authenticate` reject inactive platform admins (`middleware/auth.js:171`).
3. **Social/OIDC account takeover.**
   - Link a social identity to an existing account only when the provider returns `email_verified === true` **and** the user confirms with their password or TOTP.
   - Always apply the TOTP step after SSO (`routes/sso.js:189–212, 356–415`).
4. **SSO token handoff.**
   - Stop putting tokens in the URL fragment. Use a one-time 60-second code that the frontend exchanges via POST.
   - `issueTokens` in `sso.js:29` should reuse the shared signer, which pins HS384.
5. **Refresh tokens.**
   - Add token-family reuse detection: replaying a rotated token revokes the whole family.
   - Reject plaintext refresh tokens (`auth.js:1161`) and check `is_active` on refresh.
6. **Proxy and rate limiting.**
   - Default `trust proxy` to `1` in production (`server.js:101`), so rate limits apply per client and not to Railway's proxy IP.
   - Require Redis in production and fail at startup when it's missing, instead of falling back to per-instance memory.
   - Reject `*` in `CORS_ORIGIN` when credentials are allowed.
7. **Repo secrets.**
   - Delete `test-login.js` and `DEMO_CREDENTIALS.md`.
   - Rotate the demo password on the live Railway deployment. **You'll need to do this; I can't.**
   - Run gitleaks over the full history and report what it finds.

## Phase 1: Engineering gates & repo hygiene (first PR)

- **CI must actually block.**
  - Add a `test` job that runs backend Jest and the Playwright spec against a Postgres 17 service.
  - Make gitleaks/TruffleHog, `npm audit --audit-level=high` and Trivy (pinned to a version, `exit-code: 1` on HIGH/CRITICAL) blocking in the `all-checks-passed` job of `.github/workflows/security-pipeline.yml`.
  - Run the backend `lint` script.
  - Pin `trivy-action`, and delete `azure-pipelines.yml`.
- **Coverage.**
  - Add `coverageThreshold` to `jest.config.js`, starting at the current baseline and ratcheting up.
  - Drop `--passWithNoTests`.
  - Add supertest integration tests for auth, SSO, refresh and org isolation, reusing `__tests__/_testUtils.js` patterns.
- **Migrations** (`scripts/migrate-all.js`):
  - Take `pg_advisory_lock` so concurrent deploys can't race.
  - **Fail** on checksum drift instead of overwriting the stored checksum.
  - Remove `MIGRATION_BASELINE_ON_ERROR` in production.
  - Add a CI check against new duplicate numbers. The existing duplicates (048/057/061/072/101) stay as they are; renumbering deployed files is forbidden.
- **Repo cleanup.** Move internal-only material into `docs/internal/` or delete it:
  - about 45 stale root `.md` files (`PHASE_*`, `PR_FINAL_STATUS`, etc.)
  - `.docx`/`.xlsx` business files (the lead tracker likely holds personal data)
  - `_preview_*.js`, `schema_updates.sql` (MySQL syntax), and the stale root `railway.json`/`nixpacks.toml`
- **Licensing** (needs your sign-off, and ideally a lawyer):
  - Reconcile the MIT `controlweave/LICENSE` with the root AGPL + commercial dual license.
  - Add a CLA workflow (port `ai-grc-platform/.github/workflows/cla.yml` and `CLA.md`).
  - Decide whether `public-mirror.yml` should exclude the enterprise directories.
- **Docker: keep the `npm ci || npm install` fallback**, because Railway needs it to boot. The likely reason strict `npm ci` fails is that `frontend/Dockerfile` copies `package*.json` but not `frontend/.npmrc`, which holds the `legacy-peer-deps=true` setting that Sentry + Next 16 need. The lockfiles may also drift from `package.json`.
  - Make the build compatible without removing the fallback: `COPY package*.json .npmrc ./` in both Dockerfiles.
  - Add a non-blocking CI step that runs a strict `npm ci` inside the Docker build, so we can see when a strict install would fail.
  - Remove the fallback later, only if that step stays green across several real Railway deploys and you approve.
  - Pin base images by digest, with Dependabot keeping the digests current.

## Phase 1B: Fix broken features & fill product gaps (second PR; highest customer impact)

The feature audit found that the core workflows are real and backed by the database: controls and crosswalks, assessments (PBC, workpapers, findings, signoffs), risks, POA&M, vulnerabilities and SBOM, incidents, PDF/Excel reports, RMF, and AI across six providers. The problems are concentrated in integrations and in missing UI.

**Integrity bugs.** These fabricate data and would break an audit, so they come first.
- `routes/integrationsHub.js:244`: "Run" writes hardcoded `simulatedResult` numbers and marks the run a success. `services/jobService.js:271`: `integration_sync` returns `{synced:true}` without doing anything.
  - Route runs through a real connector registry instead.
  - Connectors without a real client return `status: 'not_configured'` and are labeled "coming soon" in the UI.
  - Never write simulated counts or put them in audit logs.
- `routes/autoEvidenceCollection.js:339-380`: Sentinel, CloudTrail, CrowdStrike, Jira, ServiceNow and Custom create placeholder "collected" evidence and auto-link it to controls.
  - Stop creating evidence for sources without a real collector.
  - Flag any evidence already created that way (`metadata.simulated=true`) with a migration, and exclude it from compliance scoring.
  - Correct the claims in `routes/help.js:645`.
- `routes/tprm.js`: vendor and questionnaire create/update/delete, `/send` and `/remind` only require `organizations.read`. Change them to `tprm.write`, per `.claude/rules/tprm.md`.
- `routes/integrationsHub.js:~62`: the templates `catch` never sends a response, so requests hang.
- `routes/publicContact.js:78-146`: can email the shared demo password to anyone who submits the form. Remove that path.

**Make the existing integrations real.** These cover what enterprise and federal buyers ask for first.
- Wire in the three connector services that are written but never called: `awsSecurityHubService.js` (add `@aws-sdk/client-securityhub`), `qualysService.js` and `serviceNowService.js`.
- Add new connectors in order of value:
  1. **Okta** and **Microsoft Entra ID**, for MFA coverage, inactive users and access reviews.
  2. **Jira**, for remediation tickets synced with POA&M and findings.
  3. **Azure Defender** and **GCP Security Command Center**.
  4. **CrowdStrike**.
- Each connector: an encrypted credential, a real sync, evidence stamped with the source and a hash, and `pg_try_advisory_lock` so only one run happens at a time.
- **Continuous control monitoring.** Turn connector data into automated pass/fail control tests (for example, "MFA enabled for all users" or "S3 buckets encrypted"). `controlHealth.js` currently scores only status and evidence age.

**Content gaps for the target buyers.**
- **Federal/DoD:** add the full **NIST 800-171 Rev 3** set (about 97 requirements; only 24 today) through the existing OSCAL importer pattern in `scripts/import-oscal-*.js`. Add a **CMMC SPRS score calculator**, and **OSCAL export for POA&M and assessment results**; `oscalService.js` exports only the SSP today.
- **Hospitals and clinics:** the full **HIPAA Security Rule** implementation specifications, with required vs. addressable marked (22 standards today). Add a **HIPAA Security Risk Assessment** workflow modeled on the ONC SRA tool, and **BAA tracking** (a TPRM vendor flag, BAA document, expiry reminders). HITRUST is missing entirely; it's a later addition that may need licensing.
- **Commercial buyers:** complete **PCI DSS 4.0** (61 of more than 250 today), the CIS v8 safeguards, and ISO 42001 Annex A (26 of 38).
- **Employee security-awareness training tracking.** `training.js` today only teaches people how to use the product. Add assignments, completion and certificates, with CSV/LMS import.
- **Policy attestation campaigns.** Assign policies to employees or groups, send reminders, report on completion. The backend `policies.js` has only a single acknowledge endpoint.
- **Trust center.** Add a document library and NDA-gated access requests; the public page today shows only framework percentages.

**Frontend.** Data pages already call the API, and there is no mock data.
- **Policies UI.** The 1,250-line `routes/policies.js` has no page, `api.ts` client or sidebar entry. Build `app/dashboard/policies` with list, editor, versions, reviews and attestations.
- **One pricing message, following the open-core decision.**
  - Replace the "Free & Open Source forever" pricing block (`app/page.tsx:228,427`) and the "no paid tiers" text (`register/page.tsx:221`) with a Community/Pro/Enterprise/Gov plan table.
  - Make the settings, onboarding and license pages consistent with that table.
- **Update banner.** Show it only to platform admins on self-hosted installs (`components/DashboardLayout.tsx:~176`).
- **Pagination and sorting on the server.**
  - Evidence (hard limit of 100 at `evidence/page.tsx:215`), TPRM, assets, POA&M, exceptions, assessments.
  - One shared `DataTable` component providing sorting, pagination, multi-select bulk actions and CSV export, rolled out to risks, assets, incidents, exceptions and assessments.
- **Global search.** A Ctrl+K command palette covering navigation and records, plus a backend `/search` endpoint scoped by `organization_id`.
- **Mobile.** A responsive sidebar drawer (`components/Sidebar.tsx:351` is a fixed `w-64`), and `overflow-x-auto` on tables.
- **Navigation.**
  - Link the orphan pages: `frameworks/custom` (the custom framework builder), `reports/executive`, `ai-security`, `platform/managed-orgs`.
  - Merge the duplicates: `evidence/auto|pending` into evidence tabs, `vendor-risk` into TPRM, `cmdb` with `assets`, `settings/ai-keys`.
- **Onboarding checklist** widget on the dashboard.
- **Settings.** Split the 5,555-line `settings/page.tsx` into routed sub-pages.

## Phase 2: Enterprise identity & session controls

- **SAML 2.0 SSO.** `sso.js:145` currently returns "not implemented". Add it to `services/ssoService.js` using `@node-saml/node-saml`, with signed assertions, per-org IdP metadata and JIT provisioning.
  - Fix `provisionUser`, which currently looks up plaintext emails, so it uses `email_hash` and encrypted email. Encrypt social provider tokens.
- **SCIM 2.0** (`routes/scim.js`): Users/Groups endpoints for Okta and Entra ID, with per-org bearer tokens stored as hashes, and deprovisioning that revokes sessions.
- **Revocable sessions.**
  - Add `users.token_version` plus a `jti` claim, checked in `authenticate` (cached in Redis), so logout, deactivation and password change take effect immediately.
  - Move the refresh token from `localStorage` (`frontend/src/contexts/AuthContext.tsx:155`) into an `HttpOnly; Secure; SameSite=Strict` cookie, with CSRF double-submit on the refresh endpoint.
- **Federal and HIPAA session controls**, each configurable per org:
  - idle timeout: HIPAA automatic logoff; NIST AC-11/AC-12
  - concurrent-session limit (AC-10)
  - disabling inactive accounts after N days (AC-2(3))
  - a system-use banner shown at login (AC-8)
  - MFA enforcement for every user in an org
- **TOTP.**
  - Add replay protection: store the last used time step.
  - Count failed TOTP attempts toward lockout.
  - Make the lockout counter atomic with `UPDATE ... SET failed = failed + 1 RETURNING`.
- **RBAC tightening.**
  - Give `cmdb.js` per-route permissions; `/password-vaults` should need `cmdb.admin`.
  - Add `requirePermission` to `plot4ai`, `benchmarks`, `complianceGate` and `cmdbImport`.
  - Fix `performance.js`, which is missing `authenticate`.
  - Stop falling back to the admin `*` permission when loading permissions fails (`middleware/auth.js:255`).

## Phase 3: Data protection, HIPAA & tenant rights

- **Object storage.**
  - Add `services/storageService.js`, with an S3-compatible backend (the SDK is already installed but unused) using SSE-KMS, plus a local-disk driver for self-hosted installs.
  - Migrate `evidence.js` off `/app/uploads`, which is ephemeral on Railway.
  - Add a magic-byte check with the `file-type` package, reject `application/octet-stream`, and optionally scan with ClamAV (`CLAMAV_HOST`) before an upload is accepted.
- **Encryption key rotation.**
  - Add a key id to the envelope in `utils/encrypt.js`, supporting a keyring env var (`ENCRYPTION_KEYS=kid:key,...`).
  - Add a background re-encryption job.
  - Remove the silent plaintext passthrough in `decrypt` and the constant development key.
- **Postgres row-level security.**
  - Enforce it: change the policies from migration 104 so that an unset `app.org_id` returns no rows.
  - Route request queries through `withOrgContext`, which exists but is unused. Do this incrementally behind `RLS_ENFORCE`, starting with evidence, controls and audit_logs.
- **Tenant rights.**
  - Org deletion (GDPR Art. 17 / contract end): a 30-day soft-delete, then a purge job that respects legal holds and writes a deletion certificate.
  - Full export as a ZIP that includes evidence files.
  - A per-org data-residency tag.
- **HIPAA pack.**
  - Add `phi` to the `pii_types` classification and an org-level "PHI mode" setting. It audit-logs every PHI evidence read (§164.312(b)) and blocks sending PHI-tagged content to LLM providers unless the org records a BAA with that provider.
  - Redact PHI and PII before prompts in `services/llmService.js`.
  - Add break-glass emergency access (§164.312(a)(2)(ii)), which alerts the org admins.
- **Audit log integrity.**
  - Switch the hash chain from migration 147 to HMAC-SHA-384 with a server key.
  - Anchor the daily chain head by signing it and exporting it to S3 with Object Lock.
  - Revoke the app role's rights to disable the trigger (`jobService.js:200`) by moving purges into a SECURITY DEFINER function.
- **FIPS mode** (federal): `FIPS_MODE=true` turns on the OpenSSL FIPS provider (`crypto.setFips`) and refuses non-approved algorithms. We'll document that the product runs on FIPS 140-3 validated modules, not that it is itself validated.

## Phase 4: Operability & reliability

- **Health checks.** Split `/health/live` from `/health/ready`, which checks the DB and Redis and returns 503 on failure. Remove memory and Railway IDs from the public output.
- **Graceful shutdown** (`server.js:1111`): stop accepting new work, drain HTTP and WebSocket connections, close the pool, and force exit after 25 seconds.
- **Schedulers.** Wrap reminder, retention and backup sweeps in `pg_try_advisory_lock` so only one replica runs each. Today `pm_id` guards only PM2 workers, not Railway replicas.
- **Observability.**
  - Add the request ID to every log line through AsyncLocalStorage in `utils/logger.js`.
  - Add OpenTelemetry traces and metrics (`/metrics`, protected).
  - Wire the frontend Sentry DSN through env.
- **Backups and disaster recovery.**
  - Require off-box S3 storage in production for `scripts/db-backup.js`.
  - Add `docs/runbooks/backup-restore.md` with stated RPO/RTO, plus a monthly restore-test workflow.
  - Stand up a staging environment on Railway, with promotion through CI.
- **Tighter defaults.** Lower the API rate limit from 2000/min, and the auth limit from 100 per 15 minutes to 10 per 15 minutes per IP plus per account. Validate `FRONTEND_URL` and `BACKEND_URL` at startup. Add a frontend `.env.example`.

## Phase 5: Commercial model (open-core gating, SaaS + self-hosted)

- **Entitlements.**
  - Add one `services/entitlementService.js` that resolves an org's plan from **Stripe subscription status (SaaS)** or a **signed license key (self-hosted)**.
  - Revive the real bodies of `requireTier` (`middleware/auth.js:280`), `requireProEdition` and `isFeatureAvailable` (`middleware/edition.js`) and `TIER_LIMITS` (`config/tierPolicy.js`), all reading from that service.
  - Proposed split: **Community** is core GRC. **Pro** adds SAML, advanced AI and integrations. **Enterprise** adds SCIM, the HIPAA pack, RLS/residency, audit anchoring and white-label. **Gov** adds the FIPS mode and federal session controls.
- **Billing.** Rewrite the stubbed `routes/billing.js` to use the existing `services/stripeService.js` and `subscriptionService.js`, driven by webhooks with idempotency keys. Frontend `app/billing/*` pages already exist.
- **Migration** `150_restore_commercial_tiers.sql`: existing orgs stay `comped` (grandfathered), and new orgs start on community.
- **Licensing.** Port the hybrid RSA-3072 + ML-DSA-65 signing from `ai-grc-platform/backend/src/utils/pqc.js` into `services/licenseService.js`, with seat enforcement, grace periods and offline activation for air-gapped federal installs.
- **Repo rules.** Update `.claude/rules/tier-system.md`, `CLAUDE.md` and the TEVV-API-6 check to describe the new gating rules.
- **Customer API.**
  - Scoped, hashed personal and service API keys (`routes/apiKeys.js`).
  - Complete the OpenAPI spec, which covers only about 29 paths today, and serve it at `/api/docs`.
  - Upgrade webhooks to HMAC-SHA-384 with timestamps and replay protection.
- **Support impersonation.** Time-boxed, requires customer consent, audit-logged, read-only by default.
- **Usage metering.** Seats and AI tokens, reported to Stripe.

## Phase 6: Customer trust, legal & accessibility

- **Security disclosure.** Add `SECURITY.md` (port from ai-grc-platform) and `/.well-known/security.txt`.
- **Legal pages** in `frontend/src/app/`: terms of service, a DPA, a **BAA template**, a list of sub-processors (Railway, the LLM providers, Stripe, the email provider), and a cookie-consent banner.
- **Status page.** Add a public status endpoint and page, or link an external provider.
- **Accessibility.** Add `@axe-core/playwright` scans of the top 20 pages in CI, and fix what they find. Publish a VPAT (Section 508 matters for federal buyers). Add `loading.tsx`, `not-found.tsx` and segment error boundaries.
- **Trust package** in `docs/trust/`:
  - our own SOC 2 / HIPAA / NIST control mapping, generated with ControlWeaver itself (the OSCAL export exists)
  - pre-filled SIG Lite and CAIQ questionnaires
  - an architecture and data-flow diagram
  - an incident response plan
  - SBOMs, which CI already generates
- **Outside the code, but needed to close deals:** a third-party penetration test, a SOC 2 Type I and then Type II audit, cyber insurance, and a FedRAMP 20x / StateRAMP path. I'll produce the evidence and documents; the audits have to be purchased.

## Phase 7: ai-grc-platform (community edition)

- Apply the Phase 0 fixes that exist there: check its demo seeding, SSO linking, refresh reuse and token handoff. Also apply the Phase 1 CI gates (make `security.yml` blocking and run jest).
- Position it as the Community edition: sync the license and README, and link to the commercial offering.
- Keep its `@tier` marker rules consistent with the new entitlement model.

---

## Key files (ControlWeaver-Pro)

- **Auth and SSO:** `middleware/auth.js`, `routes/auth.js`, `routes/sso.js`, `services/ssoService.js`, `utils/totp.js`, `config/security.js`, and `frontend/src/contexts/AuthContext.tsx`.
- **Boot and ops:** `server.js`, `middleware/rateLimit.js`, `utils/logger.js`, and `scripts/migrate-all.js`.
- **Data:** `utils/encrypt.js`, `routes/evidence.js`, `services/jobService.js`, `routes/orgSettings.js` (export and cancel), and `services/llmService.js`.
- **Commercial:** `middleware/edition.js`, `config/tierPolicy.js`, `routes/billing.js`, `services/stripeService.js`, and `services/licenseService.js`.
- **CI:** `.github/workflows/security-pipeline.yml` and `ci.yml`.

## Verification (every phase)

- **Local checks:** `npm run check:syntax`, `npx jest --coverage` and `npm run lint` in the backend; `npm run typecheck`, `npm run lint` and `npm run build` in the frontend.
- **Integration tests:** supertest against a local Postgres 17. `npm run migrate` must run twice cleanly, with the lock tested by running two in parallel.
- **Phase 1B tests:**
  - A connector with no real client returns `not_configured` and writes no run counts or evidence.
  - A user with only `tprm.read` gets 403 on vendor POST, PATCH, DELETE and `/send`.
  - The evidence list pages past 100 items.
  - Playwright covers the Policies page, the Ctrl+K search and the mobile drawer at 390px width.
- **Phase 0 regression tests:**
  - a demo account doesn't exist when `NODE_ENV=production`
  - social login with `email_verified=false` can't link to an existing account
  - replaying a refresh token revokes its family
  - no tokens appear in redirect URLs
  - a grep of the logs finds no passwords
- **End to end:** run the app (`/run` skill) and drive login, MFA, SSO, evidence upload and export with Playwright. Scan with ZAP against the local stack.
- **CI:** it must be green with the new blocking gates. Deliberately break one gate (for example, a fake secret) on a scratch commit to prove it blocks, then revert.
- **Docs:** update per `.claude/rules/doc-review.md` for each PR.
