# ControlWeave

An AI-powered Governance, Risk, and Compliance (GRC) platform built to help organizations manage multi-framework compliance with crosswalk intelligence, evidence automation, AI-assisted operations, and a built-in AI Copilot.

Positioning intent: AI-native, MCP-native, and integration-first. The product is intentionally differentiated and not designed as a clone of legacy government-only workflows or privacy-suite products.

## Features

### Core Compliance Management
- **15 Compliance Frameworks + 2 OWASP AI Frameworks + 1 Reference Model** — NIST 800-53, NIST CSF 2.0, ISO 27001, SOC 2, NIST 800-171, NIST Privacy Framework, FISCAM, NIST AI RMF, GDPR, HIPAA, FFIEC, NERC CIP, EU AI Act, ISO 42001, plus OWASP LLM Top 10, OWASP Agentic AI Top 10, and the NIST SP 800-207 Zero Trust Architecture reference model
- **NIST Publications Library (62 seeded references)** — Searchable NIST publication catalog with direct mappings to in-app controls and assessment tasks, available as optional best-practice guidance or mandatory baseline by organization profile
- **500+ Controls** with broad multi-framework coverage and crosswalk mappings
- **33 Crosswalk Mappings** — Implement one control and automatically satisfy equivalent controls across frameworks
- **Control Implementation Tracking** — Status workflow from Not Started to Implemented with assignment and due dates
- **Control Health Monitoring** — Real-time control health scores based on evidence age, assessment results, and implementation status
- **Control Exceptions** — Track and manage approved exceptions with expiry dates and risk acceptance rationale

### Assessment & Audit
- **186 Assessment Procedures** based on NIST SP 800-53A, ISO 19011, AICPA SOC 2 Type II, HHS HIPAA Audit Protocol, and GDPR/EDPB guidelines
- **Three Assessment Depths** — Basic, Focused, and Comprehensive
- **Assessment Plans** — Create and track assessment campaigns with scheduling
- **Result Recording** — NIST-standard outcomes (Satisfied / Other Than Satisfied / Not Applicable)
- **Audit Logging** — Complete trail of all user actions
- **Auditor Workspace** — Dedicated external auditor portal with engagements, PBC requests, workpapers, findings, and sign-offs

### AI Copilot
- **Floating "Ask AI" panel** — Available on every dashboard page via the purple button (bottom-right)
- **Org-aware context** — The Copilot knows your organization's frameworks, controls, evidence, and posture before you even ask
- **Page-aware prompts** — Automatically surfaces the context of the page you're viewing (controls, assessments, vulnerabilities, etc.)
- **Persistent conversation** — Chat history is saved per organization across browser sessions (last 20 messages)
- **Quick-action buttons** — One-click prompts for common GRC tasks
- **Embedded AI panels** — Auto-triggered analysis panels on the Dashboard, Assessments, and Vulnerabilities pages

### AI-Powered Analysis (BYOK + Free Providers)
Bring Your Own Key support for Anthropic Claude, OpenAI, Google Gemini, xAI Grok, and Groq. Self-hosted Ollama support (no key required). 25+ AI analysis features:

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
| AI Governance | Assesses AI system compliance (NIST AI RMF, EU AI Act, OWASP LLM Top 10) |
| Control Analysis | Deep-dive analysis of a single control's posture and gaps |
| Test Procedures Generator | Generates custom test procedures per control |
| Policy Generator | Drafts security and compliance policies from scratch |
| Compliance Q&A | Natural language queries about your compliance posture |
| Training Recommendations | Suggests role-based security awareness training |
| Evidence Suggestions | Recommends evidence to collect per control |
| AI Copilot Chat | Org-aware conversational assistant (global, always available) |

### Supported LLM Providers

| Provider | Key Required | Notes |
|----------|-------------|-------|
| Anthropic Claude | Yes (BYOK) | claude-sonnet-4-5, claude-opus-4-6 |
| OpenAI | Yes (BYOK) | gpt-4o, gpt-4o-mini |
| Google Gemini | Yes (BYOK) | Free tier available at aistudio.google.com |
| xAI Grok | Yes (BYOK) | grok-3, grok-3-mini |
| Groq | Yes (BYOK) | Free tier at console.groq.com — llama3, mixtral, gemma |
| Ollama | No key needed | Self-hosted local LLMs (llama3.2, mistral, etc.) |

Configure providers in **Settings → LLM Configuration**. Each organization can set its own BYOK key per provider and choose the active model.

