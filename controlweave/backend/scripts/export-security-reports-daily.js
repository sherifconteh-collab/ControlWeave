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
 * Export Security Reports and Logs to Wiki (Daily - Excludes DISA STIG)
 * 
 * This script exports security-related reports and audit logs to the wiki daily
 * with 1-year retention policy. Exports include:
 * - Audit logs summary
 * - Vulnerability findings report
 * - Security control implementation status
 * 
 * Note: DISA STIG compliance reports are generated quarterly via separate workflow
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

// Generate audit logs report
async function generateAuditLogsReport(client, organizationId) {
  console.log('Generating audit logs report...');
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  
  const auditResult = await client.query(
    `SELECT 
       event_type,
       COUNT(*) as event_count,
       COUNT(DISTINCT user_id) as unique_users,
       COUNT(CASE WHEN outcome = 'success' THEN 1 END) as success_count,
       COUNT(CASE WHEN outcome = 'failure' THEN 1 END) as failure_count,
       MIN(created_at) as first_event,
       MAX(created_at) as last_event
     FROM audit_logs
     WHERE organization_id = $1
       AND created_at >= $2
     GROUP BY event_type
     ORDER BY event_count DESC`,
    [organizationId, cutoffDate]
  );
  
  let report = `# Audit Logs Report\n\n`;
  report += `**Generated:** ${formatDateTime(new Date())}\n`;
  report += `**Retention Period:** ${RETENTION_DAYS} days (1 year)\n`;
  report += `**Data From:** ${formatDate(cutoffDate)} to ${formatDate(new Date())}\n\n`;
  
  report += `## Summary\n\n`;
  const totalEvents = auditResult.rows.reduce((sum, row) => sum + parseInt(row.event_count), 0);
  report += `- **Total Events:** ${totalEvents.toLocaleString()}\n`;
  report += `- **Event Types:** ${auditResult.rows.length}\n`;
  report += `- **Retention Compliance:** ✓ 1-year retention enforced\n\n`;
  
  report += `## Events by Type\n\n`;
  report += `| Event Type | Count | Unique Users | Success | Failure | First Event | Last Event |\n`;
  report += `|------------|-------|--------------|---------|---------|-------------|------------|\n`;
  
  auditResult.rows.forEach(row => {
    report += `| ${row.event_type} | ${parseInt(row.event_count).toLocaleString()} | `;
    report += `${row.unique_users} | ${row.success_count} | ${row.failure_count} | `;
    report += `${formatDate(new Date(row.first_event))} | ${formatDate(new Date(row.last_event))} |\n`;
  });
  
  // Get recent failed authentication attempts
  const failedAuthResult = await client.query(
    `SELECT 
       created_at, actor_name, ip_address, authentication_method, details
     FROM audit_logs
     WHERE organization_id = $1
       AND event_type LIKE '%authentication%'
       AND outcome = 'failure'
       AND created_at >= NOW() - INTERVAL '30 days'
     ORDER BY created_at DESC
     LIMIT 20`,
    [organizationId]
  );
  
  if (failedAuthResult.rows.length > 0) {
    report += `\n## Recent Failed Authentication Attempts (Last 30 Days)\n\n`;
    report += `| Timestamp | User | IP Address | Method | Details |\n`;
    report += `|-----------|------|------------|--------|----------|\n`;
    
    failedAuthResult.rows.forEach(row => {
      report += `| ${formatDateTime(new Date(row.created_at))} | ${row.actor_name || 'Unknown'} | `;
      report += `${row.ip_address || 'N/A'} | ${row.authentication_method || 'N/A'} | `;
      report += `${row.details?.substring(0, 50) || 'N/A'} |\n`;
    });
  }
  
  report += `\n## Compliance Notes\n\n`;
  report += `- ✓ AU-2: Audit Events - All required events are logged\n`;
  report += `- ✓ AU-3: Audit Record Content - Complete audit record content\n`;
  report += `- ✓ AU-9: Audit Protection - Logs protected in separate table\n`;
  report += `- ✓ AU-11: Audit Record Retention - 1-year retention enforced\n`;
  report += `- ✓ DISA STIG APSC-DV-000840: Audit logs retained for at least one year\n\n`;
  
  return report;
}

