#!/usr/bin/env node
/**
 * Comprehensive test suite for Stripe billing integration
 * Tests graceful degradation and proper error handling
 */

const assert = require('assert');

console.log('\n🧪 Testing Stripe Billing Integration\n');
console.log('='.repeat(60));

let testsPassed = 0;
let testsFailed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✓ ${description}`);
    testsPassed++;
  } catch (err) {
    console.log(`✗ ${description}`);
    console.log(`  Error: ${err.message}`);
    testsFailed++;
  }
}

async function asyncTest(description, fn) {
  try {
    await fn();
    console.log(`✓ ${description}`);
    testsPassed++;
  } catch (err) {
    console.log(`✗ ${description}`);
    console.log(`  Error: ${err.message}`);
    testsFailed++;
  }
}

// Ensure no Stripe env vars are set for these tests
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_PUBLISHABLE_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;

console.log('\n📦 Module Loading Tests');
console.log('-'.repeat(60));

test('stripeService module loads without error', () => {
  const stripeService = require('./src/services/stripeService');
  assert.ok(stripeService);
});

test('billing routes module loads without error', () => {
  const billingRoutes = require('./src/routes/billing');
  assert.ok(billingRoutes);
});

console.log('\n🔧 Configuration Tests');
console.log('-'.repeat(60));

test('isStripeConfigured returns false without env vars', () => {
  const { isStripeConfigured } = require('./src/services/stripeService');
  assert.strictEqual(isStripeConfigured(), false);
});

test('VALID_LOOKUP_KEYS contains expected tiers', () => {
  const { VALID_LOOKUP_KEYS } = require('./src/services/stripeService');
  assert.ok(VALID_LOOKUP_KEYS.has('pro_monthly'));
  assert.ok(VALID_LOOKUP_KEYS.has('pro_annual'));
  assert.ok(VALID_LOOKUP_KEYS.has('enterprise_monthly'));
  assert.ok(VALID_LOOKUP_KEYS.has('enterprise_annual'));
  // Gov Cloud is custom contract only — no Stripe lookup keys
  assert.ok(!VALID_LOOKUP_KEYS.has('govcloud_monthly'));
  assert.ok(!VALID_LOOKUP_KEYS.has('govcloud_annual'));
});

test('isValidLookupKey validates correctly', () => {
  const { isValidLookupKey } = require('./src/services/stripeService');
  assert.ok(isValidLookupKey('pro_monthly'));
  assert.ok(isValidLookupKey('pro_annual'));
  assert.ok(isValidLookupKey('enterprise_monthly'));
  assert.ok(isValidLookupKey('enterprise_annual'));
  assert.ok(!isValidLookupKey('govcloud_monthly'));
  assert.ok(!isValidLookupKey('govcloud_annual'));
  assert.ok(!isValidLookupKey('invalid_key'));
  assert.ok(!isValidLookupKey(''));
  assert.ok(!isValidLookupKey('starter_monthly'));
  assert.ok(!isValidLookupKey('professional_annual'));
  assert.ok(!isValidLookupKey('utilities_monthly'));
});

test('tierFromLookupKey maps correctly', () => {
  const { tierFromLookupKey } = require('./src/services/stripeService');
  assert.strictEqual(tierFromLookupKey('pro_monthly'), 'pro');
  assert.strictEqual(tierFromLookupKey('pro_annual'), 'pro');
  assert.strictEqual(tierFromLookupKey('enterprise_monthly'), 'enterprise');
  assert.strictEqual(tierFromLookupKey('enterprise_annual'), 'enterprise');
  assert.strictEqual(tierFromLookupKey('govcloud_monthly'), null);
  assert.strictEqual(tierFromLookupKey('govcloud_annual'), null);
  assert.strictEqual(tierFromLookupKey('invalid'), null);
  assert.strictEqual(tierFromLookupKey('starter_monthly'), null);
  assert.strictEqual(tierFromLookupKey('professional_monthly'), null);
});

console.log('\n⚠️  Error Handling Tests (without Stripe configured)');
console.log('-'.repeat(60));

asyncTest('createCheckoutSession throws proper error', async () => {
  const { createCheckoutSession } = require('./src/services/stripeService');
  try {
    await createCheckoutSession({
      orgId: 'test',
      orgEmail: 'test@example.com',
      stripeCustomerId: null,
      lookupKey: 'pro_monthly',
      trialEndsAt: null,
      successUrl: 'http://localhost',
      cancelUrl: 'http://localhost'
    });
    throw new Error('Should have thrown an error');
  } catch (err) {
    assert.ok(err.message.includes('Stripe is not configured'));
  }
});

asyncTest('createBillingPortalSession throws proper error', async () => {
  const { createBillingPortalSession } = require('./src/services/stripeService');
  try {
    await createBillingPortalSession({
      stripeCustomerId: 'cus_test',
      returnUrl: 'http://localhost'
    });
    throw new Error('Should have thrown an error');
  } catch (err) {
    assert.ok(err.message.includes('Stripe is not configured'));
  }
});

asyncTest('getSubscription throws proper error', async () => {
  const { getSubscription } = require('./src/services/stripeService');
  try {
    await getSubscription('sub_test');
    throw new Error('Should have thrown an error');
  } catch (err) {
    assert.ok(err.message.includes('Stripe is not configured'));
  }
});

console.log('\n🌐 Express Route Tests');
console.log('-'.repeat(60));

asyncTest('GET /billing/config returns 503 without Stripe', async () => {
  const express = require('express');
  const http = require('http');
  const app = express();
  
  app.use(express.json());
  const billingRoutes = require('./src/routes/billing');
  app.use('/api/v1/billing', billingRoutes);
  
  const server = app.listen(0); // Random port
  const port = server.address().port;
  
  const result = await new Promise((resolve) => {
    http.get(`http://localhost:${port}/api/v1/billing/config`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: JSON.parse(data) });
      });
    });
  });
  
  server.close();
  
  assert.strictEqual(result.status, 503);
  assert.ok(result.body.error.includes('not configured'));
});

