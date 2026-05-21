---
description: REST API design conventions for ControlWeaver
globs:
  - "controlweave/backend/src/routes/**"
  - "controlweave/frontend/src/lib/**"
---
# API Design Conventions

## URL Structure

All routes are under `/api/v1`:

```
GET    /api/v1/controls
GET    /api/v1/controls/:id
POST   /api/v1/controls
PUT    /api/v1/controls/:id
DELETE /api/v1/controls/:id
```

## Response Format

### Success
```javascript
res.json({ success: true, data: result.rows });
res.status(201).json({ success: true, data: newRecord });
```

### Error
```javascript
res.status(400).json({ error: 'Descriptive error message' });
res.status(401).json({ error: 'Unauthorized' });
res.status(403).json({ error: 'Forbidden' });
res.status(404).json({ error: 'Resource not found' });
res.status(500).json({ error: 'Internal server error' });
```

## Route File Structure

Every route file follows this pattern:

```javascript
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET list — always paginate, always filter by org
router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    const result = await pool.query(
      'SELECT * FROM table WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.user.organization_id, limit, offset]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
```

## HTTP Status Codes

| Code | Use For |
|------|---------|
| 200 | GET success, PUT/PATCH success |
| 201 | POST success (resource created) |
| 400 | Validation failure, malformed request |
| 401 | Missing or invalid authentication |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Duplicate entry, state conflict |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error (never expose details) |

## Authentication

All routes must use the `authenticate` middleware unless they are explicitly public (health checks, auth endpoints).

The middleware attaches `req.user` with: `id`, `email`, `organization_id`, `role`.

## Pagination

List endpoints must support pagination:
- Query params: `page` (default 1), `limit` (default 50)
- For large datasets, prefer cursor-based pagination over OFFSET

## Input Validation

Validate all inputs before processing. Use the `validate` middleware or manual checks:

```javascript
if (!name || typeof name !== 'string' || name.trim().length === 0) {
  return res.status(400).json({ error: 'Name is required' });
}
```

## Route Registration

New routes must be registered in `controlweave/backend/src/server.js`. The TEVV-API CI check will fail if a route file exists but is not registered.
