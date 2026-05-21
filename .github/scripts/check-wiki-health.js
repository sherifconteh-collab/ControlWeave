const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Wiki Health Check Script
 * Verifies that all expected documentation exists in the GitHub Wiki
 * and that content is in sync.
 */

async function checkWikiHealth() {
  console.log('🔍 Starting wiki health check...\n');
  
  const wikiPath = process.env.WIKI_PATH || 'wiki-repo';
  const autoFix = process.env.AUTO_FIX === 'true';
  
  // Define expected documents (should match sync-wiki.yml)
  const expectedDocs = [
    { source: 'controlweave/docs/wiki/Home.md', wiki: 'Home.md' },
    { source: 'controlweave/docs/wiki/User-Guide.md', wiki: 'User-Guide.md' },
    { source: 'controlweave/docs/wiki/getting-started/Getting-Started.md', wiki: 'Getting-Started.md' },
    { source: 'controlweave/docs/wiki/getting-started/Account-Setup.md', wiki: 'Account-Setup.md' },
    { source: 'controlweave/docs/wiki/security/Vulnerability-Management.md', wiki: 'Vulnerability-Management.md' }
  ];
  
  const report = {
    timestamp: new Date().toISOString(),
    healthy: true,
    expectedDocs: [],
    foundInWiki: [],
    missingDocs: [],
    extraDocs: [],
    outOfSync: [],
    details: []
  };
  
  // Check each expected document
  console.log('📄 Checking expected documents:\n');
  
  for (const doc of expectedDocs) {
    const sourcePath = path.join(process.cwd(), doc.source);
    const wikiFilePath = path.join(wikiPath, doc.wiki);
    
    report.expectedDocs.push(doc.wiki);
    
    const docCheck = {
      name: doc.wiki,
      sourceExists: fs.existsSync(sourcePath),
      wikiExists: fs.existsSync(wikiFilePath),
      inSync: false
    };
    
    // Check if source exists
    if (!docCheck.sourceExists) {
      console.log(`  ⚠️  Source missing: ${doc.source}`);
      docCheck.status = 'source_missing';
      report.healthy = false;
    } else if (!docCheck.wikiExists) {
      console.log(`  ❌ Missing from wiki: ${doc.wiki}`);
      report.missingDocs.push(doc.wiki);
      docCheck.status = 'wiki_missing';
      report.healthy = false;
    } else {
      // Both exist - check if in sync
      const sourceContent = fs.readFileSync(sourcePath, 'utf8');
      const wikiContent = fs.readFileSync(wikiFilePath, 'utf8');
      
      const sourceHash = crypto.createHash('md5').update(sourceContent).digest('hex');
      const wikiHash = crypto.createHash('md5').update(wikiContent).digest('hex');
      
      docCheck.sourceHash = sourceHash;
      docCheck.wikiHash = wikiHash;
      docCheck.inSync = sourceHash === wikiHash;
      
      if (docCheck.inSync) {
        console.log(`  ✅ ${doc.wiki} - In sync`);
        report.foundInWiki.push(doc.wiki);
        docCheck.status = 'in_sync';
      } else {
        console.log(`  🔄 ${doc.wiki} - Out of sync (hash mismatch)`);
        report.outOfSync.push(doc.wiki);
        report.foundInWiki.push(doc.wiki);
        docCheck.status = 'out_of_sync';
        report.healthy = false;
      }
    }
    
    report.details.push(docCheck);
  }
  
  // Check for extra files in wiki
  console.log('\n📋 Checking for extra files in wiki:\n');
  
  if (fs.existsSync(wikiPath)) {
    const wikiFiles = fs.readdirSync(wikiPath)
      .filter(f => f.endsWith('.md') && !f.startsWith('.'));
    
    const expectedWikiFiles = expectedDocs.map(d => d.wiki);
    
    for (const wikiFile of wikiFiles) {
      if (!expectedWikiFiles.includes(wikiFile)) {
        console.log(`  ℹ️  Extra file in wiki: ${wikiFile}`);
        report.extraDocs.push(wikiFile);
      }
    }
    
    if (report.extraDocs.length === 0) {
      console.log('  ✅ No unexpected files in wiki');
    }
  } else {
    console.log('  ⚠️  Wiki repository not found at:', wikiPath);
    report.healthy = false;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Health Check Summary:');
  console.log('='.repeat(60));
  console.log(`Overall Status: ${report.healthy ? '✅ HEALTHY' : '⚠️ ISSUES FOUND'}`);
  console.log(`Expected Documents: ${report.expectedDocs.length}`);
  console.log(`Found in Wiki: ${report.foundInWiki.length}`);
  console.log(`Missing from Wiki: ${report.missingDocs.length}`);
  console.log(`Out of Sync: ${report.outOfSync.length}`);
  console.log(`Extra Documents: ${report.extraDocs.length}`);
  console.log('='.repeat(60));
  
  if (!report.healthy) {
    console.log('\n⚠️  Action Required:');
    if (report.missingDocs.length > 0) {
      console.log(`   - ${report.missingDocs.length} document(s) missing from wiki`);
    }
    if (report.outOfSync.length > 0) {
      console.log(`   - ${report.outOfSync.length} document(s) out of sync`);
    }
    
    if (autoFix) {
      console.log('\n🔧 Auto-fix enabled - will trigger sync workflow');
    } else {
      console.log('\n💡 Run: gh workflow run sync-wiki.yml');
      console.log('   Or: gh workflow run wiki-health-check.yml -f auto_fix=true');
    }
  } else {
    console.log('\n✅ All documents are present and in sync!');
  }
  
  // Save report
  fs.writeFileSync('wiki-health-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Report saved to: wiki-health-report.json');
  
  // Set GitHub Actions output
  console.log(`::set-output name=healthy::${report.healthy}`);
  console.log(`::set-output name=missing_count::${report.missingDocs.length}`);
  console.log(`::set-output name=out_of_sync_count::${report.outOfSync.length}`);
  
  // Exit with error if unhealthy
  if (!report.healthy) {
    process.exit(1);
  }
  
  return report;
}

// Run if called directly
if (require.main === module) {
  checkWikiHealth()
    .catch(error => {
      console.error('❌ Health check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkWikiHealth };
