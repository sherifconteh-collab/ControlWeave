# ControlWeave - GitHub Copilot Instructions

## Project Overview

ControlWeave is an AI-powered Governance, Risk, and Compliance (GRC) platform designed to help organizations manage multi-framework compliance with crosswalk intelligence, evidence automation, and AI-assisted operations.

## Repository Structure

```
controlweave/
├── backend/          # Express.js REST API server (Node.js)
├── frontend/         # Next.js web application (React/TypeScript)
├── controlweave-sdk/ # SDK for external integrations
└── docs/            # Documentation and guides
```

### Backend Structure (`controlweave/backend/`)
- **Language**: JavaScript (Node.js 18+)
- **Framework**: Express.js
- **Database**: PostgreSQL 17+
- **Port**: 3001 (default)
- **Entry Point**: `src/server.js`
- **Key Directories**:
  - `src/` - Application source code
  - `migrations/` - Database migration scripts
  - `scripts/` - Utility and seeding scripts
  - `uploads/` - File upload storage

### Frontend Structure (`controlweave/frontend/`)
- **Language**: TypeScript
- **Framework**: Next.js 16+ (React)
- **Port**: 3000 (default)
- **Key Directories**:
  - `src/` - Application source code
  - `public/` - Static assets
  - `scripts/` - Build and utility scripts

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Database**: PostgreSQL 17+ with direct SQL queries (no ORM)
- **Authentication**: JWT with bcryptjs
- **AI Integration**: Anthropic Claude, OpenAI, Google Gemini, xAI Grok, Groq, Ollama
- **File Processing**: multer, pdf-parse, mammoth, exceljs
- **MCP Server**: @modelcontextprotocol/sdk

### Frontend
- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (implied from Next.js setup)
- **HTTP Client**: Axios
- **Date Handling**: date-fns
- **WebAuthn**: @simplewebauthn/browser

## Build & Development

### Initial Setup
```bash
# Clone and navigate
cd controlweave

# Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with database credentials and API keys
npm run migrate          # Run all database migrations
node scripts/seed-frameworks.js  # Seed frameworks
node scripts/seed-missing-controls.js
node scripts/seed-cmdb-data.js

# Frontend setup
cd ../frontend
npm install
cp .env.example .env.local
# Edit .env.local with API URL
```

### Development Commands

**Backend** (`controlweave/backend/`):
```bash
npm run dev              # Start development server with nodemon
npm run build            # Build step (logs completion)
npm start               # Start production server
npm run migrate         # Run all migrations
npm run migrate:one     # Run single migration
npm run mcp             # Start MCP server
```

**Frontend** (`controlweave/frontend/`):
```bash
npm run dev             # Start Next.js dev server
npm run build           # Production build
npm start              # Start production server
npm run lint           # Run ESLint
npm run typecheck      # Run TypeScript compiler check
```

### Testing & QA

**Backend Testing**:
```bash
npm run qa:e2e:dynamic           # Dynamic E2E orchestrator (syntax, mega, dynamic, auditor)
npm run qa:e2e:auditor          # Auditor workflow tests
npm run qa:mega-with-data       # Mega suite against seeded demo data
npm run qa:crosswalk:live       # Crosswalk verification
npm run check:syntax            # Syntax validation
npm run check:ip-hygiene        # IP hygiene check
npm run audit:check             # npm audit check
```

**No formal unit test framework** is configured. Testing is primarily done through:
- E2E test scripts in `backend/scripts/`
- Manual QA workflows
- Syntax and hygiene checks

## Coding Conventions

### JavaScript (Backend)
- **Style**: Standard ES6+ JavaScript, no semicolons enforced
- **Modules**: CommonJS (`require`/`module.exports`)
- **Async**: Prefer `async/await` over callbacks
- **Error Handling**: Try-catch blocks with proper error responses
- **Naming**:
  - Files: kebab-case (e.g., `seed-frameworks.js`)
  - Variables/Functions: camelCase
  - Classes: PascalCase (rare in this codebase)
  - Constants: UPPER_SNAKE_CASE for true constants

### TypeScript (Frontend)
- **Style**: TypeScript strict mode
- **Components**: Functional React components with hooks
- **File Extensions**: `.tsx` for components, `.ts` for utilities
- **Naming**:
  - Components: PascalCase (e.g., `DashboardLayout.tsx`)
  - Files: PascalCase for components, camelCase for utilities
  - Hooks: Prefix with `use` (e.g., `useAuth`)

### Database
- **Migrations**: Sequential numbered files in `backend/migrations/`
- **Queries**: Direct SQL with parameterized queries (use `$1`, `$2`, etc.)
- **No ORM**: Raw PostgreSQL queries via `pg` library
- **Transactions**: Use explicit BEGIN/COMMIT for multi-step operations

