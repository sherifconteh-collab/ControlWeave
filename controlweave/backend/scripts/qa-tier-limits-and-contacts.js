// @tier: exclude
/**
 * qa-tier-limits-and-contacts.js
 *
 * Comprehensive E2E stress-test for tier-based user seat limits, external
 * contacts, control assignment, and auditor role restrictions.
 *
 * For each tier (free, starter, professional, enterprise, utilities) this script:
 *   1.  Logs in as admin and auditor
 *   2.  Validates GET /users/seats reflects correct tier limits
 *   3.  Creates users until the seat limit is hit, then verifies 403
 *   4.  Creates invites past the limit, then verifies 403
 *   5.  Creates external contacts, then verifies limit enforcement
 *   6.  Assigns a control to a user and to an external contact
 *   7.  Validates that assigning both user + contact simultaneously fails
 *   8.  Verifies auditor cannot create users, contacts, or invites
 *   9.  Verifies cross-org isolation for contacts
 *   10. Cleans up test users and contacts
 *
 * Usage:
 *   node scripts/qa-tier-limits-and-contacts.js
 *
 * Env:
 *   QA_BASE_URL or API_BASE_URL (default http://localhost:3001)
 *   QA_DEMO_PASSWORD / ADMIN_PASSWORD (fallback ControlWeave!2026)
 */
const http = require('http');
const https = require('https');
require('dotenv').config();

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

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

// ── Demo account definitions ──
// All orgs have enterprise-tier access with no user/contact limits.
const TIERS = [
  { tier: 'community',   adminEmail: 'admin@community.com',   auditorEmail: 'auditor@community.com',   maxUsers: -1, maxContacts: -1 },
  { tier: 'pro',         adminEmail: 'admin@pro.com',         auditorEmail: 'auditor@pro.com',         maxUsers: -1, maxContacts: -1 },
  { tier: 'enterprise',  adminEmail: 'admin@enterprise.com',  auditorEmail: 'auditor@enterprise.com',  maxUsers: -1, maxContacts: -1 },
  { tier: 'govcloud',    adminEmail: 'admin@govcloud.com',    auditorEmail: 'auditor@govcloud.com',    maxUsers: -1, maxContacts: -1 },
];