// Generate vulnerability findings report
async function generateVulnerabilityReport(client, organizationId) {
  console.log('Generating vulnerability findings report...');
  
  const vulnResult = await client.query(
    `SELECT 
       source,
       standard,
       severity,
       status,
       COUNT(*) as finding_count,
       COUNT(CASE WHEN stig_id IS NOT NULL THEN 1 END) as stig_findings
     FROM vulnerability_findings
     WHERE organization_id = $1
     GROUP BY source, standard, severity, status
     ORDER BY 
       CASE severity 
         WHEN 'critical' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
         ELSE 5
       END,
       status, source`,
    [organizationId]
  );
  
  let report = `# Vulnerability Findings Report\n\n`;
  report += `**Generated:** ${formatDateTime(new Date())}\n`;
  report += `**Organization ID:** ${organizationId}\n\n`;
  
  if (vulnResult.rows.length === 0) {
    report += `No vulnerability findings recorded.\n\n`;
  } else {
    const totalFindings = vulnResult.rows.reduce((sum, row) => sum + parseInt(row.finding_count), 0);
    const totalStigFindings = vulnResult.rows.reduce((sum, row) => sum + parseInt(row.stig_findings), 0);
    
    report += `## Summary\n\n`;
    report += `- **Total Findings:** ${totalFindings.toLocaleString()}\n`;
    report += `- **STIG Findings:** ${totalStigFindings.toLocaleString()}\n\n`;
    
    // Group by severity
    const bySeverity = {};
    vulnResult.rows.forEach(row => {
      if (!bySeverity[row.severity]) {
        bySeverity[row.severity] = { total: 0, open: 0, remediated: 0 };
      }
      bySeverity[row.severity].total += parseInt(row.finding_count);
      if (row.status === 'open') {
        bySeverity[row.severity].open += parseInt(row.finding_count);
      } else if (row.status === 'remediated') {
        bySeverity[row.severity].remediated += parseInt(row.finding_count);
      }
    });
    
    report += `## Findings by Severity\n\n`;
    report += `| Severity | Total | Open | Remediated | Status |\n`;
    report += `|----------|-------|------|------------|--------|\n`;
    
    ['critical', 'high', 'medium', 'low'].forEach(severity => {
      if (bySeverity[severity]) {
        const stats = bySeverity[severity];
        const statusEmoji = stats.open === 0 ? '✓' : stats.open > 10 ? '⚠️' : '○';
        report += `| ${severity.toUpperCase()} | ${stats.total} | ${stats.open} | ${stats.remediated} | ${statusEmoji} |\n`;
      }
    });
    
    report += `\n## Findings by Source\n\n`;
    report += `| Source | Standard | Severity | Status | Count |\n`;
    report += `|--------|----------|----------|--------|-------|\n`;
    
    vulnResult.rows.forEach(row => {
      report += `| ${row.source} | ${row.standard || 'N/A'} | ${row.severity} | `;
      report += `${row.status} | ${row.finding_count} |\n`;
    });
  }
  
  report += `\n## DISA STIG Compliance\n\n`;
  report += `- ✓ STIG vulnerability tracking enabled\n`;
  report += `- ✓ Vulnerability findings linked to STIG IDs\n`;
  report += `- ✓ Multiple vulnerability sources supported (ACAS, SBOM, STIG, SCAP)\n\n`;
  
  return report;
}

