# Quick Start Guide

Get the ControlWeave running locally in under 10 minutes.

## Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org/))
- **PostgreSQL** 14+ ([download](https://www.postgresql.org/download/))
- **Git** ([download](https://git-scm.com/))

Optional (for AI features):
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com/))
- OpenAI API key ([platform.openai.com](https://platform.openai.com/))
- Google Gemini API key ([aistudio.google.com](https://aistudio.google.com/))
- xAI API key ([console.x.ai](https://console.x.ai/))

## 1. Clone & Install

```bash
git clone https://github.com/your-org/ai-grc-platform.git controlweave
cd controlweave
```

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd ../frontend
npm install
```

## 2. Configure Database

Create a PostgreSQL database:

```sql
CREATE DATABASE grc_platform;
```

### Backend Environment

Copy the example env file and update it:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
# Database (recommended: managed Postgres URL)
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<db>?sslmode=require
DB_SSL_MODE=require
DB_SSL_REJECT_UNAUTHORIZED=true

# Local fallback (if DATABASE_URL is not set)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=grc_platform
DB_USER=postgres
DB_PASSWORD=your_password_here

# Server
PORT=3001
NODE_ENV=development

# JWT
JWT_SECRET=change-this-to-a-long-random-string
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Frontend URL (for CORS)
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# Optional platform-level AI keys
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
GEMINI_API_BASE=https://generativelanguage.googleapis.com/v1beta
XAI_API_KEY=
XAI_API_BASE=https://api.x.ai/v1

# Optional: enforce tier limits even when org uses BYOK
AI_LIMIT_APPLIES_TO_BYOK=false
```

### Frontend Environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_APP_NAME=ControlWeave
```

## 3. Run Migrations

From the `backend/` directory:

```bash
npm run migrate
```

For full production order + backup/threshold settings, see:
- `docs/SMALL_START_DEPLOYMENT_PROFILE.md`

## 4. Seed Data

From the `backend/` directory:

```bash
# Seed 15 currently shipped frameworks with 500+ controls and 33 crosswalk mappings
node scripts/seed-frameworks.js

# Add missing control families (NIST 800-53 all 20 families, expanded ISO 27001 & NIST CSF)
node scripts/seed-missing-controls.js

# Seed CMDB sample data
node scripts/seed-cmdb-data.js

# Seed 114 assessment procedures across 6 frameworks
node scripts/seed-assessment-procedures.js

# Seed 72 additional assessment procedures for expanded controls
node scripts/seed-assessment-procedures-expansion.js
```

After seeding, your database will contain:
- **14 currently seeded frameworks plus 1 reference model** (NIST 800-53, NIST CSF 2.0, ISO 27001, SOC 2, NIST 800-171, NIST Privacy, FISCAM, NIST AI RMF, GDPR, HIPAA, FFIEC, NERC CIP, EU AI Act, ISO 42001, and the NIST SP 800-207 Zero Trust Architecture reference model)
- **500+ controls** across all frameworks
- **186 assessment procedures** (NIST 800-53A, ISO 19011, SOC 2 Type II, HIPAA, GDPR)
- **33 crosswalk mappings** between frameworks

## 5. Start the Application

### Terminal 1 — Backend
```bash
cd backend
npm run dev
```

The API will be available at `http://localhost:3001`.
Verify with: `curl http://localhost:3001/health`

### Terminal 2 — Frontend
```bash
cd frontend
npm run dev
```

The UI will be available at `http://localhost:3000`.

## 6. First Login

1. Open `http://localhost:3000/register`
2. Create an account with your email, password, full name, and organization name
3. You'll be redirected to the dashboard
4. Go to **Frameworks** to select which compliance frameworks your organization follows
5. Browse **Controls** to see all controls across your selected frameworks
6. Click any control to see crosswalk mappings and assessment procedures

## 7. Configure AI (Optional)

To enable AI-powered analysis features:

1. Go to **Settings** > **LLM Configuration**
2. Enter your Anthropic, OpenAI, Gemini, and/or xAI Grok API key
3. Click **Test** to verify the key works
4. Select your default provider and model
5. Go to **AI Analysis** to run gap analysis, compliance forecasts, and more

## 8. Run MCP Server (Optional)

If you want users to access the platform from MCP-capable LLM clients:

```bash
cd backend
GRC_API_BASE_URL=http://localhost:3001/api/v1 GRC_API_TOKEN=<JWT_ACCESS_TOKEN> npm run mcp
```

On PowerShell:

```powershell
$env:GRC_API_BASE_URL='http://localhost:3001/api/v1'
$env:GRC_API_TOKEN='<JWT_ACCESS_TOKEN>'
npm run mcp
```

## Common Issues

### Database connection failed
- Ensure PostgreSQL is running: `pg_isready`
- Verify `DATABASE_URL` (or `DB_*` fallback) in `backend/.env`
- Check the database exists: `psql -U postgres -l`

### Port already in use
- Backend default is 3001, frontend default is 3000
- Change with `PORT=3002 npm run dev` or in `.env`

### CORS errors
- Ensure `CORS_ORIGIN` in `backend/.env` matches your frontend URL
- Default: `http://localhost:3000`

### AI features not working
- Verify API key is saved in Settings > LLM Configuration
- Click the Test button to validate the key
- Check backend logs for API errors
- Free tier is limited to 3 AI calls per month

## Architecture Overview

```
┌─────────────────────┐     ┌──────────────────────┐
│   Next.js Frontend  │────▶│   Express Backend    │
│   (port 3000)       │     │   (port 3001)        │
│                     │     │                      │
│ - Dashboard         │     │ - JWT Auth           │
│ - Controls          │     │ - REST API           │
│ - Assessments       │     │ - LLM Service        │
│ - AI Analysis       │     │                      │
│ - Settings          │     │   ┌──────────────┐   │
│ - Settings          │     │   │  PostgreSQL  │   │
└─────────────────────┘     │   │  (port 5432) │   │
                            │   └──────────────┘   │
                            │                      │
                            │   ┌──────────────┐   │
                            │   │ Anthropic /  │   │
                            │   │ OpenAI APIs  │   │
                            │   └──────────────┘   │
                            └──────────────────────┘
```

## Next Steps

- Read the full [README](README.md) for API documentation
- Configure role-based access under **Settings** > **Roles**
- Set up assessment plans under **Assessments**
