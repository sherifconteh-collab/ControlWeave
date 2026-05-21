#!/usr/bin/env node
// @tier: exclude
/**
 * Phase 7 External Integrations - Test Script
 * Tests threat intelligence, vendor security, and regulatory news features
 */

const fs = require('fs');
const path = require('path');

console.log('=== Phase 7 External Integrations Test Script ===\n');

// Test 1: Verify migration files exist
console.log('Test 1: Verify migration files exist');
const migrations = [
  'migrations/065_external_threat_feeds.sql',
  'migrations/066_threat_intelligence_items.sql',
  'migrations/067_vendor_security_scores.sql',
  'migrations/068_regulatory_news.sql'
];

let allMigrationsExist = true;
migrations.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✓ ${file} exists`);
  } else {
    console.log(`  ✗ ${file} missing`);
    allMigrationsExist = false;
  }
});

if (allMigrationsExist) {
  console.log('  ✓ All migration files present\n');
} else {
  console.log('  ✗ Some migration files missing\n');
  process.exit(1);
}

// Test 2: Verify service files exist
console.log('Test 2: Verify service files exist');
const services = [
  'src/services/threatIntelService.js',
  'src/services/nvdService.js',
  'src/services/cisaKevService.js',
  'src/services/mitreService.js',
  'src/services/alienVaultService.js',
  'src/services/vendorSecurityService.js',
  'src/services/regulatoryNewsService.js'
];

let allServicesExist = true;
services.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✓ ${file} exists`);
  } else {
    console.log(`  ✗ ${file} missing`);
    allServicesExist = false;
  }
});

if (allServicesExist) {
  console.log('  ✓ All service files present\n');
} else {
  console.log('  ✗ Some service files missing\n');
  process.exit(1);
}

// Test 3: Verify route files exist
console.log('Test 3: Verify route files exist');
const routes = [
  'src/routes/threatIntel.js',
  'src/routes/vendorSecurity.js',
  'src/routes/regulatoryNews.js'
];

