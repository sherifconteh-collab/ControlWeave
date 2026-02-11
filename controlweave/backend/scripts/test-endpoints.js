/**
 * Quick endpoint smoke test
 * Run: node scripts/test-endpoints.js
 */
const http = require('http');

const BASE = 'http://localhost:3001';
let TOKEN = null;
let ORG_ID = null;
let passed = 0;
let failed = 0;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}: ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

async function run() {
  console.log('\n=== ControlWeave - Endpoint Tests ===\n');

  // Health
  await test('Health check', async () => {
    const r = await request('GET', '/health');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.status === 'healthy', 'Not healthy');
  });

  // Auth - Register (may fail if user exists, that's ok)
  await test('Auth: Register', async () => {
    const r = await request('POST', '/api/v1/auth/register', {
      email: 'smoketest@example.com',
      password: 'TestPass123!',
      full_name: 'Smoke Tester',
      organization_name: 'Smoke Test Org'
    });
    // 201 = new, 409 = already exists
    assert(r.status === 201 || r.status === 409, `Expected 201/409, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  // Auth - Login
  await test('Auth: Login', async () => {
    const r = await request('POST', '/api/v1/auth/login', {
      email: 'smoketest@example.com',
      password: 'TestPass123!'
    });
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.data?.accessToken, 'No access token');
    TOKEN = r.body.data.accessToken;
    ORG_ID = r.body.data.user.organizationId;
  });

  // Auth - Me
  await test('Auth: Get current user', async () => {
    const r = await request('GET', '/api/v1/auth/me', null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data?.email === 'smoketest@example.com', 'Wrong email');
  });

  // Auth - Refresh
  await test('Auth: Refresh token', async () => {
    const loginR = await request('POST', '/api/v1/auth/login', {
      email: 'smoketest@example.com', password: 'TestPass123!'
    });
    const refreshToken = loginR.body.data.refreshToken;
    const r = await request('POST', '/api/v1/auth/refresh', { refreshToken });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data?.accessToken, 'No new access token');
  });

  // Frameworks
  await test('Frameworks: List all', async () => {
    const r = await request('GET', '/api/v1/frameworks', null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.data), 'Data should be array');
    assert(r.body.data.length > 0, 'Should have frameworks');
    console.log(`         -> ${r.body.data.length} frameworks found`);
  });

  // Add frameworks to org
  await test('Organizations: Add frameworks', async () => {
    const fwR = await request('GET', '/api/v1/frameworks', null, TOKEN);
    const fwIds = fwR.body.data.slice(0, 2).map(f => f.id);
    const r = await request('POST', `/api/v1/organizations/${ORG_ID}/frameworks`, { frameworkIds: fwIds }, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  // Dashboard stats
  await test('Dashboard: Stats', async () => {
    const r = await request('GET', '/api/v1/dashboard/stats', null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data?.overall, 'Missing overall stats');
    assert(r.body.data?.frameworks, 'Missing framework breakdown');
    console.log(`         -> ${r.body.data.overall.totalControls} total controls, ${r.body.data.frameworks.length} frameworks`);
  });

  // Dashboard priority actions
  await test('Dashboard: Priority actions', async () => {
    const r = await request('GET', '/api/v1/dashboard/priority-actions', null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.data), 'Data should be array');
  });

  // Dashboard recent activity
  await test('Dashboard: Recent activity', async () => {
    const r = await request('GET', '/api/v1/dashboard/recent-activity', null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // Dashboard compliance trend
  await test('Dashboard: Compliance trend', async () => {
    const r = await request('GET', '/api/v1/dashboard/compliance-trend?period=30d', null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // Organization controls
  await test('Organizations: List controls', async () => {
    const r = await request('GET', `/api/v1/organizations/${ORG_ID}/controls`, null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.data), 'Data should be array');
    console.log(`         -> ${r.body.data.length} controls in org`);
  });

  // Users
  await test('Users: List org users', async () => {
    const r = await request('GET', '/api/v1/users', null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.data), 'Data should be array');
  });

  // Roles
  await test('Roles: List roles', async () => {
    const r = await request('GET', '/api/v1/roles', null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // Audit logs
  await test('Audit: List logs', async () => {
    const r = await request('GET', '/api/v1/audit/logs', null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.pagination, 'Missing pagination');
  });

  // Implementations
  await test('Implementations: List', async () => {
    const r = await request('GET', '/api/v1/implementations', null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // Implementations activity feed
  await test('Implementations: Activity feed', async () => {
    const r = await request('GET', '/api/v1/implementations/activity/feed', null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // Assessments
  await test('Assessments: List procedures', async () => {
    const r = await request('GET', '/api/v1/assessments/procedures', null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    console.log(`         -> ${r.body.data?.procedures?.length || 0} procedures`);
  });

  // Assessments stats
  await test('Assessments: Stats', async () => {
    const r = await request('GET', '/api/v1/assessments/stats', null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // Notifications
  await test('Notifications: List', async () => {
    const r = await request('GET', '/api/v1/notifications', null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data?.unreadCount !== undefined, 'Missing unread count');
  });

  // Reports types
  await test('Reports: List types (Starter+ required)', async () => {
    const r = await request('GET', '/api/v1/reports/types', null, TOKEN);
    // Free tier should get 403
    assert(r.status === 403 || r.status === 200, `Expected 200 or 403, got ${r.status}`);
    if (r.status === 403) {
      console.log('         -> Correctly blocked for free tier');
      assert(r.body.upgradeRequired === true, 'Should indicate upgrade required');
    }
  });

  // Evidence (Starter+ required)
  await test('Evidence: List (Starter+ required)', async () => {
    const r = await request('GET', '/api/v1/evidence', null, TOKEN);
    assert(r.status === 403 || r.status === 200, `Expected 200 or 403, got ${r.status}`);
    if (r.status === 403) {
      console.log('         -> Correctly blocked for free tier');
    }
  });

  // CMDB (Starter+ required)
  await test('CMDB: List hardware (Starter+ required)', async () => {
    const r = await request('GET', '/api/v1/cmdb/hardware', null, TOKEN);
    assert(r.status === 403 || r.status === 200, `Expected 200 or 403, got ${r.status}`);
    if (r.status === 403) {
      console.log('         -> Correctly blocked for free tier');
    }
  });

  // Maturity score (Professional+ required)
  await test('Dashboard: Maturity score (Professional+ required)', async () => {
    const r = await request('GET', '/api/v1/dashboard/maturity-score', null, TOKEN);
    assert(r.status === 403 || r.status === 200, `Expected 200 or 403, got ${r.status}`);
    if (r.status === 403) {
      console.log('         -> Correctly blocked for free tier');
    }
  });

  // AI status
  await test('AI: Get status', async () => {
    const r = await request('GET', '/api/v1/ai/status', null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // Settings
  await test('Settings: Get LLM config', async () => {
    const r = await request('GET', '/api/v1/settings/llm', null, TOKEN);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // No auth should be 401
  await test('No auth: Should return 401', async () => {
    const r = await request('GET', '/api/v1/dashboard/stats');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  // Framework limit test (free = 2 max)
  await test('Tier gating: Framework limit (free = 2)', async () => {
    const fwR = await request('GET', '/api/v1/frameworks', null, TOKEN);
    const fwIds = fwR.body.data.slice(2, 5).map(f => f.id);
    const r = await request('POST', `/api/v1/organizations/${ORG_ID}/frameworks`, { frameworkIds: fwIds }, TOKEN);
    // Should fail since we already have 2 and trying to add 3 more
    assert(r.status === 403, `Expected 403, got ${r.status}`);
    if (r.status === 403) {
      console.log('         -> Correctly enforced 2-framework limit for free tier');
    }
  });

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log(`${'='.repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
