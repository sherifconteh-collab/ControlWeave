# 📋 Release Notes

## Version 4.10.1 — August 09, 2026


### Added

- **An end-to-end verification harness for the link surface** — `scripts/qa-link-routes-e2e.sh` (`npm run qa:e2e:links`), shared with the ai-grc mirror. 35 assertions against a running API covering both directions of every link added in migrations `140`–`143`, the `asset_control_mappings` mapping that migration `005` never had an API for, generated-column arithmetic, `relevance` validation returning a 400 that names the options rather than a 500 from the CHECK constraint, `ON CONFLICT` idempotency, unlink, and cross-organization isolation on all three new read paths. The evidence expiry column is taken from `EVIDENCE_EXPIRY_FIELD` (`expires_at` here, `retention_until` in the mirror) because asserting the specific column is what catches a blind port between the two repositories.

- **Risk register: evidence linkage.** Migration 143 adds `risk_evidence_links`,
  completing the register's connections. Evidence has been linkable to controls
  since migration 009, so a risk's evidence was only reachable transitively —
  via its controls, and only when those controls happened to carry the document.
  `relevance` (`assessment` / `treatment` / `monitoring` / `acceptance`) lives on
  the link because the same document supports different risks for different
  reasons. `POST`/`DELETE /risks/:id/evidence/:evidenceId`, evidence in
  `GET /risks/:id`, and `GET /evidence/:id/risks` for the reverse view.

- **Risk register: vendor linkage.** Migration 142 adds `risk_vendor_links`, the
  fourth link table alongside controls, assets and objectives. `tprm_vendors`
  already carried a `risk_tier`, but that is a static onboarding classification,
  not a scored and reviewed risk — so vendor concentration was invisible to the
  register and the register was invisible during a vendor review.
  `POST`/`DELETE /risks/:id/vendors/:vendorId`, vendors included in
  `GET /risks/:id`, and the TPRM vendor detail response now carries `risks`,
  `open_risk_count` and `max_residual_score`. The vendor panel flags a tier that
  disagrees with the risks recorded against it.

- **CMDB: risk exposure on assets.** `risk_asset_links` shipped with migration
  136 but only the risk half was reachable — an asset could be attached to a
  risk and then never seen from the asset again. Adds
  `GET /cmdb/assets/:assetId/risks` and
  `GET /cmdb/risk-exposure[?category=]` (open-risk count, worst residual and top
  risk per asset, one query for the estate), plus a Risk Exposure panel on the
  asset drawer showing the inherent-to-residual movement and linking through to
  the register. Read-only by design: linking stays on the risk so one screen
  owns the relationship.

- **CMDB: asset-to-control mapping.** `asset_control_mappings` has been in the
  schema since migration 005 with no API and no UI, so an asset inventory could
  not evidence CM-8 — the control it exists to satisfy. Adds
  `GET`/`POST /cmdb/assets/:assetId/controls`,
  `PUT`/`DELETE /cmdb/assets/:assetId/controls/:controlId` and
  `GET /cmdb/controls/:controlId/assets`, plus a Compliance Controls section in
  the asset drawer to link, status and unlink.
- **CMDB: bulk import and inventory export.** `POST /cmdb/import/analyze` is a
  true dry run that writes nothing and returns a per-row verdict with source
  line numbers; `POST /cmdb/import/commit` inserts every valid row in one
  transaction. `GET /cmdb/import/template` and `/cmdb/import/export` round-trip
  the same columns. New Bulk import & export panel on the CMDB dashboard, with
  Import disabled until a dry run has run. Both import and export are
  audit-logged.
- **CMDB: editing on every register.** Hardware, Software, AI Agents, Service
  Accounts, Environments and Password Vaults each had only Add and Delete, so
  fixing a typo meant deleting the record and retyping it. The PUT endpoints and
  the `update` client method already existed and had never been called.

