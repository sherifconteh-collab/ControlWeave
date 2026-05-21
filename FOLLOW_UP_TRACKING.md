# Follow-Up Tracking — Deferred Work

This document tracks work items that were originally scoped out of the prior
large PR. The follow-on PR that landed this file then executed a first pass
on all three items; what remains is the *incremental* decomposition of the
route/service monoliths. See the **Status** column in each section below.

---

## 4.1 — Monolith refactor (Started; incremental follow-ups remaining)

First-pass extractions have landed using a behavior-preserving pattern: pure
helpers, constants, and cohesive feature blocks are pulled into sibling
sub-modules, and the monolith destructures them from the new location. No
public route surface or public service export has changed. Regression tests
in `controlweave/backend/__tests__/refactor/monolith-split.test.js` lock in
the contract.

| File | Lines before | Lines now | Extracted to |
| --- | ---: | ---: | --- |
| `backend/src/services/llmService.js` | 3,177 | ~2,983 | `src/services/ai/providerConfig.js`, `src/services/ai/prompts.js` |
| `backend/src/routes/assessments.js` | 3,893 | ~3,562 | `src/routes/assessments/_shared.js` |
| `backend/src/routes/organizations.js` | 3,197 | ~2,681 | `src/routes/organizations/_helpers.js` |
| `frontend/src/app/dashboard/settings/page.tsx` | 5,496 | ~5,421 | `src/app/dashboard/settings/_tabs/AuditTab.tsx` |

**Remaining, as dedicated follow-up PRs (one per monolith):**

- [ ] `assessments.js` — continue splitting into per-resource sub-routers
      (`procedures.js`, `engagements.js`, `findings.js`, `evidence.js`,
      `templates.js`). Target: orchestrator ≤ 500 lines.
- [ ] `organizations.js` — continue splitting into per-resource sub-routers
      (`me-resources.js`, `controls.js`, `frameworks.js`, `import-export.js`).
      Target: orchestrator ≤ 500 lines.
- [ ] `llmService.js` — extract per-provider HTTP plumbing
      (`ai/providers/{claude,openai,gemini,grok,groq,ollama}.js`) and feature
      functions (`ai/features/*.js`). Target: orchestrator ≤ 500 lines.
- [ ] `settings/page.tsx` — extract remaining tabs (`LlmTab`, `AiActivityTab`,
      `AutomationTab`, `IntegrationsTab`, `ContentTab`, `PlatformOpsTab`,
      `SecurityTab`, `RolesTab`, `NotificationsTab`, `AccountTab`) one per
      PR. Target: page ≤ 500 lines (nav + routing shell only).

Each follow-up PR must:
- Preserve the existing public route surface / component behavior.
- Keep parameterized SQL and `organization_id` multi-tenant filters intact.
- Pass `npm run check:syntax` and `npx jest` (backend), `npm run typecheck`
  and `npm run lint` (frontend).
- Extend the regression tests in `__tests__/refactor/monolith-split.test.js`
  with coverage for any newly extracted module.

---

## 4.2 — Fastify migration spike (DONE)

Landed at [`spikes/fastify-spike/`](spikes/fastify-spike/). Isolated from the
production bundle and CI — running the spike does not alter production
dependencies.

Deliverables:

- [x] Minimal Fastify app + matching Express baseline over identical
      fixtures (JWT auth, fake `pg.query`, shared JSON schema).
- [x] Covers three representative route shapes: trivial response, auth-gated
      read-heavy list, auth-gated write with schema validation.
- [x] `bench.js` autocannon harness that emits `results/summary.md` and
      `results/results.json`.
- [x] `README.md` with methodology and Express↔Fastify compatibility-gap
      matrix.
- [x] `DECISION.md` with explicit migrate/stay thresholds (write-route RPS
      gain ≥ 25%, read-route p99 reduction ≥ 15%, migration effort
      < 3 engineer-weeks) and revisit triggers.

**Next step (not required to land this PR):** the repo maintainer runs
`npm run bench` on the target hardware and fills in `DECISION.md`.

---

## 4.3 — HIPAA Security Rule + crosswalks (DONE)

- [x] Added the 5 missing §164.314 / §164.316 controls to
      `scripts/seed-frameworks.js` (Business Associate Contracts, Group
      Health Plans, Policies and Procedures, Documentation, and
      Documentation – Time Limit / Availability / Updates). The
      Administrative, Physical, and Technical safeguard controls were
      already present in the baseline seed; they now form a complete
      §164.308–§164.316 catalog.
- [x] New script `scripts/seed-hipaa-crosswalks.js` wired as
      `npm run seed:hipaa-crosswalks`. Idempotent; seeds 45 HIPAA →
      NIST 800-53 Rev 5 mappings (aligned with NIST SP 800-66 Rev 2) and
      32 HIPAA → ISO 27001:2022 mappings.
- [x] Fixed 5 broken entries in `scripts/seed-iso27001-2022-crosswalks.js`
      that referenced HIPAA control IDs without the `HIPAA-` prefix and
      therefore silently no-op’d.

**Verification (not required to land this PR):** the maintainer runs
`npm run migrate && node scripts/seed-frameworks.js && npm run seed:hipaa-crosswalks`
against a staging DB and then `npm run qa:crosswalk:live`.

---

## Ownership

These are follow-ups for the repo maintainer to file as GitHub issues and
schedule. The agent cannot create issues from this environment.

