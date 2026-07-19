# ControlWeaver

**AI-native Governance, Risk, and Compliance platform — fully open source, self-hostable, MCP-enabled**

> **v4.0 — Fully Open Source.** All features previously locked behind paid tiers are now free for everyone under AGPL v3. No subscription required.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](./LICENSE)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io)
[![Release](https://img.shields.io/badge/Release-v4.6.0-green.svg)](./RELEASE_NOTES.md)
[![Security Pipeline](https://img.shields.io/badge/Security-NIST%20800--160-orange.svg)](./.github/workflows/security-pipeline.yml)
[![Frameworks](https://img.shields.io/badge/Frameworks-44-brightgreen.svg)](./docs/FRAMEWORK_COVERAGE.md)
[![Controls](https://img.shields.io/badge/Controls-1%2C190%2B-brightgreen.svg)](./docs/FRAMEWORK_COVERAGE.md)
[![Crosswalks](https://img.shields.io/badge/Crosswalks-360%2B-blue.svg)](./docs/CROSSWALK_GUIDE.md)

---

## What Is This?

ControlWeaver is a comprehensive multi-framework GRC platform. It manages compliance across 40 frameworks simultaneously, automates evidence collection, and offers optional BYOK AI assists — all fully open source under AGPL v3.

Positioning intent: GRC-first, MCP-native, and integration-first. AI is a supplement to the platform, not its centerpiece.

**Core differentiators:**

- **44 Frameworks, 1,190+ Controls** — NIST CSF, AI RMF, ISO 27001, SOC 2, CMMC 2.0, EU AI Act, HIPAA, NERC CIP, CIS Controls v8, COBIT 2019, FedRAMP High/Moderate, FINRA, SEC, SR 11-7, and 30 more
- **Auto-Crosswalk Engine** — Implement one control, automatically satisfy equivalent controls across other frameworks (40–60% effort reduction)
- **Optional AI Insights (BYOK)** — Gap analysis, compliance forecast, audit readiness, and inline assists on controls/evidence using your own Anthropic, OpenAI, Gemini, Grok, Groq, or Ollama key. The platform works without any AI key configured.
- **RMF Lifecycle** — Full NIST SP 800-37 Rev 2 seven-step workflow with ATO tracking
- **MCP-Native** — Acts as an AI agent via Model Context Protocol for Claude Desktop, Cursor, VS Code
- **Open-Source Core** — AGPL v3 licensed; auditable, self-hostable, no lock-in

---

## Current Status

- ✅ RMF Leveraged Authorizations — RMF packages inherit controls and authorization posture from COTS/SaaS products (FedRAMP-style leveraged authorization), with at-risk flagging and CRM/OSCAL SSP export
- ✅ Trust Center — opt-in, token-gated public page showing aggregate compliance posture and active-authorization counts
- ✅ Classroom mode — guided training scenarios with built-in templates and an instructor progress view
- ✅ Anonymized industry benchmarking — k-anonymity-guarded peer compliance comparison with an org-level opt-out
- ✅ Compliance-as-code CI gate — `GET /compliance/gate` returns 200/412 against a compliance threshold, for direct use in CI pipelines
- ✅ Cyber Resilience module — BC/DR, incident-response, and ransomware-playbook plan tracking with tabletop/functional/full-scale exercise logging, RTO/RPO attainment, and a computed Cyber Resilience Score
- ✅ JWT + OAuth 2.0 authentication with TOTP 2FA and account lockout
- ✅ RBAC with Admin, ISSE, Auditor, Read-Only, and custom roles
- ✅ 44 compliance frameworks, 1,190+ controls, 360+ crosswalk mappings
- ✅ Auto-crosswalk engine (≥90% similarity auto-satisfies controls across frameworks)
- ✅ Custom Framework Builder — create, publish, and clone org-scoped frameworks with full control editor
- ✅ Executive Analytics Dashboard — cross-framework compliance trends with period selector and SVG sparklines
- ✅ Scheduled report delivery — configure daily/weekly/monthly/quarterly PDF/CSV report jobs with email recipients
- ✅ MSP parent-child org hierarchy with delegated admin — manage child orgs and per-child compliance summaries
- ✅ Continuous monitoring integrations — AWS Security Hub, Qualys VMDR, and ITSM/Change Management connectors
- ✅ FedRAMP High Baseline (25 High-only controls) + FedRAMP deployment guide
- ✅ Optional AI insights (BYOK) — gap analysis, compliance forecast, audit readiness, remediation playbooks, policy generation, and inline assists on controls and evidence
- ✅ RMF Lifecycle module (NIST SP 800-37 Rev 2: Prepare → Authorize → Monitor)
- ✅ Auditor Workspace with engagements, PBC requests, workpapers, findings, sign-offs
- ✅ CMDB: Hardware, Software, AI Agents, Service Accounts, Environments, Password Vaults
- ✅ SBOM / AIBOM management with CycloneDX support
- ✅ Vulnerability management with CVSS scoring and AI remediation
- ✅ POA&M tracking for federal and regulatory reporting
- ✅ Evidence management with versioning, PII classification, and retention enforcement
- ✅ AES-256-GCM encryption at rest for user PII (email), HMAC-SHA-384 searchable hashes, CNSA Suite 1.0 compliant — runtime audit verifies encryption on every server start
- ✅ TLS 1.2+ enforced on all API channels; MCP → REST API channel hardened against plaintext credential exposure
- ✅ AU-2 compliant immutable audit logging
- ✅ All features free — no subscription or license key required
- ✅ MCP server (54 tools: frameworks, controls, assets, evidence, POA&M, audit, TPRM, AI)
- ✅ CE-MCP 4-layer security (MAESTRO 16 attack class coverage)
- ✅ iOS companion app (SwiftUI, iOS 17+) — dashboard, controls, assessments, evidence upload, push notifications
- ⚠️ Android companion app (Jetpack Compose, API 26+) — dashboard, auth, push notifications; Controls, Assessments, and Evidence screens are not yet implemented (tracked as follow-up, not at parity with iOS)

---

## Features

### Core Compliance Management
- **44 Frameworks** across federal, security, privacy, AI governance, and enterprise categories — NIST CSF 2.0, NIST Privacy Framework, NIST AI RMF, FISCAM, NIST 800-53, ISO 27001, SOC 2, NIST 800-171, CMMC 2.0, GDPR, HIPAA, HITECH, FFIEC, NERC CIP, PCI DSS v4.0, CIS Controls v8, COBIT 2019, FedRAMP High, FedRAMP Moderate, FINRA Supervisory Controls for AI, SEC AI Risk Management, SR 11-7 Model Risk Management, EU AI Act, ISO 42001, ISO 42005, ISO 27002, ISO 27005, ISO 27017, ISO 27018, ISO 27701, ISO 31000, CCPA/CPRA, State AI Governance, International AI Governance, OWASP LLM Top 10, OWASP Agentic AI Top 10, NIST SP 800-207 Zero Trust, and 7 ISO/IEC AI standards (23894, 38507, 22989, 23053, 5259, TR 24027, TR 24028)
- **NIST Publications Library (62 seeded references)** — Searchable NIST publication catalog with direct mappings to in-app controls and assessment tasks, available as optional best-practice guidance or mandatory baseline by organization profile
- **1,190+ Controls** with broad multi-framework coverage and crosswalk mappings
- **360+ Crosswalk Mappings** — Implement one control and automatically satisfy equivalent controls across frameworks
- **Custom Framework Builder** — create org-scoped frameworks with custom controls, clone from any seeded framework, and publish for org-wide use
- **Control Implementation Tracking** — Status workflow from Not Started to Implemented with assignment and due dates
- **Control Health Monitoring** — Real-time control health scores based on evidence age, assessment results, and implementation status
- **Control Exceptions** — Track and manage approved exceptions with expiry dates and risk acceptance rationale

### Assessment & Audit
- **2,000+ Assessment Procedures** based on NIST SP 800-53A, ISO 19011, AICPA SOC 2 Type II, HHS HIPAA Audit Protocol, GDPR/EDPB guidelines, and ISO/IEC AI standards
- **Three Assessment Depths** — Basic, Focused, and Comprehensive
- **Assessment Plans** — Create and track assessment campaigns with scheduling
- **Result Recording** — NIST-standard outcomes (Satisfied / Other Than Satisfied / Not Applicable)
- **Audit Logging** — Complete trail of all user actions
- **Auditor Workspace** — Dedicated external auditor portal with engagements, PBC requests, workpapers, findings, and sign-offs

### AI Insights (Optional)
- **Single AI Insights page** — Gap analysis, compliance forecast, audit readiness, and risk heatmap, generated on demand. No always-on chat copilot.
- **Inline assists on controls** — Generate test procedures, remediation playbooks, and evidence suggestions from a control's detail page when you want them.
- **Pending evidence AI scan** — Optional one-click scan that suggests evidence-to-control mappings, with human approval required before anything attaches.
- **Auditor workspace drafting** — AI-drafted PBC requests, workpaper narratives, and findings to speed up auditor prep, all reviewable.
- **AI is optional** — The platform works without any API key configured. Configure BYOK in Settings → AI Keys to enable insights.

### AI-Assisted Analysis (BYOK + Free Providers)
Bring Your Own Key support for Anthropic Claude, OpenAI, Google Gemini, xAI Grok, and Groq. Self-hosted Ollama support (no key required). Available analyses:

| Feature | Description |
|---------|-------------|
| Gap Analysis | Identifies compliance gaps across all adopted frameworks |
| Crosswalk Optimizer | Finds overlap opportunities to reduce duplicate work |
| Compliance Forecast | Predicts compliance trajectory and timeline to full coverage |
| Regulatory Monitor | Scans for regulatory changes affecting your frameworks |
| Remediation Playbook | Generates step-by-step remediation plans per control |
| Vulnerability Remediation | AI-generated fix guidance per vulnerability finding |
| Incident Response | Creates incident response plans by incident type |
| Executive Report | Produces board-ready compliance summary reports |
| Risk Heatmap | Maps risk levels across control families |
| Vendor Risk Assessment | Evaluates third-party vendor compliance risk |
| Audit Readiness | Scores preparedness for upcoming audits |
| Auditor PBC Draft | AI-drafted Provided-by-Client request lists for engagements |
| Auditor Workpaper Draft | AI-drafted workpaper narratives from assessment data |
| Auditor Finding Draft | AI-drafted audit findings with risk ratings and recommendations |
| Asset-Control Mapping | Links CMDB assets to relevant controls |
| Asset Risk Analysis | Evaluates individual asset risk posture |
| Shadow IT Detection | Identifies unmanaged technology risks |
| AI Governance Frameworks | Manage AI system compliance via dedicated frameworks (NIST AI RMF, EU AI Act, OWASP LLM Top 10) on the standard Frameworks page |
| Control Analysis | Deep-dive analysis of a single control's posture and gaps |
| Test Procedures Generator | Generates custom test procedures per control |
| Policy Generator | Drafts security and compliance policies from scratch |
| Compliance Q&A | Natural language queries about your compliance posture |
| Training Recommendations | Suggests role-based security awareness training |
| Evidence Suggestions | Recommends evidence to collect per control |
| AI Reasoning Memory | Persistent semantic memory — each analysis builds on past findings for increasingly accurate, context-aware compliance guidance |
| Organization RAG | Vector-based document retrieval (pgvector) — index policies, evidence, and procedures so AI responses are grounded in your actual artifacts via semantic search |

### Phase 6: Advanced AI-Powered Analysis
Next-generation AI capabilities for predictive analysis and automated compliance intelligence:

| Feature | Description |
|---------|-------------|
| **Predictive Risk Scoring** | Automated risk assessment with 0-100 scoring algorithm. Multi-factor weighted analysis (controls 40%, vulnerabilities 25%, evidence 20%, assessments 15%). Includes trend analysis, A-F grading, and 30/60/90-day predictions. |
| **Regulatory Impact Analysis** | AI-powered analysis of regulatory changes with impact scoring (0-100), effort estimation, affected systems identification, timeline analysis, and actionable recommendations. Critical/High/Medium/Low impact levels. |
| **Smart Remediation Plans** | Enhanced AI-generated remediation plans with priority scoring (0-100), timeline estimation, cost-benefit analysis, step-by-step action plans, and implementation tracking. Automatic risk reduction calculations. |

📊 **Risk Score Components:** Control Implementation (40%) + Vulnerability Management (25%) + Evidence Freshness (20%) + Assessment Coverage (15%)
🎯 **Impact Levels:** Critical (90-100) • High (70-89) • Medium (40-69) • Low (20-39) • Minimal (0-19)
⚡ **Priority Levels:** Critical (80-100) • High (60-79) • Medium (40-59) • Low (0-39)

See [PHASE_6_AI_POWERED_ANALYSIS.md](./PHASE_6_AI_POWERED_ANALYSIS.md) for complete documentation.

### Supported LLM Providers

| Provider | Key Required | Notes |
|----------|-------------|-------|
| Anthropic Claude | Yes (BYOK) | claude-opus-4-8, claude-sonnet-5, claude-haiku-4-5-20251001, claude-fable-5 |
| OpenAI | Yes (BYOK) | gpt-5.5, gpt-5.4-mini, gpt-5.4-nano, gpt-5.3-codex |
| Google Gemini | Yes (BYOK) | gemini-3.1-pro-preview, gemini-3.5-flash, gemini-3.1-flash-lite — free tier at aistudio.google.com |
| xAI Grok | Yes (BYOK) | grok-4.5, grok-4.3, grok-4.1-fast |
| Groq | Yes (BYOK) | openai/gpt-oss-120b, openai/gpt-oss-20b, groq/compound, groq/compound-mini, meta-llama/llama-4-scout-17b-16e-instruct — free tier at console.groq.com |
| Ollama | No key needed | Self-hosted local LLMs (llama3.2, llama3.1:8b, mistral, qwen2.5, phi3, gemma2, etc.) |

Configure providers in **Settings → LLM Configuration**. Each organization can set its own BYOK key per provider and choose the active model.

### Asset Management (CMDB)
- **Hardware** — Servers, workstations, network equipment
- **Software** — Applications, operating systems, middleware
- **AI Agents** — ML models, chatbots, automated decision systems (tracks AIBOM data)
- **Service Accounts** — Privileged and service credentials
- **Environments** — Production, staging, development
- **Password Vaults** — Credential management systems
- **Cross-Asset Relationship Linking** — Record dependencies between any two assets (e.g. software "hosted on" hardware, AI agent "uses" database); bidirectional view with relationship type (`uses`, `requires`, `hosted_on`, `communicates_with`) and criticality badges; accessible via the 🔗 Links button on each asset row

#### Advanced CMDB Features (available to all users)
- **Asset Risk Scoring** — Per-asset composite risk score aggregated from linked vulnerabilities and open control gaps
- **Bulk CSV Import/Export** — Import assets in bulk from spreadsheets; export full inventory for offline review
- **Asset Change History** — 90-day audit trail of every field change (who changed what, when)
- **AI-Suggested Relationships** — AI recommends likely dependencies based on hostname, IP range, and category
- **Dependency Graph Visualisation** — Interactive SVG network map showing all assets and their relationships at a glance (`/dashboard/cmdb/dependency-map`)
- **CMDB Health Dashboard** — Detects stale assets, unlinked critical assets, missing owners, and upcoming rotation expirations
- **Auto-Discovery Webhooks** — Receive asset discovery events from Nmap, Qualys, Tenable, and custom scanners
- **Custom Asset Fields** — Extend any asset type with org-specific metadata fields (e.g. cost centre, BIA impact rating, data residency)
- **Financial Services Compliance Workspace** — Reg BI alignment checks, SR 11-7 model inventory, FINRA supervisory audit trail input, and SEC explainability narrative generation (`/dashboard/cmdb/financial-services-workspace`)

### 🔒 CE-MCP Security (Code Execution MCP)
Four-layer defense for AI agent code execution:
1. **Static Analysis** (50ms) — AST-based pattern detection, complexity limits, injection prevention
2. **Semantic Gating** (200ms) — Intent-code alignment, permission validation, data access patterns
3. **Sandbox Execution** (500ms) — Docker containers with read-only FS, network isolation, resource limits
4. **Output Sanitization** (20ms) — Sensitive data filtering, exception sanitization, audit redaction

**MAESTRO Attack Class Coverage:** All 16 attack classes mitigated (exception-mediated injection, authorization corruption, sandbox escapes, resource exhaustion, data exfiltration, and 11 more).
**Performance:** 40-60% faster than traditional MCP (-65% token usage, -75% interaction turns).

See [`controlweave/docs/CE_MCP_SECURITY_GUIDE.md`](./controlweave/docs/CE_MCP_SECURITY_GUIDE.md) and [`controlweave/docs/MAESTRO_CEMCP_GUIDANCE.md`](./controlweave/docs/MAESTRO_CEMCP_GUIDANCE.md).


### 📦 SBOM / AIBOM Management
- **Software Bill of Materials (SBOM)** — Upload and manage SBOM files per software asset (CycloneDX)
- **AI Bill of Materials (AIBOM)** — Track AI/ML system inventories with model metadata, training data provenance, and governance attributes
- **Vulnerability cross-referencing** — Link SBOM components to CVEs and vulnerability findings

### Vulnerability Management
- **Vulnerability tracking** — Log and manage security vulnerability findings
- **Severity classification** — CVSS-based severity scoring (Critical, High, Medium, Low)
- **Asset linking** — Associate vulnerabilities with CMDB assets
- **AI remediation guidance** — One-click AI-drafted fix plans per finding
- **Status workflow** — Open → In Progress → Remediated → Accepted

### Plan of Action & Milestones (POA&M)
- **POA&M tracking** — Track open findings with milestones, owners, and target dates
- **Control linkage** — Associate POA&M items with specific controls
- **Status reporting** — Export POA&M status for federal and regulatory reporting

### Evidence Management
- **File Upload** — Attach evidence documents to controls
- **Tagging & Search** — Organize evidence with tags and full-text search
- **Control Linking** — Link evidence to one or more controls
- **Download** — Retrieve evidence files for audit preparation
- **Retention policy** — Configurable evidence retention (default 365 days)
- **Splunk Import Plugin** — Pull SIEM search results into Evidence as integrity-tracked JSON artifacts

### Data Governance
- **Data classification** — Track data types (PII, PHI, PCI, CUI, FCI, etc.) per asset and organization
- **Data sensitivity profiles** — Organization-level data sensitivity configuration set at registration
- **NIST Privacy Framework** — Full framework support for privacy control tracking

### Licensed Content Packs
- **Report → Draft → Attest → Import Flow** — Upload report, parse and AI-draft pack, attest licensing rights, optional approval gate, then import
- **Customer-Provided Pack Import** — Import licensed framework content per organization (no global overwrite)
- **Org-Scoped Overrides** — Override control/procedure text only for that tenant
- **Reversible Activation** — Remove a pack and cleanly remove only overrides sourced by that pack

### Dashboard & Reporting
- **Compliance Overview** — Overall compliance percentage across all frameworks
- **Framework Progress** — Per-framework compliance breakdown with visual charts
- **Priority Actions** — Critical controls requiring immediate attention
- **Recent Activity** — Live feed of compliance actions
- **Compliance Trend** — Historical compliance trajectory
- **Executive Summary Dashboard** — Cross-framework compliance scores, period-selectable trend sparklines (30/90/180/365 days), and per-framework compliance bars at `/dashboard/reports/executive`
- **Compliance Snapshots** — Daily background job writes per-org per-framework compliance percentages for historical trending (run `node scripts/snapshot-compliance.js`)
- **Scheduled Report Delivery** — Configure daily/weekly/monthly/quarterly PDF, CSV, or JSON report jobs with email recipients; manual trigger available
- **Custom Dashboard Builder** — Drag-and-drop widget layout per user
- **PDF/Excel Reports** — Generate audit-ready reports for stakeholders
- **AI Insights Page** — Optional, on-demand AI analysis (gap analysis, compliance forecast, audit readiness, risk heatmap) on a dedicated page

### User & Access Management
- **Role-Based Access Control** — Admin, Auditor, Viewer, and custom roles with granular permission sets
- **JWT Authentication** — Secure token-based auth with refresh flow
- **Account Lockout** — Automatic per-account lockout after N failed login attempts (configurable, default 5 attempts / 15-minute lockout)
- **Password Recovery** — Forgot/reset password flow with expiring one-time reset links
- **OAuth + SSO** — Social OAuth (Google, Microsoft, Apple, GitHub) and organization SSO (OIDC)
- **Organization Multi-Tenancy** — Isolated data per organization
- **MSP Parent-Child Org Hierarchy** — Parent organizations manage multiple child orgs; per-child compliance summaries; delegated admin grants with optional expiry (`/dashboard/platform/managed-orgs`)

### Notifications & Reminders
- **Event-driven notifications** — Control verified, POA&M created, control due, assessment needed, crosswalk updates
- **Per-user preferences** — Each user controls in-app and email delivery per notification type (Settings → Notifications tab)
- **Email delivery** — Optional SMTP delivery; gracefully disabled if `SMTP_HOST` is not set
- **Reminder scheduler** — Background job for due-date reminders (default 60-minute interval)
- **Notification center** — Full inbox at `/dashboard/notifications` with filtering and mark-as-read

### AI Accountability & Auditability
- **Per-call log** — Org, user, feature, provider, model, BYOK status, tokens in/out, duration, success/failure, IP
- **Decision log** — SHA-256 hash of inputs and outputs; records model version, correlation ID, session ID, and regulatory framework mapping
- **Bias tracking** — Heuristic bias detection flags potential issues in executive reports, vendor risk, and remediation playbooks
- **EU AI Act readiness** — Bias coverage metrics in `/ai/status`: decisions with flags, flags reviewed, high-risk unreviewed
- **Human review workflow** — Admins approve/reject/flag AI decisions and record outcomes (Settings → AI Decisions tab)
- **Org-shared BYOK** — One API key configured by admin is available to all org members

### Webhooks & Integrations
- **Outbound webhooks** — Trigger HTTP callbacks on platform events (control updates, assessment completions, evidence uploads)
- **Webhook delivery queue** — Async delivery with retry logic and delivery history
- **Splunk connector** — Pull SIEM search results as integrity-tracked evidence artifacts
- **AWS Security Hub** — Poll findings and map AWS severity labels to ControlWeaver control status
- **Qualys VMDR** — Pull vulnerability detections and map QID severity (1–5) to control findings
- **ITSM / Change Management** — Sync incident and change records and link closed changes to control implementation evidence
- **Integrations Hub** — Central page for managing all active connectors and API tokens (15 connector types)

### Operations & Platform Management
- **Job queue** — Background async job runner for long-running tasks (reports, AI analysis caching, retention)
- **Retention cleanup** — Automated evidence retention enforcement
- **Capacity monitoring** — DB size, connection utilization, and row count thresholds (`npm run db:capacity`)
- **Dynamic config** — Runtime feature flags and platform config without redeployment
- **Performance monitoring** — Real-time request tracking, response time metrics, database performance, and system resource monitoring for Railway deployments (see [PERFORMANCE_MONITORING.md](./PERFORMANCE_MONITORING.md))

### MCP Integration
- **Model Context Protocol server** — Connect the platform to any MCP-compatible client via the universal stdio transport: Claude Desktop (`@controlweave`), Cursor, VS Code + GitHub Copilot, Continue.dev, Windsurf, or any custom/programmatic integration
- **Tool-based access** — Query compliance posture, controls, assessments, notifications, and AI Q&A through MCP tools

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend** | Next.js 16+ (React 19), TypeScript, Tailwind CSS, Recharts, Lucide React |
| **Backend** | Node.js 20+, Express.js |
| **Database** | PostgreSQL 17+ (primary), Redis (optional Socket.IO adapter for multi-instance real-time) |
| **Auth** | JWT (jsonwebtoken), bcryptjs (14 rounds), WebAuthn (@simplewebauthn), OpenID Connect (openid-client) |
| **Payments** | None — ControlWeaver is fully open source; billing infrastructure removed in v4.0 |
| **Emails** | nodemailer (SMTP-compatible — works with SendGrid, SES, Mailgun, Resend, etc.) |
| **File handling** | multer (uploads), pdf-parse, mammoth (DOCX), exceljs, pdfkit |
| **Real-time** | Socket.IO with Redis adapter (@socket.io/redis-adapter) |
| **AI — Hosted** | Anthropic Claude SDK, OpenAI SDK, Google Gemini REST API, xAI Grok API, Groq API |
| **AI — Self-hosted** | Ollama (OpenAI-compatible, local) |
| **MCP** | @modelcontextprotocol/sdk (Claude Desktop, Cursor, VS Code Copilot, Continue.dev) |
| **Integrations** | Splunk REST API, webhooks, RSS feeds, Zod (MCP tool + SDK schemas) |
| **Security** | Rate limiting (express middleware), CORS, sanitize-html, bcryptjs (14 rounds), manually configured security headers (CSP, HSTS, X-Frame-Options) |
| **Deployment** | Railway (primary), Docker (backend + frontend Dockerfiles), nixpacks |
| **DevOps** | Docker, GitHub Actions CI (lint, typecheck, TEVV, security scan) |
| **Search** | PostgreSQL ILIKE-based search (controls, assets, evidence, vendors) |
| **Charts** | Recharts |
| **Response compression** | compression (gzip/deflate) |

> **Short answer: yes, we have the stack.** See [`SAAS_STACK.md`](./SAAS_STACK.md) for a full category-by-category breakdown covering all 18 reference categories: Frontend, Backend, Database, Auth, Payments, Emails, Storage, Deployment, Domains and DNS, Analytics, Monitoring, DevOps, Search, AI Integration, Integrations, Security, Marketing, and Customer Support.

---

## Architecture

```
ControlWeaver-Pro/
├── controlweave/
│   ├── backend/                    # Express.js REST API (Node.js 18+)
│   │   ├── src/
│   │   │   ├── server.js           # Entry point (port 3001)
│   │   │   ├── config/             # Database (PostgreSQL 17+), security
│   │   │   ├── middleware/         # JWT auth, RBAC, rate limiting, validation
│   │   │   ├── routes/             # 70+ route modules (AI, controls, CMDB, custom frameworks, reports…)
│   │   │   └── services/           # LLM abstraction, SBOM, Stripe, jobs, webhooks
│   │   ├── migrations/             # SQL migrations up to 101 (applied in lexicographic order)
│   │   └── scripts/                # Seeding, QA, MCP server, AIBOM generator
│   ├── frontend/                   # Next.js 16+ (TypeScript, Tailwind CSS)
│   │   └── src/
│   │       ├── app/                # App Router pages (dashboard, frameworks, AI…)
│   │       │   ├── dashboard/
│   │       │   │   ├── controls/       # Controls list + detail
│   │       │   │   ├── assessments/    # Assessment management + AI panel
│   │       │   │   ├── frameworks/     # Frameworks, mappings, custom builder
│   │       │   │   │   └── custom/     # Custom framework builder
│   │       │   │   ├── evidence/       # Evidence management
│   │       │   │   ├── assets/         # CMDB asset views
│   │       │   │   ├── vulnerabilities/# Vulnerability tracking + AI remediation
│   │       │   │   ├── sbom/           # SBOM / AIBOM management
│   │       │   │   ├── audit/          # Audit log viewer
│   │       │   │   ├── auditor-workspace/ # External auditor portal
│   │       │   │   ├── reports/        # Report generation, executive analytics
│   │       │   │   │   └── executive/  # Cross-framework executive dashboard
│   │       │   │   ├── platform/
│   │       │   │   │   └── managed-orgs/ # MSP org hierarchy management
│   │       │   │   ├── operations/     # Platform ops & job queue
│   │       │   │   └── settings/       # LLM config, content packs, webhooks
│   │       │   ├── login/
│   │       │   └── register/
│   │       ├── components/         # DashboardLayout, Sidebar, ai/ (insight widgets)
│   │       ├── contexts/           # React context providers (Auth, etc.)
│   │       └── lib/                # API client, access control, billing
│   ├── mobile/                     # Native mobile companion apps
│   │   ├── ios/ControlWeave/       # SwiftUI app (iOS 17+, Xcode 15+)
│   │   │   └── ControlWeave/
│   │   │       ├── App/            # AppDelegate, main entry, Info.plist
│   │   │       ├── Core/           # Network (APIClient, endpoints), services, token mgmt
│   │   │       ├── Features/       # Dashboard, Controls, Assessments, Evidence, Notifications
│   │   │       │   └── License/    # RevenueCat IAP (Pro upgrade flow)
│   │   │       ├── Shared/         # BannerAdView, Date+Formatting, reusable components
│   │   │       └── PrivacyInfo.xcprivacy  # Apple privacy manifest
│   │   └── android/ControlWeave/   # Jetpack Compose app (Android API 26+, Kotlin)
│   │       └── app/src/main/
│   │           ├── kotlin/com/controlweave/app/
│   │           │   ├── core/       # ApiClient (OkHttp + Retrofit), token storage
│   │           │   ├── features/   # Dashboard, Controls, Assessments, Evidence, Notifications
│   │           │   ├── shared/     # BannerAdView (AdMob), reusable composables
│   │           │   └── fcm/        # FirebaseMessagingService for push
│   │           └── AndroidManifest.xml
│   └── marketing/                  # Marketing landing page (static HTML/CSS)
├── .openclaw/                      # Internal engineering agent team
│   └── agents/                     # Specialized AI agents for platform development
├── docs/                           # Documentation
│   ├── OPEN_SOURCE_BUSINESS_MODEL.md
│   ├── FRAMEWORK_COVERAGE.md
│   ├── CROSSWALK_GUIDE.md
│   ├── HOW_CROSSWALKS_WORK.md
│   └── DATABASE_ARCHITECTURE.md
└── .github/workflows/              # CI/CD pipeline (20 workflows)
```

---

## Mobile Companion Apps

ControlWeave ships native iOS (SwiftUI) and Android (Jetpack Compose) companion apps that give compliance teams on-the-go access to dashboards, controls, assessments, and evidence capture directly from their devices.

### Features

| Capability | iOS | Android |
|---|---|---|
| JWT authentication with TOTP 2FA | ✅ | ✅ |
| Dashboard overview (score, recent activity) | ✅ | ✅ |
| Controls list with pagination and search | ✅ | ✅ |
| Assessments view | ✅ | ✅ |
| Evidence capture (photo picker with HEIC/PNG/WebP/JPEG) | ✅ | ✅ |
| Push notifications (APNs / FCM) | ✅ | ✅ |
| Keychain / EncryptedSharedPreferences token storage | ✅ | ✅ |

### Backend Integration

The mobile apps consume the same REST API as the web frontend (`/api/v1`). Two endpoints were added specifically for mobile:

- `POST /api/v1/push-tokens` — registers/reassigns a device push token; uniqueness is enforced at the token level to prevent cross-account push delivery on shared devices
- `DELETE /api/v1/push-tokens/:token` — removes a push token at logout
- `POST /api/v1/billing/mobile-upgrade` — stub endpoint (billing is no longer active; returns 410)

Push delivery is handled by `pushService.js`. FCM (Android) is managed by `firebase-admin`, which is declared as an `optionalDependency` and installed automatically. APNs (iOS) is managed by `apn`, which must be installed manually for production because `apn` v2.x pins `node-forge@^0.7.1` and `jsonwebtoken@^8.x` — both have unfixed high-severity CVEs that would fail the CI audit gate. The service detects and uses `apn` automatically once it is installed; without it, only Android FCM push is delivered.

```bash
# Enable iOS push in production after auditing the dependency:
# Use --no-save to avoid it being committed back to package.json.
# Add this line to your Railway/Docker/systemd start script so it
# runs after "npm ci" in every deployment:
npm install --no-save apn
```

### Security Architecture

- **Token storage**: iOS uses `SecItemAdd`/`SecItemCopyMatching` (Keychain); Android uses `EncryptedSharedPreferences` (AES-256-GCM)
- **Push tokens**: globally unique constraint (`UNIQUE (token)` on `device_push_tokens`); new login reassigns token to current user, preventing stale delivery to prior accounts on shared devices
- **RevenueCat IAP**: the `revenueCatAppUserId` sent to the backend is derived from `req.user.id` server-side, not the mobile client — closing the cross-account subscription elevation vector
- **Token refresh**: Android OkHttp `Authenticator` guards against infinite 401 retry loops and validates the refresh response before rebuilding the request

### App Store / Play Store Compliance

The apps are structured to meet App Store Review and Google Play requirements out of the box:

**iOS**
- `Info.plist` includes `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription`, `NSUserTrackingUsageDescription`, and `NSFaceIDUsageDescription`
- `NSPrivacyPolicyURL` set to `https://controlweave.com/privacy` (replace with live URL before submission)
- `PrivacyInfo.xcprivacy` declares all collected data types (Device ID for ad targeting, Product Interaction for analytics) and accessed API categories (UserDefaults, File timestamp)
- `NSAppTransportSecurity` has `NSAllowsArbitraryLoads = false` (HTTPS only)
- `ITSAppUsesNonExemptEncryption = false` (uses only OS-provided TLS)
- ATT opt-in prompt (`ATTrackingManager`) requested before showing AdMob ads

**Android**
- `targetSdk = 35` (Android 15) and `minSdk = 26` (Android 8.0)
- `android:usesCleartextTraffic="false"` enforces HTTPS
- `android:networkSecurityConfig="@xml/network_security_config"` provides an auditable, explicit HTTPS-only policy with debug-only user-CA trust anchors
- `android:supportsRtl="true"` for right-to-left layout support
- All sensitive permissions declared: `CAMERA`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `POST_NOTIFICATIONS`, `AD_ID`
- ProGuard/R8 enabled for release builds (`isMinifyEnabled = true`)

### Environment Variables (Push Notifications)

```bash
# APNs (iOS push) — optional; push silently disabled if unset
APNS_KEY_ID=          # 10-character key ID from Apple Developer
APNS_TEAM_ID=         # 10-character Team ID
APNS_KEY_PATH=        # Path to AuthKey_XXXX.p8 file
APNS_BUNDLE_ID=       # com.controlweave.app (or your bundle ID)
APNS_PRODUCTION=true  # false for sandbox/TestFlight

# FCM (Android push) — optional; push silently disabled if unset
FCM_SERVICE_ACCOUNT=  # JSON string (or path) of Firebase service account key
```

---

## Supported Frameworks

See [`docs/FRAMEWORK_COVERAGE.md`](./docs/FRAMEWORK_COVERAGE.md) for the full list with control counts, implementation priority by industry, and crosswalk coverage statistics.

All 40 frameworks are available to all users — no license key or subscription required:

**Core Compliance:** NIST CSF 2.0 · NIST SP 800-53 Rev 5 · NIST SP 800-171 · NIST AI RMF 1.0 · ISO/IEC 27001:2022 · SOC 2 TSC · CMMC 2.0 · NIST SP 800-207 (Zero Trust) · FISCAM

**Regulatory & Industry:** HIPAA/HITECH · GDPR · CCPA/CPRA · EU AI Act · NERC CIP · FFIEC · OWASP Top 10:2025 · OWASP LLM Top 10 · OWASP Agentic AI Top 10 · MAESTRO

**AI & ISO/IEC Standards:** ISO 42001 · ISO 42005 · ISO/IEC 23894 · ISO/IEC 38507 · ISO/IEC 22989 · ISO/IEC 23053 · ISO/IEC 5259 · ISO/IEC TR 24027 · ISO/IEC TR 24028 · ISO/IEC TR 24368

**Financial Services:** FINRA Notice 24-09 · SEC AI Risk Management · SR 11-7 (Federal Reserve / OCC)

**AI Regulatory Monitoring** — The platform can monitor selected privacy and regional frameworks for upcoming regulatory changes, new compliance requirements, enforcement deadlines, and emerging state and international laws. Powered by the configured LLM provider via the existing `regulatoryMonitor` API.

**Master Context & Provider Handoff** — Every AI call is injected with a dynamically-built organization context prompt (`orgContextService.js`) that includes industry, frameworks, compliance posture, CIA baseline, deployment model, cloud providers, data sensitivity types, asset inventory, and open vulnerabilities. When a user switches LLM providers in Settings, cached API keys are immediately invalidated and the next AI call sends the full context to the new provider — zero reconfiguration required.

---

## Positioning Guardrails

- Build as an orchestration layer (not a closed monolith): prioritize connectors, APIs, and MCP interfaces.
- Keep evidence automation as a core wedge: ingestion, integrity checks, linkage, and audit-ready exports.
- Maintain independent UX and product language; avoid reproducing competitor-specific flows verbatim.
- Optimize for mid-market speed-to-audit and operator productivity.

Detailed guardrails: [controlweave/docs/POSITIONING_GUARDRAILS.md](controlweave/docs/POSITIONING_GUARDRAILS.md)

---

## Quick Start

```bash
# Clone
git clone https://github.com/sherifconteh-collab/ControlWeaver-Pro.git
cd ControlWeaver-Pro

# Backend setup
cd controlweave/backend
npm install
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, and optionally LLM provider keys
npm run migrate
npm run seed:demo-full   # optional: seed demo data

# Start backend (port 3001)
npm run dev

# Frontend setup (new terminal)
cd controlweave/frontend
npm install
cp .env.example .env.local
# Edit .env.local: set NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
npm run dev              # port 3000
```

**Demo login** (after seeding): `admin@enterprise.com` / `ControlWeave!2026`

> For full setup including database configuration and Railway deployment, see [`controlweave/QUICK_START.md`](./controlweave/QUICK_START.md).

---

## Self-Hosted Installation & Downloads

ControlWeaver is fully open source under AGPL v3. Clone and run from source — no account, credit card, or license key required. Every feature is available out of the box.

### Platform Downloads

| Platform | Download | Notes |
|----------|----------|-------|
| **Windows** | [`.exe` installer](https://github.com/sherifconteh-collab/ai-grc-platform/releases/latest) | x64, Windows 10/11, Server 2019+ |
| **macOS** | [`.dmg`](https://github.com/sherifconteh-collab/ai-grc-platform/releases/latest) | Intel & Apple Silicon (arm64) |
| **Linux** | [`AppImage`](https://github.com/sherifconteh-collab/ai-grc-platform/releases/latest) | Debian, Ubuntu, RHEL, Alpine |
| **Docker** | [`ghcr.io/sherifconteh-collab/ai-grc-platform:latest`](https://github.com/orgs/sherifconteh-collab/packages/container/package/ai-grc-platform) | amd64 / arm64 |
| **Source** | Clone this repo | Full build instructions in `QUICK_START.md` |

All releases and changelogs: [github.com/sherifconteh-collab/ai-grc-platform/releases](https://github.com/sherifconteh-collab/ai-grc-platform/releases)

### What You Get Out of the Box

A fresh self-hosted install gives you everything — no license key required:

- All 44 compliance frameworks, 1,190+ controls, 97 crosswalk mappings
- Full evidence management, CMDB, SBOM/AIBOM, TPRM, POA&M, RMF Lifecycle, auditor workspace
- AI-assisted compliance analysis (BYOK — bring your own LLM key)
- Multi-org management, SSO, webhooks, MCP server
- Full source code — audit every line

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Security
JWT_SECRET=your-long-random-secret-here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Account lockout (optional, defaults shown)
LOCKOUT_MAX_ATTEMPTS=5
LOCKOUT_DURATION_MS=900000   # 15 minutes

# Platform-level LLM fallback keys (optional — users can BYOK in Settings)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434/v1   # for self-hosted Ollama

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_APP_NAME=ControlWeaver-Pro
```

---

## Demo Data

From `controlweave/backend/`:

```bash
npm run seed:cmdb-demo           # Seed CMDB sample assets
npm run seed:demo:cmdb-tiered    # Seed tier-aware CMDB data across all demo orgs
npm run seed:showcase-demo       # Seed showcase compliance data
npm run seed:demo:hf             # Import Hugging Face vulnerability findings for all demo tiers
npm run seed:vuln-upload-samples # Generate upload samples for .nessus/.ckl/.xml/.sarif/.json/.fpr/.zip
npm run seed:demo-full           # Seed all demo data
```

Automated weekly refresh:
- GitHub Actions workflow: `.github/workflows/weekly-demo-hf-seed.yml`
- Schedule: every Sunday at 03:00 UTC
- Seeds Hugging Face findings for all demo admin accounts (after ensuring demo accounts exist)
- Requires repository secrets for database connectivity (`DATABASE_URL` or `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`)

---

## Operational Commands

From `controlweave/backend/`:

```bash
npm run migrate              # Run pending database migrations
npm run db:backup            # Backup database (pg_dump)
npm run db:capacity          # Check DB size/connection/row thresholds
npm run audit:check          # Run npm audit (moderate+ severity)
npm run mcp:login            # Sign in for per-user MCP session auth
npm run mcp:status           # Show current MCP session identity/status
npm run mcp:logout           # Clear local MCP session auth
npm run mcp                  # Start MCP server
npm run mcp:secure           # Start secure MCP server (recommended for production)
```

For small-start production deployment: [controlweave/docs/SMALL_START_DEPLOYMENT_PROFILE.md](controlweave/docs/SMALL_START_DEPLOYMENT_PROFILE.md)

For private-to-public mirroring: [controlweave/docs/PUBLIC_MIRROR_SETUP.md](controlweave/docs/PUBLIC_MIRROR_SETUP.md)

---

## QA Runner

From `controlweave/backend/`, run the dynamic end-to-end QA orchestrator:

```bash
npm run qa:e2e:dynamic              # Core dynamic test suites
npm run qa:e2e:dynamic:all          # All suites (syntax + mega + dynamic + auditor + legacy)
npm run qa:e2e:auditor              # Auditor workflow suite only
```

The auditor suite validates the full auditor workflow:
- Create engagement → PBC request → workpaper → finding → sign-off → public workspace payload → audit log linkage

Optional controls:
- `QA_DYNAMIC_SUITES` — choose suites (comma-separated: `syntax,mega,dynamic,auditor,legacy`)
- `QA_DYNAMIC_FAIL_FAST=true` — stop on first failing suite

---

## IP Hygiene Check

CI runs an automated hygiene check to reduce product copy/IP risk:

```bash
npm run check:ip-hygiene
IP_HYGIENE_FAIL_ON_STANDARDS=true npm run check:ip-hygiene  # strict mode
```

---

## MCP Server

### Standard MCP Server

```bash
npm run mcp
```

### Secure MCP Server (Recommended for Production)

```bash
npm run mcp:secure
```

**Security Features:**
- ✅ Rate limiting (30 req/min per tool by default)
- ✅ Comprehensive audit logging
- ✅ Input validation and sanitization
- ✅ Request timeouts
- ✅ Output data minimization
- ✅ Secure error handling
- ✅ OWASP best practices compliance

**Required environment:**
- `GRC_API_BASE_URL` (default: `http://localhost:3001/api/v1`)
- `GRC_API_TOKEN` (JWT access token)

**Optional security configuration:**
- `MCP_RATE_LIMIT` — Requests per minute per tool (default: 30)
- `MCP_REQUEST_TIMEOUT_MS` — Request timeout in ms (default: 30000)
- `MCP_ENABLE_AUDIT_LOG` — Enable audit logging (default: true)
- `MCP_MAX_INPUT_LENGTH` — Max input length in characters (default: 10000)
- `MCP_MAX_RESULT_LIMIT` — Max results per query (default: 200)
- `NODE_ENV` — Set to `production` to disable verbose errors

**Available MCP tools (51 total):**
- **System & Auth:** Health checks, user authentication
- **Compliance:** Frameworks, controls, assessments, crosswalk mappings, AI Q&A, crosswalk inheritance trigger
- **Evidence Management:** List, get, link/unlink, update evidence
- **Asset/CMDB:** Create, list, get, update, delete assets (hardware, software, AI agents)
- **POA&M:** List, get, create, update plan-of-action items
- **Reports:** List report types, generate compliance reports
- **Exceptions:** List and create compliance exceptions
- **Audit Logs:** List logs, get statistics
- **TPRM:** List/get/create vendors, questionnaires, programme summary
- **Third-Party AI Governance:** AI vendor assessments, incidents, supply chain components
- **Threat Intelligence:** Stats summary, list CVEs/indicators with CVSS/exploit filtering
- **Help Center:** List and retrieve in-app help articles

MCP authentication policy: login-based only via `npm run mcp:login`. Applies to all users, including admins.

**Documentation:**
- Complete tool catalog: [`controlweave/docs/MCP_TOOLS_REFERENCE.md`](./controlweave/docs/MCP_TOOLS_REFERENCE.md)
- Security guide: [`controlweave/docs/MCP_SECURITY_GUIDE.md`](./controlweave/docs/MCP_SECURITY_GUIDE.md)
- Deployment checklist: [`controlweave/docs/MCP_DEPLOYMENT_CHECKLIST.md`](./controlweave/docs/MCP_DEPLOYMENT_CHECKLIST.md)
- Detailed setup: [`controlweave/docs/MCP_SETUP.md`](./controlweave/docs/MCP_SETUP.md)

---

## API Reference

Base URL: `http://localhost:3001/api/v1`

All endpoints (except `/auth/*`) require `Authorization: Bearer <token>` header.

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Create account + organization |
| POST | /auth/login | Login, receive JWT (with account lockout) |
| POST | /auth/forgot-password | Request one-time password reset link |
| POST | /auth/reset-password | Reset password with valid token |
| POST | /auth/refresh | Refresh access token |
| POST | /auth/logout | Invalidate session |
| GET | /auth/me | Get current user + org context |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /settings/llm | Get BYOK LLM settings + active provider/model |
| PUT | /settings/llm | Update BYOK LLM settings (provider, model, API key) |
| POST | /settings/llm/test | Validate a provider API key |
| DELETE | /settings/llm/:provider | Remove provider API key |
| GET | /settings/content-packs | List imported licensed content packs |
| POST | /settings/content-packs/drafts/upload | Upload report + generate AI-assisted draft |
| POST | /settings/content-packs/drafts/:id/attest | Record mandatory licensing attestation |
| POST | /settings/content-packs/drafts/:id/import | Import draft after attestation |
| DELETE | /settings/content-packs/:id | Remove imported pack and its overrides |

### Frameworks & Controls
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /frameworks | List all frameworks |
| GET | /organizations/:orgId/controls | List controls by org |
| GET | /controls/:id | Get control detail |
| GET | /controls/:id/mappings | Get crosswalk mappings |
| PUT | /controls/:id/implementation | Update implementation status |
| GET | /frameworks/nist-publications | List NIST publication references |
| GET | /frameworks/nist-publications/coverage | Publication coverage heatmap |

### Assessments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /assessments/procedures | List assessment procedures |
| GET | /assessments/procedures/by-control/:controlId | Procedures for a control |
| POST | /assessments/results | Record assessment result |
| GET | /assessments/stats | Assessment statistics |
| POST | /assessments/plans | Create assessment plan |

### AI Insights (Optional, BYOK)
The endpoints below back the AI Insights page and the inline assists scattered across control detail, evidence, and auditor workspace pages. All endpoints require `ai.use` permission and a configured LLM key.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /ai/status | Current LLM provider status + usage |
| POST | /ai/gap-analysis | Run compliance gap analysis |
| POST | /ai/crosswalk-optimizer | Find crosswalk opportunities |
| POST | /ai/compliance-forecast | Forecast compliance trajectory |
| POST | /ai/regulatory-monitor | Monitor regulatory changes |
| POST | /ai/remediation/:controlId | Generate remediation playbook |
| POST | /ai/remediation/vulnerability/:id | Generate vulnerability fix plan |
| POST | /ai/incident-response | Create incident response plan |
| POST | /ai/executive-report | Generate board-ready report |
| POST | /ai/risk-heatmap | Generate risk heatmap |
| POST | /ai/vendor-risk | Assess vendor compliance risk |
| POST | /ai/audit-readiness | Score audit preparedness |
| POST | /ai/audit/pbc-draft | Draft PBC request list |
| POST | /ai/audit/workpaper-draft | Draft audit workpaper |
| POST | /ai/audit/finding-draft | Draft audit finding |
| POST | /ai/asset-control-mapping | Map assets to controls |
| POST | /ai/analyze/asset/:id | Analyze individual asset risk |
| POST | /ai/shadow-it | Detect shadow IT risk |
| POST | /ai/ai-governance | Assess AI system governance |
| POST | /ai/analyze/control/:id | Deep-dive control analysis |
| POST | /ai/test-procedures/:controlId | Generate test procedures |
| POST | /ai/generate-policy | Draft a security policy |
| POST | /ai/query | Natural language compliance Q&A |
| POST | /ai/training-recommendations | Suggest role-based training |
| POST | /ai/evidence-suggest/:controlId | Recommend evidence per control |

### Phase 6: Advanced AI Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /phase6/risk-score/calculate | Calculate predictive risk score (0-100) |
| GET | /phase6/risk-score/latest | Get latest risk score with trend |
| GET | /phase6/risk-score/history | Get risk score history for trending |
| POST | /phase6/regulatory-impact/analyze | Analyze regulatory change impact |
| GET | /phase6/regulatory-impact/assessments | List impact assessments |
| PUT | /phase6/regulatory-impact/assessments/:id/review | Review/approve assessment |
| POST | /phase6/remediation/generate | Generate smart remediation plan |
| GET | /phase6/remediation/plans | List remediation plans |
| PUT | /phase6/remediation/plans/:id/status | Update plan status |
| POST | /phase6/analyze/comprehensive | Run all Phase 6 analyses |

### Evidence
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /evidence | List evidence with filters |
| POST | /evidence/upload | Upload evidence file |
| POST | /evidence/:id/link | Link evidence to controls |
| DELETE | /evidence/:id | Delete evidence item |

### Vulnerability Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /vulnerabilities | List vulnerabilities |
| POST | /vulnerabilities | Create vulnerability |
| PUT | /vulnerabilities/:id | Update vulnerability |
| DELETE | /vulnerabilities/:id | Delete vulnerability |

### SBOM / AIBOM
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /sbom | List SBOM entries |
| POST | /sbom/upload | Upload SBOM file |
| GET | /sbom/:id | Get SBOM detail |
| DELETE | /sbom/:id | Delete SBOM entry |

### Auditor Workspace
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /audit/engagements | List auditor engagements |
| POST | /audit/engagements | Create engagement |
| GET | /audit/engagements/:id/pbc | List PBC requests |
| POST | /audit/engagements/:id/pbc | Create PBC request |
| POST | /audit/engagements/:id/workpapers | Create workpaper |
| POST | /audit/engagements/:id/findings | Create finding |
| POST | /audit/engagements/:id/sign-off | Record sign-off |

### CMDB Assets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /cmdb/:type | List assets by type |
| POST | /cmdb/:type | Create asset |
| PUT | /cmdb/:type/:id | Update asset |
| DELETE | /cmdb/:type/:id | Delete asset |
| GET | /cmdb/assets | All assets across all categories |
| GET | /cmdb/relationships?asset_id=:id | List inbound and outbound relationships for an asset |
| POST | /cmdb/relationships | Create a cross-asset relationship |
| DELETE | /cmdb/relationships/:id | Remove a cross-asset relationship |

Types: `hardware`, `software`, `ai-agents`, `service-accounts`, `environments`, `password-vaults`

### Integrations (Splunk)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /integrations/splunk | Get Splunk connector settings |
| PUT | /integrations/splunk | Save Splunk connector settings |
| POST | /integrations/splunk/test | Validate Splunk connection |
| POST | /integrations/splunk/import-evidence | Import Splunk search results as evidence |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /webhooks | List configured webhooks |
| POST | /webhooks | Create webhook |
| PUT | /webhooks/:id | Update webhook |
| DELETE | /webhooks/:id | Delete webhook |
| GET | /webhooks/:id/deliveries | View delivery history |

### Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /ops/overview | Admin ops summary (usage, queue health, failures) |
| GET | /ops/jobs | List queued/running/completed/failed jobs |
| POST | /ops/jobs | Enqueue a job |
| POST | /ops/jobs/process | Process pending jobs now |
| POST | /ops/webhooks/process | Process pending webhook deliveries |
| POST | /ops/retention/run | Run retention cleanup now |

---

## Security

ControlWeave ships with a layered security posture:

- **Encryption at rest** — User PII (email) encrypted with **AES-256-GCM**; HMAC-SHA-384 search indexes; CNSA Suite 1.0 compliant. Runtime `auditEncryptionStrength()` verifies algorithm, key length, HMAC strength, and TLS floor on every server start — server refuses to start if any check fails
- **Encryption in transit** — TLS 1.2+ enforced globally (`tls.DEFAULT_MIN_VERSION`); MCP → REST API channel throws on non-HTTPS in production, warns before sending credentials over plain HTTP
- **Authentication** — bcryptjs (14 rounds) password hashing; JWT access (15 min) + refresh (7 day) tokens; hashed refresh tokens in DB
- **Account lockout** — Per-account failed login counter with configurable lockout (default: 5 attempts → 15-minute lock, `Retry-After` header on 423 response)
- **Rate limiting** — IP-based rate limits on auth endpoints; per-org AI rate limits inside the API
- **Input sanitization** — Null bytes, `<script>` blocks, and HTML tags stripped from all user string inputs
- **Request size limits** — 2 MB body size cap (prevents payload-bomb DoS)
- **Security headers** — HSTS, CSP (`frame-ancestors 'none'`, `default-src 'self'`), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **CORS** — Restricted to configured origins (`CORS_ORIGIN`)
- **RBAC** — Granular permission checks on every protected route
- **Parameterized queries** — All DB queries use parameterized statements (no SQL injection surface)
- **Dependency auditing** — `npm run audit:check` (moderate+ severity threshold)
- **STIG assessment** — Automated DISA STIG compliance checks (APSC-DV-000230/240 data-at-rest and data-in-transit) via `node scripts/assess-stig-compliance.js` with live evidence output

---

## CI/CD Pipeline & PR Checks

All pull requests targeting `main` or `develop` run the full security and compliance pipeline before merge is permitted. The pipeline implements **NIST SP 800-160** systems security engineering principles and **CM-3/CM-4** change control requirements.

### Pipeline Overview

```
PR Opened / Push to main or develop
            │
      ┌─────┴──────┐
      ▼            ▼
 Backend      Frontend
 Build &      Build &
 Test         Test
      └─────┬──────┘
            │ (both must pass)
      ┌─────┴──────────────┐
      ▼                    ▼
  QA Testing           Secrets
  Suite                Scanning
  (syntax,             (TruffleHog
   IP hygiene,          + Gitleaks)
   E2E, crosswalk)
      └─────┬──────────────┘
            │
      ┌─────┴────────────────────┐
      ▼          ▼               ▼
  CodeQL      Dependency      Generate
  SAST        Scan            SBOM &
  Analysis    (npm audit)     AIBOM
      └─────┬────────────────────┘
            │
      ┌─────┴──────┐
      ▼            ▼
  Container    Vulnerability
  Build &      Analysis &
  Trivy Scan   Review Flagging
      │            │
      └─────┬──────┘
            │ (main branch only)
            ▼
        DAST Scan
        (OWASP ZAP)
            │
            ▼
      Pipeline Complete
```

### Job 1 — Backend Build & Test (MANDATORY, blocks all downstream)

| Check | Command | Failure Behaviour |
|-------|---------|------------------|
| Dependency install | `npm ci` | Blocks |
| **Syntax check** | `npm run check:syntax` | **Blocks merge** |
| **IP hygiene check** | `npm run check:ip-hygiene` | **Blocks merge** |
| Build | `npm run build` | Blocks |
| **Security audit** | `npm audit --audit-level=moderate` | **Blocks merge** |

### Job 2 — Frontend Build & Test (MANDATORY, blocks all downstream)

| Check | Command | Failure Behaviour |
|-------|---------|------------------|
| Dependency install | `npm ci` | Blocks |
| **TypeScript type check** | `npm run typecheck` | **Blocks merge** |
| **ESLint** | `npm run lint` | **Blocks merge** |
| **Production build** | `npm run build` | **Blocks merge** |
| **Security audit** | `npm audit --audit-level=moderate` | **Blocks merge** |

### Job 2.5 — QA Testing Suite

Runs against a live PostgreSQL 14 instance (pgvector extension). Suites controlled via `QA_DYNAMIC_SUITES` env var:

| Suite | Command | What It Tests |
|-------|---------|--------------|
| **Syntax** | `npm run check:syntax` | All JS files parseable |
| **IP Hygiene** (strict) | `IP_HYGIENE_FAIL_ON_STANDARDS=true npm run check:ip-hygiene` | No proprietary IP patterns |
| **Dynamic E2E** | `npm run qa:e2e:dynamic` | Core API flows end-to-end |
| **Auditor workflow** | `QA_DYNAMIC_SUITES=auditor npm run qa:e2e:dynamic` | Full auditor engagement → sign-off |
| **Crosswalk verification** | `npm run qa:crosswalk:live` | Crosswalk mappings integrity |

### Job 3 — CodeQL SAST Analysis

GitHub CodeQL scans JavaScript with `security-extended` + `security-and-quality` query suites. Results saved as SARIF artifacts (uploaded to GitHub Security tab if Advanced Security is enabled on the repo).

Language matrix: `['javascript-typescript']` (covers both backend Node.js and frontend TypeScript/React).

### Job 4 — Dependency Vulnerability Scan

`npm audit` runs on both backend and frontend independently. Results exported as JSON artifacts and retained for 30 days. The audit step in the build jobs enforces `--audit-level=moderate` as a hard gate; this job captures the full JSON detail for the vulnerability analysis job.

### Job 5 — Secrets Detection (runs in parallel, no dependency)

Two scanners run simultaneously:

| Scanner | What It Catches |
|---------|----------------|
| **TruffleHog** | Verified secrets: API keys, tokens, credentials in git history and current files |
| **Gitleaks** | Pattern-based secret detection across the full diff |

Both run on the git diff between base and head SHA — not the full repo history — to keep CI fast while catching new commits.

### Job 6 — Generate SBOM (Software Bill of Materials)

CycloneDX generates a SBOM for both backend and frontend `node_modules`. Output format: JSON (CycloneDX schema). Artifacts retained 90 days. The SBOM feeds into the vulnerability cross-reference features inside ControlWeave itself.

### Job 7 — Generate AIBOM (AI Bill of Materials)

`scripts/generate-aibom.js` inventories all AI models, providers, and agentic components referenced in the codebase (LLM integrations, OpenClaw agents, MCP tools). Summary posted as PR comment. Artifacts retained 90 days.

### Job 8 — Container Build & Trivy Security Scan

Builds Docker containers for both backend and frontend via Dockerfile. Trivy scans each image for **CRITICAL, HIGH, and MEDIUM** CVEs. SARIF output uploaded to GitHub Security tab (if Code Scanning is enabled). Images are NOT pushed — build-and-scan only.

Depends on: `codeql-analysis`, `dependency-scan` (runs after both pass).
Condition: `main` branch or any pull request.

### Job 9 — DAST with OWASP ZAP (main branch only)

ZAP Baseline Scan against `https://demo.controlweave.com` (requires the demo environment to be running; configure via the `ZAP_TARGET` workflow input or `DAST_TARGET_URL` secret). Catches runtime vulnerabilities not visible at static analysis time: reflected XSS, insecure headers, CORS misconfigurations, path traversal.

Condition: `main` branch only (post-merge). Does not block PRs.

### Job 10 — Vulnerability Analysis & Review Flagging

Aggregates findings from all security jobs. Applies risk-acceptance suppressions from closed `security,vulnerability-review` GitHub issues. Generates:

- **CM-3 Security Impact Analysis** report (NIST SP 800-53 CM-3/CM-4 alignment)
- `vulnerability-review.json` with structured findings
- GitHub Issues for any Medium+ unsuppressed findings

**Vulnerability severity gate:**

| Severity | Default Behaviour | Override |
|----------|------------------|---------|
| Critical | ❌ Fails pipeline | `FAIL_ON_CRITICAL_VULNS=false` |
| High | ⚠️ Creates review issue | `FAIL_ON_HIGH_VULNS=true` to block |
| Medium | ⚠️ Creates review issue | — |
| Low | ℹ️ Informational | — |

Risk acceptance workflow: close the generated GitHub issue with `security,vulnerability-review` labels → suppressed in future runs.

---

### Pre-PR Developer Checklist

Before opening a PR, run these locally:

```bash
# Backend checks (from controlweave/backend/)
npm run check:syntax              # Must pass — zero errors
npm run check:ip-hygiene          # Must pass — review any warnings
npm audit --audit-level=moderate  # Must pass — fix or accept with documented rationale
npm run build                     # Must succeed

# Frontend checks (from controlweave/frontend/)
npm run typecheck                 # Must pass — zero type errors
npm run lint                      # Must pass — zero ESLint errors
npm run build                     # Must succeed

# Database (if changing migrations)
npm run migrate                   # Must run cleanly on a fresh DB
# Test rollback manually if migration is reversible
```

**Branch naming** (CM-controlled, required for merge):
```
<type>/CW-<number>/<short-description>

Examples:
  feat/CW-101/rmf-lifecycle-dashboard
  fix/CW-102/crosswalk-auto-satisfy-bug
  security/CW-103/multer-dos-fix
  migration/CW-104/add-aibom-tables
```

**Commit message format:**
```
<type>(<scope>): <description>

feat(rmf): add authorization decision deactivation logic
fix(billing): resolve Stripe redirect after registration
security(routes): enforce write permissions on org mutations
migration(db): add rmf_packages and rmf_step_history tables
```

**PR title** must match commit message format. PR description must reference the CM tracking number (`Closes CW-XXX`) and list affected areas (backend / frontend / migration / docs).

---

### Security Compliance Frameworks Enforced by This Pipeline

| Control | Standard | Implemented By |
|---------|---------|---------------|
| CM-3: Configuration Change Control | NIST SP 800-53 | PR review requirement + branch protection |
| CM-4: Security Impact Analysis | NIST SP 800-53 | Job 10 (Vulnerability Analysis + SIA report) |
| SA-11: Developer Testing | NIST SP 800-53 | Jobs 1, 2, 2.5 (syntax, type check, E2E) |
| SA-15: Development Process, Standards, and Tools | NIST SP 800-53 | IP hygiene check, code quality gates |
| RA-5: Vulnerability Monitoring and Scanning | NIST SP 800-53 | Jobs 3, 4, 8 (CodeQL, npm audit, Trivy) |
| SI-2: Flaw Remediation | NIST SP 800-53 | Job 10 (vulnerability review issues + suppression workflow) |
| AU-2: Event Logging | NIST SP 800-53 | AIBOM generation (Job 7), artifact retention |
| SR-3: Supply Chain Controls | NIST SP 800-53 | Jobs 4, 6 (dependency audit, SBOM) |
| Continuous Verification | NIST SP 800-160 | Full pipeline runs on every PR commit |

---

## Other Workflows

Beyond the main security pipeline, the following workflows run on schedule or event triggers:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `cm-branch-naming.yml` | PR opened | Enforces `<type>/CW-<number>/...` branch format |
| `codeql.yml` | Push to main, weekly | Standalone CodeQL scan |
| `docs-pipeline.yml` | Docs changes | Documentation linting and link checking |
| `release.yml` | Tag push `v*` | Automated release packaging |
| `release-notes.yml` | Push to main, release branches, version tags | Auto-generates release notes, updates badges and package versions |
| `sync-wiki.yml` | Docs changes | Syncs docs to GitHub Wiki |
| `wiki-health-check.yml` | Weekly | Validates wiki link integrity |
| `sync-labels.yml` | `.github/labels.yml` change | Keeps issue/PR labels in sync |
| `compliance-labeler.yml` | PR opened | Auto-labels PRs by affected area |
| `security-pipeline.yml` | PR, push to main | Full security and compliance pipeline (above) |
| `security-reports.yml` | Weekly | Security posture summary report |
| `security-reports-export.yml` | On demand | Export security reports to artifacts |
| `security-reports-stig-quarterly.yml` | Quarterly | STIG-format security report |
| `scan-finding-resolution.yml` | Issue closed | Tracks vulnerability finding resolution |
| `vulnerability-risk-acceptance.yml` | Issue labeled | Processes risk acceptance for suppressions |
| `public-mirror.yml` | Push to main | Mirrors safe subset to `ControlWeave` public repo |
| `copilot-pr-review.yml` | PR opened | AI-assisted PR review via GitHub Copilot |
| `weekly-demo-hf-seed.yml` | Sunday 03:00 UTC | Refreshes Hugging Face vulnerability demo data |

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/README.md`](./docs/README.md) | Canonical documentation map: where product docs, business docs, wiki sources, and root-level docs belong |
| [`docs/OPEN_SOURCE_BUSINESS_MODEL.md`](./docs/OPEN_SOURCE_BUSINESS_MODEL.md) | Open-core GTM playbook: pricing, sales motion, competitive positioning |
| [`docs/FRAMEWORK_COVERAGE.md`](./docs/FRAMEWORK_COVERAGE.md) | All 40 frameworks with control counts, crosswalk coverage, and industry priority |
| [`docs/CROSSWALK_GUIDE.md`](./docs/CROSSWALK_GUIDE.md) | Business guide to cross-framework mappings and ROI |
| [`docs/HOW_CROSSWALKS_WORK.md`](./docs/HOW_CROSSWALKS_WORK.md) | Technical deep-dive: auto-satisfaction engine, SQL examples, auditor Q&A |
| [`docs/DATABASE_ARCHITECTURE.md`](./docs/DATABASE_ARCHITECTURE.md) | Full Pro schema: all domains, table structure, security notes |
| [`controlweave/README.md`](./controlweave/README.md) | Full feature documentation, API reference, setup guide |
| [`controlweave/QUICK_START.md`](./controlweave/QUICK_START.md) | Step-by-step setup including database configuration |
| [`controlweave/docs/MCP_GUIDE.md`](./controlweave/docs/MCP_GUIDE.md) | Complete MCP tool catalog (54 tools) and server setup |
| [`controlweave/docs/CE_MCP_GUIDE.md`](./controlweave/docs/CE_MCP_GUIDE.md) | Code Execution MCP four-layer security guide and MAESTRO attack class coverage |
| [`.openclaw/agents/README.md`](./.openclaw/agents/README.md) | OpenClaw agent roster, architecture, and AI governance compliance |

---

## What Makes This Different

| Feature | ControlWeaver | Vanta / Drata | Archer / ServiceNow GRC | OneTrust |
|---------|:-------------:|:-------------:|:-----------------------:|:--------:|
| Cost | **$0 forever** | $30k–200k/yr | $50k–500k/yr | $100k+/yr |
| Open source | ✅ AGPL v3 | ❌ | ❌ | ❌ |
| Self-hostable | ✅ | ❌ | ❌ | ❌ |
| Frameworks | **40** | 10–15 | 15–20 | 20+ |
| Auto-crosswalk engine | ✅ | ❌ | ❌ | ❌ |
| Optional AI Insights (BYOK) | ✅ | ❌ | ❌ | ❌ |
| NIST AI RMF native | ✅ | ❌ | ❌ | ❌ |
| RMF Lifecycle (SP 800-37) | ✅ | ❌ | ❌ | ❌ |
| EU AI Act Article 17 | ✅ | ❌ | ❌ | Partial |
| MAESTRO / CE-MCP security | ✅ | ❌ | ❌ | ❌ |
| SBOM / AIBOM management | ✅ | ❌ | ❌ | ❌ |
| MCP / API-first | ✅ | API only | Limited API | Limited API |
| Financial services AI frameworks | ✅ (Gov Cloud) | ❌ | Partial | Partial |

---

## Contributing

ControlWeave welcomes contributions to the open-source core. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and the [`LICENSE`](./LICENSE) for the full contribution guide and branch naming convention.

- **Framework gaps / mapping corrections**: Open a GitHub issue with a citation to the published standard
- **Bug reports**: Use the GitHub Issues template
- **Security vulnerabilities**: Email contehconsulting@gmail.com (do not open a public issue)

---

## License

ControlWeaver is licensed under the **[GNU Affero General Public License v3 (AGPL v3)](./LICENSE)**.

All features — including those previously locked behind paid tiers — are available to all users under this license. For questions or custom arrangements, contact: contehconsulting@gmail.com
