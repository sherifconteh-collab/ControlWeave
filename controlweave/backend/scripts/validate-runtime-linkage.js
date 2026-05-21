#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const frontendRoot = path.resolve(backendRoot, '..', 'frontend');

function readRequiredFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function pass(name, detail) {
  return { name, ok: true, detail };
}

function fail(name, detail) {
  return { name, ok: false, detail };
}

function evaluateLinkage() {
  const nextConfigPath = path.join(frontendRoot, 'next.config.ts');
  const apiBasePath = path.join(frontendRoot, 'src', 'lib', 'apiBase.ts');
  const ssoCallbackPagePath = path.join(frontendRoot, 'src', 'app', 'login', 'sso-callback', 'page.tsx');
  const serverPath = path.join(backendRoot, 'src', 'server.js');
  const ssoRoutePath = path.join(backendRoot, 'src', 'routes', 'sso.js');

  const nextConfig = readRequiredFile(nextConfigPath);
  const apiBase = readRequiredFile(apiBasePath);
  const ssoCallbackPage = readRequiredFile(ssoCallbackPagePath);
  const server = readRequiredFile(serverPath);
  const ssoRoute = readRequiredFile(ssoRoutePath);

  const checks = [
    /const BACKEND_URL\s*=\s*[\s\S]*?;/.test(nextConfig)
      ? pass('frontend backend origin constant', 'BACKEND_URL constant is present.')
      : fail('frontend backend origin constant', 'BACKEND_URL constant is malformed or missing.'),
    /source:\s*["']\/api\/v1\/:path\*["']/.test(nextConfig)
      ? pass('frontend rewrite source', 'Next.js rewrites /api/v1/:path*.')
      : fail('frontend rewrite source', 'Missing rewrite source for /api/v1/:path*.'),
    /destination:\s*`\$\{BACKEND_URL\}\/api\/v1\/:path\*`/.test(nextConfig)
      ? pass('frontend rewrite destination', 'Rewrite destination points at BACKEND_URL/api/v1/:path*.')
      : fail('frontend rewrite destination', 'Missing BACKEND_URL rewrite destination.'),
    /const DEFAULT_API_BASE = '\/api\/v1'/.test(apiBase)
      ? pass('frontend default api base', 'Default client API base is relative /api/v1.')
      : fail('frontend default api base', 'Default client API base is not /api/v1.'),
    /const LOCAL_API_BASE = 'http:\/\/localhost:3001\/api\/v1'/.test(apiBase)
      ? pass('frontend local api base', 'Local development API base points at localhost:3001/api/v1.')
      : fail('frontend local api base', 'Local development API base is not localhost:3001/api/v1.'),
    /app\.get\('\/health',\s*async\s*\(req,\s*res\)/.test(server)
      ? pass('backend health route', 'Backend exposes /health.')
      : fail('backend health route', 'Backend /health route is missing.'),
    /apiBase:\s*'\/api\/v1'/.test(server)
      ? pass('backend api base advertisement', 'Backend root advertises /api/v1.')
      : fail('backend api base advertisement', 'Backend root response no longer advertises /api/v1.'),
    /login\/sso-callback#at=\$\{encodeURIComponent\(/.test(ssoRoute)
      ? pass('backend sso token fragment redirect', 'SSO redirects deliver tokens via URL fragment.')
      : fail('backend sso token fragment redirect', 'SSO redirects are not using URL fragments for tokens.'),
    !/login\/sso-callback\?at=\$\{encodeURIComponent\(/.test(ssoRoute)
      ? pass('backend sso query token redirect removed', 'SSO redirect no longer exposes tokens in the query string.')
      : fail('backend sso query token redirect removed', 'SSO redirect still exposes tokens in the query string.'),
    /window\.location\.hash/.test(ssoCallbackPage) && /searchParams\.get\('at'\)/.test(ssoCallbackPage)
      ? pass('frontend sso callback parses fragment and legacy query', 'Frontend SSO callback supports fragment tokens and legacy query fallback.')
      : fail('frontend sso callback parses fragment and legacy query', 'Frontend SSO callback is missing fragment parsing or legacy query fallback.'),
    /window\.history\.replaceState\(null, '', window\.location\.pathname\)/.test(ssoCallbackPage)
      ? pass('frontend sso callback clears tokenized url', 'Frontend SSO callback clears tokens from the address bar after parsing.')
      : fail('frontend sso callback clears tokenized url', 'Frontend SSO callback does not clear tokens from the address bar after parsing.')
  ];

  return checks;
}

function main() {
  const checks = evaluateLinkage();
  const failed = checks.filter((check) => !check.ok);

  console.log('Runtime linkage validation');
  console.log('==========================');
  checks.forEach((check) => {
    console.log(`${check.ok ? '[PASS]' : '[FAIL]'} ${check.name}: ${check.detail}`);
  });

  if (failed.length > 0) {
    console.error(`\nRuntime linkage validation failed (${failed.length} checks).`);
    process.exit(1);
  }

  console.log('\nRuntime linkage validation passed.');
}

main();