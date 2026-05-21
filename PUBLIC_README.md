<p align="center">
  <h1 align="center">ControlWeave</h1>
  <p align="center"><strong>The Open Source AI Governance & GRC Platform</strong></p>
  <p align="center">
    Built for teams that need to govern AI systems across NIST AI RMF, NIST 800-53, EU AI Act, and more — without duct-taping spreadsheets to legacy GRC tools.
  </p>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-green.svg" alt="Node.js"></a>
  <a href="https://www.postgresql.org"><img src="https://img.shields.io/badge/postgresql-17%2B-blue.svg" alt="PostgreSQL"></a>
  <a href="https://github.com/sherifconteh-collab/ControlWeave/stargazers"><img src="https://img.shields.io/github/stars/sherifconteh-collab/ControlWeave?style=social" alt="Stars"></a>
</p>

---

## The Problem

Organizations adopting AI are stuck in a tooling gap:

- **NIST AI RMF** mandates TEVV (Test, Evaluate, Verify, Validate) workflows — but no GRC tool supports them
- **EU AI Act Article 17** requires quality management systems for high-risk AI — most teams track this in spreadsheets
- **NIST 800-53** controls (AC, SI, RA families) need AI-specific implementation guidance — existing platforms don't provide it
- **Agentic AI** introduces autonomous service accounts, decision-making boundaries, and novel attack surfaces — traditional GRC doesn't model any of this
- **Auditors** still chase evidence via screenshots and email threads — there's no automated ingestion pipeline

Every framework has its own tool. None of them talk to each other. CISOs and GRC Directors end up managing compliance across 3-4 disconnected systems while AI risks evolve monthly.

## What ControlWeave Does

ControlWeave is a unified AI governance platform that maps controls across frameworks, tracks AI-specific risks, and automates evidence collection — so your compliance posture keeps up with the speed of AI adoption.

### Multi-Framework Control Mapping
Map once, satisfy many. ControlWeave crosswalks controls across NIST AI RMF, NIST 800-53, EU AI Act Article 17, ISO 27001, SOC 2, HIPAA, GDPR, PCI DSS, and more. When you implement a control for one framework, ControlWeave automatically maps it to overlapping requirements in others.

### AI Risk Register
Register AI systems, models, and agents as first-class entities. Track model drift, data lineage, agentic autonomy boundaries, and AI-specific threats (prompt injection, model poisoning, data exfiltration). No other open-source GRC tool does this.

### TEVV Workflow Support
NIST AI RMF mandates Test, Evaluate, Verify, and Validate — but gives you zero tooling to actually do it. ControlWeave provides structured TEVV workflows with evidence linkage, outcome tracking, and audit trails.

### Assessment & Audit Engine
- 186 assessment procedures based on NIST 800-53A, ISO 19011, SOC 2, HIPAA, GDPR
- Assessment plans with campaign tracking
- NIST-standard outcomes (Satisfied / Other Than Satisfied / Not Applicable)
- Dedicated auditor workspace for external reviewers
- Complete audit logging for AU-2 compliance

### AI-Powered Analysis
- **AI Copilot** — Organization-aware assistant for compliance queries
- **Gap Analysis** — Identify compliance gaps across all your frameworks at once
- **Compliance Forecast** — Predict your compliance trajectory based on current velocity
- **Remediation Playbooks** — Generate step-by-step plans to close gaps
- **Risk Heatmaps** — Visualize risk distribution across control families
- **BYOK** — Bring Your Own Key (Anthropic, OpenAI, Google, xAI, Groq, Ollama)

### Policy & Risk Management
- Policy lifecycle management with approval workflows
- POAM (Plan of Action & Milestones) tracking
- Automated policy enforcement engine
- Control implementation assignments with status tracking

### Developer & Integration
- **REST API** — Full programmatic access to every feature
- **MCP Server** — Model Context Protocol support for LLM-native integration
- **Webhooks** — Outbound event notifications for your automation pipeline
- **Performance Monitoring** — Built-in APM with request-level tracking

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 17+
- Git

### Install

```bash
git clone https://github.com/sherifconteh-collab/ControlWeave.git
cd ControlWeave

# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials and JWT secret

npm run migrate
node scripts/seed-frameworks.js
node scripts/seed-missing-controls.js
node scripts/seed-assessment-procedures.js
npm run dev

# Frontend (new terminal)
cd ../frontend
npm install
cp .env.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

npm run dev
```

Open `http://localhost:3000` and you're in.

### Configuration

**Backend** (`.env`):
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/controlweave
JWT_SECRET=your-secret-key
PORT=3001
NODE_ENV=development
EDITION=community
```

**Frontend** (`.env.local`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_APP_NAME=ControlWeave
```

---

## Architecture

```
                    +------------------+
                    |   Next.js 16+    |
                    |   (TypeScript)   |
                    +--------+---------+
                             |
                        REST API
                             |
                    +--------+---------+
                    |   Express.js     |
                    |   (Node.js 18+)  |
                    +--------+---------+
                             |
               +-------------+-------------+
               |             |             |
          PostgreSQL    AI Providers    MCP Server
            17+        (BYOK multi-    (stdio transport)
                        provider)
```

**Security layers:** JWT auth, RBAC, audit logging, input validation, rate limiting, SQL injection prevention, XSS protection, security headers.

---

## Who Built This

ControlWeave was created by [Sherif Conteh (Jaja)](https://www.linkedin.com/in/sherifconteh/) — CISSP, FITSP-D, with 15+ years in federal and DoD cybersecurity. After years of watching teams struggle to apply AI governance frameworks with tools that were never designed for AI risks, he built the platform he wished existed.

This isn't a GRC tool with an "AI module" bolted on. It was designed from the ground up for AI governance.

---

## Deploy

ControlWeave runs anywhere Node.js does:

- **Docker** — Containerized deployment
- **Railway / Render / Heroku** — One-click cloud platforms
- **AWS / GCP / Azure** — Full cloud infrastructure
- **Self-hosted** — Your servers, your data, your rules

Horizontal scaling supported. Session-less architecture. Database connection pooling included.

---

## Contributing

We welcome contributions across every layer:

- **Frameworks** — Add new compliance frameworks or improve existing mappings
- **Controls** — Contribute control definitions and assessment procedures
- **Integrations** — Build connectors, webhook consumers, or MCP extensions
- **AI Providers** — Add support for new AI model providers
- **Documentation** — Setup guides, tutorials, use case examples

```bash
# Fork, branch, build, PR
git checkout -b feature/your-feature
# Make changes
git commit -m "Add your feature"
git push origin feature/your-feature
# Open a PR
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Community & Support

- [GitHub Issues](https://github.com/sherifconteh-collab/ControlWeave/issues) — Bug reports and feature requests
- [GitHub Discussions](https://github.com/sherifconteh-collab/ControlWeave/discussions) — Questions and community help
- [Contact](mailto:contehconsulting@gmail.com) — Business inquiries

---

## License

MIT. See [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>ControlWeave</strong> — AI governance that keeps up with AI.
</p>
