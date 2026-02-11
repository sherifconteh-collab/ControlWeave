# ControlWeave — Community Edition

Open source, self-hostable GRC (Governance, Risk, and Compliance) platform. Free tier features, no subscription required.

> **Looking for the full-featured hosted product?** Visit [app.controlweave.io](https://app.controlweave.io) for ControlWeave Pro — unlimited frameworks, CMDB, evidence management, reports, vulnerability tracking, auditor workspace, and more.

---

## What's Included (Free Tier)

### Compliance Frameworks
- **Up to 2 active compliance frameworks** from the full catalog (NIST 800-53, NIST CSF 2.0, ISO 27001, SOC 2, HIPAA, GDPR, EU AI Act, OWASP LLM Top 10, OWASP Agentic AI Top 10, and more)
- **500+ controls** with crosswalk mappings between frameworks
- **33 crosswalk mappings** — implement one control, satisfy equivalents across frameworks automatically
- **Control implementation tracking** — Not Started → In Progress → Implemented

### Assessment & Audit
- **Assessment procedures** (view and run) — NIST SP 800-53A, ISO 19011, SOC 2, HIPAA, GDPR methodology
- **Three assessment depths** — Basic, Focused, Comprehensive
- **Assessment plans** — create and schedule assessment campaigns
- **Result recording** — Satisfied / Other Than Satisfied / Not Applicable

### AI Analysis (3 requests/month)
Bring your own API key (BYOK) for any supported provider. 3 AI requests/month on the platform key.

| Feature | Description |
|---------|-------------|
| Gap Analysis | Identify compliance gaps across your frameworks |
| Crosswalk Optimizer | Find overlap opportunities to reduce duplicate work |
| Compliance Forecast | Predict trajectory to full compliance coverage |
| Remediation Playbook | Step-by-step remediation plans per control |
| Executive Report | Board-ready compliance summaries |
| Compliance Q&A | Ask natural language questions about your posture |
| AI Copilot | Org-aware chat assistant on every page |

### Supported LLM Providers (BYOK)

| Provider | Key Required | Cost |
|----------|-------------|------|
| Anthropic Claude | Yes | Paid |
| OpenAI | Yes | Paid |
| Google Gemini | Yes | **Free tier** at [aistudio.google.com](https://aistudio.google.com) |
| xAI Grok | Yes | Paid |
| Groq | Yes | **Free tier** at [console.groq.com](https://console.groq.com) |
| Ollama | No key needed | **Free** — self-hosted local LLMs |

### Core Platform
- **Dashboard** — compliance overview, framework progress, priority actions
- **NIST Publications Library** — 62 publication references with control mappings
- **Audit log** — complete trail of all actions
- **MCP server** — connect to Claude Desktop, Cursor, and other MCP-compatible LLM clients
- **Organization multi-tenancy** — full data isolation per organization
- **RBAC** — Admin, Auditor, Viewer, and custom roles

---

## What's in ControlWeave Pro

[ControlWeave Pro](https://app.controlweave.io) (hosted edition) adds:

- All compliance frameworks (no 2-framework limit)
- Unlimited AI requests with BYOK
- CMDB asset management (hardware, software, AI agents, service accounts, environments)
- SBOM / AIBOM management
- Vulnerability tracking with AI remediation
- Evidence management and PDF/Excel reporting
- Plan of Action & Milestones (POA&M)
- Auditor Workspace (engagements, PBC requests, workpapers, findings, sign-offs)
- Webhooks and outbound integrations
- Splunk connector for SIEM evidence import
- Data governance and sensitivity classification
- Custom dashboard builder
- Maturity scoring

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+, TypeScript, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| AI | Anthropic Claude, OpenAI, Google Gemini, xAI Grok, Groq, Ollama |
| Auth | JWT, bcrypt (12 rounds) |
| Charts | Recharts |

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Setup

```bash
# 1. Clone
git clone https://github.com/sherifconteh-collab/ControlWeave.git
cd ControlWeave/controlweave

# 2. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 3. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env — set DATABASE_URL and JWT_SECRET at minimum

# Copy and configure frontend env
cp frontend/.env.local.example frontend/.env.local
# Or create frontend/.env.local with:
# NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# 4. Run database migrations
cd backend && npm run migrate

# 5. (Optional) Seed demo data
npm run seed:cmdb-demo
npm run seed:showcase-demo

# 6. Start services
npm run dev                     # backend on port 3001
cd ../frontend && npm run dev   # frontend on port 3000
```

Open [http://localhost:3000](http://localhost:3000) and register an account.

### Key Environment Variables

```env
# backend/.env

# Required
DATABASE_URL=postgres://user:pass@localhost:5432/grc_platform
JWT_SECRET=your-long-random-secret-at-least-32-chars

# Optional: platform-level AI key (users can also BYOK in Settings)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434/v1
```

```env
# frontend/.env.local

NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# URL shown on upgrade prompts. Set to empty to hide upgrade links.
NEXT_PUBLIC_PRO_URL=https://app.controlweave.io
```

---

## Demo Data

From `backend/`:

```bash
npm run seed:showcase-demo   # compliance data walkthrough
npm run seed:cmdb-demo       # CMDB asset sample data
```

Demo login:
- Email: `admin@professional.com`
- Password: `Test1234!`

---

## MCP Server

Connect ControlWeave to Claude Desktop, Cursor, or any MCP-compatible client:

```bash
cd backend && npm run mcp
```

Required env:
- `GRC_API_BASE_URL` (default: `http://localhost:3001/api/v1`)
- `GRC_API_TOKEN` (your JWT access token)

See [docs/MCP_SETUP.md](docs/MCP_SETUP.md) for full setup.

---

## Project Structure

```
controlweave/
├── backend/
│   ├── src/
│   │   ├── server.js              # Express server
│   │   ├── config/                # Database, security, tier policy
│   │   ├── middleware/            # Auth, rate limiting, validation
│   │   ├── routes/                # API route handlers
│   │   └── services/              # LLM, org context, subscriptions
│   ├── migrations/                # SQL migrations (run in order)
│   └── scripts/                   # Seeding and QA scripts
└── frontend/
    └── src/
        ├── app/                   # Next.js App Router pages
        │   ├── dashboard/         # All dashboard pages
        │   ├── login/
        │   └── register/
        ├── components/            # Shared components (AICopilot, Sidebar, etc.)
        ├── contexts/              # Auth context
        └── lib/                   # API client, access utilities
```

---

## Security

- bcrypt (12 rounds) password hashing
- JWT access (15 min) + refresh (7 day) tokens with hashed DB storage
- Account lockout after 5 failed login attempts (15-minute lock)
- IP-based rate limiting on auth endpoints
- Input sanitization (null bytes, script injection)
- 2 MB request body limit
- Security headers: HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy
- Parameterized queries (no SQL injection surface)
- RBAC on all protected routes

---

## Operational Commands

From `backend/`:

```bash
npm run migrate        # Run pending migrations
npm run audit:check    # npm audit (moderate+ severity)
npm run db:capacity    # Check DB size thresholds
npm run mcp            # Start MCP server
```

---

## License

[MIT](LICENSE)

---

## Contributing

Issues and pull requests welcome. For major changes, open an issue first to discuss.
