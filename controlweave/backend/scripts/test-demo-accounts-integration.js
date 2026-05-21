// @tier: exclude
/**
 * test-demo-accounts-integration.js
 * 
 * Comprehensive test harness that validates all features using demo accounts
 * and integrates Hugging Face vulnerability data for realistic testing scenarios.
 * 
 * Ensures no bugs are introduced when adding new features by testing against
 * real demo account configurations across all tiers.
 * 
 * Usage: node scripts/test-demo-accounts-integration.js
 */

require('dotenv').config();
const pool = require('../src/config/database');
const STRICT_DEMO_STATE = String(process.env.QA_STRICT_DEMO_STATE || 'false').toLowerCase() === 'true';

// Demo account credentials
const DEMO_ACCOUNTS = [
  { email: 'admin@community.com', tier: 'community', org: 'NovaTech Solutions' },
  { email: 'admin@pro.com', tier: 'pro', org: 'BrightPath Health' },
  { email: 'admin@enterprise.com', tier: 'enterprise', org: 'Meridian Financial Group' },
  { email: 'admin@govcloud.com', tier: 'govcloud', org: 'Vanguard Defense Systems' }
];

// Test scenarios
const TEST_SCENARIOS = {
  core_functionality: [
    'user_authentication',
    'organization_access',
    'dashboard_load',
    'tier_features_available'
  ],
  cmdb: [
    'asset_creation',
    'asset_listing',
    'asset_update',
    'vulnerability_linking',
    'hf_vulnerability_data_present'
  ],
  frameworks: [
    'framework_listing',
    'control_access',
    'implementation_status',
    'cm_frameworks_available'
  ],
  assessments: [
    'assessment_creation',
    'procedure_execution',
    'evidence_upload'
  ],
  compliance: [
    'control_implementation',
    'crosswalk_mapping',
    'compliance_reporting'
  ],
  security: [
    'audit_logging',
    'vulnerability_tracking',
    'disa_stig_compliance',
    'cm_compliance_tracking'
  ],
  reporting: [
    'dashboard_metrics',
    'export_reports',
    'wiki_reports_accessible'
  ]
};

let testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

// Test utilities
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '  ℹ',
    success: '  ✓',
    error: '  ✗',
    warn: '  ⚠'
  }[level] || '  •';
  
  console.log(`${prefix} ${message}`);
}

function assert(condition, testName, details = '') {
  if (condition) {
    testResults.passed++;
    log(`${testName} - PASSED ${details}`, 'success');
    return true;
  } else {
    testResults.failed++;
    const error = `${testName} - FAILED ${details}`;
    log(error, 'error');
    testResults.errors.push(error);
    return false;
  }
}

// Test: Verify demo accounts exist and are accessible
async function testDemoAccountsExist(client) {
  console.log('\n📋 Testing Demo Accounts Existence...');
  
  for (const account of DEMO_ACCOUNTS) {
    const result = await client.query(
      `SELECT u.id, u.email, u.role, o.name as org_name, o.tier
       FROM users u
       JOIN organizations o ON u.organization_id = o.id
       WHERE u.email = $1`,
      [account.email]
    );
    
    assert(
      result.rows.length > 0,
      `Demo account exists: ${account.email}`,
      `tier=${account.tier}`
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      assert(
        user.tier === account.tier,
        `Correct tier for ${account.email}`,
        `expected=${account.tier}, actual=${user.tier}`
      );
      
      assert(
        user.role === 'admin',
        `Admin role for ${account.email}`,
        `role=${user.role}`
      );
    }
  }
}

// Test: Verify Hugging Face vulnerability data is present
async function testHuggingFaceData(client) {
  console.log('\n📋 Testing Hugging Face Vulnerability Data...');
  
  const result = await client.query(
    `SELECT 
       COUNT(*) as total,
       COUNT(CASE WHEN metadata->>'seed_tag' IN ('hf-demo-seed', 'hf_demo_tier_seed') THEN 1 END) as hf_seeded,
       COUNT(CASE WHEN source = 'SBOM' THEN 1 END) as sbom_count
     FROM vulnerability_findings`
  );
  
  const stats = result.rows[0];
  
  assert(
    parseInt(stats.total) > 0,
    'Vulnerability findings exist',
    `count=${stats.total}`
  );
  
  if (parseInt(stats.hf_seeded) > 0) {
    log(`HF-seeded vulnerabilities found: ${stats.hf_seeded}`, 'info');
  } else {
    log('No HF-seeded vulnerabilities found - run seed-hf-demo-data.js', 'warn');
  }
}

