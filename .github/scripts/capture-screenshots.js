#!/usr/bin/env node

/**
 * Automated Screenshot Capture Script
 *
 * Uses Playwright to capture screenshots of UI pages for documentation.
 *
 * Modes:
 *   --all           Capture every screenshot referenced by GETTING_STARTED.md
 *                   (no feature-changes.json needed).
 *   (default)       Only capture screenshots for features listed in
 *                   feature-changes.json.
 *
 * Required env vars:
 *   DEMO_USERNAME   Login email   (e.g. admin@govcloud.com)
 *   DEMO_PASSWORD   Login password
 *
 * Optional env vars:
 *   DEMO_URL        Base URL (default: screenshotConfig.baseUrl from
 *                   feature-docs-map.json, typically http://localhost:3000)
 *
 * Process order (local dev):
 *   1. Start PostgreSQL
 *   2. Run migrations + seed script (e.g. seed-demo-tier-cmdb.js)
 *   3. Start backend   — node controlweave/backend/src/server.js
 *   4. Start frontend   — npx next dev  (inside controlweave/frontend)
 *   5. Run this script  — DEMO_USERNAME=… DEMO_PASSWORD=… node .github/scripts/capture-screenshots.js --all
 *
 * The backend MUST be running before the frontend starts and MUST stay alive
 * for the duration of the capture.  If you see ERR_CONNECTION_REFUSED on the
 * API port, the backend has likely exited — restart it in a persistent shell
 * (e.g. detached nohup, tmux, or a separate terminal).
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const allMode = process.argv.includes('--all');

// sha256 -> screenshot name, for every image actually written this run. Used to
// refuse a second file with identical bytes; see captureScreenshot.
const writtenHashes = new Map();

const mappingPath = path.join(__dirname, '..', 'feature-docs-map.json');
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
const { screenshotConfig } = mapping;

const BASE_URL = process.env.DEMO_URL || screenshotConfig.baseUrl;
const USERNAME = process.env.DEMO_USERNAME;
const PASSWORD = process.env.DEMO_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error('❌ DEMO_USERNAME and DEMO_PASSWORD environment variables are required.');
  process.exit(1);
}

const SCREENSHOTS_DIR = path.join(process.cwd(), 'controlweave', 'docs', 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// ── Feature-scoped routes (used in default / CI mode) ────────────────────────
const captureRoutes = {
  'authentication': [
    { path: '/register', name: 'register-form-01.png', description: 'Registration form', noAuth: true },
    { path: '/login', name: 'login-page-01.png', description: 'Login page', noAuth: true }
  ],
  'frameworks': [
    { path: '/dashboard/frameworks', name: 'frameworks-list-01.png', description: 'Frameworks list' },
    { path: '/dashboard/frameworks', name: 'frameworks-activate-button-01.png', description: 'Activate button', action: async (page) => {
      await page.evaluate(() => window.scrollBy(0, 200));
    }},
  ],
  'controls': [
    { path: '/dashboard/controls', name: 'controls-list-01.png', description: 'Controls list' },
    { path: '/dashboard/controls', name: 'control-detail-01.png', description: 'Control detail', action: async (page) => {
      const link = await page.$('a[href*="/dashboard/controls/"]');
      if (link) { await link.click(); await page.waitForTimeout(3000); }
    }},
    { path: null, name: 'control-status-dropdown-01.png', manual: 'chained after control-detail-01 with no action of its own', description: 'Control status dropdown' }
  ],
  'assessments': [
    { path: '/dashboard/assessments', name: 'assessments-list-01.png', description: 'Assessments list' },
    { path: '/dashboard/assessments', name: 'assessment-create-form-01.png', manual: 'same /dashboard/assessments view as the list, no action', description: 'Create assessment form' },
    { path: '/dashboard/assessments', name: 'assessment-conduct-01.png', description: 'Assessment conduct', action: async (page) => {
      await page.evaluate(() => window.scrollBy(0, 400));
    }},
    { path: '/dashboard/assessments', name: 'assessment-results-options-01.png', manual: 'same /dashboard/assessments view as the list, no action', description: 'Assessment results' }
  ],
  // The 'ai-copilot' group is deliberately empty. It used to declare
  // ai-copilot-button-01, ai-copilot-panel-open-01 and
  // ai-copilot-chat-interface-01, all of a floating "Ask AI" chat widget that
  // PR #664 established was never built. The button selector matched nothing,
  // so the action silently no-opped and every one of those entries saved a
  // plain /dashboard screenshot under a name promising a chat panel. No doc
  // references them and no such file is in the repo.
  'ai-copilot': [],
  'dashboard': [
    { path: '/dashboard', name: 'dashboard-overview-01.png', description: 'Dashboard overview', fullPage: true },
    { path: '/dashboard', name: 'dashboard-compliance-panel-01.png', manual: 'same /dashboard view as the overview, no action', description: 'Compliance panel' },
    { path: '/dashboard', name: 'dashboard-first-login-01.png', manual: 'same /dashboard view as the overview, no action', description: 'Dashboard first login' },
    { path: '/dashboard', name: 'dashboard-framework-progress-01.png', description: 'Framework progress', action: async (page) => {
      await page.evaluate(() => window.scrollBy(0, 800));
    }},
    { path: '/dashboard', name: 'dashboard-priority-actions-01.png', description: 'Priority actions', action: async (page) => {
      await page.evaluate(() => window.scrollBy(0, 1200));
    }},
    { path: '/dashboard', name: 'dashboard-recent-activity-01.png', description: 'Recent activity', action: async (page) => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    }}
  ],
  'settings': [
    { path: '/dashboard/settings', name: 'settings-menu-01.png', description: 'Settings menu' },
    { path: '/dashboard/settings', name: 'settings-llm-config-01.png', description: 'LLM configuration', action: async (page) => {
      const tab = await page.$('button:has-text("LLM"), [role="tab"]:has-text("LLM")');
      if (tab) { await tab.click(); await page.waitForTimeout(1500); }
    }},
    { path: '/dashboard/settings', name: 'settings-users-list-01.png', description: 'Users list', action: async (page) => {
      const tab = await page.$('button:has-text("User"), [role="tab"]:has-text("User")');
      if (tab) { await tab.click(); await page.waitForTimeout(1500); }
    }},
    { path: null, name: 'users-invite-form-01.png', manual: 'chained after settings-users-list-01 with no action of its own', description: 'Users invite form' },
    { path: null, name: 'users-role-selection-01.png', manual: 'chained after users-invite-form-01 with no action of its own', description: 'Users role selection' }
  ],
  'evidence': [
    { path: '/dashboard/evidence', name: 'evidence-upload-form-01.png', description: 'Evidence upload form' },
  ],
  'organization': [
    { path: '/dashboard/organization', name: 'organization-settings-01.png', description: 'Organization settings' },
    { path: '/dashboard/organization', name: 'data-classification-01.png', description: 'Data classification', action: async (page) => {
      await page.evaluate(() => window.scrollBy(0, 600));
    }}
  ],
  'cmdb': [
    { path: '/dashboard/cmdb', name: 'cmdb-dashboard-01.png', description: 'CMDB dashboard' },
    // The asset inventory is /dashboard/assets. There is no
    // /dashboard/cmdb/assets route — the pages under /dashboard/cmdb are the
    // six registers plus dependency-map and financial-services-workspace — so
    // this entry was capturing a 404 and saving it as the asset list.
    { path: '/dashboard/assets', name: 'cmdb-asset-list-01.png', description: 'Asset list' }
  ],
  'vulnerabilities': [
    { path: '/dashboard/vulnerabilities', name: 'vulnerabilities-list-01.png', description: 'Vulnerabilities list' }
  ],
  'poam': [
    { path: '/dashboard/poam', name: 'poam-list-01.png', description: 'POA&M list' }
  ],
  'reports': [
    { path: '/dashboard/reports', name: 'reports-menu-01.png', description: 'Reports menu' }
  ],
  'auditor-workspace': [
    { path: '/dashboard/auditor', name: 'auditor-workspace-dashboard-01.png', description: 'Auditor workspace' }
  ]
};

/**
 * Login to application.
 * Uses waitForURL instead of deprecated waitForNavigation.
 */
