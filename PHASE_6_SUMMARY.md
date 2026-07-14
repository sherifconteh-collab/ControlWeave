# Phase 6: AI-Powered Analysis (Risk Scoring, Regulatory Impact, Remediation)

Phase 6 adds three LLM-backed analysis capabilities under `/api/v1/phase6/*`:
predictive risk scoring, regulatory impact analysis, and smart remediation
plan generation. This is distinct from the broader "AI Analysis" feature
set (gap analysis, audit readiness, compliance forecast, etc. — see
`controlweave/docs/guides/AI_ANALYSIS.md`), which is a separate,
unrelated namespace of AI report types.

> **Note on source documents**: `PHASE_6_AI_POWERED_ANALYSIS.md` (the
> original plan) proposed a *different* design than what was actually
> shipped — different service file names
> (`regulatoryImpactAnalysisService.js`, `predictiveRiskService.js`),
> different table names (`regulatory_change_analyses`,
> `compliance_risk_predictions`, `ai_remediation_plans`), and different
> routes (mounted under `/data-sovereignty` and `/analytics`). None of
> that matches the real code. This summary reflects what's actually in
> the repo today, verified against `controlweave/backend/src/routes/phase6.js`
> and migration `057_phase6_risk_scoring.sql`.

## What was actually built

**Services** (`controlweave/backend/src/services/`):
- `riskScoringService.js`
- `regulatoryImpactService.js`
- `smartRemediationService.js`

**Routes** (`controlweave/backend/src/routes/phase6.js`, mounted at
`/api/v1/phase6`):

| Method | Path | Permission |
|---|---|---|
| POST | `/risk-score/calculate` | `ai.use` |
| GET | `/risk-score/latest` | `compliance.read` |
| GET | `/risk-score/history` | `compliance.read` |
| POST | `/regulatory-impact/analyze` | `ai.use` |
| GET | `/regulatory-impact/assessments` | `compliance.read` |
| PUT | `/regulatory-impact/assessments/:id/review` | `compliance.manage` |
| POST | `/remediation/generate` | `ai.use` |
| GET | `/remediation/plans` | `compliance.read` |
| PUT | `/remediation/plans/:id/status` | `compliance.manage` |
| POST | `/analyze/comprehensive` | `ai.use` (runs all three analyses) |

All routes require `authenticate` plus an org-scoped rate limiter (30
requests/minute, label `phase6-ai-org`). The route file still carries a
legacy `// @tier: enterprise` marker; per `.claude/rules/tier-system.md`
this has no runtime effect — access is governed only by the
`requirePermission()` calls above.

**Database** (migration `057_phase6_risk_scoring.sql` — note: this
migration number collides with two other unrelated `057_*` migrations
already in the tree, `057_ai_continuous_monitoring.sql` and
`057_realtime_features.sql`; pre-existing numbering issue, not something
this doc merge fixes):
- `risk_scores` — overall + 4 component scores, letter grade, trend
  direction, 30/60/90-day predictions
- `regulatory_impact_assessments` — framework/change tracking, impact
  score/level, affected controls, effort/cost estimates, compliance
  deadline, review status
- `remediation_plans` — priority score/level, risk reduction estimate,
  effort/cost, status workflow, JSONB remediation steps

**Frontend**: `RiskScoreWidget.tsx`, `RegulatoryImpactWidget.tsx`,
`RemediationPlansWidget.tsx` in
`controlweave/frontend/src/components/aiInsights/`, consuming the
`/phase6/*` endpoints via `lib/api.ts`.

**Error handling detail** (from code, not in either original doc): when
no LLM provider/API key is configured, the AI-calling routes
(`regulatory-impact/analyze`, `remediation/generate`,
`analyze/comprehensive`) return a `422` with
`code: 'NO_PROVIDER_CONFIGURED'` and a BYOK setup prompt (suggesting
Gemini/Groq/Ollama as free providers) rather than a generic 500.

## Risk scoring algorithm

```
Overall Score =
  (Control Implementation × 0.40) +
  (Vulnerability Management × 0.25) +
  (Evidence Freshness × 0.20) +
  (Assessment Coverage × 0.15)
```

- **Control Implementation**: `(Implemented + InProgress×0.5) / Total × 100`, minus penalties for priority-1/2 gaps.
- **Vulnerability**: `100 − (CriticalOpen×15) − (HighOpen×5) − (MediumOpen×1) − (LowOpen×0.2)`.
- **Evidence Freshness**: weighted recency buckets (30/90/180 day evidence age).
- **Assessment Coverage**: coverage % plus satisfaction and recency bonuses.

Letter grades run A+ (95-100) down to F (0-39), 12 levels total (A+, A,
A-, B+, B, B-, C+, C, C-, D+, D, D-, F).

Regulatory impact levels: Critical (90-100), High (70-89), Medium
(40-69), Low (20-39), Minimal (0-19).

Remediation priority levels: Critical (80-100, immediate), High (60-79,
30 days), Medium (40-59, 90 days), Low (0-39, as resources allow).

## Quick reference

```bash
# Calculate risk score
POST /api/v1/phase6/risk-score/calculate

# Analyze regulatory impact
POST /api/v1/phase6/regulatory-impact/analyze
{
  "frameworkCode": "nist_800_53",
  "changeType": "new_requirement",
  "changeDescription": "Description of the change",
  "provider": "claude"
}

# Generate remediation plan
POST /api/v1/phase6/remediation/generate
{
  "controlId": 123,
  "provider": "claude"
}
```

Common use cases:
- **Monitor compliance health**: calculate risk score periodically, track trend, review component scores, address critical gaps.
- **Respond to regulatory changes**: analyze impact, review the AI assessment, approve the plan, track the compliance deadline.
- **Close control gaps**: generate a remediation plan for a control, review estimated effort, assign, track completion percentage.

## Planned but not confirmed built

The original plan (`PHASE_6_AI_POWERED_ANALYSIS.md`) also described a
**Compliance Trend Analysis** feature (`GET
/analytics/compliance-trends`, historical + predicted trend data). No
route matching this was found under `controlweave/backend/src/routes/`
during this review — treat it as unbuilt/superseded, not shipped. The
"Phase 6.1" future-enhancement ideas from the completion doc (ML
prediction models, automated impact monitoring alerts, JIRA/ServiceNow
remediation workflow automation, peer benchmarking) are likewise
unbuilt proposals, not delivered features.
