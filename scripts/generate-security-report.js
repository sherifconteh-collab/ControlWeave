#!/usr/bin/env node
/**
 * Security Report Generator
 * Consolidates all security scan results into a single HTML report
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    artifactsDir: '.',
    outputFile: 'consolidated-security-report.html'
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--artifacts-dir' && args[i + 1]) {
      config.artifactsDir = args[i + 1];
      i++;
    } else if (args[i] === '--output-file' && args[i + 1]) {
      config.outputFile = args[i + 1];
      i++;
    }
  }
  
  return config;
}

function readJsonFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    console.warn(`Warning: Could not read ${filePath}:`, error.message);
  }
  return null;
}

function findFiles(dir, pattern) {
  const results = [];
  try {
    const files = fs.readdirSync(dir, { recursive: true });
    for (const file of files) {
      if (file.match(pattern)) {
        results.push(path.join(dir, file));
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not search directory ${dir}:`, error.message);
  }
  return results;
}

function generateReport(config) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    },
    sections: []
  };

  // Process CodeQL results
  const codeqlFiles = findFiles(config.artifactsDir, /codeql.*\.sarif$/);
  if (codeqlFiles.length > 0) {
    const codeqlResults = [];
    for (const file of codeqlFiles) {
      const data = readJsonFile(file);
      if (data && data.runs) {
        for (const run of data.runs) {
          if (run.results) {
            codeqlResults.push(...run.results);
            run.results.forEach(result => {
              const level = result.level || 'note';
              if (level === 'error') report.summary.high++;
              else if (level === 'warning') report.summary.medium++;
              else report.summary.low++;
            });
          }
        }
      }
    }
    report.sections.push({
      name: 'CodeQL Analysis',
      type: 'SAST',
      findings: codeqlResults.length,
      details: codeqlResults
    });
  }

  // Process npm audit results
  const auditFiles = findFiles(config.artifactsDir, /.*audit\.json$/);
  if (auditFiles.length > 0) {
    const auditResults = [];
    for (const file of auditFiles) {
      const data = readJsonFile(file);
      if (data && data.vulnerabilities) {
        Object.entries(data.vulnerabilities).forEach(([pkg, vuln]) => {
          auditResults.push({ package: pkg, ...vuln });
          if (vuln.severity === 'critical') report.summary.critical++;
          else if (vuln.severity === 'high') report.summary.high++;
          else if (vuln.severity === 'moderate') report.summary.medium++;
          else report.summary.low++;
        });
      }
    }
    report.sections.push({
      name: 'Dependency Vulnerabilities',
      type: 'SAST',
      findings: auditResults.length,
      details: auditResults
    });
  }

  // Process secrets scan results
  const secretFiles = findFiles(config.artifactsDir, /(gitleaks|trufflehog).*\.json$/);
  if (secretFiles.length > 0) {
    let secretResults = [];
    for (const file of secretFiles) {
      const data = readJsonFile(file);
      if (Array.isArray(data)) {
        secretResults.push(...data);
        data.forEach(() => report.summary.critical++);
      }
    }
    report.sections.push({
      name: 'Secrets Scanning',
      type: 'SAST',
      findings: secretResults.length,
      details: secretResults
    });
  }

  // Process Trivy container scan results
  const trivyFiles = findFiles(config.artifactsDir, /trivy.*\.json$/);
  if (trivyFiles.length > 0) {
    const trivyResults = [];
    for (const file of trivyFiles) {
      const data = readJsonFile(file);
      if (data && data.Results) {
        for (const result of data.Results) {
          if (result.Vulnerabilities) {
            trivyResults.push(...result.Vulnerabilities);
            result.Vulnerabilities.forEach(vuln => {
              const severity = (vuln.Severity || '').toLowerCase();
              if (severity === 'critical') report.summary.critical++;
              else if (severity === 'high') report.summary.high++;
              else if (severity === 'medium') report.summary.medium++;
              else report.summary.low++;
            });
          }
        }
      }
    }
    report.sections.push({
      name: 'Container Vulnerabilities',
      type: 'Container Scan',
      findings: trivyResults.length,
      details: trivyResults
    });
  }

  // Process OWASP ZAP results
  const zapFiles = findFiles(config.artifactsDir, /zap.*\.json$/);
  if (zapFiles.length > 0) {
    const zapResults = [];
    for (const file of zapFiles) {
      const data = readJsonFile(file);
      if (data && data.site) {
        for (const site of data.site) {
          if (site.alerts) {
            zapResults.push(...site.alerts);
            site.alerts.forEach(alert => {
              const risk = (alert.riskdesc || '').toLowerCase();
              if (risk.includes('high')) report.summary.high++;
              else if (risk.includes('medium')) report.summary.medium++;
              else if (risk.includes('low')) report.summary.low++;
              else report.summary.info++;
            });
          }
        }
      }
    }
    report.sections.push({
      name: 'OWASP ZAP Scan',
      type: 'DAST',
      findings: zapResults.length,
      details: zapResults
    });
  }

  return report;
}

function generateHTML(report) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Scan Report - ControlWeave</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #2c3e50;
      margin-bottom: 10px;
      border-bottom: 3px solid #3498db;
      padding-bottom: 10px;
    }
    .timestamp {
      color: #7f8c8d;
      font-size: 0.9em;
      margin-bottom: 30px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 40px;
    }
    .summary-card {
      padding: 20px;
      border-radius: 6px;
      text-align: center;
      color: white;
    }
    .critical { background: #e74c3c; }
    .high { background: #e67e22; }
    .medium { background: #f39c12; }
    .low { background: #3498db; }
    .info { background: #95a5a6; }
    .summary-card h3 { font-size: 2em; margin-bottom: 5px; }
    .summary-card p { font-size: 0.9em; opacity: 0.9; }
    .section {
      margin-bottom: 40px;
      border: 1px solid #ddd;
      border-radius: 6px;
      overflow: hidden;
    }
    .section-header {
      background: #34495e;
      color: white;
      padding: 15px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .section-header h2 { font-size: 1.2em; }
    .badge {
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.9em;
    }
    .section-content {
      padding: 20px;
      max-height: 400px;
      overflow-y: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #ecf0f1;
      font-weight: 600;
    }
    tr:hover {
      background: #f9f9f9;
    }
    .severity-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.8em;
      font-weight: 600;
      color: white;
    }
    .no-findings {
      text-align: center;
      color: #27ae60;
      padding: 40px;
      font-size: 1.1em;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #7f8c8d;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔒 Security Scan Report - ControlWeave</h1>
    <p class="timestamp">Generated: ${new Date(report.timestamp).toLocaleString()}</p>
    
    <div class="summary">
      <div class="summary-card critical">
        <h3>${report.summary.critical}</h3>
        <p>Critical</p>
      </div>
      <div class="summary-card high">
        <h3>${report.summary.high}</h3>
        <p>High</p>
      </div>
      <div class="summary-card medium">
        <h3>${report.summary.medium}</h3>
        <p>Medium</p>
      </div>
      <div class="summary-card low">
        <h3>${report.summary.low}</h3>
        <p>Low</p>
      </div>
      <div class="summary-card info">
        <h3>${report.summary.info}</h3>
        <p>Info</p>
      </div>
    </div>

    ${report.sections.map(section => `
      <div class="section">
        <div class="section-header">
          <h2>${section.name} (${section.type})</h2>
          <span class="badge">${section.findings} findings</span>
        </div>
        <div class="section-content">
          ${section.findings === 0 ? 
            '<p class="no-findings">✅ No vulnerabilities found</p>' :
            '<p><strong>Note:</strong> Review detailed findings in individual scan artifacts. This is a summary view.</p>'
          }
        </div>
      </div>
    `).join('')}

    ${report.sections.length === 0 ? 
      '<div class="no-findings">✅ All security scans completed successfully with no findings</div>' : 
      ''
    }

    <div class="footer">
      <p>This report consolidates results from SAST, DAST, dependency scanning, secrets detection, and container security scans.</p>
      <p>For detailed findings, please review individual scan artifacts in the Azure DevOps pipeline artifacts.</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

function main() {
  try {
    console.log('🔍 Generating consolidated security report...\n');
    
    const config = parseArgs();
    console.log(`Artifacts directory: ${config.artifactsDir}`);
    console.log(`Output file: ${config.outputFile}\n`);
    
    const report = generateReport(config);
    const html = generateHTML(report);
    
    fs.writeFileSync(config.outputFile, html);
    
    console.log('📊 Security Report Summary:');
    console.log(`  Critical: ${report.summary.critical}`);
    console.log(`  High: ${report.summary.high}`);
    console.log(`  Medium: ${report.summary.medium}`);
    console.log(`  Low: ${report.summary.low}`);
    console.log(`  Info: ${report.summary.info}`);
    console.log(`\n✅ Report generated: ${config.outputFile}`);
    
    return 0;
  } catch (error) {
    console.error('❌ Error generating security report:', error.message);
    return 1;
  }
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { generateReport, generateHTML };
