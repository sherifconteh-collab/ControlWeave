#!/usr/bin/env node
'use strict';

/**
 * TEVV-SEC: security and audit invariants.
 *
 * Static checks that encode what independent code reviews of this repo have
 * found, so the same class of defect cannot come back silently. Each check is
 * a rule a reviewer would otherwise re-verify by hand on every pull request.
 *
 *   node scripts/tevv-security-audit.js              run every check
 *   node scripts/tevv-security-audit.js --only SEC-5 run one check (CI steps)
 *   node scripts/tevv-security-audit.js --list       list the checks
 *
 * SEC-1..4 were TEVV-API-6, -7, -9 and -12; they moved here unchanged so all
 * access-control and audit invariants live in one layer. Exemption lists are
 * explicit and carry a reason: adding to one is a reviewable decision.
 *
 * Exit code 1 when any selected check fails.
 */

const fs = require('fs');
const path = require('path');

const BACKEND = path.resolve(__dirname, '..');
const SRC = path.join(BACKEND, 'src');
const ROUTES = path.join(SRC, 'routes');

// ---------------------------------------------------------------- helpers

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function rel(file) {
  return path.relative(BACKEND, file).split(path.sep).join('/');
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/** Source without // and block comments, so commented-out code does not count. */
function code(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** The argument text of every call to `callee(` in the source (balanced parentheses). */
function callArguments(text, callee) {
  const results = [];
  let index = text.indexOf(`${callee}(`);
  while (index !== -1) {
    let depth = 0;
    let end = index + callee.length;
    for (; end < text.length; end += 1) {
      if (text[end] === '(') depth += 1;
      else if (text[end] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    results.push(text.slice(index + callee.length + 1, end));
    index = text.indexOf(`${callee}(`, end);
  }
  return results;
}

const routeFiles = () => fs.readdirSync(ROUTES).filter((f) => f.endsWith('.js')).map((f) => path.join(ROUTES, f));

// ---------------------------------------------------------------- checks

const CHECKS = [
  {
    id: 'SEC-1',
    was: 'TEVV-API-6',
    title: 'Compliance-domain routes use RBAC requirePermission',
    run() {
      const files = ['regulatoryNews.js', 'vendorSecurity.js', 'dataSovereignty.js', 'aiMonitoring.js'];
      return files
        .map((f) => path.join(ROUTES, f))
        .filter((f) => fs.existsSync(f) && !read(f).includes('requirePermission'))
        .map((f) => `${rel(f)} is missing RBAC requirePermission checks`);
    }
  },
  {
    id: 'SEC-2',
    was: 'TEVV-API-7',
    title: 'Separation of duties is applied to approval workflows',
    run() {
      const failures = [];
      if (!fs.existsSync(path.join(SRC, 'middleware', 'sod.js'))) failures.push('src/middleware/sod.js is missing');
      for (const f of ['poam.js', 'policies.js', 'assessments/workpapers.js', 'orgSettings.js']) {
        const file = path.join(ROUTES, f);
        if (fs.existsSync(file) && !read(file).includes('requireSod')) failures.push(`${rel(file)} is missing requireSod`);
      }
      return failures;
    }
  },
  {
    id: 'SEC-3',
    was: 'TEVV-API-9',
    title: 'Every non-public route file uses authenticate middleware',
    // Public by design: sign-in, the public contact form, vendor questionnaires
    // answered by token. externalAi authenticates with its own API keys.
    exempt: { 'auth.js': 'sign-in and registration', 'publicContact.js': 'public contact form', 'tprmPublic.js': 'vendor answers by one-time token', 'externalAi.js': 'own API-key authentication' },
    run() {
      return routeFiles()
        .filter((f) => !this.exempt[path.basename(f)])
        .filter((f) => {
          const text = read(f);
          return !/require\(.*\/middleware\/auth/.test(text) && !/router\.use\(authenticate/.test(text);
        })
        .map((f) => `${rel(f)} does not import from middleware/auth or apply router.use(authenticate)`);
    }
  },
  {
    id: 'SEC-4',
    was: 'TEVV-API-12',
    title: 'New route files have a CodeQL-visible express-rate-limit limiter',
    // Grandfathered route files that predate the rule (see the history in
    // .github/workflows/ci.yml); only NEW route files are blocked.
    baseline: 'ai.js aiGovernance.js aiMonitoring.js assessments.js assets.js auditFields.js auth.js autoEvidenceCollection.js billing.js cmdb.js contacts.js controlHealth.js controls.js customFrameworks.js dashboard.js dashboardBuilder.js dataGovernance.js dataSovereignty.js dynamicConfig.js environments.js evidence.js exceptions.js externalAi.js externalAiKeys.js frameworks.js help.js implementations.js integrationsHub.js internationalAiLaws.js issueReport.js license.js notifications.js ops.js orgSettings.js organizations.js passkeys.js pendingEvidence.js performance.js phase6.js platformAdmin.js plot4ai.js poam.js policies.js publicContact.js pushTokens.js rag.js realtime.js regulatoryNews.js reports.js roles.js sbom.js scheduledReports.js serviceAccounts.js siem.js splunk.js sso.js stateAiLaws.js threatIntel.js totp.js tprm.js tprmPublic.js users.js vendorSecurity.js vulnerabilities.js webhooks.js'.split(' '),
    run() {
      return routeFiles()
        .filter((f) => !this.baseline.includes(path.basename(f)))
        .filter((f) => !read(f).includes("require('express-rate-limit')"))
        .map((f) => `${rel(f)} has no express-rate-limit import and is not grandfathered; add router.use(rateLimit({...})) before authenticate (see audit.js)`);
    }
  },
  {
    id: 'SEC-5',
    title: 'Outbound HTTP to tenant-supplied URLs goes through the SSRF guard',
    // A file that makes outbound requests must send them through the pinned
    // client (utils/netGuard safeFetch, or the connector client requestJson,
    // which uses it) or be listed here because every host it calls is fixed.
    // A bare fetch() after assertSafeUrl is not enough: the client resolves
    // the name again when it connects, so DNS rebinding can swap in a private
    // address after the check.
    guardMarkers: ['safeFetch', 'requestJson'],
    fixedHosts: {
      'src/services/ai/chatCore.js': 'Gemini API base (constant)',
      'src/services/ai/providerExec.js': 'Gemini API base (constant)',
      'src/services/githubService.js': 'api.github.com (constant)',
      'src/services/ssoService.js': 'social provider endpoints from the SOCIAL_PROVIDERS constant',
      'src/services/qa/apiClient.js': 'loopback to this server',
      'src/services/dependencyTracker.js': 'public package registries; NPM_REGISTRY_URL is operator configuration',
      'src/routes/issueReport.js': 'api.github.com (constant)',
      'src/routes/platformAdmin.js': 'provider APIs (constants), platform owners only',
      'src/services/nvdService.js': 'NVD API (constant)',
      'src/services/vendorSecurityService.js': 'SecurityScorecard and BitSight APIs (constants)',
      'src/services/alienVaultService.js': 'AlienVault OTX API (constant)',
      'src/services/regulatoryNewsService.js': 'published feed URLs (constants)',
      'src/services/mitreService.js': 'MITRE ATT&CK data (constant)',
      'src/services/cisaKevService.js': 'CISA KEV catalog (constant)',
      'src/routes/license.js': 'license heartbeat endpoint (operator configuration)'
    },
    patterns: [/\bhttps?\.(request|get)\(/, /\bfetch\(/, /require\(['"]axios['"]\)/],
    run() {
      const failures = [];
      for (const file of walk(SRC)) {
        const name = rel(file);
        const text = code(read(file));
        if (!this.patterns.some((re) => re.test(text))) continue;
        if (this.fixedHosts[name]) continue;
        const guarded = this.guardMarkers.some((m) => text.includes(m));
        const bare = this.patterns.some((re) => re.test(text.replace(/\bsafeFetch\(/g, '')));
        if (guarded && !bare) continue;
        failures.push(guarded
          ? `${name} uses the SSRF guard but also makes a bare outbound request; send every tenant-supplied URL through safeFetch/requestJson, or list the file in SEC-5 fixedHosts if the bare call only reaches fixed hosts`
          : `${name} makes outbound HTTP requests without the SSRF guard (utils/netGuard safeFetch or connectors/http requestJson); if every host it calls is fixed, add it to SEC-5 fixedHosts with the reason`);
      }
      for (const name of Object.keys(this.fixedHosts)) {
        if (!fs.existsSync(path.join(BACKEND, name))) failures.push(`SEC-5 fixedHosts lists ${name}, which no longer exists; remove it`);
      }
      return failures;
    }
  },
  {
    id: 'SEC-6',
    title: 'Every JWT is signed and verified with a pinned algorithm',
    run() {
      const failures = [];
      for (const file of walk(SRC)) {
        const text = code(read(file));
        for (const args of callArguments(text, 'jwt.sign')) {
          if (!/\balgorithm\s*:/.test(args)) failures.push(`${rel(file)}: jwt.sign(...) without an explicit algorithm`);
        }
        for (const args of callArguments(text, 'jwt.verify')) {
          if (!/\balgorithms\s*:|VERIFY_OPTIONS/.test(args)) failures.push(`${rel(file)}: jwt.verify(...) without an algorithms allow-list`);
        }
      }
      return failures;
    }
  },
  {
    id: 'SEC-7',
    title: "Every sign-in route that issues sessions applies the organization's SSO requirement",
    // A route file that mints refresh tokens is a sign-in path. It must consult
    // services/ssoPolicy, which is also where the admin break-glass rule and
    // fail-closed behavior live.
    run() {
      return routeFiles()
        .filter((f) => /type:\s*'refresh'/.test(code(read(f))))
        .filter((f) => !read(f).includes('ssoPolicy.ssoRequiredFor'))
        .map((f) => `${rel(f)} issues sessions but never calls ssoPolicy.ssoRequiredFor, so "Require SSO" can be bypassed through it`);
    }
  },
  {
    id: 'SEC-8',
    title: 'Route files that query the database scope data by organization',
    // Deliberately organization-independent route files, with the reason.
    exempt: {
      'totp.js': "the signed-in user's own second factor (scoped by user id)",
      'performance.js': 'deployment-wide metrics, platform owners only'
    },
    run() {
      const files = [...routeFiles(), ...walk(path.join(ROUTES, 'assessments'))];
      return files
        .filter((f) => !this.exempt[path.basename(f)])
        .filter((f) => {
          const text = code(read(f));
          return /\b(pool|client|db)\.query\(/.test(text) && !text.includes('organization_id');
        })
        .map((f) => `${rel(f)} runs SQL but never references organization_id; scope every tenant query or add an exemption with the reason`);
    }
  },
  {
    id: 'SEC-9',
    title: 'Full-snapshot ERP connectors prove their extract is complete before replacing data',
    // A connector sync replaces users and assignments with what it fetched.
    // A truncated or empty extract would silently remove access records and
    // falsely verify revocations, so every connector reports completeness and
    // the sync refuses anything that is not complete.
    run() {
      const dir = path.join(SRC, 'services', 'erp', 'connectors');
      const sync = path.join(SRC, 'services', 'erp', 'syncService.js');
      if (!fs.existsSync(dir) || !fs.existsSync(sync)) return [];
      const failures = [];
      const syncText = code(read(sync));
      // Call sites only (not the definition), and the check must run before
      // the first loadExtract() call.
      const firstCall = (name) => {
        const match = new RegExp(`(?<!function\\s+)\\b${name}\\s*\\(`).exec(syncText);
        return match ? match.index : -1;
      };
      const check = firstCall('assertCompleteExtract');
      const load = firstCall('loadExtract');
      if (check < 0 || (load >= 0 && check > load)) failures.push('services/erp/syncService.js must call assertCompleteExtract() before loadExtract() replaces data');
      for (const file of walk(dir).filter((f) => path.basename(f) !== 'shared.js')) {
        const text = code(read(file));
        if (!/\bcomplete\s*:/.test(text)) failures.push(`${rel(file)} must report whether its extract is complete ({ complete, total } in its result)`);
        const name = path.basename(file, '.js');
        if (!syncText.includes(`./connectors/${name}`)) failures.push(`${rel(file)} is not registered in syncService TEMPLATES`);
      }
      return failures;
    }
  },
  {
    id: 'SEC-10',
    title: 'Refresh tokens reach the web app only as an HttpOnly cookie',
    // A route that issues sessions must hand the refresh token out through
    // utils/refreshCookie deliverRefreshToken, which puts it in the HttpOnly
    // cookie for the web app (out of reach of page scripts) and in the body
    // only for API clients. A response that names refreshToken without it
    // would put the token back where an XSS payload can read it.
    run() {
      const failures = [];
      for (const file of routeFiles().filter((f) => /type:\s*'refresh'/.test(code(read(f))))) {
        const text = code(read(file));
        if (!text.includes('deliverRefreshToken(')) {
          failures.push(`${rel(file)} issues refresh tokens but never calls refreshCookie.deliverRefreshToken`);
          continue;
        }
        for (const args of callArguments(text, '.json')) {
          const expressions = args.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''");
          if (/\brefreshToken\b/.test(expressions) && !/deliverRefreshToken\(/.test(expressions)) {
            failures.push(`${rel(file)}: a JSON response includes refreshToken without refreshCookie.deliverRefreshToken`);
          }
        }
      }
      return failures;
    }
  }
];

// ---------------------------------------------------------------- runner

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--list')) {
    for (const c of CHECKS) process.stdout.write(`${c.id}${c.was ? ` (was ${c.was})` : ''}  ${c.title}\n`);
    return 0;
  }
  const onlyIndex = args.indexOf('--only');
  const only = onlyIndex !== -1 ? String(args[onlyIndex + 1] || '').split(',') : null;
  const selected = only ? CHECKS.filter((c) => only.includes(c.id)) : CHECKS;
  if (only && selected.length !== only.length) {
    process.stderr.write(`Unknown check in --only ${only.join(',')}\n`);
    return 1;
  }
  let failed = 0;
  for (const check of selected) {
    const failures = check.run();
    if (failures.length) {
      failed += 1;
      process.stdout.write(`❌ TEVV-${check.id} — ${check.title}\n`);
      for (const f of failures) process.stdout.write(`   ${f}\n`);
    } else {
      process.stdout.write(`✅ TEVV-${check.id} — ${check.title}\n`);
    }
  }
  return failed ? 1 : 0;
}

if (require.main === module) process.exit(main());

module.exports = { CHECKS, callArguments, code };