console.log('\n📄 Migration File Tests');
console.log('-'.repeat(60));

test('Migration 055 file exists', () => {
  const fs = require('fs');
  const path = require('path');
  const migrationPath = path.join(__dirname, 'migrations', '055_stripe_billing.sql');
  assert.ok(fs.existsSync(migrationPath));
});

test('Migration 055 contains required columns', () => {
  const fs = require('fs');
  const path = require('path');
  const migrationPath = path.join(__dirname, 'migrations', '055_stripe_billing.sql');
  const content = fs.readFileSync(migrationPath, 'utf8');
  assert.ok(content.includes('stripe_customer_id'));
  assert.ok(content.includes('stripe_subscription_id'));
  assert.ok(content.includes('idx_orgs_stripe_customer'));
  assert.ok(content.includes('idx_orgs_stripe_subscription'));
});

console.log('\n🔄 SubscriptionService Tests');
console.log('-'.repeat(60));

test('subscriptionService queries exclude Stripe-managed orgs', () => {
  const fs = require('fs');
  const path = require('path');
  const servicePath = path.join(__dirname, 'src', 'services', 'subscriptionService.js');
  const content = fs.readFileSync(servicePath, 'utf8');
  
  // Should have two queries that check for NULL stripe_subscription_id
  const matches = content.match(/stripe_subscription_id IS NULL/g);
  assert.strictEqual(matches?.length, 2, 'Expected 2 queries with stripe_subscription_id IS NULL check');
});

// Summary
console.log('\n' + '='.repeat(60));
console.log(`\n📊 Test Summary: ${testsPassed} passed, ${testsFailed} failed\n`);

if (testsFailed > 0) {
  console.log('❌ Some tests failed');
  process.exit(1);
} else {
  console.log('✅ All tests passed!');
  console.log('\n🎉 Stripe integration is ready for deployment!');
  console.log('   - Server will start without Stripe configuration');
  console.log('   - Proper error messages when Stripe is not configured');
  console.log('   - Trial expiration skips Stripe-managed organizations');
  process.exit(0);
}
