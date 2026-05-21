#!/usr/bin/env node
/**
 * Vulnerability Review Tracker
 * 
 * Analyzes security scan results and flags vulnerabilities for review.
 * Creates GitHub issues for medium+ severity findings.
 * 
 * Severity Levels:
 * - CRITICAL: Immediate action required, blocks merge
 * - HIGH: Review required, blocks merge
 * - MEDIUM: Review required, flags for attention
 * - LOW: Informational, no action required
 */

const fs = require('fs');
const path = require('path');

const SEVERITY_LEVELS = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INFO: 0
};

const REVIEW_THRESHOLD = SEVERITY_LEVELS.MEDIUM; // Medium and above needs review

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    artifactsDir: process.env.ARTIFACTS_DIR || '.',
    outputFile: process.env.OUTPUT_FILE || 'vulnerability-review.json',
    githubOutput: process.env.GITHUB_OUTPUT || null,
    failOnSeverity: process.env.FAIL_ON_SEVERITY || 'high', // high or critical
    createIssues: process.env.CREATE_GITHUB_ISSUES === 'true',
    suppressionsFile: process.env.SUPPRESSIONS_FILE || null
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--artifacts-dir' && args[i + 1]) {
      config.artifactsDir = args[i + 1];
      i++;
    } else if (args[i] === '--output-file' && args[i + 1]) {
      config.outputFile = args[i + 1];
      i++;
    } else if (args[i] === '--fail-on' && args[i + 1]) {
      config.failOnSeverity = args[i + 1].toLowerCase();
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
    if (!fs.existsSync(dir)) return results;
    
    function searchDir(currentDir) {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          searchDir(fullPath);
        } else if (entry.isFile() && entry.name.match(pattern)) {
          results.push(fullPath);
        }
      }
    }
    
    searchDir(dir);
  } catch (error) {
    console.warn(`Warning: Could not search directory ${dir}:`, error.message);
  }
  return results;
}

function normalizeSeverity(severity) {
  if (!severity) return 'INFO';
  const s = severity.toUpperCase();
  if (s.includes('CRITICAL')) return 'CRITICAL';
  if (s.includes('HIGH')) return 'HIGH';
  if (s.includes('MEDIUM') || s.includes('MODERATE')) return 'MEDIUM';
  if (s.includes('LOW')) return 'LOW';
  return 'INFO';
}

function loadSuppressions(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.suppressions)) return raw.suppressions;
  } catch (error) {
    console.warn(`Warning: Could not read suppressions file ${filePath}:`, error.message);
  }
  return [];
}

function isSuppressionExpired(suppression) {
  if (!suppression.expiresAt) return false;
  const expiresAt = new Date(suppression.expiresAt);
  return Number.isNaN(expiresAt.getTime()) ? false : expiresAt.getTime() < Date.now();
}

function matchesSuppression(finding, suppression) {
  if (isSuppressionExpired(suppression)) return false;
  if (suppression.source && suppression.source !== finding.source) return false;
  if (suppression.type && suppression.type !== finding.type) return false;
  if (suppression.severity && normalizeSeverity(suppression.severity) !== finding.severity) return false;

  if (suppression.package) {
    const findingPackage = finding.package || finding.pkgName;
    if (!findingPackage || findingPackage !== suppression.package) return false;
  }

  if (suppression.ruleId && finding.ruleId !== suppression.ruleId) return false;
  if (suppression.vulnerabilityID && finding.vulnerabilityID !== suppression.vulnerabilityID) return false;

  return true;
}

function getMatchingSuppression(finding, suppressions) {
  return suppressions.find(suppression => matchesSuppression(finding, suppression)) || null;
}