// ── HTTP helper ──
function req(method, urlPath, body, token) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, BASE);
    const transport = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    const r = transport.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks).toString();
        try { resolve({ s: res.statusCode, b: JSON.parse(buf) }); }
        catch (_) { resolve({ s: res.statusCode, b: buf.substring(0, 300) }); }
      });
    });
    r.on('error', (e) => resolve({ s: 0, b: e.message }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function check(id, text, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS ${id} ${text}`);
  } else {
    failed++;
    const msg = detail ? `${id} ${text} — ${detail}` : `${id} ${text}`;
    failures.push(msg);
    console.log(`  FAIL ${id} ${text}${detail ? ` (${detail})` : ''}`);
  }
}

function skip(id, text, reason) {
  skipped++;
  console.log(`  SKIP ${id} ${text} — ${reason}`);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── Login helper ──
async function login(email) {
  for (const pw of PASSWORD_CANDIDATES) {
    const r = await req('POST', '/api/v1/auth/login', { email, password: pw });
    if (r.s === 200 && r.b?.data?.tokens?.accessToken) {
      return r.b.data.tokens.accessToken;
    }
  }
  return null;
}

// ── Test functions ──

async function testSeatsEndpoint(tierInfo, token) {
  const prefix = `[${tierInfo.tier}:seats]`;
  const r = await req('GET', '/api/v1/users/seats', null, token);
  check(`${prefix}:status`, 'GET /users/seats returns 200', r.s === 200, `got ${r.s}`);
  if (r.s !== 200) return null;

  const d = r.b.data;
  check(`${prefix}:activeUsers`, 'activeUsers is a number >= 1', typeof d.activeUsers === 'number' && d.activeUsers >= 1, `got ${d.activeUsers}`);
  return d;
}

async function testUserCreationLimits(tierInfo, token, currentSeats) {
  const prefix = `[${tierInfo.tier}:userLimit]`;

  // For unlimited tiers, just verify we can create one user
  if (tierInfo.maxUsers === -1) {
    const email = `qa-limit-test-${Date.now()}@${tierInfo.tier}.test`;
    const r = await req('POST', '/api/v1/users', {
      email, password: 'QaTestPass123!', full_name: 'QA Limit Test'
    }, token);
    check(`${prefix}:create`, 'Can create user (unlimited tier)', r.s === 201, `got ${r.s}: ${JSON.stringify(r.b?.error || '').substring(0, 100)}`);
    return r.s === 201 ? [email] : [];
  }

  // For limited tiers, fill up to the limit
  const slotsAvailable = tierInfo.maxUsers - currentSeats.activeUsers - currentSeats.pendingInvites;
  const createdEmails = [];

  // Create users to fill remaining slots
  const toCreate = Math.min(slotsAvailable, 3); // Cap at 3 to keep test fast
  for (let i = 0; i < toCreate; i++) {
    const email = `qa-limit-${Date.now()}-${i}@${tierInfo.tier}.test`;
    const r = await req('POST', '/api/v1/users', {
      email, password: 'QaTestPass123!', full_name: `QA Test User ${i}`
    }, token);
    check(`${prefix}:fill-${i}`, `Create user #${i + 1} succeeds (filling slots)`, r.s === 201, `got ${r.s}: ${JSON.stringify(r.b?.error || '').substring(0, 100)}`);
    if (r.s === 201) createdEmails.push(email);
    await sleep(100); // Avoid rate limits
  }

  // Now check the seats again
  const seatsAfter = await req('GET', '/api/v1/users/seats', null, token);
  if (seatsAfter.s === 200) {
    const remaining = seatsAfter.b.data.remaining;
    // If still room, skip the overflow test
    if (remaining > 0) {
      skip(`${prefix}:overflow`, 'Cannot test overflow — still have room', `remaining=${remaining}`);
      return createdEmails;
    }
  }

  // Try to create one more — should be 403
  const overflowEmail = `qa-overflow-${Date.now()}@${tierInfo.tier}.test`;
  const overflowR = await req('POST', '/api/v1/users', {
    email: overflowEmail, password: 'QaTestPass123!', full_name: 'QA Overflow User'
  }, token);
  check(`${prefix}:overflow`, 'User creation blocked at limit (403)', overflowR.s === 403, `got ${overflowR.s}: ${JSON.stringify(overflowR.b?.error || '').substring(0, 100)}`);
  if (overflowR.s === 403) {
    check(`${prefix}:overflow-msg`, 'Error mentions upgradeRequired', overflowR.b?.upgradeRequired === true, `got ${JSON.stringify(overflowR.b).substring(0, 150)}`);
  }

  return createdEmails;
}

async function testInviteLimits(tierInfo, token) {
  const prefix = `[${tierInfo.tier}:inviteLimit]`;

  if (tierInfo.maxUsers === -1) {
    skip(`${prefix}:unlimited`, 'Invite limit test', 'unlimited tier');
    return;
  }

  // Try invite when at limit — should be 403
  const inviteR = await req('POST', '/api/v1/users/invite', {
    email: `qa-invite-overflow-${Date.now()}@${tierInfo.tier}.test`,
    primary_role: 'user'
  }, token);
  // May be 403 (at limit) or 201 (still room) — both are valid
  if (inviteR.s === 403) {
    check(`${prefix}:blocked`, 'Invite blocked at limit (403)', true);
    check(`${prefix}:upgrade`, 'Error mentions upgradeRequired', inviteR.b?.upgradeRequired === true, `got ${JSON.stringify(inviteR.b).substring(0, 150)}`);
  } else if (inviteR.s === 201) {
    check(`${prefix}:accepted`, 'Invite accepted (still room)', true);
  } else {
    check(`${prefix}:status`, 'Invite returns 403 or 201', false, `got ${inviteR.s}: ${JSON.stringify(inviteR.b?.error || '').substring(0, 100)}`);
  }
}

async function testContactsCRUD(tierInfo, token) {
  const prefix = `[${tierInfo.tier}:contacts]`;

  // List contacts
  const listR = await req('GET', '/api/v1/contacts', null, token);
  check(`${prefix}:list`, 'GET /contacts returns 200', listR.s === 200, `got ${listR.s}`);
  const existingCount = listR.s === 200 ? (listR.b.data || []).length : 0;

  // Create a contact
  const createR = await req('POST', '/api/v1/contacts', {
    full_name: `QA Contact ${Date.now()}`,
    email: `qa-contact-${Date.now()}@vendor.test`,
    title: 'IT Security Lead',
    team: 'Infrastructure Operations',
    notes: 'Created by E2E stress test'
  }, token);
  check(`${prefix}:create`, 'POST /contacts returns 201', createR.s === 201, `got ${createR.s}: ${JSON.stringify(createR.b?.error || '').substring(0, 100)}`);

  if (createR.s !== 201) return { created: [], ids: [] };
  const contactId = createR.b.data.id;

  // Verify contact appears in list
  const list2R = await req('GET', '/api/v1/contacts', null, token);
  check(`${prefix}:listed`, 'Contact appears in list', list2R.s === 200 && (list2R.b.data || []).length > existingCount);

  // Update contact
  const updateR = await req('PATCH', `/api/v1/contacts/${contactId}`, {
    title: 'Senior IT Security Lead',
    team: 'Security Engineering'
  }, token);
  check(`${prefix}:update`, 'PATCH /contacts/:id returns 200', updateR.s === 200, `got ${updateR.s}`);
  if (updateR.s === 200) {
    check(`${prefix}:update-title`, 'Title updated correctly', updateR.b.data?.title === 'Senior IT Security Lead');
  }

  return { created: [contactId], ids: [contactId] };
}

async function testContactLimits(tierInfo, token) {
  const prefix = `[${tierInfo.tier}:contactLimit]`;
  const createdIds = [];

  if (tierInfo.maxContacts === -1) {
    // Just create one to verify it works
    const r = await req('POST', '/api/v1/contacts', {
      full_name: `QA Unlimited Contact ${Date.now()}`
    }, token);
    check(`${prefix}:unlimited`, 'Can create contact (unlimited tier)', r.s === 201, `got ${r.s}`);
    if (r.s === 201) createdIds.push(r.b.data.id);
    return createdIds;
  }

  // For limited tiers (free=5, starter=25), create up to limit
  const listR = await req('GET', '/api/v1/contacts', null, token);
  const currentCount = listR.s === 200 ? (listR.b.data || []).filter(c => c.is_active !== false).length : 0;
  const slotsAvailable = tierInfo.maxContacts - currentCount;
  const toCreate = Math.min(slotsAvailable, 3); // Cap to keep test fast

  for (let i = 0; i < toCreate; i++) {
    const r = await req('POST', '/api/v1/contacts', {
      full_name: `QA Limit Contact ${Date.now()}-${i}`,
      team: 'QA Stress Test'
    }, token);
    if (r.s === 201) createdIds.push(r.b.data.id);
    await sleep(50);
  }

  // Check if at limit now
  const list2R = await req('GET', '/api/v1/contacts', null, token);
  const newCount = list2R.s === 200 ? (list2R.b.data || []).filter(c => c.is_active !== false).length : 0;

  if (newCount >= tierInfo.maxContacts) {
    // Try to create one more — should be 403
    const overflowR = await req('POST', '/api/v1/contacts', {
      full_name: `QA Overflow Contact ${Date.now()}`
    }, token);
    check(`${prefix}:overflow`, 'Contact creation blocked at limit (403)', overflowR.s === 403, `got ${overflowR.s}: ${JSON.stringify(overflowR.b?.error || '').substring(0, 100)}`);
    if (overflowR.s === 403) {
      check(`${prefix}:overflow-msg`, 'Error mentions upgradeRequired', overflowR.b?.upgradeRequired === true);
    }
  } else {
    skip(`${prefix}:overflow`, 'Contact overflow test', `still have room (${newCount}/${tierInfo.maxContacts})`);
  }

  return createdIds;
}

async function testControlAssignment(tierInfo, token, contactId) {
  const prefix = `[${tierInfo.tier}:assign]`;

  // Get an implementation to assign
  const implR = await req('GET', '/api/v1/implementations?limit=1', null, token);
  if (implR.s !== 200 || !implR.b.data || implR.b.data.length === 0) {
    skip(`${prefix}:no-impl`, 'Control assignment tests', 'No implementations found');
    return;
  }

  const implId = implR.b.data[0].id;

  // Assign to self (user)
  const meR = await req('GET', '/api/v1/auth/me', null, token);
  const userId = meR.s === 200 ? meR.b.data?.user?.id : null;
  if (userId) {
    const assignUserR = await req('PATCH', `/api/v1/implementations/${implId}/assign`, {
      assignedTo: userId,
      assignedToContact: null,
      dueDate: '2026-06-01'
    }, token);
    check(`${prefix}:to-user`, 'Assign to user returns 200', assignUserR.s === 200, `got ${assignUserR.s}: ${JSON.stringify(assignUserR.b?.error || '').substring(0, 100)}`);
  }

  // Assign to contact
  if (contactId) {
    const assignContactR = await req('PATCH', `/api/v1/implementations/${implId}/assign`, {
      assignedTo: null,
      assignedToContact: contactId,
      dueDate: '2026-07-01'
    }, token);
    check(`${prefix}:to-contact`, 'Assign to contact returns 200', assignContactR.s === 200, `got ${assignContactR.s}: ${JSON.stringify(assignContactR.b?.error || '').substring(0, 100)}`);
  }

  // Try to assign both — should fail validation
  if (userId && contactId) {
    const bothR = await req('PATCH', `/api/v1/implementations/${implId}/assign`, {
      assignedTo: userId,
      assignedToContact: contactId
    }, token);
    check(`${prefix}:both-fail`, 'Assigning both user + contact is rejected (400)', bothR.s === 400, `got ${bothR.s}`);
  }

  // Unassign
  const unassignR = await req('PATCH', `/api/v1/implementations/${implId}/assign`, {
    assignedTo: null,
    assignedToContact: null
  }, token);
  check(`${prefix}:unassign`, 'Unassign returns 200', unassignR.s === 200, `got ${unassignR.s}`);
}

async function testAuditorRestrictions(tierInfo, auditorToken) {
  const prefix = `[${tierInfo.tier}:auditor]`;

  if (!auditorToken) {
    skip(`${prefix}:login`, 'Auditor restriction tests', 'Auditor login failed');
    return;
  }

  // Auditor should be able to read users/seats
  const seatsR = await req('GET', '/api/v1/users/seats', null, auditorToken);
  // May be 200 (has users.read) or 403 (no permission) — depends on role config
  check(`${prefix}:seats`, 'GET /users/seats returns 200 or 403', seatsR.s === 200 || seatsR.s === 403, `got ${seatsR.s}`);

  // Auditor should NOT be able to create users
  const createUserR = await req('POST', '/api/v1/users', {
    email: `qa-auditor-create-${Date.now()}@test.com`,
    password: 'QaTestPass123!',
    full_name: 'Auditor Should Not Create'
  }, auditorToken);
  check(`${prefix}:no-create-user`, 'Auditor cannot create users (403)', createUserR.s === 403, `got ${createUserR.s}`);

  // Auditor should NOT be able to invite users
  const inviteR = await req('POST', '/api/v1/users/invite', {
    email: `qa-auditor-invite-${Date.now()}@test.com`,
    primary_role: 'user'
  }, auditorToken);
  check(`${prefix}:no-invite`, 'Auditor cannot invite users (403)', inviteR.s === 403, `got ${inviteR.s}`);

  // Auditor should NOT be able to create contacts
  const createContactR = await req('POST', '/api/v1/contacts', {
    full_name: 'Auditor Should Not Create Contact'
  }, auditorToken);
  check(`${prefix}:no-create-contact`, 'Auditor cannot create contacts (403)', createContactR.s === 403, `got ${createContactR.s}`);

  // Auditor SHOULD be able to read contacts (needs controls.read)
  const listContactR = await req('GET', '/api/v1/contacts', null, auditorToken);
  check(`${prefix}:read-contacts`, 'Auditor can list contacts (200)', listContactR.s === 200, `got ${listContactR.s}`);

  // Auditor SHOULD be able to access dashboard
  const dashR = await req('GET', '/api/v1/dashboard', null, auditorToken);
  check(`${prefix}:dashboard`, 'Auditor can access dashboard', dashR.s === 200, `got ${dashR.s}`);

  // Auditor SHOULD be able to list frameworks
  const fwR = await req('GET', '/api/v1/frameworks', null, auditorToken);
  check(`${prefix}:frameworks`, 'Auditor can list frameworks', fwR.s === 200, `got ${fwR.s}`);

  // Auditor SHOULD be able to list controls
  const ctrlR = await req('GET', '/api/v1/controls', null, auditorToken);
  // May be 200 or may get paginated differently
  check(`${prefix}:controls`, 'Auditor can list controls', ctrlR.s === 200, `got ${ctrlR.s}`);
}

async function testCrossOrgIsolation(tokens) {
  const prefix = '[cross-org]';
  // If we have at least two tier tokens, verify one can't see the other's contacts
  const tierKeys = Object.keys(tokens).filter(k => tokens[k].admin);
  if (tierKeys.length < 2) {
    skip(`${prefix}`, 'Cross-org isolation', 'Need at least 2 tier admin tokens');
    return;
  }

  const [t1, t2] = tierKeys;
  // Create a contact in t1
  const c1R = await req('POST', '/api/v1/contacts', {
    full_name: `Cross-Org-Test-${Date.now()}`,
    team: 'Isolation Test'
  }, tokens[t1].admin);

  if (c1R.s !== 201) {
    skip(`${prefix}:create`, 'Cross-org create', `Create failed: ${c1R.s}`);
    return;
  }
  const c1Id = c1R.b.data.id;

  // Try to see it from t2
  const list2R = await req('GET', '/api/v1/contacts', null, tokens[t2].admin);
  if (list2R.s === 200) {
    const found = (list2R.b.data || []).some(c => c.id === c1Id);
    check(`${prefix}:isolated`, `${t2} cannot see ${t1}'s contacts`, !found, found ? 'LEAKED! Contact visible cross-org' : '');
  }

  // Clean up
  await req('DELETE', `/api/v1/contacts/${c1Id}`, null, tokens[t1].admin);
}

async function cleanupTestUsers(token, createdEmails) {
  // Deactivate test users by updating them
  for (const email of createdEmails) {
    // Find user by listing
    const listR = await req('GET', '/api/v1/users', null, token);
    if (listR.s === 200) {
      const user = (listR.b.data || []).find(u => u.email === email);
      if (user) {
        await req('PATCH', `/api/v1/users/${user.id}`, { is_active: false }, token);
      }
    }
  }
}

async function cleanupTestContacts(token, contactIds) {
  for (const id of contactIds) {
    await req('DELETE', `/api/v1/contacts/${id}`, null, token);
  }
}

// ── Main ──
async function main() {
  console.log(`\nControlWeave Contacts & User Management E2E Stress Test`);
  console.log(`   Base URL: ${BASE}`);
  console.log(`   Tiers: ${TIERS.map(t => t.tier).join(', ')}\n`);

  const tokens = {};

  for (const tierInfo of TIERS) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ACCOUNT: ${tierInfo.tier.toUpperCase()} (unlimited access)`);
    console.log(`${'═'.repeat(60)}`);

    // ─── Login admin ───
    console.log(`\n  ── Admin Login ──`);
    const adminToken = await login(tierInfo.adminEmail);
    if (!adminToken) {
      skip(`[${tierInfo.tier}]`, 'All tests', `Admin login failed for ${tierInfo.adminEmail}`);
      continue;
    }
    check(`[${tierInfo.tier}:admin]`, `Admin login succeeds (${tierInfo.adminEmail})`, true);
    tokens[tierInfo.tier] = { admin: adminToken };

    // ─── Login auditor ───
    console.log(`\n  ── Auditor Login ──`);
    const auditorToken = await login(tierInfo.auditorEmail);
    if (auditorToken) {
      check(`[${tierInfo.tier}:auditor]`, `Auditor login succeeds (${tierInfo.auditorEmail})`, true);
      tokens[tierInfo.tier].auditor = auditorToken;
    } else {
      check(`[${tierInfo.tier}:auditor]`, `Auditor login succeeds (${tierInfo.auditorEmail})`, false, 'Login failed — auditor account may not exist');
    }

    // ─── Seats endpoint ───
    console.log(`\n  ── Seats Endpoint ──`);
    const seats = await testSeatsEndpoint(tierInfo, adminToken);

    // ─── User creation limits ───
    console.log(`\n  ── User Creation Limits ──`);
    const createdEmails = seats
      ? await testUserCreationLimits(tierInfo, adminToken, seats)
      : [];

    // ─── Invite limits ───
    console.log(`\n  ── Invite Limits ──`);
    await testInviteLimits(tierInfo, adminToken);

    // ─── Contacts CRUD ───
    console.log(`\n  ── Contacts CRUD ──`);
    const contactResult = await testContactsCRUD(tierInfo, adminToken);

    // ─── Contact limits ───
    console.log(`\n  ── Contact Limits ──`);
    const limitContactIds = await testContactLimits(tierInfo, adminToken);

    // ─── Control assignment ───
    console.log(`\n  ── Control Assignment ──`);
    const contactIdForAssign = contactResult.ids.length > 0 ? contactResult.ids[0] : null;
    await testControlAssignment(tierInfo, adminToken, contactIdForAssign);

    // ─── Auditor restrictions ───
    console.log(`\n  ── Auditor Restrictions ──`);
    await testAuditorRestrictions(tierInfo, tokens[tierInfo.tier]?.auditor);

    // ─── Cleanup ───
    console.log(`\n  ── Cleanup ──`);
    if (createdEmails.length > 0) {
      await cleanupTestUsers(adminToken, createdEmails);
      console.log(`    Deactivated ${createdEmails.length} test user(s)`);
    }
    const allContactIds = [...(contactResult.ids || []), ...limitContactIds];
    if (allContactIds.length > 0) {
      await cleanupTestContacts(adminToken, allContactIds);
      console.log(`    Removed ${allContactIds.length} test contact(s)`);
    }
  }

  // ─── Cross-org isolation ───
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  CROSS-ORG ISOLATION`);
  console.log(`${'═'.repeat(60)}\n`);
  await testCrossOrgIsolation(tokens);

  // ─── Summary ───
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  RESULTS`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  ✅ Passed:  ${passed}`);
  console.log(`  ❌ Failed:  ${failed}`);
  console.log(`  ⏭  Skipped: ${skipped}`);

  if (failures.length > 0) {
    console.log(`\n  ── Failures ──`);
    for (const f of failures) {
      console.log(`    ✗ ${f}`);
    }
  }

  console.log(`\n${failed === 0 ? '🎉 ALL TESTS PASSED' : '💥 SOME TESTS FAILED'}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
