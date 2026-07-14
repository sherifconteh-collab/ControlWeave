# ControlWeaver Pro — Claude Code Instructions

## Project Overview

**ControlWeaver** is an AI-powered Governance, Risk, and Compliance (GRC) platform. Multi-framework compliance with crosswalk intelligence, evidence automation, and AI-assisted operations.

**Stack:** Express.js (Node.js 20+) backend, Next.js 16+ (TypeScript) frontend, PostgreSQL 17+ (required minimum; latest stable recommended), Railway deployment.

## Critical Rules

### Database

- All queries use parameterized SQL (`$1`, `$2`, etc.) via the `pg` library — never concatenate user input
- No ORM — direct SQL queries only via the `pg` pool (import with `const pool = require('../config/database')` from `src/routes`/`src/services`, or `require('./config/database')` from `src/server.js`)
- Migrations in `controlweave/backend/migrations/` — sequentially numbered (001–100+)
- All user-facing queries must filter by `organization_id` for multi-tenant isolation
- Use explicit `BEGIN`/`COMMIT` for multi-step operations

### Authentication & Security

- JWT-based auth with refresh tokens — middleware in `controlweave/backend/src/middleware/auth.js`
- Password hashing via bcryptjs
- Security headers set manually in `server.js` (CSP, HSTS, X-Frame-Options) — no helmet package
- Rate limiting via `controlweave/backend/src/middleware/rateLimit.js`
- All significant actions must be audit-logged for AU-2 compliance

### Code Style

- **Backend**: Vanilla JavaScript (ES6+), CommonJS (`require`/`module.exports`), async/await
- **Frontend**: TypeScript strict mode, functional React components with hooks
- No `any` types in frontend code — use `unknown` and narrow safely
- American English only (e.g., "categorized" not "categorised")
- No emojis in code or comments

### Architecture

- Multi-tenant: queries MUST filter by `organization_id`
- Fully open source: all tier gating was removed — every feature is available to every authenticated user. Do not add `requireTier()`/`requireProEdition()` calls to new routes. See `.claude/rules/tier-system.md`.
- AI features are optional — core platform works without API keys
- BYOK (Bring Your Own Key) support for LLM providers

## File Structure

```
controlweave/
  backend/
    src/
      config/        # database.js, security.js
      middleware/     # auth.js, rateLimit.js, auditLog.js, validate.js, sod.js
      routes/        # Route modules (ai.js, assessments.js, controls.js, etc.)
      services/      # Business logic (llmService.js, emailService.js, etc.)
      utils/         # Shared utilities (logger.js, etc.)
    migrations/      # 100+ sequential SQL migration files
    scripts/         # Seed scripts, QA scripts, utilities
  frontend/
    src/
      app/           # Next.js App Router pages
      components/    # React components
      lib/           # Utilities, API clients, types
```

## Build & Test Commands

```bash
# Backend (from controlweave/backend/)
npm run dev              # Start dev server with nodemon
npm run check:syntax     # Syntax validation (run before every commit)
npm run migrate          # Run all database migrations
npm run audit:check      # npm audit for vulnerabilities

# Frontend (from controlweave/frontend/)
npm run dev              # Start Next.js dev server
npm run build            # Production build
npm run typecheck        # TypeScript compiler check
npm run lint             # ESLint

# QA (from controlweave/backend/)
npm run qa:e2e:dynamic   # Dynamic E2E tests
npm run qa:e2e:auditor   # Auditor workflow tests
```

## Key Patterns

### API Response Format

```javascript
// Success
res.json({ success: true, data: { ... } })

// Error
res.status(400).json({ error: 'Descriptive error message' })
```

### Database Query Pattern

```javascript
// From src/routes/ or src/services/ (use ../ to reach config/)
const pool = require('../config/database');
const result = await pool.query(
  'SELECT * FROM controls WHERE organization_id = $1 AND id = $2',
  [req.user.organization_id, req.params.id]
);
```

### Route Pattern

```javascript
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    // Always filter by organization_id
    const result = await pool.query(
      'SELECT * FROM table WHERE organization_id = $1',
      [req.user.organization_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
```

## Git Workflow

- **Branch naming**: `<type>/CW-<number>/<short-description>` (e.g., `feat/CW-42/add-rmf-dashboard`)
- **Commit format**: `<type>(<scope>): <description>` (e.g., `feat(rmf): add RMF lifecycle dashboard`)
- **Allowed types**: feat, fix, hotfix, security, refactor, migration, docs, test, chore, build, ci, perf, revert
- **Before committing**: Run `npm run check:syntax` (backend) and `npm run typecheck` (frontend)

## CI Pipeline (TEVV)

The CI runs 6 validation layers on every PR:
1. **Backend** — Syntax and IP hygiene
2. **Frontend** — Typecheck, API type generation, build
3. **Security** — npm audit (zero high-severity CVEs)
4. **TEVV-API** — Route registration, auth middleware, frontend API client coverage
5. **TEVV-DB** — Migration numbering, seed consistency, SQL validity
6. **TEVV-UI** — Dashboard page existence, UI↔API linkage, untested page detection

## Environment Variables

```bash
# Required (Backend)
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
JWT_SECRET=<min-32-chars>
CORS_ORIGIN=http://localhost:3000

# Required (Frontend)
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

---

## Agent Team

Specialized AI agents for ControlWeaver development are in `.openclaw/agents/`. See `.openclaw/AGENTS.md` for the full team roster and collaboration routing guide.