function registerFinding(findings, finding, suppressions) {
  const severityKey = finding.severity.toLowerCase();
  if (typeof findings.summary[severityKey] === 'number') {
    findings.summary[severityKey]++;
  }
  findings.vulnerabilities.push(finding);

  const needsReview = finding.severityLevel >= REVIEW_THRESHOLD;
  const suppression = needsReview ? getMatchingSuppression(finding, suppressions) : null;
  const isRiskAccepted = Boolean(suppression);

  if (needsReview) {
    if (isRiskAccepted) {
      findings.summary.accepted++;
      findings.acceptedRisks.push({
        ...finding,
        suppression: {
          reason: suppression.reason || 'Risk accepted',
          issueNumber: suppression.issueNumber || null,
          acceptedAt: suppression.acceptedAt || null,
          expiresAt: suppression.expiresAt || null
        }
      });
    } else {
      findings.summary.needsReview++;
      findings.reviewRequired.push(finding);
    }
  }

  if ((finding.severity === 'CRITICAL' || finding.severity === 'HIGH') && !isRiskAccepted) {
    findings.summary.blocksDeployment++;
  }
}

function analyzeVulnerabilities(config) {
  const suppressions = loadSuppressions(config.suppressionsFile);
  const findings = {
    timestamp: new Date().toISOString(),
    summary: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      needsReview: 0,
      accepted: 0,
      blocksDeployment: 0
    },
    vulnerabilities: [],
    reviewRequired: [],
    acceptedRisks: []
  };

  // Process npm audit results
  const auditFiles = findFiles(config.artifactsDir, /.*audit\.json$/);
  for (const file of auditFiles) {
    const data = readJsonFile(file);
    if (data && data.vulnerabilities) {
      Object.entries(data.vulnerabilities).forEach(([pkg, vuln]) => {
        const severity = normalizeSeverity(vuln.severity);
        const severityLevel = SEVERITY_LEVELS[severity] || 0;
        
        const finding = {
          source: 'npm-audit',
          type: 'dependency',
          package: pkg,
          severity: severity,
          severityLevel: severityLevel,
          via: vuln.via,
          range: vuln.range,
          nodes: vuln.nodes,
          fixAvailable: vuln.fixAvailable,
          file: path.basename(file)
        };
        
        registerFinding(findings, finding, suppressions);
      });
    }
  }

  // Process CodeQL SARIF results
  const codeqlFiles = findFiles(config.artifactsDir, /codeql.*\.sarif$/);
  for (const file of codeqlFiles) {
    const data = readJsonFile(file);
    if (data && data.runs) {
      for (const run of data.runs) {
        if (run.results) {
          run.results.forEach(result => {
            const level = result.level || 'note';
            let severity = 'INFO';
            if (level === 'error') severity = 'HIGH';
            else if (level === 'warning') severity = 'MEDIUM';
            else severity = 'LOW';
            
            const severityLevel = SEVERITY_LEVELS[severity] || 0;
            const finding = {
              source: 'codeql',
              type: 'code-security',
              ruleId: result.ruleId,
              severity: severity,
              severityLevel: severityLevel,
              message: result.message?.text || 'No message',
              locations: result.locations,
              file: path.basename(file)
            };
            
            registerFinding(findings, finding, suppressions);
          });
        }
      }
    }
  }

  // Process Trivy container scan results
  const trivyFiles = findFiles(config.artifactsDir, /trivy.*\.json$/);
  for (const file of trivyFiles) {
    const data = readJsonFile(file);
    if (data && data.Results) {
      for (const result of data.Results) {
        if (result.Vulnerabilities) {
          result.Vulnerabilities.forEach(vuln => {
            const severity = normalizeSeverity(vuln.Severity);
            const severityLevel = SEVERITY_LEVELS[severity] || 0;
            const finding = {
              source: 'trivy',
              type: 'container',
              vulnerabilityID: vuln.VulnerabilityID,
              pkgName: vuln.PkgName,
              installedVersion: vuln.InstalledVersion,
              fixedVersion: vuln.FixedVersion,
              severity: severity,
              severityLevel: severityLevel,
              title: vuln.Title,
              description: vuln.Description,
              file: path.basename(file)
            };
            
            registerFinding(findings, finding, suppressions);
          });
        }
      }
    }
  }

  // Process secrets scan results
  const secretFiles = findFiles(config.artifactsDir, /(gitleaks|trufflehog).*\.json$/);
  for (const file of secretFiles) {
    const data = readJsonFile(file);
    if (Array.isArray(data) && data.length > 0) {
      data.forEach(secret => {
        const finding = {
          source: 'secrets-scan',
          type: 'secrets',
          severity: 'CRITICAL',
          severityLevel: SEVERITY_LEVELS.CRITICAL,
          description: 'Secret detected in code',
          file: secret.File || secret.file || 'unknown',
          line: secret.StartLine || secret.line,
          ruleId: secret.RuleID || secret.rule
        };
        
        registerFinding(findings, finding, suppressions);
      });
    }
  }

  return findings;
}

