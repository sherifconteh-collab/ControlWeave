'use strict';

const express = require('express');
const { fakePgQuery, verifyToken, findingSchema } = require('../lib/fixtures');

function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing bearer token' });
  }
  try {
    req.user = verifyToken(header.slice(7));
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

function validateFinding(req, res, next) {
  const body = req.body || {};
  if (typeof body.title !== 'string' || body.title.length < 1 || body.title.length > findingSchema.properties.title.maxLength) {
    return res.status(400).json({ error: 'invalid title' });
  }
  if (!findingSchema.properties.severity.enum.includes(body.severity)) {
    return res.status(400).json({ error: 'invalid severity' });
  }
  if (body.description != null && (typeof body.description !== 'string' || body.description.length > findingSchema.properties.description.maxLength)) {
    return res.status(400).json({ error: 'invalid description' });
  }
  return next();
}

function build() {
  const app = express();
  app.use(express.json({ limit: '128kb' }));

  app.get('/api/v1/ping', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/v1/controls', authenticate, async (req, res) => {
    const result = await fakePgQuery(
      'SELECT * FROM framework_controls WHERE organization_id = $1 LIMIT 25',
      [req.user.organization_id]
    );
    res.json({ success: true, data: result.rows });
  });

  app.post('/api/v1/findings', authenticate, validateFinding, async (req, res) => {
    const result = await fakePgQuery(
      'INSERT INTO findings (organization_id, title, severity, description) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.user.organization_id, req.body.title, req.body.severity, req.body.description || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  });

  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: err.message || 'internal error' });
  });

  return app;
}

if (require.main === module) {
  const port = parseInt(process.env.PORT || '3011', 10);
  build().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[express-spike] listening on :${port}`);
  });
}

module.exports = { build };
