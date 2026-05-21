#!/usr/bin/env node
/**
 * Post-deployment verification script for backend and frontend linkage.
 * Usage: node verify-deployment.js [backend-url] [frontend-url]
 * Example: node verify-deployment.js https://controlweave-pro-production.up.railway.app https://captivating-consideration-production-0326.up.railway.app
 */

const https = require('https');
const http = require('http');

const backendUrl = process.argv[2] || process.env.BACKEND_URL || 'http://localhost:3001';
const frontendUrl = process.argv[3] || process.env.FRONTEND_URL || '';

function getClient(baseUrl) {
  return baseUrl.startsWith('https') ? https : http;
}

console.log('\nVerifying ControlWeave deployment\n');
console.log('Backend target:', backendUrl);
if (frontendUrl) {
  console.log('Frontend target:', frontendUrl);
}
console.log('='.repeat(60));

async function checkEndpoint(baseUrl, path, expectedStatuses, description, validator = null) {
  return new Promise((resolve) => {
    const url = `${baseUrl}${path}`;
    console.log(`\nTesting: ${baseUrl}${path}`);
    console.log(`   ${description}`);
    
    getClient(baseUrl).get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (_error) {
          parsed = null;
        }

        const expected = Array.isArray(expectedStatuses)
          ? expectedStatuses
          : (expectedStatuses == null ? [] : [expectedStatuses]);
        const statusMatches = expected.length === 0 || expected.includes(res.statusCode);
        const validatorMatches = typeof validator === 'function'
          ? validator({ statusCode: res.statusCode, body: data, json: parsed })
          : true;
        const success = statusMatches && validatorMatches;

        console.log(`   Status: ${res.statusCode} ${success ? '[OK]' : '[FAIL]'}`);
        
        try {
          const json = JSON.parse(data);
          console.log(`   Response:`, JSON.stringify(json, null, 2).split('\n').map(l => '   ' + l).join('\n').trim());
        } catch (e) {
          console.log(`   Response:`, data.substring(0, 200));
        }
        
        resolve({ path, baseUrl, success, status: res.statusCode, body: data, json: parsed });
      });
    }).on('error', (err) => {
      console.log(`   [FAIL] Error: ${err.message}`);
      resolve({ path, baseUrl, success: false, error: err.message });
    });
  });
}

async function runChecks() {
  const results = [];
  
  // Check 1: Health endpoint
  results.push(await checkEndpoint(
    backendUrl,
    '/health',
    200,
    'Server health check'
  ));
  
  // Check 2: Root API endpoint
  results.push(await checkEndpoint(
    backendUrl,
    '/',
    200,
    'API root endpoint'
  ));
  
  // Check 3: Billing config endpoint
  const billingResult = await checkEndpoint(
    backendUrl,
    '/api/v1/billing/config',
    [200, 503],
    'Billing configuration endpoint'
  );
  results.push(billingResult);

  if (frontendUrl) {
    results.push(await checkEndpoint(
      frontendUrl,
      '/',
      200,
      'Frontend root page'
    ));

    results.push(await checkEndpoint(
      frontendUrl,
      '/login',
      200,
      'Frontend login page'
    ));

    results.push(await checkEndpoint(
      frontendUrl,
      '/api/v1/frameworks',
      401,
      'Frontend same-origin API rewrite to backend',
      ({ json }) => json && json.error === 'No token provided'
    ));
  }
  
  // Determine if Stripe is configured based on response
  const stripeConfigured = billingResult.status === 200;
  
  console.log('\n' + '='.repeat(60));
  console.log('\nVerification Summary\n');
  
  const passed = results.filter(r => r.success).length;
  const total = results.filter(r => r.success !== undefined).length;
  
  console.log(`Tests Passed: ${passed}/${total}`);
  
  if (stripeConfigured) {
    console.log('\nStripe is configured and ready to use');
    console.log('   Environment variables are properly set');
    console.log('   Billing features are available');
  } else if (billingResult.status === 503) {
    console.log('\nStripe is not configured (graceful degradation working)');
    console.log('   This is OK if Stripe setup is not yet complete');
    console.log('   Server is running normally without billing features');
    console.log('\n   To enable billing, set these environment variables:');
    console.log('   - STRIPE_SECRET_KEY');
    console.log('   - STRIPE_PUBLISHABLE_KEY');
    console.log('   - STRIPE_WEBHOOK_SECRET');
  } else {
    console.log('\nUnexpected billing config response');
  }
  
  const allHealthy = results.every(r => r.success);
  
  if (allHealthy) {
    console.log('\nDeployment verification passed');
    console.log('   Required backend checks succeeded');
    if (frontendUrl) {
      console.log('   Frontend routing and API rewrite checks succeeded');
    }
    process.exit(0);
  } else {
    console.log('\nDeployment verification failed');
    console.log('   At least one backend or frontend linkage check failed');
    process.exit(1);
  }
}

runChecks().catch(err => {
  console.error('\nVerification script error:', err);
  process.exit(1);
});