function generateReviewReport(findings) {
  let report = '# Vulnerability Review Report\n\n';
  report += `Generated: ${new Date(findings.timestamp).toLocaleString()}\n\n`;
  
  report += '## Summary\n\n';
  report += `| Severity | Count | Action Required |\n`;
  report += `|----------|-------|----------------|\n`;
  report += `| 🔴 Critical | ${findings.summary.critical} | Immediate review and fix |\n`;
  report += `| 🟠 High | ${findings.summary.high} | Review and fix before merge |\n`;
  report += `| 🟡 Medium | ${findings.summary.medium} | Review and document |\n`;
  report += `| 🔵 Low | ${findings.summary.low} | Informational |\n`;
  report += `| ⚪ Info | ${findings.summary.info} | No action required |\n\n`;
  
  report += `**Findings Requiring Review:** ${findings.summary.needsReview}\n`;
  report += `**Risk Accepted (Suppressed):** ${findings.summary.accepted || 0}\n`;
  report += `**Findings Blocking Deployment:** ${findings.summary.blocksDeployment}\n\n`;
  
  if (findings.reviewRequired.length > 0) {
    report += '## 🚨 Vulnerabilities Requiring Review (Medium+)\n\n';
    
    const bySeverity = {};
    findings.reviewRequired.forEach(f => {
      if (!bySeverity[f.severity]) bySeverity[f.severity] = [];
      bySeverity[f.severity].push(f);
    });
    
    ['CRITICAL', 'HIGH', 'MEDIUM'].forEach(severity => {
      if (bySeverity[severity] && bySeverity[severity].length > 0) {
        report += `### ${severity} Severity (${bySeverity[severity].length})\n\n`;
        
        bySeverity[severity].forEach((finding, idx) => {
          report += `#### ${idx + 1}. ${finding.type.toUpperCase()} - ${finding.source}\n\n`;
          
          if (finding.package) {
            report += `- **Package:** ${finding.package}\n`;
            if (finding.range) report += `- **Affected Versions:** ${finding.range}\n`;
            if (finding.fixAvailable) {
              report += `- **Fix Available:** ${typeof finding.fixAvailable === 'object' ? 'Yes' : finding.fixAvailable}\n`;
            }
          }
          
          if (finding.vulnerabilityID) {
            report += `- **CVE:** ${finding.vulnerabilityID}\n`;
            report += `- **Package:** ${finding.pkgName} (${finding.installedVersion})\n`;
            if (finding.fixedVersion) report += `- **Fixed In:** ${finding.fixedVersion}\n`;
            if (finding.title) report += `- **Title:** ${finding.title}\n`;
          }
          
          if (finding.ruleId) {
            report += `- **Rule:** ${finding.ruleId}\n`;
          }
          
          if (finding.message) {
            report += `- **Message:** ${finding.message}\n`;
          }
          
          if (finding.description) {
            report += `- **Description:** ${finding.description.substring(0, 200)}...\n`;
          }
          
          report += `- **Source:** ${finding.file}\n`;
          report += `- **Action Required:** Review and document mitigation or fix\n\n`;
        });
      }
    });
    
    report += '\n## Review Process\n\n';
    report += '1. Review each vulnerability listed above\n';
    report += '2. For each finding, choose one of:\n';
    report += '   - **Fix:** Update dependency or patch code\n';
    report += '   - **Mitigate:** Implement compensating controls\n';
    report += '   - **Accept:** Document risk acceptance with justification\n';
    report += '   - **False Positive:** Document why this is not a real vulnerability\n';
    report += '3. Document decision in GitHub issue or PR comments\n';
    report += '4. For accepted risks, create tracking issue with expiration date\n\n';
  } else {
    report += '## ✅ No Vulnerabilities Requiring Review\n\n';
    report += 'All findings are low severity or informational only.\n\n';
  }

  if ((findings.summary.accepted || 0) > 0) {
    report += '## ✅ Risk-Accepted Vulnerabilities (Suppressed)\n\n';
    findings.acceptedRisks.forEach((finding, idx) => {
      report += `### ${idx + 1}. ${finding.type.toUpperCase()} - ${finding.source}\n\n`;
      if (finding.package || finding.pkgName) {
        report += `- **Package:** ${finding.package || finding.pkgName}\n`;
      }
      if (finding.vulnerabilityID) {
        report += `- **CVE:** ${finding.vulnerabilityID}\n`;
      }
      if (finding.ruleId) {
        report += `- **Rule:** ${finding.ruleId}\n`;
      }
      report += `- **Severity:** ${finding.severity}\n`;
      report += `- **Risk Acceptance Reason:** ${finding.suppression?.reason || 'Risk accepted'}\n`;
      if (finding.suppression?.issueNumber) {
        report += `- **Accepted Via Issue:** #${finding.suppression.issueNumber}\n`;
      }
      if (finding.suppression?.expiresAt) {
        report += `- **Expires:** ${finding.suppression.expiresAt}\n`;
      }
      report += '\n';
    });
  }
  
  return report;
}

