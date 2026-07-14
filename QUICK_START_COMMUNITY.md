# Controlweave — Self-Hosted Quick Start

Get a self-hosted Controlweave deployment up and running in under 15 minutes.

Controlweave is a fully functional, open source GRC (Governance, Risk, and Compliance)
platform. As of v4.0, all tier gating has been removed — every feature described below is
available to every authenticated user on a self-hosted deployment, under the AGPL v3 /
commercial dual license (see [LICENSE](LICENSE)). There is no separate "Community edition"
product tier to unlock; this guide is simply about standing up your own instance.

## What You Get

### Core Compliance Management
- **Framework Support** — NIST 800-53, ISO 27001, SOC 2, GDPR, HIPAA, PCI DSS, and more
- **Control Management** — 500+ pre-loaded controls with implementation tracking
- **Control Crosswalks** — automatic mapping between frameworks (implement once, satisfy many)
- **Control Health** — real-time health scoring based on evidence and assessments
- **Control Exceptions** — track approved exceptions with expiry dates

### Assessment & Audit Workflows
- **Assessment Procedures** — 186 procedures based on NIST 800-53A, ISO 19011, SOC 2, HIPAA, GDPR
- **Assessment Plans** — create and track assessment campaigns
- **Results Recording** — NIST-standard outcomes (Satisfied / Other Than Satisfied / Not Applicable)
- **Auditor Workspace** — dedicated portal for external auditors
- **Audit Logging** — complete trail of all user actions for AU-2 compliance

### AI-Powered Analysis (optional — the platform works without any API key configured)
- **AI Copilot** — organization-aware conversational assistant
- **Gap Analysis** — identify compliance gaps across frameworks
- **Crosswalk Optimizer** — find overlap opportunities to reduce duplicate work
- **Compliance Forecast** — predict compliance trajectory
- **Remediation Playbooks** — generate step-by-step remediation plans
- **Risk Heatmaps** — visualize risk across control families
- **BYOK Support** — bring your own key for Anthropic, OpenAI, Google, xAI, Groq, or Ollama

### User & Access Management
- **User Management** — create and manage user accounts
- **Role-Based Access Control** — custom roles with granular permissions
- **Multi-Organization** — support multiple organizations in a single deployment
- **Passkeys/WebAuthn** — modern passwordless authentication

### Policy & Risk Management
- **Policy Management** — create and track organizational policies
- **POAM** — Plan of Action & Milestones for remediation tracking
- **Policy Engine** — automate policy enforcement
- **Implementation Tracking** — track control implementation status and assignments

### Developer Features
- **REST API** — complete API for programmatic access
- **MCP Server** — Model Context Protocol support for LLM integration
- **Webhooks** — outbound webhooks for external integrations
- **Performance Monitoring** — built-in application performance tracking

## Technology Stack

**Backend:** Node.js 18+, Express.js, PostgreSQL 17+ (no ORM, direct parameterized SQL), JWT
authentication with bcryptjs, multi-provider AI integration.

**Frontend:** Next.js 16+ (App Router), TypeScript (strict mode), Tailwind CSS.

## Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 17+
- **Git**
- Basic command line knowledge

## Step 1: Clone Repository

```bash
git clone https://github.com/your-org/controlweave.git
cd controlweave
```

## Step 2: Backend Setup

### Install Dependencies

```bash
cd backend
npm install
```

### Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Database (Option A: Connection URL)
DATABASE_URL=postgresql://user:password@localhost:5432/controlweave

# OR Option B: Individual fields
DB_HOST=localhost
DB_PORT=5432
DB_NAME=controlweave
DB_USER=postgres
DB_PASSWORD=your_password_here

# Server
PORT=3001
NODE_ENV=development

# JWT Secret (generate a random string, minimum 32 characters)
JWT_SECRET=your-secret-key-at-least-32-chars-long

# CORS
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

`EDITION` is a legacy environment variable kept for backward compatibility only — it no
longer gates any feature (see `.claude/rules/tier-system.md`), so you can leave it unset.

### Create Database

```bash
createdb controlweave
```

Or using psql:
```sql
CREATE DATABASE controlweave;
```

### Run Migrations

```bash
npm run migrate
```

This creates all necessary database tables.

### Seed Data

```bash
# Seed frameworks (NIST, ISO, SOC 2, etc.)
node scripts/seed-frameworks.js

# Seed control crosswalks
node scripts/seed-missing-controls.js

# Seed assessment procedures
node scripts/seed-assessment-procedures.js
```

### Start Backend

```bash
npm run dev
```

Backend will start on `http://localhost:3001`

## Step 3: Frontend Setup

In a new terminal:

```bash
cd frontend
npm install
```

### Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_APP_NAME=Controlweave
```

### Start Frontend

```bash
npm run dev
```

Frontend will start on `http://localhost:3000`

## Step 4: Create Your First Organization

1. Open browser to `http://localhost:3000`
2. Click **Register** (or navigate to `/register`)
3. Fill in:
   - First Name
   - Last Name
   - Email
   - Password
   - Organization Name
4. Click **Create Account**

You'll be logged in automatically!

## Step 5: Select Frameworks

1. Go to **Frameworks** in the sidebar
2. Click **Add Framework**
3. Select frameworks you want to comply with:
   - NIST 800-53
   - ISO 27001
   - SOC 2
   - GDPR
   - HIPAA
   - PCI DSS
   - Or others