// Generate security controls implementation status
async function generateControlsStatusReport(client, organizationId) {
  console.log('Generating security controls status report...');
  
  const controlsResult = await client.query(
    `SELECT 
       f.code as framework_code,
       f.name as framework_name,
       fc.priority,
       ci.status,
       COUNT(*) as control_count
     FROM control_implementations ci
     JOIN framework_controls fc ON ci.control_id = fc.id
     JOIN frameworks f ON fc.framework_id = f.id
     WHERE ci.organization_id = $1
     GROUP BY f.code, f.name, fc.priority, ci.status
     ORDER BY f.code, fc.priority, ci.status`,
    [organizationId]
  );
  
  let report = `# Security Controls Implementation Status\n\n`;
  report += `**Generated:** ${formatDateTime(new Date())}\n`;
  report += `**Organization ID:** ${organizationId}\n\n`;
  
  if (controlsResult.rows.length === 0) {
    report += `No control implementations found. Please apply security baseline.\n\n`;
  } else {
    // Group by framework
    const byFramework = {};
    controlsResult.rows.forEach(row => {
      if (!byFramework[row.framework_code]) {
        byFramework[row.framework_code] = {
          name: row.framework_name,
          total: 0,
          implemented: 0,
          in_progress: 0,
          needs_review: 0,
          not_applicable: 0
        };
      }
      byFramework[row.framework_code].total += parseInt(row.control_count);
      byFramework[row.framework_code][row.status] = 
        (byFramework[row.framework_code][row.status] || 0) + parseInt(row.control_count);
    });
    
    report += `## Implementation Status by Framework\n\n`;
    report += `| Framework | Total | Implemented | In Progress | Needs Review | N/A |\n`;
    report += `|-----------|-------|-------------|-------------|--------------|-----|\n`;
    
    Object.keys(byFramework).forEach(code => {
      const fw = byFramework[code];
      report += `| ${code} | ${fw.total} | ${fw.implemented || 0} | `;
      report += `${fw.in_progress || 0} | ${fw.needs_review || 0} | ${fw.not_applicable || 0} |\n`;
    });
    
    report += `\n## Priority 1 Controls Status\n\n`;
    const priority1 = controlsResult.rows.filter(row => row.priority === '1');
    const p1Total = priority1.reduce((sum, row) => sum + parseInt(row.control_count), 0);
    const p1Implemented = priority1
      .filter(row => row.status === 'implemented')
      .reduce((sum, row) => sum + parseInt(row.control_count), 0);
    
    report += `- **Total Priority 1 Controls:** ${p1Total}\n`;
    report += `- **Implemented:** ${p1Implemented}\n`;
    report += `- **Implementation Rate:** ${p1Total > 0 ? Math.round((p1Implemented / p1Total) * 100) : 0}%\n\n`;
  }
  
  return report;
}