function generateGitHubIssueBody(finding) {
  let body = `## 🚨 Security Vulnerability Detected\n\n`;
  body += `**Severity:** ${finding.severity}\n`;
  body += `**Type:** ${finding.type}\n`;
  body += `**Source:** ${finding.source}\n`;
  body += `**Detected:** ${new Date().toISOString()}\n\n`;
  
  body += `### Details\n\n`;
  
  if (finding.package) {
    body += `- **Package:** \`${finding.package}\`\n`;
    body += `- **Affected Versions:** ${finding.range || 'Unknown'}\n`;
    if (finding.fixAvailable) {
      body += `- **Fix Available:** Yes\n`;
    }
  }
  
  if (finding.vulnerabilityID) {
    body += `- **CVE:** ${finding.vulnerabilityID}\n`;
    body += `- **Package:** \`${finding.pkgName}\` (${finding.installedVersion})\n`;
    if (finding.fixedVersion) {
      body += `- **Fixed Version:** ${finding.fixedVersion}\n`;
    }
    if (finding.title) {
      body += `- **Title:** ${finding.title}\n`;
    }
  }
  
  if (finding.ruleId) {
    body += `- **Rule ID:** ${finding.ruleId}\n`;
  }
  
  if (finding.message) {
    body += `\n**Message:** ${finding.message}\n`;
  }
  
  if (finding.description) {
    body += `\n**Description:**\n${finding.description}\n`;
  }
  
  body += `\n### Required Actions\n\n`;
  body += `- [ ] Review vulnerability details\n`;
  body += `- [ ] Assess impact on ControlWeave\n`;
  body += `- [ ] Choose mitigation strategy:\n`;
  body += `  - [ ] Fix (update dependency or patch code)\n`;
  body += `  - [ ] Mitigate (implement compensating controls)\n`;
  body += `  - [ ] Accept (document risk acceptance)\n`;
  body += `  - [ ] False Positive (document why)\n`;
  body += `- [ ] Document decision in this issue\n`;
  body += `- [ ] Implement chosen mitigation\n`;
  body += `- [ ] Verify fix in next CI/CD run\n\n`;
  
  body += `### NIST 800-160 Reference\n\n`;
  body += `This vulnerability was detected as part of continuous security verification per NIST 800-160.\n`;
  body += `All findings medium severity and above require documented review and mitigation.\n\n`;
  
  body += `---\n`;
  body += `*Auto-generated by ControlWeave CI/CD Pipeline*\n`;
  
  return body;
}