4. Click **Save**

## Step 6: Start Managing Controls

1. Go to **Controls** in the sidebar
2. See all controls from your selected frameworks
3. Click on a control to:
   - View details
   - Add implementation notes
   - Link evidence
   - Create assessments
   - Track status

## What's Next?

### Configure AI Analysis (Optional)

If you want AI-powered features:

1. Get an API key from one of:
   - Anthropic Claude
   - OpenAI
   - Google Gemini
   - xAI Grok
   - Groq
   - Ollama (self-hosted)

2. Go to **Settings** → **LLM Configuration**
3. Select provider and enter your API key
4. Test connection
5. Use AI Copilot for:
   - Gap analysis
   - Compliance forecasting
   - Remediation playbooks
   - Risk heatmaps

### Set Up Users

1. Go to **Settings** → **Users**
2. Click **Add User**
3. Assign roles:
   - **Admin** — full access
   - **User** — can manage controls and evidence
   - **Auditor** — read-only access

### Create Assessment Plans

1. Go to **Assessments**
2. Click **New Assessment**
3. Select:
   - Framework (e.g., SOC 2)
   - Controls to assess
   - Assessment depth
   - Assignee
4. Follow assessment procedures
5. Record results

### Configure Auditor Workspace

1. Go to **Auditor Workspace**
2. Create engagement
3. Invite external auditors
4. Auditors get read-only access
5. Track findings and recommendations

### Set Up Policies

1. Go to **Policies**
2. Create organizational policies
3. Link to controls
4. Track approval and review dates

### Track Remediation (POAM)

1. Go to **POAM**
2. Create items for:
   - Control gaps
   - Audit findings
   - Exceptions
3. Assign owners
4. Set target dates
5. Track progress

## Common Tasks

### Adding Evidence

1. Navigate to a control
2. Click **Evidence** tab
3. Upload files:
   - Documents
   - Screenshots
   - Reports
   - Certificates
4. Add description
5. Link to implementations

### Running Gap Analysis

1. Click **AI Copilot** in top nav
2. Ask: "Analyze gaps in my SOC 2 compliance"
3. Review AI-generated report
4. Export recommendations

### Creating Custom Dashboards

1. Go to **Dashboard Builder**
2. Add widgets:
   - Control health
   - Framework coverage
   - Assessment status
   - Risk heatmap
3. Arrange layout
4. Save dashboard

### Exporting Data

Use the REST API:

```bash
# Get controls
curl http://localhost:3001/api/v1/controls \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get frameworks
curl http://localhost:3001/api/v1/frameworks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Architecture Notes

- **Security**: JWT-based authentication, role-based access control (RBAC), comprehensive
  audit logging, input validation and sanitization, parameterized SQL (no string
  interpolation), XSS protection, rate limiting.
- **Database schema**: organizations and users, frameworks and controls, control
  implementations and evidence, assessments and audit trails, policies and POAM items,
  performance metrics.
- **API design**: RESTful endpoints under `/api/v1`, consistent `{ success, data }` /
  `{ error }` response format, comprehensive error handling, rate limiting, request context
  tracking.

## Deployment to Production

### Environment Variables

Update production `.env`:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://prod-user:prod-pass@prod-host:5432/controlweave?ssl=true
JWT_SECRET=your-production-secret-very-long-and-random
CORS_ORIGIN=https://your-domain.com
FRONTEND_URL=https://your-domain.com
```

### Database

- Use managed PostgreSQL (recommended)
- Enable SSL/TLS
- Set up backups
- Configure connection pooling

### Build and Deploy

```bash
# Backend
cd backend
npm install --production
npm start

# Frontend
cd frontend
npm run build
npm start
```

### Deployment Platforms

Controlweave works on:
- Docker containers
- Railway
- Heroku
- AWS (EC2, ECS, Elastic Beanstalk)
- Google Cloud Platform
- Azure
- DigitalOcean
- Any Node.js hosting platform

### Scaling

- Horizontal scaling supported
- Load balancer compatible
- Session-less architecture
- Database connection pooling
- Performance monitoring included

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql postgresql://user:pass@host:5432/dbname

# Check PostgreSQL is running
sudo systemctl status postgresql

# Check logs
tail -f backend/logs/error.log
```

### Port Already in Use

```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 PID

# Or use different port
PORT=3002 npm run dev
```

### Migration Errors

```bash
# Check migration status
npm run migrate

# Rollback if needed
npm run migrate:rollback

# Run single migration
npm run migrate:one
```

### Frontend Can't Connect to Backend

1. Check backend is running on correct port
2. Verify CORS_ORIGIN in backend .env
3. Verify NEXT_PUBLIC_API_URL in frontend .env.local
4. Check browser console for errors

## Contributing

Contributions are welcome — code fixes and performance improvements, new framework support,
integration development (connectors, webhooks, MCP extensions, AI provider support), and
documentation improvements. See [CONTRIBUTING.md](CONTRIBUTING.md) for the process:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Getting Help

- **GitHub Issues** — report bugs
- **GitHub Discussions** — ask questions
- **Documentation** — read guides under `controlweave/docs/`
- Explore [docs/MCP_SETUP.md](docs/MCP_SETUP.md) for LLM integration
- Check [API Documentation](docs/openapi.yaml) for programmatic access

---

**You're all set!** Start managing your compliance with Controlweave.