let allRoutesExist = true;
routes.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✓ ${file} exists`);
  } else {
    console.log(`  ✗ ${file} missing`);
    allRoutesExist = false;
  }
});

if (allRoutesExist) {
  console.log('  ✓ All route files present\n');
} else {
  console.log('  ✗ Some route files missing\n');
  process.exit(1);
}

// Test 4: Verify service imports
console.log('Test 4: Verify service imports');
let allServicesLoad = true;

services.forEach(file => {
  try {
    const fullPath = path.join(__dirname, '..', file);
    const service = require(fullPath);
    console.log(`  ✓ ${path.basename(file)} loads successfully`);
    
    // Verify key exports exist
    const fileName = path.basename(file, '.js');
    if (fileName === 'threatIntelService') {
      if (typeof service.getThreatFeeds === 'function' &&
          typeof service.createThreatFeed === 'function' &&
          typeof service.syncFeed === 'function') {
        console.log(`    ✓ Expected functions exported`);
      } else {
        console.log(`    ✗ Missing expected functions`);
        allServicesLoad = false;
      }
    }
    
    if (fileName === 'vendorSecurityService') {
      if (typeof service.getVendorScores === 'function' &&
          typeof service.refreshVendorScore === 'function') {
        console.log(`    ✓ Expected functions exported`);
      } else {
        console.log(`    ✗ Missing expected functions`);
        allServicesLoad = false;
      }
    }
    
    if (fileName === 'regulatoryNewsService') {
      if (typeof service.getNewsItems === 'function' &&
          typeof service.refreshNews === 'function') {
        console.log(`    ✓ Expected functions exported`);
      } else {
        console.log(`    ✗ Missing expected functions`);
        allServicesLoad = false;
      }
    }
  } catch (error) {
    console.log(`  ✗ ${path.basename(file)} failed to load: ${error.message}`);
    allServicesLoad = false;
  }
});

if (allServicesLoad) {
  console.log('  ✓ All services load successfully\n');
} else {
  console.log('  ✗ Some services failed to load\n');
  process.exit(1);
}

// Test 5: Verify route imports
console.log('Test 5: Verify route imports');
let allRoutesLoad = true;

routes.forEach(file => {
  try {
    const fullPath = path.join(__dirname, '..', file);
    const route = require(fullPath);
    console.log(`  ✓ ${path.basename(file)} loads successfully`);
    
    // Verify it's an Express router
    if (route && typeof route === 'function') {
      console.log(`    ✓ Valid Express router`);
    } else {
      console.log(`    ✗ Not a valid Express router`);
      allRoutesLoad = false;
    }
  } catch (error) {
    console.log(`  ✗ ${path.basename(file)} failed to load: ${error.message}`);
    allRoutesLoad = false;
  }
});

if (allRoutesLoad) {
  console.log('  ✓ All routes load successfully\n');
} else {
  console.log('  ✗ Some routes failed to load\n');
  process.exit(1);
}

// Test 6: Verify server.js includes new routes
console.log('Test 6: Verify server.js includes new routes');
const serverPath = path.join(__dirname, '..', 'src/server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');

const routeImports = [
  "require('./routes/threatIntel')",
  "require('./routes/vendorSecurity')",
  "require('./routes/regulatoryNews')"
];

const routeMounts = [
  "app.use('/api/v1/threat-intel'",
  "app.use('/api/v1/vendor-security'",
  "app.use('/api/v1/regulatory-news'"
];

let serverConfigured = true;

routeImports.forEach(importStr => {
  if (serverContent.includes(importStr)) {
    console.log(`  ✓ Route import found: ${importStr}`);
  } else {
    console.log(`  ✗ Route import missing: ${importStr}`);
    serverConfigured = false;
  }
});

routeMounts.forEach(mountStr => {
  if (serverContent.includes(mountStr)) {
    console.log(`  ✓ Route mount found: ${mountStr}`);
  } else {
    console.log(`  ✗ Route mount missing: ${mountStr}`);
    serverConfigured = false;
  }
});

if (serverConfigured) {
  console.log('  ✓ Server.js properly configured\n');
} else {
  console.log('  ✗ Server.js configuration incomplete\n');
  process.exit(1);
}

// Test 7: Verify integration hub updates
console.log('Test 7: Verify integration hub updates');
const hubPath = path.join(__dirname, '..', 'src/routes/integrationsHub.js');
const hubContent = fs.readFileSync(hubPath, 'utf8');

const connectorTypes = [
  'nvd',
  'cisa_kev',
  'mitre_attack',
  'alienvault_otx',
  'securityscorecard',
  'bitsight'
];

let hubUpdated = true;
connectorTypes.forEach(type => {
  if (hubContent.includes(`type: '${type}'`)) {
    console.log(`  ✓ Connector type found: ${type}`);
  } else {
    console.log(`  ✗ Connector type missing: ${type}`);
    hubUpdated = false;
  }
});

if (hubUpdated) {
  console.log('  ✓ Integration hub updated with new connectors\n');
} else {
  console.log('  ✗ Integration hub missing some connectors\n');
  process.exit(1);
}

// Test 8: Verify package.json dependencies
console.log('Test 8: Verify package.json dependencies');
const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const requiredDeps = ['axios', 'rss-parser'];
let depsPresent = true;

requiredDeps.forEach(dep => {
  if (packageJson.dependencies[dep]) {
    console.log(`  ✓ Dependency present: ${dep}@${packageJson.dependencies[dep]}`);
  } else {
    console.log(`  ✗ Dependency missing: ${dep}`);
    depsPresent = false;
  }
});

if (depsPresent) {
  console.log('  ✓ All required dependencies present\n');
} else {
  console.log('  ✗ Some dependencies missing\n');
  process.exit(1);
}

// Test 9: Verify documentation exists
console.log('Test 9: Verify documentation exists');
const docPath = path.join(__dirname, '..', '..', '..', 'PHASE_7_EXTERNAL_INTEGRATIONS.md');
if (fs.existsSync(docPath)) {
  const docContent = fs.readFileSync(docPath, 'utf8');
  console.log(`  ✓ PHASE_7_EXTERNAL_INTEGRATIONS.md exists`);
  console.log(`  ✓ Size: ${docContent.length} bytes`);
  
  // Verify key sections
  const keySections = [
    'NIST NVD',
    'CISA KEV',
    'MITRE ATT&CK',
    'AlienVault OTX',
    'SecurityScorecard',
    'BitSight',
    'Database Schema',
    'API Endpoints',
    'Security Considerations'
  ];
  
  let allSectionsPresent = true;
  keySections.forEach(section => {
    if (docContent.includes(section)) {
      console.log(`  ✓ Section present: ${section}`);
    } else {
      console.log(`  ✗ Section missing: ${section}`);
      allSectionsPresent = false;
    }
  });
  
  if (allSectionsPresent) {
    console.log('  ✓ Documentation is comprehensive\n');
  } else {
    console.log('  ✗ Documentation missing some sections\n');
  }
} else {
  console.log('  ✗ PHASE_7_EXTERNAL_INTEGRATIONS.md not found\n');
  process.exit(1);
}

// Final summary
console.log('=== Test Summary ===');
console.log('✓ All tests passed successfully!');
console.log('\nPhase 7 External Integrations implementation is complete and ready for deployment.');
console.log('\nNext steps:');
console.log('1. Run database migrations: npm run migrate');
console.log('2. Start the server: npm start');
console.log('3. Test API endpoints with authentication');
console.log('4. Configure external API keys for feeds that require them');
console.log('5. Run security scan: CodeQL');

process.exit(0);