### Asset Management (CMDB)
- **Hardware** — Servers, workstations, network equipment
- **Software** — Applications, operating systems, middleware
- **AI Agents** — ML models, chatbots, automated decision systems (tracks AIBOM data)
- **Service Accounts** — Privileged and service credentials
- **Environments** — Production, staging, development
- **Password Vaults** — Credential management systems

### SBOM / AIBOM Management
- **Software Bill of Materials (SBOM)** — Upload and manage SBOM files per software asset
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
- **Custom Dashboard Builder** — Drag-and-drop widget layout per user
- **PDF/Excel Reports** — Generate audit-ready reports for stakeholders
- **AI Insights Panel** — Auto-triggered AI analysis surfaced directly on the dashboard

### User & Access Management
- **Role-Based Access Control** — Admin, Auditor, Viewer, and custom roles with granular permission sets
- **Tier-Based Licensing** — Free, Starter, Professional, and Enterprise tiers
- **JWT Authentication** — Secure token-based auth with refresh flow
- **Account Lockout** — Automatic per-account lockout after N failed login attempts (configurable, default 5 attempts / 15-minute lockout)
- **Organization Multi-Tenancy** — Isolated data per organization

### Notifications & Reminders
- **In-app notifications** — Control due dates, assessment reminders, trial expiry alerts
- **Reminder scheduler** — Background job that generates reminders on a configurable interval (default 60 minutes)
- **Notification preferences** — Per-user notification settings

### Webhooks & Integrations
- **Outbound webhooks** — Trigger HTTP callbacks on platform events (control updates, assessment completions, evidence uploads)
- **Webhook delivery queue** — Async delivery with retry logic and delivery history
- **Splunk connector** — Pull SIEM search results as integrity-tracked evidence artifacts
- **Integrations Hub** — Central page for managing all active connectors and API tokens

### Operations & Platform Management
- **Job queue** — Background async job runner for long-running tasks (reports, AI analysis caching, retention)
- **Retention cleanup** — Automated evidence retention enforcement
- **Capacity monitoring** — DB size, connection utilization, and row count thresholds (`npm run db:capacity`)
- **Dynamic config** — Runtime feature flags and platform config without redeployment

### MCP Integration
- **Model Context Protocol server** — Connect the platform to MCP-capable LLM clients (Claude Desktop, Cursor, etc.)
- **Tool-based access** — Query compliance posture, controls, assessments, notifications, and AI Q&A through MCP tools

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+, TypeScript, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| AI — Hosted | Anthropic Claude SDK, OpenAI SDK, Google Gemini REST API, xAI API (OpenAI-compatible), Groq API (OpenAI-compatible) |
| AI — Self-hosted | Ollama (OpenAI-compatible, local) |
| Integrations | Splunk REST API |
| Auth | JWT (jsonwebtoken), bcrypt (12 rounds) |
| Charts | Recharts |
| Response compression | compression (gzip/deflate) |

---

## Project Structure