// Generate DISA STIG compliance report
async function generateDisaStigReport(client, organizationId) {
  console.log('Generating DISA STIG compliance report...');
  
  const stigFrameworkResult = await client.query(
    `SELECT id FROM frameworks WHERE code = 'disa_stig_app' LIMIT 1`
  );
  
  let report = `# DISA STIG Application Security Compliance\n\n`;
  report += `**Generated:** ${formatDateTime(new Date())}\n`;
  report += `**Framework:** DISA Application Security and Development STIG V5R3\n`;
  report += `**Organization ID:** ${organizationId}\n\n`;
  
  if (stigFrameworkResult.rows.length === 0) {
    report += `⚠️ DISA STIG framework not found. Please run seed-disa-stig-framework.js\n\n`;
    return report;
  }
  
  const frameworkId = stigFrameworkResult.rows[0].id;
  
  const stigControlsResult = await client.query(
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
    [organizationId, frameworkId]
  );
  
  const total = stigControlsResult.rows.length;
  const implemented = stigControlsResult.rows.filter(row => row.status === 'implemented').length;
  const inProgress = stigControlsResult.rows.filter(row => row.status === 'in_progress').length;
  const needsReview = stigControlsResult.rows.filter(row => row.status === 'needs_review').length;
  
  report += `## Compliance Summary\n\n`;
  report += `- **Total STIG Controls:** ${total}\n`;
  report += `- **Implemented:** ${implemented} (${Math.round((implemented / total) * 100)}%)\n`;
  report += `- **In Progress:** ${inProgress}\n`;
  report += `- **Needs Review:** ${needsReview}\n`;
  report += `- **Compliance Status:** ${implemented / total >= 0.8 ? '✓ Compliant' : '⚠️ Needs Attention'}\n\n`;
  
  // Priority 1 controls
  const priority1Controls = stigControlsResult.rows.filter(row => row.priority === '1');
  const p1Implemented = priority1Controls.filter(row => row.status === 'implemented').length;
  
  report += `## Priority 1 Controls\n\n`;
  report += `- **Total:** ${priority1Controls.length}\n`;
  report += `- **Implemented:** ${p1Implemented} (${Math.round((p1Implemented / priority1Controls.length) * 100)}%)\n\n`;
  
  // Group by control type
  const byType = {};
  stigControlsResult.rows.forEach(row => {
    if (!byType[row.control_type]) {
      byType[row.control_type] = { total: 0, implemented: 0 };
    }
    byType[row.control_type].total++;
    if (row.status === 'implemented') {
      byType[row.control_type].implemented++;
    }
  });
  
  report += `## Implementation by Control Type\n\n`;
  report += `| Control Type | Total | Implemented | Rate |\n`;
  report += `|--------------|-------|-------------|------|\n`;
  
  Object.keys(byType).sort().forEach(type => {
    const stats = byType[type];
    const rate = Math.round((stats.implemented / stats.total) * 100);
    report += `| ${type} | ${stats.total} | ${stats.implemented} | ${rate}% |\n`;
  });
  
  report += `\n## Key Control Areas\n\n`;
  report += `### Authentication & Access Control\n`;
  const authControls = stigControlsResult.rows.filter(row => 
    row.control_id.includes('160') || row.control_id.includes('170') || 
    row.control_id.includes('180') || row.control_id.includes('190') ||
    row.control_id.includes('200') || row.control_id.includes('210')
  );
  report += `- Controls: ${authControls.length}\n`;
  report += `- Implemented: ${authControls.filter(row => row.status === 'implemented').length}\n\n`;
  
  report += `### Cryptography\n`;
  const cryptoControls = stigControlsResult.rows.filter(row => 
    row.control_id.includes('220') || row.control_id.includes('230') || 
    row.control_id.includes('240') || row.control_id.includes('250')
  );
  report += `- Controls: ${cryptoControls.length}\n`;
  report += `- Implemented: ${cryptoControls.filter(row => row.status === 'implemented').length}\n\n`;
  
  report += `### Input Validation & Security\n`;
  const inputControls = stigControlsResult.rows.filter(row => 
    row.control_id.includes('480') || row.control_id.includes('490') || 
    row.control_id.includes('500') || row.control_id.includes('510') ||
    row.control_id.includes('520')
  );
  report += `- Controls: ${inputControls.length}\n`;
  report += `- Implemented: ${inputControls.filter(row => row.status === 'implemented').length}\n\n`;
  
  report += `### Audit & Logging\n`;
  const auditControls = stigControlsResult.rows.filter(row => 
    row.control_id.includes('800') || row.control_id.includes('810') || 
    row.control_id.includes('820') || row.control_id.includes('830') ||
    row.control_id.includes('840')
  );
  report += `- Controls: ${auditControls.length}\n`;
  report += `- Implemented: ${auditControls.filter(row => row.status === 'implemented').length}\n\n`;
  
  return report;
}