- **Risk register, incidents, obligations, objectives, indicators, and departments** (migrations `135`–`139`): ControlWeave ships ISO 31000, ISO 27005 and the NIST AI RMF as frameworks a customer can assess against, but had nowhere to record the risks those frameworks are about. The only risk-shaped table was `risk_scores` (migration `057`) — one computed 0-100 posture number per organization, which is a metric, not a register. Six modules close that gap:
  - `departments` (hierarchical business units) and `business_objectives` (COSO's four categories), the organizational spine every other register hangs off. ISO 31000 defines risk as the effect of uncertainty *on objectives*; without recorded objectives a register is a list of bad things with nothing to be bad for.
  - `risks` / `risk_treatments` / `risk_reviews` plus control, asset and objective link tables (ISO 31000 / ISO 27005 / NIST SP 800-30). Inherent **and** residual assessment as likelihood × impact on 1–5 scales, the product a stored generated column so 5×5 heat-map queries cannot drift from their inputs. Acceptance is a named decision with a rationale and an optional expiry, and a lapsed acceptance is surfaced as such rather than left reading "accepted". Reviews snapshot the assessment as it stood, so history survives later edits to the risk row.
  - `incidents` / `incident_timeline` plus risk, control and asset link tables (NIST SP 800-61r2). Per-phase timestamps rather than a status history, because the intervals *are* the metrics — dwell time, time to contain, time to resolve. Transitions are validated against an explicit graph: an incident cannot be eradicated before it is contained, and allowing that produces response metrics that are quietly nonsense. Breach notification is first class, with the 72-hour class of clock tracked and overdue reported as how far past rather than a generic flag.
  - `compliance_obligations` / `obligation_attestations` / `obligation_control_links`: what the organization is bound to, by whom, by when. Distinct from controls because obligations have a source with authority and they expire. Recurring due dates advance from the *due date*, never from the attestation date, so a repeatedly-late annual obligation cannot drift its own deadline out of the period the regulator expects.
  - `indicators` / `indicator_measurements`: KRI / KPI / KCI with amber and red thresholds and an explicit `direction`, so "higher is worse" and "higher is better" indicators are both handled instead of whichever case the author had in mind. `breach_level` is persisted at write time so retuning a threshold does not silently rewrite historic breaches.

  Twelve permissions (`risks.*`, `incidents.*`, `obligations.*`, `objectives.*`, `indicators.*`, `departments.*`) are seeded and granted in the same migrations that introduce the routes using them. Incident *write* goes to `user` as well as `admin`: incident reporting has to be available to whoever noticed the problem, or it gets reported by email and never reaches the register. Six new dashboard pages (`/dashboard/risks` with the 5×5 residual heat map, `/dashboard/incidents`, `/dashboard/obligations`, `/dashboard/indicators`, `/dashboard/objectives`, `/dashboard/departments`). All routes are org-scoped, paginated, rate-limited at both the IP and per-organization level, and audit-logged on mutation.

- **Federal POA&M structure — milestones, resources, and slippage tracking** ([#569](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/569), migration `134`): `poam_items` carried the core lifecycle but was short of what a federal POA&M requires. New `poam_milestones` table with discrete milestones, each with its own target date, status (`pending` / `in_progress` / `completed` / `delayed` / `cancelled`, enforced by a CHECK constraint) and completion date, exposed as a sub-resource at `/poam/:id/milestones` (list, create, patch, delete) with a completed/overdue summary. New `resources_required` records the funding, staff, and tooling estimate reviewers ask for. New `scheduled_completion_date` holds the *originally scheduled* completion date and is set once, while `due_date` carries the current target — so revising a date makes the slippage visible instead of erasing it. Existing rows are backfilled from `due_date` so slippage reporting does not silently skip them.
- **Real evidence version history** ([#570](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/570), migration `133`): `evidence.evidence_version` was an integer that incremented while the row was overwritten in place — no prior version's file, hash, or classification could be retrieved, so the counter went up but nothing was kept. Each update now archives the row as it stood into a new `evidence_versions` table, in the same transaction as the update. New `POST /evidence/:id/versions` replaces the file while retaining the superseded one and its hash, so integrity stays demonstrable across a replacement; `GET /evidence/:id/versions` lists superseded versions and `GET /evidence/:id/versions/:versionNumber/download` retrieves one. Reclassifying evidence no longer destroys the record of what it was classified as while being relied on. Version records are immutable and cascade-delete with their parent. File replacement is audit-logged as `evidence_version_created`.

- **GitHub Evidence Connector**: `services/githubService.js` and `routes/github.js` add a real GitHub REST API client — org-scoped token settings (`Settings → Integrations → GitHub`), a test-connection check, a one-time import endpoint, and a full `code_scanning_alerts` / `dependabot_alerts` / `audit_log` / `pull_requests` source for Auto-Evidence Collection Rules. GitHub now performs genuine live data retrieval (like Splunk), not just configuration-record evidence.
- Dynamic per-source-type configuration fields in the Auto-Evidence rule creation form (`dashboard/evidence/auto/page.tsx`), including a GitHub event-type dropdown, replacing free-text inputs.
- **Access Governance module** (`/api/v1/access-governance`, migrations `126`–`128`): entitlement reporting across users, roles, and effective permissions with over-privileged (wildcard) and dormant-access flags; separation-of-duties toxic-combination rules with a live violations report (five system rules ship, three enabled); access review certification campaigns (`draft → active → completed`) that generate an AC-2 evidence record on completion disclosing any self-reviewed items; and a role/permission simulator giving a positive/negative allowed-denied matrix before a role is assigned. New `sod_rules`, `access_review_campaigns`, `access_review_items` tables gated by `access_governance.read` / `.manage`, with row-level security on all four new tables. New `/dashboard/access-governance` page. Revocation decisions are recorded, never auto-applied — de-provisioning stays an explicit action through the existing guarded role-assignment flow.
- **AI-assisted RBAC document import** (migration `127`, `rbac_analysis` feature): upload a role definition spreadsheet, SoD matrix, or roles & responsibilities document (PDF/DOCX/TXT/MD/CSV) and have AI map its duties onto the live permission catalog, flag SoD conflicts including ones the organization is currently violating, and propose platform roles and SoD rules. Only extracted text is persisted; the uploaded file is processed in memory and discarded. Every suggestion requires an explicit per-item click to apply.
- **Nine-organization demo roster** — one per industry vertical (financial services, healthcare, defense, technology, energy, retail, biotech, higher education) plus an external audit firm with a seeded three-engagement workbench. Industry-addressed logins (`admin@financial.com` and so on) with the legacy tier logins kept as working aliases. See `DEMO_CREDENTIALS.md`.
- **SOC 2: all five Trust Services Criteria** (migration `129`): the framework shipped with 27 controls, every one a `CC*` — the Security category alone. Adds the 28 missing criteria across the Availability, Confidentiality, Processing Integrity, and Privacy categories <!-- ip-hygiene:ignore --> (category names and criterion identifiers only), each with the same examine / interview / test program the existing controls carry, and moves `coverage_status` to `comprehensive`. Descriptions are ControlWeave's own paraphrase; the AICPA text is copyrighted and is not reproduced.
- **Control function classification** (migration `130`): `framework_controls.control_functions text[]` carrying `preventive` / `detective` / `corrective`, backfilled from control titles with word-boundary matching. Roughly 500 of 1,200 controls are classified; the rest are deliberately left blank rather than guessed at. Filterable through the API and the controls UI.
- **Framework-neutral evidence type taxonomy** (migration `131`): a 14-value `evidence_types` vocabulary, an `evidence.evidence_type` foreign key, and `assessment_procedures.expected_evidence_types`, so evidence is labelled consistently regardless of framework. Pre-existing evidence stays untyped rather than being guessed at. New `GET /evidence/types` and an `?evidence_type=` list filter.
- **Auto-crosswalk propagation engine** (`services/crosswalkCreditService.js`, migration `132`): implementing or verifying a control now credits mapped controls at ≥90% similarity in the organization's other *active* frameworks as `satisfied_via_crosswalk`, which is what `README.md` and `docs/HOW_CROSSWALKS_WORK.md` have described for several releases without any code behind it. Credits are recorded per (organization, credited control, source control) in `control_crosswalk_credits` with the similarity score, mapping type, and the status the control held beforehand, so `GET /controls/:id` can return the provenance an assessor will ask for. Credit is withdrawn automatically when the source control stops being implemented, restoring the recorded prior status — unless another still-implemented source justifies it, or someone has since implemented the control themselves. Credit never overwrites work already in progress, never crosses organizations, and both directions are audit-logged (`crosswalk_credit_applied` / `crosswalk_credit_withdrawn`) as AU-2 posture changes.

- **POA&M register, detail page, and the auditor review workflow** ([#569](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/569), [#570](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/570)): both issues shipped their migrations, routes and API clients and were closed with their frontend scope never built, which is why `POAM.md` carried a "What is API-only today" table listing nine capabilities. New `/dashboard/poam` register and `/dashboard/poam/[id]` detail page, plus a sidebar entry at `controls.read` — the permission every POA&M endpoint actually requires, where the only previous route in was a tab on Operations gated at `settings.manage`. The detail page carries field editing, the milestone editor, the progress timeline, submit-for-review, approval history, and multi-control linking. `scheduled_completion_date` renders read-only beside `due_date` with the slippage in days, because it is the original commitment and overwriting it erases the thing federal reporting asks you to show. The table is down to two entries.
- **Auditor review queue and decision panel**: a POA&M Review tab on the Auditor Workspace listing everything in `pending_auditor_review`, and an approve / reject / request-changes panel on the item itself, with the framework's own auditor guidance and expected review chain shown beside the form. Separation of duties is surfaced rather than enforced only on submit — the panel explains that you cannot review an item you submitted instead of letting you write a decision the API refuses with a 403.
- **Evidence version history and integrity verification in the dashboard**: a detail drawer with metadata editing, the full version list, prior-version download, file replacement, and the integrity check. Each superseded version shows its **PII classification as it was at the time**, which is the point of [#570](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/570)'s third bullet — the table alone does not demonstrate that a reclassification is recoverable if nothing ever reads it. `GET /evidence/:id/integrity-check` existed and was missing from the API client entirely.
- **POA&M CSV and PDF export** — `GET /poam/export?format=csv|pdf`, honoring the filters active on screen. Carries every linked control, the framework type, both dates with computed slippage, `resources_required`, milestone counts, and any linked risks and treatment. `README.md` has claimed "export POA&M status for federal and regulatory reporting" for several releases; the only POA&M output that existed was four aggregate counts inside the SSP report.
- **Risk register ↔ POA&M linkage** (migration `140`): migration `136` tied risks to controls (what treats the risk), assets (what is exposed) and objectives (what is threatened) — but not to the remediation work, so the register recorded the decision to treat a risk with no link to what was being done about it. New `risk_poam_links` (many-to-many; one remediation routinely addresses several risks) and `poam_items.treatment_id` for the tighter case where a POA&M executes one specific treatment. `POST /poam/from-risk/:riskId` sets priority from the residual score. Closing remediation deliberately does **not** move a residual score — inherent and residual are stored separately so an assessor can see what the controls achieved, and a score that moved on its own would destroy that evidence; the risk is flagged review-due instead.
- **Risk detail page** (`/dashboard/risks/[id]`) — the page `GET /risks/:id` never had. The register was a list and a heat map; clicking a row did nothing. Assessment, treatments, reviews, acceptance, the existing control/asset/objective links, and the new remediation panel.
- **Many-to-many POA&M ↔ control linkage** (migration `141`): `poam_items.control_id` was a single nullable FK, so one remediation could not span several controls even though evidence (`evidence_control_links`) and risks (`risk_control_links`) both could. One access-review remediation commonly closes findings against AC-2, AC-3 and AC-6 at once. Existing values are backfilled and the column is kept as the originating control.
- **Framework-appropriate terminology** — an ISO 27001 organization sees "Corrective Action Request", SOC 2 "Deficiency", FISCAM and HIPAA "Corrective Action Plan", PCI DSS "Risk Assessment & Validation", NIST and FedRAMP "POA&M". The seven vocabularies have shipped in `frameworkPoamService.js` since the feature was built and were unreachable (see Fixed). Labels only — URLs, tables and API paths are unchanged.
- **`.github/scripts/check-screenshots.js`**, wired into CI: fails on placeholder stub dimensions, the repo's own 500KB cap, and byte-identical duplicates. A compression-density heuristic was tried and removed — three of the four files it flagged were real screenshots, because a flat modern UI compresses about as well as a blank page, and a guard that is wrong three times in four teaches people to ignore it.
- **A `capture-screenshots` job that needs no secrets** — `workflow_dispatch` only, standing up Postgres, migrations, the demo seed, backend and frontend, then capturing against localhost. `DEMO_CREDENTIALS.md` documents localhost only, so the existing secrets-based path could never have succeeded in this repo no matter what was configured.
- **`docs/guides/RISK_REGISTER.md`** — the risk register shipped with no user guide at all.

### Changed

- **Departments and Business Objectives merged into one page.** Both were thin org-configuration lists with no lifecycle of their own, and they are read together — you assign an objective to a department, and a department's open-risk count only means something next to the objectives it owns. Now `/dashboard/structure` with a tab each, permission-gated per tab so `objectives.read` alone lands on the Objectives tab rather than a blank Departments view. `/dashboard/departments` and `/dashboard/objectives` redirect to the matching tab rather than 404.
- **Sidebar regrouped into collapsible sections with subsections** — it was four flat lists totalling 48 links. Now seven sections (plus a gated eighth for platform admins) following the GRC domains, with subsection headings inside the larger ones. Only the section containing the current route is expanded, collapse state persists, and active highlighting takes the longest matching href so a nested route no longer highlights its parent as well. No destination was added or removed in the regrouping.

### Fixed

- **Migration schema drift guard, ported from the ai-grc mirror.** The mirror repository found that a `CREATE TABLE IF NOT EXISTS` shadowed by an earlier migration declaring the same table silently drops the second file's columns from every database the schema is built on, and confirmed it live-breaking four subsystems there (SSO, SIEM, the job runner's retry path, data-retention-policy creation). This repository has no live instance of that defect — verified by running the new check against the full migration set — but shares the same duplicate-migration-number history (the `TEVV-DB-2` grandfathered list in `ci.yml`) that made it possible in the mirror. `backend/scripts/check-migration-schema-drift.js` (`npm run check:migration-drift`, wired into CI as `TEVV-DB-2a`) now fails the build if that ever changes; verified by injecting a synthetic shadowed table with an orphaned column and confirming the check catches it, then removing it. — @sherifconteh-collab
- **`GET /risks/:id` returned 500 for every risk.** The vendors query added with migration `142` selected `v.name`; the column is `vendor_name`. Because the seven link queries run in a single `Promise.all`, that one wrong column took down the entire endpoint — controls, assets, objectives, POA&Ms, vendors and evidence all unreachable, and the risk detail page with them. Found by running the stack for the first time: no static gate could catch it, since `check:syntax` parses without resolving queries, typecheck cannot see into a SQL string, and the migration itself is valid.

- **The compliance gate was enforced on a code path the product does not use.** `PUT /controls/:id` demanded a `poam_justification` when a control moved to compliant, created the POA&M and filed the approval request. The dashboard does not call it — the control detail page calls `PATCH /implementations/:id/status` and `PATCH /implementations/:id/test-result`, and neither had a single POA&M reference. So a control could be marked compliant from the UI with no justification and nothing produced for an auditor to review. The rule now lives in `services/poamGateService.js` and is applied on all three paths, preserving the `requires_poam_submission` 400 response contract that existing API clients branch on.
- **Nothing that found a compliance gap raised remediation.** Recording a control test or an assessment procedure as `other_than_satisfied` — NIST SP 800-53A for "this control has gaps", and the canonical trigger for a POA&M — produced nothing at all, and `routes/assessments/findings.js` had no POA&M references whatsoever. Across all three `INSERT INTO poam_items` sites only `'control'` and `'vulnerability'` were ever written; `'audit_finding'` and `'assessment'` were declared in `ALLOWED_SOURCE_TYPE` from the start and dead. Those three events now raise a **draft** POA&M against the control, idempotent per (control, source), with owner, dates and remediation plan deliberately left blank for a human. Nothing is auto-closed, auto-approved or auto-assigned, and findings raise only at medium severity and above.
- **`GET /poam/framework-types` was unreachable.** Declared after `router.get('/:id')`, so Express bound `id="framework-types"` and the request 404'd as "POA&M item not found". The entire multi-framework POA&M vocabulary sat behind it — FISCAM CAP/NFR, ISO CAR/OFI, SOC 2 exception/deficiency, HIPAA CAP, PCI RAV, NIST and FedRAMP — which is why nothing in the product ever offered a type picker and every screen said "POA&M" regardless of the customer's framework. It now resolves, and is scoped to the organization's activated frameworks rather than returning all seven.
- **The control detail page hid its own POA&M panel when it mattered.** The Risk & Compliance section rendered only when a POA&M or vulnerability already existed, so a control with neither showed nothing, offered no way to raise one, and its empty state was unreachable code. Its "View all" link pointed at `/dashboard/poam`, a route that did not exist and returned a 404.
- **The screenshot pipeline's two root causes.** `sync-stale-content` committed with a blanket `git add -A`, which is how `bb54355` swept in thirty-two 200×40 placeholder PNGs that `sync-doc-content.js` never writes and never touches; staging is now driven by the paths that script reports in `doc-sync-report.json`. And the capture step ran unconditionally, hit `process.exit(1)` on the first line of `capture-screenshots.js` for missing demo credentials, and reported a failure on **every** run of the workflow — it now checks for the credentials and skips with an explicit notice.
- **`controls-list-01.png` was a blank page with a loading spinner**, referenced by `CONTROLS.md`, `GETTING_STARTED.md` and the wiki as "Controls list showing control ID, title, framework, status, and owner". Removed along with its three references.
- **An unguarded division rendered a literal `NaNs`** in the Auditor Workspace's multi-agent results, where an optional `durationMs` was divided by 1000 without a check. Surfaced by typing state that had been `any`.
- **`CMDB.md` documented four features that do not exist**: the bulk asset import with its AI field-mapping workflow, Dry Run button and `POST /cmdb/import/analyze` + `/import/commit` endpoints; hardware CSV import; the SBOM tab on software assets; and the AIBOM tab on AI agents. Asset-control mapping and shadow-IT detection are real endpoints with no UI and are now labelled as such. Seven navigation steps pointed at `Assets & Security → Assets` for registers that live at `/dashboard/cmdb`, and six orphaned tier-comparison table rows sat directly beneath the sentence stating there is no tier gating.

- **`assessment_procedures` had no uniqueness on `(framework_control_id, procedure_id)`**, so every `ON CONFLICT DO NOTHING` insert against that table was a silent no-op guard: re-running any procedure seeder duplicated its rows instead of skipping them. Migration `129` deduplicates defensively and adds the constraint, which makes the `ON CONFLICT` clauses in every seeder actually work.
- **Demo-account seeding re-ran on every boot.** `ensureDemoAccountsSeeded()` matched on `lower(u.email)`, but `users.email` is encrypted at rest — the comparison ran against ciphertext and never matched, so the full demo seed re-executed on each start. Now matched on the deterministic `email_hash` lookup key; boot logs `demo.seed.present` and skips.
- **The public contact endpoint emailed `undefined` credentials.** Its tier-to-demo-account map had collapsed, so enquiries received a message containing literal `undefined` in place of a login. Replaced with industry resolution, a legacy tier mapping, and a guaranteed fallback.

- **`evidence_collection_rules` accepted only `splunk`/`connector`**: migration `088`'s `source_type` CHECK constraint never matched the app's own `ALLOWED_SOURCE_TYPES` allowlist (`microsoft_sentinel`, `aws_cloudtrail`, `crowdstrike`, `jira`, `servicenow`, `github`) <!-- ip-hygiene:ignore --> — creating a rule with any of those source types threw a raw Postgres constraint violation. Fixed in migration `125`.
- **Auto-Evidence rule creation form silently discarded its configuration**: `RuleForm`'s submit handler always sent `source_config: {}` regardless of source type, so no rule created through the UI (Splunk included) was ever actually functional. Fixed generically using the already-fetched `/auto-evidence/sources` `configFields` metadata.

### Security

- **`express-rate-limit` was undeclared in `package.json`.** It resolved only as a transitive dependency of `@modelcontextprotocol/sdk` while **25 route files require it directly** — if that SDK ever dropped or relocated it, none of those routers would load and the backend would stop booting. Now declared explicitly at `^8.5.2`; the pre-existing exact-version override became `$express-rate-limit` so it follows the declared range rather than conflicting with it (npm rejects the combination outright).
- **Six advisories cleared across both dependency trees.** Each was a pin that was correct when written and had fallen exactly one patch short: `brace-expansion` `>=5.0.8` → `>=5.0.9` (DoS bypassing the CVE-2026-14257 mitigation), `hono` `^4.12.28` → `^4.12.34` (ReDoS in the CORS middleware), `socket.io-parser` `4.2.6` → `>=4.2.7` (zero-attachment memory exhaustion), plus newly added pins for `fast-uri` `^3.1.5` (host confusion via a backslash authority introducer) and `ip-address` `^10.4.0` (leading-zero octets decoded as decimal, allowing SSRF and trust-boundary bypass). `fast-uri` is held inside the 3.x line rather than taking the 4.x latest, because the advisory is fixed in 3.1.5 and a major bump would land on a consumer that has not asked for it. Backend and frontend both report zero vulnerabilities under the flags CI uses.
- **`js-yaml` and `nanoid` were both sitting on vulnerable transitive versions with no direct pin.** `js-yaml` resolved to a pre-4.3.1 release vulnerable to prototype pollution via a crafted document; now pinned `^4.3.1` in both backend and frontend `overrides` (the frontend override was added after the backend fix shipped, closing a devDependency gap that let an unpinned copy back in through `eslint`'s toolchain). `nanoid` resolved below 3.3.8, vulnerable to predictable ID generation from a broken CSPRNG fallback; capped `>=3.3.17 <4.0.0` so the fix applies without pulling the breaking 4.x ESM-only line into a CommonJS backend.

- **`routes/poam.js` had no rate limiting at all** — `router.use(authenticate)` and nothing else, while its sibling `routes/poamMilestones.js` carried a router-wide limiter. Both halves of one feature are now governed by the same rule, with the new `/poam/export` route limited separately at 10/min because it streams an organization's entire remediation register in one response. The export is audit-logged as an AU-2 event.

- **GitHub and Splunk connector tokens were stored in plaintext**: both `githubService.js` and the pre-existing `splunkService.js` set `organization_settings.is_encrypted = true` on save but never actually called `encrypt()`/`decrypt()` from `utils/encrypt.js` — the stored value was plain text despite the flag. Both now encrypt at rest (AES-256-GCM); `decrypt()` transparently falls back to legacy plaintext rows, so no migration is required.
- **Rate limits on the control and implementation routes crosswalk propagation made expensive**: `PUT /controls/:id/implementation` and `PATCH /implementations/:id/status` (60/min — one status change now fans out into a mapping query plus a read-modify-write per credited control, or a withdrawal walk over everything the control was holding up), `POST /controls/:id/inherit` (20/min — several queries per mapped control, and a control can carry dozens of mappings), and `GET /controls/:id` (120/min). Neither route file had any rate limiting before.
- **Rate limits on seven previously unlimited evidence routes**: `GET /evidence/:id/download` and `GET /evidence/:id/integrity-check` (30/min each — the download path is the bulk-exfiltration route for files that may carry PII, and integrity-check re-hashes the stored file on every call), `DELETE /evidence/:id` (30/min, destructive and irreversible), `PUT /evidence/:id`, `POST /evidence/:id/link`, `DELETE /evidence/:evidenceId/unlink/:controlId` (60/min each), and `GET /evidence/:id` (120/min).

---

---

## Version 4.10.0 — August 04, 2026


### Added

- **An end-to-end verification harness for the link surface** — `scripts/qa-link-routes-e2e.sh` (`npm run qa:e2e:links`), shared with the ai-grc mirror. 35 assertions against a running API covering both directions of every link added in migrations `140`–`143`, the `asset_control_mappings` mapping that migration `005` never had an API for, generated-column arithmetic, `relevance` validation returning a 400 that names the options rather than a 500 from the CHECK constraint, `ON CONFLICT` idempotency, unlink, and cross-organization isolation on all three new read paths. The evidence expiry column is taken from `EVIDENCE_EXPIRY_FIELD` (`expires_at` here, `retention_until` in the mirror) because asserting the specific column is what catches a blind port between the two repositories.

- **Risk register: evidence linkage.** Migration 143 adds `risk_evidence_links`,
  completing the register's connections. Evidence has been linkable to controls
  since migration 009, so a risk's evidence was only reachable transitively —
  via its controls, and only when those controls happened to carry the document.
  `relevance` (`assessment` / `treatment` / `monitoring` / `acceptance`) lives on
  the link because the same document supports different risks for different
  reasons. `POST`/`DELETE /risks/:id/evidence/:evidenceId`, evidence in
  `GET /risks/:id`, and `GET /evidence/:id/risks` for the reverse view.

- **Risk register: vendor linkage.** Migration 142 adds `risk_vendor_links`, the
  fourth link table alongside controls, assets and objectives. `tprm_vendors`
  already carried a `risk_tier`, but that is a static onboarding classification,
  not a scored and reviewed risk — so vendor concentration was invisible to the
  register and the register was invisible during a vendor review.
  `POST`/`DELETE /risks/:id/vendors/:vendorId`, vendors included in
  `GET /risks/:id`, and the TPRM vendor detail response now carries `risks`,
  `open_risk_count` and `max_residual_score`. The vendor panel flags a tier that
  disagrees with the risks recorded against it.

- **CMDB: risk exposure on assets.** `risk_asset_links` shipped with migration
  136 but only the risk half was reachable — an asset could be attached to a
  risk and then never seen from the asset again. Adds
  `GET /cmdb/assets/:assetId/risks` and
  `GET /cmdb/risk-exposure[?category=]` (open-risk count, worst residual and top
  risk per asset, one query for the estate), plus a Risk Exposure panel on the
  asset drawer showing the inherent-to-residual movement and linking through to
  the register. Read-only by design: linking stays on the risk so one screen
  owns the relationship.

- **CMDB: asset-to-control mapping.** `asset_control_mappings` has been in the
  schema since migration 005 with no API and no UI, so an asset inventory could
  not evidence CM-8 — the control it exists to satisfy. Adds
  `GET`/`POST /cmdb/assets/:assetId/controls`,
  `PUT`/`DELETE /cmdb/assets/:assetId/controls/:controlId` and
  `GET /cmdb/controls/:controlId/assets`, plus a Compliance Controls section in
  the asset drawer to link, status and unlink.
- **CMDB: bulk import and inventory export.** `POST /cmdb/import/analyze` is a
  true dry run that writes nothing and returns a per-row verdict with source
  line numbers; `POST /cmdb/import/commit` inserts every valid row in one
  transaction. `GET /cmdb/import/template` and `/cmdb/import/export` round-trip
  the same columns. New Bulk import & export panel on the CMDB dashboard, with
  Import disabled until a dry run has run. Both import and export are
  audit-logged.
- **CMDB: editing on every register.** Hardware, Software, AI Agents, Service
  Accounts, Environments and Password Vaults each had only Add and Delete, so
  fixing a typo meant deleting the record and retyping it. The PUT endpoints and
  the `update` client method already existed and had never been called.

- **Risk register, incidents, obligations, objectives, indicators, and departments** (migrations `135`–`139`): ControlWeave ships ISO 31000, ISO 27005 and the NIST AI RMF as frameworks a customer can assess against, but had nowhere to record the risks those frameworks are about. The only risk-shaped table was `risk_scores` (migration `057`) — one computed 0-100 posture number per organization, which is a metric, not a register. Six modules close that gap:
  - `departments` (hierarchical business units) and `business_objectives` (COSO's four categories), the organizational spine every other register hangs off. ISO 31000 defines risk as the effect of uncertainty *on objectives*; without recorded objectives a register is a list of bad things with nothing to be bad for.
  - `risks` / `risk_treatments` / `risk_reviews` plus control, asset and objective link tables (ISO 31000 / ISO 27005 / NIST SP 800-30). Inherent **and** residual assessment as likelihood × impact on 1–5 scales, the product a stored generated column so 5×5 heat-map queries cannot drift from their inputs. Acceptance is a named decision with a rationale and an optional expiry, and a lapsed acceptance is surfaced as such rather than left reading "accepted". Reviews snapshot the assessment as it stood, so history survives later edits to the risk row.
  - `incidents` / `incident_timeline` plus risk, control and asset link tables (NIST SP 800-61r2). Per-phase timestamps rather than a status history, because the intervals *are* the metrics — dwell time, time to contain, time to resolve. Transitions are validated against an explicit graph: an incident cannot be eradicated before it is contained, and allowing that produces response metrics that are quietly nonsense. Breach notification is first class, with the 72-hour class of clock tracked and overdue reported as how far past rather than a generic flag.
  - `compliance_obligations` / `obligation_attestations` / `obligation_control_links`: what the organization is bound to, by whom, by when. Distinct from controls because obligations have a source with authority and they expire. Recurring due dates advance from the *due date*, never from the attestation date, so a repeatedly-late annual obligation cannot drift its own deadline out of the period the regulator expects.
  - `indicators` / `indicator_measurements`: KRI / KPI / KCI with amber and red thresholds and an explicit `direction`, so "higher is worse" and "higher is better" indicators are both handled instead of whichever case the author had in mind. `breach_level` is persisted at write time so retuning a threshold does not silently rewrite historic breaches.

  Twelve permissions (`risks.*`, `incidents.*`, `obligations.*`, `objectives.*`, `indicators.*`, `departments.*`) are seeded and granted in the same migrations that introduce the routes using them. Incident *write* goes to `user` as well as `admin`: incident reporting has to be available to whoever noticed the problem, or it gets reported by email and never reaches the register. Six new dashboard pages (`/dashboard/risks` with the 5×5 residual heat map, `/dashboard/incidents`, `/dashboard/obligations`, `/dashboard/indicators`, `/dashboard/objectives`, `/dashboard/departments`). All routes are org-scoped, paginated, rate-limited at both the IP and per-organization level, and audit-logged on mutation.

- **Federal POA&M structure — milestones, resources, and slippage tracking** ([#569](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/569), migration `134`): `poam_items` carried the core lifecycle but was short of what a federal POA&M requires. New `poam_milestones` table with discrete milestones, each with its own target date, status (`pending` / `in_progress` / `completed` / `delayed` / `cancelled`, enforced by a CHECK constraint) and completion date, exposed as a sub-resource at `/poam/:id/milestones` (list, create, patch, delete) with a completed/overdue summary. New `resources_required` records the funding, staff, and tooling estimate reviewers ask for. New `scheduled_completion_date` holds the *originally scheduled* completion date and is set once, while `due_date` carries the current target — so revising a date makes the slippage visible instead of erasing it. Existing rows are backfilled from `due_date` so slippage reporting does not silently skip them.
- **Real evidence version history** ([#570](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/570), migration `133`): `evidence.evidence_version` was an integer that incremented while the row was overwritten in place — no prior version's file, hash, or classification could be retrieved, so the counter went up but nothing was kept. Each update now archives the row as it stood into a new `evidence_versions` table, in the same transaction as the update. New `POST /evidence/:id/versions` replaces the file while retaining the superseded one and its hash, so integrity stays demonstrable across a replacement; `GET /evidence/:id/versions` lists superseded versions and `GET /evidence/:id/versions/:versionNumber/download` retrieves one. Reclassifying evidence no longer destroys the record of what it was classified as while being relied on. Version records are immutable and cascade-delete with their parent. File replacement is audit-logged as `evidence_version_created`.

- **GitHub Evidence Connector**: `services/githubService.js` and `routes/github.js` add a real GitHub REST API client — org-scoped token settings (`Settings → Integrations → GitHub`), a test-connection check, a one-time import endpoint, and a full `code_scanning_alerts` / `dependabot_alerts` / `audit_log` / `pull_requests` source for Auto-Evidence Collection Rules. GitHub now performs genuine live data retrieval (like Splunk), not just configuration-record evidence.
- Dynamic per-source-type configuration fields in the Auto-Evidence rule creation form (`dashboard/evidence/auto/page.tsx`), including a GitHub event-type dropdown, replacing free-text inputs.
- **Access Governance module** (`/api/v1/access-governance`, migrations `126`–`128`): entitlement reporting across users, roles, and effective permissions with over-privileged (wildcard) and dormant-access flags; separation-of-duties toxic-combination rules with a live violations report (five system rules ship, three enabled); access review certification campaigns (`draft → active → completed`) that generate an AC-2 evidence record on completion disclosing any self-reviewed items; and a role/permission simulator giving a positive/negative allowed-denied matrix before a role is assigned. New `sod_rules`, `access_review_campaigns`, `access_review_items` tables gated by `access_governance.read` / `.manage`, with row-level security on all four new tables. New `/dashboard/access-governance` page. Revocation decisions are recorded, never auto-applied — de-provisioning stays an explicit action through the existing guarded role-assignment flow.
- **AI-assisted RBAC document import** (migration `127`, `rbac_analysis` feature): upload a role definition spreadsheet, SoD matrix, or roles & responsibilities document (PDF/DOCX/TXT/MD/CSV) and have AI map its duties onto the live permission catalog, flag SoD conflicts including ones the organization is currently violating, and propose platform roles and SoD rules. Only extracted text is persisted; the uploaded file is processed in memory and discarded. Every suggestion requires an explicit per-item click to apply.
- **Nine-organization demo roster** — one per industry vertical (financial services, healthcare, defense, technology, energy, retail, biotech, higher education) plus an external audit firm with a seeded three-engagement workbench. Industry-addressed logins (`admin@financial.com` and so on) with the legacy tier logins kept as working aliases. See `DEMO_CREDENTIALS.md`.
- **SOC 2: all five Trust Services Criteria** (migration `129`): the framework shipped with 27 controls, every one a `CC*` — the Security category alone. Adds the 28 missing criteria across the Availability, Confidentiality, Processing Integrity, and Privacy categories <!-- ip-hygiene:ignore --> (category names and criterion identifiers only), each with the same examine / interview / test program the existing controls carry, and moves `coverage_status` to `comprehensive`. Descriptions are ControlWeave's own paraphrase; the AICPA text is copyrighted and is not reproduced.
- **Control function classification** (migration `130`): `framework_controls.control_functions text[]` carrying `preventive` / `detective` / `corrective`, backfilled from control titles with word-boundary matching. Roughly 500 of 1,200 controls are classified; the rest are deliberately left blank rather than guessed at. Filterable through the API and the controls UI.
- **Framework-neutral evidence type taxonomy** (migration `131`): a 14-value `evidence_types` vocabulary, an `evidence.evidence_type` foreign key, and `assessment_procedures.expected_evidence_types`, so evidence is labelled consistently regardless of framework. Pre-existing evidence stays untyped rather than being guessed at. New `GET /evidence/types` and an `?evidence_type=` list filter.
- **Auto-crosswalk propagation engine** (`services/crosswalkCreditService.js`, migration `132`): implementing or verifying a control now credits mapped controls at ≥90% similarity in the organization's other *active* frameworks as `satisfied_via_crosswalk`, which is what `README.md` and `docs/HOW_CROSSWALKS_WORK.md` have described for several releases without any code behind it. Credits are recorded per (organization, credited control, source control) in `control_crosswalk_credits` with the similarity score, mapping type, and the status the control held beforehand, so `GET /controls/:id` can return the provenance an assessor will ask for. Credit is withdrawn automatically when the source control stops being implemented, restoring the recorded prior status — unless another still-implemented source justifies it, or someone has since implemented the control themselves. Credit never overwrites work already in progress, never crosses organizations, and both directions are audit-logged (`crosswalk_credit_applied` / `crosswalk_credit_withdrawn`) as AU-2 posture changes.

- **POA&M register, detail page, and the auditor review workflow** ([#569](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/569), [#570](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/570)): both issues shipped their migrations, routes and API clients and were closed with their frontend scope never built, which is why `POAM.md` carried a "What is API-only today" table listing nine capabilities. New `/dashboard/poam` register and `/dashboard/poam/[id]` detail page, plus a sidebar entry at `controls.read` — the permission every POA&M endpoint actually requires, where the only previous route in was a tab on Operations gated at `settings.manage`. The detail page carries field editing, the milestone editor, the progress timeline, submit-for-review, approval history, and multi-control linking. `scheduled_completion_date` renders read-only beside `due_date` with the slippage in days, because it is the original commitment and overwriting it erases the thing federal reporting asks you to show. The table is down to two entries.
- **Auditor review queue and decision panel**: a POA&M Review tab on the Auditor Workspace listing everything in `pending_auditor_review`, and an approve / reject / request-changes panel on the item itself, with the framework's own auditor guidance and expected review chain shown beside the form. Separation of duties is surfaced rather than enforced only on submit — the panel explains that you cannot review an item you submitted instead of letting you write a decision the API refuses with a 403.
- **Evidence version history and integrity verification in the dashboard**: a detail drawer with metadata editing, the full version list, prior-version download, file replacement, and the integrity check. Each superseded version shows its **PII classification as it was at the time**, which is the point of [#570](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/570)'s third bullet — the table alone does not demonstrate that a reclassification is recoverable if nothing ever reads it. `GET /evidence/:id/integrity-check` existed and was missing from the API client entirely.
- **POA&M CSV and PDF export** — `GET /poam/export?format=csv|pdf`, honoring the filters active on screen. Carries every linked control, the framework type, both dates with computed slippage, `resources_required`, milestone counts, and any linked risks and treatment. `README.md` has claimed "export POA&M status for federal and regulatory reporting" for several releases; the only POA&M output that existed was four aggregate counts inside the SSP report.
- **Risk register ↔ POA&M linkage** (migration `140`): migration `136` tied risks to controls (what treats the risk), assets (what is exposed) and objectives (what is threatened) — but not to the remediation work, so the register recorded the decision to treat a risk with no link to what was being done about it. New `risk_poam_links` (many-to-many; one remediation routinely addresses several risks) and `poam_items.treatment_id` for the tighter case where a POA&M executes one specific treatment. `POST /poam/from-risk/:riskId` sets priority from the residual score. Closing remediation deliberately does **not** move a residual score — inherent and residual are stored separately so an assessor can see what the controls achieved, and a score that moved on its own would destroy that evidence; the risk is flagged review-due instead.
- **Risk detail page** (`/dashboard/risks/[id]`) — the page `GET /risks/:id` never had. The register was a list and a heat map; clicking a row did nothing. Assessment, treatments, reviews, acceptance, the existing control/asset/objective links, and the new remediation panel.
- **Many-to-many POA&M ↔ control linkage** (migration `141`): `poam_items.control_id` was a single nullable FK, so one remediation could not span several controls even though evidence (`evidence_control_links`) and risks (`risk_control_links`) both could. One access-review remediation commonly closes findings against AC-2, AC-3 and AC-6 at once. Existing values are backfilled and the column is kept as the originating control.
- **Framework-appropriate terminology** — an ISO 27001 organization sees "Corrective Action Request", SOC 2 "Deficiency", FISCAM and HIPAA "Corrective Action Plan", PCI DSS "Risk Assessment & Validation", NIST and FedRAMP "POA&M". The seven vocabularies have shipped in `frameworkPoamService.js` since the feature was built and were unreachable (see Fixed). Labels only — URLs, tables and API paths are unchanged.
- **`.github/scripts/check-screenshots.js`**, wired into CI: fails on placeholder stub dimensions, the repo's own 500KB cap, and byte-identical duplicates. A compression-density heuristic was tried and removed — three of the four files it flagged were real screenshots, because a flat modern UI compresses about as well as a blank page, and a guard that is wrong three times in four teaches people to ignore it.
- **A `capture-screenshots` job that needs no secrets** — `workflow_dispatch` only, standing up Postgres, migrations, the demo seed, backend and frontend, then capturing against localhost. `DEMO_CREDENTIALS.md` documents localhost only, so the existing secrets-based path could never have succeeded in this repo no matter what was configured.
- **`docs/guides/RISK_REGISTER.md`** — the risk register shipped with no user guide at all.

### Changed

- **Departments and Business Objectives merged into one page.** Both were thin org-configuration lists with no lifecycle of their own, and they are read together — you assign an objective to a department, and a department's open-risk count only means something next to the objectives it owns. Now `/dashboard/structure` with a tab each, permission-gated per tab so `objectives.read` alone lands on the Objectives tab rather than a blank Departments view. `/dashboard/departments` and `/dashboard/objectives` redirect to the matching tab rather than 404.
- **Sidebar regrouped into collapsible sections with subsections** — it was four flat lists totalling 48 links. Now seven sections (plus a gated eighth for platform admins) following the GRC domains, with subsection headings inside the larger ones. Only the section containing the current route is expanded, collapse state persists, and active highlighting takes the longest matching href so a nested route no longer highlights its parent as well. No destination was added or removed in the regrouping.

### Fixed

- **`GET /risks/:id` returned 500 for every risk.** The vendors query added with migration `142` selected `v.name`; the column is `vendor_name`. Because the seven link queries run in a single `Promise.all`, that one wrong column took down the entire endpoint — controls, assets, objectives, POA&Ms, vendors and evidence all unreachable, and the risk detail page with them. Found by running the stack for the first time: no static gate could catch it, since `check:syntax` parses without resolving queries, typecheck cannot see into a SQL string, and the migration itself is valid.

- **The compliance gate was enforced on a code path the product does not use.** `PUT /controls/:id` demanded a `poam_justification` when a control moved to compliant, created the POA&M and filed the approval request. The dashboard does not call it — the control detail page calls `PATCH /implementations/:id/status` and `PATCH /implementations/:id/test-result`, and neither had a single POA&M reference. So a control could be marked compliant from the UI with no justification and nothing produced for an auditor to review. The rule now lives in `services/poamGateService.js` and is applied on all three paths, preserving the `requires_poam_submission` 400 response contract that existing API clients branch on.
- **Nothing that found a compliance gap raised remediation.** Recording a control test or an assessment procedure as `other_than_satisfied` — NIST SP 800-53A for "this control has gaps", and the canonical trigger for a POA&M — produced nothing at all, and `routes/assessments/findings.js` had no POA&M references whatsoever. Across all three `INSERT INTO poam_items` sites only `'control'` and `'vulnerability'` were ever written; `'audit_finding'` and `'assessment'` were declared in `ALLOWED_SOURCE_TYPE` from the start and dead. Those three events now raise a **draft** POA&M against the control, idempotent per (control, source), with owner, dates and remediation plan deliberately left blank for a human. Nothing is auto-closed, auto-approved or auto-assigned, and findings raise only at medium severity and above.
- **`GET /poam/framework-types` was unreachable.** Declared after `router.get('/:id')`, so Express bound `id="framework-types"` and the request 404'd as "POA&M item not found". The entire multi-framework POA&M vocabulary sat behind it — FISCAM CAP/NFR, ISO CAR/OFI, SOC 2 exception/deficiency, HIPAA CAP, PCI RAV, NIST and FedRAMP — which is why nothing in the product ever offered a type picker and every screen said "POA&M" regardless of the customer's framework. It now resolves, and is scoped to the organization's activated frameworks rather than returning all seven.
- **The control detail page hid its own POA&M panel when it mattered.** The Risk & Compliance section rendered only when a POA&M or vulnerability already existed, so a control with neither showed nothing, offered no way to raise one, and its empty state was unreachable code. Its "View all" link pointed at `/dashboard/poam`, a route that did not exist and returned a 404.
- **The screenshot pipeline's two root causes.** `sync-stale-content` committed with a blanket `git add -A`, which is how `bb54355` swept in thirty-two 200×40 placeholder PNGs that `sync-doc-content.js` never writes and never touches; staging is now driven by the paths that script reports in `doc-sync-report.json`. And the capture step ran unconditionally, hit `process.exit(1)` on the first line of `capture-screenshots.js` for missing demo credentials, and reported a failure on **every** run of the workflow — it now checks for the credentials and skips with an explicit notice.
- **`controls-list-01.png` was a blank page with a loading spinner**, referenced by `CONTROLS.md`, `GETTING_STARTED.md` and the wiki as "Controls list showing control ID, title, framework, status, and owner". Removed along with its three references.
- **An unguarded division rendered a literal `NaNs`** in the Auditor Workspace's multi-agent results, where an optional `durationMs` was divided by 1000 without a check. Surfaced by typing state that had been `any`.
- **`CMDB.md` documented four features that do not exist**: the bulk asset import with its AI field-mapping workflow, Dry Run button and `POST /cmdb/import/analyze` + `/import/commit` endpoints; hardware CSV import; the SBOM tab on software assets; and the AIBOM tab on AI agents. Asset-control mapping and shadow-IT detection are real endpoints with no UI and are now labelled as such. Seven navigation steps pointed at `Assets & Security → Assets` for registers that live at `/dashboard/cmdb`, and six orphaned tier-comparison table rows sat directly beneath the sentence stating there is no tier gating.

- **`assessment_procedures` had no uniqueness on `(framework_control_id, procedure_id)`**, so every `ON CONFLICT DO NOTHING` insert against that table was a silent no-op guard: re-running any procedure seeder duplicated its rows instead of skipping them. Migration `129` deduplicates defensively and adds the constraint, which makes the `ON CONFLICT` clauses in every seeder actually work.
- **Demo-account seeding re-ran on every boot.** `ensureDemoAccountsSeeded()` matched on `lower(u.email)`, but `users.email` is encrypted at rest — the comparison ran against ciphertext and never matched, so the full demo seed re-executed on each start. Now matched on the deterministic `email_hash` lookup key; boot logs `demo.seed.present` and skips.
- **The public contact endpoint emailed `undefined` credentials.** Its tier-to-demo-account map had collapsed, so enquiries received a message containing literal `undefined` in place of a login. Replaced with industry resolution, a legacy tier mapping, and a guaranteed fallback.

- **`evidence_collection_rules` accepted only `splunk`/`connector`**: migration `088`'s `source_type` CHECK constraint never matched the app's own `ALLOWED_SOURCE_TYPES` allowlist (`microsoft_sentinel`, `aws_cloudtrail`, `crowdstrike`, `jira`, `servicenow`, `github`) <!-- ip-hygiene:ignore --> — creating a rule with any of those source types threw a raw Postgres constraint violation. Fixed in migration `125`.
- **Auto-Evidence rule creation form silently discarded its configuration**: `RuleForm`'s submit handler always sent `source_config: {}` regardless of source type, so no rule created through the UI (Splunk included) was ever actually functional. Fixed generically using the already-fetched `/auto-evidence/sources` `configFields` metadata.

### Security

- **`express-rate-limit` was undeclared in `package.json`.** It resolved only as a transitive dependency of `@modelcontextprotocol/sdk` while **25 route files require it directly** — if that SDK ever dropped or relocated it, none of those routers would load and the backend would stop booting. Now declared explicitly at `^8.5.2`; the pre-existing exact-version override became `$express-rate-limit` so it follows the declared range rather than conflicting with it (npm rejects the combination outright).
- **Six advisories cleared across both dependency trees.** Each was a pin that was correct when written and had fallen exactly one patch short: `brace-expansion` `>=5.0.8` → `>=5.0.9` (DoS bypassing the CVE-2026-14257 mitigation), `hono` `^4.12.28` → `^4.12.34` (ReDoS in the CORS middleware), `socket.io-parser` `4.2.6` → `>=4.2.7` (zero-attachment memory exhaustion), plus newly added pins for `fast-uri` `^3.1.5` (host confusion via a backslash authority introducer) and `ip-address` `^10.4.0` (leading-zero octets decoded as decimal, allowing SSRF and trust-boundary bypass). `fast-uri` is held inside the 3.x line rather than taking the 4.x latest, because the advisory is fixed in 3.1.5 and a major bump would land on a consumer that has not asked for it. Backend and frontend both report zero vulnerabilities under the flags CI uses.

- **`routes/poam.js` had no rate limiting at all** — `router.use(authenticate)` and nothing else, while its sibling `routes/poamMilestones.js` carried a router-wide limiter. Both halves of one feature are now governed by the same rule, with the new `/poam/export` route limited separately at 10/min because it streams an organization's entire remediation register in one response. The export is audit-logged as an AU-2 event.

- **GitHub and Splunk connector tokens were stored in plaintext**: both `githubService.js` and the pre-existing `splunkService.js` set `organization_settings.is_encrypted = true` on save but never actually called `encrypt()`/`decrypt()` from `utils/encrypt.js` — the stored value was plain text despite the flag. Both now encrypt at rest (AES-256-GCM); `decrypt()` transparently falls back to legacy plaintext rows, so no migration is required.
- **Rate limits on the control and implementation routes crosswalk propagation made expensive**: `PUT /controls/:id/implementation` and `PATCH /implementations/:id/status` (60/min — one status change now fans out into a mapping query plus a read-modify-write per credited control, or a withdrawal walk over everything the control was holding up), `POST /controls/:id/inherit` (20/min — several queries per mapped control, and a control can carry dozens of mappings), and `GET /controls/:id` (120/min). Neither route file had any rate limiting before.
- **Rate limits on seven previously unlimited evidence routes**: `GET /evidence/:id/download` and `GET /evidence/:id/integrity-check` (30/min each — the download path is the bulk-exfiltration route for files that may carry PII, and integrity-check re-hashes the stored file on every call), `DELETE /evidence/:id` (30/min, destructive and irreversible), `PUT /evidence/:id`, `POST /evidence/:id/link`, `DELETE /evidence/:evidenceId/unlink/:controlId` (60/min each), and `GET /evidence/:id` (120/min).

---

---

## Version 4.9.0 — August 01, 2026


### Added

- **Risk register, incidents, obligations, objectives, indicators, and departments** (migrations `135`–`139`): ControlWeave ships ISO 31000, ISO 27005 and the NIST AI RMF as frameworks a customer can assess against, but had nowhere to record the risks those frameworks are about. The only risk-shaped table was `risk_scores` (migration `057`) — one computed 0-100 posture number per organization, which is a metric, not a register. Six modules close that gap:
  - `departments` (hierarchical business units) and `business_objectives` (COSO's four categories), the organizational spine every other register hangs off. ISO 31000 defines risk as the effect of uncertainty *on objectives*; without recorded objectives a register is a list of bad things with nothing to be bad for.
  - `risks` / `risk_treatments` / `risk_reviews` plus control, asset and objective link tables (ISO 31000 / ISO 27005 / NIST SP 800-30). Inherent **and** residual assessment as likelihood × impact on 1–5 scales, the product a stored generated column so 5×5 heat-map queries cannot drift from their inputs. Acceptance is a named decision with a rationale and an optional expiry, and a lapsed acceptance is surfaced as such rather than left reading "accepted". Reviews snapshot the assessment as it stood, so history survives later edits to the risk row.
  - `incidents` / `incident_timeline` plus risk, control and asset link tables (NIST SP 800-61r2). Per-phase timestamps rather than a status history, because the intervals *are* the metrics — dwell time, time to contain, time to resolve. Transitions are validated against an explicit graph: an incident cannot be eradicated before it is contained, and allowing that produces response metrics that are quietly nonsense. Breach notification is first class, with the 72-hour class of clock tracked and overdue reported as how far past rather than a generic flag.
  - `compliance_obligations` / `obligation_attestations` / `obligation_control_links`: what the organization is bound to, by whom, by when. Distinct from controls because obligations have a source with authority and they expire. Recurring due dates advance from the *due date*, never from the attestation date, so a repeatedly-late annual obligation cannot drift its own deadline out of the period the regulator expects.
  - `indicators` / `indicator_measurements`: KRI / KPI / KCI with amber and red thresholds and an explicit `direction`, so "higher is worse" and "higher is better" indicators are both handled instead of whichever case the author had in mind. `breach_level` is persisted at write time so retuning a threshold does not silently rewrite historic breaches.

  Twelve permissions (`risks.*`, `incidents.*`, `obligations.*`, `objectives.*`, `indicators.*`, `departments.*`) are seeded and granted in the same migrations that introduce the routes using them. Incident *write* goes to `user` as well as `admin`: incident reporting has to be available to whoever noticed the problem, or it gets reported by email and never reaches the register. Six new dashboard pages (`/dashboard/risks` with the 5×5 residual heat map, `/dashboard/incidents`, `/dashboard/obligations`, `/dashboard/indicators`, `/dashboard/objectives`, `/dashboard/departments`). All routes are org-scoped, paginated, rate-limited at both the IP and per-organization level, and audit-logged on mutation.

- **Federal POA&M structure — milestones, resources, and slippage tracking** ([#569](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/569), migration `134`): `poam_items` carried the core lifecycle but was short of what a federal POA&M requires. New `poam_milestones` table with discrete milestones, each with its own target date, status (`pending` / `in_progress` / `completed` / `delayed` / `cancelled`, enforced by a CHECK constraint) and completion date, exposed as a sub-resource at `/poam/:id/milestones` (list, create, patch, delete) with a completed/overdue summary. New `resources_required` records the funding, staff, and tooling estimate reviewers ask for. New `scheduled_completion_date` holds the *originally scheduled* completion date and is set once, while `due_date` carries the current target — so revising a date makes the slippage visible instead of erasing it. Existing rows are backfilled from `due_date` so slippage reporting does not silently skip them.
- **Real evidence version history** ([#570](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/570), migration `133`): `evidence.evidence_version` was an integer that incremented while the row was overwritten in place — no prior version's file, hash, or classification could be retrieved, so the counter went up but nothing was kept. Each update now archives the row as it stood into a new `evidence_versions` table, in the same transaction as the update. New `POST /evidence/:id/versions` replaces the file while retaining the superseded one and its hash, so integrity stays demonstrable across a replacement; `GET /evidence/:id/versions` lists superseded versions and `GET /evidence/:id/versions/:versionNumber/download` retrieves one. Reclassifying evidence no longer destroys the record of what it was classified as while being relied on. Version records are immutable and cascade-delete with their parent. File replacement is audit-logged as `evidence_version_created`.

- **GitHub Evidence Connector**: `services/githubService.js` and `routes/github.js` add a real GitHub REST API client — org-scoped token settings (`Settings → Integrations → GitHub`), a test-connection check, a one-time import endpoint, and a full `code_scanning_alerts` / `dependabot_alerts` / `audit_log` / `pull_requests` source for Auto-Evidence Collection Rules. GitHub now performs genuine live data retrieval (like Splunk), not just configuration-record evidence.
- Dynamic per-source-type configuration fields in the Auto-Evidence rule creation form (`dashboard/evidence/auto/page.tsx`), including a GitHub event-type dropdown, replacing free-text inputs.
- **Access Governance module** (`/api/v1/access-governance`, migrations `126`–`128`): entitlement reporting across users, roles, and effective permissions with over-privileged (wildcard) and dormant-access flags; separation-of-duties toxic-combination rules with a live violations report (five system rules ship, three enabled); access review certification campaigns (`draft → active → completed`) that generate an AC-2 evidence record on completion disclosing any self-reviewed items; and a role/permission simulator giving a positive/negative allowed-denied matrix before a role is assigned. New `sod_rules`, `access_review_campaigns`, `access_review_items` tables gated by `access_governance.read` / `.manage`, with row-level security on all four new tables. New `/dashboard/access-governance` page. Revocation decisions are recorded, never auto-applied — de-provisioning stays an explicit action through the existing guarded role-assignment flow.
- **AI-assisted RBAC document import** (migration `127`, `rbac_analysis` feature): upload a role definition spreadsheet, SoD matrix, or roles & responsibilities document (PDF/DOCX/TXT/MD/CSV) and have AI map its duties onto the live permission catalog, flag SoD conflicts including ones the organization is currently violating, and propose platform roles and SoD rules. Only extracted text is persisted; the uploaded file is processed in memory and discarded. Every suggestion requires an explicit per-item click to apply.
- **Nine-organization demo roster** — one per industry vertical (financial services, healthcare, defense, technology, energy, retail, biotech, higher education) plus an external audit firm with a seeded three-engagement workbench. Industry-addressed logins (`admin@financial.com` and so on) with the legacy tier logins kept as working aliases. See `DEMO_CREDENTIALS.md`.
- **SOC 2: all five Trust Services Criteria** (migration `129`): the framework shipped with 27 controls, every one a `CC*` — the Security category alone. Adds the 28 missing criteria across the Availability, Confidentiality, Processing Integrity, and Privacy categories <!-- ip-hygiene:ignore --> (category names and criterion identifiers only), each with the same examine / interview / test program the existing controls carry, and moves `coverage_status` to `comprehensive`. Descriptions are ControlWeave's own paraphrase; the AICPA text is copyrighted and is not reproduced.
- **Control function classification** (migration `130`): `framework_controls.control_functions text[]` carrying `preventive` / `detective` / `corrective`, backfilled from control titles with word-boundary matching. Roughly 500 of 1,200 controls are classified; the rest are deliberately left blank rather than guessed at. Filterable through the API and the controls UI.
- **Framework-neutral evidence type taxonomy** (migration `131`): a 14-value `evidence_types` vocabulary, an `evidence.evidence_type` foreign key, and `assessment_procedures.expected_evidence_types`, so evidence is labelled consistently regardless of framework. Pre-existing evidence stays untyped rather than being guessed at. New `GET /evidence/types` and an `?evidence_type=` list filter.
- **Auto-crosswalk propagation engine** (`services/crosswalkCreditService.js`, migration `132`): implementing or verifying a control now credits mapped controls at ≥90% similarity in the organization's other *active* frameworks as `satisfied_via_crosswalk`, which is what `README.md` and `docs/HOW_CROSSWALKS_WORK.md` have described for several releases without any code behind it. Credits are recorded per (organization, credited control, source control) in `control_crosswalk_credits` with the similarity score, mapping type, and the status the control held beforehand, so `GET /controls/:id` can return the provenance an assessor will ask for. Credit is withdrawn automatically when the source control stops being implemented, restoring the recorded prior status — unless another still-implemented source justifies it, or someone has since implemented the control themselves. Credit never overwrites work already in progress, never crosses organizations, and both directions are audit-logged (`crosswalk_credit_applied` / `crosswalk_credit_withdrawn`) as AU-2 posture changes.

### Changed

- **Departments and Business Objectives merged into one page.** Both were thin org-configuration lists with no lifecycle of their own, and they are read together — you assign an objective to a department, and a department's open-risk count only means something next to the objectives it owns. Now `/dashboard/structure` with a tab each, permission-gated per tab so `objectives.read` alone lands on the Objectives tab rather than a blank Departments view. `/dashboard/departments` and `/dashboard/objectives` redirect to the matching tab rather than 404.
- **Sidebar regrouped into collapsible sections with subsections** — it was four flat lists totalling 48 links. Now seven sections (plus a gated eighth for platform admins) following the GRC domains, with subsection headings inside the larger ones. Only the section containing the current route is expanded, collapse state persists, and active highlighting takes the longest matching href so a nested route no longer highlights its parent as well. No destination was added or removed in the regrouping.

### Fixed

- **`assessment_procedures` had no uniqueness on `(framework_control_id, procedure_id)`**, so every `ON CONFLICT DO NOTHING` insert against that table was a silent no-op guard: re-running any procedure seeder duplicated its rows instead of skipping them. Migration `129` deduplicates defensively and adds the constraint, which makes the `ON CONFLICT` clauses in every seeder actually work.
- **Demo-account seeding re-ran on every boot.** `ensureDemoAccountsSeeded()` matched on `lower(u.email)`, but `users.email` is encrypted at rest — the comparison ran against ciphertext and never matched, so the full demo seed re-executed on each start. Now matched on the deterministic `email_hash` lookup key; boot logs `demo.seed.present` and skips.
- **The public contact endpoint emailed `undefined` credentials.** Its tier-to-demo-account map had collapsed, so enquiries received a message containing literal `undefined` in place of a login. Replaced with industry resolution, a legacy tier mapping, and a guaranteed fallback.

- **`evidence_collection_rules` accepted only `splunk`/`connector`**: migration `088`'s `source_type` CHECK constraint never matched the app's own `ALLOWED_SOURCE_TYPES` allowlist (`microsoft_sentinel`, `aws_cloudtrail`, `crowdstrike`, `jira`, `servicenow`, `github`) <!-- ip-hygiene:ignore --> — creating a rule with any of those source types threw a raw Postgres constraint violation. Fixed in migration `125`.
- **Auto-Evidence rule creation form silently discarded its configuration**: `RuleForm`'s submit handler always sent `source_config: {}` regardless of source type, so no rule created through the UI (Splunk included) was ever actually functional. Fixed generically using the already-fetched `/auto-evidence/sources` `configFields` metadata.

### Security

- **GitHub and Splunk connector tokens were stored in plaintext**: both `githubService.js` and the pre-existing `splunkService.js` set `organization_settings.is_encrypted = true` on save but never actually called `encrypt()`/`decrypt()` from `utils/encrypt.js` — the stored value was plain text despite the flag. Both now encrypt at rest (AES-256-GCM); `decrypt()` transparently falls back to legacy plaintext rows, so no migration is required.
- **Rate limits on the control and implementation routes crosswalk propagation made expensive**: `PUT /controls/:id/implementation` and `PATCH /implementations/:id/status` (60/min — one status change now fans out into a mapping query plus a read-modify-write per credited control, or a withdrawal walk over everything the control was holding up), `POST /controls/:id/inherit` (20/min — several queries per mapped control, and a control can carry dozens of mappings), and `GET /controls/:id` (120/min). Neither route file had any rate limiting before.
- **Rate limits on seven previously unlimited evidence routes**: `GET /evidence/:id/download` and `GET /evidence/:id/integrity-check` (30/min each — the download path is the bulk-exfiltration route for files that may carry PII, and integrity-check re-hashes the stored file on every call), `DELETE /evidence/:id` (30/min, destructive and irreversible), `PUT /evidence/:id`, `POST /evidence/:id/link`, `DELETE /evidence/:evidenceId/unlink/:controlId` (60/min each), and `GET /evidence/:id` (120/min).

---

---

## Version 4.8.0 — July 30, 2026


### Added

- **GitHub Evidence Connector**: `services/githubService.js` and `routes/github.js` add a real GitHub REST API client — org-scoped token settings (`Settings → Integrations → GitHub`), a test-connection check, a one-time import endpoint, and a full `code_scanning_alerts` / `dependabot_alerts` / `audit_log` / `pull_requests` source for Auto-Evidence Collection Rules. GitHub now performs genuine live data retrieval (like Splunk), not just configuration-record evidence.
- Dynamic per-source-type configuration fields in the Auto-Evidence rule creation form (`dashboard/evidence/auto/page.tsx`), including a GitHub event-type dropdown, replacing free-text inputs.
- **Access Governance module** (`/api/v1/access-governance`, migrations `126`–`128`): entitlement reporting across users, roles, and effective permissions with over-privileged (wildcard) and dormant-access flags; separation-of-duties toxic-combination rules with a live violations report (five system rules ship, three enabled); access review certification campaigns (`draft → active → completed`) that generate an AC-2 evidence record on completion disclosing any self-reviewed items; and a role/permission simulator giving a positive/negative allowed-denied matrix before a role is assigned. New `sod_rules`, `access_review_campaigns`, `access_review_items` tables gated by `access_governance.read` / `.manage`, with row-level security on all four new tables. New `/dashboard/access-governance` page. Revocation decisions are recorded, never auto-applied — de-provisioning stays an explicit action through the existing guarded role-assignment flow.
- **AI-assisted RBAC document import** (migration `127`, `rbac_analysis` feature): upload a role definition spreadsheet, SoD matrix, or roles & responsibilities document (PDF/DOCX/TXT/MD/CSV) and have AI map its duties onto the live permission catalog, flag SoD conflicts including ones the organization is currently violating, and propose platform roles and SoD rules. Only extracted text is persisted; the uploaded file is processed in memory and discarded. Every suggestion requires an explicit per-item click to apply.
- **Nine-organization demo roster** — one per industry vertical (financial services, healthcare, defense, technology, energy, retail, biotech, higher education) plus an external audit firm with a seeded three-engagement workbench. Industry-addressed logins (`admin@financial.com` and so on) with the legacy tier logins kept as working aliases. See `DEMO_CREDENTIALS.md`.
- **SOC 2: all five Trust Services Criteria** (migration `129`): the framework shipped with 27 controls, every one a `CC*` — the Security category alone. Adds the 28 missing criteria across the Availability, Confidentiality, Processing Integrity, and Privacy categories <!-- ip-hygiene:ignore --> (category names and criterion identifiers only), each with the same examine / interview / test program the existing controls carry, and moves `coverage_status` to `comprehensive`. Descriptions are ControlWeave's own paraphrase; the AICPA text is copyrighted and is not reproduced.
- **Control function classification** (migration `130`): `framework_controls.control_functions text[]` carrying `preventive` / `detective` / `corrective`, backfilled from control titles with word-boundary matching. Roughly 500 of 1,200 controls are classified; the rest are deliberately left blank rather than guessed at. Filterable through the API and the controls UI.
- **Framework-neutral evidence type taxonomy** (migration `131`): a 14-value `evidence_types` vocabulary, an `evidence.evidence_type` foreign key, and `assessment_procedures.expected_evidence_types`, so evidence is labelled consistently regardless of framework. Pre-existing evidence stays untyped rather than being guessed at. New `GET /evidence/types` and an `?evidence_type=` list filter.
- **Auto-crosswalk propagation engine** (`services/crosswalkPropagationService.js`, migration `132`): implementing or verifying a control now credits mapped controls at ≥90% similarity in the organization's other *active* frameworks as `satisfied_via_crosswalk`, which is what `README.md` and `docs/HOW_CROSSWALKS_WORK.md` have described for several releases without any code behind it. Credits are recorded per (organization, credited control, source control) in `control_crosswalk_credits` with the similarity score, mapping type, and the status the control held beforehand, so `GET /controls/:id` can return the provenance an assessor will ask for. Credit is withdrawn automatically when the source control stops being implemented, restoring the recorded prior status — unless another still-implemented source justifies it, or someone has since implemented the control themselves. Credit never overwrites work already in progress, never crosses organizations, and both directions are audit-logged (`crosswalk_credit_applied` / `crosswalk_credit_withdrawn`) as AU-2 posture changes.

### Fixed

- **`assessment_procedures` had no uniqueness on `(framework_control_id, procedure_id)`**, so every `ON CONFLICT DO NOTHING` insert against that table was a silent no-op guard: re-running any procedure seeder duplicated its rows instead of skipping them. Migration `129` deduplicates defensively and adds the constraint, which makes the `ON CONFLICT` clauses in every seeder actually work.
- **Demo-account seeding re-ran on every boot.** `ensureDemoAccountsSeeded()` matched on `lower(u.email)`, but `users.email` is encrypted at rest — the comparison ran against ciphertext and never matched, so the full demo seed re-executed on each start. Now matched on the deterministic `email_hash` lookup key; boot logs `demo.seed.present` and skips.
- **The public contact endpoint emailed `undefined` credentials.** Its tier-to-demo-account map had collapsed, so enquiries received a message containing literal `undefined` in place of a login. Replaced with industry resolution, a legacy tier mapping, and a guaranteed fallback.

- **`evidence_collection_rules` accepted only `splunk`/`connector`**: migration `088`'s `source_type` CHECK constraint never matched the app's own `ALLOWED_SOURCE_TYPES` allowlist (`microsoft_sentinel`, `aws_cloudtrail`, `crowdstrike`, `jira`, `servicenow`, `github`) <!-- ip-hygiene:ignore --> — creating a rule with any of those source types threw a raw Postgres constraint violation. Fixed in migration `125`.
- **Auto-Evidence rule creation form silently discarded its configuration**: `RuleForm`'s submit handler always sent `source_config: {}` regardless of source type, so no rule created through the UI (Splunk included) was ever actually functional. Fixed generically using the already-fetched `/auto-evidence/sources` `configFields` metadata.

### Security

- **GitHub and Splunk connector tokens were stored in plaintext**: both `githubService.js` and the pre-existing `splunkService.js` set `organization_settings.is_encrypted = true` on save but never actually called `encrypt()`/`decrypt()` from `utils/encrypt.js` — the stored value was plain text despite the flag. Both now encrypt at rest (AES-256-GCM); `decrypt()` transparently falls back to legacy plaintext rows, so no migration is required.
- **Rate limits on the control and implementation routes crosswalk propagation made expensive**: `PUT /controls/:id/implementation` and `PATCH /implementations/:id/status` (60/min — one status change now fans out into a mapping query plus a read-modify-write per credited control, or a withdrawal walk over everything the control was holding up), `POST /controls/:id/inherit` (20/min — several queries per mapped control, and a control can carry dozens of mappings), and `GET /controls/:id` (120/min). Neither route file had any rate limiting before.
- **Rate limits on seven previously unlimited evidence routes**: `GET /evidence/:id/download` and `GET /evidence/:id/integrity-check` (30/min each — the download path is the bulk-exfiltration route for files that may carry PII, and integrity-check re-hashes the stored file on every call), `DELETE /evidence/:id` (30/min, destructive and irreversible), `PUT /evidence/:id`, `POST /evidence/:id/link`, `DELETE /evidence/:evidenceId/unlink/:controlId` (60/min each), and `GET /evidence/:id` (120/min).

---

---

## Version 4.7.1 — July 22, 2026


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
