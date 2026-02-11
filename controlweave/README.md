# ControlWeave

An AI-powered Governance, Risk, and Compliance (GRC) platform built to help organizations manage multi-framework compliance with crosswalk intelligence, evidence automation, and AI-assisted operations.

Positioning intent: AI-native, MCP-native, and integration-first. The product is intentionally differentiated and not designed as a clone of legacy government-only workflows or privacy-suite products.

## Features

### Core Compliance Management
- **14 Compliance Frameworks + 1 Reference Model (currently seeded)** — NIST 800-53, NIST CSF 2.0, ISO 27001, SOC 2, NIST 800-171, NIST Privacy Framework, FISCAM, NIST AI RMF, GDPR, HIPAA, FFIEC, NERC CIP, EU AI Act, ISO 42001, plus the NIST SP 800-207 Zero Trust Architecture reference model
- **NIST Publications Library (62 seeded references)** — Searchable NIST publication catalog with direct mappings to in-app controls and assessment tasks, available as optional best-practice guidance or mandatory baseline by organization profile
- **500+ Controls** with broad multi-framework coverage and crosswalk mappings
- **33 Crosswalk Mappings** — Implement one control and automatically satisfy equivalent controls across frameworks
- **Control Implementation Tracking** — Status workflow from Not Started to Implemented with assignment and due dates

### Assessment & Audit
- **186 Assessment Procedures** based on NIST SP 800-53A, ISO 19011, AICPA SOC 2 Type II, HHS HIPAA Audit Protocol, and GDPR/EDPB guidelines
- **Three Assessment Depths** — Basic, Focused, and Comprehensive
- **Assessment Plans** — Create and track assessment campaigns with scheduling
- **Result Recording** — NIST-standard outcomes (Satisfied / Other Than Satisfied / Not Applicable)
- **Audit Logging** — Complete trail of all user actions

### AI-Powered Analysis (BYOK)
Bring Your Own Key support for Anthropic Claude, OpenAI, Google Gemini, and xAI Grok. 16 AI analysis features:

| Feature | Description |
|---------|-------------|
| Gap Analysis | Identifies compliance gaps across all adopted frameworks |
| Crosswalk Optimizer | Finds overlap opportunities to reduce duplicate work |
| Compliance Forecast | Predicts compliance trajectory and timeline to full coverage |
| Regulatory Monitor | Scans for regulatory changes affecting your frameworks |
| Remediation Playbook | Generates step-by-step remediation plans per control |
| Incident Response | Creates incident response plans by incident type |
| Executive Report | Produces board-ready compliance summary reports |
| Risk Heatmap | Maps risk levels across control families |
| Vendor Risk Assessment | Evaluates third-party vendor compliance risk |
| Audit Readiness | Scores preparedness for upcoming audits |
| Asset-Control Mapping | Links CMDB assets to relevant controls |
| Shadow IT Detection | Identifies unmanaged technology risks |
| AI Governance | Assesses AI system compliance (NIST AI RMF, EU AI Act) |
| Compliance Q&A | Natural language queries about your compliance posture |
| Training Recommendations | Suggests role-based security awareness training |
| Evidence Suggestions | Recommends evidence to collect per control |

### Asset Management (CMDB)
- **Hardware** — Servers, workstations, network equipment
- **Software** — Applications, operating systems, middleware
- **AI Agents** — ML models, chatbots, automated decision systems
- **Service Accounts** — Privileged and service credentials
- **Environments** — Production, staging, development
- **Password Vaults** — Credential management systems

### Evidence Management
- **File Upload** — Attach evidence documents to controls
- **Tagging & Search** — Organize evidence with tags and full-text search
- **Control Linking** — Link evidence to one or more controls
- **Download** — Retrieve evidence files for audit preparation
- **Splunk Import Plugin** — Pull SIEM search results into Evidence as integrity-tracked JSON artifacts

### Licensed Content Packs
- **Report -> Draft -> Attest -> Import Flow** — Upload report, parse and AI-draft pack, attest licensing rights, optional approval gate, then import
- **Customer-Provided Pack Import** — Import licensed framework content per organization (no global overwrite)
- **Org-Scoped Overrides** — Override control/procedure text only for that tenant
- **Reversible Activation** — Remove a pack and cleanly remove only overrides sourced by that pack

### Dashboard & Reporting
- **Compliance Overview** — Overall compliance percentage across all frameworks
- **Framework Progress** — Per-framework compliance breakdown with visual charts
- **Priority Actions** — Critical controls requiring immediate attention
- **Recent Activity** — Live feed of compliance actions
- **Compliance Trend** — Historical compliance trajectory
- **PDF/Excel Reports** — Generate audit-ready reports for stakeholders

### User & Access Management
- **Role-Based Access Control** — Admin, Auditor, Viewer, and custom roles
- **Tier-Based Licensing** — Free, Starter, Professional, and Enterprise tiers
- **JWT Authentication** — Secure token-based auth with refresh flow
- **Organization Multi-Tenancy** — Isolated data per organization