async function login(page) {
  console.log('🔐 Logging in...');

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  await page.fill('input[type="email"], input[name="email"]', USERNAME);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button:has-text("Sign In")');

  try {
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  } catch {
    // Fallback: wait and check manually
    await page.waitForTimeout(5000);
  }

  if (page.url().includes('/dashboard') || page.url().includes('/onboarding')) {
    console.log(`✅ Login successful — landed on ${page.url()}`);
    return true;
  }

  console.log('❌ Login failed — still on', page.url());
  return false;
}

/**
 * Capture a single screenshot.
 * When route.path is null the page stays on the previous URL (chained shots).
 *
 * A chained entry is only meaningful if it drives the UI to a new state via its
 * own `action`. Several entries had neither a path nor an action, so they
 * re-saved the previous screenshot under a name describing something else --
 * and because some of those names have real, committed screenshots that the
 * guides reference, running --all actively replaced good images with the wrong
 * page. Those entries now carry `manual` and are skipped: leaving a correct
 * screenshot in place beats overwriting it with a confident-looking wrong one.
 */
async function captureScreenshot(page, route) {
  try {
    if (route.manual) {
      console.log(`  ⏭️  ${route.name} — skipped, capture by hand (${route.manual})`);
      return 'skipped';
    }

    // Defensive: an entry with no path and no action cannot produce anything
    // other than a copy of the previous shot.
    if (!route.path && !route.action) {
      console.log(`  ⏭️  ${route.name} — skipped, no path and no action to distinguish it`);
      return 'skipped';
    }

    console.log(`  📸 ${route.name}`);

    if (route.path) {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);
    }

    if (route.action) {
      await route.action(page);
      await page.waitForTimeout(1000);
    }

    // Screenshot to a buffer first so an identical image can be refused before
    // it reaches disk.
    //
    // Most `action`s here are a scroll or a tab click, and both fail soft: a
    // scrollBy on a page shorter than the viewport moves nothing, and a
    // selector that misses is swallowed by `if (btn)`. Either way the action
    // returns cleanly having changed nothing, and the shot is byte-identical to
    // the previous one -- saved under a name promising a different view. That
    // is how a guide ends up captioning the same image three ways.
    //
    // Writing it would also overwrite a good committed screenshot with a
    // redundant one, so refuse and say which entry it collided with. The run
    // stays green; the log names every action that produced no new state.
    const buffer = await page.screenshot({ fullPage: route.fullPage || false });
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    const twin = writtenHashes.get(hash);
    if (twin) {
      console.log(`     ⏭️  identical to ${twin} — not written (the action produced no new state)`);
      return 'skipped';
    }

    writtenHashes.set(hash, route.name);
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, route.name), buffer);

    console.log(`     ✅ saved`);
    return true;
  } catch (error) {
    console.log(`     ❌ ${error.message}`);
    return false;
  }
}

