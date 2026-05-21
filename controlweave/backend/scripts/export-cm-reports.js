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
 * Export Configuration Management Framework Compliance Reports
 * 
 * Generates compliance reports for configuration management frameworks:
 * - SAFe (Scaled Agile Framework)
 * - ANSI/EIA-649C (Configuration Management Standard)
 * - ISO 10007 (Quality Management - CM Guidelines)
 * - NIST SP 800-128 (Security-Focused Configuration Management)
 * - CIS Controls v8
 * 
 * Reports are exported to wiki with compliance status and implementation details.
 */

const WIKI_SECURITY_DIR = path.join(__dirname, '../../docs/wiki/security');
const WIKI_CM_REPORTS_DIR = path.join(WIKI_SECURITY_DIR, 'reports', 'configuration-management');

// Configuration Management framework codes
const CM_FRAMEWORKS = [
  'safe',
  'ansi_eia_649c',
  'iso_10007',
  'nist_800_128',
  'cis_controls'
];

// Ensure directories exist
function ensureDirectories() {
  [WIKI_SECURITY_DIR, WIKI_CM_REPORTS_DIR].forEach(dir => {
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

// Generate Configuration Management compliance report
async function generateCMComplianceReport(client, organizationId) {
  console.log('Generating Configuration Management compliance report...');
  
  let report = `# Configuration Management Framework Compliance Report\n\n`;
  report += `**Generated:** ${formatDateTime(new Date())}\n`;
  report += `**Organization ID:** ${organizationId}\n\n`;
  
  report += `## Overview\n\n`;
  report += `This report provides compliance status for configuration management and agile methodology frameworks:\n`;
  report += `- **SAFe** - Scaled Agile Framework for enterprise agility\n`;
  report += `- **ANSI/EIA-649C** - Industry-standard configuration management process\n`;
  report += `- **ISO 10007** - Quality management CM guidelines\n`;
  report += `- **NIST SP 800-128** - Security-focused configuration management\n`;
  report += `- **CIS Controls v8** - Cybersecurity best practices\n\n`;
  
  // Get all CM frameworks
  const frameworksResult = await client.query(
    `SELECT id, code, name, version, category
     FROM frameworks 
     WHERE code = ANY($1)
     ORDER BY 
       CASE 
         WHEN code = 'safe' THEN 1
         WHEN code = 'ansi_eia_649c' THEN 2
         WHEN code = 'iso_10007' THEN 3
         WHEN code = 'nist_800_128' THEN 4
         WHEN code = 'cis_controls' THEN 5
       END`,
    [CM_FRAMEWORKS]
  );
  
  if (frameworksResult.rows.length === 0) {
    report += `⚠️ No configuration management frameworks found. Please run seed-config-management-frameworks.js\n\n`;
    return report;
  }
  
  report += `## Framework Implementation Status\n\n`;
  report += `| Framework | Controls | Implemented | In Progress | Rate |\n`;
  report += `|-----------|----------|-------------|-------------|------|\n`;
  
  let totalControls = 0;
  let totalImplemented = 0;
  
  for (const framework of frameworksResult.rows) {
    const controlsResult = await client.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN ci.status = 'implemented' THEN 1 END) as implemented,
         COUNT(CASE WHEN ci.status = 'in_progress' THEN 1 END) as in_progress
       FROM framework_controls fc
       LEFT JOIN control_implementations ci ON fc.id = ci.control_id 
         AND ci.organization_id = $1
       WHERE fc.framework_id = $2`,
      [organizationId, framework.id]
    );
    
    const stats = controlsResult.rows[0];
    const total = parseInt(stats.total);
    const implemented = parseInt(stats.implemented);
    const inProgress = parseInt(stats.in_progress);
    const rate = total > 0 ? Math.round((implemented / total) * 100) : 0;
    
    totalControls += total;
    totalImplemented += implemented;
    
    report += `| ${framework.name} | ${total} | ${implemented} | ${inProgress} | ${rate}% |\n`;
  }
  
  const overallRate = totalControls > 0 ? Math.round((totalImplemented / totalControls) * 100) : 0;
  report += `| **Total** | **${totalControls}** | **${totalImplemented}** | - | **${overallRate}%** |\n\n`;
  
  report += `## Detailed Framework Analysis\n\n`;
  
  for (const framework of frameworksResult.rows) {
    report += `### ${framework.name} (${framework.version})\n\n`;
    report += `**Category:** ${framework.category}\n\n`;
    
    // Get control breakdown by priority
    const priorityResult = await client.query(
      `SELECT 
         fc.priority,
         COUNT(*) as total,
         COUNT(CASE WHEN ci.status = 'implemented' THEN 1 END) as implemented
       FROM framework_controls fc
       LEFT JOIN control_implementations ci ON fc.id = ci.control_id 
         AND ci.organization_id = $1
       WHERE fc.framework_id = $2
       GROUP BY fc.priority
       ORDER BY fc.priority`,
      [organizationId, framework.id]
    );
    
    if (priorityResult.rows.length > 0) {
      report += `**Controls by Priority:**\n\n`;
      report += `| Priority | Total | Implemented | Rate |\n`;
      report += `|----------|-------|-------------|------|\n`;
      
      for (const row of priorityResult.rows) {
        const total = parseInt(row.total);
        const implemented = parseInt(row.implemented);
        const rate = total > 0 ? Math.round((implemented / total) * 100) : 0;
        report += `| ${row.priority} | ${total} | ${implemented} | ${rate}% |\n`;
      }
      report += `\n`;
    }
    
    // Get control breakdown by type
    const typeResult = await client.query(
      `SELECT 
         fc.control_type,
         COUNT(*) as total,
         COUNT(CASE WHEN ci.status = 'implemented' THEN 1 END) as implemented
       FROM framework_controls fc
       LEFT JOIN control_implementations ci ON fc.id = ci.control_id 
         AND ci.organization_id = $1
       WHERE fc.framework_id = $2
       GROUP BY fc.control_type
       ORDER BY fc.control_type`,
      [organizationId, framework.id]
    );
    
    if (typeResult.rows.length > 0) {
      report += `**Controls by Type:**\n\n`;
      report += `| Type | Total | Implemented | Rate |\n`;
      report += `|------|-------|-------------|------|\n`;
      
      for (const row of typeResult.rows) {
        const total = parseInt(row.total);
        const implemented = parseInt(row.implemented);
        const rate = total > 0 ? Math.round((implemented / total) * 100) : 0;
        report += `| ${row.control_type} | ${total} | ${implemented} | ${rate}% |\n`;
      }
      report += `\n`;
    }
    
    // Get top priority unimplemented controls
    const unimplementedResult = await client.query(
      `SELECT 
         fc.control_id,
         fc.title,
         fc.priority,
         fc.control_type,
         COALESCE(ci.status, 'not_started') as status
       FROM framework_controls fc
       LEFT JOIN control_implementations ci ON fc.id = ci.control_id 
         AND ci.organization_id = $1
       WHERE fc.framework_id = $2
         AND (ci.status IS NULL OR ci.status != 'implemented')
         AND fc.priority = '1'
       ORDER BY fc.control_id
       LIMIT 5`,
      [organizationId, framework.id]
    );
    
    if (unimplementedResult.rows.length > 0) {
      report += `**Priority 1 Controls Needing Attention:**\n\n`;
      unimplementedResult.rows.forEach((control, idx) => {
        report += `${idx + 1}. **${control.control_id}** - ${control.title}\n`;
        report += `   - Type: ${control.control_type}\n`;
        report += `   - Status: ${control.status}\n\n`;
      });
    }
    
    report += `---\n\n`;
  }
  
  // Recommendations
  report += `## Recommendations\n\n`;
  
  if (overallRate < 50) {
    report += `- **⚠️ Low Compliance:** Focus on implementing Priority 1 controls across all frameworks\n`;
    report += `- Consider applying security baseline: \`node scripts/apply-security-baseline.js\`\n`;
  } else if (overallRate < 80) {
    report += `- **Moderate Compliance:** Continue implementing remaining Priority 1 and 2 controls\n`;
  } else {
    report += `- **✓ Good Compliance:** Maintain current implementation and address remaining gaps\n`;
  }
  
  report += `- Review and update control implementations quarterly\n`;
  report += `- Integrate CM controls into change management processes\n`;
  report += `- Conduct regular CM audits per ISO 10007 and ANSI/EIA-649C requirements\n\n`;
  
  return report;
}

// Generate SAFe-specific agile compliance report
async function generateSAFeComplianceReport(client, organizationId) {
  console.log('Generating SAFe compliance report...');
  
  const safeResult = await client.query(
    `SELECT id FROM frameworks WHERE code = 'safe' LIMIT 1`
  );
  
  if (safeResult.rows.length === 0) {
    return `# SAFe Compliance Report\n\n⚠️ SAFe framework not found.\n\n`;
  }
  
  const frameworkId = safeResult.rows[0].id;
  
  let report = `# SAFe (Scaled Agile Framework) Compliance Report\n\n`;
  report += `**Generated:** ${formatDateTime(new Date())}\n`;
  report += `**Framework:** SAFe 6.0\n`;
  report += `**Organization ID:** ${organizationId}\n\n`;
  
  // Get controls by level
  const levelsResult = await client.query(
    `SELECT 
       CASE 
         WHEN fc.control_id LIKE 'SAFE-PF%' THEN 'Portfolio'
         WHEN fc.control_id LIKE 'SAFE-PG%' THEN 'Program'
         WHEN fc.control_id LIKE 'SAFE-TM%' THEN 'Team'
         WHEN fc.control_id LIKE 'SAFE-CS%' THEN 'Compliance & Security'
         ELSE 'Other'
       END as level,
       COUNT(*) as total,
       COUNT(CASE WHEN ci.status = 'implemented' THEN 1 END) as implemented
     FROM framework_controls fc
     LEFT JOIN control_implementations ci ON fc.id = ci.control_id 
       AND ci.organization_id = $1
     WHERE fc.framework_id = $2
     GROUP BY level
     ORDER BY level`,
    [organizationId, frameworkId]
  );
  
  report += `## SAFe Level Implementation\n\n`;
  report += `| Level | Total Controls | Implemented | Rate |\n`;
  report += `|-------|----------------|-------------|------|\n`;
  
  for (const row of levelsResult.rows) {
    const total = parseInt(row.total);
    const implemented = parseInt(row.implemented);
    const rate = total > 0 ? Math.round((implemented / total) * 100) : 0;
    report += `| ${row.level} | ${total} | ${implemented} | ${rate}% |\n`;
  }
  report += `\n`;
  
  report += `## Key SAFe Practices\n\n`;
  report += `### DevSecOps Integration\n`;
  report += `- Security practices embedded throughout development lifecycle\n`;
  report += `- Automated security checks in CI/CD pipeline\n`;
  report += `- Security champions in cross-functional teams\n\n`;
  
  report += `### Compliance as Code\n`;
  report += `- Automated compliance checks in pipeline\n`;
  report += `- Security enabler features tracked as program features\n`;
  report += `- Release on demand with compliance gates\n\n`;
  
  return report;
}

// Main export function
async function exportCMReports() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(80));
    console.log('CONFIGURATION MANAGEMENT COMPLIANCE REPORTS EXPORT');
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
    
    console.log(`Generating CM compliance reports for ${orgsResult.rows.length} organization(s)...`);
    console.log();
    
    for (const org of orgsResult.rows) {
      console.log(`Processing organization: ${org.name}`);
      console.log('-'.repeat(80));
      
      const orgSlug = org.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const reportDir = path.join(WIKI_CM_REPORTS_DIR, orgSlug);
      
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      // Generate and save CM compliance report
      const cmReport = await generateCMComplianceReport(client, org.id);
      const cmFile = path.join(reportDir, `cm-compliance-${timestamp}.md`);
      fs.writeFileSync(cmFile, cmReport);
      console.log(`  ✓ CM compliance report: ${cmFile}`);
      
      // Generate and save SAFe-specific report
      const safeReport = await generateSAFeComplianceReport(client, org.id);
      const safeFile = path.join(reportDir, `safe-compliance-${timestamp}.md`);
      fs.writeFileSync(safeFile, safeReport);
      console.log(`  ✓ SAFe compliance report: ${safeFile}`);
      
      console.log();
    }
    
    // Create index file
    const indexContent = generateIndexFile(timestamp);
    const indexFile = path.join(WIKI_CM_REPORTS_DIR, 'README.md');
    fs.writeFileSync(indexFile, indexContent);
    console.log(`✓ Created CM reports index: ${indexFile}`);
    console.log();
    
    console.log('='.repeat(80));
    console.log('CM COMPLIANCE REPORTS EXPORT COMPLETE');
    console.log('='.repeat(80));
    console.log();
    console.log(`Reports saved to: ${WIKI_CM_REPORTS_DIR}`);
    console.log();
    
  } catch (error) {
    console.error('Error exporting CM reports:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Generate index file
function generateIndexFile(timestamp) {
  let content = `# Configuration Management Compliance Reports\n\n`;
  content += `**Last Updated:** ${formatDateTime(new Date())}\n\n`;
  
  content += `## Overview\n\n`;
  content += `This directory contains configuration management and agile methodology compliance reports:\n\n`;
  content += `- **CM Compliance** - Overall configuration management framework compliance\n`;
  content += `- **SAFe Compliance** - Scaled Agile Framework implementation status\n\n`;
  
  content += `## Frameworks Covered\n\n`;
  content += `1. **SAFe 6.0** - Scaled Agile Framework for enterprise agility\n`;
  content += `2. **ANSI/EIA-649C** - National consensus standard for configuration management\n`;
  content += `3. **ISO 10007:2017** - Quality management configuration management guidelines\n`;
  content += `4. **NIST SP 800-128** - Security-focused configuration management\n`;
  content += `5. **CIS Controls v8** - Center for Internet Security cybersecurity controls\n\n`;
  
  content += `## Report Generation\n\n`;
  content += `Reports are generated using:\n`;
  content += `\`\`\`bash\n`;
  content += `node scripts/export-cm-reports.js\n`;
  content += `\`\`\`\n\n`;
  
  content += `## Report Structure\n\n`;
  content += `Reports are organized by:\n`;
  content += `- Organization (subdirectories)\n`;
  content += `- Report type (filename prefix)\n`;
  content += `- Date (filename suffix: YYYY-MM-DD)\n\n`;
  
  content += `## Compliance Areas\n\n`;
  content += `### Configuration Management Process\n`;
  content += `- Configuration planning and policy\n`;
  content += `- Configuration identification and baselines\n`;
  content += `- Change control and CCB processes\n`;
  content += `- Status accounting and tracking\n`;
  content += `- Verification and audit procedures\n\n`;
  
  content += `### Agile & DevSecOps\n`;
  content += `- Portfolio, program, and team level practices\n`;
  content += `- Continuous delivery pipeline with security\n`;
  content += `- Built-in quality and compliance\n`;
  content += `- Security enabler features\n\n`;
  
  content += `### Security & Risk Management\n`;
  content += `- NIST 800-53 CM controls (CM-1 through CM-9)\n`;
  content += `- CIS Controls implementation\n`;
  content += `- Security impact analysis\n`;
  content += `- Least functionality principles\n\n`;
  
  return content;
}

// Run the export
if (require.main === module) {
  exportCMReports()
    .then(() => {
      console.log('CM reports export completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('CM reports export failed:', error);
      process.exit(1);
    });
}

module.exports = { exportCMReports };