### MCP Integration
- **Model Context Protocol server** — Connect the platform to MCP-capable LLM clients
- **Tool-based access** — Query compliance posture, controls, assessments, notifications, and AI Q&A through MCP tools

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+, TypeScript, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| AI | Anthropic Claude SDK, OpenAI SDK, Google Gemini REST API, xAI API (OpenAI-compatible) |
| Integrations | Splunk REST API |
| Auth | JWT (jsonwebtoken), bcrypt |
| Charts | Recharts |

## Project Structure

```
controlweave/
├── backend/
│   ├── src/
│   │   ├── server.js              # Express server entry point
│   │   ├── config/database.js     # PostgreSQL pool config
│   │   ├── middleware/auth.js     # JWT auth + tier gating
│   │   ├── routes/                # API route handlers
│   │   │   ├── ai.js             # 16 AI analysis endpoints
│   │   │   ├── assessments.js    # Assessment procedures & plans
│   │   │   ├── assets.js         # CMDB asset management
│   │   │   ├── orgSettings.js    # BYOK LLM configuration
│   │   │   └── ...
│   │   └── services/
│   │       └── llmService.js     # Multi-provider LLM abstraction
│   ├── migrations/               # SQL migration files
│   └── scripts/                  # Database seeding scripts
├── frontend/
│   └── src/
│       ├── app/                  # Next.js App Router pages
│       │   ├── dashboard/        # Main application pages
│       │   ├── login/            # Authentication
│       │   └── register/
│       ├── components/           # Reusable UI components
│       ├── contexts/             # React context providers
│       └── lib/                  # API client & utilities
└── docs/                         # Documentation
```

## Supported Tier Features

| Feature | Free | Starter | Professional | Enterprise |
|---------|------|---------|-------------|------------|
| Frameworks | 2 | 5 | All seeded frameworks | All seeded frameworks |
| Controls browsing | Yes | Yes | Yes | Yes |
| Dashboard charts | Basic | Full | Full | Full |
| AI analysis calls (platform usage) | 3/mo | 25/mo | Unlimited | Unlimited |
| PDF/Excel reports | - | Yes | Yes | Yes |
| Evidence management | - | Yes | Yes | Yes |
| Assessment procedures | View | Full | Full | Full |
| CMDB | - | Basic | Full | Full |
| Vendor risk management | - | - | Yes | Yes |
| Policy management | - | - | Yes | Yes |
| Maturity scoring | - | - | Yes | Yes |
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

## Positioning Guardrails

- Build as an orchestration layer (not a closed monolith): prioritize connectors, APIs, and MCP interfaces.
- Keep evidence automation as a core wedge: ingestion, integrity checks, linkage, and audit-ready exports.
- Maintain independent UX and product language; avoid reproducing competitor-specific flows verbatim.
- Optimize for mid-market speed-to-audit and operator productivity.

Detailed guardrails: [docs/POSITIONING_GUARDRAILS.md](docs/POSITIONING_GUARDRAILS.md)

## Getting Started

See [QUICK_START.md](QUICK_START.md) for setup instructions.

## Small-Start Deployment Profile

For production launch on a small managed Postgres tier (with explicit `DATABASE_URL`, migration/seed order, backup schedule, and upgrade thresholds), use:

- [docs/SMALL_START_DEPLOYMENT_PROFILE.md](docs/SMALL_START_DEPLOYMENT_PROFILE.md)

## Public Mirror Automation

For private-to-public mirroring (`ai-grc-platform-pro` -> `ai-grc-platform`) with an allowlist and safety checks, use:

- [docs/PUBLIC_MIRROR_SETUP.md](docs/PUBLIC_MIRROR_SETUP.md)

Operational commands from `backend/`:

```bash
npm run migrate
npm run db:backup
npm run db:capacity
```

## Demo Data

From `backend/`, seed sample data for walkthroughs:

```bash
npm run seed:cmdb-demo
npm run seed:showcase-demo
```

Primary demo login:
- Email: `admin@professional.com`
- Password: `Test1234!`

Starter-tier demo login:
- Email: `bob@starter.com`
- Password: `Test1234!`

## Dynamic QA Runner

From `backend/`, run the dynamic end-to-end QA orchestrator:

```bash
npm run qa:e2e:dynamic
```

Run every available suite (syntax + mega + dynamic scenarios + auditor workflow + legacy):

```bash
npm run qa:e2e:dynamic:all
```

Run only the auditor workflow suite:

```bash
npm run qa:e2e:auditor
```

Optional controls:
- `QA_DYNAMIC_SUITES` to choose suites (comma-separated: `syntax,mega,dynamic,auditor,legacy`)
- `QA_DYNAMIC_FAIL_FAST=true` to stop on first failing suite

## Auditor Workflow Demo Check

From `backend/`, run:

```bash
npm run qa:e2e:auditor
```

This validates the end-to-end auditor path:
- Create engagement
- Create/update PBC request
- Create/update workpaper
- Create/update finding
- Record sign-off
- Create auditor workspace link
- Validate public read-only workspace payload
- Validate audit log linkage

## IP Hygiene Check

To reduce product copy/IP risk, CI runs an automated hygiene check that:
- Blocks competitor-name references in repository content.
- Flags likely verbatim standards language for manual review.

