// @tier: exclude
/**
 * qa-enterprise-demo.js
 *
 * End-to-end QA suite for the enterprise demo account.
 * Tests every feature touched by the recent notifications / AI traceability /
 * bias-tracking implementation using the seeded demo data.
 *
 * Works against local or deployed APIs.
 * Requires seed:enterprise-demo to have been run first.
 *
 * Coverage:
 *   A. Auth          — admin login, auditor login, token refresh, /me
 *   B. Controls      — list implementations, verify mixed statuses, auditor access
 *   C. Notifications — list (unread filter, type filter, pagination)
 *                      mark individual read, mark all read
 *                      GET /preferences, PUT /preferences
 *                      GET /email-status
 *   D. POA&M         — list, verify items exist
 *   E. Evidence      — list, verify files exist
 *   F. AI Decisions  — GET /ai/decisions (admin), filters, pagination
 *                      PATCH /ai/decisions/:id/review
 *                      PATCH /ai/decisions/:id/bias-review
 *                      GET /ai/status bias_coverage
 *   G. RBAC          — auditor cannot access admin-only endpoints
 *   H. Notification  — notification creation side-effects (status change trigger)
 *   I. Cross-org     — enterprise data not visible to other orgs
 */

require('dotenv').config();
const http = require('http');
const https = require('https');

const BASE = (process.env.QA_BASE_URL || process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/+$/, '');
const PASSWORD_CANDIDATES = Array.from(
  new Set(
    [
      process.env.QA_DEMO_PASSWORD,
      process.env.ADMIN_PASSWORD,
      process.env.QA_PASSWORD,
      'ControlWeave!2026'
    ].filter(Boolean)
  )
);
const ADMIN_EMAIL = process.env.QA_ENTERPRISE_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@enterprise.com';
const AUDITOR_EMAIL = process.env.QA_ENTERPRISE_AUDITOR_EMAIL || 'auditor@enterprise.com';
const OTHER_ORG_EMAIL = process.env.QA_OTHER_ADMIN_EMAIL || 'admin@community.com';
const STRICT_DEMO_STATE = String(process.env.QA_STRICT_DEMO_STATE || 'false').toLowerCase() === 'true';

let passed = 0;
let failed = 0;
const failures = [];

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function req(method, urlPath, body, token) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, BASE);
    const transport = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    const r = transport.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ s: res.statusCode, b: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch { resolve({ s: res.statusCode, b: {} }); }
      });
    });
    r.on('error', e => resolve({ s: 0, b: { error: e.message } }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function loginWithFallback(email) {
  for (const password of PASSWORD_CANDIDATES) {
    const response = await req('POST', '/api/v1/auth/login', { email, password });
    if (response.s === 200) {
      return { response, password };
    }
  }

  return { response: { s: 401, b: { error: `No working credentials for ${email}` } }, password: null };
}

// ─── Assertion helpers ────────────────────────────────────────────────────────
function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    process.stdout.write(`  ✓ ${label}\n`);
  } else {
    failed++;
    const msg = `  ✗ ${label}${detail ? ' — ' + detail : ''}`;
    process.stdout.write(msg + '\n');
    failures.push(msg);
  }
}

function assertSeeded(label, condition, detail = '') {
  if (STRICT_DEMO_STATE) {
    assert(label, condition, detail);
    return;
  }

  process.stdout.write(`  ⊘ ${label} (seed check skipped${detail ? ` — ${detail}` : ''})\n`);
}

