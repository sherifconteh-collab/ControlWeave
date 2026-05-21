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
 * Configuration Management and Agile Frameworks
 * 
 * This script seeds advanced configuration management and agile methodology frameworks:
 * - SAFe (Scaled Agile Framework)
 * - ANSI/EIA-649C (Configuration Management Standard)
 * - ISO 10007 (Quality Management - Configuration Management Guidelines)
 * - NIST SP 800-128 (Security-Focused Configuration Management)
 * - CIS Controls (Center for Internet Security)
 */

const configManagementFrameworks = [
  {
    code: 'safe', 
    name: 'SAFe (Scaled Agile Framework)', 
    version: '6.0',
    category: 'Agile & DevOps', 
    tier_required: 'pro',
    description: 'Enterprise-scale agile framework integrating agile, lean, and DevOps practices with built-in security and compliance.',
    controls: [
      // Portfolio Level
      { control_id: 'SAFE-PF-1', title: 'Strategic Themes & Portfolio Vision', priority: '1', control_type: 'strategic', 
        description: 'Define strategic themes aligned to enterprise strategy and compliance objectives.' },
      { control_id: 'SAFE-PF-2', title: 'Portfolio Kanban & Governance', priority: '1', control_type: 'organizational',
        description: 'Implement portfolio Kanban with compliance gates and governance reviews.' },
      { control_id: 'SAFE-PF-3', title: 'Epic Hypothesis & Lean Business Case', priority: '2', control_type: 'strategic',
        description: 'Develop lean business cases with security and compliance considerations.' },
      
      // Program Level
      { control_id: 'SAFE-PG-1', title: 'Agile Release Train (ART) Configuration', priority: '1', control_type: 'organizational',
        description: 'Establish ART with defined roles, ceremonies, and compliance touchpoints.' },
      { control_id: 'SAFE-PG-2', title: 'Program Increment (PI) Planning', priority: '1', control_type: 'organizational',
        description: 'Conduct PI planning with security objectives and compliance goals.' },
      { control_id: 'SAFE-PG-3', title: 'Continuous Delivery Pipeline', priority: '1', control_type: 'technical',
        description: 'Implement CI/CD pipeline with automated security and compliance checks.' },
      { control_id: 'SAFE-PG-4', title: 'DevSecOps Integration', priority: '1', control_type: 'technical',
        description: 'Embed security practices throughout development lifecycle.' },
      
      // Team Level
      { control_id: 'SAFE-TM-1', title: 'Cross-Functional Agile Teams', priority: '1', control_type: 'organizational',
        description: 'Form cross-functional teams with security champions.' },
      { control_id: 'SAFE-TM-2', title: 'Sprint Planning & Execution', priority: '2', control_type: 'organizational',
        description: 'Execute sprints with security stories and compliance tasks.' },
      { control_id: 'SAFE-TM-3', title: 'Built-In Quality', priority: '1', control_type: 'technical',
        description: 'Implement practices for built-in quality including security testing.' },
      
      // Compliance & Security
      { control_id: 'SAFE-CS-1', title: 'Compliance as Code', priority: '1', control_type: 'technical',
        description: 'Automate compliance checks in CI/CD pipeline.' },
      { control_id: 'SAFE-CS-2', title: 'Security Enabler Features', priority: '1', control_type: 'technical',
        description: 'Define and track security enablers as program features.' },
      { control_id: 'SAFE-CS-3', title: 'Release on Demand with Compliance', priority: '2', control_type: 'organizational',
        description: 'Enable continuous deployment while maintaining compliance.' }
    ]
  },
  {
    code: 'ansi_eia_649c',
    name: 'ANSI/EIA-649C Configuration Management Standard',
    version: '2019',
    category: 'Configuration Management',
    tier_required: 'enterprise',
    description: 'National consensus standard for configuration management covering planning, identification, change control, status accounting, and verification & audit.',
    controls: [
      // Configuration Planning
      { control_id: 'CM-PLAN-1', title: 'CM Plan Development', priority: '1', control_type: 'policy',
        description: 'Develop comprehensive configuration management plan aligned with organizational objectives.' },
      { control_id: 'CM-PLAN-2', title: 'CM Roles & Responsibilities', priority: '1', control_type: 'organizational',
        description: 'Define roles, responsibilities, and authorities for CM activities.' },
      { control_id: 'CM-PLAN-3', title: 'CM Tools & Infrastructure', priority: '2', control_type: 'technical',
        description: 'Establish CM tools, databases, and supporting infrastructure.' },
      
      // Configuration Identification
      { control_id: 'CM-ID-1', title: 'Configuration Item Selection', priority: '1', control_type: 'organizational',
        description: 'Identify and document configuration items requiring formal control.' },
      { control_id: 'CM-ID-2', title: 'Baseline Establishment', priority: '1', control_type: 'technical',
        description: 'Establish and document configuration baselines.' },
      { control_id: 'CM-ID-3', title: 'Configuration Item Naming', priority: '2', control_type: 'organizational',
        description: 'Implement consistent naming conventions for configuration items.' },
      { control_id: 'CM-ID-4', title: 'Interface Control', priority: '2', control_type: 'technical',
        description: 'Document and control interfaces between configuration items.' },
      
      // Change Control
      { control_id: 'CM-CC-1', title: 'Change Request Process', priority: '1', control_type: 'organizational',
        description: 'Establish formal change request and evaluation process.' },
      { control_id: 'CM-CC-2', title: 'Configuration Control Board (CCB)', priority: '1', control_type: 'organizational',
        description: 'Operate CCB to review and approve/disapprove changes.' },
      { control_id: 'CM-CC-3', title: 'Change Impact Analysis', priority: '1', control_type: 'organizational',
        description: 'Conduct impact analysis for proposed changes including security implications.' },
      { control_id: 'CM-CC-4', title: 'Change Implementation & Verification', priority: '1', control_type: 'technical',
        description: 'Implement approved changes with verification of correct implementation.' },
      
      // Status Accounting
      { control_id: 'CM-SA-1', title: 'Configuration Status Records', priority: '1', control_type: 'technical',
        description: 'Maintain records of configuration item status throughout lifecycle.' },
      { control_id: 'CM-SA-2', title: 'Change Tracking & Reporting', priority: '1', control_type: 'organizational',
        description: 'Track and report status of change requests and implementations.' },
      { control_id: 'CM-SA-3', title: 'Baseline Traceability', priority: '2', control_type: 'technical',
        description: 'Maintain traceability between baselines and changes.' },
      
      // Verification & Audit
      { control_id: 'CM-VA-1', title: 'Configuration Audits', priority: '1', control_type: 'organizational',
        description: 'Conduct functional and physical configuration audits.' },
      { control_id: 'CM-VA-2', title: 'CM Process Compliance', priority: '1', control_type: 'organizational',
        description: 'Verify compliance with CM plan and procedures.' },
      { control_id: 'CM-VA-3', title: 'Corrective Action Process', priority: '2', control_type: 'organizational',
        description: 'Implement corrective actions for identified CM discrepancies.' }
    ]
  },
  {
    code: 'iso_10007',
    name: 'ISO 10007:2017 Configuration Management Guidelines',
    version: '2017',
    category: 'Configuration Management',
    tier_required: 'enterprise',
    description: 'International standard providing configuration management guidance within quality management systems from concept to disposal.',
    controls: [
      // CM Fundamentals
      { control_id: 'ISO10007-1.1', title: 'CM Policy & Objectives', priority: '1', control_type: 'policy',
        description: 'Establish CM policy and objectives aligned with quality management system.' },
      { control_id: 'ISO10007-1.2', title: 'Management Responsibility', priority: '1', control_type: 'organizational',
        description: 'Define management responsibilities for CM activities.' },
      
      // Planning
      { control_id: 'ISO10007-2.1', title: 'CM Planning', priority: '1', control_type: 'organizational',
        description: 'Plan CM activities throughout product/service lifecycle.' },
      { control_id: 'ISO10007-2.2', title: 'Resource Allocation', priority: '2', control_type: 'organizational',
        description: 'Allocate adequate resources for CM activities.' },
      
      // Configuration Identification
      { control_id: 'ISO10007-3.1', title: 'Product Structure & Documentation', priority: '1', control_type: 'technical',
        description: 'Define product structure and establish documentation hierarchy.' },
      { control_id: 'ISO10007-3.2', title: 'Configuration Baseline Management', priority: '1', control_type: 'technical',
        description: 'Establish and maintain configuration baselines.' },
      
      // Change Management
      { control_id: 'ISO10007-4.1', title: 'Change Initiation & Evaluation', priority: '1', control_type: 'organizational',
        description: 'Establish process for initiating and evaluating changes.' },
      { control_id: 'ISO10007-4.2', title: 'Change Authorization', priority: '1', control_type: 'organizational',
        description: 'Define authorization process for configuration changes.' },
      { control_id: 'ISO10007-4.3', title: 'Change Implementation Control', priority: '1', control_type: 'technical',
        description: 'Control implementation of authorized changes.' },
      
      // Status Accounting
      { control_id: 'ISO10007-5.1', title: 'Configuration Records', priority: '1', control_type: 'technical',
        description: 'Maintain configuration records and documentation.' },
      { control_id: 'ISO10007-5.2', title: 'Status Reporting', priority: '2', control_type: 'organizational',
        description: 'Report configuration status to stakeholders.' },
      
      // Audit
      { control_id: 'ISO10007-6.1', title: 'Configuration Audit Process', priority: '1', control_type: 'organizational',
        description: 'Conduct periodic configuration audits.' },
      { control_id: 'ISO10007-6.2', title: 'Audit Follow-up', priority: '2', control_type: 'organizational',
        description: 'Track and close audit findings.' }
    ]
  },
  {
    code: 'nist_800_128',
    name: 'NIST SP 800-128 Security-Focused Configuration Management',
    version: 'Rev 1 (2024)',
    category: 'Configuration Management',
    tier_required: 'pro',
    description: 'Guide for security-focused configuration management aligned with NIST 800-53 CM controls for risk management.',
    controls: [
      // CM-1: Policy and Procedures
      { control_id: 'CM-1', title: 'Configuration Management Policy & Procedures', priority: '1', control_type: 'policy',
        description: 'Develop, document, and disseminate CM policy and procedures.' },
      
      // CM-2: Baseline Configuration
      { control_id: 'CM-2', title: 'Baseline Configuration', priority: '1', control_type: 'technical',
        description: 'Develop, document, and maintain baseline configuration of systems.' },
      { control_id: 'CM-2(1)', title: 'Reviews and Updates', priority: '1', control_type: 'organizational',
        description: 'Review and update baseline configuration periodically.' },
      { control_id: 'CM-2(2)', title: 'Automation Support', priority: '2', control_type: 'technical',
        description: 'Employ automated mechanisms to maintain baseline configuration.' },
      
      // CM-3: Configuration Change Control
      { control_id: 'CM-3', title: 'Configuration Change Control', priority: '1', control_type: 'organizational',
        description: 'Determine types of changes subject to configuration control.' },
      { control_id: 'CM-3(1)', title: 'Automated Documentation', priority: '2', control_type: 'technical',
        description: 'Employ automated mechanisms to document proposed changes.' },
      { control_id: 'CM-3(2)', title: 'Testing and Validation', priority: '1', control_type: 'technical',
        description: 'Test, validate, and document changes before implementation.' },
      
      // CM-4: Impact Analysis
      { control_id: 'CM-4', title: 'Security Impact Analysis', priority: '1', control_type: 'organizational',
        description: 'Analyze changes for potential security impacts before implementation.' },
      
      // CM-5: Access Restrictions
      { control_id: 'CM-5', title: 'Access Restrictions for Change', priority: '1', control_type: 'technical',
        description: 'Define, document, and enforce access restrictions for changes.' },
      { control_id: 'CM-5(1)', title: 'Automated Access Enforcement', priority: '2', control_type: 'technical',
        description: 'Employ automated mechanisms to enforce access restrictions.' },
      
      // CM-6: Configuration Settings
      { control_id: 'CM-6', title: 'Configuration Settings', priority: '1', control_type: 'technical',
        description: 'Establish and document configuration settings for systems.' },
      { control_id: 'CM-6(1)', title: 'Automated Management', priority: '2', control_type: 'technical',
        description: 'Employ automated mechanisms to centrally manage configuration settings.' },
      
      // CM-7: Least Functionality
      { control_id: 'CM-7', title: 'Least Functionality', priority: '1', control_type: 'technical',
        description: 'Configure systems to provide only essential capabilities.' },
      { control_id: 'CM-7(1)', title: 'Periodic Review', priority: '2', control_type: 'organizational',
        description: 'Review system to identify and disable unnecessary functions.' },
      
      // CM-8: System Component Inventory
      { control_id: 'CM-8', title: 'System Component Inventory', priority: '1', control_type: 'technical',
        description: 'Develop and maintain inventory of system components.' },
      { control_id: 'CM-8(1)', title: 'Updates During Installation', priority: '2', control_type: 'technical',
        description: 'Update component inventory as part of installations and removals.' },
      
      // CM-9: Configuration Management Plan
      { control_id: 'CM-9', title: 'Configuration Management Plan', priority: '1', control_type: 'organizational',
        description: 'Develop and implement CM plan that addresses roles, responsibilities, and processes.' }
    ]
  },
  {
    code: 'cis_controls',
    name: 'CIS Controls v8',
    version: '8.0',
    category: 'Cybersecurity',
    tier_required: 'community',
    description: 'Center for Internet Security Controls providing prioritized, prescriptive actions to improve cybersecurity posture.',
    controls: [
      // IG1 - Basic Cyber Hygiene
      { control_id: 'CIS-1.1', title: 'Establish and Maintain Asset Inventory', priority: '1', control_type: 'technical',
        description: 'Maintain accurate inventory of all enterprise assets.' },
      { control_id: 'CIS-2.1', title: 'Establish and Maintain Software Inventory', priority: '1', control_type: 'technical',
        description: 'Maintain accurate inventory of all software on enterprise assets.' },
      { control_id: 'CIS-3.1', title: 'Establish and Maintain Data Management Process', priority: '1', control_type: 'organizational',
        description: 'Establish process for data management including classification and handling.' },
      { control_id: 'CIS-4.1', title: 'Establish Secure Configuration Process', priority: '1', control_type: 'technical',
        description: 'Establish and maintain secure configuration standards.' },
      { control_id: 'CIS-5.1', title: 'Establish and Maintain Account Management', priority: '1', control_type: 'technical',
        description: 'Use unique user accounts for all users and implement least privilege.' },
      { control_id: 'CIS-6.1', title: 'Establish Access Control Process', priority: '1', control_type: 'technical',
        description: 'Manage access to enterprise assets based on business needs.' },
      { control_id: 'CIS-7.1', title: 'Establish Continuous Vulnerability Management', priority: '1', control_type: 'technical',
        description: 'Establish process for continuous vulnerability assessment and remediation.' },
      { control_id: 'CIS-8.1', title: 'Establish Audit Log Management', priority: '1', control_type: 'technical',
        description: 'Collect, alert, review, and retain audit logs.' },
      { control_id: 'CIS-9.1', title: 'Establish Email and Web Browser Protections', priority: '1', control_type: 'technical',
        description: 'Implement protections for email and web browsing.' },
      { control_id: 'CIS-10.1', title: 'Deploy and Maintain Anti-Malware', priority: '1', control_type: 'technical',
        description: 'Deploy and maintain anti-malware software.' },
      
      // IG2 - Foundational Security Controls
      { control_id: 'CIS-11.1', title: 'Establish Data Recovery Process', priority: '1', control_type: 'technical',
        description: 'Establish and maintain data recovery practices.' },
      { control_id: 'CIS-12.1', title: 'Manage Network Infrastructure', priority: '1', control_type: 'technical',
        description: 'Establish and maintain secure network architecture.' },
      { control_id: 'CIS-13.1', title: 'Establish Network Monitoring', priority: '1', control_type: 'technical',
        description: 'Establish network monitoring and defense capabilities.' },
      { control_id: 'CIS-14.1', title: 'Establish Security Awareness Program', priority: '1', control_type: 'organizational',
        description: 'Establish and maintain security awareness training program.' },
      { control_id: 'CIS-15.1', title: 'Establish Service Provider Management', priority: '2', control_type: 'organizational',
        description: 'Establish process for managing security risks of service providers.' },
      
      // IG3 - Advanced Security Controls
      { control_id: 'CIS-16.1', title: 'Establish Application Security Program', priority: '1', control_type: 'organizational',
        description: 'Manage security lifecycle of in-house developed and acquired software.' },
      { control_id: 'CIS-17.1', title: 'Establish Incident Response Program', priority: '1', control_type: 'organizational',
        description: 'Establish program for incident response management.' },
      { control_id: 'CIS-18.1', title: 'Establish Penetration Testing Program', priority: '2', control_type: 'organizational',
        description: 'Establish program for penetration testing and red team exercises.' }
    ]
  }
];

