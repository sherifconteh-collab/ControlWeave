# Phase 4: Frontend Dashboards for AI Governance

Phase 4 covers the frontend UI layer built on top of the backend AI
governance APIs (continuous monitoring, data sovereignty, vendor/AI risk
assessment) delivered in earlier phases.

> **Note on source documents**: both docs this file replaces were
> planning artifacts, not after-the-fact implementation reports —
> despite one being named `PHASE_4_IMPLEMENTATION_COMPLETE.md`, its
> content is a forward-looking roadmap ("Ready to Start: Phase 4.1 can
> begin immediately") for follow-on enhancements (4.1–4.3), not a record
> of what shipped. This summary describes the actual current frontend
> structure (verified against `controlweave/frontend/src`), not the
> originally planned route layout, which diverged during implementation.

## What actually exists today

The three planned dashboard areas were consolidated differently than the
original spec proposed:

- **AI monitoring** — no standalone `/dashboard/ai-monitoring` route.
  Monitoring data (rules, events) is surfaced as an "AI Monitoring"
  section inside the unified `/dashboard/ai-security` page, backed by
  `controlweave/backend/src/routes/aiMonitoring.js`.
- **Data sovereignty** — not a standalone dashboard; implemented as a tab
  (`DataSovereigntyTab.tsx`) within the Data Governance page, with
  sub-sections for jurisdictions, regulatory changes, gap analysis, and
  residency configuration (`controlweave/frontend/src/components/dataGovernance/`).
  Backed by `controlweave/backend/src/routes/dataSovereignty.js`.
- **Vendor risk** — a single consolidated page
  (`controlweave/frontend/src/app/dashboard/vendor-risk/page.tsx`,
  ~600 lines) rather than the multi-route structure (assessments/,
  supply-chain/, incidents/ as separate pages) originally sketched.

## Real-time updates

Live/WebSocket updates (originally scoped as a "Phase 4.1" enhancement
dependent on a future Phase 5) were in fact delivered — `socket.io-client`
is a frontend dependency and `WebSocketContext.tsx`
(`controlweave/frontend/src/contexts/WebSocketContext.tsx`) provides a
`WebSocketProvider` with auto-reconnect (up to 5 attempts) and an
organization-online-count signal, consumed across dashboard pages. See
Phase 5 documentation for the backend/protocol details.

## Original scope (for reference)

The initial plan enumerated dashboards/forms for:

- **AI monitoring**: overview with summary cards, live event stream
  (severity color-coded), rule CRUD, event review/resolution workflow,
  anomaly baseline calculation and visualization, per-AI-system
  monitoring toggles.
- **Data sovereignty**: jurisdiction overview + map, jurisdiction CRUD,
  jurisdiction detail pages (laws, residency requirements, transfer
  mechanisms, applicable/recommended frameworks), regulatory change feed,
  compliance gap analysis, data residency configuration + attestation.
- **Vendor risk**: overview with risk heatmap, vendor assessment form
  (security/privacy/compliance/operational/financial dimension scores,
  AI-specific factors like model transparency and bias-testing evidence,
  contract details), vendor detail pages (supply chain components,
  incident history, SLA/performance metrics), supply-chain component
  inventory with vulnerability tracking, incident management.

## Planned but not confirmed built

The larger "15 enhancements across 3 phases" roadmap (Phase 4.1 real-time
UX polish beyond WebSockets, PDF export, dashboard widget customization,
dark mode; Phase 4.2 interactive residency maps, vendor scorecard
builder, config drift detection, policy automation engine, bulk import;
Phase 4.3 predictive analytics via TensorFlow.js, XAI/SHAP dashboards,
threat intel integration, Neo4j-based data lineage, i18n) was a cost/time
estimate exercise ($426K–$684K, 51–79 person-weeks) for *future* work, not
a record of delivered features. Treat every item in that list as
unconfirmed/unbuilt unless independently verified against current code —
this summary does not carry those claims forward as shipped.

## Technical stack (as planned; broadly consistent with the current app)

Next.js (App Router) + TypeScript + React, Tailwind CSS, TanStack Table
and TanStack Query, React Hook Form + Zod, date-fns, axios-based API
client with bearer-token auth interceptor.
