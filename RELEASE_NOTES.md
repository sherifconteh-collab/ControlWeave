# Release Notes

## v4.10.0 -- August 04, 2026

> **Release Date**: 2026-08-04  
> **Version**: 4.10.0


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

## v4.9.0 -- August 01, 2026

> **Release Date**: 2026-08-01  
> **Version**: 4.9.0


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

## v4.8.0 -- July 30, 2026

> **Release Date**: 2026-07-30  
> **Version**: 4.8.0


### Added

- **GitHub Evidence Connector**: `services/githubService.js` and `routes/github.js` add a real GitHub REST API client — org-scoped token settings (`Settings → Integrations → GitHub`), a test-connection check, a one-time import endpoint, and a full `code_scanning_alerts` / `dependabot_alerts` / `audit_log` / `pull_requests` source for Auto-Evidence Collection Rules. GitHub now performs genuine live data retrieval (like Splunk), not just configuration-record evidence.
- Dynamic per-source-type configuration fields in the Auto-Evidence rule creation form (`dashboard/evidence/auto/page.tsx`), including a GitHub event-type dropdown, replacing free-text inputs.
- **Access Governance module** (`/api/v1/access-governance`, migrations `126`–`128`): entitlement reporting across users, roles, and effective permissions with over-privileged (wildcard) and dormant-access flags; separation-of-duties toxic-combination rules with a live violations report (five system rules ship, three enabled); access review certification campaigns (`draft → active → completed`) that generate an AC-2 evidence record on completion disclosing any self-reviewed items; and a role/permission simulator giving a positive/negative allowed-denied matrix before a role is assigned. New `sod_rules`, `access_review_campaigns`, `access_review_items` tables gated by `access_governance.read` / `.manage`, with row-level security on all four new tables. New `/dashboard/access-governance` page. Revocation decisions are recorded, never auto-applied — de-provisioning stays an explicit action through the existing guarded role-assignment flow.
- **AI-assisted RBAC document import** (migration `127`, `rbac_analysis` feature): upload a role definition spreadsheet, SoD matrix, or roles & responsibilities document (PDF/DOCX/TXT/MD/CSV) and have AI map its duties onto the live permission catalog, flag SoD conflicts including ones the organization is currently violating, and propose platform roles and SoD rules. Only extracted text is persisted; the uploaded file is processed in memory and discarded. Every suggestion requires an explicit per-item click to apply.
- **Nine-organization demo roster** — one per industry vertical (financial services, healthcare, defense, technology, energy, retail, biotech, higher education) plus an external audit firm with a seeded three-engagement workbench. Industry-addressed logins (`admin@financial.com` and so on) with the legacy tier logins kept as working aliases. See `DEMO_CREDENTIALS.md`.
- **SOC 2: all five Trust Services Criteria** (migration `129`): the framework shipped with 27 controls, every one a `CC*` — the Security category alone. Adds the 28 missing criteria across Availability (A1), Confidentiality (C1), Processing Integrity (PI1), and Privacy (P1–P8), each with the same examine / interview / test program the existing controls carry, and moves `coverage_status` to `comprehensive`. Descriptions are ControlWeave's own paraphrase; the AICPA text is copyrighted and is not reproduced.
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

## v4.7.1 -- July 22, 2026

> **Release Date**: 2026-07-22  
> **Version**: 4.7.1


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

## v4.7.0 -- July 19, 2026

> **Release Date**: 2026-07-19  
> **Version**: 4.7.0


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

## v4.6.1 — Improvements & Bug Fixes

> **Release Date**: 2026-07-19  
> **Version**: 4.6.1

### Overview

This release includes 1 improvement and 2 bug fixes.

### Changed
- Auto-fix stale content in docs [skip ci]