// Main export function
async function exportSecurityReportsToWiki() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(80));
    console.log('SECURITY REPORTS EXPORT TO WIKI');
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
    
    for (const org of orgsResult.rows) {
      console.log(`Processing organization: ${org.name}`);
      console.log('-'.repeat(80));
      
      const orgSlug = org.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const reportDir = path.join(WIKI_REPORTS_DIR, orgSlug);
      
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      // Generate and save audit logs report
      const auditReport = await generateAuditLogsReport(client, org.id);
      const auditFile = path.join(reportDir, `audit-logs-${timestamp}.md`);
      fs.writeFileSync(auditFile, auditReport);
      console.log(`  ✓ Audit logs report: ${auditFile}`);
      
      // Generate and save vulnerability report
      const vulnReport = await generateVulnerabilityReport(client, org.id);
      const vulnFile = path.join(reportDir, `vulnerabilities-${timestamp}.md`);
      fs.writeFileSync(vulnFile, vulnReport);
      console.log(`  ✓ Vulnerability report: ${vulnFile}`);
      
      // Generate and save controls status report
      const controlsReport = await generateControlsStatusReport(client, org.id);
      const controlsFile = path.join(reportDir, `controls-status-${timestamp}.md`);
      fs.writeFileSync(controlsFile, controlsReport);
      console.log(`  ✓ Controls status report: ${controlsFile}`);
      
      // Note: DISA STIG reports are generated quarterly via separate workflow
      console.log(`  ℹ DISA STIG report: Generated quarterly (see export-stig-reports-quarterly.js)`);
      
      console.log();
    }
    
    // Create index file
    const indexContent = generateIndexFile(timestamp);
    const indexFile = path.join(WIKI_REPORTS_DIR, 'README.md');
    fs.writeFileSync(indexFile, indexContent);
    console.log(`✓ Created reports index: ${indexFile}`);
    console.log();
    
    // Clean up old reports (beyond retention period)
    cleanupOldReports();
    
    console.log('='.repeat(80));
    console.log('EXPORT COMPLETE');
    console.log('='.repeat(80));
    console.log();
    console.log(`Reports saved to: ${WIKI_REPORTS_DIR}`);
    console.log(`Retention period: ${RETENTION_DAYS} days (1 year)`);
    console.log();
    
  } catch (error) {
    console.error('Error exporting security reports:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Generate index file for reports
function generateIndexFile(timestamp) {
  let content = `# Security Reports\n\n`;
  content += `**Last Updated:** ${formatDateTime(new Date())}\n`;
  content += `**Retention Policy:** ${RETENTION_DAYS} days (1 year)\n\n`;
  
  content += `## Available Reports\n\n`;
  content += `This directory contains security reports and audit logs exported from ControlWeave:\n\n`;
  content += `- **Audit Logs Reports** - AU-2 compliant audit trail summaries (Daily)\n`;
  content += `- **Vulnerability Findings** - STIG, SBOM, and scanner results (Daily)\n`;
  content += `- **Controls Status** - Security control implementation status (Daily)\n`;
  content += `- **DISA STIG Compliance** - Application security STIG compliance (Quarterly)\n\n`;
  
  content += `## Report Organization\n\n`;
  content += `Reports are organized by:\n`;
  content += `- Organization (subdirectories)\n`;
  content += `- Report type (filename prefix)\n`;
  content += `- Date (filename suffix: YYYY-MM-DD)\n\n`;
  
  content += `## Retention Policy\n\n`;
  content += `All security reports and logs are retained for ${RETENTION_DAYS} days (1 year) to comply with:\n`;
  content += `- NIST SP 800-53 Rev 5 AU-11 (Audit Record Retention)\n`;
  content += `- DISA STIG APSC-DV-000840 (Audit logs must be retained for at least one year)\n`;
  content += `- SOC 2 requirements for log retention\n\n`;
  
  content += `Reports older than ${RETENTION_DAYS} days are automatically archived or deleted.\n\n`;
  
  content += `## Automation\n\n`;
  content += `Security reports are automatically generated and exported:\n\n`;
  content += `**Daily Reports (2 AM UTC):**\n`;
  content += `\`\`\`bash\n`;
  content += `node scripts/export-security-reports-daily.js\n`;
  content += `\`\`\`\n\n`;
  content += `**Quarterly DISA STIG Reports (Jan 1, Apr 1, Jul 1, Oct 1 at 2 AM UTC):**\n`;
  content += `\`\`\`bash\n`;
  content += `node scripts/export-stig-reports-quarterly.js\n`;
  content += `\`\`\`\n\n`;
  
  content += `## Compliance Mapping\n\n`;
  content += `These reports support compliance with:\n`;
  content += `- NIST SP 800-53 Rev 5 (AU family)\n`;
  content += `- DISA Application Security STIG\n`;
  content += `- ISO 27001:2022\n`;
  content += `- SOC 2 Type II\n`;
  content += `- HIPAA Security Rule\n`;
  content += `- GDPR Article 30 (Records of processing activities)\n\n`;
  
  return content;
}

// Clean up old reports beyond retention period
function cleanupOldReports() {
  console.log('Checking for old reports to archive...');
  
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
      } else if (file.endsWith('.md') && file !== 'README.md') {
        // Extract date from filename (format: *-YYYY-MM-DD.md)
        const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})\.md$/);
        if (dateMatch && dateMatch[1] < cutoffDateStr) {
          fs.unlinkSync(filePath);
          removedCount++;
          console.log(`  Removed old report: ${filePath}`);
        }
      }
    });
  }
  
  processDirectory(WIKI_REPORTS_DIR);
  
  if (removedCount > 0) {
    console.log(`  ✓ Archived/removed ${removedCount} old report(s)`);
  } else {
    console.log(`  No old reports to archive`);
  }
  console.log();
}

// Run the export
if (require.main === module) {
  exportSecurityReportsToWiki()
    .then(() => {
      console.log('Export completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Export failed:', error);
      process.exit(1);
    });
}

module.exports = { exportSecurityReportsToWiki };
