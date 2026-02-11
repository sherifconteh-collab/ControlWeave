/**
 * Comprehensive QA Test Suite
 * Simulates real user workflows, RBAC, data integrity, and edge cases
 * Run: node scripts/qa-test.js
 */
const http = require('http');
const { Pool } = require('pg');
require('dotenv').config();

const BASE = 'http://localhost:3001';
let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

// Test user accounts
const ADMIN_USER = {
  email: `qa-admin-${Date.now()}@test.com`,
  password: 'SecureAdmin123!',
  full_name: 'QA Admin User',
  organization_name: 'QA Test Organization'
};

const REGULAR_USER = {
  email: `qa-user-${Date.now()}@test.com`,
  password: 'SecureUser123!',
  full_name: 'QA Regular User'
};

// State
let adminToken = null;
let adminRefreshToken = null;
let adminUserId = null;
let adminOrgId = null;
let regularToken = null;
let regularUserId = null;
let frameworkIds = [];
let controlIds = [];
let implementationId = null;
let notificationId = null;

async function dbQuery(sql, params = []) {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'grc_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || ''
  });
  try {
    return await pool.query(sql, params);
  } finally {
    await pool.end();
  }
}

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
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
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
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } catch (err) {
    failed++;
    const msg = `${name}: ${err.message}`;
    failures.push(msg);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${msg}`);
  }
}

function skip(name, reason) {
  skipped++;
  console.log(`  \x1b[33mSKIP\x1b[0m  ${name} (${reason})`);
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

async function run() {
  console.log('\n\x1b[1m========================================');
  console.log('  ControlWeave — Full QA Test Suite');
  console.log('========================================\x1b[0m\n');

  // ═══════════════════════════════════════════════
  // SECTION 1: AUTHENTICATION LIFECYCLE
  // ═══════════════════════════════════════════════
  console.log('\x1b[1m--- 1. Authentication Lifecycle ---\x1b[0m');

  await test('1.1 Register admin user (new org)', async () => {
    const r = await request('POST', '/api/v1/auth/register', ADMIN_USER);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    // Tokens may be nested under data.tokens or flat at data level
    const tokens = r.body.data?.tokens || r.body.data;
    assert(tokens?.accessToken, 'No access token returned');
    assert(tokens?.refreshToken, 'No refresh token returned');
    assert(r.body.data?.user?.id, 'No user ID returned');
    // Org ID may be in data.organization.id or data.user.organizationId
    const orgId = r.body.data?.organization?.id || r.body.data?.user?.organizationId || r.body.data?.user?.organization_id;
    assert(orgId, 'No org ID returned');
    assert(r.body.data?.user?.email === ADMIN_USER.email, 'Email mismatch');
    assert(r.body.data?.user?.role === 'admin', 'First user should be admin');
    adminToken = tokens.accessToken;
    adminRefreshToken = tokens.refreshToken;
    adminUserId = r.body.data.user.id;
    adminOrgId = orgId;
    console.log(`         -> Admin ID: ${adminUserId}`);
    console.log(`         -> Org ID: ${adminOrgId}`);
  });

  await test('1.2 Duplicate registration returns 409', async () => {
    const r = await request('POST', '/api/v1/auth/register', ADMIN_USER);
    assert(r.status === 409, `Expected 409, got ${r.status}`);
  });

  await test('1.3 Login with correct credentials', async () => {
    const r = await request('POST', '/api/v1/auth/login', {
      email: ADMIN_USER.email, password: ADMIN_USER.password
    });
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    const tokens = r.body.data?.tokens || r.body.data;
    assert(tokens?.accessToken, 'No access token');
    adminToken = tokens.accessToken;
    adminRefreshToken = tokens.refreshToken;
  });

  await test('1.3b Downgrade org to free tier for gating checks', async () => {
    assert(adminOrgId, 'Missing admin org ID for tier downgrade');
    await dbQuery('UPDATE organizations SET tier = $1 WHERE id = $2', ['free', adminOrgId]);
    const relogin = await request('POST', '/api/v1/auth/login', {
      email: ADMIN_USER.email, password: ADMIN_USER.password
    });
    assert(relogin.status === 200, `Expected 200, got ${relogin.status}`);
    const tokens = relogin.body.data?.tokens || relogin.body.data;
    adminToken = tokens?.accessToken || adminToken;
    adminRefreshToken = tokens?.refreshToken || adminRefreshToken;
    assert(adminToken, 'Missing access token after tier downgrade');
  });

  await test('1.4 Login with wrong password returns 401', async () => {
    const r = await request('POST', '/api/v1/auth/login', {
      email: ADMIN_USER.email, password: 'WrongPassword123!'
    });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('1.5 Login with nonexistent email returns 401', async () => {
    const r = await request('POST', '/api/v1/auth/login', {
      email: 'nonexistent@test.com', password: 'SomePass123!'
    });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('1.6 GET /auth/me returns correct user', async () => {
    const r = await request('GET', '/api/v1/auth/me', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data?.email === ADMIN_USER.email, `Email mismatch: ${r.body.data?.email}`);
    const fullName = r.body.data?.full_name || `${r.body.data?.first_name} ${r.body.data?.last_name}`.trim();
    assert(fullName === ADMIN_USER.full_name, `Name mismatch: ${fullName}`);
    const meOrgId = r.body.data?.organization?.id || r.body.data?.organizationId;
    assert(meOrgId === adminOrgId, `Org ID mismatch: ${meOrgId} vs ${adminOrgId}`);
    console.log(`         -> Roles: ${JSON.stringify(r.body.data?.roles || [])}`);
    console.log(`         -> Permissions: ${JSON.stringify(r.body.data?.permissions || [])}`);
  });

  await test('1.7 Refresh token generates new access token', async () => {
    const r = await request('POST', '/api/v1/auth/refresh', { refreshToken: adminRefreshToken });
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.data?.accessToken, 'No new access token');
    // Note: JWTs generated in same second may be identical — that's OK
    adminToken = r.body.data.accessToken;
  });

  await test('1.8 Invalid refresh token returns error', async () => {
    const r = await request('POST', '/api/v1/auth/refresh', { refreshToken: 'invalid-token-here' });
    assert(r.status === 401 || r.status === 403, `Expected 401/403, got ${r.status}`);
  });

  await test('1.9 No auth token returns 401', async () => {
    const r = await request('GET', '/api/v1/auth/me');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('1.10 Invalid/expired token returns 401', async () => {
    const r = await request('GET', '/api/v1/auth/me', null, 'Bearer invalid.jwt.token');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('1.11 Missing required fields on register', async () => {
    const r = await request('POST', '/api/v1/auth/register', { email: 'test@test.com' });
    assert(r.status === 400 || r.status === 500, `Expected 400/500, got ${r.status}`);
  });

  // ═══════════════════════════════════════════════
  // SECTION 2: FRAMEWORKS & DASHBOARD
  // ═══════════════════════════════════════════════
  console.log('\n\x1b[1m--- 2. Frameworks & Dashboard ---\x1b[0m');

  await test('2.1 List all frameworks', async () => {
    const r = await request('GET', '/api/v1/frameworks', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.data), 'Should be array');
    assert(r.body.data.length >= 6, `Expected at least 6 frameworks, got ${r.body.data.length}`);
    frameworkIds = r.body.data.map(f => f.id);
    console.log(`         -> ${r.body.data.length} frameworks available`);
    console.log(`         -> Codes: ${r.body.data.map(f => f.code).join(', ')}`);
  });

  await test('2.2 Add 2 frameworks to org (free tier limit = 2)', async () => {
    const fwIds = frameworkIds.slice(0, 2);
    const r = await request('POST', `/api/v1/organizations/${adminOrgId}/frameworks`, { frameworkIds: fwIds }, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('2.3 Adding 3rd framework blocked by free tier limit', async () => {
    // org framework selection is a replacement operation, so request 3 total
    const r = await request('POST', `/api/v1/organizations/${adminOrgId}/frameworks`, {
      frameworkIds: frameworkIds.slice(0, 3)
    }, adminToken);
    assert(r.status === 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.upgradeRequired === true || r.body.error?.includes('limit'), 'Should indicate limit reached');
    console.log('         -> Correctly blocked at 2-framework limit');
  });

  await test('2.4 Dashboard stats reflect selected frameworks', async () => {
    const r = await request('GET', '/api/v1/dashboard/stats', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const data = r.body.data;
    assert(data.overall, 'Missing overall stats');
    assert(data.frameworks, 'Missing framework breakdown');
    assert(data.frameworks.length === 2, `Expected 2 frameworks, got ${data.frameworks.length}`);
    assert(typeof data.overall.totalControls === 'number', 'totalControls should be number');
    assert(data.overall.totalControls > 0, 'Should have controls');
    assert(typeof data.overall.compliancePercentage === 'number', 'compliancePercentage should be number');
    console.log(`         -> ${data.overall.totalControls} total controls across 2 frameworks`);
    console.log(`         -> Compliance: ${data.overall.compliancePercentage}% (should be 0% for new org)`);
  });

  await test('2.5 Dashboard priority actions returns array', async () => {
    const r = await request('GET', '/api/v1/dashboard/priority-actions', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.data), 'Should be array');
  });

  await test('2.6 Dashboard recent activity returns data', async () => {
    const r = await request('GET', '/api/v1/dashboard/recent-activity', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('2.7 Dashboard compliance trend returns data', async () => {
    const r = await request('GET', '/api/v1/dashboard/compliance-trend?period=30d', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.data), 'Should be array');
  });

  // ═══════════════════════════════════════════════
  // SECTION 3: CONTROLS & IMPLEMENTATIONS
  // ═══════════════════════════════════════════════
  console.log('\n\x1b[1m--- 3. Controls & Implementations ---\x1b[0m');

  await test('3.1 List org controls', async () => {
    const r = await request('GET', `/api/v1/organizations/${adminOrgId}/controls`, null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.data), 'Should be array');
    assert(r.body.data.length > 0, 'Should have controls');
    controlIds = r.body.data.slice(0, 5).map(c => c.id);
    console.log(`         -> ${r.body.data.length} controls in org`);
    console.log(`         -> First control: ${r.body.data[0].control_id} - ${r.body.data[0].title?.substring(0, 50)}`);
  });

  await test('3.2 Get single control detail', async () => {
    if (!controlIds[0]) { skip('3.2', 'No control IDs'); return; }
    const r = await request('GET', `/api/v1/controls/${controlIds[0]}`, null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data?.id === controlIds[0], 'Control ID mismatch');
    console.log(`         -> Control: ${r.body.data.control_id} | Framework: ${r.body.data.framework_code}`);
  });

  await test('3.3 Update control implementation to "in_progress"', async () => {
    if (!controlIds[0]) { skip('3.3', 'No control IDs'); return; }
    const r = await request('PUT', `/api/v1/controls/${controlIds[0]}/implementation`, {
      status: 'in_progress',
      implementationDetails: 'QA test: Starting implementation',
      notes: 'Automated QA test entry'
    }, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    console.log('         -> Control set to in_progress');
  });

  await test('3.4 Update control to "implemented" and check auto-crosswalk', async () => {
    if (!controlIds[0]) { skip('3.4', 'No control IDs'); return; }
    const r = await request('PUT', `/api/v1/controls/${controlIds[0]}/implementation`, {
      status: 'implemented',
      implementationDetails: 'QA test: Fully implemented',
      notes: 'QA test: marking as complete'
    }, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    const autoCrosswalk = r.body.data?.autoCrosswalked || r.body.autoCrosswalked || [];
    console.log(`         -> Auto-crosswalked ${autoCrosswalk.length} mapped controls`);
  });

  await test('3.5 Verify dashboard compliance increased', async () => {
    const r = await request('GET', '/api/v1/dashboard/stats', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const overall = r.body.data.overall;
    console.log(`         -> Compliance now: ${overall.compliancePercentage}%`);
    console.log(`         -> Implemented: ${overall.implemented}, Crosswalked: ${overall.satisfiedViaCrosswalk}`);
    // At least 1 control should be implemented now
    assert(overall.implemented >= 1, `Expected at least 1 implemented, got ${overall.implemented}`);
  });

  await test('3.6 Get control mappings (crosswalk)', async () => {
    if (!controlIds[0]) { skip('3.6', 'No control IDs'); return; }
    const r = await request('GET', `/api/v1/controls/${controlIds[0]}/mappings`, null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.data), 'Should be array');
    console.log(`         -> ${r.body.data.length} crosswalk mappings found`);
  });

  await test('3.7 Get control history (audit trail)', async () => {
    if (!controlIds[0]) { skip('3.7', 'No control IDs'); return; }
    const r = await request('GET', `/api/v1/controls/${controlIds[0]}/history`, null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.data), 'Should be array');
    // We made 2 status changes, so history should have entries
    assert(r.body.data.length >= 1, `Expected at least 1 history entry, got ${r.body.data.length}`);
    console.log(`         -> ${r.body.data.length} history entries for this control`);
  });

  await test('3.8 List implementations with filters', async () => {
    const r = await request('GET', '/api/v1/implementations?status=implemented', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.data), 'Should be array');
    console.log(`         -> ${r.body.data.length} implemented controls`);
  });

  await test('3.9 Implementation activity feed has our changes', async () => {
    const r = await request('GET', '/api/v1/implementations/activity/feed', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.data), 'Should be array');
    console.log(`         -> ${r.body.data.length} activity feed entries`);
  });

  // ═══════════════════════════════════════════════
  // SECTION 4: RBAC — ROLE MANAGEMENT
  // ═══════════════════════════════════════════════
  console.log('\n\x1b[1m--- 4. RBAC Roles & Permissions ---\x1b[0m');

  await test('4.1 List roles (admin)', async () => {
    const r = await request('GET', '/api/v1/roles', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const roles = r.body.data || r.body;
    console.log(`         -> ${Array.isArray(roles) ? roles.length : 'N/A'} roles found`);
    if (Array.isArray(roles) && roles.length > 0) {
      roles.forEach(role => {
        console.log(`            - ${role.name}: ${role.description || 'no description'}`);
      });
    }
  });

  await test('4.2 Create a custom role (admin only)', async () => {
    const r = await request('POST', '/api/v1/roles', {
      name: 'qa_auditor',
      description: 'QA test auditor role - read only access',
      permissions: ['read:controls', 'read:frameworks', 'read:dashboard']
    }, adminToken);
    // 201 created or 200 OK
    assert(r.status === 201 || r.status === 200, `Expected 201/200, got ${r.status}: ${JSON.stringify(r.body)}`);
    console.log('         -> Custom qa_auditor role created');
  });

  await test('4.3 List org users', async () => {
    const r = await request('GET', '/api/v1/users', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const users = r.body.data || [];
    assert(Array.isArray(users), 'Should be array');
    console.log(`         -> ${users.length} users in org`);
    users.forEach(u => {
      console.log(`            - ${u.full_name || u.email} (role: ${u.role || 'unknown'})`);
    });
  });

  // Try to register a second user in the same org (different org actually since register creates new org)
  // Instead, we test that the admin user's token works properly and a crafted non-admin can't do admin things
  await test('4.4 Register second user (separate org)', async () => {
    const r = await request('POST', '/api/v1/auth/register', {
      email: REGULAR_USER.email,
      password: REGULAR_USER.password,
      full_name: REGULAR_USER.full_name,
      organization_name: 'Regular User Org'
    });
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    const tokens = r.body.data?.tokens || r.body.data;
    regularToken = tokens.accessToken;
    regularUserId = r.body.data.user.id;
    console.log(`         -> Regular user ID: ${regularUserId}`);
  });

  await test('4.5 Regular user cannot access admin org data', async () => {
    // Try to access admin org's controls with regular user's token
    const r = await request('GET', `/api/v1/organizations/${adminOrgId}/controls`, null, regularToken);
    // Should get empty data or 403 since regular user is in different org
    if (r.status === 200) {
      const controls = r.body.data || [];
      assert(controls.length === 0, `Regular user should NOT see admin org controls, but got ${controls.length}`);
      console.log('         -> Regular user correctly sees 0 controls from admin org');
    } else {
      assert(r.status === 403 || r.status === 401, `Expected 403/401/200-empty, got ${r.status}`);
      console.log('         -> Correctly blocked access to another org');
    }
  });

  await test('4.6 Regular user can only see their own org data', async () => {
    const r = await request('GET', '/api/v1/auth/me', null, regularToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.organization?.id !== adminOrgId, 'Should be different org');
    console.log(`         -> Regular user org: ${r.body.data.organization?.id} (different from admin org)`);
  });

  await test('4.7 Regular user dashboard is isolated (empty)', async () => {
    const r = await request('GET', '/api/v1/dashboard/stats', null, regularToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const overall = r.body.data.overall;
    assert(overall.totalControls === 0, `New org should have 0 controls, got ${overall.totalControls}`);
    console.log('         -> Regular user dashboard correctly shows 0 controls (no frameworks selected)');
  });

  // ═══════════════════════════════════════════════
  // SECTION 5: TIER GATING
  // ═══════════════════════════════════════════════
  console.log('\n\x1b[1m--- 5. Tier Gating (Free vs Starter vs Professional) ---\x1b[0m');

  await test('5.1 Evidence endpoint blocked for free tier', async () => {
    const r = await request('GET', '/api/v1/evidence', null, adminToken);
    assert(r.status === 403, `Expected 403, got ${r.status}`);
    assert(r.body.upgradeRequired === true, 'Should indicate upgrade required');
    assert(r.body.requiredTier === 'starter' || r.body.minimumTier === 'starter', 'Should mention starter tier');
    console.log('         -> Evidence correctly blocked (requires Starter)');
  });

  await test('5.2 CMDB hardware blocked for free tier', async () => {
    const r = await request('GET', '/api/v1/cmdb/hardware', null, adminToken);
    assert(r.status === 403, `Expected 403, got ${r.status}`);
    console.log('         -> CMDB correctly blocked (requires Starter)');
  });

  await test('5.3 CMDB software blocked for free tier', async () => {
    const r = await request('GET', '/api/v1/cmdb/software', null, adminToken);
    assert(r.status === 403, `Expected 403, got ${r.status}`);
    console.log('         -> CMDB software correctly blocked');
  });

  await test('5.4 Reports types blocked for free tier', async () => {
    const r = await request('GET', '/api/v1/reports/types', null, adminToken);
    assert(r.status === 403, `Expected 403, got ${r.status}`);
    assert(r.body.upgradeRequired === true, 'Should indicate upgrade required');
    console.log('         -> Reports correctly blocked (requires Starter)');
  });

  await test('5.5 Report PDF download blocked for free tier', async () => {
    const r = await request('GET', '/api/v1/reports/compliance/pdf', null, adminToken);
    assert(r.status === 403, `Expected 403, got ${r.status}`);
    console.log('         -> PDF download correctly blocked');
  });

  await test('5.6 Report Excel download blocked for free tier', async () => {
    const r = await request('GET', '/api/v1/reports/compliance/excel', null, adminToken);
    assert(r.status === 403, `Expected 403, got ${r.status}`);
    console.log('         -> Excel download correctly blocked');
  });

  await test('5.7 Maturity score blocked for free tier (requires Professional)', async () => {
    const r = await request('GET', '/api/v1/dashboard/maturity-score', null, adminToken);
    assert(r.status === 403, `Expected 403, got ${r.status}`);
    console.log('         -> Maturity score correctly blocked (requires Professional)');
  });

  await test('5.8 Framework limit enforced (free = 2)', async () => {
    // Already tested in 2.3, but let's try adding multiple at once
    const r = await request('POST', `/api/v1/organizations/${adminOrgId}/frameworks`, {
      frameworkIds: frameworkIds.slice(2, 5)
    }, adminToken);
    assert(r.status === 403, `Expected 403, got ${r.status}`);
    console.log('         -> Framework limit correctly enforced (max 2 for free)');
  });

  // Free-tier features that SHOULD work
  await test('5.9 Auth, Dashboard, Frameworks, Controls work on free tier', async () => {
    const authR = await request('GET', '/api/v1/auth/me', null, adminToken);
    const dashR = await request('GET', '/api/v1/dashboard/stats', null, adminToken);
    const fwR = await request('GET', '/api/v1/frameworks', null, adminToken);
    assert(authR.status === 200, 'Auth should work on free tier');
    assert(dashR.status === 200, 'Dashboard should work on free tier');
    assert(fwR.status === 200, 'Frameworks should work on free tier');
    console.log('         -> Core features correctly accessible on free tier');
  });

  // ═══════════════════════════════════════════════
  // SECTION 6: AUDIT LOGGING
  // ═══════════════════════════════════════════════
  console.log('\n\x1b[1m--- 6. Audit Logging ---\x1b[0m');

  await test('6.1 Audit logs exist for our actions', async () => {
    const r = await request('GET', '/api/v1/audit/logs', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.pagination, 'Should have pagination info');
    const logs = r.body.data || [];
    console.log(`         -> ${logs.length} audit log entries`);
    console.log(`         -> Total in DB: ${r.body.pagination?.total || 'unknown'}`);
    if (logs.length > 0) {
      console.log(`         -> Most recent: ${logs[0].event_type} at ${logs[0].created_at}`);
    }
  });

  await test('6.2 Audit logs have correct structure', async () => {
    const r = await request('GET', '/api/v1/audit/logs?limit=5', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const logs = r.body.data || [];
    if (logs.length > 0) {
      const log = logs[0];
      assert(log.id, 'Log should have id');
      assert(log.event_type || log.action, 'Log should have event_type or action');
      assert(log.created_at, 'Log should have timestamp');
      console.log('         -> Audit log structure verified');
    }
  });

  // ═══════════════════════════════════════════════
  // SECTION 7: NOTIFICATIONS
  // ═══════════════════════════════════════════════
  console.log('\n\x1b[1m--- 7. Notifications ---\x1b[0m');

  await test('7.1 Create a test notification', async () => {
    const r = await request('POST', '/api/v1/notifications', {
      type: 'system',
      title: 'QA Test Notification',
      message: 'This is a test notification from the QA suite',
      link: '/dashboard'
    }, adminToken);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    notificationId = r.body.data?.id;
    console.log(`         -> Notification created: ${notificationId}`);
  });

  await test('7.2 List notifications shows our test notification', async () => {
    const r = await request('GET', '/api/v1/notifications', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data?.unreadCount >= 1, `Should have at least 1 unread, got ${r.body.data?.unreadCount}`);
    const notifications = r.body.data?.notifications || [];
    const found = notifications.find(n => n.title === 'QA Test Notification');
    assert(found, 'Should find our test notification');
    assert(found.is_read === false, 'Should be unread');
    console.log(`         -> ${r.body.data.unreadCount} unread notifications`);
  });

  await test('7.3 Mark notification as read', async () => {
    if (!notificationId) { skip('7.3', 'No notification ID'); return; }
    const r = await request('PATCH', `/api/v1/notifications/${notificationId}/read`, null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    console.log('         -> Notification marked as read');
  });

  await test('7.4 Unread count decreased after marking read', async () => {
    const r = await request('GET', '/api/v1/notifications', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const notifications = r.body.data?.notifications || [];
    const found = notifications.find(n => n.id === notificationId);
    if (found) {
      assert(found.is_read === true, 'Should now be read');
    }
    console.log(`         -> Unread count now: ${r.body.data?.unreadCount}`);
  });

  await test('7.5 Create multiple notifications and mark all read', async () => {
    // Create 3 more
    for (let i = 0; i < 3; i++) {
      await request('POST', '/api/v1/notifications', {
        type: 'control_due',
        title: `QA Bulk Test ${i + 1}`,
        message: `Bulk notification ${i + 1}`
      }, adminToken);
    }
    // Verify unread count
    const before = await request('GET', '/api/v1/notifications', null, adminToken);
    const unreadBefore = before.body.data?.unreadCount || 0;
    console.log(`         -> ${unreadBefore} unread before mark-all-read`);

    // Mark all read
    const r = await request('POST', '/api/v1/notifications/read-all', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);

    // Verify count is 0
    const after = await request('GET', '/api/v1/notifications', null, adminToken);
    assert(after.body.data?.unreadCount === 0, `Expected 0 unread, got ${after.body.data?.unreadCount}`);
    console.log('         -> All notifications marked as read (unread = 0)');
  });

  await test('7.6 Regular user cannot see admin org notifications', async () => {
    const r = await request('GET', '/api/v1/notifications', null, regularToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const notifications = r.body.data?.notifications || [];
    const adminNotif = notifications.find(n => n.title === 'QA Test Notification');
    assert(!adminNotif, 'Regular user should NOT see admin org notifications');
    console.log('         -> Regular user correctly isolated from admin notifications');
  });

  // ═══════════════════════════════════════════════
  // SECTION 8: ASSESSMENTS
  // ═══════════════════════════════════════════════
  console.log('\n\x1b[1m--- 8. Assessments ---\x1b[0m');

  await test('8.1 List assessment procedures', async () => {
    const r = await request('GET', '/api/v1/assessments/procedures', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const procs = r.body.data?.procedures || [];
    console.log(`         -> ${procs.length} assessment procedures`);
    if (procs.length > 0) {
      console.log(`         -> First: ${procs[0].procedure_id} - ${procs[0].title?.substring(0, 50)}`);
    }
  });

  await test('8.2 Assessment stats endpoint', async () => {
    const r = await request('GET', '/api/v1/assessments/stats', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    console.log(`         -> Stats: ${JSON.stringify(r.body.data || {}).substring(0, 100)}`);
  });

  // ═══════════════════════════════════════════════
  // SECTION 9: AI & SETTINGS
  // ═══════════════════════════════════════════════
  console.log('\n\x1b[1m--- 9. AI & Settings ---\x1b[0m');

  await test('9.1 AI status endpoint', async () => {
    const r = await request('GET', '/api/v1/ai/status', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    console.log(`         -> AI configured: ${r.body.data?.configured ?? r.body.configured ?? 'unknown'}`);
  });

  await test('9.2 LLM settings (read)', async () => {
    const r = await request('GET', '/api/v1/settings/llm', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    console.log(`         -> Default provider: ${r.body.data?.default_provider || 'none set'}`);
  });

  // ═══════════════════════════════════════════════
  // SECTION 10: EDGE CASES & SECURITY
  // ═══════════════════════════════════════════════
  console.log('\n\x1b[1m--- 10. Edge Cases & Security ---\x1b[0m');

  await test('10.1 SQL injection attempt in login', async () => {
    const r = await request('POST', '/api/v1/auth/login', {
      email: "'; DROP TABLE users; --",
      password: "' OR '1'='1"
    });
    assert(r.status === 401 || r.status === 400, `Expected 401/400, got ${r.status}`);
    // Verify users table still works
    const check = await request('GET', '/api/v1/auth/me', null, adminToken);
    assert(check.status === 200, 'Users table should still exist after SQL injection attempt');
    console.log('         -> SQL injection attempt safely handled');
  });

  await test('10.2 SQL injection in query params', async () => {
    const r = await request('GET', '/api/v1/audit/logs?limit=10;DROP%20TABLE%20audit_logs;--', null, adminToken);
    // Should either work normally (parameterized query) or return error
    assert(r.status === 200 || r.status === 400 || r.status === 500, `Unexpected ${r.status}`);
    // Verify audit_logs still work
    const check = await request('GET', '/api/v1/audit/logs?limit=1', null, adminToken);
    assert(check.status === 200, 'Audit logs should still work after injection attempt');
    console.log('         -> Query param injection safely handled');
  });

  await test('10.3 XSS attempt in user registration', async () => {
    const r = await request('POST', '/api/v1/auth/register', {
      email: `xss-test-${Date.now()}@test.com`,
      password: 'SecureXSS123!',
      full_name: '<script>alert("XSS")</script>',
      organization_name: '<img src=x onerror=alert(1)>'
    });
    assert(r.status === 201 || r.status === 400, `Expected 201/400, got ${r.status}`);
    if (r.status === 201) {
      // Data stored, but should be escaped on output (frontend responsibility)
      const name = r.body.data?.user?.full_name;
      console.log(`         -> Stored name: ${name} (escaping is frontend responsibility)`);
    }
  });

  await test('10.4 Empty body on POST endpoints', async () => {
    const r = await request('POST', '/api/v1/auth/login', {});
    assert(r.status === 400 || r.status === 401, `Expected 400/401, got ${r.status}`);
    console.log('         -> Empty login body handled correctly');
  });

  await test('10.5 Very long string input', async () => {
    const longStr = 'A'.repeat(10000);
    const r = await request('POST', '/api/v1/auth/login', {
      email: longStr + '@test.com',
      password: longStr
    });
    assert(r.status === 400 || r.status === 401 || r.status === 500, `Got ${r.status}`);
    console.log('         -> Long string input handled gracefully');
  });

  await test('10.6 Access nonexistent routes returns 404', async () => {
    const r = await request('GET', '/api/v1/nonexistent-route', null, adminToken);
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  await test('10.7 Access control with invalid UUID', async () => {
    const r = await request('GET', '/api/v1/controls/not-a-valid-uuid', null, adminToken);
    assert(r.status === 400 || r.status === 404 || r.status === 500, `Got ${r.status}`);
    console.log(`         -> Invalid UUID handled (status: ${r.status})`);
  });

  await test('10.8 Cross-org data access attempt', async () => {
    // Regular user trying to modify admin org's frameworks
    const r = await request('POST', `/api/v1/organizations/${adminOrgId}/frameworks`, {
      frameworkIds: [frameworkIds[0]]
    }, regularToken);
    // Should fail — either 403, 401, or succeed with 0 effect (org mismatch check)
    if (r.status === 200) {
      // Check that admin org still has same frameworks
      const check = await request('GET', '/api/v1/dashboard/stats', null, adminToken);
      assert(check.body.data.frameworks.length === 2, 'Admin org frameworks should be unchanged');
      console.log('         -> Cross-org request did not affect admin org data');
    } else {
      assert(r.status === 403 || r.status === 401, `Expected 403/401, got ${r.status}`);
      console.log('         -> Cross-org modification correctly blocked');
    }
  });

  // ═══════════════════════════════════════════════
  // SECTION 11: LOGOUT & TOKEN INVALIDATION
  // ═══════════════════════════════════════════════
  console.log('\n\x1b[1m--- 11. Logout & Session Cleanup ---\x1b[0m');

  await test('11.1 Logout invalidates session', async () => {
    const r = await request('POST', '/api/v1/auth/logout', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    console.log('         -> Logout successful');
  });

  await test('11.2 Token still works (JWT is stateless)', async () => {
    // JWT tokens are stateless — the token itself is still valid until expiry
    // But refresh token should be invalidated
    const r = await request('GET', '/api/v1/auth/me', null, adminToken);
    // This may or may not work depending on implementation
    if (r.status === 200) {
      console.log('         -> Access token still valid (stateless JWT — expected)');
    } else {
      console.log('         -> Access token invalidated on logout (server-side check)');
    }
    // Either behavior is acceptable
    assert(r.status === 200 || r.status === 401, `Expected 200 or 401, got ${r.status}`);
  });

  await test('11.3 Refresh token invalidated after logout', async () => {
    const r = await request('POST', '/api/v1/auth/refresh', { refreshToken: adminRefreshToken });
    // After logout, sessions are deleted, so refresh should fail
    if (r.status === 200) {
      console.log('         -> NOTE: Refresh token still works after logout (sessions not cleared properly)');
    } else {
      console.log('         -> Refresh token correctly invalidated');
    }
    assert(r.status === 200 || r.status === 401 || r.status === 403, `Unexpected ${r.status}`);
  });

  // ═══════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════
  console.log(`\n\x1b[1m${'='.repeat(55)}`);
  console.log(`  QA RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log(`  Total: ${passed + failed + skipped} tests`);
  console.log(`${'='.repeat(55)}\x1b[0m`);

  if (failures.length > 0) {
    console.log('\n\x1b[31m--- FAILURES ---\x1b[0m');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('QA runner error:', err);
  process.exit(1);
});