function main() {
  const config = parseArgs();
  
  console.log('🔍 Analyzing vulnerabilities for review...\n');
  console.log(`Artifacts directory: ${config.artifactsDir}`);
  console.log(`Review threshold: MEDIUM and above`);
  console.log(`Fail threshold: ${config.failOnSeverity.toUpperCase()}\n`);
  
  const findings = analyzeVulnerabilities(config);
  
  // Write findings to JSON
  fs.writeFileSync(config.outputFile, JSON.stringify(findings, null, 2));
  console.log(`✅ Vulnerability analysis saved: ${config.outputFile}`);
  
  // Generate review report
  const report = generateReviewReport(findings);
  const reportPath = config.outputFile.replace('.json', '.md');
  fs.writeFileSync(reportPath, report);
  console.log(`✅ Review report generated: ${reportPath}`);
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('VULNERABILITY SUMMARY');
  console.log('='.repeat(80));
  console.log(`Critical:  ${findings.summary.critical}`);
  console.log(`High:      ${findings.summary.high}`);
  console.log(`Medium:    ${findings.summary.medium}`);
  console.log(`Low:       ${findings.summary.low}`);
  console.log(`Info:      ${findings.summary.info}`);
  console.log(`\nRequiring Review: ${findings.summary.needsReview}`);
  console.log(`Risk Accepted: ${findings.summary.accepted || 0}`);
  console.log(`Blocking Deployment: ${findings.summary.blocksDeployment}`);
  console.log('='.repeat(80) + '\n');
  
  // Set GitHub Action outputs
  if (config.githubOutput) {
    const outputs = [
      `needs_review=${findings.summary.needsReview}`,
      `accepted=${findings.summary.accepted || 0}`,
      `blocks_deployment=${findings.summary.blocksDeployment}`,
      `critical=${findings.summary.critical}`,
      `high=${findings.summary.high}`,
      `medium=${findings.summary.medium}`,
      `low=${findings.summary.low}`
    ];
    fs.appendFileSync(config.githubOutput, outputs.join('\n') + '\n');
  }
  
  // Generate GitHub issue data if requested
  if (config.createIssues && findings.reviewRequired.length > 0) {
    const issuesData = findings.reviewRequired.map(finding => ({
      title: `[Security] ${finding.severity} - ${finding.type} vulnerability in ${finding.package || finding.ruleId || 'code'}`,
      body: generateGitHubIssueBody(finding),
      labels: ['security', 'vulnerability', `severity:${finding.severity.toLowerCase()}`, 'needs-review']
    }));
    
    fs.writeFileSync('github-issues.json', JSON.stringify(issuesData, null, 2));
    console.log(`✅ GitHub issue data generated: github-issues.json`);
  }
  
  // Determine exit code based on fail threshold
  const failThreshold = SEVERITY_LEVELS[config.failOnSeverity.toUpperCase()] || SEVERITY_LEVELS.HIGH;
  let shouldFail = false;
  
  if (failThreshold <= SEVERITY_LEVELS.CRITICAL && findings.summary.critical > 0) {
    shouldFail = true;
    console.error('❌ CRITICAL vulnerabilities found - failing build');
  } else if (failThreshold <= SEVERITY_LEVELS.HIGH && findings.summary.high > 0) {
    shouldFail = true;
    console.error('❌ HIGH vulnerabilities found - failing build');
  } else if (failThreshold <= SEVERITY_LEVELS.MEDIUM && findings.summary.medium > 0) {
    shouldFail = true;
    console.error('⚠️  MEDIUM vulnerabilities found - flagged for review');
  }
  
  if (findings.summary.needsReview > 0) {
    console.warn(`\n⚠️  ${findings.summary.needsReview} vulnerabilities require review`);
    console.warn('Review report: ' + reportPath);
  }
  
  return shouldFail ? 1 : 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { analyzeVulnerabilities, generateReviewReport };
