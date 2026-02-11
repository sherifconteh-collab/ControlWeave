/**
 * MEGA QA TEST SUITE — Every inch of the ControlWeave
 *
 * Tests all 19 route files, 100+ endpoints across:
 *   1.  Auth lifecycle (register, login, refresh, me, logout)
 *   2.  Frameworks (list all)
 *   3.  Organizations (add/remove frameworks, get controls, org access)
 *   4.  Dashboard (stats, priority-actions, recent-activity, trend, crosswalk-impact, maturity)
 *   5.  Controls (get, implementation, mappings, history)
 *   6.  Implementations (list, activity feed, due, status, assign, review)
 *   7.  CMDB (environments, password-vaults, service-accounts, hardware, software, ai-agents)
 *   8.  Evidence (list, upload, get, update, delete, link, unlink)
 *   9.  Audit (logs, stats, event-types, user audit)
 *   10. Roles & Permissions (list, create, update, delete, permissions, assign, user roles)
 *   11. Users (list)
 *   12. AI Analysis (status + all 21 POST endpoints)
 *   13. Settings (LLM get/put/test/delete)
 *   14. Assessments (procedures, results, stats, frameworks, plans)
 *   15. Reports (types, PDF, Excel)
 *   16. Notifications (list, create, mark read, read all)
 *   17. Tier gating (free vs starter vs professional)
 *   18. RBAC (admin vs viewer)
 *   19. Security (cross-org, SQL injection, XSS, invalid tokens, 404s)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BASE = 'http://localhost:3001';
let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

// ---------- HTTP helper ----------
function req(method, urlPath, body, token, raw = false) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers.Authorization = 'Bearer ' + token;

    const r = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (raw) {
          resolve({ s: res.statusCode, b: buf, h: res.headers });
        } else {
          try {
            resolve({ s: res.statusCode, b: JSON.parse(buf.toString()) });
          } catch (e) {
            resolve({ s: res.statusCode, b: buf.toString().substring(0, 200) });
          }
        }
      });
    });
    r.on('error', e => resolve({ s: 0, b: e.message }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

// Multipart upload helper
function uploadFile(urlPath, filePath, fields, token) {
  return new Promise((resolve) => {
    const boundary = '----FormBoundary' + Date.now();
    const url = new URL(urlPath, BASE);

    let body = '';
    // Add fields
    for (const [key, value] of Object.entries(fields || {})) {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
      body += `${value}\r\n`;
    }

    // Add file
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`;
    body += `Content-Type: text/plain\r\n\r\n`;

    const bodyStart = Buffer.from(body, 'utf8');
    const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const fullBody = Buffer.concat([bodyStart, fileContent, bodyEnd]);

    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length,
        'Authorization': 'Bearer ' + token,
      }
    };

    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ s: res.statusCode, b: JSON.parse(d) }); }
        catch (e) { resolve({ s: res.statusCode, b: d }); }
      });
    });
    r.on('error', e => resolve({ s: 0, b: e.message }));
    r.write(fullBody);
    r.end();
  });
}

function assert(testId, description, condition) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testId}: ${description}`);
  } else {
    failed++;
    failures.push(`${testId}: ${description}`);
    console.log(`  ❌ ${testId}: ${description}`);
  }
}

function skip(testId, description, reason) {
  skipped++;
  console.log(`  ⏭️  ${testId}: ${description} — SKIPPED (${reason})`);
}

// Directly query DB to upgrade org tier
function dbQuery(sql, params = []) {
  const { Pool } = require('pg');
  const p = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'grc_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || ''
  });
  return p.query(sql, params).then(r => { p.end(); return r; });
}

// =====================================================================
(async () => {
  const ts = Date.now();
  const email1 = `mega-admin-${ts}@test.com`;
  const email2 = `mega-viewer-${ts}@test.com`;
  const pass = 'TestPass123!';

  console.log('\n══════════════════════════════════════════════════');
  console.log('  MEGA QA TEST SUITE — ControlWeave');
  console.log('══════════════════════════════════════════════════\n');

  // ======================== 0. HEALTH CHECK ========================
  console.log('── 0. Health Check ──');
  const health = await req('GET', '/health');
  assert('0.1', 'Health check returns healthy', health.s === 200 && health.b.status === 'healthy');

  // ======================== 1. AUTH LIFECYCLE ========================
  console.log('\n── 1. Auth Lifecycle ──');

  // 1.1 Register validation
  const regBad = await req('POST', '/api/v1/auth/register', { email: email1 });
  assert('1.1', 'Register rejects missing fields', regBad.s === 400);

  // 1.2 Register success
  const reg = await req('POST', '/api/v1/auth/register', {
    email: email1, password: pass, full_name: 'Mega Admin', organization_name: 'Mega Test Org'
  });
  assert('1.2', 'Register returns 201', reg.s === 201);
  assert('1.3', 'Register returns user data', !!reg.b.data?.user?.id);
  assert('1.4', 'Register returns tokens', !!reg.b.data?.tokens?.accessToken);
  assert('1.5', 'Register returns organization', !!reg.b.data?.organization?.id);
  assert('1.6', 'Register full_name is combined', reg.b.data?.user?.full_name === 'Mega Admin');

  const adminToken = reg.b.data?.tokens?.accessToken;
  const adminRefresh = reg.b.data?.tokens?.refreshToken;
  const adminUserId = reg.b.data?.user?.id;
  const orgId = reg.b.data?.organization?.id || reg.b.data?.user?.organization_id;
  const orgTier = reg.b.data?.organization?.tier;
  const orgBilling = reg.b.data?.organization?.billing_status;
  const orgTrial = reg.b.data?.organization?.trial_status;

  assert(
    '1.7',
    'Org starts on free tier (community edition — no trial)',
    orgTier === 'free' && orgBilling === 'free' && orgTrial === 'none'
  );

  // 1.3 Duplicate registration
  const regDup = await req('POST', '/api/v1/auth/register', {
    email: email1, password: pass, full_name: 'Dup', organization_name: 'Dup'
  });
  assert('1.8', 'Duplicate email returns 409', regDup.s === 409);

  // 1.4 Login validation
  const loginBad = await req('POST', '/api/v1/auth/login', {});
  assert('1.9', 'Login rejects missing fields', loginBad.s === 400);

  // 1.5 Login with wrong password
  const loginWrong = await req('POST', '/api/v1/auth/login', { email: email1, password: 'wrong' });
  assert('1.10', 'Wrong password returns 401', loginWrong.s === 401);

  // 1.6 Login success
  const login = await req('POST', '/api/v1/auth/login', { email: email1, password: pass });
  assert('1.11', 'Login returns 200', login.s === 200);
  assert('1.12', 'Login returns tokens nested', !!login.b.data?.tokens?.accessToken);
  assert('1.13', 'Login returns user with org_id', !!login.b.data?.user?.organization_id);

  const token = login.b.data?.tokens?.accessToken;

  // 1.7 Refresh
  const refresh = await req('POST', '/api/v1/auth/refresh', { refreshToken: adminRefresh });
  assert('1.14', 'Refresh returns new access token', refresh.s === 200 && !!refresh.b.data?.accessToken);

  // 1.8 GET /auth/me
  const me = await req('GET', '/api/v1/auth/me', null, token);
  assert('1.15', '/me returns 200', me.s === 200);
  assert('1.16', '/me has full_name', !!me.b.data?.full_name);
  assert('1.17', '/me has organization nested', !!me.b.data?.organization?.id);
  assert('1.18', '/me has roles array', Array.isArray(me.b.data?.roles));
  assert('1.19', '/me has permissions array', Array.isArray(me.b.data?.permissions));

  // 1.9 Auth required (no token)
  const noAuth = await req('GET', '/api/v1/frameworks');
  assert('1.20', 'No token returns 401', noAuth.s === 401);

  // 1.10 Invalid token
  const badToken = await req('GET', '/api/v1/frameworks', null, 'bad.token.here');
  assert('1.21', 'Invalid token returns 401/403', badToken.s === 401 || badToken.s === 403);

  // Downgrade to free tier to validate gating paths.
  await dbQuery(
    `UPDATE organizations
     SET tier = 'free',
         billing_status = 'free',
         trial_status = 'expired',
         trial_expired_at = NOW()
     WHERE id = $1`,
    [orgId]
  );
  const reloginFree = await req('POST', '/api/v1/auth/login', { email: email1, password: pass });
  const freeToken = reloginFree.b.data?.tokens?.accessToken;
  assert('1.22', 'Re-login after downgrade succeeds', reloginFree.s === 200 && !!freeToken);

  // ======================== 2. FRAMEWORKS (Free tier) ========================
  console.log('\n── 2. Frameworks ──');

  const fws = await req('GET', '/api/v1/frameworks', null, freeToken);
  assert('2.1', 'GET /frameworks returns 200', fws.s === 200);
  assert('2.2', 'Frameworks is array', Array.isArray(fws.b.data));
  assert('2.3', 'Frameworks have control_count', fws.b.data?.[0]?.control_count !== undefined);

  const frameworkIds = fws.b.data?.slice(0, 2).map(f => f.id) || [];
  const allFrameworkIds = fws.b.data?.map(f => f.id) || [];

  // ======================== 3. ORGANIZATIONS ========================
  console.log('\n── 3. Organizations ──');

  // 3.1 Add frameworks (free tier limit = 2)
  const addFw = await req('POST', `/api/v1/organizations/${orgId}/frameworks`, { frameworkIds }, freeToken);
  assert('3.1', 'Add frameworks returns 200', addFw.s === 200);
  assert('3.2', 'Returns framework data', Array.isArray(addFw.b.data));

  // 3.2 Get org frameworks
  const orgFws = await req('GET', `/api/v1/organizations/${orgId}/frameworks`, null, freeToken);
  assert('3.3', 'GET org frameworks returns 200', orgFws.s === 200);
  assert('3.4', 'Org has 2 frameworks', orgFws.b.data?.length === 2);

  // 3.3 Free tier limit enforcement (replace mode)
  const addTooMany = await req('POST', `/api/v1/organizations/${orgId}/frameworks`, {
    frameworkIds: allFrameworkIds.slice(0, 3)
  }, freeToken);
  assert('3.5', 'Free tier rejects selection above 2 frameworks (403)', addTooMany.s === 403);
  assert('3.6', 'Error says upgrade required', addTooMany.b.upgradeRequired === true);

  // 3.4 Get org controls
  const orgCtrls = await req('GET', `/api/v1/organizations/${orgId}/controls`, null, freeToken);
  assert('3.7', 'GET org controls returns 200', orgCtrls.s === 200);
  assert('3.8', 'Org controls is array', Array.isArray(orgCtrls.b.data));

  // 3.5 Org controls filter by framework
  if (frameworkIds[0]) {
    const filteredCtrls = await req('GET', `/api/v1/organizations/${orgId}/controls?frameworkId=${frameworkIds[0]}`, null, freeToken);
    assert('3.9', 'Filtered org controls returns 200', filteredCtrls.s === 200);
  }

  // 3.6 Org controls filter by status
  const statusCtrls = await req('GET', `/api/v1/organizations/${orgId}/controls?status=not_started`, null, freeToken);
  assert('3.10', 'Status filter returns 200', statusCtrls.s === 200);

  // ======================== 4. TIER GATING (Free tier blocks) ========================
  console.log('\n── 4. Tier Gating (Free Tier) ──');

  const evidence403 = await req('GET', '/api/v1/evidence', null, freeToken);
  assert('4.1', 'Evidence blocked for free tier', evidence403.s === 403);

  const reports403 = await req('GET', '/api/v1/reports/types', null, freeToken);
  assert('4.2', 'Reports blocked for free tier', reports403.s === 403);

  const cmdb403 = await req('GET', '/api/v1/cmdb/environments', null, freeToken);
  assert('4.3', 'CMDB blocked for free tier', cmdb403.s === 403);

  const maturity403 = await req('GET', '/api/v1/dashboard/maturity-score', null, freeToken);
  assert('4.4', 'Maturity score blocked for free tier', maturity403.s === 403);

  // ======================== UPGRADE ORG TO PROFESSIONAL ========================
  console.log('\n── Upgrading org to professional tier... ──');
  await dbQuery('UPDATE organizations SET tier = $1 WHERE id = $2', ['professional', orgId]);

  // Re-login to get updated token with new tier
  const relogin = await req('POST', '/api/v1/auth/login', { email: email1, password: pass });
  const proToken = relogin.b.data?.tokens?.accessToken;
  assert('4.5', 'Re-login after upgrade succeeds', relogin.s === 200);

  // Verify /me shows professional tier
  const meUpgraded = await req('GET', '/api/v1/auth/me', null, proToken);
  assert('4.6', '/me shows professional tier', meUpgraded.b.data?.organization?.tier === 'professional');

  // Add more frameworks now that limit is higher
  const addMorePro = await req('POST', `/api/v1/organizations/${orgId}/frameworks`, { frameworkIds: allFrameworkIds.slice(2, 5) }, proToken);
  assert('4.7', 'Professional tier can add more frameworks', addMorePro.s === 200);

  // ======================== 5. DASHBOARD ========================
  console.log('\n── 5. Dashboard ──');

  const dashStats = await req('GET', '/api/v1/dashboard/stats', null, proToken);
  assert('5.1', 'Dashboard stats returns 200', dashStats.s === 200);
  assert('5.2', 'Stats has overall', !!dashStats.b.data?.overall);
  assert('5.3', 'Stats has frameworks array', Array.isArray(dashStats.b.data?.frameworks));
  assert('5.4', 'Overall has totalControls', dashStats.b.data?.overall?.totalControls !== undefined);
  assert('5.5', 'Overall has compliancePercentage', dashStats.b.data?.overall?.compliancePercentage !== undefined);

  const priority = await req('GET', '/api/v1/dashboard/priority-actions', null, proToken);
  assert('5.6', 'Priority actions returns 200', priority.s === 200);
  assert('5.7', 'Priority actions is array', Array.isArray(priority.b.data));

  const recentAct = await req('GET', '/api/v1/dashboard/recent-activity', null, proToken);
  assert('5.8', 'Recent activity returns 200', recentAct.s === 200);

  const trend = await req('GET', '/api/v1/dashboard/compliance-trend?period=30d', null, proToken);
  assert('5.9', 'Compliance trend returns 200', trend.s === 200);

  const crossImpact = await req('GET', '/api/v1/dashboard/crosswalk-impact', null, proToken);
  assert('5.10', 'Crosswalk impact returns 200', crossImpact.s === 200);

  const maturity = await req('GET', '/api/v1/dashboard/maturity-score', null, proToken);
  assert('5.11', 'Maturity score returns 200 (professional)', maturity.s === 200);
  assert('5.12', 'Maturity has overallScore', maturity.b.data?.overallScore !== undefined);
  assert('5.13', 'Maturity has dimensions', Array.isArray(maturity.b.data?.dimensions));
  assert('5.14', 'Maturity has level and label', !!maturity.b.data?.label);
  assert('5.15', 'Maturity has recommendations', Array.isArray(maturity.b.data?.recommendations));

  // ======================== 6. CONTROLS & IMPLEMENTATIONS ========================
  console.log('\n── 6. Controls & Implementations ──');

  // Get a control ID from org controls
  const orgCtrlsAll = await req('GET', `/api/v1/organizations/${orgId}/controls`, null, proToken);
  const firstControl = orgCtrlsAll.b.data?.[0];
  const controlId = firstControl?.id;

  if (controlId) {
    // 6.1 Get single control
    const ctrl = await req('GET', `/api/v1/controls/${controlId}`, null, proToken);
    assert('6.1', 'GET control returns 200', ctrl.s === 200);
    assert('6.2', 'Control has title', !!ctrl.b.data?.title);
    assert('6.3', 'Control has framework info', !!ctrl.b.data?.framework_name);

    // 6.2 Get control mappings
    const mappings = await req('GET', `/api/v1/controls/${controlId}/mappings`, null, proToken);
    assert('6.4', 'GET mappings returns 200', mappings.s === 200);
    assert('6.5', 'Mappings is array', Array.isArray(mappings.b.data));

    // 6.3 Implement control
    const impl = await req('PUT', `/api/v1/controls/${controlId}/implementation`, {
      status: 'in_progress',
      notes: 'QA test - starting implementation'
    }, proToken);
    assert('6.6', 'PUT implementation returns 200', impl.s === 200);
    assert('6.7', 'Returns implementation data', !!impl.b.data?.implementation);

    // 6.4 Mark as implemented (triggers crosswalk)
    const implDone = await req('PUT', `/api/v1/controls/${controlId}/implementation`, {
      status: 'implemented',
      notes: 'QA test - completed'
    }, proToken);
    assert('6.8', 'Mark implemented returns 200', implDone.s === 200);
    assert('6.9', 'Has crosswalkedControls array', Array.isArray(implDone.b.data?.crosswalkedControls));

    // 6.5 Control history
    const history = await req('GET', `/api/v1/controls/${controlId}/history`, null, proToken);
    assert('6.10', 'Control history returns 200', history.s === 200);
    assert('6.11', 'History is array', Array.isArray(history.b.data));

    // 6.6 Implementations list
    const implList = await req('GET', '/api/v1/implementations', null, proToken);
    assert('6.12', 'GET implementations returns 200', implList.s === 200);
    assert('6.13', 'Implementations is array', Array.isArray(implList.b.data));
    assert('6.14', 'Has at least 1 implementation', implList.b.data?.length >= 1);

    // 6.7 Implementations with filters
    const implFiltered = await req('GET', '/api/v1/implementations?status=implemented', null, proToken);
    assert('6.15', 'Filtered implementations returns 200', implFiltered.s === 200);

    // 6.8 Activity feed
    const actFeed = await req('GET', '/api/v1/implementations/activity/feed?limit=5', null, proToken);
    assert('6.16', 'Activity feed returns 200', actFeed.s === 200);

    // 6.9 Due upcoming
    const due = await req('GET', '/api/v1/implementations/due/upcoming?days=30', null, proToken);
    assert('6.17', 'Due upcoming returns 200', due.s === 200);

    // 6.10 Get single implementation
    if (implList.b.data?.[0]?.id) {
      const implSingle = await req('GET', `/api/v1/implementations/${implList.b.data[0].id}`, null, proToken);
      assert('6.18', 'GET single implementation returns 200', implSingle.s === 200);

      // 6.11 Patch status
      const patchStatus = await req('PATCH', `/api/v1/implementations/${implList.b.data[0].id}/status`, {
        status: 'needs_review', notes: 'QA review test'
      }, proToken);
      assert('6.19', 'PATCH status returns 200', patchStatus.s === 200);

      // 6.12 Assign
      const assign = await req('PATCH', `/api/v1/implementations/${implList.b.data[0].id}/assign`, {
        assignedTo: adminUserId, notes: 'Assigned via QA test'
      }, proToken);
      assert('6.20', 'PATCH assign returns 200', assign.s === 200);

      // 6.13 Review
      const review = await req('POST', `/api/v1/implementations/${implList.b.data[0].id}/review`, {
        notes: 'QA review submission'
      }, proToken);
      assert('6.21', 'POST review returns 200', review.s === 200);
    }

    // 6.14 Nonexistent control
    const noCtrl = await req('GET', '/api/v1/controls/00000000-0000-0000-0000-000000000000', null, proToken);
    assert('6.22', 'Nonexistent control returns 404', noCtrl.s === 404);
  } else {
    skip('6.x', 'Control tests', 'No controls found');
  }

  // ======================== 7. CMDB ========================
  console.log('\n── 7. CMDB ──');

  // 7.1 Environments CRUD
  const envCreate = await req('POST', '/api/v1/cmdb/environments', {
    name: 'QA-Production', code: 'qa-prod', environment_type: 'production',
    description: 'QA test env', criticality: 'high'
  }, proToken);
  assert('7.1', 'Create environment returns 201', envCreate.s === 201);
  const envId = envCreate.b.data?.id;

  const envList = await req('GET', '/api/v1/cmdb/environments', null, proToken);
  assert('7.2', 'List environments returns 200', envList.s === 200);
  assert('7.3', 'Environments is array', Array.isArray(envList.b.data));

  if (envId) {
    const envGet = await req('GET', `/api/v1/cmdb/environments/${envId}`, null, proToken);
    assert('7.4', 'Get environment returns 200', envGet.s === 200);

    const envUpdate = await req('PUT', `/api/v1/cmdb/environments/${envId}`, {
      description: 'Updated QA env'
    }, proToken);
    assert('7.5', 'Update environment returns 200', envUpdate.s === 200);
  }

  // 7.2 Password Vaults CRUD
  const vaultCreate = await req('POST', '/api/v1/cmdb/password-vaults', {
    name: 'QA Vault', vault_type: 'hashicorp', vault_url: 'https://vault.qa.local',
    description: 'QA test vault'
  }, proToken);
  assert('7.6', 'Create vault returns 201', vaultCreate.s === 201);
  const vaultId = vaultCreate.b.data?.id;

  const vaultList = await req('GET', '/api/v1/cmdb/password-vaults', null, proToken);
  assert('7.7', 'List vaults returns 200', vaultList.s === 200);

  if (vaultId) {
    const vaultGet = await req('GET', `/api/v1/cmdb/password-vaults/${vaultId}`, null, proToken);
    assert('7.8', 'Get vault returns 200', vaultGet.s === 200);

    const vaultUpdate = await req('PUT', `/api/v1/cmdb/password-vaults/${vaultId}`, {
      description: 'Updated QA vault'
    }, proToken);
    assert('7.9', 'Update vault returns 200', vaultUpdate.s === 200);
  }

  // 7.3 Service Accounts CRUD
  const saCreate = await req('POST', '/api/v1/cmdb/service-accounts', {
    account_name: 'svc-qa-test', account_type: 'service',
    description: 'QA test service account', privilege_level: 'standard'
  }, proToken);
  assert('7.10', 'Create service account returns 201', saCreate.s === 201);
  const saId = saCreate.b.data?.id;

  const saList = await req('GET', '/api/v1/cmdb/service-accounts', null, proToken);
  assert('7.11', 'List service accounts returns 200', saList.s === 200);

  if (saId) {
    const saGet = await req('GET', `/api/v1/cmdb/service-accounts/${saId}`, null, proToken);
    assert('7.12', 'Get service account returns 200', saGet.s === 200);
  }

  // 7.4 Hardware Assets CRUD
  const hwCreate = await req('POST', '/api/v1/cmdb/hardware', {
    name: 'QA-Server-01', hostname: 'qa-srv-01.test.local',
    status: 'active', criticality: 'high'
  }, proToken);
  assert('7.13', 'Create hardware returns 201', hwCreate.s === 201);
  const hwId = hwCreate.b.data?.id;

  const hwList = await req('GET', '/api/v1/cmdb/hardware', null, proToken);
  assert('7.14', 'List hardware returns 200', hwList.s === 200);

  if (hwId) {
    const hwGet = await req('GET', `/api/v1/cmdb/hardware/${hwId}`, null, proToken);
    assert('7.15', 'Get hardware returns 200', hwGet.s === 200);

    const hwUpdate = await req('PUT', `/api/v1/cmdb/hardware/${hwId}`, { notes: 'Updated via QA' }, proToken);
    assert('7.16', 'Update hardware returns 200', hwUpdate.s === 200);
  }

  // 7.5 Software Assets CRUD
  const swCreate = await req('POST', '/api/v1/cmdb/software', {
    name: 'QA-App-Suite', version: '2.0.0', status: 'active', criticality: 'medium'
  }, proToken);
  assert('7.17', 'Create software returns 201', swCreate.s === 201);
  const swId = swCreate.b.data?.id;

  const swList = await req('GET', '/api/v1/cmdb/software', null, proToken);
  assert('7.18', 'List software returns 200', swList.s === 200);

  // 7.6 AI Agents CRUD
  const aiCreate = await req('POST', '/api/v1/cmdb/ai-agents', {
    name: 'QA-AI-Model', ai_model_type: 'classification',
    ai_risk_level: 'limited', status: 'active', criticality: 'high'
  }, proToken);
  assert('7.19', 'Create AI agent returns 201', aiCreate.s === 201);
  const aiAssetId = aiCreate.b.data?.id;

  const aiList = await req('GET', '/api/v1/cmdb/ai-agents', null, proToken);
  assert('7.20', 'List AI agents returns 200', aiList.s === 200);

  // ======================== 8. EVIDENCE ========================
  console.log('\n── 8. Evidence ──');

  // Create a temp file for upload
  const tmpFile = path.join(__dirname, 'qa-test-evidence.txt');
  fs.writeFileSync(tmpFile, 'QA Test Evidence Content\nLine 2\nLine 3');

  const evUpload = await uploadFile('/api/v1/evidence/upload', tmpFile, {
    description: 'QA test evidence file',
    tags: 'qa,test,automated'
  }, proToken);
  assert('8.1', 'Upload evidence returns 201', evUpload.s === 201);
  const evidenceId = evUpload.b.data?.id;

  const evList = await req('GET', '/api/v1/evidence', null, proToken);
  assert('8.2', 'List evidence returns 200', evList.s === 200);
  assert('8.3', 'Evidence is array', Array.isArray(evList.b.data));

  // Search
  const evSearch = await req('GET', '/api/v1/evidence?search=QA', null, proToken);
  assert('8.4', 'Evidence search returns 200', evSearch.s === 200);

  if (evidenceId) {
    const evGet = await req('GET', `/api/v1/evidence/${evidenceId}`, null, proToken);
    assert('8.5', 'Get evidence returns 200', evGet.s === 200);
    assert('8.6', 'Evidence has file_name', !!evGet.b.data?.file_name);

    // Update
    const evUpdate = await req('PUT', `/api/v1/evidence/${evidenceId}`, {
      description: 'Updated QA evidence'
    }, proToken);
    assert('8.7', 'Update evidence returns 200', evUpdate.s === 200);

    // Link to control
    if (controlId) {
      const evLink = await req('POST', `/api/v1/evidence/${evidenceId}/link`, {
        controlIds: [controlId], notes: 'QA test link'
      }, proToken);
      assert('8.8', 'Link evidence to control returns 200', evLink.s === 200);

      // Verify linked controls
      const evDetail = await req('GET', `/api/v1/evidence/${evidenceId}`, null, proToken);
      assert('8.9', 'Evidence shows linked controls', evDetail.b.data?.linked_controls?.length >= 1);

      // Unlink
      const evUnlink = await req('DELETE', `/api/v1/evidence/${evidenceId}/unlink/${controlId}`, null, proToken);
      assert('8.10', 'Unlink control returns 200', evUnlink.s === 200);
    }

    // Download
    const evDl = await req('GET', `/api/v1/evidence/${evidenceId}/download`, null, proToken, true);
    assert('8.11', 'Download evidence returns 200', evDl.s === 200);

    // Delete
    const evDel = await req('DELETE', `/api/v1/evidence/${evidenceId}`, null, proToken);
    assert('8.12', 'Delete evidence returns 200', evDel.s === 200);

    // Verify deleted
    const evGone = await req('GET', `/api/v1/evidence/${evidenceId}`, null, proToken);
    assert('8.13', 'Deleted evidence returns 404', evGone.s === 404);
  }

  // Cleanup temp file
  try { fs.unlinkSync(tmpFile); } catch (e) {}

  // ======================== 9. AUDIT ========================
  console.log('\n── 9. Audit ──');

  const auditLogs = await req('GET', '/api/v1/audit/logs', null, proToken);
  assert('9.1', 'Audit logs returns 200', auditLogs.s === 200);
  assert('9.2', 'Audit data is array', Array.isArray(auditLogs.b.data));
  assert('9.3', 'Audit has pagination', !!auditLogs.b.pagination);

  const auditStats = await req('GET', '/api/v1/audit/stats', null, proToken);
  assert('9.4', 'Audit stats returns 200', auditStats.s === 200);
  assert('9.5', 'Stats has eventBreakdown', Array.isArray(auditStats.b.data?.eventBreakdown));
  assert('9.6', 'Stats has totalEvents', auditStats.b.data?.totalEvents !== undefined);

  const auditTypes = await req('GET', '/api/v1/audit/event-types', null, proToken);
  assert('9.7', 'Event types returns 200', auditTypes.s === 200);

  const userAudit = await req('GET', `/api/v1/audit/user/${adminUserId}`, null, proToken);
  assert('9.8', 'User audit returns 200', userAudit.s === 200);

  // Filtered audit logs
  const filteredAudit = await req('GET', '/api/v1/audit/logs?limit=5&offset=0', null, proToken);
  assert('9.9', 'Filtered audit logs returns 200', filteredAudit.s === 200);

  // ======================== 10. ROLES & RBAC ========================
  console.log('\n── 10. Roles & RBAC ──');

  const rolesList = await req('GET', '/api/v1/roles', null, proToken);
  assert('10.1', 'List roles returns 200', rolesList.s === 200);
  assert('10.2', 'Roles is array', Array.isArray(rolesList.b.data));

  // Create role
  const roleCreate = await req('POST', '/api/v1/roles', {
    name: 'qa-tester-role', description: 'QA Test Role'
  }, proToken);
  assert('10.3', 'Create role returns 201', roleCreate.s === 201);
  const roleId = roleCreate.b.data?.id;

  if (roleId) {
    // Update role
    const roleUpdate = await req('PUT', `/api/v1/roles/${roleId}`, {
      description: 'Updated QA role'
    }, proToken);
    assert('10.4', 'Update role returns 200', roleUpdate.s === 200);

    // Assign role to user
    const roleAssign = await req('POST', '/api/v1/roles/assign', {
      userId: adminUserId, roleIds: [roleId]
    }, proToken);
    assert('10.5', 'Assign role returns 200', roleAssign.s === 200);

    // Get user roles
    const userRoles = await req('GET', `/api/v1/roles/user/${adminUserId}`, null, proToken);
    assert('10.6', 'Get user roles returns 200', userRoles.s === 200);
    assert('10.7', 'User has assigned role', userRoles.b.data?.length >= 1);

    // Delete role
    const roleDel = await req('DELETE', `/api/v1/roles/${roleId}`, null, proToken);
    assert('10.8', 'Delete role returns 200', roleDel.s === 200);
  }

  // Permissions list
  const permsList = await req('GET', '/api/v1/roles/permissions/all', null, proToken);
  assert('10.9', 'GET permissions returns 200', permsList.s === 200);

  // ======================== 11. USERS ========================
  console.log('\n── 11. Users ──');

  const usersList = await req('GET', '/api/v1/users', null, proToken);
  assert('11.1', 'List users returns 200', usersList.s === 200);
  assert('11.2', 'Users is array', Array.isArray(usersList.b.data));
  assert('11.3', 'Has at least 1 user', usersList.b.data?.length >= 1);

  // ======================== 12. AI ANALYSIS (All 21 endpoints) ========================
  console.log('\n── 12. AI Analysis ──');

  // 12.1 Status endpoint
  const aiStatus = await req('GET', '/api/v1/ai/status', null, proToken);
  assert('12.1', 'AI status returns 200', aiStatus.s === 200);
  assert('12.2', 'Has providers object', !!aiStatus.b.data?.providers);
  assert('12.3', 'Has usage object', !!aiStatus.b.data?.usage);
  assert('12.4', 'Has features object', !!aiStatus.b.data?.features);
  assert('12.5', 'Has tier info', !!aiStatus.b.data?.tier);
  assert('12.6', 'Professional tier = unlimited usage', aiStatus.b.data?.usage?.limit === 'unlimited');

  // All AI POST endpoints should return 400 "No API key" when no BYOK key configured
  const aiEndpoints = [
    { path: '/api/v1/ai/gap-analysis', body: {}, name: 'Gap Analysis' },
    { path: '/api/v1/ai/crosswalk-optimizer', body: {}, name: 'Crosswalk Optimizer' },
    { path: '/api/v1/ai/compliance-forecast', body: {}, name: 'Compliance Forecast' },
    { path: '/api/v1/ai/regulatory-monitor', body: { frameworks: ['nist_csf'] }, name: 'Regulatory Monitor' },
    { path: `/api/v1/ai/remediation/${controlId || '00000000-0000-0000-0000-000000000000'}`, body: {}, name: 'Remediation Playbook' },
    { path: '/api/v1/ai/incident-response', body: { incidentType: 'ransomware' }, name: 'Incident Response' },
    { path: '/api/v1/ai/executive-report', body: {}, name: 'Executive Report' },
    { path: '/api/v1/ai/risk-heatmap', body: {}, name: 'Risk Heatmap' },
    { path: '/api/v1/ai/vendor-risk', body: { vendorInfo: { name: 'TestVendor' } }, name: 'Vendor Risk' },
    { path: '/api/v1/ai/audit-readiness', body: { framework: 'nist_csf' }, name: 'Audit Readiness' },
    { path: '/api/v1/ai/asset-control-mapping', body: {}, name: 'Asset-Control Mapping' },
    { path: '/api/v1/ai/shadow-it', body: {}, name: 'Shadow IT' },
    { path: '/api/v1/ai/ai-governance', body: {}, name: 'AI Governance' },
    { path: '/api/v1/ai/query', body: { question: 'What is our compliance status?' }, name: 'Compliance Query' },
    { path: '/api/v1/ai/training-recommendations', body: {}, name: 'Training Recs' },
    { path: `/api/v1/ai/evidence-suggest/${controlId || '00000000-0000-0000-0000-000000000000'}`, body: {}, name: 'Evidence Suggest' },
    { path: `/api/v1/ai/analyze/control/${controlId || '00000000-0000-0000-0000-000000000000'}`, body: {}, name: 'Control Analysis' },
    { path: `/api/v1/ai/test-procedures/${controlId || '00000000-0000-0000-0000-000000000000'}`, body: {}, name: 'Test Procedures' },
    { path: `/api/v1/ai/analyze/asset/${hwId || '00000000-0000-0000-0000-000000000000'}`, body: {}, name: 'Asset Risk' },
    { path: '/api/v1/ai/generate-policy', body: { policyType: 'Information Security' }, name: 'Policy Generator' },
    { path: '/api/v1/ai/chat', body: { messages: [{ role: 'user', content: 'Hello' }] }, name: 'Chat' },
  ];

  let aiTestNum = 7;
  for (const ep of aiEndpoints) {
    const r = await req('POST', ep.path, ep.body, proToken);
    // Without a configured API key, these should return 400 with "No API key" error
    assert(`12.${aiTestNum}`, `${ep.name}: returns 400 no API key (got ${r.s})`,
      r.s === 400 && (r.b.error || '').toLowerCase().includes('no api key'));
    aiTestNum++;
  }

  // ======================== 13. SETTINGS (LLM) ========================
  console.log('\n── 13. Settings ──');

  const llmGet = await req('GET', '/api/v1/settings/llm', null, proToken);
  assert('13.1', 'GET LLM settings returns 200', llmGet.s === 200);
  assert('13.2', 'Has settings object', !!llmGet.b.data);
  assert('13.3', 'Has defaultProvider', !!llmGet.b.data?.defaultProvider);

  // Save a fake key
  const llmPut = await req('PUT', '/api/v1/settings/llm', {
    default_provider: 'openai',
    default_model: 'gpt-4o-mini'
  }, proToken);
  assert('13.4', 'PUT LLM settings returns 200', llmPut.s === 200);

  // Verify saved
  const llmGet2 = await req('GET', '/api/v1/settings/llm', null, proToken);
  assert('13.5', 'Default provider updated to openai', llmGet2.b.data?.defaultProvider === 'openai');

  // Test API key validation (will fail with bad key, but endpoint should work)
  const llmTest = await req('POST', '/api/v1/settings/llm/test', {
    provider: 'claude', apiKey: 'sk-ant-fake-key-for-testing'
  }, proToken);
  assert('13.6', 'LLM test endpoint responds (400 = bad key)', llmTest.s === 400);

  // Delete API key (should work even if none exists)
  const llmDel = await req('DELETE', '/api/v1/settings/llm/claude', null, proToken);
  assert('13.7', 'DELETE LLM key returns 200', llmDel.s === 200);

  // Invalid provider
  const llmBadProv = await req('DELETE', '/api/v1/settings/llm/invalid', null, proToken);
  assert('13.8', 'Invalid provider returns 400', llmBadProv.s === 400);

  // Reset default provider back
  await req('PUT', '/api/v1/settings/llm', { default_provider: 'claude', default_model: null }, proToken);

  // ======================== 14. ASSESSMENTS ========================
  console.log('\n── 14. Assessments ──');

  const asmtProcs = await req('GET', '/api/v1/assessments/procedures', null, proToken);
  assert('14.1', 'List procedures returns 200', asmtProcs.s === 200);
  assert('14.2', 'Has procedures array', Array.isArray(asmtProcs.b.data?.procedures));
  assert('14.3', 'Has total count', asmtProcs.b.data?.total !== undefined);

  // Filter by framework
  const asmtFiltered = await req('GET', '/api/v1/assessments/procedures?framework_code=nist_800_53a', null, proToken);
  assert('14.4', 'Filtered procedures returns 200', asmtFiltered.s === 200);

  // Procedure detail
  const firstProc = asmtProcs.b.data?.procedures?.[0];
  if (firstProc?.id) {
    const procDetail = await req('GET', `/api/v1/assessments/procedures/${firstProc.id}`, null, proToken);
    assert('14.5', 'Procedure detail returns 200', procDetail.s === 200);
    assert('14.6', 'Has procedure_type', !!procDetail.b.data?.procedure_type);
  }

  // By control
  if (controlId) {
    const byCtrl = await req('GET', `/api/v1/assessments/procedures/by-control/${controlId}`, null, proToken);
    assert('14.7', 'Procedures by control returns 200', byCtrl.s === 200);
  }

  // Record result
  if (firstProc?.id) {
    const recordResult = await req('POST', '/api/v1/assessments/results', {
      procedure_id: firstProc.id,
      status: 'satisfied',
      finding: 'QA test - control meets requirements',
      evidence_collected: 'Screenshots and logs',
      risk_level: 'low'
    }, proToken);
    assert('14.8', 'Record result returns 200', recordResult.s === 200);
  }

  // Bad result
  const badResult = await req('POST', '/api/v1/assessments/results', {
    procedure_id: null, status: 'invalid_status'
  }, proToken);
  assert('14.9', 'Bad result returns 400', badResult.s === 400);

  // Assessment stats
  const asmtStats = await req('GET', '/api/v1/assessments/stats', null, proToken);
  assert('14.10', 'Assessment stats returns 200', asmtStats.s === 200);
  assert('14.11', 'Stats has summary', !!asmtStats.b.data?.summary);
  assert('14.12', 'Stats has by_framework', Array.isArray(asmtStats.b.data?.by_framework));
  assert('14.13', 'Stats has by_type', Array.isArray(asmtStats.b.data?.by_type));

  // Assessment frameworks
  const asmtFws = await req('GET', '/api/v1/assessments/frameworks', null, proToken);
  assert('14.14', 'Assessment frameworks returns 200', asmtFws.s === 200);

  // Create plan
  const planCreate = await req('POST', '/api/v1/assessments/plans', {
    name: 'QA Assessment Plan',
    description: 'Test plan from QA suite',
    assessment_type: 'initial',
    depth: 'focused'
  }, proToken);
  assert('14.15', 'Create plan returns 201', planCreate.s === 201);

  // List plans
  const plansList = await req('GET', '/api/v1/assessments/plans', null, proToken);
  assert('14.16', 'List plans returns 200', plansList.s === 200);

  // Bad plan (missing name)
  const badPlan = await req('POST', '/api/v1/assessments/plans', { description: 'No name' }, proToken);
  assert('14.17', 'Plan without name returns 400', badPlan.s === 400);

  // ======================== 15. REPORTS ========================
  console.log('\n── 15. Reports ──');

  const reportTypes = await req('GET', '/api/v1/reports/types', null, proToken);
  assert('15.1', 'Report types returns 200', reportTypes.s === 200);
  assert('15.2', 'Has report types array', Array.isArray(reportTypes.b.data));
  assert('15.3', 'Has PDF and Excel types', reportTypes.b.data?.length >= 2);

  // PDF download
  const pdfReport = await req('GET', '/api/v1/reports/compliance/pdf', null, proToken, true);
  assert('15.4', 'PDF report returns 200', pdfReport.s === 200);
  assert('15.5', 'PDF has correct content-type', (pdfReport.h?.['content-type'] || '').includes('pdf'));
  assert('15.6', 'PDF has content (>100 bytes)', pdfReport.b?.length > 100);

  // Excel download
  const xlReport = await req('GET', '/api/v1/reports/compliance/excel', null, proToken, true);
  assert('15.7', 'Excel report returns 200', xlReport.s === 200);
  assert('15.8', 'Excel has correct content-type', (xlReport.h?.['content-type'] || '').includes('spreadsheet') || (xlReport.h?.['content-type'] || '').includes('openxml'));
  assert('15.9', 'Excel has content (>100 bytes)', xlReport.b?.length > 100);

  // ======================== 16. NOTIFICATIONS ========================
  console.log('\n── 16. Notifications ──');

  // Create notification
  const notifCreate = await req('POST', '/api/v1/notifications', {
    type: 'info', title: 'QA Test Notification',
    message: 'This is a test notification from the QA suite',
    link: '/dashboard'
  }, proToken);
  assert('16.1', 'Create notification returns 201', notifCreate.s === 201);
  const notifId = notifCreate.b.data?.id;

  // List notifications
  const notifList = await req('GET', '/api/v1/notifications', null, proToken);
  assert('16.2', 'List notifications returns 200', notifList.s === 200);
  assert('16.3', 'Has notifications array', Array.isArray(notifList.b.data?.notifications));
  assert('16.4', 'Has unreadCount', notifList.b.data?.unreadCount !== undefined);

  // Unread only
  const notifUnread = await req('GET', '/api/v1/notifications?unread=true', null, proToken);
  assert('16.5', 'Unread filter returns 200', notifUnread.s === 200);

  // Mark single as read
  if (notifId) {
    const markRead = await req('PATCH', `/api/v1/notifications/${notifId}/read`, null, proToken);
    assert('16.6', 'Mark read returns 200', markRead.s === 200);
  }

  // Create another and mark all read
  await req('POST', '/api/v1/notifications', {
    type: 'warning', title: 'QA Test 2', message: 'Another test'
  }, proToken);
  const markAll = await req('POST', '/api/v1/notifications/read-all', null, proToken);
  assert('16.7', 'Mark all read returns 200', markAll.s === 200);

  // Verify all read
  const notifAfter = await req('GET', '/api/v1/notifications?unread=true', null, proToken);
  assert('16.8', 'All notifications marked read', notifAfter.b.data?.unreadCount === 0);

  // ======================== 17. CROSS-ORG SECURITY ========================
  console.log('\n── 17. Cross-Org Security ──');

  // Register a second user in a different org
  const reg2 = await req('POST', '/api/v1/auth/register', {
    email: email2, password: pass, full_name: 'Other User', organization_name: 'Other Org'
  });
  const otherToken = reg2.b.data?.tokens?.accessToken;
  const otherOrgId = reg2.b.data?.organization?.id;

  // Other user tries to access our org's frameworks
  const crossOrg1 = await req('GET', `/api/v1/organizations/${orgId}/frameworks`, null, otherToken);
  assert('17.1', 'Cross-org framework access blocked (403)', crossOrg1.s === 403);

  // Other user tries to add frameworks to our org
  const crossOrg2 = await req('POST', `/api/v1/organizations/${orgId}/frameworks`, { frameworkIds: [frameworkIds[0]] }, otherToken);
  assert('17.2', 'Cross-org framework add blocked (403)', crossOrg2.s === 403);

  // Other user tries to get our org's controls
  const crossOrg3 = await req('GET', `/api/v1/organizations/${orgId}/controls`, null, otherToken);
  assert('17.3', 'Cross-org controls access blocked (403)', crossOrg3.s === 403);

  // Other user tries to delete our framework
  if (frameworkIds[0]) {
    const crossOrg4 = await req('DELETE', `/api/v1/organizations/${orgId}/frameworks/${frameworkIds[0]}`, null, otherToken);
    assert('17.4', 'Cross-org framework delete blocked (403)', crossOrg4.s === 403);
  }

  // Controls are visible but scoped to their org (implementations filtered)
  // This verifies that implementation data doesn't leak
  if (controlId) {
    const otherCtrl = await req('GET', `/api/v1/controls/${controlId}`, null, otherToken);
    // Control details are global (framework controls are shared), but implementation data is scoped
    assert('17.5', 'Control detail accessible but implementation scoped',
      otherCtrl.s === 200 && otherCtrl.b.data?.implementation_status === 'not_started');
  }

  // ======================== 18. RBAC (Admin vs Non-Admin) ========================
  console.log('\n── 18. RBAC ──');

  // Upgrade other org to professional so we can test non-admin access
  await dbQuery('UPDATE organizations SET tier = $1 WHERE id = $2', ['professional', otherOrgId]);

  // Non-admin trying admin-only operations
  // Settings PUT requires admin
  const nonAdminSettings = await req('PUT', '/api/v1/settings/llm', { default_provider: 'openai' }, otherToken);
  // Note: register creates admin user, so this should actually work — let's create a true non-admin
  // For the second org, the registering user IS admin. We need to create a non-admin in the SAME org.
  // Let's insert a viewer user into org1 directly
  const bcrypt = require('bcryptjs');
  const viewerHash = await bcrypt.hash(pass, 12);
  let viewerUserId;
  try {
    const viewerResult = await dbQuery(
      `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, $3, 'QA', 'Viewer', 'viewer', true) RETURNING id`,
      [orgId, `viewer-${ts}@test.com`, viewerHash]
    );
    viewerUserId = viewerResult.rows[0]?.id;
  } catch (e) {
    console.log('  (Viewer creation error:', e.message, ')');
  }

  // Login as viewer
  const viewerLogin = await req('POST', '/api/v1/auth/login', {
    email: `viewer-${ts}@test.com`, password: pass
  });
  const viewerToken = viewerLogin.b.data?.tokens?.accessToken;
  assert('18.1', 'Viewer can login', viewerLogin.s === 200);

  if (viewerToken) {
    // Viewer CAN read
    const vDash = await req('GET', '/api/v1/dashboard/stats', null, viewerToken);
    assert('18.2', 'Viewer can read dashboard', vDash.s === 200);

    const vFws = await req('GET', '/api/v1/frameworks', null, viewerToken);
    assert('18.3', 'Viewer can list frameworks', vFws.s === 200);

    // Viewer CANNOT do admin operations
    const vCreateRole = await req('POST', '/api/v1/roles', { name: 'hacker-role' }, viewerToken);
    assert('18.4', 'Viewer cannot create roles (403)', vCreateRole.s === 403);

    const vUpdateSettings = await req('PUT', '/api/v1/settings/llm', { default_provider: 'openai' }, viewerToken);
    assert('18.5', 'Viewer cannot update settings (403)', vUpdateSettings.s === 403);

    const vTestLLM = await req('POST', '/api/v1/settings/llm/test', {
      provider: 'claude', apiKey: 'fake'
    }, viewerToken);
    assert('18.6', 'Viewer cannot test LLM keys (403)', vTestLLM.s === 403);

    const vDelLLM = await req('DELETE', '/api/v1/settings/llm/claude', null, viewerToken);
    assert('18.7', 'Viewer cannot delete LLM keys (403)', vDelLLM.s === 403);
  }

  // ======================== 19. EDGE CASES & SECURITY ========================
  console.log('\n── 19. Edge Cases & Security ──');

  // SQL injection attempts
  const sqli1 = await req('GET', `/api/v1/organizations/${orgId}/controls?frameworkId='; DROP TABLE users;--`, null, proToken);
  assert('19.1', 'SQL injection in query param handled safely', sqli1.s === 200 || sqli1.s === 400 || sqli1.s === 500);

  const sqli2 = await req('POST', '/api/v1/auth/login', {
    email: "' OR 1=1 --", password: 'test'
  });
  assert('19.2', 'SQL injection in login blocked', sqli2.s === 401);

  // XSS in input
  const xss = await req('POST', '/api/v1/notifications', {
    type: 'info', title: '<script>alert("xss")</script>',
    message: '<img src=x onerror=alert(1)>'
  }, proToken);
  assert('19.3', 'XSS input stored but not executed (201)', xss.s === 201);

  // Invalid UUIDs
  const badUuid = await req('GET', '/api/v1/controls/not-a-uuid', null, proToken);
  assert('19.4', 'Invalid UUID returns error', badUuid.s === 500 || badUuid.s === 400 || badUuid.s === 404);

  // 404 route
  const notFound = await req('GET', '/api/v1/nonexistent-route', null, proToken);
  assert('19.5', 'Unknown route returns 404', notFound.s === 404);

  // Empty body on POST
  const emptyBody = await req('POST', '/api/v1/auth/register', {});
  assert('19.6', 'Empty body register returns 400', emptyBody.s === 400);

  // Very long string
  const longStr = 'A'.repeat(10000);
  const longInput = await req('POST', '/api/v1/notifications', {
    type: 'info', title: longStr, message: 'test'
  }, proToken);
  assert('19.7', 'Very long input handled (no crash)', longInput.s === 201 || longInput.s === 500);

  // Expired/invalid refresh token
  const badRefresh = await req('POST', '/api/v1/auth/refresh', { refreshToken: 'invalid.token.value' });
  assert('19.8', 'Invalid refresh token returns 401', badRefresh.s === 401);

  // Missing required body field
  const missingField = await req('POST', '/api/v1/assessments/results', { status: 'satisfied' }, proToken);
  assert('19.9', 'Missing procedure_id returns 400', missingField.s === 400);

  // ======================== 20. DELETE / CLEANUP OPERATIONS ========================
  console.log('\n── 20. Cleanup & Delete Operations ──');

  // Delete CMDB items
  if (hwId) {
    const delHw = await req('DELETE', `/api/v1/cmdb/hardware/${hwId}`, null, proToken);
    assert('20.1', 'Delete hardware returns 200', delHw.s === 200);
  }
  if (swId) {
    const delSw = await req('DELETE', `/api/v1/cmdb/software/${swId}`, null, proToken);
    assert('20.2', 'Delete software returns 200', delSw.s === 200);
  }
  if (aiAssetId) {
    const delAi = await req('DELETE', `/api/v1/cmdb/ai-agents/${aiAssetId}`, null, proToken);
    assert('20.3', 'Delete AI agent returns 200', delAi.s === 200);
  }
  if (saId) {
    const delSa = await req('DELETE', `/api/v1/cmdb/service-accounts/${saId}`, null, proToken);
    assert('20.4', 'Delete service account returns 200', delSa.s === 200);
  }
  if (vaultId) {
    const delVault = await req('DELETE', `/api/v1/cmdb/password-vaults/${vaultId}`, null, proToken);
    assert('20.5', 'Delete vault returns 200', delVault.s === 200);
  }
  if (envId) {
    const delEnv = await req('DELETE', `/api/v1/cmdb/environments/${envId}`, null, proToken);
    assert('20.6', 'Delete environment returns 200', delEnv.s === 200);
  }

  // Remove framework from org
  if (frameworkIds[0]) {
    const delFw = await req('DELETE', `/api/v1/organizations/${orgId}/frameworks/${frameworkIds[0]}`, null, proToken);
    assert('20.7', 'Delete org framework returns 200', delFw.s === 200);
  }

  // ======================== 21. LOGOUT & SESSION ========================
  console.log('\n── 21. Logout & Session ──');

  const logout = await req('POST', '/api/v1/auth/logout', null, proToken);
  assert('21.1', 'Logout returns 200', logout.s === 200);

  // Verify session invalidated (refresh should fail)
  const postLogoutRefresh = await req('POST', '/api/v1/auth/refresh', { refreshToken: adminRefresh });
  assert('21.2', 'Refresh after logout fails', postLogoutRefresh.s === 401);

  // Token itself still works until expiry (JWT is stateless) — this is expected behavior
  const postLogoutMe = await req('GET', '/api/v1/auth/me', null, proToken);
  assert('21.3', 'Access token works until expiry (stateless JWT)', postLogoutMe.s === 200);

  // ══════════════════════════ RESULTS ══════════════════════════

  console.log('\n══════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log(`  TOTAL:   ${passed + failed + skipped} tests`);
  console.log('══════════════════════════════════════════════════');

  if (failures.length > 0) {
    console.log('\n  FAILURES:');
    failures.forEach(f => console.log(`    ❌ ${f}`));
  }

  console.log('\n');
  process.exit(failed > 0 ? 1 : 0);
})();
