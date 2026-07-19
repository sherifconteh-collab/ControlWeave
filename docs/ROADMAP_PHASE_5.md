# ControlWeaver Roadmap — Phase 5: Scale, Ecosystem & Standards Depth

> **Naming note**: this "Phase 5" is a continuation of the informal
> "Phase 4: Automated Intelligence & Platform Maturity" workstream tracked
> in recent session/PR history (auditor external portal, connector-to-control
> AI auto-assessment, the GitHub evidence connector), not a continuation of
> the unrelated `PHASE_4_SUMMARY.md` / `PHASE_6_SUMMARY.md` / `PHASE_7_SUMMARY.md`
> series at the repo root, which document an earlier, separate AI-governance
> frontend-dashboard workstream. No document called "Phase 4" or "Phase 5" in
> that numbering scheme exists for the connector/evidence/framework work —
> this file is the first one, written retroactively to formalize a roadmap
> that previously only existed as conversation and task-tracker state.

## Where Phase 4 actually stands

Phase 4 ("Automated Intelligence & Platform Maturity") scoped seven items.
Status as of this doc:

| Item | Status |
|---|---|
| Auditor external portal | ✅ Shipped |
| Connector-to-control AI auto-assessment | ✅ Shipped (#612) |
| GitHub evidence connector | ✅ Shipped (#624; Azure/GCP not yet covered) |
| AI evidence scoring | ⬜ Not started |
| Policy-to-control RAG mapping enhancement | ⬜ Not started |
| Jira bidirectional POA&M sync | ⬜ Not started |
| Public REST API with HMAC-SHA-384 signed keys | ⬜ Not started |
| Helm chart / Kubernetes deployment | ⬜ Not started |

The four unstarted items carry forward as-is — they are not superseded by
Phase 5, they're simply still open. Phase 5 below is what comes after
those, plus items surfaced independently while doing framework-catalog,
QA-script, and MCP-registry work earlier this cycle.

## Phase 5 scope

### 5.1 Multi-cloud evidence connectors (extends the GitHub connector pattern)

The GitHub connector (`services/githubService.js`, `routes/github.js`)
established a template: org-scoped encrypted token storage, a
`testConnection`/`fetchEvidence` service pair, and an Auto-Evidence
Collection Rule source-type branch. Two of the three originally-scoped
connectors are still open:

- **Azure connector** — Azure DevOps (PRs, pipeline runs) and/or Microsoft
  Defender for Cloud recommendations as live evidence, following the same
  shape as `microsoft_sentinel`'s existing config-only stub.
- **GCP connector** — Security Command Center findings and/or Cloud Audit
  Logs, following the same shape as `aws_cloudtrail`'s existing config-only
  stub.

Both should replace their current "creates a config-only evidence record"
stub branches in `executeCollectionRule()` with real API calls, exactly as
this cycle's GitHub work replaced GitHub's stub. Carry forward the same
JSON-parsing hardening applied to the GitHub connector this cycle: wrap
`JSON.parse()` on external API responses in a try-catch and surface a
snippet of the raw response body in the error, rather than swallowing a
non-JSON (e.g. HTML error page) response silently.

### 5.2 AI evidence scoring (carried from Phase 4)

Score AI-suggested evidence (from `pendingEvidence`/`orgRagService`
suggestions and the newer connector imports) for relevance/confidence
before it reaches human review, surfaced as a badge/sort key in the
pending-evidence queue. Should reuse `aiQualityGate.js`'s existing scoring
pattern rather than introducing a second scoring mechanism.

### 5.3 Policy-to-control RAG mapping enhancement (carried from Phase 4)

Extend `orgRagService`'s document indexing so uploaded policy documents
are automatically proposed as control-linkage candidates (RAG similarity
between policy chunks and control descriptions), with human approval
before the link is created — same approval-required pattern as
`pendingEvidence`.

### 5.4 Jira bidirectional POA&M sync (carried from Phase 4)

`jira` is already an Auto-Evidence source type (config-only stub today).
This item is a separate, deeper integration: push POA&M items to Jira as
tracked issues and pull status/close-date changes back, not just import
Jira data as evidence. Needs its own settings surface distinct from the
Auto-Evidence Jira source (different credential scope: write access, not
just read).

### 5.5 Public REST API with HMAC-SHA-384 signed keys (carried from Phase 4)

A machine-to-machine API surface (distinct from the browser-session JWT
auth used today) for CI/CD pipelines and external tooling to read
compliance posture and push evidence, signed with HMAC-SHA-384 per the
existing CNSA Suite 1.0 floor (`.claude/rules/security.md`). Natural fit
for the existing `GET /compliance/gate` CI-gate pattern to be extended
into a broader signed-key API surface rather than a single service-account
token. Signature verification must use the raw, unparsed request body
(e.g. `req.rawBody`, captured before body-parsing middleware runs) for
exact byte-for-byte HMAC matching — re-serializing a parsed object with
`JSON.stringify` is not stable across key order/whitespace and causes
intermittent verification failures.

### 5.6 Helm chart / Kubernetes deployment (carried from Phase 4)

Helm chart covering backend + frontend + Postgres (or external managed
DB) + Redis, with the Socket.io/WebSocket layer configured to actually
use the Redis adapter in a multi-replica deployment — **relevant gap
found live this cycle**: the dev server currently logs
`"Redis not configured, using in-memory adapter (single instance only)"`
unconditionally when `REDIS_URL` is unset, meaning a naive multi-pod
Kubernetes deployment today would silently lose cross-pod WebSocket
delivery (each pod's clients only see that pod's events). The Helm chart
work should treat wiring a real Redis adapter as a prerequisite, not an
optional afterthought.

### 5.7 Framework catalog completion, Waves 1–4

Tracked separately in `docs/FRAMEWORK_CATALOG_COMPLETION_PLAN.md` and
issues #217/#566 (Waves 1-4) and #218/#567 (seed-script refactor). When
seeding crosswalk mappings, verify both source and target control IDs are
actually defined in the database before inserting the mapping row (a
mapping to a non-existent control ID fails silently rather than raising),
and check for logical alignment between mapped controls (e.g. don't map a
data-governance control to an audit-logging control just because an
importer's heuristic matching produced a plausible-looking pair). Also:
if a seed script or generator is refactored to derive fields dynamically,
don't touch any literal string a CI regression guard or grep-based static
check depends on for verification — reverting one such field back to a
literal (`code: 'nist_800_53'`) was already a real fix needed on PR #576
this cycle.

Current real blockers, confirmed by actually attempting each source this
cycle (not assumed):

- **FedRAMP**: `GSA/fedramp-automation` returns HTTP 403 across every
  access method tried (issue #580) — revisit if/when GSA's OSCAL
  publishing moves or reopens.
- **ISO family**: no free, machine-readable official source found;
  proceed via original-paraphrase control text only (never verbatim),
  same constraint the plan doc already documents.
- **PCI DSS v4 / CIS Controls v8**: official sources are either
  network-policy-blocked (PCI SSC) or licensed CC BY-NC-ND (CIS
  OSCAL on Bitbucket, confirmed by reading the LICENSE — "No Derivative
  Works" is a genuine blocker, not just an accessibility one).
- **DISA STIG + CCI**: a public-domain CCI mirror exists but is stale
  (2016-vintage, DISA has since shipped CCI Revision 5); pursuing it ships
  a knowingly-outdated crosswalk — needs an explicit call on whether
  "stale but real" beats "not shipped at all" before starting Wave 4.
- **NIST 800-53 Rev 5 and CMMC 2.0 L1/L2**: done (PRs #576, #586) —
  no further Wave 1 work needed for those two frameworks specifically.

### 5.8 MCP tool surface — keep pace with new routes

The MCP server now dynamically loads all 54 registered tools from
`scripts/mcp-tool-registry.js` (fixed this cycle — previously only 21 of
54 were reachable). Phase 5 work that adds new route surfaces (5.1–5.5
above) should add matching registry entries in the same PR, not as a
follow-up — the dynamic-loading fix removes the excuse of "the tool
exists in the registry but nobody wired the server," but someone still
has to add the registry entry itself.

### 5.9 Stale tier-language cleanup

Noted, not fixed, in multiple review passes this cycle (PR #565's Gemini
review, PR #624's doc review): several docs and one dead-code UI
condition (`!canUseSiem` in the Integrations tab) still carry paid-tier
language/logic from before the open-source tier-gating removal
(`.claude/rules/tier-system.md`). Worth a dedicated cleanup pass across
`docs/`, `TIER_COMPARISON.md`-adjacent tables, and any remaining
`canUseX`-style booleans that can never resolve differently from each
other, rather than fixing them piecemeal inside unrelated feature PRs.

### 5.10 i18n / localization audit

`PHASE_4_SUMMARY.md` (the pre-existing AI-governance-dashboard summary,
unrelated numbering) explicitly flags i18n as "planned but not confirmed
built." Phase 5 should include a real audit — grep for hardcoded
user-facing strings vs. an actual i18n library integration — rather than
carrying forward an unverified claim indefinitely.

## Sequencing suggestion

1. 5.1 (Azure/GCP connectors) — same shape as just-shipped work, lowest
   ramp-up cost, likely first.
2. 5.5 (public API) and 5.6 (Helm/K8s) — infrastructure-shaped, can run in
   parallel with 5.1 since they touch different code.
3. 5.2/5.3/5.4 (AI scoring, RAG mapping, Jira sync) — deeper feature work,
   sequence after infra items land so they can assume a stable deployment
   target for testing.
4. 5.7 (framework catalog) continues independently on its own track,
   gated on source-access/licensing resolution per framework.
5. 5.8/5.9/5.10 are cross-cutting — apply 5.8 continuously as 5.1-5.6 add
   routes; schedule 5.9/5.10 as their own small, focused PRs once the
   above settle.

## Companion repo

`ai-grc-platform` (the open-source base this repo builds on) gets the
same roadmap, scoped down where CW-Pro-only surfaces don't apply (e.g. no
DISA STIG hand-seeds, smaller existing framework catalog) — see that
repo's own `docs/ROADMAP_PHASE_5.md`.