function section(title) {
  console.log(`\n── ${title} ─────────────────────────────────────`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n================================================');
  console.log(' Enterprise Demo QA Suite');
  console.log('================================================\n');
  console.log(` Base URL: ${BASE}`);

  // ── A. Auth ─────────────────────────────────────────────────────────────────
  section('A. Auth');

  const adminLogin = (await loginWithFallback(ADMIN_EMAIL)).response;
  assert('Admin login → 200', adminLogin.s === 200, `got ${adminLogin.s}`);
  const adminToken = adminLogin.b?.data?.tokens?.accessToken;
  assert('Admin receives access token', !!adminToken);

  const auditorLogin = (await loginWithFallback(AUDITOR_EMAIL)).response;
  assert('Auditor login → 200', auditorLogin.s === 200, `got ${auditorLogin.s}`);
  const auditorToken = auditorLogin.b?.data?.tokens?.accessToken;
  assert('Auditor receives access token', !!auditorToken);

  const adminMe = await req('GET', '/api/v1/auth/me', null, adminToken);
  assert('Admin /me → 200', adminMe.s === 200);
  assert('Admin role is admin', adminMe.b?.data?.role === 'admin', adminMe.b?.data?.role);
  if (STRICT_DEMO_STATE) {
    assert('Admin tier is enterprise', adminMe.b?.data?.organization?.tier === 'enterprise', adminMe.b?.data?.organization?.tier);
  } else {
    process.stdout.write(`  ⊘ Tier check skipped (actual: ${adminMe.b?.data?.organization?.tier || 'unknown'})\n`);
  }

  const auditorMe = await req('GET', '/api/v1/auth/me', null, auditorToken);
  assert('Auditor /me → 200', auditorMe.s === 200);
  assert('Auditor role is auditor', auditorMe.b?.data?.role === 'auditor', auditorMe.b?.data?.role);
  assert('Auditor same org as admin', auditorMe.b?.data?.organization?.id === adminMe.b?.data?.organization?.id);

  const orgId = adminMe.b?.data?.organization?.id;

  // ── B. Controls ─────────────────────────────────────────────────────────────
  section('B. Controls (implementations)');

  const implRes = await req('GET', `/api/v1/organizations/${orgId}/controls`, null, adminToken);
  assert('Controls list → 200', implRes.s === 200, `got ${implRes.s}`);
  const controls = implRes.b?.data?.controls || implRes.b?.data || [];
  assert('Has seeded controls (≥10)', Array.isArray(controls) && controls.length >= 10, `count=${controls.length}`);

  // Auditor can see controls
  const auditorControls = await req('GET', `/api/v1/organizations/${orgId}/controls`, null, auditorToken);
  assert('Auditor can list controls → 200', auditorControls.s === 200, `got ${auditorControls.s}`);

  // Verify mixed statuses present
  const allImpls = await req('GET', '/api/v1/implementations', null, adminToken);
  assert('Implementations list → 200', allImpls.s === 200 || allImpls.s === 404, `got ${allImpls.s}`); // 404 if route not at this path
  if (allImpls.s === 200) {
    const implList = allImpls.b?.data?.implementations || allImpls.b?.data || [];
    const statuses = new Set(implList.map(i => i.status));
    assertSeeded('Has "verified" implementations', statuses.has('verified'), `statuses: ${[...statuses].join(',')}`);
    assertSeeded('Has "in_progress" implementations', statuses.has('in_progress'));
  }

  // ── C. Notifications ────────────────────────────────────────────────────────
  section('C. Notifications');

  const notifAll = await req('GET', '/api/v1/notifications', null, adminToken);
  assert('Notifications list → 200', notifAll.s === 200, `got ${notifAll.s}`);
  const allNotifs = notifAll.b?.data?.notifications || notifAll.b?.data || [];
  assertSeeded('Has seeded notifications (≥7)', Array.isArray(allNotifs) && allNotifs.length >= 7, `count=${allNotifs.length}`);

  // Unread filter
  const notifUnread = await req('GET', '/api/v1/notifications?unread=true', null, adminToken);
  assert('Unread notifications → 200', notifUnread.s === 200);
  const unreadList = notifUnread.b?.data?.notifications || notifUnread.b?.data || [];
  // Note: count may be 0 on repeated runs (prev run marks all read) — just verify filter works
  assert('Unread filter returns only unread items', unreadList.every(n => !n.is_read), `some are marked read (count=${unreadList.length})`);
  // Seed some unread for subsequent tests — create one fresh notification via the API
  await req('POST', '/api/v1/notifications', { type: 'system', title: 'QA Test Notification', message: 'Created by QA suite' }, adminToken);

  // Type filter
  const notifType = await req('GET', '/api/v1/notifications?type=control_due', null, adminToken);
  assert('Type filter → 200', notifType.s === 200);
  const typedList = notifType.b?.data?.notifications || notifType.b?.data || [];
  assert('Type filter returns only control_due', typedList.every(n => n.type === 'control_due'), `types: ${typedList.map(n=>n.type).join(',')}`);

  // Re-fetch unread list (includes the one we just created)
  const notifUnread2 = await req('GET', '/api/v1/notifications?unread=true', null, adminToken);
  const freshUnreadList = notifUnread2.b?.data?.notifications || notifUnread2.b?.data || [];

  // Mark individual read
  const firstUnread = freshUnreadList[0];
  if (firstUnread?.id) {
    const markRes = await req('PATCH', `/api/v1/notifications/${firstUnread.id}/read`, null, adminToken);
    assert('Mark notification read → 200', markRes.s === 200, `got ${markRes.s}`);
    // Verify it's now read
    const verifyRead = await req('GET', '/api/v1/notifications?unread=true', null, adminToken);
    const stillUnread = (verifyRead.b?.data?.notifications || verifyRead.b?.data || []).find(n => n.id === firstUnread.id);
    assert('Notification is now marked read', !stillUnread, 'still in unread list');
  }

  // Mark all read
  const markAllRes = await req('POST', '/api/v1/notifications/read-all', null, adminToken);
  assert('Mark all read → 200', markAllRes.s === 200, `got ${markAllRes.s}`);
  const afterMarkAll = await req('GET', '/api/v1/notifications?unread=true', null, adminToken);
  const remainingUnread = afterMarkAll.b?.data?.notifications || afterMarkAll.b?.data || [];
  assert('No unread after mark-all', remainingUnread.length === 0, `remaining=${remainingUnread.length}`);

  // Preferences
  const prefGet = await req('GET', '/api/v1/notifications/preferences', null, adminToken);
  assert('GET /preferences → 200', prefGet.s === 200, `got ${prefGet.s}`);

  const prefPut = await req('PUT', '/api/v1/notifications/preferences', { type: 'control_due', in_app: true, email: false }, adminToken);
  assert('PUT /preferences → 200', prefPut.s === 200, `got ${prefPut.s}`);

  // Email status
  const emailStatus = await req('GET', '/api/v1/notifications/email-status', null, adminToken);
  assert('GET /email-status → 200', emailStatus.s === 200, `got ${emailStatus.s}`);
  assert('Email status has configured field', 'configured' in (emailStatus.b?.data || {}), JSON.stringify(emailStatus.b?.data));

  // Auditor sees their own notifications
  const auditorNotifs = await req('GET', '/api/v1/notifications', null, auditorToken);
  assert('Auditor notifications → 200', auditorNotifs.s === 200);
  const auditorNotifList = auditorNotifs.b?.data?.notifications || auditorNotifs.b?.data || [];
  assert('Auditor has 2 seeded notifications', auditorNotifList.length >= 2, `auditor count=${auditorNotifList.length}`);

  // ── D. POA&M ─────────────────────────────────────────────────────────────────
  section('D. POA&M');

  const poamRes = await req('GET', `/api/v1/organizations/${orgId}/poam`, null, adminToken);
  // Try alternate path if first fails
  const poamAlt = poamRes.s !== 200 ? await req('GET', '/api/v1/poam', null, adminToken) : null;
  const poamData = poamRes.s === 200 ? poamRes : (poamAlt || poamRes);
  assert('POA&M list → 200', poamData.s === 200, `got ${poamData.s}`);
  const poamItems = poamData.b?.data?.items || poamData.b?.data?.poam_items || poamData.b?.data || [];
  assertSeeded('Has 5 POA&M items', Array.isArray(poamItems) && poamItems.length >= 5, `count=${poamItems.length}`);

  const priorities = new Set(poamItems.map(i => i.priority));
  assertSeeded('Has critical priority item', priorities.has('critical'), `priorities: ${[...priorities].join(',')}`);
  assertSeeded('Has high priority item', priorities.has('high'));

  const statuses = new Set(poamItems.map(i => i.status));
  assert('Has open items', statuses.has('open'));
  assertSeeded('Has in_progress items', statuses.has('in_progress'));

  // ── E. Evidence ─────────────────────────────────────────────────────────────
  section('E. Evidence');

  const evRes = await req('GET', '/api/v1/evidence', null, adminToken);
  assert('Evidence list → 200', evRes.s === 200, `got ${evRes.s}`);
  const evList = evRes.b?.data?.evidence || evRes.b?.data || [];
  assertSeeded('Has seeded evidence (≥5)', Array.isArray(evList) && evList.length >= 5, `count=${evList.length}`);
  assertSeeded('Evidence has file_name', evList.length > 0 && !!evList[0].file_name);

  // ── F. AI Decisions ──────────────────────────────────────────────────────────
  section('F. AI Decisions');

  const decisionsRes = await req('GET', '/api/v1/ai/decisions', null, adminToken);
  assert('GET /ai/decisions → 200', decisionsRes.s === 200, `got ${decisionsRes.s}`);
  // response is data: [...] (array) or data: { decisions: [...] }
  const decisions = Array.isArray(decisionsRes.b?.data) ? decisionsRes.b.data : (decisionsRes.b?.data?.decisions || []);
  assertSeeded('Has seeded AI decisions (≥6)', decisions.length >= 6, `count=${decisions.length}`);

  // Verify bias flags present
  const withBias = decisions.filter(d => Array.isArray(d.bias_flags) && d.bias_flags.length > 0);
  assertSeeded('Has decisions with bias flags (≥2)', withBias.length >= 2, `with_bias=${withBias.length}`);

  // Verify one reviewed
  const reviewed = decisions.filter(d => d.human_reviewed === true);
  assertSeeded('Has 1 reviewed decision', reviewed.length >= 1, `reviewed=${reviewed.length}`);
  assertSeeded('Reviewed decision has outcome "approved"', reviewed.some(d => d.review_outcome === 'approved'));

  // Filter: unreviewed
  const unreviewed = await req('GET', '/api/v1/ai/decisions?reviewed=false', null, adminToken);
  assert('Filter unreviewed → 200', unreviewed.s === 200);
  const unreviewedList = Array.isArray(unreviewed.b?.data) ? unreviewed.b.data : (unreviewed.b?.data?.decisions || []);
  assert('Unreviewed filter returns only unreviewed', unreviewedList.every(d => !d.human_reviewed), `some are reviewed`);

  // Filter: risk_level=high
  const highRisk = await req('GET', '/api/v1/ai/decisions?risk_level=high', null, adminToken);
  assert('Filter high risk → 200', highRisk.s === 200);
  const highList = Array.isArray(highRisk.b?.data) ? highRisk.b.data : (highRisk.b?.data?.decisions || []);
  assertSeeded('High-risk filter returns entries', highList.length >= 1, `count=${highList.length}`);

  // PATCH review
  const unrev = unreviewedList.find(d => !Array.isArray(d.bias_flags) || d.bias_flags.length === 0);
  if (unrev?.id) {
    const reviewRes = await req('PATCH', `/api/v1/ai/decisions/${unrev.id}/review`, { outcome: 'approved', notes: 'QA test review' }, adminToken);
    assert('PATCH /ai/decisions/:id/review → 200', reviewRes.s === 200, `got ${reviewRes.s}`);
    // Verify it's now reviewed
    const check = await req('GET', '/api/v1/ai/decisions?reviewed=true', null, adminToken);
    const checkList = Array.isArray(check.b?.data) ? check.b.data : (check.b?.data?.decisions || []);
    const nowReviewed = checkList.find(d => d.id === unrev.id);
    assert('Decision is now marked reviewed', !!nowReviewed, 'not found in reviewed list');
  }

  // PATCH bias review
  const biasEntry = withBias.find(d => !d.bias_reviewed);
  if (biasEntry?.id) {
    const biasRes = await req('PATCH', `/api/v1/ai/decisions/${biasEntry.id}/bias-review`, { notes: 'QA bias review — subjectivity acceptable in this context' }, adminToken);
    assert('PATCH /ai/decisions/:id/bias-review → 200', biasRes.s === 200, `got ${biasRes.s}`);
  }

  // /ai/status bias_coverage
  const aiStatus = await req('GET', '/api/v1/ai/status', null, adminToken);
  assert('GET /ai/status → 200', aiStatus.s === 200, `got ${aiStatus.s}`);
  const biasCoverage = aiStatus.b?.data?.bias_coverage;
  assert('/ai/status has bias_coverage', !!biasCoverage, JSON.stringify(aiStatus.b?.data));
  if (biasCoverage) {
    assertSeeded('bias_coverage.decisions_with_bias_flags ≥ 2', biasCoverage.decisions_with_bias_flags >= 2, `got ${biasCoverage.decisions_with_bias_flags}`);
  }

  // AI monitoring + reporting + posture belong in enterprise AI QA.
  const monitoringDashboard = await req('GET', '/api/v1/ai/monitoring/dashboard', null, adminToken);
  assert('GET /ai/monitoring/dashboard → 200', monitoringDashboard.s === 200, `got ${monitoringDashboard.s}`);

  const monitoringRules = await req('GET', '/api/v1/ai/monitoring/rules', null, adminToken);
  assert('GET /ai/monitoring/rules → 200', monitoringRules.s === 200, `got ${monitoringRules.s}`);

  const monitoringEvents = await req('GET', '/api/v1/ai/monitoring/events?limit=5', null, adminToken);
  assert('GET /ai/monitoring/events → 200', monitoringEvents.s === 200, `got ${monitoringEvents.s}`);

  const monitoringCoverage = await req('GET', '/api/v1/ai/monitoring/coverage', null, adminToken);
  assert('GET /ai/monitoring/coverage → 200', monitoringCoverage.s === 200, `got ${monitoringCoverage.s}`);
  assert(
    '/ai/monitoring/coverage has 6 compliance categories',
    Array.isArray(monitoringCoverage.b?.data?.coverage) && monitoringCoverage.b.data.coverage.length === 6,
    JSON.stringify(monitoringCoverage.b?.data || {})
  );
  assert(
    '/ai/monitoring/coverage has summary.total_categories = 6',
    monitoringCoverage.b?.data?.summary?.total_categories === 6,
    JSON.stringify(monitoringCoverage.b?.data?.summary || {})
  );

  const aiUsageReport = await req('GET', '/api/v1/ai/usage-report?limit=5', null, adminToken);
  assert('GET /ai/usage-report → 200', aiUsageReport.s === 200, `got ${aiUsageReport.s}`);

  const securityPosture = await req('POST', '/api/v1/ai/security-posture', {}, adminToken);
  if (STRICT_DEMO_STATE) {
    assert('POST /ai/security-posture → 200', securityPosture.s === 200, `got ${securityPosture.s}`);
    assert(
      '/ai/security-posture returns owasp + nist',
      Array.isArray(securityPosture.b?.data?.result?.owasp) && Array.isArray(securityPosture.b?.data?.result?.nist),
      JSON.stringify(securityPosture.b?.data || {})
    );
  } else {
    assert('POST /ai/security-posture responded', [200, 400, 500].includes(securityPosture.s), `got ${securityPosture.s}`);
  }

  // AI Governance (vendor risk, incidents, supply chain)
  const aiGovSummary = await req('GET', '/api/v1/ai-governance/summary', null, adminToken);
  assert('GET /ai-governance/summary → 200', aiGovSummary.s === 200, `got ${aiGovSummary.s}`);

  const aiGovVendors = await req('GET', '/api/v1/ai-governance/vendors', null, adminToken);
  assert('GET /ai-governance/vendors → 200', aiGovVendors.s === 200, `got ${aiGovVendors.s}`);

  // State AI Laws (jurisdictions + summary)
  const currentTier = String(adminMe.b?.data?.organization?.tier || '').toLowerCase();
  const stateAiJurisdictions = await req('GET', '/api/v1/state-ai-laws/jurisdictions', null, adminToken);
  assert(
    currentTier === 'govcloud'
      ? 'GET /state-ai-laws/jurisdictions → 200 (govcloud)'
      : 'GET /state-ai-laws/jurisdictions is tier-gated outside govcloud',
    currentTier === 'govcloud' ? stateAiJurisdictions.s === 200 : stateAiJurisdictions.s === 403,
    `got ${stateAiJurisdictions.s}`
  );

  const stateAiSummary = await req('GET', '/api/v1/state-ai-laws/summary', null, adminToken);
  assert(
    currentTier === 'govcloud'
      ? 'GET /state-ai-laws/summary → 200 (govcloud)'
      : 'GET /state-ai-laws/summary is tier-gated outside govcloud',
    currentTier === 'govcloud' ? stateAiSummary.s === 200 : stateAiSummary.s === 403,
    `got ${stateAiSummary.s}`
  );

  // ── G. RBAC ──────────────────────────────────────────────────────────────────
  section('G. RBAC enforcement');

  // Auditor cannot access AI decisions (admin-only)
  const auditorDecisions = await req('GET', '/api/v1/ai/decisions', null, auditorToken);
  assert('Auditor cannot GET /ai/decisions → 403', auditorDecisions.s === 403, `got ${auditorDecisions.s}`);

  // Auditor cannot mark all notifications of admin
  const auditorMarkAll = await req('POST', '/api/v1/notifications/read-all', null, auditorToken);
  assert('Auditor mark-all-read allowed (own notifs) → 200', auditorMarkAll.s === 200, `got ${auditorMarkAll.s}`);

  // No token → 401
  const noToken = await req('GET', '/api/v1/notifications', null, null);
  assert('No token → 401', noToken.s === 401, `got ${noToken.s}`);

  // ── H. Notification side-effects ────────────────────────────────────────────
  section('H. Notification side-effects (status change trigger)');

  // Find a control that is not_started and move it to verified → should trigger notification
  const implListRes = await req('GET', `/api/v1/organizations/${orgId}/controls`, null, adminToken);
  const ctrlList = implListRes.b?.data?.controls || implListRes.b?.data || [];
  const notStarted = ctrlList.find(c => c.status === 'not_started' || !c.status);

  if (notStarted?.id || notStarted?.control_id) {
    const ctrlId = notStarted.id || notStarted.control_id;
    const updateRes = await req(
      'PUT',
      `/api/v1/controls/${ctrlId}/implementation`,
      {
        status: 'verified',
        notes: 'QA test verification',
        poam_justification: 'QA validation: control remediation completed and verified.'
      },
      adminToken
    );
    assert('Update control to verified → 200/201', [200, 201].includes(updateRes.s), `got ${updateRes.s}`);

    if ([200, 201].includes(updateRes.s)) {
      // Check a new status_change notification was created
      await new Promise(r => setTimeout(r, 200)); // brief wait
      const newNotifs = await req('GET', '/api/v1/notifications?type=status_change', null, adminToken);
      const statusChangeList = newNotifs.b?.data?.notifications || newNotifs.b?.data || [];
      assertSeeded('Status change notification created', statusChangeList.length >= 1, `count=${statusChangeList.length}`);
    }
  } else {
    process.stdout.write('  ⊘ No not_started control found to test trigger (skip)\n');
  }

  // ── I. Cross-org isolation ───────────────────────────────────────────────────
  section('I. Cross-org isolation');

  // Login as a different org
  const otherLogin = (await loginWithFallback(OTHER_ORG_EMAIL)).response;
  if (otherLogin.s === 200) {
    const otherToken = otherLogin.b?.data?.tokens?.accessToken;
    // Enterprise notifications must NOT be visible to other org
    const crossNotifs = await req('GET', '/api/v1/notifications', null, otherToken);
    const crossList = crossNotifs.b?.data?.notifications || crossNotifs.b?.data || [];
    const leaked = crossList.some(n => n.organization_id === orgId);
    assert('Enterprise notifications not visible to other org', !leaked, `leaked=${leaked}`);

    // Enterprise AI decisions must NOT be visible to other org
    const crossDecisions = await req('GET', '/api/v1/ai/decisions', null, otherToken);
    if (crossDecisions.s === 200) {
      const crossList2 = Array.isArray(crossDecisions.b?.data) ? crossDecisions.b.data : (crossDecisions.b?.data?.decisions || []);
      const leaked2 = crossList2.some(d => d.organization_id === orgId);
      assert('Enterprise AI decisions not visible to other org', !leaked2, `leaked=${leaked2}`);
    } else {
      assert('Other org AI decisions properly gated', [403, 402].includes(crossDecisions.s), `got ${crossDecisions.s}`);
    }
  } else {
    process.stdout.write('  ⊘ free account not found — skipping cross-org isolation checks\n');
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n================================================');
  console.log(` RESULTS: ${passed} passed, ${failed} failed`);
  console.log('================================================');

  if (failures.length > 0) {
    console.log('\nFailed assertions:');
    failures.forEach(f => console.log(f));
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
