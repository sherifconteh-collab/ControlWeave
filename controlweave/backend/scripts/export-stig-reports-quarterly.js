// @tier: exclude
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

/**
 * Export DISA STIG Reports Quarterly
 * 
 * This script exports DISA STIG compliance reports to the wiki quarterly
 * with 1-year retention policy as requested by the user.
 * 
 * Frequency: Quarterly (January 1, April 1, July 1, October 1)
 * Location: controlweave/docs/wiki/security/reports/<org>/
 * Retention: 365 days (1 year)
 */

const WIKI_SECURITY_DIR = path.join(__dirname, '../../docs/wiki/security');
const WIKI_REPORTS_DIR = path.join(WIKI_SECURITY_DIR, 'reports');
const RETENTION_DAYS = 365; // 1 year retention

// Ensure directories exist
function ensureDirectories() {
  [WIKI_SECURITY_DIR, WIKI_REPORTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

// Format date for filenames and reports
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatDateTime(date) {
  return date.toISOString().replace('T', ' ').split('.')[0];
}

// All DISA STIG framework codes relevant to ControlWeave
const STIG_FRAMEWORK_CODES = [
  'disa_stig_app',
  'disa_stig_app_server',
  'disa_stig_postgresql',
  'disa_stig_web_server',
  'disa_stig_gpos'
];

// Generate DISA STIG compliance report for a single framework
async function generateFrameworkSection(client, organizationId, frameworkCode) {
  const fwResult = await client.query(
    `SELECT id, name, version FROM frameworks WHERE code = $1 LIMIT 1`,
    [frameworkCode]
  );

  if (fwResult.rows.length === 0) {
    return `### ${frameworkCode}\n\n⚠️ Framework not seeded. Run the corresponding seed script.\n\n`;
  }

  const fw = fwResult.rows[0];
  const controlsResult = await client.query(
    `SELECT
       fc.control_id,
       fc.title,
       fc.priority,
       fc.control_type,
       ci.status,
       ci.implementation_narrative
     FROM framework_controls fc
     LEFT JOIN control_implementations ci ON fc.id = ci.control_id
       AND ci.organization_id = $1
     WHERE fc.framework_id = $2
     ORDER BY fc.control_id`,
    [organizationId, fw.id]
  );

  const total = controlsResult.rows.length;
  const implemented = controlsResult.rows.filter(r => r.status === 'implemented').length;
  const inProgress = controlsResult.rows.filter(r => r.status === 'in_progress').length;
  const needsReview = controlsResult.rows.filter(r => r.status === 'needs_review').length;
  const pct = total > 0 ? Math.round((implemented / total) * 100) : 0;

  let section = `### ${fw.name} (${fw.version})\n\n`;
  section += `| Metric | Value |\n|--------|-------|\n`;
  section += `| Total Controls | ${total} |\n`;
  section += `| Implemented | ${implemented} (${pct}%) |\n`;
  section += `| In Progress | ${inProgress} |\n`;
  section += `| Needs Review | ${needsReview} |\n`;
  section += `| Compliance | ${pct >= 80 ? '✓ Compliant' : '⚠️ Needs Attention'} |\n\n`;

  // Priority 1 controls
  const p1 = controlsResult.rows.filter(r => r.priority === '1');
  const p1Done = p1.filter(r => r.status === 'implemented').length;
  section += `**Priority 1:** ${p1Done}/${p1.length} implemented`;
  section += p1.length > 0 ? ` (${Math.round((p1Done / p1.length) * 100)}%)\n\n` : '\n\n';

  // Group by control_type
  const byType = {};
  controlsResult.rows.forEach(r => {
    if (!byType[r.control_type]) byType[r.control_type] = { total: 0, implemented: 0 };
    byType[r.control_type].total++;
    if (r.status === 'implemented') byType[r.control_type].implemented++;
  });

  if (Object.keys(byType).length > 0) {
    section += `| Control Type | Total | Implemented | Rate |\n`;
    section += `|--------------|-------|-------------|------|\n`;
    Object.keys(byType).sort().forEach(type => {
      const s = byType[type];
      section += `| ${type} | ${s.total} | ${s.implemented} | ${s.total > 0 ? Math.round((s.implemented / s.total) * 100) : 0}% |\n`;
    });
    section += '\n';
  }

  return section;
}

// Generate combined DISA STIG compliance report (all frameworks)
async function generateDisaStigReport(client, organizationId) {
  console.log('Generating DISA STIG compliance report (all frameworks)...');

  // Query all STIG frameworks that exist in the database
  const stigFrameworkResult = await client.query(
    `SELECT id, code, name, version FROM frameworks WHERE code = ANY($1) ORDER BY code`,
    [STIG_FRAMEWORK_CODES]
  );

  let report = `# DISA STIG Compliance — Quarterly Report\n\n`;
  report += `**Generated:** ${formatDateTime(new Date())}\n`;
  report += `**Organization ID:** ${organizationId}\n`;
  report += `**Report Frequency:** Quarterly\n`;
  report += `**Frameworks Covered:** ${stigFrameworkResult.rows.length} of ${STIG_FRAMEWORK_CODES.length}\n\n`;

  // List seeded frameworks
  report += `## Frameworks in Scope\n\n`;
  report += `| Code | Name | Version | Seeded |\n`;
  report += `|------|------|---------|--------|\n`;
  for (const code of STIG_FRAMEWORK_CODES) {
    const fw = stigFrameworkResult.rows.find(r => r.code === code);
    if (fw) {
      report += `| ${fw.code} | ${fw.name} | ${fw.version} | ✅ |\n`;
    } else {
      report += `| ${code} | — | — | ❌ Not seeded |\n`;
    }
  }
  report += '\n';

  // Generate section for each framework
  report += `## Compliance by Framework\n\n`;
  for (const code of STIG_FRAMEWORK_CODES) {
    report += await generateFrameworkSection(client, organizationId, code);
  }

  // Overall summary
  const allControlsResult = await client.query(
    `SELECT
       ci.status,
       COUNT(*) as cnt
     FROM framework_controls fc
     JOIN frameworks f ON fc.framework_id = f.id
     LEFT JOIN control_implementations ci ON fc.id = ci.control_id
       AND ci.organization_id = $1
     WHERE f.code = ANY($2)
     GROUP BY ci.status`,
    [organizationId, STIG_FRAMEWORK_CODES]
  );

  const statusMap = {};
  let grandTotal = 0;
  allControlsResult.rows.forEach(r => {
    statusMap[r.status || 'not_started'] = parseInt(r.cnt, 10);
    grandTotal += parseInt(r.cnt, 10);
  });

  report += `## Overall STIG Compliance Summary\n\n`;
  report += `- **Total Controls (all STIGs):** ${grandTotal}\n`;
  report += `- **Implemented:** ${statusMap.implemented || 0}\n`;
  report += `- **In Progress:** ${statusMap.in_progress || 0}\n`;
  report += `- **Needs Review:** ${statusMap.needs_review || 0}\n`;
  report += `- **Not Started:** ${statusMap.not_started || 0}\n\n`;

  // Quarterly recommendations
  report += `## Quarterly Recommendations\n\n`;
  report += `1. Review all Priority 1 controls across all five STIG frameworks\n`;
  report += `2. Update implementation narratives for newly-implemented controls\n`;
  report += `3. Run \`node scripts/check-stig-versions.js\` to verify frameworks are current\n`;
  report += `4. Upload evidence for completed assessments\n`;
  report += `5. Schedule next quarterly review\n\n`;

  return report;
}

// Clean up old STIG reports beyond retention period
function cleanupOldStigReports() {
  console.log('Checking for old DISA STIG reports to archive...');
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoffDateStr = formatDate(cutoffDate);
  
  let removedCount = 0;
  
  function processDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        processDirectory(filePath);
      } else if (file.startsWith('disa-stig-compliance-') && file.endsWith('.md')) {
        // Extract date from filename (format: disa-stig-compliance-YYYY-MM-DD.md)
        const dateMatch = file.match(/disa-stig-compliance-(\d{4}-\d{2}-\d{2})\.md$/);
        if (dateMatch && dateMatch[1] < cutoffDateStr) {
          fs.unlinkSync(filePath);
          removedCount++;
          console.log(`  Removed old DISA STIG report: ${filePath}`);
        }
      }
    });
  }
  
  processDirectory(WIKI_REPORTS_DIR);
  
  if (removedCount > 0) {
    console.log(`  ✓ Archived/removed ${removedCount} old DISA STIG report(s)`);
  } else {
    console.log(`  No old DISA STIG reports to archive`);
  }
  console.log();
}