```
controlweave/
├── backend/
│   ├── src/
│   │   ├── server.js                # Express server entry point
│   │   ├── config/
│   │   │   ├── database.js          # PostgreSQL pool config
│   │   │   └── security.js          # JWT, rate limit, and lockout config
│   │   ├── middleware/
│   │   │   ├── auth.js              # JWT auth + RBAC + tier gating
│   │   │   ├── rateLimit.js         # IP-based + org-based rate limiting
│   │   │   └── validate.js          # Body validation + input sanitization
│   │   ├── routes/                  # API route handlers
│   │   │   ├── ai.js               # 25+ AI analysis endpoints + chat
│   │   │   ├── assessments.js      # Assessment procedures & plans
│   │   │   ├── assets.js           # CMDB asset management
│   │   │   ├── audit.js            # Audit log
│   │   │   ├── auditorWorkspace.js # External auditor portal
│   │   │   ├── controls.js         # Control CRUD + crosswalks
│   │   │   ├── controlHealth.js    # Control health scoring
│   │   │   ├── dataGovernance.js   # Data classification & governance
│   │   │   ├── dashboardBuilder.js # Custom dashboard widgets
│   │   │   ├── evidence.js         # Evidence upload & management
│   │   │   ├── exceptions.js       # Control exceptions
│   │   │   ├── frameworks.js       # Frameworks + NIST publications
│   │   │   ├── implementations.js  # Control implementation tracking
│   │   │   ├── integrationsHub.js  # Integration connectors
│   │   │   ├── notifications.js    # In-app notifications
│   │   │   ├── ops.js              # Platform operations & job queue
│   │   │   ├── orgSettings.js      # BYOK LLM + model configuration
│   │   │   ├── poam.js             # Plan of Action & Milestones
│   │   │   ├── reports.js          # PDF/Excel report generation
│   │   │   ├── roles.js            # Custom role & permission management
│   │   │   ├── sbom.js             # SBOM & AIBOM management
│   │   │   ├── splunk.js           # Splunk connector
│   │   │   ├── users.js            # User management
│   │   │   ├── vulnerabilities.js  # Vulnerability tracking
│   │   │   └── webhooks.js         # Outbound webhooks
│   │   └── services/
│   │       ├── llmService.js       # Multi-provider LLM abstraction
│   │       ├── orgContextService.js # Org-aware AI context builder
│   │       ├── sbomService.js      # SBOM parsing & analysis
│   │       ├── splunkService.js    # Splunk API client
│   │       ├── jobService.js       # Async job queue
│   │       ├── webhookService.js   # Webhook delivery engine
│   │       └── reminderService.js  # Notification scheduler
│   ├── migrations/                 # 036 SQL migration files (run in order)
│   └── scripts/                    # Database seeding & QA scripts
├── frontend/
│   └── src/
│       ├── app/                    # Next.js App Router pages
│       │   ├── dashboard/
│       │   │   ├── page.tsx        # Main dashboard with AI insights
│       │   │   ├── controls/       # Controls list + detail
│       │   │   ├── assessments/    # Assessment management + AI panel
│       │   │   ├── frameworks/     # Frameworks, mappings, NIST publications
│       │   │   ├── evidence/       # Evidence management
│       │   │   ├── assets/         # CMDB asset views
│       │   │   ├── vulnerabilities/# Vulnerability tracking + AI remediation
│       │   │   ├── sbom/           # SBOM / AIBOM management
│       │   │   ├── audit/          # Audit log viewer
│       │   │   ├── auditor-workspace/ # External auditor portal
│       │   │   ├── reports/        # Report generation
│       │   │   ├── operations/     # Platform ops & job queue
│       │   │   └── settings/       # LLM config, content packs, webhooks
│       │   ├── login/
│       │   └── register/
│       ├── components/
│       │   ├── AICopilot.tsx       # Global floating AI Copilot panel
│       │   ├── DashboardLayout.tsx # Main layout with sidebar + AI Copilot
│       │   └── Sidebar.tsx         # Navigation sidebar
│       ├── contexts/               # React context providers (Auth, etc.)
│       └── lib/                    # API client & utilities
└── docs/                           # Documentation
```

---

## Supported Tier Features

| Feature | Free | Starter | Professional | Enterprise |
|---------|------|---------|-------------|------------|
| Frameworks | 2 | 5 | All | All |
| Controls browsing | Yes | Yes | Yes | Yes |
| Dashboard charts | Basic | Full | Full | Full |
| AI analysis calls (platform key) | 3/mo | 25/mo | Unlimited | Unlimited |
| AI Copilot chat | Limited | Yes | Yes | Yes |
| PDF/Excel reports | - | Yes | Yes | Yes |
| Evidence management | - | Yes | Yes | Yes |
| Assessment procedures | View | Full | Full | Full |
| CMDB | - | Basic | Full | Full |
| Vulnerability management | - | Basic | Full | Full |
| SBOM / AIBOM | - | - | Yes | Yes |
| POA&M | - | - | Yes | Yes |
| Vendor risk management | - | - | Yes | Yes |
| Policy management | - | - | Yes | Yes |
| Data governance | - | - | Yes | Yes |
| Custom dashboards | - | - | Yes | Yes |
| Webhooks | - | - | Yes | Yes |
| Maturity scoring | - | - | Yes | Yes |
| Auditor Workspace | - | - | Yes | Yes |
| In-app notifications | Basic | Full | Full | Full |
| API access | - | - | Yes | Yes |
| SSO/SAML | - | - | - | Yes |
| White-label | - | - | - | Yes |
| Dedicated support | - | - | - | Yes |

Default signup behavior:
- New organizations start on a 30-day full-feature trial tier.
- At trial expiry, organizations are automatically downgraded to Free unless upgraded.
- Paid tiers include `starter`, `professional`, `enterprise`, and `utilities`.

BYOK behavior: by default, organizations using their own API key do not consume platform AI limits. Set `AI_LIMIT_APPLIES_TO_BYOK=true` to enforce tier limits for BYOK traffic.

---

## Positioning Guardrails

