require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

// NIST 800-160 aligned: frameworks organized by system lifecycle stages
// (Concept -> Development -> Production -> Utilization -> Support -> Retirement)
// with trustworthiness properties and security engineering integration

const frameworks = [
  // === FREE TIER: Core Cybersecurity ===
  {
    code: 'nist_csf_2.0', name: 'NIST Cybersecurity Framework 2.0', version: '2.0',
    category: 'Cybersecurity', tier_required: 'free',
    description: 'Comprehensive cybersecurity risk management framework with 6 core functions aligned to system lifecycle (NIST 800-160).',
    controls: [
      // GOVERN
      { control_id: 'GV.OC-01', title: 'Organizational Context - Mission Understanding', priority: '1', control_type: 'strategic' },
      { control_id: 'GV.OC-02', title: 'Organizational Context - Internal Stakeholders', priority: '2', control_type: 'strategic' },
      { control_id: 'GV.OC-03', title: 'Organizational Context - Legal Requirements', priority: '1', control_type: 'strategic' },
      { control_id: 'GV.OC-04', title: 'Organizational Context - Critical Objectives', priority: '1', control_type: 'strategic' },
      { control_id: 'GV.OC-05', title: 'Organizational Context - Dependencies Understood', priority: '2', control_type: 'strategic' },
      { control_id: 'GV.RM-01', title: 'Risk Management - Strategy Established', priority: '1', control_type: 'strategic' },
      { control_id: 'GV.RM-02', title: 'Risk Management - Risk Appetite Statement', priority: '1', control_type: 'strategic' },
      { control_id: 'GV.RM-03', title: 'Risk Management - Supply Chain Risk', priority: '2', control_type: 'strategic' },
      { control_id: 'GV.RR-01', title: 'Roles & Responsibilities - Leadership Accountability', priority: '1', control_type: 'organizational' },
      { control_id: 'GV.RR-02', title: 'Roles & Responsibilities - Authority Defined', priority: '2', control_type: 'organizational' },
      { control_id: 'GV.PO-01', title: 'Policy - Cybersecurity Policy Established', priority: '1', control_type: 'policy' },
      { control_id: 'GV.PO-02', title: 'Policy - Policy Review and Update', priority: '2', control_type: 'policy' },
      { control_id: 'GV.SC-01', title: 'Supply Chain - Cyber Supply Chain Risk Mgmt', priority: '2', control_type: 'strategic' },
      // IDENTIFY
      { control_id: 'ID.AM-01', title: 'Asset Management - Hardware Inventory', priority: '1', control_type: 'technical' },
      { control_id: 'ID.AM-02', title: 'Asset Management - Software Inventory', priority: '1', control_type: 'technical' },
      { control_id: 'ID.AM-03', title: 'Asset Management - Data Flow Mapping', priority: '2', control_type: 'technical' },
      { control_id: 'ID.AM-04', title: 'Asset Management - External Systems Cataloged', priority: '2', control_type: 'technical' },
      { control_id: 'ID.AM-05', title: 'Asset Management - Asset Prioritization', priority: '1', control_type: 'strategic' },
      { control_id: 'ID.RA-01', title: 'Risk Assessment - Vulnerability Identification', priority: '1', control_type: 'technical' },
      { control_id: 'ID.RA-02', title: 'Risk Assessment - Threat Intelligence', priority: '2', control_type: 'technical' },
      { control_id: 'ID.RA-03', title: 'Risk Assessment - Risk Identification', priority: '1', control_type: 'strategic' },
      { control_id: 'ID.RA-04', title: 'Risk Assessment - Impact Analysis', priority: '1', control_type: 'strategic' },
      { control_id: 'ID.IM-01', title: 'Improvement - Lessons Learned', priority: '3', control_type: 'organizational' },
      // PROTECT
      { control_id: 'PR.AA-01', title: 'Identity & Access - Identities Managed', priority: '1', control_type: 'technical' },
      { control_id: 'PR.AA-02', title: 'Identity & Access - Authentication', priority: '1', control_type: 'technical' },
      { control_id: 'PR.AA-03', title: 'Identity & Access - Remote Access', priority: '1', control_type: 'technical' },
      { control_id: 'PR.AA-04', title: 'Identity & Access - Access Permissions', priority: '1', control_type: 'technical' },
      { control_id: 'PR.AA-05', title: 'Identity & Access - Physical Access', priority: '2', control_type: 'physical' },
      { control_id: 'PR.AT-01', title: 'Awareness & Training - Users Trained', priority: '2', control_type: 'organizational' },
      { control_id: 'PR.AT-02', title: 'Awareness & Training - Privileged Users Trained', priority: '1', control_type: 'organizational' },
      { control_id: 'PR.DS-01', title: 'Data Security - Data at Rest Protected', priority: '1', control_type: 'technical' },
      { control_id: 'PR.DS-02', title: 'Data Security - Data in Transit Protected', priority: '1', control_type: 'technical' },
      { control_id: 'PR.DS-10', title: 'Data Security - Confidentiality', priority: '1', control_type: 'technical' },
      { control_id: 'PR.DS-11', title: 'Data Security - Integrity', priority: '1', control_type: 'technical' },
      { control_id: 'PR.PS-01', title: 'Platform Security - Configuration Management', priority: '1', control_type: 'technical' },
      { control_id: 'PR.PS-02', title: 'Platform Security - Software Maintained', priority: '1', control_type: 'technical' },
      { control_id: 'PR.PS-03', title: 'Platform Security - Hardware Maintained', priority: '2', control_type: 'technical' },
      { control_id: 'PR.IR-01', title: 'Resilience - Backups Maintained', priority: '1', control_type: 'technical' },
      { control_id: 'PR.IR-02', title: 'Resilience - Recovery Procedures', priority: '1', control_type: 'technical' },
      // DETECT
      { control_id: 'DE.CM-01', title: 'Continuous Monitoring - Network Monitoring', priority: '1', control_type: 'technical' },
      { control_id: 'DE.CM-02', title: 'Continuous Monitoring - Physical Environment', priority: '3', control_type: 'physical' },
      { control_id: 'DE.CM-03', title: 'Continuous Monitoring - Personnel Activity', priority: '2', control_type: 'technical' },
      { control_id: 'DE.CM-06', title: 'Continuous Monitoring - External Provider Activity', priority: '2', control_type: 'technical' },
      { control_id: 'DE.CM-09', title: 'Continuous Monitoring - Computing Hardware', priority: '2', control_type: 'technical' },
      { control_id: 'DE.AE-02', title: 'Adverse Event Analysis - Anomalies Analyzed', priority: '1', control_type: 'technical' },
      { control_id: 'DE.AE-03', title: 'Adverse Event Analysis - Correlation & Enrichment', priority: '2', control_type: 'technical' },
      { control_id: 'DE.AE-06', title: 'Adverse Event Analysis - Incident Declared', priority: '1', control_type: 'organizational' },
      // RESPOND
      { control_id: 'RS.MA-01', title: 'Incident Management - IR Plan Executed', priority: '1', control_type: 'organizational' },
      { control_id: 'RS.MA-02', title: 'Incident Management - Triage Performed', priority: '1', control_type: 'organizational' },
      { control_id: 'RS.MA-03', title: 'Incident Management - Incidents Categorized', priority: '2', control_type: 'organizational' },
      { control_id: 'RS.AN-03', title: 'Incident Analysis - Root Cause Determined', priority: '1', control_type: 'technical' },
      { control_id: 'RS.CO-02', title: 'Incident Reporting - Stakeholders Notified', priority: '1', control_type: 'organizational' },
      { control_id: 'RS.MI-01', title: 'Incident Mitigation - Containment Performed', priority: '1', control_type: 'technical' },
      { control_id: 'RS.MI-02', title: 'Incident Mitigation - Eradication Performed', priority: '1', control_type: 'technical' },
      // RECOVER
      { control_id: 'RC.RP-01', title: 'Recovery Execution - Recovery Plan Executed', priority: '1', control_type: 'organizational' },
      { control_id: 'RC.RP-02', title: 'Recovery Execution - Recovery Verified', priority: '1', control_type: 'technical' },
      { control_id: 'RC.CO-03', title: 'Recovery Communication - Recovery Status Shared', priority: '2', control_type: 'organizational' },
    ]
  },
  {
    code: 'nist_800_53', name: 'NIST SP 800-53 Rev 5', version: 'Rev 5',
    category: 'Cybersecurity', tier_required: 'free',
    description: 'Security and privacy controls for information systems. Controls mapped to NIST 800-160 system lifecycle stages.',
    controls: [
      // Access Control
      { control_id: 'AC-1', title: 'Access Control Policy and Procedures', priority: '1', control_type: 'policy' },
      { control_id: 'AC-2', title: 'Account Management', priority: '1', control_type: 'technical' },
      { control_id: 'AC-3', title: 'Access Enforcement', priority: '1', control_type: 'technical' },
      { control_id: 'AC-4', title: 'Information Flow Enforcement', priority: '1', control_type: 'technical' },
      { control_id: 'AC-5', title: 'Separation of Duties', priority: '2', control_type: 'organizational' },
      { control_id: 'AC-6', title: 'Least Privilege', priority: '1', control_type: 'technical' },
      { control_id: 'AC-7', title: 'Unsuccessful Logon Attempts', priority: '2', control_type: 'technical' },
      { control_id: 'AC-8', title: 'System Use Notification', priority: '3', control_type: 'technical' },
      { control_id: 'AC-11', title: 'Device Lock', priority: '2', control_type: 'technical' },
      { control_id: 'AC-17', title: 'Remote Access', priority: '1', control_type: 'technical' },
      // Audit and Accountability
      { control_id: 'AU-1', title: 'Audit and Accountability Policy', priority: '1', control_type: 'policy' },
      { control_id: 'AU-2', title: 'Event Logging', priority: '1', control_type: 'technical' },
      { control_id: 'AU-3', title: 'Content of Audit Records', priority: '1', control_type: 'technical' },
      { control_id: 'AU-6', title: 'Audit Record Review and Reporting', priority: '1', control_type: 'organizational' },
      { control_id: 'AU-8', title: 'Time Stamps', priority: '2', control_type: 'technical' },
      { control_id: 'AU-9', title: 'Protection of Audit Information', priority: '1', control_type: 'technical' },
      { control_id: 'AU-12', title: 'Audit Record Generation', priority: '1', control_type: 'technical' },
      // Awareness and Training
      { control_id: 'AT-1', title: 'Policy and Procedures', priority: '1', control_type: 'policy' },
      { control_id: 'AT-2', title: 'Literacy Training and Awareness', priority: '2', control_type: 'organizational' },
      { control_id: 'AT-3', title: 'Role-Based Training', priority: '2', control_type: 'organizational' },
      // Config Management
      { control_id: 'CM-1', title: 'Configuration Management Policy', priority: '1', control_type: 'policy' },
      { control_id: 'CM-2', title: 'Baseline Configuration', priority: '1', control_type: 'technical' },
      { control_id: 'CM-3', title: 'Configuration Change Control', priority: '1', control_type: 'organizational' },
      { control_id: 'CM-6', title: 'Configuration Settings', priority: '1', control_type: 'technical' },
      { control_id: 'CM-7', title: 'Least Functionality', priority: '2', control_type: 'technical' },
      { control_id: 'CM-8', title: 'System Component Inventory', priority: '1', control_type: 'technical' },
      // Contingency Planning
      { control_id: 'CP-1', title: 'Contingency Planning Policy', priority: '1', control_type: 'policy' },
      { control_id: 'CP-2', title: 'Contingency Plan', priority: '1', control_type: 'organizational' },
      { control_id: 'CP-4', title: 'Contingency Plan Testing', priority: '2', control_type: 'organizational' },
      { control_id: 'CP-9', title: 'System Backup', priority: '1', control_type: 'technical' },
      { control_id: 'CP-10', title: 'System Recovery and Reconstitution', priority: '1', control_type: 'technical' },
      // Identification & Auth
      { control_id: 'IA-1', title: 'Identification and Authentication Policy', priority: '1', control_type: 'policy' },
      { control_id: 'IA-2', title: 'Identification and Authentication (Org Users)', priority: '1', control_type: 'technical' },
      { control_id: 'IA-4', title: 'Identifier Management', priority: '1', control_type: 'technical' },
      { control_id: 'IA-5', title: 'Authenticator Management', priority: '1', control_type: 'technical' },
      { control_id: 'IA-8', title: 'Identification and Authentication (Non-Org Users)', priority: '2', control_type: 'technical' },
      // Incident Response
      { control_id: 'IR-1', title: 'Incident Response Policy', priority: '1', control_type: 'policy' },
      { control_id: 'IR-2', title: 'Incident Response Training', priority: '2', control_type: 'organizational' },
      { control_id: 'IR-4', title: 'Incident Handling', priority: '1', control_type: 'organizational' },
      { control_id: 'IR-5', title: 'Incident Monitoring', priority: '1', control_type: 'technical' },
      { control_id: 'IR-6', title: 'Incident Reporting', priority: '1', control_type: 'organizational' },
      { control_id: 'IR-8', title: 'Incident Response Plan', priority: '1', control_type: 'organizational' },
      // Risk Assessment
      { control_id: 'RA-1', title: 'Risk Assessment Policy', priority: '1', control_type: 'policy' },
      { control_id: 'RA-2', title: 'Security Categorization', priority: '1', control_type: 'strategic' },
      { control_id: 'RA-3', title: 'Risk Assessment', priority: '1', control_type: 'strategic' },
      { control_id: 'RA-5', title: 'Vulnerability Monitoring and Scanning', priority: '1', control_type: 'technical' },
      // System & Comms Protection
      { control_id: 'SC-1', title: 'System and Communications Protection Policy', priority: '1', control_type: 'policy' },
      { control_id: 'SC-7', title: 'Boundary Protection', priority: '1', control_type: 'technical' },
      { control_id: 'SC-8', title: 'Transmission Confidentiality and Integrity', priority: '1', control_type: 'technical' },
      { control_id: 'SC-12', title: 'Cryptographic Key Management', priority: '1', control_type: 'technical' },
      { control_id: 'SC-13', title: 'Cryptographic Protection', priority: '1', control_type: 'technical' },
      // System & Info Integrity
      { control_id: 'SI-1', title: 'System and Information Integrity Policy', priority: '1', control_type: 'policy' },
      { control_id: 'SI-2', title: 'Flaw Remediation', priority: '1', control_type: 'technical' },
      { control_id: 'SI-3', title: 'Malicious Code Protection', priority: '1', control_type: 'technical' },
      { control_id: 'SI-4', title: 'System Monitoring', priority: '1', control_type: 'technical' },
      { control_id: 'SI-5', title: 'Security Alerts and Advisories', priority: '2', control_type: 'organizational' },
    ]
  },
  {
    code: 'iso_27001', name: 'ISO/IEC 27001:2022', version: '2022',
    category: 'Information Security', tier_required: 'free',
    description: 'Information security management system (ISMS) standard with Annex A controls.',
    controls: [
      { control_id: 'A.5.1', title: 'Policies for Information Security', priority: '1', control_type: 'policy' },
      { control_id: 'A.5.2', title: 'Information Security Roles', priority: '1', control_type: 'organizational' },
      { control_id: 'A.5.3', title: 'Segregation of Duties', priority: '2', control_type: 'organizational' },
      { control_id: 'A.5.4', title: 'Management Responsibilities', priority: '1', control_type: 'organizational' },
      { control_id: 'A.5.7', title: 'Threat Intelligence', priority: '2', control_type: 'technical' },
      { control_id: 'A.5.8', title: 'Information Security in Project Management', priority: '2', control_type: 'organizational' },
      { control_id: 'A.5.9', title: 'Inventory of Information and Assets', priority: '1', control_type: 'technical' },
      { control_id: 'A.5.10', title: 'Acceptable Use of Information', priority: '2', control_type: 'policy' },
      { control_id: 'A.5.15', title: 'Access Control', priority: '1', control_type: 'technical' },
      { control_id: 'A.5.16', title: 'Identity Management', priority: '1', control_type: 'technical' },
      { control_id: 'A.5.17', title: 'Authentication Information', priority: '1', control_type: 'technical' },
      { control_id: 'A.5.18', title: 'Access Rights', priority: '1', control_type: 'technical' },
      { control_id: 'A.5.23', title: 'Information Security for Cloud Services', priority: '1', control_type: 'technical' },
      { control_id: 'A.5.24', title: 'Information Security Incident Management', priority: '1', control_type: 'organizational' },
      { control_id: 'A.5.25', title: 'Assessment and Decision on Events', priority: '2', control_type: 'organizational' },
      { control_id: 'A.5.26', title: 'Response to Information Security Incidents', priority: '1', control_type: 'organizational' },
      { control_id: 'A.5.29', title: 'Information Security During Disruption', priority: '1', control_type: 'organizational' },
      { control_id: 'A.5.30', title: 'ICT Readiness for Business Continuity', priority: '1', control_type: 'technical' },
      { control_id: 'A.5.36', title: 'Compliance with Policies and Standards', priority: '2', control_type: 'organizational' },
      { control_id: 'A.6.1', title: 'Screening', priority: '3', control_type: 'organizational' },
      { control_id: 'A.6.3', title: 'Information Security Awareness', priority: '2', control_type: 'organizational' },
      { control_id: 'A.7.1', title: 'Physical Security Perimeters', priority: '2', control_type: 'physical' },
      { control_id: 'A.7.4', title: 'Physical Security Monitoring', priority: '2', control_type: 'physical' },
      { control_id: 'A.8.1', title: 'User Endpoint Devices', priority: '1', control_type: 'technical' },
      { control_id: 'A.8.2', title: 'Privileged Access Rights', priority: '1', control_type: 'technical' },
      { control_id: 'A.8.3', title: 'Information Access Restriction', priority: '1', control_type: 'technical' },
      { control_id: 'A.8.5', title: 'Secure Authentication', priority: '1', control_type: 'technical' },
      { control_id: 'A.8.7', title: 'Protection Against Malware', priority: '1', control_type: 'technical' },
      { control_id: 'A.8.8', title: 'Management of Technical Vulnerabilities', priority: '1', control_type: 'technical' },
      { control_id: 'A.8.9', title: 'Configuration Management', priority: '1', control_type: 'technical' },
      { control_id: 'A.8.10', title: 'Information Deletion', priority: '2', control_type: 'technical' },
      { control_id: 'A.8.12', title: 'Data Leakage Prevention', priority: '1', control_type: 'technical' },
      { control_id: 'A.8.13', title: 'Information Backup', priority: '1', control_type: 'technical' },
      { control_id: 'A.8.15', title: 'Logging', priority: '1', control_type: 'technical' },
      { control_id: 'A.8.16', title: 'Monitoring Activities', priority: '1', control_type: 'technical' },
      { control_id: 'A.8.20', title: 'Networks Security', priority: '1', control_type: 'technical' },
      { control_id: 'A.8.24', title: 'Use of Cryptography', priority: '1', control_type: 'technical' },
      { control_id: 'A.8.25', title: 'Secure Development Lifecycle', priority: '2', control_type: 'technical' },
      { control_id: 'A.8.28', title: 'Secure Coding', priority: '2', control_type: 'technical' },
    ]
  },
  {
    code: 'soc2', name: 'SOC 2 Type II', version: '2022',
    category: 'Audit', tier_required: 'free',
    description: 'Trust Service Criteria for service organizations. Mapped to NIST 800-160 trustworthiness objectives.',
    controls: [
      { control_id: 'CC1.1', title: 'COSO Principle 1 - Integrity and Ethical Values', priority: '1', control_type: 'organizational' },
      { control_id: 'CC1.2', title: 'COSO Principle 2 - Board Independence', priority: '2', control_type: 'organizational' },
      { control_id: 'CC1.3', title: 'COSO Principle 3 - Management Authority', priority: '2', control_type: 'organizational' },
      { control_id: 'CC2.1', title: 'COSO Principle 13 - Quality Information', priority: '1', control_type: 'organizational' },
      { control_id: 'CC2.2', title: 'COSO Principle 14 - Internal Communication', priority: '2', control_type: 'organizational' },
      { control_id: 'CC3.1', title: 'COSO Principle 6 - Risk Assessment Objectives', priority: '1', control_type: 'strategic' },
      { control_id: 'CC3.2', title: 'COSO Principle 7 - Risk Identification', priority: '1', control_type: 'strategic' },
      { control_id: 'CC3.3', title: 'COSO Principle 8 - Fraud Risk', priority: '2', control_type: 'strategic' },
      { control_id: 'CC3.4', title: 'COSO Principle 9 - Change Risk', priority: '2', control_type: 'strategic' },
      { control_id: 'CC4.1', title: 'COSO Principle 16 - Monitoring', priority: '1', control_type: 'organizational' },
      { control_id: 'CC5.1', title: 'COSO Principle 10 - Control Selection', priority: '1', control_type: 'strategic' },
      { control_id: 'CC5.2', title: 'COSO Principle 11 - Technology Controls', priority: '1', control_type: 'technical' },
      { control_id: 'CC5.3', title: 'COSO Principle 12 - Control Deployment', priority: '1', control_type: 'technical' },
      { control_id: 'CC6.1', title: 'Logical and Physical Access - Access Controls', priority: '1', control_type: 'technical' },
      { control_id: 'CC6.2', title: 'Logical and Physical Access - User Registration', priority: '1', control_type: 'technical' },
      { control_id: 'CC6.3', title: 'Logical and Physical Access - Role-Based Access', priority: '1', control_type: 'technical' },
      { control_id: 'CC6.6', title: 'Logical and Physical Access - External Threats', priority: '1', control_type: 'technical' },
      { control_id: 'CC6.7', title: 'Logical and Physical Access - Data Transmission', priority: '1', control_type: 'technical' },
      { control_id: 'CC6.8', title: 'Logical and Physical Access - Malicious Software', priority: '1', control_type: 'technical' },
      { control_id: 'CC7.1', title: 'System Operations - Detection Mechanisms', priority: '1', control_type: 'technical' },
      { control_id: 'CC7.2', title: 'System Operations - Anomaly Monitoring', priority: '1', control_type: 'technical' },
      { control_id: 'CC7.3', title: 'System Operations - Security Incident Evaluation', priority: '1', control_type: 'organizational' },
      { control_id: 'CC7.4', title: 'System Operations - Incident Response', priority: '1', control_type: 'organizational' },
      { control_id: 'CC7.5', title: 'System Operations - Incident Recovery', priority: '1', control_type: 'organizational' },
      { control_id: 'CC8.1', title: 'Change Management - Change Authorization', priority: '1', control_type: 'organizational' },
      { control_id: 'CC9.1', title: 'Risk Mitigation - Risk Identification', priority: '1', control_type: 'strategic' },
      { control_id: 'CC9.2', title: 'Risk Mitigation - Vendor Management', priority: '2', control_type: 'organizational' },
    ]
  },

  // === STARTER TIER ===
  {
    code: 'nist_800_171', name: 'NIST SP 800-171 Rev 3', version: 'Rev 3',
    category: 'CUI Protection', tier_required: 'starter',
    description: 'Protecting Controlled Unclassified Information (CUI) in non-federal systems.',
    controls: [
      { control_id: '03.01.01', title: 'Account Management', priority: '1', control_type: 'technical' },
      { control_id: '03.01.02', title: 'Access Enforcement', priority: '1', control_type: 'technical' },
      { control_id: '03.01.03', title: 'Information Flow Enforcement', priority: '1', control_type: 'technical' },
      { control_id: '03.01.05', title: 'Least Privilege', priority: '1', control_type: 'technical' },
      { control_id: '03.01.12', title: 'Remote Access', priority: '1', control_type: 'technical' },
      { control_id: '03.01.20', title: 'Use of External Systems', priority: '2', control_type: 'technical' },
      { control_id: '03.03.01', title: 'Event Logging', priority: '1', control_type: 'technical' },
      { control_id: '03.03.02', title: 'Audit Record Content', priority: '1', control_type: 'technical' },
      { control_id: '03.04.01', title: 'Baseline Configuration', priority: '1', control_type: 'technical' },
      { control_id: '03.04.02', title: 'Configuration Settings', priority: '1', control_type: 'technical' },
      { control_id: '03.04.06', title: 'Least Functionality', priority: '2', control_type: 'technical' },
      { control_id: '03.05.01', title: 'User Identification and Authentication', priority: '1', control_type: 'technical' },
      { control_id: '03.05.02', title: 'Device Identification and Authentication', priority: '2', control_type: 'technical' },
      { control_id: '03.05.03', title: 'Multi-Factor Authentication', priority: '1', control_type: 'technical' },
      { control_id: '03.06.01', title: 'Incident Handling', priority: '1', control_type: 'organizational' },
      { control_id: '03.08.01', title: 'Media Storage', priority: '2', control_type: 'technical' },
      { control_id: '03.11.01', title: 'Risk Assessment', priority: '1', control_type: 'strategic' },
      { control_id: '03.11.02', title: 'Vulnerability Scanning', priority: '1', control_type: 'technical' },
      { control_id: '03.12.01', title: 'Security Assessment', priority: '1', control_type: 'organizational' },
      { control_id: '03.13.01', title: 'Boundary Protection', priority: '1', control_type: 'technical' },
      { control_id: '03.13.08', title: 'CUI Transmission Confidentiality', priority: '1', control_type: 'technical' },
      { control_id: '03.14.01', title: 'Flaw Remediation', priority: '1', control_type: 'technical' },
      { control_id: '03.14.02', title: 'Malicious Code Protection', priority: '1', control_type: 'technical' },
      { control_id: '03.14.06', title: 'System Monitoring', priority: '1', control_type: 'technical' },
    ]
  },
  {
    code: 'nist_privacy', name: 'NIST Privacy Framework', version: '1.0',
    category: 'Privacy', tier_required: 'starter',
    description: 'Privacy risk management framework integrated with NIST 800-160 lifecycle.',
    controls: [
      { control_id: 'ID-P.01', title: 'Inventory and Mapping - Data Processing Inventory', priority: '1', control_type: 'technical' },
      { control_id: 'ID-P.02', title: 'Inventory and Mapping - Data Actions Identified', priority: '1', control_type: 'technical' },
      { control_id: 'GV-P.01', title: 'Governance - Privacy Policy', priority: '1', control_type: 'policy' },
      { control_id: 'GV-P.02', title: 'Governance - Legal Authorities', priority: '1', control_type: 'organizational' },
      { control_id: 'GV-P.03', title: 'Governance - Privacy Risk Strategy', priority: '1', control_type: 'strategic' },
      { control_id: 'CT-P.01', title: 'Control - Data Processing Policies', priority: '1', control_type: 'policy' },
      { control_id: 'CT-P.02', title: 'Control - Data Access Managed', priority: '1', control_type: 'technical' },
      { control_id: 'CM-P.01', title: 'Communicate - Individuals Informed', priority: '1', control_type: 'organizational' },
      { control_id: 'CM-P.02', title: 'Communicate - Consent Mechanisms', priority: '1', control_type: 'technical' },
      { control_id: 'PR-P.01', title: 'Protect - Data Protection Safeguards', priority: '1', control_type: 'technical' },
      { control_id: 'PR-P.02', title: 'Protect - Identity Management', priority: '1', control_type: 'technical' },
    ]
  },
  {
    code: 'fiscam', name: 'FISCAM', version: '2023',
    category: 'Financial Audit', tier_required: 'starter',
    description: 'Federal Information System Controls Audit Manual for financial statement audits.',
    controls: [
      { control_id: 'SM-1', title: 'Security Management - Program', priority: '1', control_type: 'strategic' },
      { control_id: 'SM-2', title: 'Security Management - Risk Assessment', priority: '1', control_type: 'strategic' },
      { control_id: 'SM-3', title: 'Security Management - Policy', priority: '1', control_type: 'policy' },
      { control_id: 'SM-4', title: 'Security Management - Plan of Action', priority: '2', control_type: 'organizational' },
      { control_id: 'AC-FM-1', title: 'Access Control - User Accounts', priority: '1', control_type: 'technical' },
      { control_id: 'AC-FM-2', title: 'Access Control - Authorization', priority: '1', control_type: 'technical' },
      { control_id: 'AC-FM-3', title: 'Access Control - Authentication', priority: '1', control_type: 'technical' },
      { control_id: 'AC-FM-4', title: 'Access Control - Network Security', priority: '1', control_type: 'technical' },
      { control_id: 'CC-1', title: 'Configuration Control - Software Changes', priority: '1', control_type: 'technical' },
      { control_id: 'CC-2', title: 'Configuration Control - Hardware/Software Config', priority: '1', control_type: 'technical' },
      { control_id: 'SC-1', title: 'Segregation of Duties', priority: '1', control_type: 'organizational' },
      { control_id: 'CP-FM-1', title: 'Contingency Planning', priority: '1', control_type: 'organizational' },
    ]
  },
  {
    code: 'nist_ai_rmf', name: 'NIST AI Risk Management Framework', version: '1.0',
    category: 'AI Governance', tier_required: 'free',
    description: 'AI risk management aligned with NIST 800-160 trustworthiness properties.',
    controls: [
      { control_id: 'GOVERN-1', title: 'AI Risk Management Policies', priority: '1', control_type: 'policy' },
      { control_id: 'GOVERN-2', title: 'AI Accountability Structure', priority: '1', control_type: 'organizational' },
      { control_id: 'GOVERN-3', title: 'AI Workforce Diversity', priority: '3', control_type: 'organizational' },
      { control_id: 'GOVERN-4', title: 'Organizational AI Risk Culture', priority: '2', control_type: 'organizational' },
      { control_id: 'GOVERN-5', title: 'Third-Party AI Risk', priority: '2', control_type: 'strategic' },
      { control_id: 'GOVERN-6', title: 'AI Risk Reporting', priority: '1', control_type: 'organizational' },
      { control_id: 'MAP-1', title: 'AI System Context Established', priority: '1', control_type: 'strategic' },
      { control_id: 'MAP-2', title: 'AI Categorization and Classification', priority: '1', control_type: 'strategic' },
      { control_id: 'MAP-3', title: 'AI Benefits and Costs Analyzed', priority: '2', control_type: 'strategic' },
      { control_id: 'MAP-5', title: 'AI Impacts Assessed', priority: '1', control_type: 'strategic' },
      { control_id: 'MEASURE-1', title: 'AI Risk Metrics Established', priority: '1', control_type: 'technical' },
      { control_id: 'MEASURE-2', title: 'AI System Evaluated', priority: '1', control_type: 'technical' },
      { control_id: 'MEASURE-3', title: 'AI System Monitored', priority: '1', control_type: 'technical' },
      { control_id: 'MEASURE-4', title: 'AI Feedback Incorporated', priority: '2', control_type: 'technical' },
      { control_id: 'MANAGE-1', title: 'AI Risk Treatment', priority: '1', control_type: 'strategic' },
      { control_id: 'MANAGE-2', title: 'AI Risk Prioritization', priority: '1', control_type: 'strategic' },
      { control_id: 'MANAGE-3', title: 'AI Risk Response', priority: '1', control_type: 'organizational' },
      { control_id: 'MANAGE-4', title: 'AI Risk Communication', priority: '2', control_type: 'organizational' },
    ]
  },

  // === PROFESSIONAL TIER ===
  {
    code: 'gdpr', name: 'GDPR', version: '2016/679',
    category: 'Privacy', tier_required: 'professional',
    description: 'EU General Data Protection Regulation requirements.',
    controls: [
      { control_id: 'GDPR-5', title: 'Principles of Processing', priority: '1', control_type: 'policy' },
      { control_id: 'GDPR-6', title: 'Lawfulness of Processing', priority: '1', control_type: 'policy' },
      { control_id: 'GDPR-7', title: 'Conditions for Consent', priority: '1', control_type: 'organizational' },
      { control_id: 'GDPR-12', title: 'Transparent Communication', priority: '1', control_type: 'organizational' },
      { control_id: 'GDPR-13', title: 'Information to Data Subject (Direct)', priority: '1', control_type: 'organizational' },
      { control_id: 'GDPR-15', title: 'Right of Access', priority: '1', control_type: 'technical' },
      { control_id: 'GDPR-17', title: 'Right to Erasure', priority: '1', control_type: 'technical' },
      { control_id: 'GDPR-20', title: 'Right to Data Portability', priority: '2', control_type: 'technical' },
      { control_id: 'GDPR-25', title: 'Data Protection by Design', priority: '1', control_type: 'technical' },
      { control_id: 'GDPR-28', title: 'Processor Requirements', priority: '1', control_type: 'organizational' },
      { control_id: 'GDPR-30', title: 'Records of Processing Activities', priority: '1', control_type: 'organizational' },
      { control_id: 'GDPR-32', title: 'Security of Processing', priority: '1', control_type: 'technical' },
      { control_id: 'GDPR-33', title: 'Breach Notification to Authority', priority: '1', control_type: 'organizational' },
      { control_id: 'GDPR-34', title: 'Breach Notification to Data Subject', priority: '1', control_type: 'organizational' },
      { control_id: 'GDPR-35', title: 'Data Protection Impact Assessment', priority: '1', control_type: 'strategic' },
      { control_id: 'GDPR-37', title: 'Data Protection Officer', priority: '2', control_type: 'organizational' },
      { control_id: 'GDPR-44', title: 'International Transfers', priority: '2', control_type: 'organizational' },
    ]
  },
  {
    code: 'hipaa', name: 'HIPAA Security Rule', version: '2024',
    category: 'Healthcare', tier_required: 'professional',
    description: 'Health Insurance Portability and Accountability Act security requirements.',
    controls: [
      { control_id: 'HIPAA-164.308(a)(1)', title: 'Security Management Process', priority: '1', control_type: 'strategic' },
      { control_id: 'HIPAA-164.308(a)(2)', title: 'Assigned Security Responsibility', priority: '1', control_type: 'organizational' },
      { control_id: 'HIPAA-164.308(a)(3)', title: 'Workforce Security', priority: '1', control_type: 'organizational' },
      { control_id: 'HIPAA-164.308(a)(4)', title: 'Information Access Management', priority: '1', control_type: 'technical' },
      { control_id: 'HIPAA-164.308(a)(5)', title: 'Security Awareness and Training', priority: '2', control_type: 'organizational' },
      { control_id: 'HIPAA-164.308(a)(6)', title: 'Security Incident Procedures', priority: '1', control_type: 'organizational' },
      { control_id: 'HIPAA-164.308(a)(7)', title: 'Contingency Plan', priority: '1', control_type: 'organizational' },
      { control_id: 'HIPAA-164.308(a)(8)', title: 'Evaluation', priority: '2', control_type: 'organizational' },
      { control_id: 'HIPAA-164.310(a)(1)', title: 'Facility Access Controls', priority: '2', control_type: 'physical' },
      { control_id: 'HIPAA-164.310(b)', title: 'Workstation Use', priority: '2', control_type: 'technical' },
      { control_id: 'HIPAA-164.310(c)', title: 'Workstation Security', priority: '2', control_type: 'physical' },
      { control_id: 'HIPAA-164.310(d)(1)', title: 'Device and Media Controls', priority: '1', control_type: 'technical' },
      { control_id: 'HIPAA-164.312(a)(1)', title: 'Access Control', priority: '1', control_type: 'technical' },
      { control_id: 'HIPAA-164.312(b)', title: 'Audit Controls', priority: '1', control_type: 'technical' },
      { control_id: 'HIPAA-164.312(c)(1)', title: 'Integrity', priority: '1', control_type: 'technical' },
      { control_id: 'HIPAA-164.312(d)', title: 'Person or Entity Authentication', priority: '1', control_type: 'technical' },
      { control_id: 'HIPAA-164.312(e)(1)', title: 'Transmission Security', priority: '1', control_type: 'technical' },
    ]
  },
  {
    code: 'ffiec', name: 'FFIEC IT Examination Handbook', version: '2024',
    category: 'Financial', tier_required: 'professional',
    description: 'Federal Financial Institutions Examination Council IT standards.',
    controls: [
      { control_id: 'FFIEC-AUD-1', title: 'Audit Program', priority: '1', control_type: 'organizational' },
      { control_id: 'FFIEC-AUD-2', title: 'Audit Independence', priority: '2', control_type: 'organizational' },
      { control_id: 'FFIEC-IS-1', title: 'Information Security Program', priority: '1', control_type: 'strategic' },
      { control_id: 'FFIEC-IS-2', title: 'Risk Assessment', priority: '1', control_type: 'strategic' },
      { control_id: 'FFIEC-IS-3', title: 'Security Controls', priority: '1', control_type: 'technical' },
      { control_id: 'FFIEC-BCP-1', title: 'Business Continuity Planning', priority: '1', control_type: 'organizational' },
      { control_id: 'FFIEC-BCP-2', title: 'BCP Testing', priority: '2', control_type: 'organizational' },
      { control_id: 'FFIEC-OPS-1', title: 'IT Operations', priority: '1', control_type: 'technical' },
      { control_id: 'FFIEC-OPS-2', title: 'Change Management', priority: '1', control_type: 'organizational' },
      { control_id: 'FFIEC-AM-1', title: 'Authentication and Access', priority: '1', control_type: 'technical' },
      { control_id: 'FFIEC-CYB-1', title: 'Cybersecurity Assessment', priority: '1', control_type: 'strategic' },
      { control_id: 'FFIEC-CYB-2', title: 'Threat Intelligence', priority: '2', control_type: 'technical' },
    ]
  },
  {
    code: 'nerc_cip', name: 'NERC CIP', version: '2024',
    category: 'Critical Infrastructure', tier_required: 'professional',
    description: 'North American Electric Reliability Corporation Critical Infrastructure Protection.',
    controls: [
      { control_id: 'CIP-002-6', title: 'BES Cyber System Categorization', priority: '1', control_type: 'strategic' },
      { control_id: 'CIP-003-9', title: 'Security Management Controls', priority: '1', control_type: 'policy' },
      { control_id: 'CIP-004-7', title: 'Personnel and Training', priority: '1', control_type: 'organizational' },
      { control_id: 'CIP-005-7', title: 'Electronic Security Perimeter', priority: '1', control_type: 'technical' },
      { control_id: 'CIP-006-6', title: 'Physical Security', priority: '1', control_type: 'physical' },
      { control_id: 'CIP-007-6', title: 'System Security Management', priority: '1', control_type: 'technical' },
      { control_id: 'CIP-008-6', title: 'Incident Reporting and Response', priority: '1', control_type: 'organizational' },
      { control_id: 'CIP-009-6', title: 'Recovery Plans', priority: '1', control_type: 'organizational' },
      { control_id: 'CIP-010-4', title: 'Configuration Change Management', priority: '1', control_type: 'technical' },
      { control_id: 'CIP-011-3', title: 'Information Protection', priority: '1', control_type: 'technical' },
      { control_id: 'CIP-013-2', title: 'Supply Chain Risk Management', priority: '1', control_type: 'strategic' },
      { control_id: 'CIP-014-3', title: 'Physical Security', priority: '2', control_type: 'physical' },
    ]
  },

  // === ENTERPRISE TIER ===
  {
    code: 'eu_ai_act', name: 'EU AI Act', version: '2024',
    category: 'AI Governance', tier_required: 'enterprise',
    description: 'European Union Artificial Intelligence Act. Full lifecycle governance per NIST 800-160.',
    controls: [
      { control_id: 'AIA-Art6', title: 'Classification Rules for High-Risk AI', priority: '1', control_type: 'strategic' },
      { control_id: 'AIA-Art9', title: 'Risk Management System', priority: '1', control_type: 'strategic' },
      { control_id: 'AIA-Art10', title: 'Data and Data Governance', priority: '1', control_type: 'technical' },
      { control_id: 'AIA-Art11', title: 'Technical Documentation', priority: '1', control_type: 'organizational' },
      { control_id: 'AIA-Art12', title: 'Record Keeping / Logging', priority: '1', control_type: 'technical' },
      { control_id: 'AIA-Art13', title: 'Transparency and Information', priority: '1', control_type: 'organizational' },
      { control_id: 'AIA-Art14', title: 'Human Oversight', priority: '1', control_type: 'organizational' },
      { control_id: 'AIA-Art15', title: 'Accuracy, Robustness, Cybersecurity', priority: '1', control_type: 'technical' },
      { control_id: 'AIA-Art17', title: 'Quality Management System', priority: '1', control_type: 'organizational' },
      { control_id: 'AIA-Art22', title: 'Authorized Representative Obligations', priority: '3', control_type: 'organizational' },
      { control_id: 'AIA-Art26', title: 'Deployer Obligations', priority: '1', control_type: 'organizational' },
      { control_id: 'AIA-Art27', title: 'Fundamental Rights Impact Assessment', priority: '1', control_type: 'strategic' },
      { control_id: 'AIA-Art50', title: 'Transparency for Generative AI', priority: '1', control_type: 'organizational' },
      { control_id: 'AIA-Art52', title: 'Prohibited AI Practices', priority: '1', control_type: 'policy' },
      { control_id: 'AIA-Art72', title: 'Penalties for Non-Compliance', priority: '2', control_type: 'organizational' },
    ]
  },
  {
    code: 'iso_42001', name: 'ISO/IEC 42001:2023', version: '2023',
    category: 'AI Governance', tier_required: 'enterprise',
    description: 'AI Management System standard. Lifecycle-aligned per NIST 800-160.',
    controls: [
      { control_id: 'ISO42-4.1', title: 'Understanding the Organization', priority: '1', control_type: 'strategic' },
      { control_id: 'ISO42-4.2', title: 'Needs and Expectations of Interested Parties', priority: '2', control_type: 'strategic' },
      { control_id: 'ISO42-5.1', title: 'Leadership and Commitment', priority: '1', control_type: 'organizational' },
      { control_id: 'ISO42-5.2', title: 'AI Policy', priority: '1', control_type: 'policy' },
      { control_id: 'ISO42-6.1', title: 'Actions to Address AI Risks', priority: '1', control_type: 'strategic' },
      { control_id: 'ISO42-6.2', title: 'AI Objectives and Planning', priority: '1', control_type: 'strategic' },
      { control_id: 'ISO42-7.1', title: 'Resources for AI Management', priority: '2', control_type: 'organizational' },
      { control_id: 'ISO42-7.2', title: 'AI Competence', priority: '2', control_type: 'organizational' },
      { control_id: 'ISO42-8.1', title: 'Operational Planning and Control', priority: '1', control_type: 'technical' },
      { control_id: 'ISO42-8.2', title: 'AI Risk Assessment', priority: '1', control_type: 'strategic' },
      { control_id: 'ISO42-8.3', title: 'AI Risk Treatment', priority: '1', control_type: 'strategic' },
      { control_id: 'ISO42-8.4', title: 'AI Impact Assessment', priority: '1', control_type: 'strategic' },
      { control_id: 'ISO42-9.1', title: 'Monitoring and Measurement', priority: '1', control_type: 'technical' },
      { control_id: 'ISO42-9.2', title: 'Internal Audit', priority: '2', control_type: 'organizational' },
      { control_id: 'ISO42-10.1', title: 'Nonconformity and Corrective Action', priority: '2', control_type: 'organizational' },
      { control_id: 'ISO42-10.2', title: 'Continual Improvement', priority: '2', control_type: 'organizational' },
    ]
  },
  {
    code: 'iso_42005', name: 'ISO/IEC 42005:2025', version: '2025',
    category: 'AI Governance', tier_required: 'enterprise',
    description: 'AI system impact assessment guidance. Plan, document, and monitor AI impact assessments across the AI system lifecycle.',
    controls: [
      { control_id: 'IA-1', title: 'Impact Assessment Scope & Objectives', priority: '1', control_type: 'strategic' },
      { control_id: 'IA-2', title: 'Stakeholders & Impacted Parties Identified', priority: '1', control_type: 'organizational' },
      { control_id: 'IA-3', title: 'AI System Description & Context', priority: '1', control_type: 'strategic' },
      { control_id: 'IA-4', title: 'Data, Model, and Human Oversight Inputs', priority: '1', control_type: 'technical' },
      { control_id: 'IA-5', title: 'Impact Identification (Safety, Fairness, Privacy, Security)', priority: '1', control_type: 'strategic' },
      { control_id: 'IA-6', title: 'Impact Evaluation & Risk Rating', priority: '1', control_type: 'strategic' },
      { control_id: 'IA-7', title: 'Mitigations & Controls Plan', priority: '1', control_type: 'policy' },
      { control_id: 'IA-8', title: 'Documentation, Traceability & Accountability', priority: '2', control_type: 'organizational' },
      { control_id: 'IA-9', title: 'Communication & Transparency', priority: '2', control_type: 'policy' },
      { control_id: 'IA-10', title: 'Monitoring & Lifecycle Updates', priority: '2', control_type: 'technical' },
    ]
  },
  {
    code: 'nist_800_207', name: 'NIST SP 800-207 Zero Trust Architecture (Reference Model)', version: '2020',
    category: 'Reference Model', tier_required: 'enterprise',
    description: 'Zero Trust Architecture reference model and design principles. Not a certifiable compliance framework.',
    controls: [
      { control_id: 'ZTA-1', title: 'Resource Identification and Classification', priority: '1', control_type: 'strategic' },
      { control_id: 'ZTA-2', title: 'Subject/Identity Verification', priority: '1', control_type: 'technical' },
      { control_id: 'ZTA-3', title: 'Least Privilege Access Per-Request', priority: '1', control_type: 'technical' },
      { control_id: 'ZTA-4', title: 'Policy Decision Point (PDP) Implementation', priority: '1', control_type: 'technical' },
      { control_id: 'ZTA-5', title: 'Policy Enforcement Point (PEP) Implementation', priority: '1', control_type: 'technical' },
      { control_id: 'ZTA-6', title: 'Continuous Diagnostics and Monitoring', priority: '1', control_type: 'technical' },
      { control_id: 'ZTA-7', title: 'Dynamic and Risk-Based Policy', priority: '1', control_type: 'strategic' },
      { control_id: 'ZTA-8', title: 'Micro-Segmentation', priority: '1', control_type: 'technical' },
      { control_id: 'ZTA-9', title: 'Encrypted Communications (All Traffic)', priority: '1', control_type: 'technical' },
      { control_id: 'ZTA-10', title: 'Device Health Verification', priority: '1', control_type: 'technical' },
      { control_id: 'ZTA-11', title: 'Multi-Factor Authentication (All Access)', priority: '1', control_type: 'technical' },
      { control_id: 'ZTA-12', title: 'Just-In-Time / Just-Enough Access', priority: '1', control_type: 'technical' },
      { control_id: 'ZTA-13', title: 'Session-Based Trust Evaluation', priority: '2', control_type: 'technical' },
      { control_id: 'ZTA-14', title: 'Behavioral Analytics and Anomaly Detection', priority: '2', control_type: 'technical' },
      { control_id: 'ZTA-15', title: 'Data Loss Prevention in Zero Trust', priority: '2', control_type: 'technical' },
      { control_id: 'ZTA-16', title: 'Network Visibility and Analytics', priority: '1', control_type: 'technical' },
      { control_id: 'ZTA-17', title: 'API Security Gateway', priority: '1', control_type: 'technical' },
      { control_id: 'ZTA-18', title: 'Supply Chain Trust Verification', priority: '2', control_type: 'strategic' },
    ]
  }
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing data
    await client.query('DELETE FROM control_mappings');
    await client.query('DELETE FROM control_implementations');
    await client.query('DELETE FROM framework_controls');
    await client.query('DELETE FROM organization_frameworks');
    await client.query('DELETE FROM frameworks');

    let totalControls = 0;

    for (const fw of frameworks) {
      const fwResult = await client.query(
        `INSERT INTO frameworks (code, name, version, description, category, tier_required, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
        [fw.code, fw.name, fw.version, fw.description, fw.category, fw.tier_required]
      );
      const frameworkId = fwResult.rows[0].id;

      for (const ctrl of fw.controls) {
        await client.query(
          `INSERT INTO framework_controls (framework_id, control_id, title, priority, control_type)
           VALUES ($1, $2, $3, $4, $5)`,
          [frameworkId, ctrl.control_id, ctrl.title, ctrl.priority, ctrl.control_type]
        );
        totalControls++;
      }

      console.log(`  ${fw.code}: ${fw.controls.length} controls (${fw.tier_required} tier)`);
    }

    // Create some crosswalk mappings between common controls
    console.log('\nCreating crosswalk mappings...');
    const mappingPairs = [
      // NIST CSF <-> ISO 27001
      ['PR.AA-01', 'nist_csf_2.0', 'A.5.15', 'iso_27001', 95],
      ['PR.AA-02', 'nist_csf_2.0', 'A.5.17', 'iso_27001', 90],
      ['PR.DS-01', 'nist_csf_2.0', 'A.8.24', 'iso_27001', 85],
      ['DE.CM-01', 'nist_csf_2.0', 'A.8.16', 'iso_27001', 90],
      ['ID.AM-01', 'nist_csf_2.0', 'A.5.9', 'iso_27001', 95],
      ['RS.MA-01', 'nist_csf_2.0', 'A.5.24', 'iso_27001', 90],
      // NIST CSF <-> NIST 800-53
      ['PR.AA-01', 'nist_csf_2.0', 'AC-2', 'nist_800_53', 95],
      ['PR.AA-02', 'nist_csf_2.0', 'IA-2', 'nist_800_53', 95],
      ['DE.CM-01', 'nist_csf_2.0', 'SI-4', 'nist_800_53', 90],
      ['PR.DS-01', 'nist_csf_2.0', 'SC-13', 'nist_800_53', 85],
      ['RS.MA-01', 'nist_csf_2.0', 'IR-4', 'nist_800_53', 95],
      ['PR.IR-01', 'nist_csf_2.0', 'CP-9', 'nist_800_53', 95],
      // ISO 27001 <-> SOC 2
      ['A.5.15', 'iso_27001', 'CC6.1', 'soc2', 90],
      ['A.5.24', 'iso_27001', 'CC7.3', 'soc2', 85],
      ['A.8.15', 'iso_27001', 'CC7.2', 'soc2', 90],
      ['A.8.7', 'iso_27001', 'CC6.8', 'soc2', 90],
      // NIST 800-53 <-> SOC 2
      ['AC-2', 'nist_800_53', 'CC6.2', 'soc2', 90],
      ['IR-4', 'nist_800_53', 'CC7.4', 'soc2', 90],
      ['SI-4', 'nist_800_53', 'CC7.1', 'soc2', 85],
      ['RA-3', 'nist_800_53', 'CC3.2', 'soc2', 90],
      // AI frameworks
      ['GOVERN-1', 'nist_ai_rmf', 'AIA-Art9', 'eu_ai_act', 85],
      ['MEASURE-2', 'nist_ai_rmf', 'AIA-Art15', 'eu_ai_act', 80],
      ['MAP-1', 'nist_ai_rmf', 'AIA-Art6', 'eu_ai_act', 85],
      ['GOVERN-1', 'nist_ai_rmf', 'ISO42-5.2', 'iso_42001', 90],
      ['MEASURE-1', 'nist_ai_rmf', 'ISO42-9.1', 'iso_42001', 85],
      // Zero Trust <-> NIST 800-53
      ['ZTA-2', 'nist_800_207', 'IA-2', 'nist_800_53', 90],
      ['ZTA-3', 'nist_800_207', 'AC-6', 'nist_800_53', 90],
      ['ZTA-6', 'nist_800_207', 'SI-4', 'nist_800_53', 85],
      ['ZTA-9', 'nist_800_207', 'SC-8', 'nist_800_53', 95],
      ['ZTA-11', 'nist_800_207', 'IA-2', 'nist_800_53', 90],
      // Zero Trust <-> NIST CSF
      ['ZTA-6', 'nist_800_207', 'DE.CM-01', 'nist_csf_2.0', 85],
      ['ZTA-3', 'nist_800_207', 'PR.AA-04', 'nist_csf_2.0', 90],
      ['ZTA-8', 'nist_800_207', 'PR.DS-10', 'nist_csf_2.0', 80],
    ];

    let mappingsCreated = 0;
    for (const [srcCtrl, srcFw, tgtCtrl, tgtFw, score] of mappingPairs) {
      const src = await client.query(
        `SELECT fc.id FROM framework_controls fc JOIN frameworks f ON f.id = fc.framework_id WHERE fc.control_id = $1 AND f.code = $2`,
        [srcCtrl, srcFw]
      );
      const tgt = await client.query(
        `SELECT fc.id FROM framework_controls fc JOIN frameworks f ON f.id = fc.framework_id WHERE fc.control_id = $1 AND f.code = $2`,
        [tgtCtrl, tgtFw]
      );

      if (src.rows.length > 0 && tgt.rows.length > 0) {
        await client.query(
          `INSERT INTO control_mappings (source_control_id, target_control_id, mapping_type, similarity_score)
           VALUES ($1, $2, 'equivalent', $3)`,
          [src.rows[0].id, tgt.rows[0].id, score]
        );
        mappingsCreated++;
      }
    }

    await client.query('COMMIT');

    console.log(`\n=== Seed Complete ===`);
    console.log(`Frameworks: ${frameworks.length}`);
    console.log(`Controls: ${totalControls}`);
    console.log(`Crosswalk Mappings: ${mappingsCreated}`);

    // Auto-subscribe the first org to free-tier frameworks
    const orgResult = await pool.query('SELECT id, tier FROM organizations LIMIT 1');
    if (orgResult.rows.length > 0) {
      const org = orgResult.rows[0];
      const freeFrameworks = await pool.query("SELECT id FROM frameworks WHERE tier_required = 'free'");
      for (const fw of freeFrameworks.rows) {
        await pool.query(
          `INSERT INTO organization_frameworks (organization_id, framework_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [org.id, fw.id]
        );
      }
      console.log(`\nAuto-subscribed org (${org.tier} tier) to ${freeFrameworks.rows.length} free frameworks`);
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