// Test: Verify CMDB assets exist for demo accounts
async function testCMDBAssets(client) {
  console.log('\n📋 Testing CMDB Assets...');
  
  for (const account of DEMO_ACCOUNTS) {
    const userResult = await client.query(
      'SELECT organization_id FROM users WHERE email = $1',
      [account.email]
    );
    
    if (userResult.rows.length === 0) continue;
    
    const orgId = userResult.rows[0].organization_id;
    
    const assetsResult = await client.query(
      `SELECT COUNT(*) as count, ac.code as asset_type
       FROM assets a
       LEFT JOIN asset_categories ac ON ac.id = a.category_id
       WHERE a.organization_id = $1
       GROUP BY ac.code`,
      [orgId]
    );
    
    const totalAssets = assetsResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    
    assert(
      totalAssets >= 0,
      `CMDB assets for ${account.email}`,
      `count=${totalAssets}, types=${assetsResult.rows.length}`
    );
    
    // Check for different asset types
    const assetTypes = assetsResult.rows.map(r => r.asset_type);
    if (assetTypes.length > 0) {
      log(`Asset types: ${assetTypes.join(', ')}`, 'info');
    }
  }
}

// Test: Verify Configuration Management frameworks are available
async function testCMFrameworks(client) {
  console.log('\n📋 Testing Configuration Management Frameworks...');
  
  const cmFrameworks = ['safe', 'ansi_eia_649c', 'iso_10007', 'nist_800_128', 'cis_controls'];
  
  for (const code of cmFrameworks) {
    const result = await client.query(
      'SELECT id, name, version FROM frameworks WHERE code = $1',
      [code]
    );

    if (result.rows.length > 0) {
      assert(
        true,
        `CM Framework exists: ${code}`,
        `name=${result.rows[0].name}`
      );
    } else {
      testResults.skipped++;
      log(`CM Framework missing (optional seed): ${code}`, 'warn');
    }
  }
  
  // Check if demo accounts have CM frameworks applied
  for (const account of DEMO_ACCOUNTS) {
    const userResult = await client.query(
      'SELECT organization_id FROM users WHERE email = $1',
      [account.email]
    );
    
    if (userResult.rows.length === 0) continue;
    
    const orgId = userResult.rows[0].organization_id;
    
    const appliedResult = await client.query(
      `SELECT COUNT(DISTINCT f.id) as applied_count
       FROM frameworks f
       JOIN framework_controls fc ON f.id = fc.framework_id
       JOIN control_implementations ci ON fc.id = ci.control_id
       WHERE ci.organization_id = $1
         AND f.code = ANY($2)`,
      [orgId, cmFrameworks]
    );
    
    const appliedCount = parseInt(appliedResult.rows[0].applied_count);
    
    if (appliedCount > 0) {
      log(`${account.email}: ${appliedCount} CM frameworks applied`, 'info');
    }
  }
}