async function seedConfigManagementFrameworks() {
  const client = await pool.connect();
  try {
    console.log('='.repeat(80));
    console.log('SEEDING CONFIGURATION MANAGEMENT & AGILE FRAMEWORKS');
    console.log('='.repeat(80));
    console.log();
    
    await client.query('BEGIN');
    
    for (const framework of configManagementFrameworks) {
      console.log(`\nProcessing: ${framework.name} (${framework.code})`);
      
      // Check if framework already exists
      const existingFramework = await client.query(
        'SELECT id FROM frameworks WHERE code = $1',
        [framework.code]
      );
      
      let frameworkId;
      if (existingFramework.rows.length > 0) {
        frameworkId = existingFramework.rows[0].id;
        console.log(`  Framework already exists with ID ${frameworkId}`);
        
        // Delete existing controls
        await client.query(
          'DELETE FROM framework_controls WHERE framework_id = $1',
          [frameworkId]
        );
        console.log('  Deleted existing controls');
      } else {
        // Insert framework
        const frameworkResult = await client.query(
          `INSERT INTO frameworks (code, name, version, category, tier_required, description)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            framework.code,
            framework.name,
            framework.version,
            framework.category,
            framework.tier_required,
            framework.description
          ]
        );
        frameworkId = frameworkResult.rows[0].id;
        console.log(`  Created framework with ID ${frameworkId}`);
      }
      
      // Insert controls
      console.log(`  Inserting ${framework.controls.length} controls...`);
      let insertedCount = 0;
      
      for (const control of framework.controls) {
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
      
      console.log(`  ✓ Inserted ${insertedCount} controls`);
    }
    
    await client.query('COMMIT');
    
    console.log();
    console.log('='.repeat(80));
    console.log('FRAMEWORK SEEDING COMPLETE');
    console.log('='.repeat(80));
    console.log();
    console.log('Frameworks seeded:');
    configManagementFrameworks.forEach((fw, idx) => {
      console.log(`  ${idx + 1}. ${fw.name} (${fw.controls.length} controls)`);
    });
    console.log();
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding configuration management frameworks:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeding
if (require.main === module) {
  seedConfigManagementFrameworks()
    .then(() => {
      console.log('Seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedConfigManagementFrameworks, configManagementFrameworks };
