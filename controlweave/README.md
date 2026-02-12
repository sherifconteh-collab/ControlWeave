# ControlWeave — Community Edition

Open source, self-hostable GRC (Governance, Risk, and Compliance) platform. Free tier features, no subscription required.

> **Looking for the full-featured hosted product?** Visit [app.controlweave.io](https://app.controlweave.io) for ControlWeave Pro — unlimited frameworks, CMDB, evidence management, reports, vulnerability tracking, auditor workspace, and more.

---

## What's Included (Free Tier)

### Compliance Frameworks
- **Up to 10 active compliance frameworks** from the full catalog (NIST 800-53, NIST CSF 2.0, ISO 27001, SOC 2, HIPAA, GDPR, EU AI Act, OWASP LLM Top 10, OWASP Agentic AI Top 10, and more)
- **500+ controls** with crosswalk mappings between frameworks
- **33 crosswalk mappings** — implement one control, satisfy equivalents across frameworks automatically
- **Control implementation tracking** — forward-only workflow: Not Started → In Progress → Implemented → Verified (auditor-only)
- **Control testing** — record test results and notes per control implementation

### Assessment & Audit
- **Assessment procedures** (view and run) — NIST SP 800-53A, ISO 19011, SOC 2, HIPAA, GDPR methodology
- **Three assessment depths** — Basic, Focused, Comprehensive
- **Assessment plans** — create and schedule assessment campaigns
- **Result recording** — Satisfied / Other Than Satisfied / Not Applicable

### AI Analysis (10 requests/month)
Bring your own API key (BYOK) for any supported provider. 10 AI requests/month on the platform key.
All AI calls are logged with full accountability — provider, model, tokens, duration, success/failure, and BYOK status.

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

BYOK keys are **org-scoped** — set once by the admin, shared by all org members automatically. Keys are stored encrypted (AES-256-GCM) at rest.

### Core Platform
- **Dashboard** — compliance overview, framework progress, priority actions
- **NIST Publications Library** — 62 publication references with control mappings
- **Audit log** — complete trail of all actions (moved to Settings → Audit Logs)
- **Operations Center** — POA&M tracking, vulnerability management, controls at risk
- **MCP server** — connect to Claude Desktop, Cursor, and other MCP-compatible LLM clients
- **Organization multi-tenancy** — full data isolation per organization
- **RBAC** — Admin, Auditor, Viewer, and custom roles

---

## Tier Feature Matrix

| Feature | Free | Starter | Professional | Enterprise |
|---------|------|---------|-------------|------------|
| Active frameworks | 10 | 20 | Unlimited | Unlimited |
| AI requests/month | 10 | 50 | Unlimited (BYOK) | Unlimited (BYOK) |
| Passkeys | — | — | ✓ | ✓ |
| SSO (OIDC + Social) | — | — | ✓ | ✓ |
| SIEM integrations | — | — | ✓ | ✓ |
| CMDB / SBOM | — | ✓ | ✓ | ✓ |
| Vulnerability tracking | — | ✓ | ✓ | ✓ |
| Auditor Workspace | — | ✓ | ✓ | ✓ |
| AI decision audit log | — | ✓ | ✓ | ✓ |

---

## Authentication

### Password + Passkeys
- Standard email/password login with JWT access (15 min) + refresh (7 day) tokens
- **Passkeys (WebAuthn)** — sign in with biometrics or hardware security key (Touch ID, Face ID, YubiKey); Professional+ plans

### Social OAuth Sign-In
When configured on the server, social login buttons appear on the login page automatically:
- Google
- Microsoft
- Apple
- GitHub

### Enterprise SSO (OIDC)
Per-org OIDC single sign-on — works with **any** OIDC-compatible IdP:
- Okta, Azure AD, Auth0, Keycloak, PingIdentity, OneLogin, Dex, Cognito, and more
- Auto-provision users on first sign-in
- Configurable default role for provisioned users

---

## AI Accountability & Auditability

All AI usage is tracked with full accountability (applies to every tier, including free):

- **Per-call log**: org, user, feature, provider, model, BYOK status, tokens in/out, duration, success/failure, IP address
- **Decision log**: SHA-256 hash of inputs and outputs for 7 high-stakes features; records model version, correlation ID, session ID, and regulatory framework mapping
- **Bias tracking**: lightweight heuristic detection flags potential bias in executive reports, vendor risk assessments, and remediation playbooks; human review workflow with fairness notes
- **EU AI Act readiness**: bias coverage metrics in `/ai/status` — decisions with flags, flags reviewed, high-risk unreviewed
- **Human review workflow**: admins can approve/reject/flag AI decisions and record outcomes (Settings → AI Decisions tab)
- **Audit trail**: key add/remove events logged to the org audit log
- **Usage reporting**: query AI activity with filters (Settings → AI Activity tab)
- **Org-shared BYOK**: one API key configured by the admin is available to all org members — no per-user key setup needed

---

## Notifications

Event-driven in-app notifications with optional email delivery:

- **Triggers**: control status changes to verified, POA&M item created, control due reminders, assessment needed, crosswalk recommendations
- **Per-user preferences**: each user can toggle in-app and email delivery per notification type (Settings → Notifications tab)
- **Email delivery**: disabled by default; set `SMTP_HOST` + related env vars to enable (see `.env.example`)
- **Notification bell**: unread count badge in the sidebar; full notification center at `/dashboard/notifications`

---

## SIEM Integration (Professional+)

Forward compliance events to your SIEM. Supports multiple concurrent targets:

| Provider | Protocol |
|----------|---------|
| **Splunk** | HTTP Event Collector (HEC) |
| **Elastic** | Elasticsearch HTTP API (any version) |
| **Webhook** | Generic HTTPS POST JSON — works with Datadog, Sumo Logic, Microsoft Sentinel, Chronicle, Tines, and more |
| **Syslog** | UDP / TCP / TLS — compatible with rsyslog, syslog-ng, Graylog, QRadar |

Configure in Settings → Integrations.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16+, TypeScript, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| AI | Anthropic Claude, OpenAI, Google Gemini, xAI Grok, Groq, Ollama |
| Auth | JWT, bcrypt (12 rounds), WebAuthn (passkeys), OIDC (SSO) |
| Encryption | AES-256-GCM (BYOK keys, SSO secrets, SIEM credentials) |
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
# Edit backend/.env — set DATABASE_URL, JWT_SECRET, and ENCRYPTION_KEY at minimum

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

# BYOK key encryption — generate with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=

# Optional: platform-level AI key (users can also BYOK in Settings)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434/v1

# WebAuthn / Passkeys (Professional+)
WEBAUTHN_RP_NAME=ControlWeave
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:3000

# Social OAuth (optional — enables social sign-in buttons)
# Set callback URL to: <BACKEND_URL>/api/v1/sso/callback/<provider>
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
BACKEND_URL=http://localhost:3001
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
│   │   └── services/              # LLM, passkeys, SSO, SIEM, subscriptions
│   ├── migrations/                # SQL migrations (run in order, 001–042)
│   └── scripts/                   # Seeding and QA scripts
└── frontend/
    └── src/
        ├── app/                   # Next.js App Router pages
        │   ├── dashboard/         # All dashboard pages
        │   ├── login/             # Login + SSO callback
        │   └── register/
        ├── components/            # Shared components (AICopilot, Sidebar, etc.)
        ├── contexts/              # Auth context (login, loginWithTokens, logout)
        └── lib/                   # API client, access utilities
```

---

## Security

- bcrypt (12 rounds) password hashing
- JWT access (15 min) + refresh (7 day) tokens with hashed DB storage
- Account lockout after 5 failed login attempts (15-minute lock)
- IP-based rate limiting on auth endpoints
- Input sanitization (null bytes, script injection)
- AES-256-GCM encryption for BYOK API keys, SSO client secrets, and SIEM credentials
- WebAuthn (FIDO2) passkey support — phishing-resistant authentication
- 2 MB request body limit
- Security headers: HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy
- Parameterized queries (no SQL injection surface)
- RBAC on all protected routes
- Tier enforcement on premium features (passkeys, SSO, SIEM at Professional+)

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
