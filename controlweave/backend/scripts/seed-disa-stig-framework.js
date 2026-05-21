// @tier: exclude
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

/**
 * DISA STIG Application Security Framework
 * Based on DISA Application Security and Development STIG
 * Version: Version 5, Release 3 (V5R3)
 * 
 * This framework implements security requirements for application development,
 * deployment, and operations aligned with DoD security standards.
 */

const disaStigFramework = {
  code: 'disa_stig_app',
  name: 'DISA Application Security and Development STIG',
  version: 'V5R3',
  category: 'Cybersecurity',
  tier_required: 'community',
  description: 'DoD Application Security Technical Implementation Guide covering secure development, deployment, and operations of applications.',
  controls: [
    // Application Security Posture Management (ASPM)
    { control_id: 'APSC-DV-000010', title: 'Application Security Categorization', priority: '1', control_type: 'strategic',
      description: 'The application must be categorized according to data sensitivity and mission criticality.' },
    { control_id: 'APSC-DV-000020', title: 'Security Requirements Analysis', priority: '1', control_type: 'strategic',
      description: 'Security requirements must be identified and documented in the application design.' },
    { control_id: 'APSC-DV-000030', title: 'Threat Modeling', priority: '1', control_type: 'strategic',
      description: 'Application threat modeling must be performed and documented.' },
    
    // Authentication & Access Control
    { control_id: 'APSC-DV-000160', title: 'Multi-Factor Authentication', priority: '1', control_type: 'technical',
      description: 'The application must implement multi-factor authentication for privileged accounts.' },
    { control_id: 'APSC-DV-000170', title: 'Password Complexity Requirements', priority: '1', control_type: 'technical',
      description: 'The application must enforce password complexity requirements.' },
    { control_id: 'APSC-DV-000180', title: 'Password Minimum Length', priority: '1', control_type: 'technical',
      description: 'The application must enforce minimum password length of 15 characters.' },
    { control_id: 'APSC-DV-000190', title: 'Account Lockout', priority: '1', control_type: 'technical',
      description: 'The application must lock accounts after three consecutive failed login attempts.' },
    { control_id: 'APSC-DV-000200', title: 'Session Management', priority: '1', control_type: 'technical',
      description: 'The application must terminate user sessions after 15 minutes of inactivity.' },
    { control_id: 'APSC-DV-000210', title: 'Least Privilege', priority: '1', control_type: 'technical',
      description: 'The application must enforce least privilege principles for all user roles.' },
    
    // Cryptography
    { control_id: 'APSC-DV-000220', title: 'FIPS 140-2 Validated Cryptography', priority: '1', control_type: 'technical',
      description: 'The application must use FIPS 140-2 validated cryptographic modules.' },
    { control_id: 'APSC-DV-000230', title: 'Encryption for Data at Rest', priority: '1', control_type: 'technical',
      description: 'The application must encrypt sensitive data at rest using FIPS 140-2 approved algorithms.' },
    { control_id: 'APSC-DV-000240', title: 'Encryption for Data in Transit', priority: '1', control_type: 'technical',
      description: 'The application must encrypt data in transit using TLS 1.2 or higher.' },
    { control_id: 'APSC-DV-000250', title: 'Certificate Validation', priority: '1', control_type: 'technical',
      description: 'The application must validate certificates by performing RFC 5280-compliant certification path validation.' },
    
    // Input Validation & Output Encoding
    { control_id: 'APSC-DV-000480', title: 'SQL Injection Prevention', priority: '1', control_type: 'technical',
      description: 'The application must protect against SQL injection attacks.' },
    { control_id: 'APSC-DV-000490', title: 'Cross-Site Scripting (XSS) Prevention', priority: '1', control_type: 'technical',
      description: 'The application must protect against cross-site scripting attacks.' },
    { control_id: 'APSC-DV-000500', title: 'Input Validation', priority: '1', control_type: 'technical',
      description: 'The application must validate all input parameters.' },
    { control_id: 'APSC-DV-000510', title: 'Output Encoding', priority: '1', control_type: 'technical',
      description: 'The application must encode output to prevent injection attacks.' },
    { control_id: 'APSC-DV-000520', title: 'XML External Entity (XXE) Prevention', priority: '1', control_type: 'technical',
      description: 'The application must protect against XML external entity attacks.' },
    
    // Session Management & CSRF Protection
    { control_id: 'APSC-DV-000530', title: 'CSRF Token Protection', priority: '1', control_type: 'technical',
      description: 'The application must protect against cross-site request forgery attacks.' },
    { control_id: 'APSC-DV-000540', title: 'Secure Session Cookies', priority: '1', control_type: 'technical',
      description: 'The application must set the secure flag on session cookies.' },
    { control_id: 'APSC-DV-000550', title: 'HttpOnly Cookie Flag', priority: '1', control_type: 'technical',
      description: 'The application must set the HttpOnly flag on session cookies.' },
    { control_id: 'APSC-DV-000560', title: 'Session ID Regeneration', priority: '1', control_type: 'technical',
      description: 'The application must regenerate session IDs upon authentication.' },
    
    // Audit & Logging (AU-2 Compliance)
    { control_id: 'APSC-DV-000800', title: 'Audit Log Generation', priority: '1', control_type: 'technical',
      description: 'The application must generate audit records for security-relevant events.' },
    { control_id: 'APSC-DV-000810', title: 'Audit Record Content', priority: '1', control_type: 'technical',
      description: 'Audit records must contain date, time, source, outcome, identity, and event type.' },
    { control_id: 'APSC-DV-000820', title: 'Audit Log Protection', priority: '1', control_type: 'technical',
      description: 'The application must protect audit logs from unauthorized access and modification.' },
    { control_id: 'APSC-DV-000830', title: 'Audit Log Review', priority: '2', control_type: 'organizational',
      description: 'Audit logs must be reviewed regularly for security events.' },
    { control_id: 'APSC-DV-000840', title: 'Audit Log Retention', priority: '1', control_type: 'organizational',
      description: 'Audit logs must be retained for at least one year.' },
    
    // Error Handling & Logging
    { control_id: 'APSC-DV-001460', title: 'Error Handling', priority: '1', control_type: 'technical',
      description: 'The application must not expose sensitive information in error messages.' },
    { control_id: 'APSC-DV-001470', title: 'Stack Trace Protection', priority: '1', control_type: 'technical',
      description: 'The application must not display stack traces to users.' },
    { control_id: 'APSC-DV-001480', title: 'Security Event Logging', priority: '1', control_type: 'technical',
      description: 'The application must log all authentication and authorization events.' },
    
    // Security Testing & Code Review
    { control_id: 'APSC-DV-001620', title: 'Static Application Security Testing (SAST)', priority: '1', control_type: 'technical',
      description: 'The application must undergo static application security testing.' },
    { control_id: 'APSC-DV-001630', title: 'Dynamic Application Security Testing (DAST)', priority: '1', control_type: 'technical',
      description: 'The application must undergo dynamic application security testing.' },
    { control_id: 'APSC-DV-001640', title: 'Security Code Review', priority: '1', control_type: 'organizational',
      description: 'Security-focused code reviews must be conducted for all changes.' },
    { control_id: 'APSC-DV-001650', title: 'Vulnerability Remediation', priority: '1', control_type: 'organizational',
      description: 'Identified vulnerabilities must be remediated according to severity timelines.' },
    
    // Configuration Management
    { control_id: 'APSC-DV-002010', title: 'Secure Configuration Baseline', priority: '1', control_type: 'technical',
      description: 'The application must implement and maintain a secure configuration baseline.' },
    { control_id: 'APSC-DV-002020', title: 'Default Credentials Removal', priority: '1', control_type: 'technical',
      description: 'Default accounts and credentials must be removed or changed.' },
    { control_id: 'APSC-DV-002030', title: 'Unnecessary Services Disabled', priority: '2', control_type: 'technical',
      description: 'Unnecessary services and features must be disabled.' },
    { control_id: 'APSC-DV-002040', title: 'Security Headers', priority: '1', control_type: 'technical',
      description: 'The application must implement security headers (CSP, X-Frame-Options, etc.).' },
    
    // API Security
    { control_id: 'APSC-DV-002530', title: 'API Authentication', priority: '1', control_type: 'technical',
      description: 'APIs must require authentication for all requests.' },
    { control_id: 'APSC-DV-002540', title: 'API Rate Limiting', priority: '1', control_type: 'technical',
      description: 'APIs must implement rate limiting to prevent abuse.' },
    { control_id: 'APSC-DV-002550', title: 'API Input Validation', priority: '1', control_type: 'technical',
      description: 'APIs must validate all input parameters.' },
    { control_id: 'APSC-DV-002560', title: 'API Error Messages', priority: '1', control_type: 'technical',
      description: 'API error messages must not expose sensitive information.' },
    
    // Mobile Application Security (if applicable)
    { control_id: 'APSC-DV-002570', title: 'Mobile Data Storage Security', priority: '2', control_type: 'technical',
      description: 'Mobile applications must securely store sensitive data.' },
    { control_id: 'APSC-DV-002580', title: 'Mobile Certificate Pinning', priority: '2', control_type: 'technical',
      description: 'Mobile applications must implement certificate pinning.' },
    
    // Container & Cloud Security
    { control_id: 'APSC-DV-002960', title: 'Container Image Scanning', priority: '1', control_type: 'technical',
      description: 'Container images must be scanned for vulnerabilities.' },
    { control_id: 'APSC-DV-002970', title: 'Container Runtime Security', priority: '1', control_type: 'technical',
      description: 'Container runtime environments must implement security controls.' },
    { control_id: 'APSC-DV-002980', title: 'Secrets Management', priority: '1', control_type: 'technical',
      description: 'Application secrets must be stored in secure vaults, not in code.' },
    
    // Supply Chain Security
    { control_id: 'APSC-DV-003100', title: 'Software Bill of Materials (SBOM)', priority: '1', control_type: 'organizational',
      description: 'The application must maintain a Software Bill of Materials.' },
    { control_id: 'APSC-DV-003110', title: 'Third-Party Component Scanning', priority: '1', control_type: 'technical',
      description: 'Third-party components must be scanned for known vulnerabilities.' },
    { control_id: 'APSC-DV-003120', title: 'Dependency Version Control', priority: '1', control_type: 'technical',
      description: 'All application dependencies must be pinned to specific versions.' },
    { control_id: 'APSC-DV-003130', title: 'License Compliance', priority: '2', control_type: 'organizational',
      description: 'All third-party components must be reviewed for license compliance.' },
    
    // Incident Response & Continuity
    { control_id: 'APSC-DV-003140', title: 'Incident Response Plan', priority: '1', control_type: 'organizational',
      description: 'An application-specific incident response plan must be maintained.' },
    { control_id: 'APSC-DV-003150', title: 'Backup & Recovery', priority: '1', control_type: 'technical',
      description: 'Application data must be backed up and recovery procedures tested.' },
    { control_id: 'APSC-DV-003160', title: 'Disaster Recovery Testing', priority: '2', control_type: 'organizational',
      description: 'Disaster recovery procedures must be tested annually.' },
    
    // Privacy Controls
    { control_id: 'APSC-DV-003170', title: 'Personally Identifiable Information (PII) Protection', priority: '1', control_type: 'technical',
      description: 'The application must protect PII according to applicable regulations.' },
    { control_id: 'APSC-DV-003180', title: 'Data Minimization', priority: '2', control_type: 'organizational',
      description: 'The application must collect only the minimum necessary data.' },
    { control_id: 'APSC-DV-003190', title: 'Privacy Notice', priority: '2', control_type: 'policy',
      description: 'The application must provide users with a privacy notice.' },
    
    // Monitoring & Alerting
    { control_id: 'APSC-DV-003200', title: 'Security Monitoring', priority: '1', control_type: 'technical',
      description: 'The application must be monitored for security events.' },
    { control_id: 'APSC-DV-003210', title: 'Anomaly Detection', priority: '2', control_type: 'technical',
      description: 'Anomaly detection must be implemented for suspicious behavior.' },
    { control_id: 'APSC-DV-003220', title: 'Security Alerting', priority: '1', control_type: 'technical',
      description: 'Security alerts must be generated for critical events.' },
    { control_id: 'APSC-DV-003230', title: 'SIEM Integration', priority: '1', control_type: 'technical',
      description: 'The application must integrate with organizational SIEM systems.' }
  ]
};

