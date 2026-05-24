# 📋 Release Notes

## Version 4.1.0 — May 21, 2026


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