## Key Features & Modules

### Compliance Frameworks
- Supports 15+ frameworks: NIST 800-53, ISO 27001, SOC 2, GDPR, HIPAA, etc.
- 500+ controls with crosswalk mappings
- Framework selection per organization

### AI Features
- BYOK (Bring Your Own Key) support for multiple LLM providers
- 25+ AI analysis features (gap analysis, compliance forecast, etc.)
- AI Copilot with org-aware context
- Configurable per organization in Settings → LLM Configuration

### Assessment & Audit
- 186 assessment procedures across frameworks
- Three depths: Basic, Focused, Comprehensive
- NIST-standard outcomes (Satisfied/Other Than Satisfied/Not Applicable)
- External auditor workspace with engagements and findings

### CMDB (Asset Management)
- Asset types: Hardware, Software, AI Agents, Service Accounts, Environments, Password Vaults
- SBOM/AIBOM support
- Vulnerability tracking with CVSS scoring

## Environment Configuration

### Backend `.env` (Required Variables)
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
PORT=3001
NODE_ENV=development
JWT_SECRET=<long-random-string>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

### Frontend `.env.local` (Required Variables)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_APP_NAME=ControlWeave
```

## Security Guidelines

- **Authentication**: JWT-based auth with refresh tokens
- **Password Hashing**: bcryptjs with appropriate salt rounds
- **API Keys**: Store in environment variables, never commit to git
- **CORS**: Explicitly configured, no wildcards in production
- **SQL Injection**: Always use parameterized queries
- **Input Validation**: Validate and sanitize all user inputs
- **Audit Logging**: Log all significant user actions

## API Conventions

### REST API Structure
- **Base URL**: `/api/v1`
- **Authentication**: `Authorization: Bearer <token>` header
- **Response Format**: JSON with consistent structure
- **Success Response**: `{ success: true, data: {...} }`
- **Error Response**: `{ error: "message" }` with appropriate HTTP status

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Common Patterns

### Database Connection
```javascript
const { pool } = require('./config/database');
const result = await pool.query('SELECT * FROM table WHERE id = $1', [id]);
```

### JWT Middleware
```javascript
const jwt = require('jsonwebtoken');
// Verify token in middleware
const token = req.headers.authorization?.split(' ')[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

### AI Provider Integration
- Abstract provider-specific logic in `src/services/llm/`
- Support multiple providers with fallback logic
- Respect tier limits and BYOK configurations

## File Naming Conventions

- **Backend Scripts**: `kebab-case.js` (e.g., `seed-frameworks.js`)
- **Backend Source**: `kebab-case.js` or `camelCase.js`
- **Frontend Components**: `PascalCase.tsx`
- **Frontend Utilities**: `camelCase.ts`
- **Config Files**: `kebab-case` or `lowercase`

## Deployment

- **Platform**: Railway (primary), with nixpacks configuration
- **Configuration**: `nixpacks.toml` and `railway.json` in root and subdirectories
- **Database**: Managed PostgreSQL recommended
- **Environment Variables**: Set in Railway dashboard or `.env` files

## Documentation

- **Main README**: `controlweave/README.md` - Full feature documentation
- **Quick Start**: `controlweave/QUICK_START.md` - Setup guide
- **Docs Directory**: `controlweave/docs/` - Additional guides
- **Root MD Files**: Various feature summaries and implementation notes

## Pull Request & Commit Guidelines

### Commit Messages
- Use descriptive, imperative mood messages
- Example: "Add audit logging for user actions"
- Avoid: "Added stuff", "Fix bug"

### Code Review Focus
- Minimal changes to achieve the goal
- Maintain existing code style and patterns
- Ensure database migrations are reversible when possible
- Verify environment variable documentation is updated
- Test with both development and production-like data

### Testing Before Merge
- Run `npm run check:syntax` in backend
- Run `npm run typecheck` in frontend
- Test affected endpoints manually
- Verify database migrations work on clean database

## Important Notes

- **No TypeScript in Backend**: Backend uses vanilla JavaScript
- **No ORM**: Direct SQL queries only
- **AI Features Optional**: Core platform works without AI API keys
- **Multi-Tenant**: Organizations are isolated, queries must filter by `organization_id`
- **Tier System**: Free, Starter, Professional, Enterprise tiers with feature limits
- **Audit Logging**: Must log significant actions for AU-2 compliance
- **Performance**: Consider query optimization for large datasets (500+ controls)

## References

- Quick Start Guide: `controlweave/QUICK_START.md`
- Railway Deployment: `RAILWAY_DEPLOYMENT_GUIDE.md`
- Tier Policies: `TIER_POLICY_GUIDE.md`
- Performance Monitoring: `PERFORMANCE_MONITORING_GUIDE.md`