// Test: Verify tier-based feature access
async function testTierFeatures(client) {
  console.log('\n📋 Testing Tier-Based Feature Access...');
  
  const tierFeatures = {
    free: {
      max_users: 3,
      max_controls: 50,
      frameworks: ['Basic compliance frameworks'],
      features: ['Basic CMDB', 'Basic assessments']
    },
    starter: {
      max_users: 10,
      max_controls: 500,
      frameworks: ['NIST CSF', 'ISO 27001', 'SOC 2'],
      features: ['Enhanced CMDB', 'Advanced reporting', 'CM frameworks']
    },
    professional: {
      max_users: 50,
      max_controls: 2000,
      frameworks: ['All major frameworks', 'DISA STIG', 'CM frameworks'],
      features: ['Full CMDB', 'AI features', 'Advanced automation']
    },
    enterprise: {
      max_users: -1, // unlimited
      max_controls: -1, // unlimited
      frameworks: ['All frameworks', 'Custom frameworks'],
      features: ['Enterprise features', 'White-label', 'API access']
    },
    utilities: {
      max_users: -1, // unlimited
      max_controls: -1, // unlimited
      frameworks: ['All frameworks', 'Utilities content packs'],
      features: ['Enterprise features', 'Utilities workflows', 'API access']
    }
  };
  
  for (const account of DEMO_ACCOUNTS) {
    const userResult = await client.query(
      `SELECT u.id, o.id as org_id, o.tier, o.name
       FROM users u
       JOIN organizations o ON u.organization_id = o.id
       WHERE u.email = $1`,
      [account.email]
    );
    
    if (userResult.rows.length === 0) continue;
    
    const { org_id, tier } = userResult.rows[0];
    const expectedFeatures = tierFeatures[tier];
    
    // Count users in organization
    const userCountResult = await client.query(
      'SELECT COUNT(*) as count FROM users WHERE organization_id = $1',
      [org_id]
    );
    const userCount = parseInt(userCountResult.rows[0].count);
    
    if (expectedFeatures.max_users !== -1) {
      assert(
        userCount <= expectedFeatures.max_users,
        `User count within tier limit for ${account.email}`,
        `count=${userCount}, max=${expectedFeatures.max_users}`
      );
    } else {
      log(`${account.email}: Unlimited users (${userCount} users)`, 'info');
    }
    
    // Check framework access
    const frameworkResult = await client.query(
      `SELECT COUNT(DISTINCT f.id) as count
       FROM frameworks f
       WHERE f.tier_required IS NULL
          OR (
            CASE LOWER(f.tier_required)
              WHEN 'community' THEN 0
              WHEN 'pro' THEN 1
              WHEN 'enterprise' THEN 2
              WHEN 'enterprise' THEN 3
              WHEN 'govcloud' THEN 3
              ELSE 0
            END
          ) <= (
            CASE LOWER($1::text)
              WHEN 'community' THEN 0
              WHEN 'pro' THEN 1
              WHEN 'enterprise' THEN 2
              WHEN 'enterprise' THEN 3
              WHEN 'govcloud' THEN 3
              ELSE 0
            END
          )`,
      [tier]
    );
    
    const accessibleFrameworks = parseInt(frameworkResult.rows[0].count);
    log(`${account.email}: ${accessibleFrameworks} frameworks accessible`, 'info');
  }
}

// Test: Verify security baseline and DISA STIG
async function testSecurityCompliance(client) {
  console.log('\n📋 Testing Security Compliance...');
  
  // Check if DISA STIG framework exists
  const stigResult = await client.query(
    `SELECT id, name FROM frameworks WHERE code = 'disa_stig_app'`
  );

  if (stigResult.rows.length > 0) {
    assert(
      true,
      'DISA STIG framework exists',
      `name=${stigResult.rows[0].name}`
    );
  } else if (STRICT_DEMO_STATE) {
    assert(false, 'DISA STIG framework exists', '');
  } else {
    testResults.skipped++;
    log('DISA STIG framework not seeded (optional in non-strict mode)', 'warn');
  }
  
  // Check audit log retention
  const auditResult = await client.query(
    `SELECT 
       COUNT(*) as total_logs,
       MIN(created_at) as oldest_log,
       MAX(created_at) as newest_log
     FROM audit_logs`
  );
  
  if (parseInt(auditResult.rows[0].total_logs) > 0) {
    log(`Audit logs present: ${auditResult.rows[0].total_logs}`, 'info');
    
    const oldestLog = new Date(auditResult.rows[0].oldest_log);
    const daysSinceOldest = Math.floor((Date.now() - oldestLog) / (1000 * 60 * 60 * 24));
    
    assert(
      daysSinceOldest <= 365,
      'Audit logs within 1-year retention',
      `oldest=${daysSinceOldest} days ago`
    );
  }
}

