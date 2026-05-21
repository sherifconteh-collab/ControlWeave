---
description: PostgreSQL database conventions for ControlWeaver
globs:
  - "**/*.sql"
  - "**/migrations/**"
  - "**/routes/**"
  - "**/services/**"
---
# Database Conventions

## Query Pattern

All database access uses the `pg` library pool with parameterized queries:

```javascript
// From src/routes/ or src/services/ (use ../ to reach config/)
const pool = require('../config/database');

// Single row
const { rows: [control] } = await pool.query(
  'SELECT * FROM controls WHERE id = $1 AND organization_id = $2',
  [id, orgId]
);

// Multiple rows
const { rows } = await pool.query(
  'SELECT * FROM controls WHERE organization_id = $1 ORDER BY created_at DESC',
  [orgId]
);
```

## Parameterized Queries Only

NEVER concatenate user input into SQL. Always use `$1`, `$2`, etc.:

```javascript
// NEVER
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ALWAYS
const query = 'SELECT * FROM users WHERE email = $1';
const result = await pool.query(query, [email]);
```

## Transactions

Use explicit BEGIN/COMMIT for multi-step operations:

```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO ...', [values]);
  await client.query('UPDATE ...', [values]);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## Migration Conventions

- Location: `controlweave/backend/migrations/`
- Naming: Sequential numbers (`001_initial_schema.sql`, `002_add_column.sql`)
- Run with: `npm run migrate` (all) or `npm run migrate:one` (single)
- Every migration must be forward-only in production
- Never edit a migration that has been deployed
- New columns should be nullable or have a default — never add NOT NULL without a default on existing tables
- Create indexes concurrently for large tables: `CREATE INDEX CONCURRENTLY`

## Query Optimization

- Use LATERAL JOIN instead of correlated subqueries for performance
- Use `COUNT(DISTINCT ...)` to prevent row inflation from many-to-many joins
- Always include `LIMIT` on user-facing list queries
- Use cursor-based pagination (`WHERE id > $last_id ORDER BY id LIMIT N`) for large datasets instead of OFFSET
- Index all foreign keys and frequently filtered columns

## Index Quick Reference

| Query Pattern | Index Type | Example |
|--------------|------------|---------|
| `WHERE status = 'active'` | B-tree | `CREATE INDEX idx_controls_status ON controls (status)` |
| `WHERE status = 'x' AND created_at > y` | Composite | `CREATE INDEX idx_controls_status_created ON controls (status, created_at)` |
| `WHERE metadata @> '{}'` | GIN | `CREATE INDEX idx_controls_metadata ON controls USING gin (metadata)` |
| Time-series ranges | BRIN | `CREATE INDEX idx_audit_logs_created ON audit_logs USING brin (created_at)` |

## Data Type Conventions

| Use Case | Type | Avoid |
|----------|------|-------|
| Primary keys | `uuid` or `bigint` | `int` |
| Strings | `text` | `varchar(255)` |
| Timestamps | `timestamptz` | `timestamp` (without timezone) |
| Money/scores | `numeric(10,2)` | `float` |
| Flags | `boolean` | `varchar`, `int` |
