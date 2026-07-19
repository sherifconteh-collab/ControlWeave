# 📋 Release Notes

## Version 4.7.0 — July 19, 2026


### Added

- **GitHub Evidence Connector**: `services/githubService.js` and `routes/github.js` add a real GitHub REST API client — org-scoped token settings (`Settings → Integrations → GitHub`), a test-connection check, a one-time import endpoint, and a full `code_scanning_alerts` / `dependabot_alerts` / `audit_log` / `pull_requests` source for Auto-Evidence Collection Rules. GitHub now performs genuine live data retrieval (like Splunk), not just configuration-record evidence.
- Dynamic per-source-type configuration fields in the Auto-Evidence rule creation form (`dashboard/evidence/auto/page.tsx`), including a GitHub event-type dropdown, replacing free-text inputs.

### Fixed

- **`evidence_collection_rules` accepted only `splunk`/`connector`**: migration `088`'s `source_type` CHECK constraint never matched the app's own `ALLOWED_SOURCE_TYPES` allowlist (`microsoft_sentinel`, `aws_cloudtrail`, `crowdstrike`, `jira`, `servicenow`, `github`) <!-- ip-hygiene:ignore --> — creating a rule with any of those source types threw a raw Postgres constraint violation. Fixed in migration `125`.
- **Auto-Evidence rule creation form silently discarded its configuration**: `RuleForm`'s submit handler always sent `source_config: {}` regardless of source type, so no rule created through the UI (Splunk included) was ever actually functional. Fixed generically using the already-fetched `/auto-evidence/sources` `configFields` metadata.

### Security

- **GitHub and Splunk connector tokens were stored in plaintext**: both `githubService.js` and the pre-existing `splunkService.js` set `organization_settings.is_encrypted = true` on save but never actually called `encrypt()`/`decrypt()` from `utils/encrypt.js` — the stored value was plain text despite the flag. Both now encrypt at rest (AES-256-GCM); `decrypt()` transparently falls back to legacy plaintext rows, so no migration is required.

---

---

## Version 4.6.1 — Improvements & Bug Fixes

### Overview

This release includes 1 improvement and 2 bug fixes.

### Changed
- Auto-fix stale content in docs [skip ci]