/**
 * --all mode: capture every screenshot across all feature groups.
 * Register page is captured in a separate unauthenticated context.
 */
async function captureAll(browser, context, page) {
  let captured = 0;
  let failed = 0;
  let skipped = 0;

  // Unauthenticated pages first (register)
  const noAuthCtx = await browser.newContext({
    viewport: { width: screenshotConfig.viewportWidth, height: screenshotConfig.viewportHeight },
    deviceScaleFactor: screenshotConfig.deviceScaleFactor
  });
  const noAuthPage = await noAuthCtx.newPage();
  for (const routes of Object.values(captureRoutes)) {
    for (const route of routes.filter(entry => entry.noAuth)) {
      const result = await captureScreenshot(noAuthPage, route);
      if (result === 'skipped') skipped++; else if (result) captured++; else failed++;
    }
  }
  await noAuthCtx.close();

  // Authenticated pages
  for (const [feature, routes] of Object.entries(captureRoutes)) {
    console.log(`\n📦 ${feature}`);
    for (const route of routes.filter(entry => !entry.noAuth)) {
      const result = await captureScreenshot(page, route);
      if (result === 'skipped') skipped++; else if (result) captured++; else failed++;
    }
  }

  return { captured, failed, skipped };
}

/**
 * Default mode: only capture screenshots for features in feature-changes.json.
 */
async function captureChanged(browser, context, page) {
  const changesPath = path.join(process.cwd(), 'feature-changes.json');
  if (!fs.existsSync(changesPath)) {
    console.log('No feature-changes.json found. Nothing to capture.');
    return { captured: 0, failed: 0 };
  }

  const changes = JSON.parse(fs.readFileSync(changesPath, 'utf8'));
  const features = (changes.features || []).filter(
    f => f.screenshotsNeeded && f.screenshotsNeeded.length > 0
  );

  if (features.length === 0) {
    console.log('✅ No screenshots needed for changed features.');
    return { captured: 0, failed: 0 };
  }

  console.log(`🎯 Features requiring screenshots: ${features.length}\n`);

  let captured = 0;
  let failed = 0;
  let skipped = 0;

  for (const feature of features) {
    console.log(`\n📦 Feature: ${feature.feature}`);
    const routes = captureRoutes[feature.feature] || [];
    if (routes.length === 0) {
      console.log('   ⚠️  No routes defined');
      continue;
    }
    for (const route of routes.filter(entry => !entry.noAuth)) {
      const result = await captureScreenshot(page, route);
      if (result === 'skipped') skipped++; else if (result) captured++; else failed++;
    }
  }

  // Persist status back
  changes.screenshotsCaptured = captured;
  changes.screenshotsFailed = failed;
  fs.writeFileSync(changesPath, JSON.stringify(changes, null, 2));

  return { captured, failed, skipped };
}

/**
 * Entry point
 */
async function captureScreenshots() {
  console.log('📷 Automated Screenshot Capture\n');
  console.log(`   Mode:   ${allMode ? '--all (full suite)' : 'changed features only'}`);
  console.log(`   URL:    ${BASE_URL}`);
  console.log(`   Output: ${SCREENSHOTS_DIR}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: screenshotConfig.viewportWidth, height: screenshotConfig.viewportHeight },
    deviceScaleFactor: screenshotConfig.deviceScaleFactor
  });

  const page = await context.newPage();

  try {
    const loggedIn = await login(page);
    if (!loggedIn) {
      console.log('⚠️  Cannot capture authenticated screenshots without login. Skipping.');
      await browser.close();
      return;
    }

    const { captured, failed } = allMode
      ? await captureAll(browser, context, page)
      : await captureChanged(browser, context, page);

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Captured: ${captured}`);
    console.log(`❌ Failed:   ${failed}`);
    console.log('='.repeat(50) + '\n');
  } catch (error) {
    console.error('❌ Error during screenshot capture:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  captureScreenshots()
    .then(() => { console.log('✅ Done'); process.exit(0); })
    .catch((err) => { console.error('❌ Failed:', err); process.exit(1); });
}

module.exports = { captureScreenshots };