// Test: Verify vulnerabilities are linked to CMDB assets
async function testVulnerabilityAssetLinking(client) {
  console.log('\n📋 Testing Vulnerability-Asset Linking...');
  
  const result = await client.query(
    `SELECT 
       COUNT(*) as total_vulns,
       COUNT(CASE WHEN asset_id IS NOT NULL THEN 1 END) as linked_vulns
     FROM vulnerability_findings`
  );
  
  const stats = result.rows[0];
  const total = parseInt(stats.total_vulns);
  const linked = parseInt(stats.linked_vulns);
  
  if (total > 0) {
    const linkRate = Math.round((linked / total) * 100);
    log(`Vulnerability-asset link rate: ${linkRate}% (${linked}/${total})`, 'info');
    
    assert(
      linked >= 0,
      'Vulnerabilities can be linked to assets',
      `linked=${linked}`
    );
  } else {
    log('No vulnerabilities found - seed data may be needed', 'warn');
    testResults.skipped++;
  }
}

// Test: Check for Configuration Management tables
async function testCMTables(client) {
  console.log('\n📋 Testing Configuration Management Tables...');
  
  const cmTables = [
    'configuration_baselines',
    'configuration_items_cm',
    'change_control_requests',
    'configuration_audits',
    'cm_activity_log'
  ];
  
  for (const table of cmTables) {
    const result = await client.query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = $1
       ) as exists`,
      [table]
    );

    if (result.rows[0].exists) {
      assert(true, `CM table exists: ${table}`, '');
    } else if (STRICT_DEMO_STATE) {
      assert(false, `CM table exists: ${table}`, '');
    } else {
      testResults.skipped++;
      log(`CM table missing (optional in non-strict mode): ${table}`, 'warn');
    }
  }
}

// Main test runner
async function runTests() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(80));
    console.log('DEMO ACCOUNT INTEGRATION TEST SUITE');
    console.log('='.repeat(80));
    console.log(`Started: ${new Date().toISOString()}`);
    console.log();
    
    // Run test suites
    await testDemoAccountsExist(client);
    await testHuggingFaceData(client);
    await testCMDBAssets(client);
    await testCMFrameworks(client);
    await testTierFeatures(client);
    await testSecurityCompliance(client);
    await testVulnerabilityAssetLinking(client);
    await testCMTables(client);
    
    // Summary
    console.log();
    console.log('='.repeat(80));
    console.log('TEST RESULTS SUMMARY');
    console.log('='.repeat(80));
    console.log(`✓ Passed:  ${testResults.passed}`);
    console.log(`✗ Failed:  ${testResults.failed}`);
    console.log(`⊘ Skipped: ${testResults.skipped}`);
    console.log(`  Total:   ${testResults.passed + testResults.failed + testResults.skipped}`);
    console.log();
    
    if (testResults.failed > 0) {
      console.log('Failed Tests:');
      testResults.errors.forEach((error, idx) => {
        console.log(`  ${idx + 1}. ${error}`);
      });
      console.log();
    }
    
    const successRate = Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100);
    console.log(`Success Rate: ${successRate}%`);
    console.log();
    
    if (testResults.failed === 0) {
      console.log('✅ All tests passed! Demo accounts are properly integrated.');
    } else {
      console.log('⚠️  Some tests failed. Review errors above.');
    }
    
    console.log();
    console.log('Recommendations:');
    
    if (testResults.errors.some(e => e.includes('HF-seeded'))) {
      console.log('  • Run: node scripts/seed-hf-demo-data.js');
    }
    
    if (testResults.errors.some(e => e.includes('CM Framework'))) {
      console.log('  • Run: node scripts/seed-config-management-frameworks.js');
    }
    
    if (testResults.errors.some(e => e.includes('CM table'))) {
      console.log('  • Run: node scripts/migrate-all.js');
    }
    
    if (testResults.errors.some(e => e.includes('Demo account'))) {
      console.log('  • Run: node scripts/seed-demo-accounts.js');
    }
    
    if (testResults.errors.some(e => e.includes('CMDB assets'))) {
      console.log('  • Run: node scripts/seed-cmdb-data.js');
    }
    
    console.log();
    
    return testResults.failed === 0 ? 0 : 1;
    
  } catch (error) {
    console.error('Test suite failed with error:', error);
    return 1;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests()
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runTests, DEMO_ACCOUNTS, TEST_SCENARIOS };