### Fixed
- Correct evidence column name in pending assessment scan (#619)
- Remove tier/pricing gating from registration page (#616)



---

## Version 4.6.0 — New Features, Improvements, & Bug Fixes

### Overview

This release includes 1 new feature, 1 improvement, and 1 bug fix.

### Added
- Connector-to-control AI auto-assessment with approval workflow (#612)

### Changed
- Auto-fix stale content in docs [skip ci]

### Fixed
- Address two real bugs in #568's scheduled report delivery (#611)



---

## Version 4.5.1 — Improvements

### Overview

This release includes 3 improvements.

### Changed
- Fix stale controls count and paid-tier language in FRAMEWORK_COVERAGE.md (#610)
- Auto-fix stale content in docs [skip ci]
- Reconcile controls count and Wave 1 status after #576/#586 (#607)



---

## Version 4.5.0 — New Features, Improvements, & Bug Fixes

### Overview

This release includes 2 new features, 1 improvement, and 2 bug fixes.

### Added
- Complete NIST 800-53 to 300 official base controls (#576)
- Complete CMMC 2.0 to all 110 Level 2 practices (#586)

### Changed
- Auto-fix stale content in docs [skip ci]

### Fixed
- Close gaps found in README feature-claim verification (#568)
- Encrypt demo account emails in seed-demo-accounts.js (#599)



---

## Version 4.4.2 — Improvements & Bug Fixes

### Overview

This release includes 2 improvements and 1 bug fix.

### Changed
- Auto-fix stale content in docs [skip ci]
- Add framework catalog completion plan (waves 1-4) (#565)

### Fixed
- Record and display control test-result history (#581)



---

## Version 4.4.1 — Improvements & Bug Fixes

### Overview

This release includes 1 improvement and 1 bug fix.

### Changed
- Auto-fix stale content in docs [skip ci]

### Fixed
- Overhaul QA/test scripts and fix bugs they surfaced (#594)



---

## Version 4.4.0 — July 14, 2026

### Changed

- **Documentation consolidation and accuracy pass**: merged ~85 redundant root-level historical/summary docs (phase summaries, security-audit snapshots, CI/CD guides, MCP guides, tracking docs, etc.) into single up-to-date topic files, deleting the originals. Removed the orphaned, never-synced `controlweave/docs/wiki-v2/` directory (the real GitHub Wiki source is `controlweave/docs/wiki/`).
- **Removed stale tier/billing language across `controlweave/docs/`**: dozens of guides, the real wiki source tree, `SELF_HOSTED_INSTALL.md`, and the Settings page itself still described a removed Community/Pro/Enterprise/Gov Cloud pricing model — "Pro tier required", "Enterprise tier and above", "Available Plans", Stripe Checkout/Customer Portal flows, per-tier AI request caps, and per-tier framework limits. All of it contradicted `.claude/rules/tier-system.md` (tier gating was fully removed in v4.0). Rewrote the affected sections to describe the actual behavior: every feature is available to every authenticated user, with no tier-based limits anywhere.
- **`SELF_HOSTED_INSTALL.md` rewritten**: previously described a defunct "community mirror vs. commercial Docker image" distribution split with paid license-key feature unlocks. This repository is the only build; rewrote the guide to describe the real single-build, dual-license (AGPL v3 / commercial) model.
- **Settings → Account → Cancel Account corrected** (docs and UI copy): previously claimed cancellation "downgrades to the Community tier" with fabricated consequences (framework limit, reduced AI quota). The real `/account/cancel` endpoint cancels an active Stripe subscription if one exists and writes a legacy `tier`/`billing_status` bookkeeping field, but has no effect on feature access.
- **`.claude/commands/route-scaffold.md` fixed**: the route-scaffolding playbook still instructed future routes to call `requireTier()`, directly contradicting `tier-system.md`'s "do not add tier gating to new routes" rule. Updated to scaffold `requirePermission()`-based access control instead.

---

## Version 4.4.0 — July 14, 2026

### Added

- **Claude-triggered PR documentation review** (`claude-doc-review.yml`), added alongside the existing Copilot code-review bot — later superseded in this same release cycle by live in-session doc review (see below) once it became clear the session already had everything needed to do real reviews without a separate GitHub Action.
- Live, in-session PR doc-review process (`.claude/rules/doc-review.md`): whenever a subscribed session notices a meaningfully-sized doc-relevant diff, it reviews the affected `docs/guides/*.md`/`docs/*.md` pages against the real code change, fixes genuine discrepancies directly, and records the review in `controlweave/docs/doc-review-log/PR-<number>.md` plus a PR comment.

### Fixed

- **Auth — timing-safe login**: the "user not found" branch on login returned immediately with no dummy `bcrypt.compare`, while a wrong-password attempt against a real account cost a full cost-14 compare — a classic email-enumeration timing oracle. Both paths now cost the same.
- **Password complexity now enforced on registration and reset**, not just invite-acceptance.
- **Failed logins and account lockouts are now audit-logged** (previously only successful logins were).
- **`bcrypt.getRounds()` crash guard**: a malformed password hash could throw and 500 a correct-password login; now guarded with a fallback, matching the sibling `ai-grc-platform` repo.
- **JWT signing aligned to HS384** (from HS256) with a transitional `['HS384','HS256']` verify allow-list so existing sessions keep working until they expire naturally; token hashing moved to SHA-384 with legacy SHA-256 acceptance, matching `ai-grc-platform`'s CNSA Suite 1.0 posture.
- **Redis rate-limiter no longer permanently downgrades to memory-only** after a single transient Redis error — added cooldown/re-probe logic.
- **`passkeys.js` now signs JWTs with an explicit algorithm** instead of relying on the library default.
- **Registration race on duplicate email now returns 409** instead of a generic 500; `organization_name` is now sanitized like `email`/`full_name`.
- **RBAC — closed two privilege-escalation paths**: `POST/PUT /roles` and `POST /roles/assign` previously let any `roles.manage` holder create or assign a role (including the built-in `admin` role) granting permissions they didn't already hold; `PATCH /users/:userId` let any `users.manage` holder promote any user — including themselves — to `admin`. Both now require the acting user's own permissions to be a superset of what's being granted, and self-promotion to `admin` is blocked outright. Role/permission changes are now audit-logged.
- **`ROLE_FALLBACK_PERMISSIONS` fail-open bug fixed**: the legacy `admin`/`auditor`/`user` permission floor was unconditionally unioned onto real custom-role permissions, silently defeating the shipped `auditor_observer` role's `assessments.write` restriction. Now a true fallback, applied only when a user has zero rows in `role_permissions`.
- **Seeded previously-unseeded-but-referenced permissions** (`ai.read`, `ai.write`, `organizations.write`) — every non-admin user was silently 403'd on AI-governance/monitoring endpoints and most of the Organizations write surface.
- **Auditor Workspace public share page**: `/auditor-workspace/shared/[token]` didn't render the engagement's `name`; the public `GET /auditor-workspace/public/:token` query leaked unwhitelisted internal columns (`organization_id`, `created_by`, `lead_auditor_id`) to an anonymous token holder — fixed to an explicit column whitelist. The share-URL token is now `encodeURIComponent`-escaped before being interpolated into the API request (closed a CodeQL-flagged "uncontrolled data in network request" finding on the companion `ai-grc-platform` PR).
- **AI feature task-profile wiring**: 14+ `chat()`/LLM call sites across `services/ai/features/*.js` never passed a `feature` parameter, silently making their `FEATURE_TASK_PROFILE` model/temperature tuning dead code; `generateAuditFindingDraft` additionally skipped forced-JSON mode. All fixed.
- **`evidence_suggest`/`audit_finding_draft` structured AI output** now renders through dedicated `StructuredOutput` cards instead of falling through to a raw JSON dump.
- **AI routes without a configured provider now return the structured `NO_PROVIDER_CONFIGURED` envelope** instead of a generic 500, so the frontend can show a "configure a provider" prompt instead of an unhelpful error.

---

## Version 4.3.0 — July 10, 2026


### Added

- **RMF Leveraged Authorizations**: RMF packages can now inherit controls and authorization posture from COTS/SaaS products, following the FedRAMP-style leveraged-authorization model. New table `rmf_leveraged_authorizations` (migration 111) links `rmf_packages` to `cots_products` with inheritance type (full/partial/hybrid), an inherited-control list, shared-responsibility notes, and expiration tracking. New route module `routes/rmfInheritance.js` provides CRUD, an eligible-products lookup, and at-risk flagging when the underlying COTS product is deprecated/retired or its authorization has lapsed.
- **Customer Responsibility Matrix (CRM) export**: generate a CRM as JSON, CSV, or PDF directly from a package's leveraged authorizations.
- **OSCAL SSP export**: export an RMF package as a NIST OSCAL 1.1.2 System Security Plan, including leveraged authorizations and per-control shared-responsibility annotations (`services/oscalService.js`).
- **Trust Center**: organizations can publish an opt-in, token-gated public page showing aggregate framework compliance and active-authorization counts (migration 112, `routes/trustCenter.js`, public page at `/trust/[token]`).
- **Classroom mode**: guided, step-by-step training scenarios (migration 113, `routes/training.js`, `dashboard/training`) with three built-in templates plus an instructor progress view.
- **Anonymized industry benchmarking**: compare framework compliance against a k-anonymity-guarded peer aggregate (minimum 5 participating organizations), with an org-level opt-out (`routes/benchmarks.js`, `dashboard/reports`).
- **Compliance-as-code CI gate**: `GET /compliance/gate` returns HTTP 200/412 based on whether framework compliance meets a threshold, for direct use in CI pipelines with a service-account token.
- **Cyber Resilience module**: BC/DR, incident-response, and ransomware-playbook plan tracking with tabletop/functional/full-scale exercise logging and RTO/RPO attainment (migration 114, `routes/cyberResilience.js`, `dashboard/resilience`). A computed Cyber Resilience Score blends plan coverage, test cadence, RTO/RPO attainment, and existing backup-log health.
- COTS products gained `authorization_status`, `authorization_impact_level`, and `external_authorization_id` fields.

### Changed

- `GET /rmf/packages`, `/rmf/packages/:id`, and `/rmf/summary` now include leveraged-authorization counts and at-risk entries.
- **LLM provider/model catalog refreshed**: `providerConfig.js`'s `PROVIDERS` and `TASK_PROFILES`, plus every other place in the codebase that independently hardcoded a copy of the same model list (routing/fallback logic in `modelRouter.js` and `keyResolution.js`, quota-downgrade paths in `multiAgentOrchestrator.js`, API-key connectivity-check pings in `orgSettings.js`/`platformAdmin.js`, and the BYOK provider-picker UI in three frontend settings pages/components), now reference current model IDs across all six providers. Groq's entire prior lineup (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768`, `gemma2-9b-it`, `deepseek-r1-distill-llama-70b`) had been fully deprecated/decommissioned upstream and is replaced with `openai/gpt-oss-120b`/`20b`, `groq/compound`, `groq/compound-mini`, and `meta-llama/llama-4-scout-17b-16e-instruct`.
- **TEVV-DB-6/7 checks made real**: the `tevv-db` job's "syntactically valid SQL" and "unclosed DO block" checks previously never failed the build regardless of what they found, due to an uninitialized `FAILED` flag; TEVV-DB-6 also only scanned `migrations/07*.sql`/`08*.sql`, missing migration 104 (the RLS bug below) entirely. Both fixed, and TEVV-DB-6's detection logic replaced: its `DO \$\$`/`END \$\$` regex relied on a POSIX-basic-regex quirk that meant it almost never matched a real dollar-quoted block, so it now counts literal `$$` token pairs instead.
- **`tevv-db` job now runs real migrations**: added a `postgres:17` service container and an actual `npm run migrate` step to the job branded "Database & Migration Integrity," which previously never touched a database — pure grep over `.sql` text.
- **`security-pipeline.yml`'s migration step un-neutered**: `run: npm run migrate || echo "Migrations skipped for CI"` swallowed any real failure unconditionally; now a migration failure actually fails the build.

### Fixed

- **Row-Level Security was silently broken**: migration `104_row_level_security.sql` used invalid `ROW SECURITY` syntax (should be `ROW LEVEL SECURITY`) and had a dollar-quoting bug that broke policy creation for `evidence`/`audit_engagements`/`controls` — found and fixed by actually executing the full migration chain against a real Postgres instance for the first time.
- **AIBOM now genuinely derived from code**: `scripts/generate-aibom.js` previously hardcoded 4 of its 6 AI providers as fabricated "service" entries with made-up model lists (e.g. `gemini-1.5-pro`, which never matched the real `providerConfig.js` models); rewritten to derive the provider/model inventory from the live `PROVIDERS` object so it can no longer drift from the actual integration.
- **CodeQL `js/missing-rate-limiting`**: added an explicit per-router rate limiter to each of the six new route files (matching the existing `trustCenter.js` pattern), for parity with the companion `ai-grc-platform` fix — every flagged route was already covered by the app-wide `apiRateLimiter` mounted on `/api/v1`, which CodeQL's cross-file analysis can't trace; this closes the detection gap and adds a real second layer of defense.
- **Per-router rate limiter ran before `authenticate`**: the six new route files applied their org-scoped rate limiter ahead of `authenticate`, so `req.user` was always unset when the limiter's key was built and every request silently fell back to a shared IP-based bucket instead of an org-scoped one. Fixed with a 3-way order — a cheap IP-based limiter first (bounds unauthenticated request volume before `authenticate`'s own DB/JWT work runs, and is what CodeQL's static analysis traces as covering the router), then `authenticate`, then the org-scoped limiter last, since it needs `req.user` for its key.
- **AIBOM listed unused-capability providers as bundled dependencies**: the AI Bill of Materials treated all six BYOK LLM providers as `components` regardless of whether they have any real, shipped code dependency. Only `claude`/`openai` have actual npm SDK dependencies; `gemini`/`grok`/`groq`/`ollama` are called over plain HTTP only if an operator configures a key, with zero shipped SDK. Moved the latter into CycloneDX's dedicated `services` array alongside the existing internal AI Copilot/Analysis service entries, and added metadata clarifying that every provider reflects supported integration surface, not per-deployment runtime usage.
- **Controls list page mislabeled `verified` controls as "Not Started"**: `getStatusBadgeClass`/`getStatusLabel` only handled `implemented`/`satisfied_via_crosswalk`/`in_progress`, falling through to a gray "Not Started" badge for `verified`, `needs_review`, and `not_applicable` — so a control an auditor had verified rendered as if untouched. The control detail page already handled `verified` correctly; brought the list page in line with it and added the missing statuses to the status filter and both inline status-edit dropdowns.
- **Compliance gate undercounted `verified` controls**: `GET /compliance/gate` only treated `implemented`/`satisfied_via_crosswalk` as compliant, omitting `verified`, which every other progress query (`frameworks.js`, `dashboard.js`, `controls.js`) already counts as compliant — could return a false 412 even when the dashboard showed the threshold met.
- **Reverted migration idempotency edits on already-numbered files**: an earlier pass added `IF NOT EXISTS` guards to `001`, `005`, `057`, `105`, `107`, `108`, `109`, but editing an already-numbered (and likely already-deployed) migration changes its stored checksum, which makes `scripts/migrate-all.js` hard-fail with "Checksum mismatch" on any existing database — blocking the deploy of this PR's real new migrations, and contradicting this repo's own "never edit a deployed migration" rule. Reverted those seven files to their original content; the RLS syntax fix in `104_row_level_security.sql` is unaffected since it fixes a genuine bug rather than being purely defensive.
- **Cyber Resilience test date silently defaulted on malformed input**: `POST /resilience/plans/:id/tests` treated an invalid `test_date` (e.g. `not-a-date`) the same as an omitted one, silently recording the test against today's date instead of rejecting the request with 400 like every other date field in this route.
- **Dependency vulnerabilities**: resolved all 27 backend + 21 frontend `npm audit` findings. `form-data`, `multer`, `ws`, `js-yaml` (backend and frontend) fixed via non-breaking `npm audit fix`; `nodemailer` bumped to `9.0.3` (breaking, limited to stricter default TLS certificate validation, which this project's SMTP usage doesn't rely on bypassing); `@sentry/node`/`@sentry/nextjs` bumped to `10.65.0` and `pm2` bumped to `7.0.3` (both breaking-flagged, verified against this codebase's minimal usage of each — basic `Sentry.init()`/`setupExpressErrorHandler()` with only `dsn`/`environment`/sample-rate options, and `pm2`'s standard `apps`/`script`/`instances`/`exec_mode` config).

---

---

## Version 4.2.1 — June 12, 2026


> Changes staged but not yet released to production.

---

---

## Version 4.2.0 — May 21, 2026


> Changes staged but not yet released to production.

---

---

## Version 4.0.0 — May 02, 2026


> Changes staged but not yet released to production.

### Added
- Local DB-backed integration harness at `controlweave/backend/scripts/qa-local-integration.js` for exact postcondition checks across framework adoption, control implementation, notifications, audit writes, org LLM settings, and cross-org isolation.

### Changed
- Hardened legacy backend QA scripts so they assert persisted behavior and current route contracts instead of allowing ambiguous `200 or 403` outcomes.
- RBAC QA now verifies evidence upload behavior, control-write persistence, audit-log access via `/api/v1/audit/logs`, and org LLM setting persistence.
- Endpoint smoke tests now derive tier-gating expectations from the authenticated org tier rather than treating both blocked and allowed responses as passing.
- Hardened the backend migration toolchain by rejecting unsupported migration files, rejecting duplicate SQL bodies, and defaulting checksum drift plus automatic baseline-on-error to off.
- Replaced the broken configuration-management migration with a UUID-safe SQL migration and removed duplicated TPRM schema replays from fresh installs.
- Backend startup now skips license DB lookup, reminder sweeps, AI-monitoring sync, and seed jobs when database config is intentionally absent in development, and `/health` reports a fast degraded `database:not_configured` status instead of cascading connection/auth errors.
- Passkey and SSO session rows now honor the configured refresh-token lifetime instead of hardcoding seven days, and the SSO callback now returns tokens in the URL fragment so they do not leak through query-string logging or referrers.
- Platform-admin overview now requires platform-owner authentication, audit log responses decrypt stored user emails before returning them to the UI, and QA coverage now asserts passkey email lookup, org switching session rotation, and the SSO callback fragment contract.

---

## Version 3.2.0 — April 18, 2026


> Changes staged but not yet released to production.

### Overview

This unreleased batch hardens browser-side billing and onboarding behavior, adds repeatable verification coverage for release readiness, introduces a comprehensive Claude Code AI developer experience system with 10 auto-loaded rules and 8 slash-command playbooks, and ships native iOS and Android companion apps with push notifications, RevenueCat IAP, and evidence capture.

### Added
- Playwright end-to-end coverage for auth and billing guard flows, including invalid pending-plan recovery and effective-tier routing behavior.
- Expanded deployment verification so release checks validate both backend health/billing endpoints and frontend routing plus `/api/v1` rewrite linkage.
- Comprehensive Claude Code context system with 10 auto-loaded rule files (`.claude/rules/`) covering security, coding style, database, git workflow, code review, API design, TPRM, evidence handling, assessment workflows, and tier/edition gating conventions.
- Eight Claude Code slash-command playbooks (`.claude/commands/`) for code review, database migration creation, security review, assessment engagement scaffolding, compliance framework addition, evidence lifecycle review, TPRM vendor risk management, and API route scaffolding.
- Enhanced `CLAUDE.md` with project overview, full tech stack reference, critical rules (SQL injection prevention, multi-tenant isolation, audit logging), key patterns (route structure, database queries, response format), git workflow conventions, and CI/TEVV pipeline summary.
- iOS companion app (SwiftUI, iOS 17+) with JWT/TOTP auth, dashboard, paginated controls with search, assessments, evidence capture with MIME type detection, APNs push notifications, RevenueCat Pro upgrade, and AdMob ads on Community tier.
- Android companion app (Jetpack Compose, API 26+) with full feature parity; FCM push via `firebase-admin`; hardened OkHttp `Authenticator` preventing infinite 401 retry loops and `Authorization: Bearer null` headers.
- `POST /api/v1/push-tokens` and `DELETE /api/v1/push-tokens/:token` routes for mobile device push token lifecycle management.
- `POST /api/v1/billing/mobile-upgrade` — RevenueCat subscription verification with server-side user binding.
- `apn` and `firebase-admin` as `optionalDependencies` in backend `package.json`.
- iOS `Info.plist` with all required App Store privacy usage descriptions and export compliance declaration.
- `PrivacyInfo.xcprivacy` updated to declare file-timestamp API access required by Apple for photo-picker usage.

### Changed
- Hardened frontend auth, landing, onboarding, and dashboard redirects to validate `pendingPlan` from local storage before sending users into checkout, and automatically clear invalid values.
- Aligned billing resolution and organization/settings plan UI with `effectiveTier` so browser messaging and routing match backend entitlements.
- Cleaned up the billing success redirect lifecycle so post-checkout navigation does not leave a dangling timer.
- Refreshed the marketing app lockfile so the bundled Express dependency tree resolves `path-to-regexp@0.1.13`, clearing the pre-commit audit finding.
- Replaced placeholder footer social/legal targets on the marketing page with real LinkedIn, GitHub, terms-request, and security-policy links.

### Security
- Frontend `lodash` transitive dependency (via recharts) patched from `<=4.17.23` (prototype pollution + code injection) to `4.18.1`; `package-lock.json` updated.
- Backend `package-lock.json` regenerated to include `firebase-admin` transitive dependencies, fixing `npm ci` lock-file integrity failures.
- Billing `mobile-upgrade` endpoint derives `revenueCatAppUserId` from `req.user.id` (not caller body), closing cross-account subscription elevation vector.
- `device_push_tokens` uniqueness constraint changed from `(user_id, token)` to `(token)` with upsert reassignment, preventing cross-account push delivery on shared devices.

---

## Version 3.1.0 — April 18, 2026


> Changes staged but not yet released to production.

### Overview

This unreleased batch hardens browser-side billing and onboarding behavior, adds repeatable verification coverage for release readiness, introduces a comprehensive Claude Code AI developer experience system with 10 auto-loaded rules and 8 slash-command playbooks, and ships native iOS and Android companion apps with push notifications, RevenueCat IAP, and evidence capture.

### Added
- Playwright end-to-end coverage for auth and billing guard flows, including invalid pending-plan recovery and effective-tier routing behavior.
- Expanded deployment verification so release checks validate both backend health/billing endpoints and frontend routing plus `/api/v1` rewrite linkage.
- Comprehensive Claude Code context system with 10 auto-loaded rule files (`.claude/rules/`) covering security, coding style, database, git workflow, code review, API design, TPRM, evidence handling, assessment workflows, and tier/edition gating conventions.
- Eight Claude Code slash-command playbooks (`.claude/commands/`) for code review, database migration creation, security review, assessment engagement scaffolding, compliance framework addition, evidence lifecycle review, TPRM vendor risk management, and API route scaffolding.
- Enhanced `CLAUDE.md` with project overview, full tech stack reference, critical rules (SQL injection prevention, multi-tenant isolation, audit logging), key patterns (route structure, database queries, response format), git workflow conventions, and CI/TEVV pipeline summary.
- iOS companion app (SwiftUI, iOS 17+) with JWT/TOTP auth, dashboard, paginated controls with search, assessments, evidence capture with MIME type detection, APNs push notifications, RevenueCat Pro upgrade, and AdMob ads on Community tier.
- Android companion app (Jetpack Compose, API 26+) with full feature parity; FCM push via `firebase-admin`; hardened OkHttp `Authenticator` preventing infinite 401 retry loops and `Authorization: Bearer null` headers.
- `POST /api/v1/push-tokens` and `DELETE /api/v1/push-tokens/:token` routes for mobile device push token lifecycle management.
- `POST /api/v1/billing/mobile-upgrade` — RevenueCat subscription verification with server-side user binding.
- `apn` and `firebase-admin` as `optionalDependencies` in backend `package.json`.
- iOS `Info.plist` with all required App Store privacy usage descriptions and export compliance declaration.
- `PrivacyInfo.xcprivacy` updated to declare file-timestamp API access required by Apple for photo-picker usage.

### Changed
- Hardened frontend auth, landing, onboarding, and dashboard redirects to validate `pendingPlan` from local storage before sending users into checkout, and automatically clear invalid values.
- Aligned billing resolution and organization/settings plan UI with `effectiveTier` so browser messaging and routing match backend entitlements.
- Cleaned up the billing success redirect lifecycle so post-checkout navigation does not leave a dangling timer.
- Refreshed the marketing app lockfile so the bundled Express dependency tree resolves `path-to-regexp@0.1.13`, clearing the pre-commit audit finding.
- Replaced placeholder footer social/legal targets on the marketing page with real LinkedIn, GitHub, terms-request, and security-policy links.

### Security
- Frontend `lodash` transitive dependency (via recharts) patched from `<=4.17.23` (prototype pollution + code injection) to `4.18.1`; `package-lock.json` updated.
- Backend `package-lock.json` regenerated to include `firebase-admin` transitive dependencies, fixing `npm ci` lock-file integrity failures.
- Billing `mobile-upgrade` endpoint derives `revenueCatAppUserId` from `req.user.id` (not caller body), closing cross-account subscription elevation vector.
- `device_push_tokens` uniqueness constraint changed from `(user_id, token)` to `(token)` with upsert reassignment, preventing cross-account push delivery on shared devices.

---

## Version 3.0.0 — April 10, 2026


> Changes staged but not yet released to production.

### Overview

This unreleased batch hardens browser-side billing and onboarding behavior, adds repeatable verification coverage for release readiness, introduces a comprehensive Claude Code AI developer experience system with 10 auto-loaded rules and 8 slash-command playbooks, and ships native iOS and Android companion apps with push notifications, RevenueCat IAP, and evidence capture.

### Added
- Playwright end-to-end coverage for auth and billing guard flows, including invalid pending-plan recovery and effective-tier routing behavior.
- Expanded deployment verification so release checks validate both backend health/billing endpoints and frontend routing plus `/api/v1` rewrite linkage.
- Comprehensive Claude Code context system with 10 auto-loaded rule files (`.claude/rules/`) covering security, coding style, database, git workflow, code review, API design, TPRM, evidence handling, assessment workflows, and tier/edition gating conventions.
- Eight Claude Code slash-command playbooks (`.claude/commands/`) for code review, database migration creation, security review, assessment engagement scaffolding, compliance framework addition, evidence lifecycle review, TPRM vendor risk management, and API route scaffolding.
- Enhanced `CLAUDE.md` with project overview, full tech stack reference, critical rules (SQL injection prevention, multi-tenant isolation, audit logging), key patterns (route structure, database queries, response format), git workflow conventions, and CI/TEVV pipeline summary.
- iOS companion app (SwiftUI, iOS 17+) with JWT/TOTP auth, dashboard, paginated controls with search, assessments, evidence capture with MIME type detection, APNs push notifications, RevenueCat Pro upgrade, and AdMob ads on Community tier.
- Android companion app (Jetpack Compose, API 26+) with full feature parity; FCM push via `firebase-admin`; hardened OkHttp `Authenticator` preventing infinite 401 retry loops and `Authorization: Bearer null` headers.
- `POST /api/v1/push-tokens` and `DELETE /api/v1/push-tokens/:token` routes for mobile device push token lifecycle management.
- `POST /api/v1/billing/mobile-upgrade` — RevenueCat subscription verification with server-side user binding.
- `apn` and `firebase-admin` as `optionalDependencies` in backend `package.json`.
- iOS `Info.plist` with all required App Store privacy usage descriptions and export compliance declaration.
- `PrivacyInfo.xcprivacy` updated to declare file-timestamp API access required by Apple for photo-picker usage.

### Changed
- Hardened frontend auth, landing, onboarding, and dashboard redirects to validate `pendingPlan` from local storage before sending users into checkout, and automatically clear invalid values.
- Aligned billing resolution and organization/settings plan UI with `effectiveTier` so browser messaging and routing match backend entitlements.
- Cleaned up the billing success redirect lifecycle so post-checkout navigation does not leave a dangling timer.
- Refreshed the marketing app lockfile so the bundled Express dependency tree resolves `path-to-regexp@0.1.13`, clearing the pre-commit audit finding.
- Replaced placeholder footer social/legal targets on the marketing page with real LinkedIn, GitHub, terms-request, and security-policy links.

### Security
- Frontend `lodash` transitive dependency (via recharts) patched from `<=4.17.23` (prototype pollution + code injection) to `4.18.1`; `package-lock.json` updated.
- Backend `package-lock.json` regenerated to include `firebase-admin` transitive dependencies, fixing `npm ci` lock-file integrity failures.
- Billing `mobile-upgrade` endpoint derives `revenueCatAppUserId` from `req.user.id` (not caller body), closing cross-account subscription elevation vector.
- `device_push_tokens` uniqueness constraint changed from `(user_id, token)` to `(token)` with upsert reassignment, preventing cross-account push delivery on shared devices.

---

## Version 2.8.11 — March 30, 2026


> Changes staged but not yet released to production.

### Overview

This unreleased batch hardens browser-side billing and onboarding behavior, adds repeatable verification coverage for release readiness, introduces a comprehensive Claude Code AI developer experience system with 10 auto-loaded rules and 8 slash-command playbooks, and ships native iOS and Android companion apps with push notifications, RevenueCat IAP, and evidence capture.

### Added
- Playwright end-to-end coverage for auth and billing guard flows, including invalid pending-plan recovery and effective-tier routing behavior.
- Expanded deployment verification so release checks validate both backend health/billing endpoints and frontend routing plus `/api/v1` rewrite linkage.
- Comprehensive Claude Code context system with 10 auto-loaded rule files (`.claude/rules/`) covering security, coding style, database, git workflow, code review, API design, TPRM, evidence handling, assessment workflows, and tier/edition gating conventions.
- Eight Claude Code slash-command playbooks (`.claude/commands/`) for code review, database migration creation, security review, assessment engagement scaffolding, compliance framework addition, evidence lifecycle review, TPRM vendor risk management, and API route scaffolding.
- Enhanced `CLAUDE.md` with project overview, full tech stack reference, critical rules (SQL injection prevention, multi-tenant isolation, audit logging), key patterns (route structure, database queries, response format), git workflow conventions, and CI/TEVV pipeline summary.
- iOS companion app (SwiftUI, iOS 17+) — dashboard, controls, assessments, evidence upload, APNs push notifications, RevenueCat Pro upgrade, AdMob ads on Community tier.
- Android companion app (Jetpack Compose, API 26+) — full feature parity with iOS; FCM push; hardened token-refresh authentication.
- Mobile push token lifecycle routes (`POST /api/v1/push-tokens`, `DELETE /api/v1/push-tokens/:token`) — token uniqueness enforced globally to prevent cross-account push delivery on shared devices.
- `POST /api/v1/billing/mobile-upgrade` — RevenueCat subscription verification with server-side user binding.
- iOS `Info.plist` with all required App Store privacy usage descriptions and export compliance declaration.

### Changed
- Hardened frontend auth, landing, onboarding, and dashboard redirects to validate `pendingPlan` from local storage before sending users into checkout, and automatically clear invalid values.
- Aligned billing resolution and organization/settings plan UI with `effectiveTier` so browser messaging and routing match backend entitlements.
- Cleaned up the billing success redirect lifecycle so post-checkout navigation does not leave a dangling timer.
- Refreshed the marketing app lockfile so the bundled Express dependency tree resolves `path-to-regexp@0.1.13`, clearing the pre-commit audit finding.
- Replaced placeholder footer social/legal targets on the marketing page with real LinkedIn, GitHub, terms-request, and security-policy links.

### Security
- Frontend lodash dependency patched from vulnerable `<=4.17.23` to `4.18.1` (prototype pollution and code injection CVEs).
- Billing `mobile-upgrade` endpoint now derives `revenueCatAppUserId` from the server-side session, closing a cross-account subscription elevation vector.
- Push token registration reassigns tokens to the most recent authenticated user, preventing stale delivery to prior accounts on shared devices.

---

## Version 2.8.10 — Improvements

### Overview

This release includes 1 improvement.

### Changed
- Fix dashboard overview and auth email hydration



---

## Version 2.8.9 — Improvements

### Overview

This release includes 1 improvement.

### Changed
- Add duplicate user email cleanup



---

## Version 2.8.8 — Improvements

### Overview

This release includes 1 improvement.

### Changed
- Add email hash backfill script



---

## Version 2.8.7 — Improvements

### Overview

This release includes 1 improvement.

### Changed
- Fix GovCloud assessment seed query



---

## Version 2.8.6 — Improvements

### Overview

This release includes 1 improvement.

### Changed
- Fix demo seed account targeting



---

## Version 2.8.5 — Improvements

### Overview

This release includes 1 improvement.

### Changed
- Auto-seed demo accounts on startup



---

## Version 2.8.4 — Improvements

### Overview

This release includes 1 improvement.

### Changed
- Seed platform admin self-assessment data



---

## Version 2.8.3 — Improvements

### Overview

This release includes 1 improvement.

### Changed
- Harden demo seed prerequisites



---

## Version 2.8.2 — Improvements

### Overview

This release includes 1 improvement.

### Changed
- Fix platform admin password rotation



---

## Version 2.8.1 — New Features

### Overview

This release includes 1 new feature.

### Added
- Optimize code and enhance features



---

## Version 2.8.0 — AI-Code Security Hardening, ESLint & ReDoS Dependency Fix — March 27, 2026

### Overview

Addresses 15 AI-code risk factors — adds ESLint static analysis to the backend, improves Express error handling, patches a HIGH-severity ReDoS vulnerability in `path-to-regexp`, improves mobile viewport support, and documents staging environment deployment.

### New Features
- Backend ESLint configuration (flat config format) with ESLint 9.x and `globals` for Node.js environment declarations.
- `STAGING_ENVIRONMENT.md` deployment guide covering architecture, environment variables, Docker-based staging, and promotion workflow.

### Security & Reliability
- `path-to-regexp` bumped to 0.1.13 resolving HIGH-severity ReDoS (GHSA-37ch-88jc-xwx2).
- Structured Express error handling with explicit `next(err)` propagation.
- Frontend `layout.tsx` updated with `viewport` export for mobile scaling.

### Bug Fixes
- ESLint version corrected to 9.x flat config after Gemini code review.
- Staging environment documentation table formatting corrected.

---

## Version 2.7.3 — Retroactive Release Note Quality Restoration & Documentation Metadata — March 26, 2026

### Overview

Restores the v2.7.3 release entry — which retroactively rewrote v2.5.0 through v2.7.2 release notes to match the detailed quality standard established in v2.4.4 — from its single-line placeholder to full detail, adds release dates to all documentation headings, and enriches internal release metadata with tag and release branch fields.

### Changes
- Restored v2.7.3 entry (originally a single-line placeholder) with full detail describing its retroactive rewrite of v2.5.0–v2.7.2 release notes to match v2.4.4 quality standard across all release note files.
- Release dates added to documentation file headings for all versions.
- Internal release metadata enriched with `Tag` and `Release branch` fields for traceability.



---

## Version 2.7.2 — Release Note Auto-Generation Quality & Retroactive Cleanup — March 26, 2026

### Overview

Improves the release-notes automation so auto-generated entries match the quality of hand-written notes, and retroactively cleans up v2.5.0–v2.7.1 entries that were published with raw branch-name slugs.

### Changes
- New `clean_desc()` function strips redundant type-prefix verbs and capitalizes 30+ GRC/tech acronyms via word-boundary matching.
- Auto-generated overview now produces grammatically correct counts with singular/plural handling and Oxford comma.
- Auto-generated release title derived from change categories and used in heading across all release-note files.
- Conventional commit regex synced between `release-notes.yml` and `cm-branch-naming.yml` — added `migration` and `test` types.
- American English normalization applied across workflow files.

---

## Version 2.7.1 — CI/CD Hardening, TEVV Real Tests & Docs Pipeline Consolidation — March 26, 2026

### Overview

Replaces shallow file-existence TEVV checks with real behavioral tests achieving 100% dashboard CI coverage, removes duplicate workflows, fixes four workflow misconfigurations, and consolidates three documentation workflows into a single pipeline.

### New Features
- **TEVV-API** — 4 new behavioral tests: route import verification, auth middleware check, `module.exports` verification, frontend API client coverage.
- **TEVV-DB** — Migration file SQL keyword validation.
- **TEVV-UI** — 7 new page-level tests covering `ai-security`, `assets`, `plot4ai`, `organization`, `my-organizations`, `report-issue`, and all 9 CMDB sub-pages.
- **TEVV-UI-39** — Safety-net test that auto-fails CI when a new dashboard page is added without a TEVV check.

### Improvements
- Removed duplicate `security-reports-export.yml` and `security-reports-stig-quarterly.yml` workflows.
- Merged `sync-wiki.yml` and `wiki-health-check.yml` into `docs-pipeline.yml` with preflight routing.

### Bug Fixes
- CodeQL language identifier corrected; `npm install` → `npm ci`; QA report no longer hardcodes pass status.
- Narrowed triggers on `codeql.yml`, `copilot-pr-review.yml`, `compliance-labeler.yml`, and `docs-pipeline.yml`.

---

## Version 2.7.0 — NIST AI 800-4 Compliance Monitoring & Platform Linkage Audit — March 26, 2026

### Overview

Operationalizes NIST AI 800-4 compliance-layer monitoring with cross-feature navigation, fixes sidebar visibility for AI Monitoring and AI Governance, and closes frontend API coverage gaps across four backend routes.

### New Features
- AI Monitoring and AI Governance sidebar visibility corrected and cross-feature navigation cards added across 8 dashboard pages.
- `stateAiLawsAPI` added to frontend `api.ts` — 4 backend routes previously had zero frontend coverage.
- Cross-feature card section added to `plot4ai/page.tsx`.

### Bug Fixes
- Division-by-zero guard on `coverage_percentage`; `Promise.allSettled` for resilient rendering; covering database index added.
- `validateCategorySync()` startup guard logs a warning when DB CHECK constraints drift from JS constants.

---

## Version 2.6.0 — Quantized GGUF Model Support for Ollama — March 26, 2026

### Overview

Adds quantized GGUF model support for local Ollama deployments, enabling TurboQuant-style compression for more efficient on-device AI inference, and patches a HIGH-severity dependency vulnerability.

### New Features
- Ollama provider now supports quantized GGUF models for local AI inference with configurable quantization levels.

### Security & Reliability
- `picomatch` upgraded to `2.3.2` resolving a HIGH-severity ReDoS vulnerability in both backend and frontend.

### Bug Fixes
- Fixed stale tier names on the `/privacy` page.
- Fixed missing `next/link` import and React type declarations.

---

## Version 2.5.0 — DISA STIG Expansion, Self-Assessment Seeding & Security Hardening — March 25, 2026

### Overview

Expands DISA STIG automation from a single Application STIG into a full 5-framework quarterly pipeline with 209 automated compliance checks, adds a ControlWeave self-assessment seed for the platform admin organization, hardens encryption with HMAC-SHA-384 and org-scoped platform admin queries, and aligns password policy enforcement to a 15-character minimum.

### New Features
- **DISA STIG 5-Framework Pipeline**: 4 new assessment functions, CKLB export/import, 209 automated checks across all 5 STIGs.
- **Self-Assessment Seed**: All frameworks adopted, 10 policies, 15 evidence artifacts, ~85% compliance for platform admin org.
- **PR Title Validation**: Conventional commit format validation with Copilot exemption and type-detection fallback.

### Security & Reliability
- HMAC key floor raised to 48 bytes (CNSA Suite 1.0); lazy backfill encrypts both email columns; column init guards; org-scoped platform admin.
- Password policy raised to 15-character minimum across all account flows including demo accounts.

### Bug Fixes
- Release-notes workflow no longer creates empty entries or draft releases; metadata restored to v2.4.4.
- MCP localhost regex corrected; bash regex variables introduced for workflow `)` patterns.

---

## Version 2.4.4 — March 22, 2026

### New Features
- **Self-Hosted Update Awareness**: Added `GET /api/v1/license/update-check` plus settings UI support so self-hosted operators can see their installed version, the latest public release, and whether an update is available.
- **Organization-Level SMTP**: Added org-scoped SMTP settings and test email flows in Settings → Notifications (`GET/PUT /api/v1/settings/smtp`, `POST /api/v1/settings/smtp/test`).

### Improvements
- Email delivery now resolves SMTP settings per organization before falling back to environment/platform defaults.
- Frontend session handling is more resilient with in-memory token storage and a global error boundary.

### Bug Fixes
- Preserves in-progress framework answers when switching frameworks.
- Tightens self-hosted release-check and notification flows.

---
## Version 2.4.3 — March 20, 2026

### Improvements
- Release automation now syncs the root/community release badges plus backend/frontend package versions together.
- Added stronger idempotency guards so push-to-main release-note generation skips workflow-authored commits and duplicate version headings.
- Backfilled the missing v2.4.2 release-note coverage and aligned the release files.

---
## Version 2.4.2 — March 20, 2026

### New Features
- **AI Security Hub**: Consolidated view with six GRC-native AI security pillars — OWASP Top 10 for LLMs, NIST AI RMF alignment, EU AI Act readiness, PLOT4ai threat modeling, AI supply-chain risk, and AIUC-1 certification status.
- **Community Tier Expansion**: BYOK users get unlimited AI requests; Plot4AI (138 threat cards), Regulatory News, and AI Analysis unlocked for all tiers.
- **Crosswalk Engine**: ISO 27001:2022 mappings, coverage matrix API, and versioned framework names.

### Bug Fixes
- Community edition license label corrected (MIT → AGPL v3).
- Fixed broken Docker link, settings/billing links, Gemini model name, pricing page routing, community mirror startup crash, and toast UX.

### Changes
- Dual READMEs consolidated; contact emails updated; documentation diagrams standardized on Mermaid.
- Release notes workflow now auto-triggers on push to `main` with patch version auto-increment.
- CLA and CONTRIBUTING.md added to community repo; LICENSE email casing fixed.
- Public mirror: removed CLA files from allowlist, added workflow directory stripping to prevent push failures.
- CLA workflow security: corrected SHA pin to full 40-char hash, hardened bot allowlist from wildcard to explicit accounts.

---
## Version 2.4.1 — March 13, 2026

### New Features
- **Multi-Organization Membership**: A single user account can now belong to — and switch between — multiple organizations. Ideal for consultants, MSPs, and teams managing compliance across several clients or business units.
  - **My Organizations page** (`/dashboard/my-organizations`): view all orgs, see which is active, switch with one click.
  - **Create New Organization**: spin up a fresh Community-tier org without logging out.
  - **Clone from Template**: duplicate your current framework selections into a new org to avoid repetitive setup.
  - Sidebar now shows the active organization name for at-a-glance context.
- **DB Migration 095**: `user_organizations` junction table with automatic backfill of all existing users.

---
## Version 2.4.0 — March 13, 2026

### New Features
- **AIUC-1 Agentic AI Certification Framework** (Enterprise): Added AIUC-1 as a supported compliance framework. AIUC-1 is the first independently-audited certification standard purpose-built for agentic AI systems. Includes 31 controls across six domains — Data & Privacy, Security, Safety, Reliability, Accountability, and Societal Impact — with full crosswalk mappings to NIST AI RMF 1.0, EU AI Act, and ISO/IEC 42001:2023. OWASP Agentic AI Top 10 crosswalks are included when that framework is pre-seeded. The AI Governance check now includes AIUC-1 readiness assessment. Use `npm run seed:aiuc1` to seed the framework.

---

## Version 2.3.3 — March 13, 2026

### New Features
- **Self-Service Community License Generation**: Platform admins can now generate a community license key without contacting ControlWeave sales. Use `POST /api/v1/license/generate-community` (platform owner credentials) or the new `scripts/generate-community-license.js` CLI script. The generated key is activated immediately and persisted to the database — no restart required.
- **Platform Admin License Notification**: When the server starts without an active license key and `PLATFORM_ADMIN_EMAIL` is set, an email notification is automatically sent to the platform admin directing them to generate or activate a license. If SMTP is not configured, a structured log message is emitted instead (`license.unlicensed`).
- **Self-Signed Key Restart Persistence**: Self-generated community license keys now survive server restarts. Migration `097` adds `local_public_key` to `server_license`; on startup the stored public key is loaded in-process so the JWT validates without any env var changes.

### Changes
- `licenseService.loadLicenseKeyFromDb()` return type changed from `string|null` to `{ licenseKey: string|null, localPublicKey: string|null }`. All internal callers updated.
- `licenseService.validateLicenseKey(key, overridePubKey?)` — new optional second parameter for validation against a specific public key (used during self-validation of generated keys).

---

## Version 2.3.2 — March 13, 2026

### New Features
- **Community License Key Support**: Self-hosted community-tier deployments can now use signed license keys. Community tier is now included in `VALID_TIERS` in `licenseService.js`, allowing community JWTs to be validated. The `LICENSE_TIER_TO_EDITION` map in `edition.js` now includes `community → community` so startup validation recognizes and logs community licenses.
- **Self-Hosted License Activation API** (`@tier: community`): New `GET /api/v1/license` and `POST /api/v1/license/activate` endpoints let self-hosted deployments query their current edition and activate a signed license key at runtime. Pro/Enterprise/GovCloud keys immediately upgrade the in-process edition without a restart.
- **Database-Persisted License Key**: Activated license keys are automatically saved to the new `server_license` database table (migration `096`). On next server start, the key is loaded from the database and the edition is restored — **no manual `.env` editing required**. The activation is truly one-time: enter the key once in the UI and it persists forever.
- **Optional Online Heartbeat** (`LICENSE_HEARTBEAT_URL`): For paid-tier operators who want real-time revocation capability, an optional async background heartbeat can be configured. It is **disabled by default** — community self-hosted installations work fully offline with zero internet dependency. Connectivity failures are logged as warnings and **never revoke access**. See `.env.example` for configuration details.

### Bug Fixes
- **Community License Validation**: Previously, license keys with `tier: "community"` were rejected by `validateLicenseKey()` because `'community'` was absent from `VALID_TIERS`. Self-hosted community installations providing a community license key will no longer receive an "Invalid license tier" error.

### Architecture Decision
- **No mandatory internet check for self-hosted**: GRC/compliance platforms are routinely deployed in air-gapped environments. Making license checks internet-dependent would break these use cases and undermine the trust model of self-hosting. The JWT's built-in expiry (`exp` / `maintenance_until`) is the natural revocation mechanism. The optional heartbeat is available for those who want it, but is never required.

---

## Version 2.3.1 — March 13, 2026
### New Features
- **BYOK Unlimited AI for All Tiers**: Community-tier organizations with a configured API key now receive unlimited AI requests. Previously, community orgs were capped at 10/month even with BYOK keys. The BYOK bypass tier list now includes `community` in addition to `pro`, `enterprise`, and `govcloud`.
- **Contributor License Agreement (CLA)**: Added `docs/CLA.md` and automated CLA signing enforcement via GitHub Actions (`cla.yml`). Required for ControlWeave's dual-license (AGPL + commercial) model. Contributors sign once; signatures stored in `signatures/version1/cla.json`.

### Bug Fixes
- **AI Monitoring Usage Card**: Fixed a UI bug where the usage card always showed `0 / 0` regardless of actual usage. The interface was reading non-existent top-level fields instead of the nested `usage` object. BYOK users now see "∞ Unlimited" with a green bar; non-BYOK users see correct used/limit counts.
- **Settings Page Copy**: Corrected stale "3 AI requests per month" text to "10 AI requests/month (unlimited with own API key)".

### Security
- **CLA Workflow SHA Pin**: GitHub Actions CLA workflow now references `contributor-assistant/github-action` by commit SHA (`ca4a40a`) instead of a mutable `@v2.6.1` tag, eliminating supply-chain risk.
- **CLA Workflow Bot Fix**: Removed bot actor exclusions from the workflow's `if` condition. These caused missing required status checks for bot PRs (e.g., Dependabot), which could block branch protection merges.

---

## Version 2.3.0 — March 2026

### New Features
- **AI Evidence Suggestions**: AI scans connected integrations (e.g., Splunk), analyzes logs against your active frameworks, maps data to controls, and suggests evidence items — users review and approve before adding to the official evidence library. Available for Starter+ tiers via the Evidence page or `POST /api/v1/pending-evidence/scan`
- **AI Analysis Speed Improvements**: AI analysis results now load significantly faster with optimized streaming
- **Comprehensive Demo Data**: Enhanced demo environment with realistic CVE-enriched vulnerability data
- **Hugging Face CVE Enrichment**: Vulnerability records enriched with real CVE data from Hugging Face datasets
- **RMF Lifecycle Dashboard**: Full NIST RMF step tracking with authorization package management

### Improvements
- **Token-Efficient AI Architecture**: Split the monolithic system prompt (~2,000 tokens) into a lean core (~400 tokens) + 7 optional reference modules. Each AI feature now receives only the context it needs, reducing token usage by 50–80% on most calls
- Improved AI Copilot response quality with better organizational context awareness
- Enhanced crosswalk visualization across multiple frameworks
- Performance optimizations for organizations with 500+ controls
- Better evidence search and filtering capabilities

### Bug Fixes
- Fixed issue where AI analysis would occasionally time out on large datasets
- Resolved display issue with control status badges on the Controls page
- Fixed pagination in Evidence Management for organizations with 1000+ evidence items

---

## Version 2.2.0 — February 2026

### New Features
- **xAI Grok Integration**: Added support for xAI Grok as an LLM provider
- **Advanced SBOM Analysis**: AI-powered Software Bill of Materials risk scoring
- **Threat Intelligence Feed**: Automated threat intelligence integration with MITRE ATT&CK mapping
- **State AI Law Compliance Tracker**: Monitor compliance with state-level AI regulations

### Improvements
- CMDB now supports AI Agent and Service Account asset types
- Enhanced Splunk integration with custom HEC token support
- Improved auditor workspace with workpaper templates
- Better mobile responsiveness across all pages

---

## Version 2.1.0 — January 2026

### New Features
- **NIST RMF Lifecycle**: Full Authorization to Operate (ATO) workflow management
- **AI Monitoring**: Real-time AI system monitoring with anomaly detection
- **Data Governance**: Data retention policies and data sovereignty tracking
- **Vendor Risk (TPRM)**: Third-party risk management with automated questionnaires

---

## Version 2.0.0 — December 2025

### Major Release
- Complete platform redesign with improved UX
- Multi-provider AI with BYOK (Bring Your Own Key) support
- Enterprise tier with SIEM, SSO, and dedicated support
- External Auditor Workspace with engagement management
- POA&M Tracking with NIST-standard workflows

---

[View full release history →](../../RELEASE_NOTES.md)
