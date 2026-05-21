---
description: Code review standards for ControlWeaver
globs:
  - "**/*"
---
# Code Review Standards

## Review Checklist

Before marking code complete:

- [ ] Code is readable and well-named (camelCase vars and source files; kebab-case for scripts only)
- [ ] Functions are focused (<50 lines)
- [ ] Files are cohesive (target <800 lines for new or significantly modified files; avoid growing existing oversized files and refactor when practical)
- [ ] No deep nesting (>4 levels) — use early returns
- [ ] Errors handled explicitly with try-catch
- [ ] No hardcoded secrets or credentials
- [ ] No console.log or debug statements (use project logger)
- [ ] All SQL queries use parameterized arguments (`$1`, `$2`)
- [ ] All queries scoped to `organization_id`
- [ ] New routes registered in `server.js`
- [ ] `authenticate` middleware applied to protected routes
- [ ] Frontend components use TypeScript strict (no `any`)

## Security Review Triggers

STOP and do a thorough security review when changing:

- Authentication or authorization code (`middleware/auth.js`)
- User input handling or file uploads
- Database queries or migrations
- Rate limiting or CORS configuration
- Payment or billing code
- API key or secret management
- Audit logging

## Severity Levels

| Level | Meaning | Action |
|-------|---------|--------|
| CRITICAL | Security vulnerability, data leak risk, missing org isolation | **BLOCK** — must fix |
| HIGH | Bug, missing auth check, unparameterized SQL | **BLOCK** — must fix |
| MEDIUM | Performance issue, missing error handling | **WARN** — should fix |
| LOW | Style, naming, minor improvement | **NOTE** — optional |

## Common Issues to Catch

### Security
- Missing `organization_id` filter (multi-tenant data leak)
- String concatenation in SQL queries (injection)
- Missing `authenticate` middleware on routes
- Secrets or API keys in source code
- Stack traces or SQL errors exposed to users

### Performance
- N+1 queries — use JOINs or batch queries
- Missing pagination on list endpoints
- Missing indexes on filtered/joined columns
- Unbounded queries without LIMIT

### Code Quality
- Large functions (>50 lines) — split into smaller
- Missing error handling in async routes
- `any` types in TypeScript frontend code
- Mutation instead of immutable patterns