Run locally from `backend/`:

```bash
npm run check:ip-hygiene
```

Optional strict mode (fail on standards flags too):

```bash
IP_HYGIENE_FAIL_ON_STANDARDS=true npm run check:ip-hygiene
```

## MCP Server

Run the MCP server from `backend/`:

```bash
npm run mcp
```

Required environment for MCP runtime:
- `GRC_API_BASE_URL` (default: `http://localhost:3001/api/v1`)
- `GRC_API_TOKEN` (JWT access token for the user/org context)

Optional:
- `GRC_HEALTH_URL` (default derived from `GRC_API_BASE_URL`)

Detailed setup: [docs/MCP_SETUP.md](docs/MCP_SETUP.md)
Licensed pack format: [docs/CONTENT_PACKS.md](docs/CONTENT_PACKS.md)

## API Documentation

Base URL: `http://localhost:3001/api/v1`

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Create account |
| POST | /auth/login | Login, receive JWT |
| POST | /auth/refresh | Refresh access token |
| POST | /auth/logout | Invalidate session |
| GET | /auth/me | Get current user |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /settings/llm | Get BYOK LLM settings |
| PUT | /settings/llm | Update BYOK LLM settings |
| POST | /settings/llm/test | Validate a provider API key |
| DELETE | /settings/llm/:provider | Remove provider API key |
| GET | /settings/content-packs | List imported licensed content packs |
| GET | /settings/content-packs/template | Get JSON template for content pack imports |
| GET | /settings/content-packs/drafts | List content pack drafts |
| GET | /settings/content-packs/drafts/:id | Get draft detail (editable JSON + parse summary) |
| POST | /settings/content-packs/drafts/upload | Upload report and generate AI-assisted draft |
| PUT | /settings/content-packs/drafts/:id | Update draft pack JSON/review requirement |
| POST | /settings/content-packs/drafts/:id/attest | Record mandatory licensing attestation |
| POST | /settings/content-packs/drafts/:id/review | Approve/reject when review gate is enabled |
| POST | /settings/content-packs/drafts/:id/import | Import draft after attestation (+ approval if required) |
| POST | /settings/content-packs/import | Import org-scoped licensed content pack |
| DELETE | /settings/content-packs/:id | Remove imported pack and its overrides |

### Frameworks & Controls
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /frameworks | List all frameworks |
| GET | /organizations/:orgId/controls | List controls by org |
| GET | /controls/:id | Get control detail |
| GET | /controls/:id/mappings | Get crosswalk mappings |
| PUT | /controls/:id/implementation | Update implementation |

### Assessments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /assessments/procedures | List assessment procedures |
| GET | /assessments/procedures/by-control/:controlId | Procedures for a control |
| POST | /assessments/results | Record assessment result |
| GET | /assessments/stats | Assessment statistics |
| POST | /assessments/plans | Create assessment plan |

### NIST Publications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /frameworks/nist-publications | List/filter NIST publication references with optional mapped controls/tasks (`include_mappings=true`) |
| GET | /frameworks/nist-publications/coverage | Publication coverage dataset (summary + heatmap + top gaps) |
| GET | /frameworks/nist-publications/catalog-controls | Search active framework controls for mapping workspace |
| GET | /frameworks/nist-publications/:id | Publication detail workspace payload (mappings, tasks, coverage) |
| PUT | /frameworks/nist-publications/:id/mappings | Replace/merge curated publication-control mappings (`frameworks.manage`) |

### AI Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /ai/gap-analysis | Run gap analysis |
| POST | /ai/crosswalk-optimizer | Optimize crosswalks |
| POST | /ai/compliance-forecast | Forecast compliance |
| POST | /ai/remediation/:controlId | Generate remediation plan |
| POST | /ai/executive-report | Generate executive report |
| POST | /ai/query | Natural language compliance Q&A |

### Evidence
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /evidence | List evidence |
| POST | /evidence/upload | Upload evidence file |
| POST | /evidence/:id/link | Link evidence to controls |

### Integrations (Splunk)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /integrations/splunk | Get Splunk connector settings |
| PUT | /integrations/splunk | Save Splunk connector settings |
| POST | /integrations/splunk/test | Validate Splunk connection |
| POST | /integrations/splunk/import-evidence | Import Splunk search results as evidence |

### Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /ops/overview | Admin operations summary (usage, queue health, failures) |
| GET | /ops/jobs | List queued/running/completed/failed platform jobs |
| POST | /ops/jobs | Enqueue a job (`job_type`, optional payload/run_after) |
| POST | /ops/jobs/process | Process pending jobs now |
| POST | /ops/webhooks/process | Process pending webhook deliveries now |
| POST | /ops/retention/run | Run retention cleanup now |

### CMDB
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /cmdb/:type | List assets by type |
| POST | /cmdb/:type | Create asset |
| PUT | /cmdb/:type/:id | Update asset |
| DELETE | /cmdb/:type/:id | Delete asset |

Types: `hardware`, `software`, `ai-agents`, `service-accounts`, `environments`, `password-vaults`

## License

[MIT](LICENSE)
