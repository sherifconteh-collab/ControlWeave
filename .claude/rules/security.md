---
description: Security guidelines for ControlWeaver GRC platform
globs:
  - "**/*.js"
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.sql"
---
# Security Guidelines

ControlWeaver is a GRC platform handling sensitive compliance data. Security is non-negotiable.

## Mandatory Checks Before Every Commit

- [ ] No hardcoded secrets (API keys, passwords, tokens, JWT secrets)
- [ ] All user inputs validated and sanitized
- [ ] SQL injection prevention — parameterized queries only (`$1`, `$2`, etc.)
- [ ] XSS prevention — sanitize any user-provided HTML
- [ ] All routes use `authenticate` middleware (from `../middleware/auth`)
- [ ] All queries filter by `organization_id` for multi-tenant isolation
- [ ] Error messages do not leak sensitive data (SQL errors, stack traces)
- [ ] Rate limiting applied to new endpoints
- [ ] Audit logging for significant user actions (AU-2 compliance)

## Secret Management

- NEVER hardcode secrets in source code
- Use environment variables — validate they exist at startup
- JWT_SECRET must be at least 32 characters in production
- Store API keys in `.env` files (which are gitignored)

## SQL Injection Prevention

```javascript
// NEVER do this
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ALWAYS do this
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);
```

## Multi-Tenant Isolation

Every database query that returns user-visible data MUST include an `organization_id` filter:

```javascript
// WRONG: Leaks data across organizations
const result = await pool.query('SELECT * FROM controls WHERE id = $1', [id]);

// CORRECT: Scoped to the user's organization
const result = await pool.query(
  'SELECT * FROM controls WHERE id = $1 AND organization_id = $2',
  [id, req.user.organization_id]
);
```

## Authentication Pattern

All API routes must require authentication unless explicitly public:

```javascript
const { authenticate } = require('../middleware/auth');

// Protected route
router.get('/data', authenticate, async (req, res) => { ... });

// Public routes are rare — document why authentication is not required
router.get('/health', async (req, res) => { ... }); // Health check — no auth needed
```

## Error Handling

Never expose internal details to users:

```javascript
// WRONG
catch (error) {
  res.status(500).json({ error: error.message, stack: error.stack });
}

// CORRECT
catch (error) {
  log('error', 'operation.failed', { error: serializeError(error) });
  res.status(500).json({ error: 'Internal server error' });
}
```
