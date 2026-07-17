# Framework Catalog Completion Plan (Waves 1-4)

This is the completion roadmap referenced by the `frameworks.coverage_status`
migration shipped in PR
[#544](https://github.com/sherifconteh-collab/ControlWeaver-Pro/pull/544)
(companion:
[ai-grc-platform #209](https://github.com/sherifconteh-collab/ai-grc-platform/pull/209)),
which deliberately scoped the work below **out** of that PR and deferred it
here. Each wave is a separate content-authoring or import-tooling effort and
ships as its own PR (one per wave, per repo).

Two efforts are tracked:

1. **Per-framework catalog completion** — grow each `core_controls` catalog to
   its full official control set (Waves 1-4).
2. **`seed-frameworks.js` per-framework-module refactor** — a prerequisite
   structural change (Wave 0) so the catalog growth doesn't land in a single
   1,800-line array literal.

## How coverage is labeled today

The PR #544 migration added `frameworks.coverage_status` with three values:

| Value | Meaning |
|---|---|
| `comprehensive` | Verified complete against the official/self-defined catalog |
| `core_controls` | A real, curated subset of the official catalog — the default, and the bucket this plan empties |
| `representative` | Guidance/examination frameworks with no single canonical enumerated control list — intentionally illustrative, **not** targeted for "completion" |

A wave is done for a framework when its seeded control count matches the
official catalog manifest and its `coverage_status` flips to `comprehensive`
via migration.

## Current-state inventory

Counts are what `npm run seed:frameworks` produces once PR #544 lands (the
seed script plus `seed-missing-controls.js`, which it now invokes). Targets
are the official catalog sizes; verify exact figures against the primary
source at implementation time.

### Frameworks this plan completes

| Framework (`code`) | Seeded today | Official target | Wave |
|---|---:|---|---|
| NIST CSF 2.0 (`nist_csf_2.0`) | 76 | 106 subcategories | 1 |
| NIST SP 800-171 Rev 3 (`nist_800_171`) | 24 | 97 requirements | 1 |
| FedRAMP Moderate (`fedramp_moderate`) | 38 | ~323 controls (Rev 5 baseline, derived from 800-53) | 1 |
| FedRAMP High (`fedramp_high`) | 25 | ~410 controls (derived from 800-53) | 1 |
| ISO/IEC 27001:2022 (`iso_27001`) | 82 | 93 Annex A controls | 2 |
| ISO/IEC 27002:2022 (`iso_27002`) | 15 | 93 controls | 2 |
| ISO/IEC 27017:2015 (`iso_27017`) | 12 | 37 cloud-specific controls + extensions | 2 |
| ISO/IEC 27018:2019 (`iso_27018`) | 11 | ~25 PII-cloud extensions | 2 |
| ISO/IEC 27701:2019 (`iso_27701`) | 14 | 49 PIMS controls (Annex A + B) | 2 |
| ISO/IEC 42001:2023 (`iso_42001`) | 26 | 38 Annex A controls | 2 |
| SOC 2 TSC (`soc2`) | 27 | 61 criteria (33 CC + A/PI/C/P) | 2 |
| PCI DSS v4.0 (`pci_dss_v4`) | 61 | 12 requirements, ~270 testable sub-requirements | 3 |
| CIS Controls v8 (`cis_controls_v8`) | 18 | 18 controls → 153 safeguards (IG1/2/3 tagged) | 3 |
| DISA STIGs + CCI | 5 hand-seeded benchmarks | importer-driven, per-benchmark | 4 |

### Frameworks already `comprehensive` (no work)

`cobit_2019` (40), `state_ai_governance` (47), `international_ai_governance`
(49), `owasp_llm_top10`, `owasp_agentic_top10` (seeded via
`seed-owasp-frameworks.js`), `nist_800_53` (300 non-withdrawn base controls,
generated from the official NIST OSCAL catalog — completed in Wave 1 by
[#576](https://github.com/sherifconteh-collab/ControlWeaver-Pro/pull/576)),
`cmmc_2.0` (110 Level 2 practices, generated from NIST SP 800-171 Rev 2
OSCAL data — completed in Wave 1 by
[#586](https://github.com/sherifconteh-collab/ControlWeaver-Pro/pull/586);
CMMC 2.0 Level 1's 15 practices remain unseeded and out of this plan's
original target scope).

### Frameworks staying `representative` (no completion target)

`nist_privacy`, `fiscam`, `ffiec`, `nerc_cip`, `finra_supervisory_ai`,
`sec_markets_ai_risk`, `sr_11_7`, `hitech`, `ccpa_cpra`, `nist_800_207`,
`iso_27005`, `iso_31000`, `iso_42005`, `aiuc_1`. These are examination
handbooks or guidance documents with no canonical enumerated control list.

### Remaining `core_controls` backlog (out of the four waves)

`gdpr` (17; article-level catalog of 99 articles), `hipaa` (22; ~54
standards/implementation specifications), `eu_ai_act` (15; obligations across
113 articles), `nist_ai_rmf` (19; 72 subcategories). Not part of the PR #544
follow-up scope; schedule after Wave 4 or on demand.

## Wave 0 — `seed-frameworks.js` per-framework-module refactor

**Why first:** `controlweave/backend/scripts/seed-frameworks.js` is a single
~1,800-line array literal. Waves 1-3 multiply its size several-fold; landing
them into the monolith makes review and merge conflicts unmanageable. This
follows the same behavior-preserving extraction pattern already used for the
route/service monoliths (see `FOLLOW_UP_TRACKING.md`).

**Shape:**

- One data module per framework:
  `controlweave/backend/scripts/lib/frameworks/<code>.js`, exporting
  `{ framework, controls, expectedCount }`. Pure data, no DB code. (The
  standalone per-framework seeds — `seed-aiuc1-framework.js`, the
  `seed-disa-stig-*.js` set, `seed-owasp-frameworks.js` — already approximate
  this one-framework-per-file shape; converge them on the same module format.)
- `seed-frameworks.js` becomes a thin orchestrator: loads every module from
  the directory, runs the existing idempotent upsert loop, then asserts each
  framework's seeded row count matches `expectedCount` and fails loudly on
  mismatch.
- Fold `seed-missing-controls.js` content into the per-framework modules so
  there is one source of truth per framework (keep the script as a shim that
  re-runs the orchestrator, since PR #544 wires it into startup auto-heal).
- Behavior-preserving: `npm run seed:frameworks` output (framework codes,
  control counts, idempotency on re-run) is identical before/after.

**Acceptance:** `npm run check:syntax` and Jest green; a regression test
asserts the module directory's aggregate counts equal the pre-refactor
totals; TEVV-DB seed-consistency checks pass.

## Wave 1 — NIST 800-53 Rev 5 completion + baseline derivation

The largest single gap, and three frameworks fall out of it nearly for free.

1. **800-53 base controls to ~322.** Do not hand-type: generate
   `lib/frameworks/nist_800_53.js` from NIST's official OSCAL/CPRT JSON
   catalog (public domain). A small `scripts/import-oscal-80053.js` converter
   maps OSCAL `id/title/statement` → `{ control_id, title, description,
   priority, control_type }`. Withdrawn controls excluded; control
   enhancements deferred (base controls only, matching the PR #544 target).
2. **FedRAMP Low/Moderate/High as derived baselines.** FedRAMP publishes
   OSCAL baseline profiles that select 800-53 control IDs. Represent each
   baseline as a framework whose controls are generated by filtering the
   800-53 module through the baseline's ID list — never a hand-authored
   parallel catalog. Replaces today's hand-picked `fedramp_moderate` (38) and
   `fedramp_high` (25) and adds `fedramp_low`.
3. **800-171 Rev 3 to 97 requirements; CMMC 2.0 stays pinned to Rev 2 as its
   derivation source.** 800-171 r3 is also published as OSCAL and becomes the
   `comprehensive` `nist_800_171` framework in this wave. CMMC 2.0 L2's 110
   practices, however, map 1:1 to 800-171 **Rev 2**'s 110 requirements (the
   official CMMC 2.0 Level 2 Assessment Guide is written against Rev 2, and
   Rev 3 consolidated down to 97 requirements — there is no 110-item subset of
   Rev 3 to derive L2 from). So `cmmc_2.0` is generated from a pinned Rev 2
   800-171 OSCAL catalog kept alongside the Rev 3 module specifically for this
   derivation, not from the `nist_800_171` framework seeded above. L1 (15)
   derives the same way, also from Rev 2. Re-derive CMMC 2.0 from Rev 3 only
   if/when DoD publishes an updated mapping.
4. **CSF 2.0 top-up to 106 subcategories** (30 missing) — small, hand-authored
   from the public CSF 2.0 core, rides along in this wave.

**Acceptance:** counts match the manifest; migration flips `coverage_status`
to `comprehensive` for `nist_800_53`, `nist_csf_2.0`, `nist_800_171`,
`cmmc_2.0`, and the FedRAMP baselines; crosswalk seeds
(`seed-iso27001-2022-crosswalks.js`, `seed-hipaa-crosswalks.js`) still resolve
every mapped ID; RMF and STIG features that reference 800-53 IDs keep working;
re-run idempotency verified.

## Wave 2 — ISO family + SOC 2

**Licensing constraint (hard):** ISO standards are copyrighted. Seed control
**identifiers and titles plus original paraphrased descriptions only** — never
verbatim standard text. This is the existing convention (see
`docs/FRAMEWORK_COVERAGE.md` license note); keep it explicit in every ISO
module header.

- `iso_27001` 82 → 93 Annex A controls (11 missing).
- `iso_27002` 15 → 93 (same control set as 27001 Annex A, guidance-level
  descriptions; consider generating from the 27001 module with adjusted
  descriptions to avoid double authoring).
- `iso_27017` → full cloud control set (30 base + 7 cloud-only extensions).
- `iso_27018` → full PII-protection extension set.
- `iso_27701` → 49 PIMS controls (Annex A controller + Annex B processor).
- `iso_42001` 26 → 38 Annex A AI-management controls.
- `soc2` 27 → 61 TSC criteria (complete CC series + Availability, Processing
  Integrity, Confidentiality, Privacy). AICPA TSC is published openly;
  paraphrase points of focus.

**Acceptance:** counts match; `coverage_status` → `comprehensive` for the six
ISO codes + `soc2`; `seed-iso27001-2022-crosswalks.js` re-run against the full
catalog resolves every mapped ID.

## Wave 3 — PCI DSS v4.0 + CIS Controls v8

- **PCI DSS v4.0** 61 → testable sub-requirement level (~270 items, e.g.
  `1.2.5`, `8.3.6`) across the 12 requirements. PCI SSC publishes the standard
  freely; paraphrase requirement text, keep official numbering. The sibling
  repo lacks this framework entirely — add it there in the companion PR.
- **CIS Controls v8** 18 → 153 safeguards, each tagged with its Implementation
  Group (IG1/IG2/IG3) in the description or a metadata field. CIS licenses the
  controls for use with attribution; include the attribution line in the
  module header.

**Acceptance:** counts match; both flip to `comprehensive`; the priority
mapping (`1`/`2`/`3`) follows IG tiers for CIS.

## Wave 4 — DISA STIG + CCI import

STIG catalogs are too large and too frequently revised to hand-author. This
repo already carries five hand-authored benchmark seeds
(`seed-disa-stig-framework.js`, `-app-server`, `-gpos`, `-postgresql`,
`-web-server`) plus STIG tooling (`check-stig-versions.js`,
`assess-stig-compliance.js`, `export-stig-cklb.js`). Replace hand-authoring
with an importer:

- `scripts/import-stig.js`: parses a DISA XCCDF benchmark XML → creates a
  framework (`disa_stig_<benchmark>`) with one control per rule (V-key /
  SV-key, severity → priority).
- CCI list import: DISA's CCI XML maps rules → NIST 800-53 controls; emit
  `control_mappings` rows so every imported STIG crosswalks to the (now
  complete, Wave 1) 800-53 catalog automatically.
- Converge the five existing hand-seeded benchmarks onto importer output
  (same framework codes, refreshed to current benchmark versions), and keep
  `check-stig-versions.js` as the staleness detector. Imported STIG frameworks
  register as `comprehensive` (complete relative to their benchmark version).
- Port the importer to the sibling ai-grc-platform repo, which has no STIG
  content today, with at least one imported benchmark as proof.

**Acceptance:** importer round-trips a current DISA benchmark; CCI-derived
mappings land in `control_mappings`; the five existing benchmarks re-import
without breaking `assess-stig-compliance.js` / `export-stig-cklb.js`;
re-import of the same benchmark version is idempotent.

## Conventions for every wave

- Data modules are pure data; the orchestrator owns all DB access
  (parameterized queries only).
- Migrations: next free sequential number in `controlweave/backend/migrations/`
  at implementation time, idempotent, forward-only, header comment naming the
  wave and release.
- `docs/FRAMEWORK_COVERAGE.md` inventory table and this document's
  current-state table are updated in the same PR as each wave.
- Branch/commit per `git-workflow.md` (`feat/CW-<n>/...`, MINOR bump —
  additive catalog content); all six TEVV CI layers must pass.
- Keep parity: every wave lands in both `ControlWeaver-Pro` and
  `ai-grc-platform` (near-identical seed infrastructure), ideally as companion
  PRs like #544/#209.
