// Shared fixtures used by both the Express and Fastify benchmark apps so
// only framework overhead differs between them.

'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = 'spike-secret-do-not-use-in-production';
const PG_FAKE_LATENCY_MS = parseInt(process.env.PG_FAKE_LATENCY_MS || '2', 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Synthetic `pool.query` — sleeps to approximate in-region Postgres RTT
// without requiring a live DB.
async function fakePgQuery(sql /* , params */) {
  await sleep(PG_FAKE_LATENCY_MS);
  if (/INSERT/i.test(sql)) {
    return { rows: [{ id: 'finding_' + Math.random().toString(36).slice(2, 10) }], rowCount: 1 };
  }
  // Synthetic list response — 25 rows is the typical paginated page size.
  const rows = Array.from({ length: 25 }, (_, i) => ({
    id: `ctrl_${i}`,
    control_id: `AC-${i + 1}`,
    title: `Example control ${i + 1}`,
    description: 'Synthetic row for benchmark purposes only.',
    organization_id: 'org_demo',
  }));
  return { rows, rowCount: rows.length };
}

function signDemoToken() {
  return jwt.sign(
    {
      sub: 'user_demo',
      organization_id: 'org_demo',
      permissions: ['controls.read', 'assessments.write'],
    },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
}

// JSON schema shared by both apps for POST /findings.
const findingSchema = {
  type: 'object',
  required: ['title', 'severity'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 256 },
    severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    description: { type: 'string', maxLength: 4000 },
  },
};

module.exports = {
  JWT_SECRET,
  fakePgQuery,
  signDemoToken,
  verifyToken,
  findingSchema,
};