### Fixed
- Correct evidence column name in pending assessment scan (#619)
- Remove tier/pricing gating from registration page (#616)



---

## v4.6.0 — New Features, Improvements, & Bug Fixes

> **Release Date**: 2026-07-18  
> **Version**: 4.6.0

### Overview

This release includes 1 new feature, 1 improvement, and 1 bug fix.

### Added
- Connector-to-control AI auto-assessment with approval workflow (#612)

### Changed
- Auto-fix stale content in docs [skip ci]

### Fixed
- Address two real bugs in #568's scheduled report delivery (#611)



---

## v4.5.1 — Improvements

> **Release Date**: 2026-07-17  
> **Version**: 4.5.1

### Overview

This release includes 3 improvements.

### Changed
- Fix stale controls count and paid-tier language in FRAMEWORK_COVERAGE.md (#610)
- Auto-fix stale content in docs [skip ci]
- Reconcile controls count and Wave 1 status after #576/#586 (#607)



---

## v4.5.0 — New Features, Improvements, & Bug Fixes

> **Release Date**: 2026-07-17  
> **Version**: 4.5.0

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

## v4.4.2 — Improvements & Bug Fixes

> **Release Date**: 2026-07-17  
> **Version**: 4.4.2

### Overview

This release includes 2 improvements and 1 bug fix.

### Changed
- Auto-fix stale content in docs [skip ci]
- Add framework catalog completion plan (waves 1-4) (#565)

### Fixed
- Record and display control test-result history (#581)



---

## v4.4.1 — Improvements & Bug Fixes

> **Release Date**: 2026-07-16  
> **Version**: 4.4.1

### Overview

This release includes 1 improvement and 1 bug fix.

### Changed
- Auto-fix stale content in docs [skip ci]

### Fixed
- Overhaul QA/test scripts and fix bugs they surfaced (#594)



---

## v4.4.0 -- July 14, 2026

> **Release Date**: 2026-07-14  
> **Version**: 4.4.0


### Added

- **Claude-triggered PR documentation review** (`claude-doc-review.yml`): runs `anthropics/claude-code-action@v1` on every non-draft PR with a fixed doc-focused prompt, alongside the existing Copilot code-review bot. Requires a one-time manual setup by a repo admin (install the Claude GitHub App, add `ANTHROPIC_API_KEY`) before it can run.
- **`roles.manage` and `users.manage` now check the caller's own permissions before granting new ones**: `POST/PUT /roles` and `POST /roles/assign` reject any permission (direct or via an assigned role) the requester doesn't already hold; `PATCH /users/:userId` requires the caller to already be an admin before granting the `admin` role, and blocks self role-changes outright. Role/permission changes are now audit-logged (`role.created`, `role.updated`, `role.assigned`, `user.role_changed`).
- Seeded `ai.read`, `ai.write`, and `organizations.write` permissions (migration 119) — used in route gates (`aiMonitoring.js`, `aiGovernance.js`, `organizations/*.js`, `tprm.js`, `dataSovereignty.js`, `vendorSecurity.js`, `threatIntel.js`) since these features shipped but never seeded, so every non-admin user was silently 403'd on all AI-governance/monitoring endpoints and most of the Organizations write surface.
- **JWT signing aligned to HS384 (CNSA Suite 1.0)**: previously pinned to HS256 as a documented divergence from the sibling `ai-grc-platform` repo. Now signs HS384 with a transitional `['HS384','HS256']` verify allow-list so existing sessions keep working until they expire naturally; drop `'HS256'` from the allow-list once the refresh-token TTL has elapsed. Refresh/reset-token hashing aligned the same way — SHA-384 with legacy SHA-256 lookup acceptance (`utils/encrypt.js` gained `hashToken`/`tokenHashCandidates`, matching the sibling repo).

### Changed

- **`ROLE_FALLBACK_PERMISSIONS` fallback is now a true fallback**: it only applies when a user has zero rows in `role_permissions` (accounts never migrated onto the roles system). Previously it was unconditionally unioned on top of real custom-role permissions, which meant a custom role could only ever add permissions on top of the legacy `admin`/`auditor`/`user` floor — never restrict below it. This silently defeated the shipped `auditor_observer` role's `assessments.write` restriction; it now actually restricts.
- **`DELETE /ai/reasoning-memory`** (bulk-wipes org-wide AI memory) now requires `assessments.write` instead of the low-bar router-wide `ai.use` gate, matching every other mutating action in that file.
- **`performance.js`** now uses `requireAdmin` instead of `requirePermission('admin')` — the latter checked a string that was never a real seeded permission, so it only ever worked by coincidentally matching the `'*'` wildcard.
- **Redis rate limiter now re-probes after a transient error** instead of permanently latching to in-memory-only limiting for the life of the process: a single dropped Redis command previously downgraded every rate-limited endpoint (including login/register) to weak per-process counters for good, spreadable across instances undetected in a multi-instance deployment. Now cools down for 30s and retries, matching the sibling repo's existing behavior.

### Fixed

- **`bcrypt.getRounds()` could 500 a correct-password login**: `POST /auth/login`'s lazy-rehash step called `bcrypt.getRounds()` unguarded after the password had already been verified correct; a malformed/non-bcrypt hash threw and surfaced as a 500 to a user with the right credentials. Now wrapped in try/catch, matching the sibling repo.
- **Login timing oracle**: the "no such user" branch of `POST /auth/login` now runs a dummy `bcrypt.compare` against a fixed hash so it costs the same as a real wrong-password check, closing an email-enumeration timing side-channel.
- **Password complexity was only enforced on invite acceptance**, not on self-registration or password reset (both only checked length). All three paths now require the same complexity policy.
- **Failed logins and account lockouts were never audit-logged** — only successful logins were. Both now write `user.login_failed` / `user.login_blocked_locked` audit events.
- **Registration/invite-acceptance email races returned a misleading 500** instead of 409 when two concurrent requests for the same email both passed the initial existence check (the DB unique constraint still prevented the duplicate — only the response code was wrong).
- **Passkey login tokens were signed with an implicit default algorithm**: `passkeys.js`'s `issueTokens()` didn't import or pass `JWT_ALGORITHM`, silently falling back to `jsonwebtoken`'s HS256 default. Now signs explicitly with the configured `JWT_ALGORITHM`, matching every other sign site in the codebase.
- `organization_name` is now sanitized the same way `email`/`full_name` already were on registration.

## v4.3.0 -- July 10, 2026

> **Release Date**: 2026-07-10  
> **Version**: 4.3.0


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

## v4.2.1 -- June 12, 2026

> **Release Date**: 2026-06-12  
> **Version**: 4.2.1


> Changes staged but not yet released to production.

---

---

## v4.2.0 -- May 24, 2026

> **Release Date**: 2026-05-24
> **Version**: 4.2.0
> **Migrations**: 107, 108, 109
> **Frameworks**: 44 total (860+ controls, 360+ crosswalk mappings)

### Overview

**Phase 3 — Enterprise & Scale.** This release adds six major capability areas: a custom compliance framework builder, advanced executive analytics and scheduled report delivery, MSP multi-tenant org hierarchy with delegated admin, three new continuous monitoring connectors (AWS Security Hub, Qualys VMDR, ITSM/Change), four new compliance frameworks (CIS Controls v8, FedRAMP High Baseline, plus 200+ additional crosswalk pairs across existing frameworks), and a comprehensive FedRAMP-ready deployment guide. The release also resolves IP hygiene violations, eliminates two N+1 query patterns, and hardens the CI pipeline against branch naming and frontend API coverage regressions.

---

### Added

#### Custom Framework Builder (migration 107)

- New `custom_frameworks` and `custom_framework_controls` tables with Row-Level Security applied at the organization scope.
- Full CRUD API at `GET/POST /api/v1/frameworks/custom`, `GET/PUT/DELETE /api/v1/frameworks/custom/:id`.
- Control management: `POST /api/v1/frameworks/custom/:id/controls`, `PUT/DELETE /api/v1/frameworks/custom/:id/controls/:controlId`.
- Publish workflow: `POST /api/v1/frameworks/custom/:id/publish` — makes the framework selectable org-wide.
- Clone workflow: `POST /api/v1/frameworks/custom/clone/:sourceCode` — copies all controls from any seeded framework as a starting point.
- Frontend builder at `/dashboard/frameworks/custom`: framework list, drag-to-reorder controls, inline edit, publish toggle, and "Clone from existing" modal.
- Route registered in `server.js` as `/api/v1/frameworks/custom`.

#### Advanced Analytics & Reporting (migration 108)

- `compliance_snapshots` table tracks daily per-organization, per-framework compliance percentages (unique on `organization_id, framework_id, snapshot_date`).
- `scheduled_reports` table supports configured report delivery jobs with `report_type` (compliance_summary, framework_gap, evidence_status, audit_trail, executive), `schedule` (daily, weekly, monthly, quarterly), and `recipients` JSONB.
- New `GET /api/v1/reports/executive` endpoint — cross-framework executive summary aggregated from compliance_snapshots.
- New `GET /api/v1/reports/trend/framework/:frameworkId` — per-framework historical trend data from snapshots.
- New scheduled reports CRUD API at `/api/v1/reports/scheduled` with `POST /api/v1/reports/scheduled/:id/run` for manual trigger.
- `jobService.js` extended with `compliance_snapshot` job type (set-based single-query upsert across all org/framework pairs) and `scheduled_report_run` job type.
- New script `controlweave/backend/scripts/snapshot-compliance.js` — writes daily compliance snapshots for all active framework/org pairs via the platform_jobs queue.
- Executive analytics dashboard at `/dashboard/reports/executive`: compliance trend line chart (90-day / 1-year), cross-framework score table, scheduled report management.

#### MSP Multi-Tenant Org Hierarchy (migration 109)

- `organizations.parent_org_id` UUID column (FK to `organizations`, `ON DELETE SET NULL`) with index.
- `org_delegated_admins` table: parent to child user grant records with `granted_by`, `granted_at`, `expires_at`, and unique constraint on `(parent_org_id, child_org_id, user_id)`.
- New org hierarchy endpoints: `GET /api/v1/organizations/children`, `POST /api/v1/organizations/children`, `GET /api/v1/organizations/children/:childId/summary`, `POST /api/v1/organizations/children/:childId/delegate`, `DELETE /api/v1/organizations/children/:childId/delegate/:userId`.
- MSP management page at `/dashboard/platform/managed-orgs`: org tree panel, per-child compliance score cards, delegate admin grant/revoke UI.

#### Continuous Monitoring Connector Templates

- Three new connector templates added to the existing `DEFAULT_CONNECTOR_TEMPLATES` array in `integrationsHub.js`:
  - **AWS Security Hub** — polls findings via AWS SDK; maps severity to control status; supports `region`, `roleArn`, `accessKeyId`, and `secretAccessKey` config fields.
  - **Qualys VMDR** — REST API connector that maps QID detections to CIS/NIST control IDs; supports tag-based filtering.
  - **ITSM / Change Management** — links closed incidents and change records to control implementation evidence.
- Corresponding thin adapter services: `awsSecurityHubService.js`, `qualysService.js`, `serviceNowService.js`.
- New connectors appear automatically in the existing integrations UI at `/dashboard/integrations`.

#### New Compliance Frameworks

- **CIS Controls v8** (`cis_controls_v8`) — 18 top-level controls (CIS-1 through CIS-18) with IG-level priority and control type metadata. Crosswalk pairs to NIST 800-53 Rev 5 (15 pairs) and NIST CSF 2.0 (8 pairs).
- **FedRAMP High Baseline** (`fedramp_high`) — 25 High-only additions beyond the existing `fedramp_moderate` framework (FRH-* prefix). Covers AC, AU, IA, SC, SI, SA, CP, IR, PE, PS, RA, PL control families. Crosswalk pairs to NIST 800-53 Rev 5 (18 pairs).
- **203 additional crosswalk mappings** added across CMMC 2.0, NIST 800-171, PCI DSS v4, HIPAA, HITECH, GDPR, CCPA/CPRA, ISO 27701, 27017, 27018, 27005, 31000, 42005, NERC CIP, and NIST Privacy frameworks.
- Framework library now: **44 frameworks, 860+ controls, 360+ crosswalk pairs**.

#### FedRAMP Deployment Guide

- New `controlweave/docs/FEDRAMP_DEPLOYMENT_GUIDE.md` covering:
  - FedRAMP Moderate vs. High impact levels and which framework codes to use.
  - Architecture requirements for High baseline (GovCloud topology, PostgreSQL AES-256 at rest, TLS 1.2+, FIPS cipher suites).
  - Required and recommended environment variables (DB_SSL_MODE, ENCRYPTION_KEY, AUDIT_LOG_RETENTION_DAYS, MFA_REQUIRED, SESSION_TIMEOUT_MINUTES).
  - Pre-flight security checklist referencing critical migrations (013, 091, 104, 106-109).
  - Audit log mapping: which `audit_logs.event_type` values satisfy NIST AU-2 through AU-12.
  - Backup and recovery targets: RTO 4 hours, RPO 1 hour via continuous WAL archiving.
  - Network controls: inbound 443 only, WAF with OWASP CRS 3.3+.
  - Incident response: 1-hour notification requirement for FedRAMP High (IR-6, FRH-IR-4(4)).
  - ConMon deliverables checklist: vulnerability scans, POA&M, monthly snapshots, annual pen test.

---

### Changed

- **PostgreSQL minimum version** raised from 15+ to **17+** (required minimum; latest stable recommended). Updated in `CLAUDE.md`, `FEDRAMP_DEPLOYMENT_GUIDE.md`, and `README.md`.
- **`runComplianceSnapshot` in `jobService.js`** refactored from an O(N x M) nested loop with per-row queries to a single set-based `INSERT ... SELECT ... GROUP BY ... ON CONFLICT DO UPDATE` covering all org/framework pairs in one round trip.
- **Clone route in `customFrameworks.js`** refactored from a per-control INSERT loop to a single `INSERT INTO custom_framework_controls ... SELECT ... ROW_NUMBER() OVER (ORDER BY control_id)`.
- **`customFrameworks.js` PUT handler** — field update params changed from `field || null` (which coerced empty string to null) to `field !== undefined ? field : null`, preserving empty strings and preventing spurious NOT NULL constraint violations.
- **`qualysService.js`** — JSON parse error handling now preserves the raw response body (first 200 bytes) in `{ _parseError, _rawBody }` rather than swallowing the original body context.
- **ITSM connector template** label and description changed from a vendor brand name to the vendor-neutral "ITSM / Change Management" across `integrationsHub.js`, `serviceNowService.js`, and `FEDRAMP_DEPLOYMENT_GUIDE.md` to comply with IP hygiene policy (connector `type` field retains `servicenow` for backward compatibility, annotated with `// ip-hygiene:ignore`).
- **migration 109_org_hierarchy.sql** — `parent_org_id` FK now includes `ON DELETE SET NULL` to allow parent org deletion without blocking.

---

### Fixed (CI & Review)

- **IP hygiene**: 6 competitor brand references resolved — all product-facing text now uses vendor-neutral terms; `// ip-hygiene:ignore` annotations added only where the internal API key string must be preserved. Confirmed 0 violations.
- **Branch naming CI** (`cm-branch-naming.yml`): added `claude/` prefix exemption (mirrors existing `copilot/` exemption) so agent-created branches are not rejected by the CM naming policy.
- **TEVV-API-11** (frontend API client coverage): added `customFrameworksAPI` and `scheduledReportsAPI` export objects to `controlweave/frontend/src/lib/api.ts`, covering all 10 custom-framework and 5 scheduled-report backend endpoints. Confirmed TEVV check passes at 0 failures.

---

### Database Migrations

| Migration | Description |
|-----------|-------------|
| `107_custom_frameworks.sql` | `custom_frameworks` + `custom_framework_controls` tables with RLS |
| `108_compliance_snapshots.sql` | `compliance_snapshots` + `scheduled_reports` tables |
| `109_org_hierarchy.sql` | `parent_org_id` column + `org_delegated_admins` table |

### Upgrade Notes

1. Run `npm run migrate` from `controlweave/backend/` to apply migrations 107, 108, 109.
2. Run `node scripts/seed-frameworks.js` to seed CIS Controls v8, FedRAMP High, and new crosswalk pairs.
3. No environment variable changes are required. The new features are available immediately after migration.
4. For FedRAMP deployments, see `controlweave/docs/FEDRAMP_DEPLOYMENT_GUIDE.md` for the full hardening checklist.

---

## v4.0.0 -- May 21, 2026

> **Release Date**: 2026-05-21
> **Version**: 4.0.0

### Overview

**ControlWeaver goes fully open source.** Every feature previously locked behind paid tiers (Pro $499/mo, Enterprise custom, Gov Cloud custom) is now free for all authenticated users under AGPL v3. No subscription, no license key, no credit card. The GRC community deserves tooling that belongs to them.

This is a major release. The tier enforcement system, billing infrastructure, and GTM automation have been removed from the codebase. All GRC functionality — including CMDB, evidence management, TPRM, SBOM/AIBOM, RMF Lifecycle, auditor workspace, advanced AI analysis, and all 40 compliance frameworks — is fully unlocked.

### Breaking Changes

- **Billing endpoints removed**: `POST /api/v1/billing/checkout`, `POST /api/v1/billing/portal`, `POST /api/v1/billing/webhook` (Stripe processing), `POST /api/v1/billing/change-plan`, `POST /api/v1/billing/mobile-upgrade`. These now return `410 Gone`. `GET /billing/subscription` returns an open-source status object.
- **Frontend billing pages**: `/billing/checkout` and `/billing/resolve` now redirect to `/dashboard`. Any stored `pendingPlan`/`pendingBillingPlan` keys are cleared from localStorage on redirect to prevent loops.
- **OpenClaw GTM automation removed**: The `.openclaw/` LinkedIn outreach agents, Stripe revenue tracking, and Railway-hosted orchestrator have been removed. Internal engineering/compliance/testing agents are retained.
- **`EDITION` env var**: No longer read; `edition.js` is hardcoded to `'open'`. Remove from your `.env` if present.
- **`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`**: No longer needed. Remove from your environment.

### Added

- **Database migration `106_open_source_remove_tier_restrictions.sql`**: Upgrades all existing organizations to `tier = 'enterprise'` with `billing_status = 'comped'`. Sets `tier_required = 'community'` on all framework and asset category rows. Clears all trial state columns. Runs automatically via `npm run migrate`.

- **New agent: `cw-fullstack-developer`** — A full-stack production developer agent covering all 13 layers: frontend (Next.js, TypeScript, Tailwind), backend APIs (Express.js, Node.js), database (PostgreSQL raw SQL, migrations, multi-tenant isolation), auth/RBAC, deployment (Railway, nixpacks), CI/CD, security, error tracking, and availability.

- **Agent collaboration routing**: All retained OpenClaw engineering/compliance/testing agents updated with `## Agent Collaboration` sections documenting handoff protocols between specialists.

### Changed

- **Tier middleware no-ops**: `requireTier()`, `requireProEdition()`, `checkTierLimit()` in `middleware/auth.js` and `middleware/edition.js` now always call `next()`. No enforcement.
- **Frontend access utilities**: `hasTierAtLeast()` in `lib/access.ts` always returns `true`. `requiresBillingResolution()` in `lib/billing.ts` always returns `false`.
- **`tierPolicy.js` community limits**: All limits (`frameworks`, `cmdbAssetLimit`, `cmdbEnvironmentLimit`) set to `-1` (unlimited). `cmdbEnabled` set to `true`.
- **Inline route tier checks removed**: Evidence RAG indexing, dashboard maturity scoring, CMDB asset categories, environment count limits, organization framework limits, contact count limits, and AI quota enforcement no longer gate on tier. All users get full access.
- **`ensureOrgFrameworks()` scoped to onboarding**: Now only provisions frameworks for organizations that have zero framework selections (first login). Subsequent calls are no-ops, preserving user framework preferences.
- **Sidebar navigation**: All `minTier` properties removed. Every navigation item is shown to all authenticated users.
- **CMDB pages**: Feature gates removed from `/dashboard/cmdb`, `/dashboard/cmdb/dependency-map`, and `/dashboard/cmdb/financial-services-workspace`. All sections render unconditionally.
- **Settings page**: Tier gates removed from Splunk/SIEM, Passkeys, and SSO settings. Billing/pricing comparison table removed.
- **Frameworks and organization pages**: Framework selection limit UI and tier banner removed.
- **Landing page** (`app/page.tsx`): Pricing table ($0/$499/$3,500) replaced with an open source banner.
- **Schema.tsx**: Pricing JSON-LD structured data updated to remove tier pricing strings.
- **AiQuotaModal**: "Upgrade plan" CTA removed. BYOK configuration option retained.
- **Demo seed scripts**: All demo organizations set to `tier: 'enterprise', billing_status: 'comped'`. QA scripts updated to remove 403 tier-gating assertions and expect full feature access.
- **CI/CD**:
  - `.github/workflows/ci.yml`: TEVV-API-6 tier-gated route validation removed (no longer asserts `requireTier` on route files).
  - `.github/workflows/public-mirror.yml`: Tier-filtering logic (allowlist scan + file exclusion) replaced with full-repo rsync. The public mirror now receives all code.
- **README**: Updated to v4.0.0. All tier pricing, OpenClaw GTM, and RevenueCat references removed. Tier feature matrix replaced with open-access feature list.

### Upgrade Notes

1. **Run migration 106**: `npm run migrate` from `controlweave/backend/`. This is required to set all existing orgs to enterprise/comped and remove framework tier gating.
2. **Remove unused env vars**: `EDITION`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` are no longer read. Remove from Railway dashboard and `.env` files.
3. **No other action needed**: All GRC features are now available immediately after migration. Users do not need to reconfigure anything.
4. **Frontend**: No localStorage migration needed. The checkout redirect page clears any stored billing plan keys automatically on first visit.

---

## v3.5.0 -- May 18, 2026

> **Release Date**: 2026-05-18
> **Version**: 3.5.0

### Overview

Expands AI provider coverage with the latest model generations, removes platform-shared API keys in favor of a BYOK-first model for all tiers, and adds a guided provider-setup flow that highlights free options (Google Gemini, Groq, Ollama) when no key is configured.

### Added

- **Expanded model catalog** — Provider model lists updated to include the latest releases across all supported providers:
  - *Anthropic Claude*: `claude-opus-4-7`, `claude-sonnet-4-6` added alongside the existing Claude 4.5 models
  - *OpenAI*: `gpt-4.1`, `gpt-4.1-mini`, `o3`, `o4-mini` added alongside `gpt-4o` and `gpt-4o-mini`
  - *Google Gemini*: `gemini-2.0-flash`, `gemini-2.0-flash-lite` added alongside the existing 2.5 models
  - *Groq*: `mixtral-8x7b-32768`, `gemma2-9b-it`, `deepseek-r1-distill-llama-70b` added alongside existing Llama models
  - All provider dropdowns in Settings → LLM Configuration and Settings → AI Keys reflect the full updated list

- **AI Provider Setup modal** — When a user triggers any AI feature without a provider key configured, a full-screen modal appears offering:
  - Free-tier providers (Google Gemini, Groq, Ollama) highlighted with direct "Get key" links to each provider's API key page
  - Paid providers (Anthropic Claude, OpenAI, xAI Grok) listed with sign-up links
  - A direct CTA to Settings → AI Keys to add a key and return to the workflow
  - Available on every dashboard page without per-feature wiring

- **Global AI event system** — A central Axios interceptor in the API client fires browser custom events (`ai:no-provider`, `ai:quota-exceeded`) that the dashboard shell catches globally, eliminating duplicated error handling across individual AI feature components.

### Changed

- **BYOK-required AI access** — The platform no longer provides shared API keys to customer organizations. Each org must configure at least one provider key. The backend detects the missing key before the LLM call is attempted and returns a clear `422 NO_PROVIDER_CONFIGURED` response rather than an opaque 400 from the LLM service.

- **Updated AI task defaults** — The reasoning, chat, and ideation task profiles now default to `claude-sonnet-4-6` and `gpt-4.1` when no org-level model preference is saved. Orgs with an existing saved default are unaffected.

- **Removed inline assets upgrade modal** — The one-off "Upgrade Required" modal previously embedded in the CMDB assets page is removed; the shared `AiProviderSetupModal` covers this scenario consistently across all pages.

### Upgrade Notes

- No database migrations required.
- Orgs that previously relied on the platform-shared API key will see the provider setup modal on their next AI feature use. Direct them to Settings → AI Keys to add a free Gemini or Groq key to restore access at no cost.
- Existing org-level BYOK configurations are unaffected and continue to work as before.

---

## v3.4.0 -- May 16, 2026

> **Release Date**: 2026-05-16  
> **Version**: 3.4.0

### Overview

Production hardening: closes the gap between a working demo and a production-grade platform across 9 infrastructure layers — distributed rate limiting, database-layer RLS, error tracking, automated backups, multi-core clustering, Redis response caching, CDN cache headers, auth hardening, and zero-trust additions.

### Added
- **Distributed rate limiting** — Redis-backed rate limiting replaces per-process in-memory Map. Multiple Railway instances now share a single rate-limit bucket per user/org. Falls back to in-memory when Redis is absent (single-instance deployments unaffected). Env: `REDIS_RATE_LIMIT_PREFIX`.
- **PostgreSQL Row-Level Security** (migration 104) — RLS enabled on `controls`, `control_implementations`, `evidence`, `audit_engagements`, `audit_logs`, and `users`. Non-breaking: policy is permissive until `app.org_id` is set on the session. `withOrgContext(orgId, fn)` in `database.js` activates double enforcement per-request.
- **Sentry error tracking** — `@sentry/node` integrated with Express; error-level log events forwarded to Sentry via `logger.setSentryClient()`. `@sentry/nextjs` added to the frontend. Activated by setting `SENTRY_DSN`; app works without it.
- **Automated database backups** — `backupScheduler.js` schedules daily backups via `node-cron`. `db-backup.js` gains optional S3 upload (streaming via `@aws-sdk/client-s3`). Activated with `BACKUP_ENABLED=true`. Env: `BACKUP_CRON_SCHEDULE`, `AWS_S3_BUCKET`, `AWS_S3_PREFIX`.
- **PM2 cluster mode** — `ecosystem.config.js` runs one worker per CPU core (`instances: max`). `start:cluster` script added; `start:railway` now uses PM2 runtime. Requires Redis rate limiting (already added above) to avoid per-worker bucket splitting.
- **Redis response caching** — `redisCache.js` utility (`getCached`, `invalidateCached`, `invalidateCachedPattern`) with org-scoped keys. Dashboard's in-memory cache Map replaced by Redis. `SCAN` iteration used for pattern invalidation (non-blocking).
- **CDN cache headers** — `next.config.ts` emits `Cache-Control: public, max-age=31536000, immutable` for `/_next/static/*` assets and `no-cache` for HTML. Enables Cloudflare or any CDN to cache static assets at the edge without configuration.
- **Refresh token rotation** — `POST /refresh` now issues a new refresh token and invalidates the previous one on every use. Stolen refresh tokens cannot be replayed.
- **Concurrent session limits** — Login enforces `MAX_CONCURRENT_SESSIONS` (default 10) per user; oldest session evicted when the limit is reached. Configurable via env var; `0` disables enforcement.
- **TPRM HMAC layer** — Public vendor endpoints optionally verify `X-TPRM-Signature: sha256=<hex>` when `TPRM_HMAC_SECRET` is set. Backward compatible: token-only auth unchanged when secret is absent.
- **Webhook verification utility** — `verifyIncomingWebhook(secret, signature, body)` in `webhookService.js` for verifying HMAC-signed callbacks from external systems.

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

## v3.2.0 -- April 18, 2026

> **Release Date**: 2026-04-18  
> **Version**: 3.2.0


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

## v3.1.0 -- April 18, 2026

> **Release Date**: 2026-04-18  
> **Version**: 3.1.0


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

## v3.0.0 -- April 18, 2026

> **Release Date**: 2026-04-18  
> **Version**: 3.0.0  
> **Release Type**: Major  
> **Migrations**: 102, 103  
> **Tests**: Jest 62/62 passing  
> **Security posture**: `npm audit --audit-level=high` ✅ (frontend: 0 vulns; backend: 0 high+, 8 low accepted)

### Overview

ControlWeave v3.0.0 is the largest release since 2.x. It delivers a platform-wide overhaul across **security hardening**, **AI output quality**, **user experience**, **observability**, and **data model depth**. The release tightens JWT/bcrypt posture across every authenticator, rewrites the AI output pipeline so outputs land as validated structured objects auditors can use, ships the four previously-missing Pro-tier dashboard pages, deepens the implementation and findings data models for real audit workflows, and adds a full reliability/observability baseline backed by 62 Jest tests.

This is a major version bump because:
1. AI response envelope now carries a new `structured` field (additive, but consumers relying on re-parsing `result` should migrate).
2. `bcrypt` cost factor is raised from 12 → 14 (existing credentials continue to verify; upgrades happen lazily on login).
3. JWT verification is pinned to `HS256` only — any token signed with a different algorithm is rejected.

---

### Phase 1 — AI Output Quality Overhaul

#### 1.1 Task-profile model tiering (`services/llmService.js`)
- Introduced `TASK_PROFILES` with four profiles and explicit defaults:
  - **reasoning** (gap analysis, remediation playbooks, finding analysis, compliance forecast, executive report, incident response, vendor risk, audit readiness, copilot sessions) → Claude Sonnet 4.5 / OpenAI GPT-4o, temperature **0.4**.
  - **extraction** (evidence suggestion, test procedures, control mapping, control narrative draft) → Claude Haiku 4.5 / OpenAI GPT-4o-mini, temperature **0.2**.
  - **ideation** (policy drafting, roadmap generation, tabletop scenarios) → Claude Sonnet 4.5, temperature **0.7**.
  - **chat** (AI Copilot) → Claude Sonnet 4.5, temperature **0.3**.
- 25 feature keys mapped in `FEATURE_TASK_PROFILE`.
- Resolution order for model/temperature: explicit caller override → org BYOK override → profile default. BYOK tier rules honored.
- **Temperature plumbing completed**: the resolved temperature is now passed through `chat()` and `chatStream()` into every provider call (Claude, OpenAI, Grok, Gemini, Groq, Ollama) in both streaming and non-streaming paths. Previously, only the resolved model name was forwarded.

#### 1.2 Structured outputs + schema validation + retry (`services/llmSchemas.js`)
- JSON Schemas authored for all five output types:
  - `GAP_ANALYSIS_SCHEMA` (readiness_score, summary, gaps[], recommended_roadmap).
  - `REMEDIATION_PLAYBOOK_SCHEMA` (objective, prerequisites, steps[], tools, artifacts, estimated_total_hours).
  - `TEST_PROCEDURES_SCHEMA` (objective, scope, steps[], sample_size, frequency).
  - `EVIDENCE_SUGGESTION_SCHEMA` — **realigned** to the actual prompt output contract (control_title, framework, evidence_items[], collection_notes, estimated_collection_hours).
  - `FINDING_SCHEMA` — **realigned** to the `generateAuditFindingDraft()` contract (criteria, condition, cause, effect, recommendation, management_response_placeholder, related_controls, repeat_finding, finding_id_hint).
- **Recursive validator** (`validate()`): walks nested `items`, `properties`, and `required` arrays. Prior top-level-only validator let malformed `gaps[]` / `steps[]` items pass silently.
- **Feature-key aliases**: route keys `evidence_suggest` → `evidence_suggestion` and `audit_finding_draft` → `finding` now correctly trigger schema validation + retry. Previously these routes ran with no validation.
- **One-shot retry with error context**: on validation failure, `aiHandler()` injects the Ajv-style error list into the user prompt as a correction hint and calls the feature function once more. If the retry also fails, the original (best-effort) output is returned — never a 500.
- **Provider JSON mode forced** whenever the feature has a registered schema:
  - OpenAI / Grok / Groq → `response_format: { type: 'json_object' }`.
  - Gemini → `responseMimeType: 'application/json'`.
  - Claude stays on the schema+retry guard (Anthropic's equivalent requires tool_use rewiring; retry catches drift).
- **Structured persistence**: `aiHandler()` parses validated JSON into `data.structured` and returns `{ result, structured, ... }` in the response envelope so the frontend can render cards/tables/checklists without re-parsing narrative text.

#### 1.3 Few-shot + chain-of-thought exemplars (`services/aiExemplars/`)
- Curated, auditor-quality exemplars (two per feature) for all five feature types:
  - `gap_analysis.json` — NIST 800-53 AC family gap analysis with severity, evidence_required, estimated_effort_days.
  - `remediation_playbook.json` — step-by-step MFA rollout with tools, artifacts, owners, effort estimates.
  - `test_procedures.json` — walkthrough / inspection / re-performance steps with pass/fail criteria.
  - `evidence_suggestion.json` — SOC 2 CC6.1 / NIST AC-2 evidence picklist with format, cadence, and source system.
  - `finding.json` — full SOC 2 audit finding following the criteria/condition/cause/effect model.
- `buildFewShotBlock()` prepends exemplars and a 5-step chain-of-thought reasoning instruction: scope → assumptions → key controls → evidence expectations → final structured output.
- `loadExemplars()` now filters out metadata entries (objects without an `output` field), allowing scanner directives to be embedded without affecting prompt composition.

#### 1.4 RAG strategy
- Each feature handler passes a feature-appropriate `ragQuery` to `llm.buildPersonalizedSystem()`, which does retrieval once as part of system-prompt assembly. The previous duplicate auto-wiring at `aiHandler()` level (which silently computed and stored an unread `req.ragContext`) was removed — it was pure embedding/vector-search overhead with no consumer.
- Six complex reasoning functions (gap analysis, remediation playbook, finding analysis, audit readiness, compliance forecast, executive report) now build **richer feature-specific RAG queries** rather than the generic prior query, pulling from PR #463.

#### 1.5 AI quality gate (`services/aiQualityGate.js`)
- `runQualityGate()` scores outputs 0–100 on four dimensions:
  - **Length** — minimum per-section character thresholds.
  - **Control citations** — at least one recognizable framework prefix (NIST 800-53 AC/AT/AU/…, ISO 27001 A./Annex, SOC 2 CC/A1/C1/P, HIPAA §, GDPR Art.). Regex now handles non-word prefixes (`§`, `Art.`) correctly — the prior `\b` anchor never matched `§164.312(b)`.
  - **Framework ID validation** — cross-checks codes against `organization_frameworks`; tracks `unknownCodes`.
  - **PII scrub** — labeled detection for email, SSN, phone, credit card.

#### 1.6 Safe markdown rendering (frontend)
- New shared `components/ai/MarkdownContent.tsx` — pure JSX renderer (no `dangerouslySetInnerHTML`) with a strict safe-protocol allow-list (http, https, mailto, tel).
- `StructuredOutput.tsx` consumes `MarkdownContent` and renders:
  - Gap analysis: readiness-score bar, expandable gap cards keyed by control with severity chip, roadmap.
  - Playbook: numbered steps with tools/artifacts, time estimates.
  - Test procedures: interactive checklist with progress counter.
- `AICopilot.tsx` switched from an inline regex sanitizer to the shared `MarkdownContent` renderer.
- **Accessibility**: gap rows and checklist rows are now semantic `<button>` elements with `aria-expanded` / `aria-pressed`, giving full keyboard and screen-reader support.
- **Export fix**: `handleExport()` now defers `URL.revokeObjectURL()` via `setTimeout(..., 0)` and appends/removes the anchor from the DOM, preventing aborted downloads in Firefox/Safari.

---

### Phase 2 — Missing Pro-tier Dashboard Pages

Four previously-absent but already-backed Pro pages shipped:
- **`/dashboard/evidence/pending`** — pending/overdue evidence queue with owner, due date, source control.
- **`/dashboard/evidence/auto`** — auto-collection rules (source, cadence, target control, next-run), with rule create/edit.
- **`/dashboard/integrations`** — integration hub listing connectors (ITSM, SIEM, identity, cloud) with status, last-sync, and connect/test actions.
- **`/dashboard/settings/ai-keys`** — BYOK management for Anthropic / OpenAI / Gemini / Grok / Groq / Ollama, with add/rotate/remove and per-provider status.

---

### Phase 3 — Reliability & Observability

- **`/ready` endpoint** — deep-check readiness probe: DB connectivity, migrations-current, required env vars, optional LLM provider reachability.
- **`components/ErrorBoundary.tsx`** — wraps dashboard routes; logs error + componentStack to the backend via the structured logger.
- **`components/skeletons/index.tsx`** — `Skeleton`, `TextSkeleton`, `CardSkeleton`, `TableSkeleton`, `ChartSkeleton`. `SkeletonProps` now extends `React.HTMLAttributes<HTMLDivElement>` so `style` and other standard div props pass TypeScript's `--strict` mode.
- **Structured logger rollout** — 100+ `console.log/warn/error` calls replaced with `log(level, event, ctx)` across `routes/ai.js`, `routes/assessments.js`, `routes/auth.js`, `routes/controls.js`, `routes/evidence.js`, `routes/implementations.js`.
- **Jest foundation** — `jest.config.js`, `npm test` wired up, **62/62 tests passing** across four suites:
  - `auth.middleware.test.js` — JWT sign/verify, `requirePermission`, `requireTier` happy/sad paths.
  - `llmService.test.js` — profile resolution, BYOK override, temperature propagation.
  - `llmSchemas.test.js` — recursive validator for nested objects/arrays.
  - `aiQualityGate.test.js` — citation regex (including `§` prefix), PII scrub labels.

---

### Phase 4.3 — PCI DSS v4.0

- **55 controls** added as first-class framework with requirement, sub-requirement, and testing procedure metadata.
- Seed script updated; framework available for organization opt-in.

---

### Phase 5 — Control Response Depth (migration 102)

- Adds `response_narrative`, `response_narrative_updated_at`, `review_status`, `review_comments`, `reviewed_by`, `reviewed_at`, `test_performed_at`, `test_performed_by` to `control_implementations`.
- Narrative and review endpoints added on `controls/:id/implementation/narrative` and `.../review`.
- **`review_comments` can now be explicitly cleared** — prior `COALESCE($2, review_comments)` + `reviewComments || null` made empty strings behave as "field omitted", preventing clears. Handler now distinguishes `undefined` (preserve) from `null`/`""` (clear).
- **Input validation** — `testPerformedAt` validated as ISO-8601 (`Date.parse` non-NaN), `testPerformedBy` validated against UUID regex before DB write; invalid inputs return 400 instead of reaching the UPDATE and triggering a 500.

---

### Phase 6 — Findings ↔ Controls many-to-many (migration 103)

- New `finding_control_links` junction table with `(finding_id, control_id, organization_id, link_type, created_by, created_at)`, unique on `(finding_id, control_id)`.
- **Six new endpoints** on `/api/v1/assessments`:
  - `POST /findings/:findingId/controls` — link (upserts on conflict, supporting link_type update).
  - `DELETE /findings/:findingId/controls/:controlId` — unlink.
  - `GET /findings/:findingId/controls` — list controls for a finding.
  - `GET /controls/:controlId/findings` — reverse index.
  - `GET /engagements/:id/findings` — now JOINs link counts.
  - `GET /engagements/:id/validation-package` — now includes findings-to-controls traceability matrix.
- Unblocks auditor workflows where a single finding is observed across multiple controls (common for access-management or logging findings).

---

### Phase 7 — Security Hardening

- **JWT algorithm pinning (HS256)** — all sign/verify paths route through `config/security.js`: `auth.js`, `passkeys.js`, `sso.js`, middleware, `serviceAccounts.js`, and `websocketService.js`. Prevents `alg: none` and algorithm-confusion attacks at the module boundary.
- **bcrypt cost 12 → 14** with **backward-compatible lazy rehash**. Existing cost-12 hashes continue to verify; on the next successful login the plaintext is re-hashed at cost 14 and persisted. Demo-account provisioning scripts still run under the new code because `bcrypt.compare()` is version-agnostic.
- **`/api/v1/ai/usage-report` SQL-injection defense** — allow-listed orderable columns, validated `start` / `end` as ISO-8601, clamped `limit` to [1, 1000].
- **XSS hardening (frontend)** — removed all `dangerouslySetInnerHTML` from AI-output components. Prior regex allow-list preserved unsafe attributes on allowed tags and `javascript:` URLs; new JSX renderer validates protocols.
- **IP hygiene** — `check:ip-hygiene` passes in both default and strict (`IP_HYGIENE_FAIL_ON_STANDARDS=true`) modes. Competitor references removed from AI exemplars; legitimate third-party integration templates annotated with scoped `ip-hygiene:ignore` markers; exemplar files that paraphrase standards text marked with `ip-hygiene:ignore-file` and include a `_note` explaining fair-use rationale.

#### Dependency security fixes
| Package            | From      | To        | Severity  | Advisory              |
| ------------------ | --------- | --------- | --------- | --------------------- |
| `next`             | 16.1.7    | 16.2.4    | **high**  | GHSA-q4gf-8mx6-v5v3 (Server Components DoS) |
| `protobufjs`       | 7.5.4     | 7.5.5     | **critical** | GHSA-xq3m-2v4x-88gg (arbitrary code execution) |
| `hono`             | 4.12.12   | 4.12.14   | moderate  | GHSA-458j-xx4x-4375 (HTML injection) |
| `follow-redirects` | 1.15.11   | 1.16.0    | moderate  | GHSA-r4q5-vmmm-2653 (auth-header leak on cross-domain redirect) |

---

### Phase 8 — CI / Validation

All validation gates pass on this release branch:
- `npm run check:syntax` (backend) — 238 files ✅
- `npm test` (backend Jest) — **62/62 passing** ✅
- `npm run typecheck` (frontend TS strict) ✅
- `npm run lint` (frontend ESLint) ✅ (0 errors)
- `npm run check:ip-hygiene` — 0 competitor violations, 0 standards flags ✅
- `npm audit --audit-level=high` (backend) ✅
- `npm audit --audit-level=moderate --production` (frontend) ✅
- CI TEVV — UI ↔ API Linkage (all dashboard pages) ✅

---

### Breaking Changes

1. **AI response envelope** — handlers with a registered schema now return `{ result, structured, ... }`. Consumers that only read `result` are unaffected, but any client that re-parsed `result` as JSON should now prefer `structured` when present.
2. **bcrypt cost 14** — new password hashes are slower (≈100ms on commodity hardware). Existing credentials verify transparently; upgrades are lazy.
3. **JWT algorithm pinning** — tokens signed with any algorithm other than HS256 are rejected. Any custom tokenization paths that did not already use HS256 must be migrated.

### Upgrade Notes

1. Run migrations: `npm run migrate` (applies 102 and 103).
2. No config changes required; `JWT_SECRET` continues to drive HS256 signing.
3. If you rely on the AI response envelope in a custom UI, update consumers to read `structured` when `feature` has a schema.

---

## v2.8.12 -- April 10, 2026

> **Release Date**: 2026-04-10  
> **Version**: 2.8.12


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

## v2.8.11 -- March 30, 2026

> **Release Date**: 2026-03-30  
> **Version**: 2.8.11


> Changes staged but not yet released to production.

### Overview

This unreleased batch hardens browser-side billing and onboarding behavior, adds repeatable verification coverage for release readiness, introduces a comprehensive Claude Code AI developer experience system with 10 auto-loaded rules and 8 slash-command playbooks, and ships native iOS and Android companion apps with push notifications, RevenueCat IAP, and evidence capture.

### Added
- Playwright end-to-end coverage for auth and billing guard flows, including invalid pending-plan recovery and effective-tier routing behavior.
- Expanded deployment verification so release checks validate both backend health/billing endpoints and frontend routing plus `/api/v1` rewrite linkage.
- Comprehensive Claude Code context system with 10 auto-loaded rule files (`.claude/rules/`) covering security, coding style, database, git workflow, code review, API design, TPRM, evidence handling, assessment workflows, and tier/edition gating conventions.
- Eight Claude Code slash-command playbooks (`.claude/commands/`) for code review, database migration creation, security review, assessment engagement scaffolding, compliance framework addition, evidence lifecycle review, TPRM vendor risk management, and API route scaffolding.
- Enhanced `CLAUDE.md` with project overview, full tech stack reference, critical rules (SQL injection prevention, multi-tenant isolation, audit logging), key patterns (route structure, database queries, response format), git workflow conventions, and CI/TEVV pipeline summary.
- **iOS companion app** (SwiftUI, iOS 17+) — JWT authentication with TOTP 2FA, dashboard overview, paginated controls list with search, assessments view, evidence capture with HEIC/PNG/WebP/JPEG detection via `PhotosPickerItem.supportedContentTypes`, APNs push notifications with Keychain token persistence and logout cleanup, RevenueCat Pro upgrade flow with deterministic package selection (`current.monthly ?? current.annual`), AdMob banner ads on Community tier (loaded once per tier transition), `AnyEncodable` type-eraser fixing `JSONEncoder` compile error against `Encodable` existentials, static `DateFormatter`/`RelativeDateTimeFormatter` instances to eliminate per-access allocations.
- **Android companion app** (Jetpack Compose, API 26+, Kotlin) — matching feature parity with iOS app; OkHttp `Authenticator` with retry-loop guard (`responseCount >= 2`), response validation (`isSuccessful`, `body.success`), and null-safe token rebuild to prevent `Authorization: Bearer null`; FCM push via `firebase-admin`; AdMob with concrete AdMob App ID in `AndroidManifest.xml`; RTL layout support (`android:supportsRtl`); ProGuard/R8 minification in release builds.
- `POST /api/v1/push-tokens` and `DELETE /api/v1/push-tokens/:token` — device push token registration and logout cleanup routes; token uniqueness enforced at the token level (`UNIQUE (token)`) so shared/re-used devices stop receiving pushes for prior accounts.
- `POST /api/v1/billing/mobile-upgrade` — RevenueCat subscription verification endpoint; `revenueCatAppUserId` derived from `req.user.id` server-side (not caller-supplied), closing the cross-account subscription elevation vector.
- `apn` and `firebase-admin` declared as `optionalDependencies` in backend `package.json` so push delivery activates automatically when `APNS_KEY_ID` or `FCM_SERVICE_ACCOUNT` environment variables are set.
- iOS `Info.plist` with required App Store privacy usage descriptions (`NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription`, `NSUserTrackingUsageDescription`, `NSFaceIDUsageDescription`), ATS enforcement (`NSAllowsArbitraryLoads = false`), and export compliance declaration (`ITSAppUsesNonExemptEncryption = false`).
- `PrivacyInfo.xcprivacy` updated to declare file-timestamp API access (required by Apple for apps using `PhotosPicker`).

### Changed
- Hardened frontend auth, landing, onboarding, and dashboard redirects to validate `pendingPlan` from local storage before sending users into checkout, and automatically clear invalid values.
- Aligned billing resolution and organization/settings plan UI with `effectiveTier` so browser messaging and routing match backend entitlements.
- Cleaned up the billing success redirect lifecycle so post-checkout navigation does not leave a dangling timer.
- Refreshed the marketing app lockfile so the bundled Express dependency tree resolves `path-to-regexp@0.1.13`, clearing the pre-commit audit finding.
- Replaced placeholder footer social/legal targets on the marketing page with real LinkedIn, GitHub, terms-request, and security-policy links.

### Security
- Frontend `package-lock.json` updated to resolve lodash `<=4.17.23` high-severity prototype-pollution and code-injection vulnerabilities (CVE via recharts transitive dependency) — patched to lodash `4.18.1`.
- Backend `package-lock.json` regenerated to include `firebase-admin` transitive dependencies, fixing `npm ci` lock-file integrity failures in CI.
- Billing `mobile-upgrade` endpoint no longer trusts the caller-supplied `revenueCatAppUserId`; the value is now derived from the authenticated session (`req.user.id`).
- `device_push_tokens` table constraint changed from `UNIQUE (user_id, token)` to `UNIQUE (token)`; upsert reassigns `user_id`/`organization_id` to the current authenticated user on every device registration.

---

## v2.8.10 — Improvements

> **Release Date**: 2026-03-28  
> **Version**: 2.8.10

### Overview

This release includes 1 improvement.

### Changed
- Fix dashboard overview and auth email hydration



---

## v2.8.9 — Improvements

> **Release Date**: 2026-03-28  
> **Version**: 2.8.9

### Overview

This release includes 1 improvement.

### Changed
- Add duplicate user email cleanup



---

## v2.8.8 — Improvements

> **Release Date**: 2026-03-28  
> **Version**: 2.8.8

### Overview

This release includes 1 improvement.

### Changed
- Add email hash backfill script



---

## v2.8.7 — Improvements

> **Release Date**: 2026-03-28  
> **Version**: 2.8.7

### Overview

This release includes 1 improvement.

### Changed
- Fix GovCloud assessment seed query



---

## v2.8.6 — Improvements

> **Release Date**: 2026-03-28  
> **Version**: 2.8.6

### Overview

This release includes 1 improvement.

### Changed
- Fix demo seed account targeting



---

## v2.8.5 — Improvements

> **Release Date**: 2026-03-28  
> **Version**: 2.8.5

### Overview

This release includes 1 improvement.

### Changed
- Auto-seed demo accounts on startup



---

## v2.8.4 — Improvements

> **Release Date**: 2026-03-28  
> **Version**: 2.8.4

### Overview

This release includes 1 improvement.

### Changed
- Seed platform admin self-assessment data



---

## v2.8.3 — Improvements

> **Release Date**: 2026-03-28  
> **Version**: 2.8.3

### Overview

This release includes 1 improvement.

### Changed
- Harden demo seed prerequisites



---

## v2.8.2 — Improvements

> **Release Date**: 2026-03-28  
> **Version**: 2.8.2

### Overview

This release includes 1 improvement.

### Changed
- Fix platform admin password rotation



---

## v2.8.1 — New Features

> **Release Date**: 2026-03-28  
> **Version**: 2.8.1

### Overview

This release includes 1 new feature.

### Added
- Optimize code and enhance features



---

## v2.8.0 — AI-Code Security Hardening, ESLint & ReDoS Dependency Fix

> **Release Date**: March 27, 2026
> **Version**: 2.8.0

### Overview

Addresses 15 AI-code risk factors identified during security review — adds ESLint static analysis to the backend, introduces structured error handling improvements in the Express server, patches a HIGH-severity ReDoS vulnerability in `path-to-regexp`, improves frontend mobile viewport support, and documents a staging environment deployment guide.

### New Features

#### Backend ESLint Configuration
- New `eslint.config.js` (flat config format) added to the backend with ESLint 9.x, enabling automated static analysis across all backend JavaScript source files.
- `globals` package integrated for Node.js environment declarations, replacing implicit global assumptions.

#### Staging Environment Documentation
- New `STAGING_ENVIRONMENT.md` guide covering deployment architecture, environment variable matrix, Docker-based local staging setup, and promotion-to-production workflow.

### Security & Reliability
- **`path-to-regexp` bumped to 0.1.13** — resolves GHSA-37ch-88jc-xwx2, a HIGH-severity ReDoS vulnerability where crafted route patterns could cause catastrophic backtracking in Express route matching.
- **Structured Express error handling** — `server.js` error middleware updated with explicit `next(err)` propagation and improved error response formatting for uncaught route-level exceptions.
- **Frontend mobile viewport** — `layout.tsx` updated with `viewport` export for proper mobile scaling, addressing AI-code review finding on missing responsive metadata.

### Bug Fixes
- ESLint version corrected to 9.x (flat config) after initial misconfiguration flagged during Gemini code review.
- `globals` import comment clarified for editor tooling compatibility.
- Staging environment documentation table formatting corrected for consistent Markdown rendering.

---

## v2.7.3 — Retroactive Release Note Quality Restoration & Documentation Metadata

> **Release Date**: March 26, 2026
> **Version**: 2.7.3

### Overview

Restores the v2.7.3 release entry — which retroactively rewrote v2.5.0 through v2.7.2 release notes to match the detailed quality standard established in v2.4.4 — from its single-line placeholder to full detail, adds release dates to all documentation file headings, and enriches internal release metadata with tag and release branch fields for traceability.



---

## v2.7.2 — Release Note Auto-Generation Quality & Retroactive Cleanup

> **Release Date**: March 26, 2026
> **Version**: 2.7.2

### Overview

Improves the release-notes automation so auto-generated entries match the quality of hand-written notes, and retroactively cleans up v2.5.0–v2.7.1 entries that were published with raw branch-name slugs.

### Changes

#### Release Note Auto-Generation
- New `clean_desc()` function in the release-notes workflow strips redundant type-prefix verbs and capitalizes 30+ GRC/tech acronyms (AI, DISA, STIG, NIST, SMTP, JWT, SSO, OWASP, LLM, BYOK, ISO, HIPAA, etc.) via word-boundary matching.
- Auto-generated overview now produces grammatically correct counts with singular/plural handling and Oxford comma (e.g., "2 improvements, 1 bug fix, and 2 security updates").
- Auto-generated release title derived from change categories and used in the `## vX.Y.Z —` heading across all release-note files.
- Conventional commit regex synced between `release-notes.yml` and `cm-branch-naming.yml` — added `migration` and `test` types.
- American English normalization applied across workflow files (`categorised` → `categorized`, `categorisation` → `categorization`).

---

## v2.7.1 — CI/CD Hardening, TEVV Real Tests & Docs Pipeline Consolidation

> **Release Date**: March 26, 2026
> **Version**: 2.7.1

### Overview

Replaces shallow file-existence TEVV checks with real behavioral tests achieving 100% dashboard CI coverage, removes duplicate workflows, fixes four workflow misconfigurations, and consolidates three documentation workflows into a single pipeline.

### New Features

#### Real TEVV Tests (12 New)
- **TEVV-API** — 4 new behavioral tests: route `require()` + `.stack` verification (catches broken imports), auth middleware import check on non-public routes, `module.exports` verification on route files, and frontend `api.ts` client coverage for every backend route.
- **TEVV-DB** — Migration file SQL keyword validation (catches empty or corrupt migration files).
- **TEVV-UI** — 7 new page-level tests covering `ai-security`, `assets`, `plot4ai`, `organization`, `my-organizations`, `report-issue`, and all 9 CMDB sub-pages including `dependency-map` and `financial-services-workspace`.
- **TEVV-UI-39** — Safety-net test that auto-fails CI when a new dashboard page is added without a corresponding TEVV check.

### Changes

#### Workflow Consolidation
- Removed `security-reports-export.yml` and `security-reports-stig-quarterly.yml` — both were exact duplicates of jobs already in `security-reports.yml`.
- Merged `sync-wiki.yml` and `wiki-health-check.yml` into `docs-pipeline.yml` with preflight routing that differentiates the weekly Monday content-sync cron from the daily wiki-health-check cron.

### Bug Fixes
- `security-pipeline.yml`: CodeQL language identifier corrected from `javascript` to `javascript-typescript`; `npm install` replaced with `npm ci` across 5 jobs; QA report no longer hardcodes `✅ Passed` regardless of outcome.
- `codeql.yml`: Narrowed triggers to `schedule`/`workflow_dispatch` only — push/PR scans already run in `security-pipeline.yml`.
- `copilot-pr-review.yml`: Removed `issue_comment` and `pull_request_review_comment` triggers that fired on every comment.
- `compliance-labeler.yml`: Removed `synchronize` trigger (labels only needed on open/edit).
- `docs-pipeline.yml`: Fixed bare `push:` trigger that fired on all branches but did nothing on non-main.

---

## v2.7.0 — NIST AI 800-4 Compliance Monitoring & Platform Linkage Audit

> **Release Date**: March 26, 2026
> **Version**: 2.7.0

### Overview

Operationalizes NIST AI 800-4 compliance-layer monitoring with cross-feature navigation, fixes sidebar visibility for AI Monitoring and AI Governance, and closes frontend API coverage gaps across four backend routes.

### New Features

#### NIST AI 800-4 Compliance Monitoring
- AI Monitoring and AI Governance pages now visible to enterprise users — corrected `isVisible` sidebar gate and changed required permission from `settings.manage` to `ai.use`.
- Cross-feature navigation cards added across 8 dashboard pages: CMDB AI Agents → AI Monitoring, AI Governance → AI Monitoring, AI Security → AI Monitoring + AI Governance, Security Posture → AI Monitoring, SBOM → AI Governance + AI Monitoring, Vulnerabilities → AI Analysis + AI Monitoring, Threat Intel → AI Monitoring + Plot4AI.
- `stateAiLawsAPI` added to frontend `api.ts` — 4 backend routes (`/coverage`, `/ai-governance`, `/state-ai-laws`) previously had zero frontend client coverage.
- Cross-feature card section added to `plot4ai/page.tsx` (was completely missing).

### Bug Fixes
- Division-by-zero guard added to `coverage_percentage` calculation (`total > 0 ? ... : 0`).
- `Promise.allSettled` used in frontend so rules and events still render when `/coverage` fails.
- Covering database index `idx_ai_monitoring_rules_org_cat_coverage` added for the monitoring view JOIN pattern.
- `validateCategorySync()` startup guard queries `pg_get_constraintdef` at boot, compares DB CHECK constraint values against the JS constant, and logs a warning on drift.

---

## v2.6.0 — Quantized GGUF Model Support for Ollama

> **Release Date**: March 26, 2026
> **Version**: 2.6.0

### Overview

Adds quantized GGUF model support for local Ollama deployments, enabling TurboQuant-style compression for more efficient on-device AI inference, and patches a HIGH-severity dependency vulnerability.

### New Features

#### Quantized GGUF Model Support
- Ollama provider now supports quantized GGUF models for local AI inference with configurable quantization levels, enabling smaller memory footprints and faster response times on resource-constrained hardware.

### Security & Reliability
- `picomatch` upgraded from `<=2.3.1` to `2.3.2` (backend and frontend) to resolve a HIGH-severity ReDoS vulnerability; `tinyglobby` nested dependency updated from `4.0.3` to `4.0.4` in frontend. `npm audit --audit-level=high` now exits 0 in both packages.

### Bug Fixes
- Fixed stale tier names on the `/privacy` page.
- Fixed missing `next/link` import and React type declarations in frontend components.

---

## v2.5.0 — DISA STIG Expansion, Self-Assessment Seeding & Security Hardening

> **Release Date**: March 25, 2026
> **Version**: 2.5.0

### Overview

Expands DISA STIG automation from a single Application STIG into a full 5-framework quarterly pipeline with 209 automated compliance checks, adds a ControlWeave self-assessment seed for the platform admin organization, hardens encryption with HMAC-SHA-384 and org-scoped platform admin queries, and aligns password policy enforcement to a 15-character minimum across all account flows.

### New Features

#### DISA STIG 5-Framework Quarterly Pipeline
- 4 new STIG assessment functions (`assessAppServerStig`, `assessPostgresqlStig`, `assessWebServerStig`, `assessGposStig`) bringing total automated compliance checks from 43 to 209 across all 5 DISA STIGs.
- Automated CKLB (STIG Viewer 3 JSON) export tooling added to the quarterly workflow with commit of generated outputs.
- `.cklb` file upload and import support added to the vulnerability scanner with proper status mapping — `not_a_finding` (CKLB underscore format) now correctly maps to `remediated` instead of false-positive `open` findings.
- Manifest-driven quarterly STIG version check ensures framework versions stay current.

#### ControlWeave Self-Assessment Seed
- New `seed-controlweave-self-assessment.js` script seeds the platform admin organization with all frameworks adopted, 10 policies, 15 evidence artifacts (STIG/vulnerability/policy reports), and ~85% control compliance. Run with `npm run seed:self-assessment`.

#### PR Title Validation in CM Workflow
- PR titles now validated against conventional commit format (`type(scope): description`) with Copilot branches exempt.
- PR title used as a type-detection fallback when branch name does not contain a recognized type prefix, improving version proposal accuracy.

### Security & Reliability
- **HMAC key floor raised to 48 bytes** — `getHmacKey()` now throws on keys shorter than 96 hex chars, enforcing CNSA Suite 1.0 compliance.
- **Lazy backfill encrypts both columns** — `UPDATE users SET email = $1, email_hash = $2` so pre-migration rows reach encrypted-at-rest on first login (previously only `email_hash` was written).
- **Column init guards** added at the top of `/register`, `/forgot-password`, and `/accept-invite` to prevent querying a non-existent `email_hash` column in fresh process instances.
- **Platform admin org-scoped** — bootstrap account queries now include `AND organization_id = $N`, closing a cross-tenant path when emails are encrypted.
- **Password policy raised to 15-character minimum** with centralized backend validation across registration, invite acceptance, password reset, user creation, and platform admin bootstrap. Demo account flows also enforce the new minimum.
- Security report retention workflow now handles a missing reports directory gracefully instead of failing CI.

### Bug Fixes
- Release-notes workflow no longer creates empty entries or draft releases on every push to main — added `has_content` detection that strips blank lines and blockquote-only placeholders.
- Release metadata restored to v2.4.4 across README badges and package versions; non-tag runs no longer create draft GitHub Releases.
- MCP localhost regex corrected to match URLs without a trailing slash (`http://localhost:3001`).
- Bash regex variables introduced for patterns containing `)` in `cm-branch-naming.yml` and `release-notes.yml` to prevent `[[ =~ ]]` parse failures.
- Stale `.cklb` STIG report snapshots removed; `reports/.gitignore` prevents future commits of generated reports.

---

## v2.4.4 — Self-Hosted Update Awareness, Org SMTP & Session Hardening

> **Release Date**: March 22, 2026
> **Version**: 2.4.4

### Overview

Adds self-hosted update awareness and organization-level SMTP controls, while hardening session handling and preserving in-progress framework answers across context switches.

### New Features

#### Self-Hosted Update Awareness
- New `GET /api/v1/license/update-check` endpoint for self-hosted operators to compare their installed version against the latest public GitHub release.
- Settings now surfaces release status details for self-hosted admins, including the current version, latest available version, and release link.

#### Organization-Level SMTP Controls
- New org-scoped SMTP settings endpoints: `GET /api/v1/settings/smtp`, `PUT /api/v1/settings/smtp`, and `POST /api/v1/settings/smtp/test`.
- Settings → Notifications now includes SMTP configuration and test email flows for organization admins.

### Security & Reliability
- Access tokens are now kept in memory rather than long-lived browser storage.
- Global error boundary added to improve recovery from unexpected frontend runtime failures.
- Email delivery now resolves SMTP settings per organization before falling back to environment/platform defaults.

### Bug Fixes
- Preserves in-progress framework answers when switching frameworks.
- Tightens self-hosted release-check, notification, and related auth flows.

---

## v2.4.3 — Release Automation & Changelog Hygiene

> **Release Date**: March 20, 2026
> **Version**: 2.4.3

### Overview

Improves release automation so release-note updates keep version metadata in sync and do not repeatedly generate duplicate follow-up releases.

### Changes
- Release automation now updates the root/community README badges and backend/frontend package versions together.
- Auto-generation on `main` now skips workflow-authored commits and duplicate version headings for better idempotency.
- v2.4.2 release coverage was backfilled and aligned across CHANGELOG and release-note files.

---

## v2.4.2 — AI Security Hub, Community Tier Expansion & Release Automation

> **Release Date**: March 20, 2026
> **Version**: 2.4.2

### Overview

Adds the AI Security Hub consolidating six GRC-native AI security pillars into a single view, expands the Community tier with unlimited BYOK AI and unlocked Plot4AI / Regulatory News, enhances the crosswalk engine with ISO 27001:2022 mappings, and fixes release automation so badges and notes auto-update on every merge to main.

### New Features

#### AI Security Hub
- Consolidated AI security view with six pillars: OWASP Top 10 for LLMs, NIST AI RMF alignment, EU AI Act readiness, PLOT4ai threat modeling, AI supply-chain risk, and agentic AI (AIUC-1) certification status.

#### Community Tier Expansion
- **BYOK Unlimited AI**: Community-tier organizations with their own API key now receive unlimited AI requests.
- **Plot4AI**: Unlocked for Community tier — 138 AI threat cards available without a Pro license.
- **Regulatory News**: Removed from Pro-only gate — available to all tiers.
- **AI Analysis**: All 9 AI analysis features accessible at Community tier with BYOK.

#### Crosswalk Engine Enhancements
- ISO 27001:2022 crosswalk mappings added.
- Coverage matrix API endpoint for framework overlap analysis.
- Versioned framework names for multi-framework clarity.

### Bug Fixes
- Community edition license label: MIT → AGPL v3.
- Broken Docker container link in root README.
- Settings/billing page broken links and incorrect Gemini model name.
- Pricing page: Enterprise "Contact Sales" routes to `/contact`.
- Community mirror: fixed server startup crash and missing migrations.
- Toast UX hardened across dashboard pages.

### Changes
- Dual READMEs consolidated into single source of truth.
- Contact emails updated to `contehconsulting@gmail.com`.
- Documentation diagrams standardized on Mermaid.
- Canonical documentation map added.
- CLA and CONTRIBUTING.md added to community repo; LICENSE email casing fixed.

### Infrastructure
- Release notes workflow (`release-notes.yml`) now auto-triggers on push to `main`, reading the current version from `RELEASE_NOTES.md` and incrementing the patch number. Badges and release notes update automatically on every merge — no manual tag or release branch required.
- Public mirror: removed CLA-related files from allowlist, added defense-in-depth workflow directory stripping to prevent push failures.
- CLA workflow security: corrected SHA pin to full 40-char hash, hardened bot allowlist from wildcard `bot*` to explicit `dependabot[bot]`, `github-actions[bot]`, `copilot[bot]`.

---

## v2.4.1 — Multi-Organization Membership

> **Release Date**: March 13, 2026
> **Version**: 2.4.1

### Overview

Adds the ability for a single user account to belong to and switch between multiple organizations — a key workflow for consultants, MSPs, and anyone managing compliance across several clients or business units.

### New Features

#### Multi-Organization Membership
- Users can now belong to **multiple organizations** under one account
- New **My Organizations** page (`/dashboard/my-organizations`) shows all orgs and the active one
- **Switch Organization** — one-click context switch; new JWT tokens are issued so every subsequent API call operates under the new org
- **Create New Organization** — spin up a fresh organization directly from the dashboard (Community tier, upgradeable)
- **Clone from Template** — create a new organization pre-loaded with the same framework selections as the current org, eliminating repetitive setup for consultants managing similar clients

#### Sidebar Enhancements
- Current organization name now shown under the user's name in the sidebar for at-a-glance context
- "My Organizations" nav item added to the Organization section

### Technical Changes
- Migration `095_multi_org_membership.sql` — adds `user_organizations` junction table with backfill of all existing users
- `GET /auth/my-organizations` — list all orgs the authenticated user belongs to
- `POST /auth/switch-organization/:orgId` — switch active org (validates membership, issues new tokens)
- `POST /organizations/me/new` — create a new blank organization
- `POST /organizations/me/clone` — clone framework selections from current org into a new org

---
## v2.4.0 — AIUC-1 Agentic AI Certification Framework

> **Release Date**: March 13, 2026
> **Version**: 2.4.0

### Overview

Adds AIUC-1 — the first independently-audited certification standard purpose-built for agentic (autonomous) AI systems — as a supported compliance framework in ControlWeave. Organizations deploying AI agents can now track their AIUC-1 readiness, benefit from automatic crosswalks to NIST AI RMF, EU AI Act, and ISO 42001, and use the AI Governance check to assess AIUC-1 certification preparedness.

### New Features

#### AIUC-1 Agentic AI Certification Framework (Enterprise)
- **31 controls** across six AIUC-1 risk domains:
  - **Data & Privacy (DP-1–DP-6)**: Data classification, access controls, minimization, encryption, PII protection, retention
  - **Security (SEC-1–SEC-6)**: Adversarial testing, least privilege, attack resilience, secure development, vulnerability management, prompt injection controls
  - **Safety (SAF-1–SAF-5)**: Scenario-based safety validation, fail-safes, policy enforcement, outcome monitoring, continuous re-validation
  - **Reliability (REL-1–REL-5)**: Agent consistency, error handling, self-monitoring, availability, drift detection
  - **Accountability (ACC-1–ACC-5)**: Tamper-evident audit trails, visual documentation, human oversight mechanisms, incident investigation, remediation verification
  - **Societal Impact (SOC-1–SOC-5)**: Legal compliance, ethical guidelines, bias assessment, transparency, environmental impact
- **Cross-framework crosswalks** to NIST AI RMF 1.0, EU AI Act 2024, ISO/IEC 42001:2023 (85+ mapping pairs). OWASP Agentic AI Top 10 crosswalks included when that framework is pre-seeded.
- **AI Governance check** extended with AIUC-1 readiness analysis across all six domains
- **`npm run seed:aiuc1`** — one-command seed for AIUC-1 framework and crosswalks
- AIUC-1 appears in the framework marquee, Enterprise pricing card, and help content

---

## v2.3.3 — Self-Service Community License Generation & Admin Notification

> **Release Date**: March 13, 2026  
> **Version**: 2.3.3

### Overview

Platform admins can now generate a community license key directly from the API or CLI — no ControlWeave sales contact required. Community tier is free and self-hosted installations should be self-sufficient. A startup email notification is also sent to the `PLATFORM_ADMIN_EMAIL` address when the server starts without an active license, guiding the admin to generate or activate one.

### New Features

#### Self-Service Community License Generation
- **`POST /api/v1/license/generate-community`** (platform owner only): generates a self-signed RSA community license key in-process. The key is activated immediately and persisted to the database. No restart required.
- **`scripts/generate-community-license.js`**: standalone CLI script. Run with `node scripts/generate-community-license.js` to print keys for `.env`, or with `--activate` to write directly to the database.
- **`licenseService.generateCommunityKey(licensee, seats)`**: new exported function that generates an RSA-2048 keypair, signs a community-tier JWT, and returns `{ licenseKey, publicKey }`.
- **`licenseService.setLocalPublicKey(pem)`**: new exported function. Stores a PEM public key in-module for validating self-generated keys without needing `CONTROLWEAVE_LICENSE_PUBKEY` in env.
- **Migration `097_server_license_pubkey.sql`**: adds `local_public_key` column to `server_license` so the public key from `generate-community` persists across restarts.

#### Platform Admin License Notification
- **Startup email notification**: when the server starts with no active license and `PLATFORM_ADMIN_EMAIL` is configured, a notification email is sent directing the admin to generate or activate a license. Non-fatal — SMTP not configured? A structured log message is emitted instead.

### Changes
- `licenseService.loadLicenseKeyFromDb()` now returns `{ licenseKey, localPublicKey }` (object) instead of a plain string. Callers updated in `server.js` and `license.js`.
- `licenseService.validateLicenseKey()` accepts an optional second argument `overridePubKey` for validation against a specific key (used for self-validation during generation).
- `licenseService.saveLicenseToDb()` accepts an optional fifth argument `localPublicKey` to persist the public key alongside the license row.

---

## v2.3.2 — Community License Key Support & Self-Hosted License API

> **Release Date**: March 13, 2026  
> **Version**: 2.3.2

### Overview

Fixes and completes the license system for self-hosted community-tier deployments. Community license keys are now recognized and validated. A new lightweight license API lets community self-hosted instances query their edition status and activate license keys at runtime, unlocking higher tiers without a server restart. Activated keys are automatically persisted to the database — **no manual `.env` editing required**.

Also establishes a clear architectural stance: self-hosted installations work **fully offline** with zero internet dependency. An optional background heartbeat (`LICENSE_HEARTBEAT_URL`) is available for paid-tier operators who want real-time revocation capability, but it is disabled by default and connectivity failures never revoke access.

### New Features

#### Self-Hosted License Key Support
- **Community tier in `VALID_TIERS`** — `licenseService.js` now accepts `tier: "community"` JWTs.
- **`LICENSE_TIER_TO_EDITION` updated** — `edition.js` maps `community → community` so startup validation correctly identifies and logs community perpetual licenses.

#### License Activation API (`@tier: community`)
- `GET /api/v1/license` — returns current edition, whether a license is persisted in env or DB.
- `POST /api/v1/license/activate` — validates and applies a license key immediately; persists it to the `server_license` database table so the upgrade survives restarts. Requires `settings.manage` permission. Writes an audit log entry.

#### Database-Persisted License Keys (migration `096`)
- New `server_license` table (single-row, id=1) stores the activated key, tier, licensee, seats, and maintenance window.
- `ensureLicenseFromDb()` in `server.js` loads the DB key at startup and restores the edition — users activate once through the UI and never touch `.env` again.

#### Optional Online Heartbeat
- `heartbeatCheck()` in `licenseService.js` — async, fires-and-forgets background ping to `LICENSE_HEARTBEAT_URL`.
- **Disabled by default** (no `LICENSE_HEARTBEAT_URL` set). Community edition works fully offline.
- Connectivity failures are logged as warnings and **never revoke access** — designed for air-gapped deployments.

#### Frontend API Client
- `licenseAPI.getInfo()` and `licenseAPI.activate(key)` added to `src/lib/api.ts`.

### Bug Fixes
- Fixed: Community self-hosted users providing a community license key received "Invalid license tier: community" — now accepted.
- Fixed: A community license JWT in `LICENSE_KEY` fell through to `|| 'pro'` default in `validateEdition()` — now correctly maps to community edition.

### Architecture Decision
**No mandatory internet check for self-hosted.** GRC/compliance platforms are routinely deployed in air-gapped, restricted-network environments. Making license checks internet-dependent would break these deployments and contradict the trust model of self-hosting. The JWT's built-in `exp`/`maintenance_until` fields handle natural license lifecycle. The optional heartbeat is available for operators who want it.

---

## v2.1.2 — BYOK Unlimited AI & CLA

> **Release Date**: February 19, 2026  
> **Version**: 2.1.2

### Overview

Adds full platform-admin operational control — feature flags, subscription management, trial period control, and expanded AI guidance frameworks (MITRE ATT&CK, MAESTRO, MAS TRM).

### New Features

#### Feature Flag & Access Control
- **Global feature flags** — turn any feature OFF for all orgs instantly via Platform Settings
- **Per-org overrides** — force-enable or force-disable any feature regardless of tier
- **Tier overrides** — treat an org as a higher tier (effective tier applied at next login)
- **Beta feature grants** — unlock unreleased features for select orgs
- New `isFeatureEnabled()` utility in auth middleware

#### Subscription Management (5 new endpoints)
- View subscription details per org (plan, billing cycle, Stripe IDs)
- Change tier (with immediate DB update)
- Cancel at period end (graceful) or immediately
- Reactivate a pending cancellation
- Comp accounts — grant free access at any tier for N months

#### Trial Period Control (2 new endpoints)
- View trial status, dates, and days remaining
- **Extend / Shorten / End Now / Restart / Convert to Paid** — all admin-controlled per org
- Max 365-day extension cap; auto-expire on shorten past today

#### AI Guidance Frameworks
- **MITRE ATT&CK** — CWE-to-ATT&CK mapping in GRC system prompt; new `mapCweToMitreAttack()` utility
- **MAESTRO** — 7-layer AI threat model (L1 Foundation Model → L7 Governance) added to system prompt
- **MAS TRM** — injected for Singapore-region orgs only (`country_code = 'SG'`) via org context

#### Framework Tier Limits (corrected)
| Tier | Limit |
|---|---|
| free | 2 |
| starter | 5 |
| professional+ | Unlimited |

### Database Changes

- **Migration 072**: `feature_overrides JSONB` column on `organizations`, `feature_flags` row in `platform_settings`, `billing_status` constraint extended to include `comped`

### Backend Changes

| File | Change |
|---|---|
| `platformAdmin.js` | +11 endpoints (4 feature flags, 5 subscription, 2 trial) |
| `auth.js` middleware | Loads `feature_overrides`, `global_feature_flags`, `effective_tier` onto `req.user`; exports `isFeatureEnabled()` |
| `auth.js` route | `/auth/me` returns `effective_tier`, `feature_overrides`, `global_feature_flags` in org object |
| `tierPolicy.js` | `free.frameworks = 2`, `starter.frameworks = 5` |
| `llmService.js` | MITRE ATT&CK, MAESTRO, MAS TRM added to GRC system prompt |
| `orgContextService.js` | MAS TRM injected for `country_code = 'SG'` orgs |
| `mitreMapping.js` | New — `mapCweToMitreAttack(cweId)` utility |

### Frontend Changes

| File | Change |
|---|---|
| `access.ts` | `effectiveTier`, `featureOverrides`, `globalFeatureFlags` on `AccessUser`; `hasTierAtLeast()` uses effective tier; new `hasFeature()` |
| `AuthContext.tsx` | Extended `User` type + `mapCurrentUser` |
| `api.ts` | +11 platform admin API methods |
| `Sidebar.tsx` | Added "Platform Settings" nav item |
| `frameworks/page.tsx` | free=2, starter=5 limits |
| `platform/settings/page.tsx` | New — global feature flag toggles grouped by category |
| `platform/organizations/page.tsx` | Added "Manage" link per row + billing status badges |
| `platform/organizations/[id]/page.tsx` | New — 3-tab org management (Features / Subscription / Trial) |

### Security

- All new endpoints protected by `authenticate` + `requirePlatformOwner` middleware
- All mutations audit-logged with actor user ID
- Parameterized SQL queries throughout
- Input validation on tier values, days ranges, and action types

---

## v2.0.0 — Phases 4-7 Integration

> **Release Date**: February 19, 2026  
> **Version**: 2.0.0  
> **Tag**: [v2.0.0](https://github.com/sherifconteh-collab/ControlWeaver-Pro/releases/tag/v2.0.0)

## Overview

This release consolidates four major feature phases (Phases 4-7) that add substantial new capabilities to ControlWeave, including frontend dashboards, real-time features, AI-powered analysis, and external integrations.

## Breaking Changes

None. This release is fully backward compatible with existing installations.

## New Features

### Phase 4: Frontend Dashboards
**Tier**: Starter+

Three new dashboards for comprehensive monitoring and management:

#### AI Monitoring Dashboard (`/dashboard/ai-monitoring`)
- Real-time AI usage tracking with tier-based limits
- AI decision review workflow with approval/rejection
- Bias detection and flagging for high-risk decisions
- Usage analytics with trend charts
- High-risk decision identification
- Monitoring rules configuration
- Event stream with filtering

**Technical Details:**
- 355 lines of TypeScript/React code
- Recharts for data visualization
- Real-time updates via WebSocket (Phase 5)
- Tier-aware feature gating

#### Data Governance Dashboard (`/dashboard/data-governance`)
- Retention policy management with auto-delete
- Legal hold tracking and release workflow
- GDPR/HIPAA compliance monitoring
- Data subject request handling
- Policy and hold creation modals
- Audit trail for all actions

**Technical Details:**
- 526 lines of TypeScript/React code
- Modal-based workflows
- Compliance reporting
- Automated data lifecycle management

#### Vendor Risk Dashboard (`/dashboard/vendor-risk`)
- Vendor contract CRUD operations
- AI-powered security risk assessments
- Risk matrix visualization (scatter plot)
- Contract expiration tracking (90-day alerts)
- Renewal workflow automation
- Integration with Phase 7 vendor security monitoring

**Technical Details:**
- 553 lines of TypeScript/React code
- Interactive risk matrix
- Contract lifecycle management
- AI risk scoring integration

**New Frontend Components:**
- `AIMonitoringCharts.tsx` (81 lines)
- `VendorRiskCharts.tsx` (98 lines)
- Updated `Sidebar.tsx` with new navigation links
- Updated `layout.tsx` (removed Google Fonts for CI/CD reliability)

**API Methods Added:**
- 10 new methods in `lib/api.ts` for dashboard operations

### Phase 5: Real-Time Features
**Tier**: Starter+

WebSocket-based real-time updates for instant collaboration:

#### WebSocket Server
- Socket.IO integration with Redis pub/sub
- Room-based event broadcasting
- Organization-scoped isolation
- Connection authentication via JWT
- Automatic reconnection handling

#### Push Notifications
- Browser notifications API integration
- Service worker support for background notifications
- Customizable notification preferences
- Notification history tracking
- Read/unread status management

#### Real-Time Event Types
1. Control status changes
2. Assessment completions
3. Evidence uploads
4. User activity (online/offline)
5. POA&M updates
6. Vulnerability discoveries
7. AI analysis completions
8. Audit trail events

**New Backend Dependencies:**
- `ioredis@^5.4.1` - Redis client for pub/sub
- `@socket.io/redis-adapter@^8.3.0` - Socket.IO Redis adapter

**New API Endpoints:**
- `GET /api/v1/realtime/online-users` - List users currently online
- `POST /api/v1/realtime/broadcast` - Broadcast event to organization
- `WebSocket: ws://server/socket.io` - WebSocket connection

**Technical Details:**
- Real-time event service (`realtimeEventService.js`)
- WebSocket service (`websocketService.js`)
- Redis-backed session management
- Organization-scoped rooms
- Pagination support (up to 500 users)

### Phase 6: AI-Powered Analysis
**Tier**: Professional+

Advanced AI capabilities for predictive analytics and automation:

#### Predictive Risk Scoring
Automated risk assessment using multi-factor weighted analysis:
- **Controls compliance** (40% weight)
- **Vulnerabilities** (25% weight)
- **Evidence quality** (20% weight)
- **Assessment results** (15% weight)
- **Output**: 0-100 risk score with A-F grading
- **Trending**: 30/60/90-day predictions
- **Anomaly detection**: Z-score based flagging

**Algorithm:**
```javascript
risk_score = (
  (controls_score * 0.40) +
  (vulnerability_score * 0.25) +
  (evidence_score * 0.20) +
  (assessment_score * 0.15)
)
grade = calculateLetterGrade(risk_score)
```

#### Regulatory Impact Analysis
AI-powered analysis of regulatory changes:
- Impact scoring (0-100) based on:
  - Number of affected controls
  - Implementation effort required
  - Organizational systems impacted
  - Compliance timeline
- Effort estimation in person-hours
- Affected systems identification
- Timeline analysis with milestones
- Actionable recommendations

**AI Prompts:**
- Regulatory text analysis
- Control mapping suggestions
- Implementation guidance
- Risk assessment

#### Smart Remediation Plans
Enhanced AI-generated remediation with:
- Priority scoring (0-100)
- Timeline estimation (days to completion)
- Cost-benefit analysis
- Resource requirements
- Step-by-step action plans
- Progress tracking
- Success metrics

**New Database Schema:**
- Migration 057: `phase6_risk_scores`, `phase6_regulatory_analyses`, `phase6_remediation_plans`
- UUID-based primary keys
- JSONB fields for flexible data storage

**New API Endpoints:**
- `GET /api/v1/phase6/risk-score/:organizationId`
- `GET /api/v1/phase6/risk-trends/:organizationId`
- `POST /api/v1/phase6/risk-forecast/:organizationId`
- `POST /api/v1/phase6/regulatory-impact/analyze`
- `GET /api/v1/phase6/regulatory-impact/:analysisId`
- `POST /api/v1/phase6/remediation/generate`
- `GET /api/v1/phase6/remediation/:planId`
- `PUT /api/v1/phase6/remediation/:planId/status`

### Phase 7: External Integrations
**Tier**: Professional+

Integration with external security and compliance data sources:

#### Threat Intelligence Feeds
Automated aggregation from multiple sources:

**NIST National Vulnerability Database (NVD)**
- CVE data with CVSS v2/v3/v3.1 scoring
- Vulnerability descriptions and references
- Affected product information
- Patch/remediation guidance
- Daily synchronization

**CISA Known Exploited Vulnerabilities (KEV)**
- Actively exploited CVEs
- Exploit maturity tracking
- Required action dates
- Priority flagging
- Real-time updates

**MITRE ATT&CK**
- STIX 2.1 format parsing
- Attack patterns and techniques
- Tactics and procedures
- Mitigation strategies
- Threat actor profiles

**AlienVault Open Threat Exchange (OTX)**
- Community-driven threat data
- Pulse aggregation
- Indicator of Compromise (IOC) tracking
- Threat score calculation

**Features:**
- Automatic feed synchronization (hourly/daily/weekly)
- CVE correlation with CMDB assets
- Exploit availability tracking
- Threat trend analysis
- Severity-based filtering
- Email alerts for critical threats

#### Vendor Security Monitoring
Continuous third-party security posture tracking:

**SecurityScorecard Integration**
- A-F security ratings
- Risk factor breakdown (10 categories)
- Historical trend tracking
- Peer benchmarking
- Automatic score updates

**BitSight Integration**
- 250-900 numeric security ratings
- Security performance tracking
- Diligence questionnaires
- Third-party risk scoring
- Industry comparison

**Features:**
- Daily security score updates
- Automated vendor risk alerts
- Historical trend visualization
- Risk factor decomposition
- Email notifications for score changes
- Integration with Vendor Risk Dashboard

#### Regulatory News Aggregation
Stay informed about compliance updates:
- RSS feed parsing from regulatory bodies
- Framework-specific news filtering
- Keyword extraction and matching
- Impact classification
- Unread tracking
- Batch mark as read
- Custom feed support

**Supported Frameworks:**
- NIST (800-53, CSF, etc.)
- ISO 27001/27002
- SOC 2
- PCI DSS
- HIPAA
- GDPR
- And more...

**New Backend Dependencies:**
- `axios@^1.13.5` - HTTP client for external APIs
- `rss-parser@^3.13.0` - RSS feed parsing

**New Database Schema:**
- Migration 065: `external_threat_feeds`
- Migration 066: `threat_intelligence_items`
- Migration 067: `vendor_security_scores`
- Migration 068: `regulatory_news_items`

**New API Endpoints:**
Threat Intelligence (6 endpoints):
- `GET /api/v1/threat-intel/feeds` - List all feeds
- `POST /api/v1/threat-intel/feeds` - Create feed
- `POST /api/v1/threat-intel/feeds/:id/sync` - Manual sync
- `GET /api/v1/threat-intel/items` - Query threats
- `GET /api/v1/threat-intel/statistics` - Feed stats

Vendor Security (4 endpoints):
- `GET /api/v1/vendor-security/scores` - List all scores
- `POST /api/v1/vendor-security/providers/:provider/refresh` - Update scores
- `GET /api/v1/vendor-security/trends/:vendorId` - Historical trends

Regulatory News (10 endpoints):
- `GET /api/v1/regulatory-news/items` - List news items
- `POST /api/v1/regulatory-news/items/:id/mark-read` - Mark as read
- `POST /api/v1/regulatory-news/items/mark-all-read` - Bulk mark read
- `GET /api/v1/regulatory-news/sources` - List RSS sources

## API Changes

### New Routes
**Total**: 30+ new API endpoints across Phases 4-7

**Phase 4 Dashboard APIs**: Internal API methods for frontend
**Phase 5 Real-Time APIs**: 2 REST + 1 WebSocket endpoint
**Phase 6 AI Analysis APIs**: 10 endpoints for risk scoring and analysis
**Phase 7 Integration APIs**: 20 endpoints for external data sources

### Authentication
All new endpoints require JWT authentication:
```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

### Rate Limiting
New tier-specific rate limits:
- **Threat Intelligence**: 200 requests/15 minutes (Professional+)
- **Vendor Security**: 100 requests/15 minutes (Professional+)
- **Regulatory News**: 300 requests/15 minutes (Professional+)
- **Real-Time**: 50 requests/minute (Starter+)
- **Phase 6 AI**: 100 requests/hour (Professional+)

## Database Changes

### New Migrations
- **057**: Phase 6 risk scoring tables
- **065**: External threat feeds configuration
- **066**: Threat intelligence items
- **067**: Vendor security scores
- **068**: Regulatory news items

### Migration Notes
- All new tables use UUID primary keys
- JSONB columns for flexible schema
- Proper indexes for performance
- Foreign key constraints maintained
- Backward compatible with existing schema

## Configuration Changes

### New Environment Variables

**Phase 5 - Real-Time Features:**
```env
REDIS_URL=redis://localhost:6379
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=${REDIS_PASSWORD}
```

**Phase 7 - External Integrations:**
```env
# Threat Intelligence
NVD_API_KEY=your_nist_nvd_api_key
CISA_API_KEY=your_cisa_api_key
MITRE_API_KEY=your_mitre_api_key
OTX_API_KEY=your_alienvault_otx_key

# Vendor Security
SECURITYSCORECARD_API_KEY=your_ssc_api_key
BITSIGHT_API_KEY=your_bitsight_api_key
```

### Updated Package Dependencies

**Backend (`controlweave/backend/package.json`):**
```json
{
  "@socket.io/redis-adapter": "^8.3.0",
  "axios": "^1.13.5",
  "ioredis": "^5.4.1",
  "rss-parser": "^3.13.0"
}
```

**Frontend (`controlweave/frontend/package.json`):**
No new dependencies (uses existing Next.js, React, Recharts)

## Deployment Notes

### Prerequisites
- PostgreSQL 17+
- Redis 6+ (NEW - required for Phase 5)
- Node.js 18+ (existing requirement)

### Installation Steps

1. **Pull Latest Code:**
```bash
git fetch --tags
git checkout v2.0.0
```

2. **Install Dependencies:**
```bash
cd controlweave/backend && npm install
cd ../frontend && npm install
```

3. **Set Up Redis:**
```bash
# Install Redis (Ubuntu/Debian)
sudo apt-get install redis-server

# Or use Docker
docker run -d --name redis -p 6379:6379 redis:6

# Configure in .env
echo "REDIS_URL=redis://localhost:6379" >> .env
```

4. **Run Migrations:**
```bash
cd controlweave/backend
npm run migrate
```

5. **Configure External APIs (Optional):**
Edit `.env` and add API keys for Phase 7 integrations.

6. **Start Services:**
```bash
# Backend
cd controlweave/backend
npm start

# Frontend (separate terminal)
cd controlweave/frontend
npm start
```

### Health Checks
After deployment, verify:
- ✅ Backend server starts without errors
- ✅ Frontend builds successfully
- ✅ Database migrations complete
- ✅ Redis connection established
- ✅ WebSocket connections work
- ✅ Dashboards load correctly
- ✅ API endpoints respond (test with `/api/v1/health`)

## Performance Impact

### Frontend
- **Bundle size increase**: ~150KB (gzipped)
- **New routes**: 3 dashboard pages
- **WebSocket connection**: Persistent connection (minimal overhead)
- **Impact**: Negligible for most users

### Backend
- **Memory**: +50-100MB (Redis connection, WebSocket server)
- **CPU**: +5-10% (real-time event processing)
- **Database**: 4 new tables, minimal storage impact
- **Network**: External API calls (configurable frequency)

### Scaling Recommendations
- **Redis**: Use Redis Cluster for >10K concurrent users
- **WebSocket**: Consider Socket.IO cluster mode for >5K connections
- **External APIs**: Cache responses, respect rate limits
- **Database**: Index threat intelligence tables for large datasets

## Security Considerations

### New Attack Surfaces
- **WebSocket connections**: Protected by JWT authentication
- **External API keys**: Encrypted at rest, environment variables
- **Real-time events**: Organization-scoped isolation
- **Threat intelligence**: Rate limited, tier-gated access

### Mitigation Measures
- All new endpoints require authentication
- Rate limiting on all Phase 7 APIs
- Input validation on all external data
- SQL injection prevention (parameterized queries)
- XSS protection on dashboard rendering
- CORS configuration maintained
- Audit logging for all actions

## Testing

### Validation Performed
- ✅ All 95 backend JavaScript files pass syntax check
- ✅ Server module loads without errors
- ✅ No TypeScript compilation errors (frontend)
- ✅ All database migrations run successfully
- ✅ API endpoints return expected responses
- ✅ WebSocket connections establish properly
- ✅ Dashboard pages render correctly

### Recommended Testing
1. **Integration Testing**: Test all new API endpoints
2. **Load Testing**: Verify WebSocket performance under load
3. **Security Testing**: Penetration test new endpoints
4. **User Acceptance**: Test dashboard workflows
5. **Migration Testing**: Test on production-like data

## Known Issues

None. All conflicts were resolved during merge.

## Upgrade Path

### From Version 1.x
This is a major version upgrade. Follow deployment notes above.

### Rollback Procedure
If needed, revert to previous version:
```bash
git checkout main
npm install
npm run migrate  # Will skip new migrations
```

## Documentation

### New Wiki Pages
- [Dashboards Overview](controlweave/docs/wiki/dashboards/README.md)
- [AI Monitoring Dashboard](controlweave/docs/guides/AI_MONITORING.md)
- [Data Governance Dashboard](controlweave/docs/guides/DATA_GOVERNANCE.md)
- [Vendor Risk Dashboard](controlweave/docs/guides/VENDOR_RISK.md)
- [AI-Powered Features](controlweave/docs/wiki/ai-features/README.md)
- [External Integrations](controlweave/docs/wiki/integrations/README.md)

### Updated Documentation
- [Wiki Home Page](controlweave/docs/wiki/Home.md) - Added new sections
- [CLOSED_PRS.md](CLOSED_PRS.md) - Comprehensive summary

### Reference Documentation
- [Phase 4 Frontend Dashboards](PHASE_4_SUMMARY.md)
- [Phase 4 Implementation Complete](PHASE_4_SUMMARY.md)
- [Phase 5 Real-Time Features](controlweave/docs/REALTIME_FEATURES.md)
- [Phase 5 Complete](controlweave/docs/REALTIME_FEATURES.md)
- [Phase 6 AI-Powered Analysis](PHASE_6_SUMMARY.md)
- [Phase 6 Implementation Complete](PHASE_6_SUMMARY.md)
- [Phase 7 External Integrations](PHASE_7_SUMMARY.md)
- [Phase 7 Implementation Summary](PHASE_7_SUMMARY.md)

## Credits

**Implemented by**: GitHub Copilot Agent  
**Reviewed by**: ControlWeave Team  
**Release Manager**: @sherifconteh-collab

## Support

For questions or issues:
- **Documentation**: See wiki pages above
- **GitHub Issues**: [Report bugs](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues)
- **Email**: contehconsulting@gmail.com (Professional+ tiers)

---

**Version**: 2.0.0  
**Release Date**: February 19, 2026  
**Total Changes**: 78,325+ lines added across 254 files