// Main export function
async function exportStigReportsQuarterly() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(80));
    console.log('QUARTERLY DISA STIG REPORTS EXPORT');
    console.log('='.repeat(80));
    console.log();
    
    ensureDirectories();
    
    // Get all organizations
    const orgsResult = await client.query(
      'SELECT id, name FROM organizations ORDER BY created_at'
    );
    
    if (orgsResult.rows.length === 0) {
      console.log('No organizations found.');
      return;
    }
    
    const timestamp = formatDate(new Date());
    const quarter = Math.floor((new Date().getMonth() / 3)) + 1;
    
    console.log(`Generating Q${quarter} DISA STIG reports for ${orgsResult.rows.length} organization(s)...`);
    console.log();
    
    for (const org of orgsResult.rows) {
      console.log(`Processing organization: ${org.name}`);
      console.log('-'.repeat(80));
      
      const orgSlug = org.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const reportDir = path.join(WIKI_REPORTS_DIR, orgSlug);
      
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      // Generate and save DISA STIG report
      const stigReport = await generateDisaStigReport(client, org.id);
      const stigFile = path.join(reportDir, `disa-stig-compliance-${timestamp}.md`);
      fs.writeFileSync(stigFile, stigReport);
      console.log(`  ✓ DISA STIG report: ${stigFile}`);
      
      console.log();
    }
    
    // Clean up old STIG reports (beyond retention period)
    cleanupOldStigReports();
    
    console.log('='.repeat(80));
    console.log('QUARTERLY DISA STIG EXPORT COMPLETE');
    console.log('='.repeat(80));
    console.log();
    console.log(`DISA STIG reports saved to: ${WIKI_REPORTS_DIR}`);
    console.log(`Retention period: ${RETENTION_DAYS} days (1 year)`);
    console.log(`Report frequency: Quarterly`);
    console.log(`Next scheduled run: Next quarter (Jan 1, Apr 1, Jul 1, or Oct 1)`);
    console.log();
    
  } catch (error) {
    console.error('Error exporting DISA STIG reports:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the export
if (require.main === module) {
  exportStigReportsQuarterly()
    .then(() => {
      console.log('Quarterly DISA STIG export completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Quarterly DISA STIG export failed:', error);
      process.exit(1);
    });
}

module.exports = { exportStigReportsQuarterly };