- Build as an orchestration layer (not a closed monolith): prioritize connectors, APIs, and MCP interfaces.
- Keep evidence automation as a core wedge: ingestion, integrity checks, linkage, and audit-ready exports.
- Maintain independent UX and product language; avoid reproducing competitor-specific flows verbatim.
- Optimize for mid-market speed-to-audit and operator productivity.

Detailed guardrails: [docs/POSITIONING_GUARDRAILS.md](docs/POSITIONING_GUARDRAILS.md)

---

## Getting Started

See [QUICK_START.md](QUICK_START.md) for full setup instructions.

### Quick Setup

```bash
# 1. Clone and install
git clone <repo>
cd controlweave/backend && npm install
cd ../frontend && npm install

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit .env: set DATABASE_URL, JWT_SECRET, and optionally LLM provider keys

# 3. Run database migrations
cd backend && npm run migrate

# 4. Seed demo data (optional)
npm run seed:demo-full

# 5. Start services
npm run dev          # backend (port 3001)
cd ../frontend && npm run dev  # frontend (port 3000)
```

### Environment Variables (key settings)

```env
# Database
DATABASE_URL=postgres://user:pass@host:5432/dbname

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
```

---

## Small-Start Deployment Profile

For production launch on a small managed Postgres tier (with explicit `DATABASE_URL`, migration/seed order, backup schedule, and upgrade thresholds):

- [docs/SMALL_START_DEPLOYMENT_PROFILE.md](docs/SMALL_START_DEPLOYMENT_PROFILE.md)

---

## Public Mirror Automation

For private-to-public mirroring (`ai-grc-platform-pro` → `ai-grc-platform`) with an allowlist and safety checks:

- [docs/PUBLIC_MIRROR_SETUP.md](docs/PUBLIC_MIRROR_SETUP.md)

---

## Operational Commands

From `backend/`:

```bash
npm run migrate              # Run pending database migrations
npm run db:backup            # Backup database (pg_dump)
npm run db:capacity          # Check DB size/connection/row thresholds
npm run audit:check          # Run npm audit (moderate+ severity)
npm run mcp                  # Start MCP server
```

### Demo Data

```bash
npm run seed:cmdb-demo           # Seed CMDB sample assets
npm run seed:showcase-demo       # Seed showcase compliance data
npm run seed:demo-full           # Seed all demo data
```

Primary demo login:
- Email: `admin@professional.com`
- Password: `Test1234!`

Starter-tier demo login:
- Email: `bob@starter.com`
- Password: `Test1234!`

---

## QA Runner

From `backend/`, run the dynamic end-to-end QA orchestrator:

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

```bash
npm run mcp
```

Required environment:
- `GRC_API_BASE_URL` (default: `http://localhost:3001/api/v1`)
- `GRC_API_TOKEN` (JWT access token)

Available MCP tools: compliance posture queries, controls lookup, assessment data, notifications, and AI Q&A.

Detailed setup: [docs/MCP_SETUP.md](docs/MCP_SETUP.md)
Licensed pack format: [docs/CONTENT_PACKS.md](docs/CONTENT_PACKS.md)

---

## API Reference

Base URL: `http://localhost:3001/api/v1`

All endpoints (except `/auth/*`) require `Authorization: Bearer <accessToken>`.

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Create account + organization |
| POST | /auth/login | Login, receive JWT (with account lockout) |
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

### AI Analysis
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
| POST | /ai/chat | AI Copilot conversational chat |

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

- **Authentication** — bcrypt (12 rounds) password hashing; JWT access (15 min) + refresh (7 day) tokens; hashed refresh tokens in DB
- **Account lockout** — Per-account failed login counter with configurable lockout (default: 5 attempts → 15-minute lock, `Retry-After` header on 423 response)
- **Rate limiting** — IP-based rate limits on auth endpoints; per-org AI rate limits inside the API
- **Input sanitization** — Null bytes, `<script>` blocks, and HTML tags stripped from all user string inputs
- **Request size limits** — 2 MB body size cap (prevents payload-bomb DoS)
- **Security headers** — HSTS, CSP (`frame-ancestors 'none'`, `default-src 'self'`), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **CORS** — Restricted to configured origins (`CORS_ORIGIN`)
- **RBAC** — Granular permission checks on every protected route
- **Parameterized queries** — All DB queries use parameterized statements (no SQL injection surface)
- **Dependency auditing** — `npm run audit:check` (moderate+ severity threshold)

---

## License

[MIT](LICENSE)