async function seedDisaStigFramework() {
  const client = await pool.connect();
  try {
    console.log('Starting DISA STIG Application Security framework seeding...');
    
    await client.query('BEGIN');
    
    // Check if framework already exists
    const existingFramework = await client.query(
      'SELECT id FROM frameworks WHERE code = $1',
      [disaStigFramework.code]
    );
    
    let frameworkId;
    if (existingFramework.rows.length > 0) {
      frameworkId = existingFramework.rows[0].id;
      console.log(`Framework ${disaStigFramework.code} already exists with ID ${frameworkId}`);
      
      // Delete existing controls
      await client.query(
        'DELETE FROM framework_controls WHERE framework_id = $1',
        [frameworkId]
      );
      console.log('Deleted existing controls');
    } else {
      // Insert framework
      const frameworkResult = await client.query(
        `INSERT INTO frameworks (code, name, version, category, tier_required, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          disaStigFramework.code,
          disaStigFramework.name,
          disaStigFramework.version,
          disaStigFramework.category,
          disaStigFramework.tier_required,
          disaStigFramework.description
        ]
      );
      frameworkId = frameworkResult.rows[0].id;
      console.log(`Created framework ${disaStigFramework.code} with ID ${frameworkId}`);
    }
    
    // Insert controls
    console.log(`Inserting ${disaStigFramework.controls.length} controls...`);
    let insertedCount = 0;
    
    for (const control of disaStigFramework.controls) {
      await client.query(
        `INSERT INTO framework_controls 
         (framework_id, control_id, title, priority, control_type, description)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          frameworkId,
          control.control_id,
          control.title,
          control.priority,
          control.control_type,
          control.description || null
        ]
      );
      insertedCount++;
    }
    
    console.log(`Inserted ${insertedCount} controls for DISA STIG framework`);
    
    await client.query('COMMIT');
    console.log('DISA STIG Application Security framework seeding completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding DISA STIG framework:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeding
if (require.main === module) {
  seedDisaStigFramework()
    .then(() => {
      console.log('Seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDisaStigFramework, disaStigFramework };
