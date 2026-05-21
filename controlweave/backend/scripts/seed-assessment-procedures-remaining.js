/**
 * Seed Assessment Procedures — Remaining Frameworks
 *
 * Adds dedicated assessment procedures for the 8 frameworks that were
 * previously missing them:
 *
 *  1. NERC CIP        (nerc_cip)           — RSAW-based procedures
 *  2. NIST 800-171     (nist_800_171)       — SP 800-171A methodology
 *  3. NIST Privacy     (nist_privacy)       — Privacy audit methodology
 *  4. FISCAM           (fiscam)             — GAO FISCAM audit procedures
 *  5. FFIEC            (ffiec)              — IT Examination procedures
 *  6. NIST 800-207     (nist_800_207)       — Zero Trust maturity assessment
 *  7. CCPA / CPRA      (ccpa_cpra)          — CPPA enforcement methodology
 *  8. State AI Gov     (state_ai_governance) — Algorithmic impact assessment
 *
 * Non-destructive: skips if procedure_id already exists.
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'grc_platform',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ============================================================
// NERC CIP — Reliability Standard Audit Worksheet (RSAW) Style
// ============================================================
const NERC_CIP_PROCEDURES = {
  'CIP-002-6': [
    {
      procedure_id: 'CIP-002-6(a)[01]',
      procedure_type: 'examine',
      title: 'Examine BES Cyber System identification and categorization',
      description: 'Review the documented list of BES Cyber Systems and their categorization (high, medium, low impact) against the criteria in CIP-002-6 Attachment 1.',
      expected_evidence: 'BES Cyber System identification list; impact categorization records; network and asset diagrams; Attachment 1 criteria mapping worksheets',
      assessment_method: 'document_review',
      depth: 'comprehensive',
      frequency_guidance: 'At least every 15 months per NERC audit cycle; updated within 60 days of commissioning changes.',
      assessor_notes: 'Verify each BES Cyber System is categorized using the bright-line criteria in CIP-002-6 Attachment 1. Cross-reference with the asset inventory and one-line diagrams.',
      source_document: 'NERC CIP-002-6 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-002-6(a)[02]',
      procedure_type: 'interview',
      title: 'Interview personnel responsible for BES Cyber System categorization',
      description: 'Interview the CIP Senior Manager and responsible personnel to verify understanding of categorization criteria and the process for maintaining current categorization lists.',
      expected_evidence: 'Interview notes; evidence personnel can explain categorization criteria and update triggers',
      assessment_method: 'personnel_interview',
      depth: 'focused',
      frequency_guidance: 'Each NERC compliance audit cycle (triennial) and during self-certifications.',
      assessor_notes: 'Confirm that the CIP Senior Manager has approved the current categorization list and that a change-trigger process exists for new or decommissioned assets.',
      source_document: 'NERC CIP-002-6 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-002-6(a)[03]',
      procedure_type: 'test',
      title: 'Test completeness of BES Cyber System inventory',
      description: 'Sample BES assets from network diagrams and verify each appears in the categorization list with correct impact rating.',
      expected_evidence: 'Sample test results; reconciliation between network diagrams and categorization list',
      assessment_method: 'system_test',
      depth: 'comprehensive',
      assessor_notes: 'Select a random sample of at least 10% of assets from one-line diagrams and verify they are accounted for in the categorization list.',
      source_document: 'NERC CIP-002-6 Reliability Standard and RSAW Guidelines'
    }
  ],
  'CIP-003-9': [
    {
      procedure_id: 'CIP-003-9(a)[01]',
      procedure_type: 'examine',
      title: 'Examine cyber security policies',
      description: 'Review documented cyber security policies required by CIP-003-9 covering personnel and training, electronic security perimeters, physical security, system security management, incident response, recovery plans, configuration management, information protection, and supply chain risk management.',
      expected_evidence: 'Documented cyber security policy; CIP Senior Manager approval records; policy review and update records',
      assessment_method: 'document_review',
      depth: 'comprehensive',
      frequency_guidance: 'Policy review at least every 15 months; approval records updated upon any CIP Senior Manager change.',
      assessor_notes: 'Verify the policy addresses all nine required topic areas per CIP-003-9 R1. Confirm CIP Senior Manager approval with date.',
      source_document: 'NERC CIP-003-9 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-003-9(a)[02]',
      procedure_type: 'interview',
      title: 'Interview CIP Senior Manager on policy governance',
      description: 'Interview the CIP Senior Manager to verify awareness of policy responsibilities, delegation authority, and the process for annual policy review.',
      expected_evidence: 'Interview notes confirming CIP Senior Manager understands authority and review obligations',
      assessment_method: 'personnel_interview',
      depth: 'focused',
      assessor_notes: 'Verify the CIP Senior Manager can describe the delegation structure and confirm that all delegations are documented per CIP-003-9 R3.',
      source_document: 'NERC CIP-003-9 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-003-9(a)[03]',
      procedure_type: 'examine',
      title: 'Examine plans for low-impact BES Cyber Systems',
      description: 'Review documented cyber security plans for assets containing low-impact BES Cyber Systems per CIP-003-9 R2, covering physical security, electronic access, and cyber security awareness.',
      expected_evidence: 'Low-impact BES Cyber System plans; evidence of implementation; training records',
      assessment_method: 'document_review',
      depth: 'basic',
      assessor_notes: 'Verify each required section of CIP-003-9 Attachment 1 is addressed in the plan for low-impact BES Cyber Systems.',
      source_document: 'NERC CIP-003-9 Reliability Standard and RSAW Guidelines'
    }
  ],
  'CIP-004-7': [
    {
      procedure_id: 'CIP-004-7(a)[01]',
      procedure_type: 'examine',
      title: 'Examine security awareness and training program',
      description: 'Review the security awareness program content, training materials, and completion records for personnel with authorized access to BES Cyber Systems.',
      expected_evidence: 'Training program documentation; completion records with dates; quarterly reinforcement materials',
      assessment_method: 'document_review',
      depth: 'focused',
      frequency_guidance: 'Initial training before access grant; annual refresher; quarterly awareness reinforcement.',
      assessor_notes: 'Verify training covers all CIP-004-7 R1 topics and that completion records show 100% compliance for authorized personnel.',
      source_document: 'NERC CIP-004-7 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-004-7(a)[02]',
      procedure_type: 'examine',
      title: 'Examine personnel risk assessment records',
      description: 'Review personnel risk assessment (PRA) records including identity verification, criminal history checks, and seven-year history reviews for all personnel with authorized electronic or physical access.',
      expected_evidence: 'PRA completion records; background check results; identity verification documentation',
      assessment_method: 'document_review',
      depth: 'comprehensive',
      frequency_guidance: 'Before access grant and every seven years thereafter.',
      assessor_notes: 'Sample at least 10% of personnel files. Verify each PRA was completed before access was granted and includes all CIP-004-7 R3 requirements.',
      source_document: 'NERC CIP-004-7 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-004-7(a)[03]',
      procedure_type: 'test',
      title: 'Test access revocation process',
      description: 'Verify that access revocation procedures are followed when personnel no longer require access, including timely removal from access lists and return of physical access devices.',
      expected_evidence: 'Access revocation records; termination checklists; system access logs showing timely removal',
      assessment_method: 'system_test',
      depth: 'focused',
      assessor_notes: 'Select recent terminations/transfers and verify access was revoked within the required timeframes per CIP-004-7 R5 (24 hours for termination with cause; 30 days for reassignment).',
      source_document: 'NERC CIP-004-7 Reliability Standard and RSAW Guidelines'
    }
  ],
  'CIP-005-7': [
    {
      procedure_id: 'CIP-005-7(a)[01]',
      procedure_type: 'examine',
      title: 'Examine Electronic Security Perimeter documentation',
      description: 'Review network diagrams and documentation defining all Electronic Security Perimeters (ESPs) and their Electronic Access Points (EAPs) protecting high and medium impact BES Cyber Systems.',
      expected_evidence: 'ESP network diagrams; EAP configuration documentation; firewall rule sets; access control lists',
      assessment_method: 'document_review',
      depth: 'comprehensive',
      assessor_notes: 'Verify all high and medium impact BES Cyber Systems reside within a defined ESP. Confirm each EAP is documented with permitted traffic flows.',
      source_document: 'NERC CIP-005-7 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-005-7(a)[02]',
      procedure_type: 'test',
      title: 'Test Electronic Access Point controls',
      description: 'Test firewall rules and access control lists at Electronic Access Points to verify only permitted inbound and outbound traffic is allowed, and deny-by-default rules are enforced.',
      expected_evidence: 'Firewall rule review results; port scan results; penetration test findings related to ESP boundaries',
      assessment_method: 'system_test',
      depth: 'comprehensive',
      assessor_notes: 'Perform port scanning from outside the ESP to verify deny-by-default. Validate that each permitted rule has documented business justification per CIP-005-7 R1.',
      source_document: 'NERC CIP-005-7 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-005-7(a)[03]',
      procedure_type: 'observation',
      title: 'Observe remote access session controls',
      description: 'Observe the Interactive Remote Access process to verify multi-factor authentication, encrypted sessions, and intermediate system usage per CIP-005-7 R2.',
      expected_evidence: 'Observation of remote access session establishment; MFA logs; VPN/encrypted tunnel configuration',
      assessment_method: 'observation',
      depth: 'focused',
      assessor_notes: 'Observe at least one live remote access session. Verify intermediate system is used, MFA is enforced, and session is encrypted end-to-end.',
      source_document: 'NERC CIP-005-7 Reliability Standard and RSAW Guidelines'
    }
  ],
  'CIP-006-6': [
    {
      procedure_id: 'CIP-006-6(a)[01]',
      procedure_type: 'examine',
      title: 'Examine Physical Security Plan',
      description: 'Review the physical security plan defining Physical Security Perimeters (PSPs) for high and medium impact BES Cyber Systems, including access controls, monitoring, and visitor management.',
      expected_evidence: 'Physical Security Plan; PSP diagrams; physical access control system (PACS) configuration; visitor log procedures',
      assessment_method: 'document_review',
      depth: 'comprehensive',
      assessor_notes: 'Verify each defined PSP has at least two physical access controls (e.g., card reader + PIN, or card reader + escort) per CIP-006-6 R1.',
      source_document: 'NERC CIP-006-6 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-006-6(a)[02]',
      procedure_type: 'observation',
      title: 'Observe Physical Security Perimeter controls',
      description: 'Physically inspect PSP boundaries, access points, and monitoring systems (cameras, alarms) protecting BES Cyber Systems.',
      expected_evidence: 'Observation notes; photographs of PSP boundaries, access control hardware, and monitoring equipment',
      assessment_method: 'physical_inspection',
      depth: 'comprehensive',
      frequency_guidance: 'Each NERC compliance audit cycle; spot-checks during self-certification.',
      assessor_notes: 'Walk each PSP boundary. Verify all access points have operational controls, doors/gates are properly secured, and monitoring coverage has no blind spots.',
      source_document: 'NERC CIP-006-6 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-006-6(a)[03]',
      procedure_type: 'test',
      title: 'Test physical access logging and alerting',
      description: 'Test the PACS to verify that access events are logged and unauthorized access attempts generate alerts within the required timeframe.',
      expected_evidence: 'PACS event logs; alert configuration; test results from simulated unauthorized access',
      assessment_method: 'system_test',
      depth: 'focused',
      assessor_notes: 'Attempt tailgating or badge presentation at a controlled door to verify alerts trigger. Review 90 days of PACS logs for completeness.',
      source_document: 'NERC CIP-006-6 Reliability Standard and RSAW Guidelines'
    }
  ],
  'CIP-007-6': [
    {
      procedure_id: 'CIP-007-6(a)[01]',
      procedure_type: 'examine',
      title: 'Examine system hardening and port/service documentation',
      description: 'Review documentation of enabled ports and services on BES Cyber Systems, including business justification for each enabled service per CIP-007-6 R1.',
      expected_evidence: 'Port and service documentation with justification; baseline configuration records; hardening checklists',
      assessment_method: 'document_review',
      depth: 'comprehensive',
      assessor_notes: 'Verify each enabled port/service has documented business justification. Compare documented baselines against actual system configurations.',
      source_document: 'NERC CIP-007-6 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-007-6(a)[02]',
      procedure_type: 'test',
      title: 'Test patch management and security patch application',
      description: 'Verify that security patches are evaluated within 35 days of availability and applied or mitigated per CIP-007-6 R2. Test a sample of systems for current patch status.',
      expected_evidence: 'Patch evaluation records; patch deployment logs; compensating measure documentation for deferred patches',
      assessment_method: 'system_test',
      depth: 'comprehensive',
      frequency_guidance: 'Continuous patch monitoring; 35-day evaluation window per CIP-007-6 R2.',
      assessor_notes: 'Sample at least 3 BES Cyber Systems. Verify patch evaluation completed within 35 days. If patches are not applied, verify documented compensating measures.',
      source_document: 'NERC CIP-007-6 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-007-6(a)[03]',
      procedure_type: 'test',
      title: 'Test malicious code prevention and log monitoring',
      description: 'Verify anti-malware tools are deployed and signature-current on applicable systems (CIP-007-6 R3), and that security event logs are reviewed per R4.',
      expected_evidence: 'Anti-malware deployment records; signature update logs; security event log review records',
      assessment_method: 'system_test',
      depth: 'focused',
      assessor_notes: 'Verify anti-malware signatures are current. Review sample log review records to confirm events are reviewed at least every 15 days per R4.',
      source_document: 'NERC CIP-007-6 Reliability Standard and RSAW Guidelines'
    }
  ],
  'CIP-008-6': [
    {
      procedure_id: 'CIP-008-6(a)[01]',
      procedure_type: 'examine',
      title: 'Examine Cyber Security Incident Response Plan',
      description: 'Review the documented Cyber Security Incident Response Plan covering identification, classification, response, notification to ES-ISAC, and roles/responsibilities per CIP-008-6 R1.',
      expected_evidence: 'Incident Response Plan; role assignments; notification procedures; ES-ISAC reporting templates',
      assessment_method: 'document_review',
      depth: 'comprehensive',
      frequency_guidance: 'Plan review at least every 15 months; updated within 60 days of plan activation or lessons learned.',
      assessor_notes: 'Verify the plan includes all CIP-008-6 R1 requirements: identification, classification, notification to ES-ISAC within 1 hour for reportable incidents, and defined roles.',
      source_document: 'NERC CIP-008-6 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-008-6(a)[02]',
      procedure_type: 'examine',
      title: 'Examine incident response test records',
      description: 'Review records of incident response plan testing (tabletop or operational exercises) conducted at least every 15 months per CIP-008-6 R2.',
      expected_evidence: 'Exercise records; after-action reports; lessons learned documentation; plan updates from exercises',
      assessment_method: 'document_review',
      depth: 'focused',
      assessor_notes: 'Verify exercises are conducted within every 15-month window and lessons learned are incorporated into plan updates.',
      source_document: 'NERC CIP-008-6 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-008-6(a)[03]',
      procedure_type: 'interview',
      title: 'Interview incident response team members',
      description: 'Interview incident response team members to verify understanding of their roles, notification procedures, and ES-ISAC reporting requirements.',
      expected_evidence: 'Interview notes confirming team members understand procedures and can describe response actions',
      assessment_method: 'personnel_interview',
      depth: 'focused',
      assessor_notes: 'Interview at least 2 members of the incident response team. Verify they can describe the notification timeline and ES-ISAC reporting process.',
      source_document: 'NERC CIP-008-6 Reliability Standard and RSAW Guidelines'
    }
  ],
  'CIP-009-6': [
    {
      procedure_id: 'CIP-009-6(a)[01]',
      procedure_type: 'examine',
      title: 'Examine Recovery Plans for BES Cyber Systems',
      description: 'Review documented recovery plans for high and medium impact BES Cyber Systems specifying conditions for activation, roles, backup/restore procedures, and recovery time objectives.',
      expected_evidence: 'Recovery plan documentation; backup procedures; recovery time objectives; roles and responsibilities',
      assessment_method: 'document_review',
      depth: 'comprehensive',
      frequency_guidance: 'Plan review at least every 15 months; updated within 60 days of activation or testing.',
      assessor_notes: 'Verify recovery plans cover all CIP-009-6 R1 elements. Confirm backup media is stored in a separate location from the primary BES Cyber System.',
      source_document: 'NERC CIP-009-6 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-009-6(a)[02]',
      procedure_type: 'test',
      title: 'Test recovery plan execution',
      description: 'Verify that recovery plans have been tested at least every 15 months per CIP-009-6 R2, and that test results demonstrate successful recovery capability.',
      expected_evidence: 'Recovery test records; test results; identified gaps and corrective actions',
      assessment_method: 'system_test',
      depth: 'comprehensive',
      assessor_notes: 'Review most recent recovery test. Verify backup data was successfully restored and system was operational within documented recovery time objectives.',
      source_document: 'NERC CIP-009-6 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-009-6(a)[03]',
      procedure_type: 'examine',
      title: 'Examine backup verification records',
      description: 'Review records verifying that backup media are tested and information necessary for recovery is available and current per CIP-009-6 R3.',
      expected_evidence: 'Backup verification logs; backup integrity test results; offsite storage records',
      assessment_method: 'document_review',
      depth: 'focused',
      assessor_notes: 'Verify backup integrity is tested at least once per recovery plan test cycle. Confirm backup media are stored securely offsite.',
      source_document: 'NERC CIP-009-6 Reliability Standard and RSAW Guidelines'
    }
  ],
  'CIP-010-4': [
    {
      procedure_id: 'CIP-010-4(a)[01]',
      procedure_type: 'examine',
      title: 'Examine configuration baseline documentation',
      description: 'Review documented baseline configurations for BES Cyber Systems including OS, firmware, ports/services, security patches, and custom software per CIP-010-4 R1.',
      expected_evidence: 'Baseline configuration records; change authorization records; current vs. baseline comparison reports',
      assessment_method: 'document_review',
      depth: 'comprehensive',
      assessor_notes: 'Verify baselines include all five required elements: OS/firmware, ports/services, custom software, security patches, and logical network access points.',
      source_document: 'NERC CIP-010-4 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-010-4(a)[02]',
      procedure_type: 'test',
      title: 'Test configuration change management controls',
      description: 'Verify that configuration changes to BES Cyber Systems follow the documented change management process including authorization, testing, and baseline updates per CIP-010-4 R1.',
      expected_evidence: 'Change request records; authorization signatures; test results; updated baseline documentation',
      assessment_method: 'system_test',
      depth: 'focused',
      assessor_notes: 'Select 3-5 recent configuration changes and trace through the full lifecycle: request, authorization, testing, implementation, baseline update.',
      source_document: 'NERC CIP-010-4 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-010-4(a)[03]',
      procedure_type: 'test',
      title: 'Test vulnerability assessment process',
      description: 'Verify vulnerability assessments are conducted at least every 15 months per CIP-010-4 R3, including document review, active scanning, and action plan development.',
      expected_evidence: 'Vulnerability assessment reports; scanning tool outputs; remediation action plans',
      assessment_method: 'system_test',
      depth: 'comprehensive',
      frequency_guidance: 'At least every 15 months and after significant changes.',
      assessor_notes: 'Verify assessments cover all high and medium impact BES Cyber Systems. Confirm action plans exist for identified vulnerabilities.',
      source_document: 'NERC CIP-010-4 Reliability Standard and RSAW Guidelines'
    }
  ],
  'CIP-011-3': [
    {
      procedure_id: 'CIP-011-3(a)[01]',
      procedure_type: 'examine',
      title: 'Examine information protection program',
      description: 'Review the documented methods for identifying and protecting BES Cyber System Information (BCSI) in storage and transit per CIP-011-3 R1.',
      expected_evidence: 'BCSI identification procedures; storage protection documentation; encryption or access control records',
      assessment_method: 'document_review',
      depth: 'comprehensive',
      assessor_notes: 'Verify BCSI includes: security procedures, network diagrams, floor plans, equipment layouts, and configuration information. Confirm protection methods are appropriate.',
      source_document: 'NERC CIP-011-3 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-011-3(a)[02]',
      procedure_type: 'test',
      title: 'Test BCSI access controls',
      description: 'Test access controls protecting BES Cyber System Information to verify only authorized personnel can access BCSI and that access is logged.',
      expected_evidence: 'BCSI access control configuration; access logs; unauthorized access attempt test results',
      assessment_method: 'system_test',
      depth: 'focused',
      assessor_notes: 'Attempt to access BCSI storage as an unauthorized user. Verify access is denied and the attempt is logged.',
      source_document: 'NERC CIP-011-3 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-011-3(a)[03]',
      procedure_type: 'examine',
      title: 'Examine BES Cyber Asset reuse and disposal records',
      description: 'Review records for BES Cyber Asset reuse and disposal to verify BCSI is removed or destroyed before release per CIP-011-3 R2.',
      expected_evidence: 'Media sanitization records; certificate of destruction; asset disposal logs',
      assessment_method: 'document_review',
      depth: 'focused',
      assessor_notes: 'Verify sanitization methods are appropriate for media type (e.g., NIST SP 800-88 guidance). Confirm certificates of destruction are retained.',
      source_document: 'NERC CIP-011-3 Reliability Standard and RSAW Guidelines'
    }
  ],
  'CIP-013-2': [
    {
      procedure_id: 'CIP-013-2(a)[01]',
      procedure_type: 'examine',
      title: 'Examine supply chain cyber security risk management plan',
      description: 'Review the documented supply chain risk management plan covering vendor assessment, software integrity verification, and remote access controls for vendors per CIP-013-2 R1.',
      expected_evidence: 'Supply chain risk management plan; vendor risk assessment records; software verification procedures',
      assessment_method: 'document_review',
      depth: 'comprehensive',
      frequency_guidance: 'Plan review at least every 15 months.',
      assessor_notes: 'Verify the plan addresses all six CIP-013-2 R1 risk considerations including vendor notification of incidents, software integrity, and remote access management.',
      source_document: 'NERC CIP-013-2 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-013-2(a)[02]',
      procedure_type: 'examine',
      title: 'Examine vendor procurement and contract records',
      description: 'Review procurement records and contracts for BES Cyber System vendors to verify supply chain risk management requirements are included per CIP-013-2 R2.',
      expected_evidence: 'Procurement records; vendor contracts with security clauses; vendor risk assessment results',
      assessment_method: 'document_review',
      depth: 'focused',
      assessor_notes: 'Sample recent vendor procurements and verify supply chain risk management plan requirements were applied during the procurement process.',
      source_document: 'NERC CIP-013-2 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-013-2(a)[03]',
      procedure_type: 'interview',
      title: 'Interview procurement and vendor management personnel',
      description: 'Interview procurement and vendor management personnel to verify understanding and implementation of supply chain risk management requirements.',
      expected_evidence: 'Interview notes confirming personnel understand supply chain risk requirements and integration into procurement',
      assessment_method: 'personnel_interview',
      depth: 'focused',
      assessor_notes: 'Verify personnel can describe how supply chain risk assessments are conducted and how vendor security requirements are communicated and tracked.',
      source_document: 'NERC CIP-013-2 Reliability Standard and RSAW Guidelines'
    }
  ],
  'CIP-014-3': [
    {
      procedure_id: 'CIP-014-3(a)[01]',
      procedure_type: 'examine',
      title: 'Examine transmission station risk assessment',
      description: 'Review the risk assessment for transmission stations and substations identifying those critical to BES reliability per CIP-014-3 R1-R2.',
      expected_evidence: 'Transmission station risk assessment; third-party verification report; list of critical facilities',
      assessment_method: 'document_review',
      depth: 'comprehensive',
      frequency_guidance: 'Initial assessment and every 30 months thereafter; third-party verification required.',
      assessor_notes: 'Verify the risk assessment was performed by or verified by an independent third party per CIP-014-3 R2.',
      source_document: 'NERC CIP-014-3 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-014-3(a)[02]',
      procedure_type: 'observation',
      title: 'Observe physical security measures at critical transmission stations',
      description: 'Physically inspect the security measures at identified critical transmission stations to verify adequate physical protection per CIP-014-3 R5.',
      expected_evidence: 'Physical inspection notes; photographs; security measure documentation',
      assessment_method: 'physical_inspection',
      depth: 'comprehensive',
      assessor_notes: 'Inspect perimeter security, surveillance systems, and detection capabilities. Verify security measures address threats identified in the risk assessment.',
      source_document: 'NERC CIP-014-3 Reliability Standard and RSAW Guidelines'
    },
    {
      procedure_id: 'CIP-014-3(a)[03]',
      procedure_type: 'examine',
      title: 'Examine third-party physical security evaluation',
      description: 'Review the third-party evaluation of physical security plans and measures required by CIP-014-3 R6.',
      expected_evidence: 'Third-party evaluation report; recommendations; action items and their disposition',
      assessment_method: 'document_review',
      depth: 'focused',
      assessor_notes: 'Verify the evaluation was conducted by a qualified third party and that recommendations have been addressed or documented with rationale for non-adoption.',
      source_document: 'NERC CIP-014-3 Reliability Standard and RSAW Guidelines'
    }
  ],
};

// ============================================================
// NIST SP 800-171 — SP 800-171A Assessment Methodology
// ============================================================
const NIST_800_171_PROCEDURES = {
  '03.01.01': [
    { procedure_id: '03.01.01[E01]', procedure_type: 'examine', title: 'Examine account management procedures', description: 'Examine account management policy, procedures, and system settings for identifying, creating, enabling, modifying, disabling, and removing CUI system accounts.', expected_evidence: 'Account management policy; system account lists; provisioning/deprovisioning records', assessment_method: 'document_review', depth: 'focused', source_document: 'NIST SP 800-171A' },
    { procedure_id: '03.01.01[I01]', procedure_type: 'interview', title: 'Interview account management personnel', description: 'Interview system administrators to confirm account management procedures are understood and followed.', expected_evidence: 'Interview notes', assessment_method: 'personnel_interview', depth: 'focused', source_document: 'NIST SP 800-171A' },
    { procedure_id: '03.01.01[T01]', procedure_type: 'test', title: 'Test account management mechanisms', description: 'Test account creation, modification, and removal processes on CUI systems.', expected_evidence: 'Test results demonstrating proper account lifecycle management', assessment_method: 'system_test', depth: 'focused', source_document: 'NIST SP 800-171A' },
  ],
  '03.01.02': [
    { procedure_id: '03.01.02[E01]', procedure_type: 'examine', title: 'Examine access enforcement policy', description: 'Examine access control policy and system configuration to verify enforcement of approved authorizations for CUI access.', expected_evidence: 'Access control policy; system ACLs; role-based access configurations', assessment_method: 'document_review', depth: 'focused', source_document: 'NIST SP 800-171A' },
    { procedure_id: '03.01.02[I01]', procedure_type: 'interview', title: 'Interview access control administrators', description: 'Interview personnel responsible for access enforcement on CUI systems.', expected_evidence: 'Interview notes', assessment_method: 'personnel_interview', depth: 'basic', source_document: 'NIST SP 800-171A' },
    { procedure_id: '03.01.02[T01]', procedure_type: 'test', title: 'Test access enforcement mechanisms', description: 'Test access control mechanisms by attempting authorized and unauthorized access to CUI.', expected_evidence: 'Test results showing enforcement of authorized access only', assessment_method: 'system_test', depth: 'focused', source_document: 'NIST SP 800-171A' },
  ],
  '03.01.05': [
    { procedure_id: '03.01.05[E01]', procedure_type: 'examine', title: 'Examine least privilege policy', description: 'Examine least privilege policy and role/entitlement assignments for CUI systems.', expected_evidence: 'Least privilege policy; role definitions; privilege assignment records', assessment_method: 'document_review', depth: 'focused', source_document: 'NIST SP 800-171A' },
    { procedure_id: '03.01.05[T01]', procedure_type: 'test', title: 'Test least privilege enforcement', description: 'Test that users are restricted to minimum access necessary for their duties on CUI systems.', expected_evidence: 'Test results verifying least privilege enforcement', assessment_method: 'system_test', depth: 'focused', source_document: 'NIST SP 800-171A' },
  ],
  '03.05.03': [
    { procedure_id: '03.05.03[E01]', procedure_type: 'examine', title: 'Examine MFA implementation', description: 'Examine multi-factor authentication configuration for local and network access to CUI systems.', expected_evidence: 'MFA policy; system authentication settings; MFA enrollment records', assessment_method: 'document_review', depth: 'focused', source_document: 'NIST SP 800-171A' },
    { procedure_id: '03.05.03[T01]', procedure_type: 'test', title: 'Test MFA enforcement', description: 'Test MFA enforcement for privileged and non-privileged accounts accessing CUI.', expected_evidence: 'Test results showing MFA is required for all CUI system access', assessment_method: 'system_test', depth: 'comprehensive', source_document: 'NIST SP 800-171A' },
  ],
  '03.06.01': [
    { procedure_id: '03.06.01[E01]', procedure_type: 'examine', title: 'Examine incident handling procedures', description: 'Examine incident response plan, procedures, and recent incident records for CUI systems.', expected_evidence: 'Incident response plan; incident tickets; after-action reports', assessment_method: 'document_review', depth: 'focused', source_document: 'NIST SP 800-171A' },
    { procedure_id: '03.06.01[I01]', procedure_type: 'interview', title: 'Interview incident response team', description: 'Interview incident response team members about their roles and CUI-specific procedures.', expected_evidence: 'Interview notes confirming understanding of CUI incident procedures', assessment_method: 'personnel_interview', depth: 'focused', source_document: 'NIST SP 800-171A' },
  ],
  '03.11.01': [
    { procedure_id: '03.11.01[E01]', procedure_type: 'examine', title: 'Examine risk assessment', description: 'Examine the organizational risk assessment covering CUI systems, including threat identification and risk determinations.', expected_evidence: 'Risk assessment report; threat analysis; risk register', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'NIST SP 800-171A' },
    { procedure_id: '03.11.01[I01]', procedure_type: 'interview', title: 'Interview risk assessment personnel', description: 'Interview personnel responsible for conducting risk assessments on CUI systems.', expected_evidence: 'Interview notes', assessment_method: 'personnel_interview', depth: 'focused', source_document: 'NIST SP 800-171A' },
  ],
  '03.11.02': [
    { procedure_id: '03.11.02[E01]', procedure_type: 'examine', title: 'Examine vulnerability scanning records', description: 'Examine vulnerability scanning policy, schedules, and results for CUI systems.', expected_evidence: 'Scanning policy; scan reports; remediation tracking records', assessment_method: 'document_review', depth: 'focused', source_document: 'NIST SP 800-171A' },
    { procedure_id: '03.11.02[T01]', procedure_type: 'test', title: 'Test vulnerability scanning coverage', description: 'Verify vulnerability scans cover all CUI systems and that findings are remediated per policy.', expected_evidence: 'Scan coverage reports; remediation evidence', assessment_method: 'system_test', depth: 'focused', source_document: 'NIST SP 800-171A' },
  ],
};

// ============================================================
// NIST Privacy Framework — Privacy Audit Methodology
// ============================================================
const NIST_PRIVACY_PROCEDURES = {
  'ID-P.01': [
    { procedure_id: 'ID-P.01[E01]', procedure_type: 'examine', title: 'Examine data processing inventory', description: 'Examine the data processing inventory/map to verify all personal data processing activities are identified, categorized, and maintained.', expected_evidence: 'Data processing inventory; data flow diagrams; records of processing activities', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'NIST Privacy Framework 1.0' },
    { procedure_id: 'ID-P.01[I01]', procedure_type: 'interview', title: 'Interview data stewards', description: 'Interview data stewards to confirm data processing inventory accuracy and update processes.', expected_evidence: 'Interview notes', assessment_method: 'personnel_interview', depth: 'focused', source_document: 'NIST Privacy Framework 1.0' },
  ],
  'GV-P.01': [
    { procedure_id: 'GV-P.01[E01]', procedure_type: 'examine', title: 'Examine privacy policy', description: 'Examine the organizational privacy policy for completeness, currency, and alignment with applicable regulations.', expected_evidence: 'Privacy policy; approval records; dissemination evidence', assessment_method: 'document_review', depth: 'focused', source_document: 'NIST Privacy Framework 1.0' },
    { procedure_id: 'GV-P.01[I01]', procedure_type: 'interview', title: 'Interview privacy officer', description: 'Interview the privacy officer on policy governance, review cycles, and enforcement.', expected_evidence: 'Interview notes', assessment_method: 'personnel_interview', depth: 'focused', source_document: 'NIST Privacy Framework 1.0' },
  ],
  'CT-P.01': [
    { procedure_id: 'CT-P.01[E01]', procedure_type: 'examine', title: 'Examine data processing policies', description: 'Examine policies governing data processing to verify they cover purpose limitation, data minimization, and retention.', expected_evidence: 'Data processing policies; retention schedules; minimization procedures', assessment_method: 'document_review', depth: 'focused', source_document: 'NIST Privacy Framework 1.0' },
  ],
  'CM-P.01': [
    { procedure_id: 'CM-P.01[E01]', procedure_type: 'examine', title: 'Examine privacy notice and communication', description: 'Examine privacy notices to verify individuals are informed about data processing in clear, accessible language.', expected_evidence: 'Privacy notices; communication records; accessibility compliance evidence', assessment_method: 'document_review', depth: 'focused', source_document: 'NIST Privacy Framework 1.0' },
  ],
  'CM-P.02': [
    { procedure_id: 'CM-P.02[E01]', procedure_type: 'examine', title: 'Examine consent mechanisms', description: 'Examine consent collection mechanisms for proper implementation including opt-in/opt-out choices.', expected_evidence: 'Consent forms/interfaces; consent records; preference management system configuration', assessment_method: 'document_review', depth: 'focused', source_document: 'NIST Privacy Framework 1.0' },
    { procedure_id: 'CM-P.02[T01]', procedure_type: 'test', title: 'Test consent workflow', description: 'Test consent collection, modification, and withdrawal workflows for proper functioning.', expected_evidence: 'Test results for consent lifecycle', assessment_method: 'system_test', depth: 'focused', source_document: 'NIST Privacy Framework 1.0' },
  ],
};

// ============================================================
// FISCAM — GAO Federal Information System Controls Audit Manual
// ============================================================
const FISCAM_PROCEDURES = {
  'SM-1': [
    { procedure_id: 'SM-1[E01]', procedure_type: 'inspection', title: 'Inspect security management program', description: 'Inspect the information security program documentation to verify it addresses all GAO FISCAM security management requirements.', expected_evidence: 'Security program charter; security plans; budget allocation for security', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'GAO FISCAM' },
    { procedure_id: 'SM-1[IQ01]', procedure_type: 'inquiry', title: 'Inquire about security program governance', description: 'Inquire of management about the security program structure, reporting lines, and resource allocation.', expected_evidence: 'Management responses; organizational charts', assessment_method: 'personnel_interview', depth: 'focused', source_document: 'GAO FISCAM' },
  ],
  'SM-2': [
    { procedure_id: 'SM-2[E01]', procedure_type: 'inspection', title: 'Inspect risk assessment documentation', description: 'Inspect the risk assessment to verify threats, vulnerabilities, and risk determinations are documented for financial systems.', expected_evidence: 'Risk assessment; threat/vulnerability analysis; risk register', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'GAO FISCAM' },
  ],
  'AC-FM-1': [
    { procedure_id: 'AC-FM-1[E01]', procedure_type: 'inspection', title: 'Inspect user account controls', description: 'Inspect user account provisioning, modification, and termination processes for financial systems.', expected_evidence: 'Account management procedures; provisioning records; termination checklists', assessment_method: 'document_review', depth: 'focused', source_document: 'GAO FISCAM' },
    { procedure_id: 'AC-FM-1[O01]', procedure_type: 'observation', title: 'Observe account provisioning process', description: 'Observe the account provisioning process for a financial system to verify proper controls are followed.', expected_evidence: 'Observation notes; evidence of approval workflow', assessment_method: 'observation', depth: 'focused', source_document: 'GAO FISCAM' },
  ],
  'SC-1': [
    { procedure_id: 'SC-1[E01]', procedure_type: 'inspection', title: 'Inspect segregation of duties', description: 'Inspect role assignments and system access to verify adequate segregation of duties for financial processing.', expected_evidence: 'Segregation of duties matrix; role assignments; conflict analysis', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'GAO FISCAM' },
  ],
};

// ============================================================
// FFIEC — IT Examination Procedures
// ============================================================
const FFIEC_PROCEDURES = {
  'FFIEC-IS-1': [
    { procedure_id: 'FFIEC-IS-1[E01]', procedure_type: 'examine', title: 'Examine information security program', description: 'Examine the institution\'s written information security program for completeness per FFIEC guidance, including risk assessment, policies, and board oversight.', expected_evidence: 'Information security program document; board reporting; risk assessment; policies', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'FFIEC IT Examination Handbook — Information Security' },
    { procedure_id: 'FFIEC-IS-1[I01]', procedure_type: 'interview', title: 'Interview CISO on security program', description: 'Interview the CISO or equivalent to assess understanding and implementation of the information security program.', expected_evidence: 'Interview notes; evidence of board engagement', assessment_method: 'personnel_interview', depth: 'focused', source_document: 'FFIEC IT Examination Handbook — Information Security' },
  ],
  'FFIEC-IS-2': [
    { procedure_id: 'FFIEC-IS-2[E01]', procedure_type: 'examine', title: 'Examine risk assessment methodology', description: 'Examine the institution\'s IT risk assessment methodology and results.', expected_evidence: 'Risk assessment methodology; risk registers; threat analysis', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'FFIEC IT Examination Handbook — Information Security' },
  ],
  'FFIEC-BCP-1': [
    { procedure_id: 'FFIEC-BCP-1[E01]', procedure_type: 'examine', title: 'Examine BCP documentation', description: 'Examine business continuity planning documentation including BIA, recovery strategies, and testing records.', expected_evidence: 'BCP document; BIA; recovery strategies; test results', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'FFIEC IT Examination Handbook — Business Continuity' },
    { procedure_id: 'FFIEC-BCP-1[I01]', procedure_type: 'interview', title: 'Interview BCP coordinator', description: 'Interview the BCP coordinator on program maturity, testing frequency, and lessons learned.', expected_evidence: 'Interview notes', assessment_method: 'personnel_interview', depth: 'focused', source_document: 'FFIEC IT Examination Handbook — Business Continuity' },
  ],
  'FFIEC-AM-1': [
    { procedure_id: 'FFIEC-AM-1[E01]', procedure_type: 'examine', title: 'Examine authentication controls', description: 'Examine authentication and access management controls including MFA, password policies, and privileged access management.', expected_evidence: 'Authentication policy; MFA configuration; privileged access records', assessment_method: 'document_review', depth: 'focused', source_document: 'FFIEC IT Examination Handbook — Information Security' },
    { procedure_id: 'FFIEC-AM-1[T01]', procedure_type: 'test', title: 'Test authentication mechanisms', description: 'Test authentication mechanisms for strength and proper enforcement including MFA bypass attempts.', expected_evidence: 'Test results; MFA enforcement evidence', assessment_method: 'system_test', depth: 'focused', source_document: 'FFIEC IT Examination Handbook — Information Security' },
  ],
  'FFIEC-CYB-1': [
    { procedure_id: 'FFIEC-CYB-1[E01]', procedure_type: 'examine', title: 'Examine cybersecurity assessment', description: 'Examine the institution\'s cybersecurity assessment tool results and inherent risk profile.', expected_evidence: 'FFIEC CAT results; inherent risk profile; maturity assessment', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'FFIEC Cybersecurity Assessment Tool' },
  ],
};

// ============================================================
// NIST SP 800-207 — Zero Trust Maturity Assessment
// ============================================================
const NIST_800_207_PROCEDURES = {
  'ZTA-1': [
    { procedure_id: 'ZTA-1[E01]', procedure_type: 'examine', title: 'Examine resource classification', description: 'Examine the inventory and classification of all enterprise resources for zero trust coverage.', expected_evidence: 'Resource inventory; classification scheme; coverage analysis', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'NIST SP 800-207' },
  ],
  'ZTA-2': [
    { procedure_id: 'ZTA-2[E01]', procedure_type: 'examine', title: 'Examine identity verification architecture', description: 'Examine the identity verification architecture including identity providers, directory services, and federation configurations.', expected_evidence: 'Identity architecture documentation; IdP configuration; federation agreements', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'NIST SP 800-207' },
    { procedure_id: 'ZTA-2[T01]', procedure_type: 'test', title: 'Test identity verification enforcement', description: 'Test that identity verification is enforced for all resource access requests without exception.', expected_evidence: 'Test results showing identity verification on all access paths', assessment_method: 'system_test', depth: 'comprehensive', source_document: 'NIST SP 800-207' },
  ],
  'ZTA-3': [
    { procedure_id: 'ZTA-3[E01]', procedure_type: 'examine', title: 'Examine least privilege per-request model', description: 'Examine the per-request access decision architecture and least-privilege enforcement policies.', expected_evidence: 'Policy architecture documentation; access decision logs; PDP configuration', assessment_method: 'document_review', depth: 'focused', source_document: 'NIST SP 800-207' },
    { procedure_id: 'ZTA-3[T01]', procedure_type: 'test', title: 'Test per-request authorization', description: 'Test that each resource request triggers an independent authorization decision.', expected_evidence: 'Test results showing per-request enforcement', assessment_method: 'system_test', depth: 'comprehensive', source_document: 'NIST SP 800-207' },
  ],
  'ZTA-6': [
    { procedure_id: 'ZTA-6[E01]', procedure_type: 'examine', title: 'Examine continuous monitoring', description: 'Examine continuous diagnostics and monitoring (CDM) implementation for zero trust coverage.', expected_evidence: 'CDM architecture; monitoring dashboards; alert configurations', assessment_method: 'document_review', depth: 'focused', source_document: 'NIST SP 800-207' },
    { procedure_id: 'ZTA-6[T01]', procedure_type: 'test', title: 'Test monitoring detection capability', description: 'Test that anomalous behavior triggers CDM alerts and policy re-evaluation.', expected_evidence: 'Test results; alert logs from simulated anomalies', assessment_method: 'system_test', depth: 'comprehensive', source_document: 'NIST SP 800-207' },
  ],
  'ZTA-11': [
    { procedure_id: 'ZTA-11[E01]', procedure_type: 'examine', title: 'Examine MFA implementation', description: 'Examine MFA implementation across all zero trust access points.', expected_evidence: 'MFA policy; enrollment records; configuration documentation', assessment_method: 'document_review', depth: 'focused', source_document: 'NIST SP 800-207' },
    { procedure_id: 'ZTA-11[T01]', procedure_type: 'test', title: 'Test MFA enforcement at all access points', description: 'Test that MFA is required at every access point with no bypass paths.', expected_evidence: 'Test results showing universal MFA enforcement', assessment_method: 'system_test', depth: 'comprehensive', source_document: 'NIST SP 800-207' },
  ],
};

// ============================================================
// CCPA / CPRA — CPPA Enforcement Methodology
// ============================================================
const CCPA_CPRA_PROCEDURES = {
  'CCPA-1': [
    { procedure_id: 'CCPA-1[E01]', procedure_type: 'audit_step', title: 'Audit right-to-know processes', description: 'Audit the consumer right-to-know / access request process including intake, verification, fulfillment within 45 days, and response completeness.', expected_evidence: 'Request intake logs; verification procedures; response records with timestamps; 12-month activity reports', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'CCPA/CPRA Regulations and CPPA Enforcement Guidance' },
    { procedure_id: 'CCPA-1[T01]', procedure_type: 'test', title: 'Test access request fulfillment', description: 'Submit a test consumer access request and verify the response is complete, timely, and in a portable format.', expected_evidence: 'Test request results; response content; timeline verification', assessment_method: 'system_test', depth: 'focused', source_document: 'CCPA/CPRA Regulations and CPPA Enforcement Guidance' },
  ],
  'CCPA-2': [
    { procedure_id: 'CCPA-2[E01]', procedure_type: 'audit_step', title: 'Audit right-to-delete processes', description: 'Audit the consumer deletion request process including verification, downstream vendor notification, and confirmation to the consumer.', expected_evidence: 'Deletion request logs; vendor notification records; consumer confirmation records', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'CCPA/CPRA Regulations and CPPA Enforcement Guidance' },
  ],
  'CCPA-3': [
    { procedure_id: 'CCPA-3[E01]', procedure_type: 'audit_step', title: 'Audit opt-out mechanisms', description: 'Audit the "Do Not Sell or Share My Personal Information" mechanism for prominence, accessibility, and proper enforcement.', expected_evidence: 'Website/app screenshots; opt-out mechanism configuration; downstream enforcement records', assessment_method: 'document_review', depth: 'focused', source_document: 'CCPA/CPRA Regulations and CPPA Enforcement Guidance' },
    { procedure_id: 'CCPA-3[T01]', procedure_type: 'test', title: 'Test opt-out enforcement', description: 'Test the opt-out mechanism end-to-end and verify sale/sharing ceases within required timeframe.', expected_evidence: 'Test results; data flow analysis showing opt-out enforcement', assessment_method: 'system_test', depth: 'focused', source_document: 'CCPA/CPRA Regulations and CPPA Enforcement Guidance' },
  ],
  'CCPA-9': [
    { procedure_id: 'CCPA-9[E01]', procedure_type: 'audit_step', title: 'Audit data inventory and mapping', description: 'Audit the data inventory and mapping documentation for completeness and accuracy.', expected_evidence: 'Data inventory; data flow maps; categories of PI collected and purposes', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'CCPA/CPRA Regulations and CPPA Enforcement Guidance' },
  ],
  'CPRA-1': [
    { procedure_id: 'CPRA-1[E01]', procedure_type: 'audit_step', title: 'Audit annual privacy risk assessment', description: 'Audit the annual cybersecurity/privacy risk assessment required by CPRA for businesses processing significant volumes of personal information.', expected_evidence: 'Risk assessment report; scope documentation; identified risks and mitigations', assessment_method: 'document_review', depth: 'comprehensive', frequency_guidance: 'Annually per CPRA requirements.', source_document: 'CCPA/CPRA Regulations and CPPA Enforcement Guidance' },
  ],
  'CPRA-2': [
    { procedure_id: 'CPRA-2[E01]', procedure_type: 'audit_step', title: 'Audit cybersecurity audit requirements', description: 'Audit the cybersecurity audit performed per CPRA requirements.', expected_evidence: 'Cybersecurity audit report; scope; findings; remediation plans', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'CCPA/CPRA Regulations and CPPA Enforcement Guidance' },
  ],
};

// ============================================================
// State AI Governance — Algorithmic Impact Assessment
// ============================================================
const STATE_AI_GOV_PROCEDURES = {
  'SAI-1': [
    { procedure_id: 'SAI-1[E01]', procedure_type: 'audit_step', title: 'Audit AI impact assessment (Colorado AI Act)', description: 'Audit the algorithmic impact assessment for high-risk AI systems under the Colorado AI Act, covering purpose, data inputs, outputs, performance metrics, and mitigation measures.', expected_evidence: 'AI impact assessment document; risk classification; mitigation measures; public disclosure', assessment_method: 'document_review', depth: 'comprehensive', frequency_guidance: 'Before deployment and annually thereafter per Colorado AI Act.', source_document: 'Colorado AI Act (SB 24-205) and State AI Governance Guidance' },
    { procedure_id: 'SAI-1[I01]', procedure_type: 'interview', title: 'Interview AI system owners', description: 'Interview AI system owners about the impact assessment process, risk identification, and mitigation strategies.', expected_evidence: 'Interview notes', assessment_method: 'personnel_interview', depth: 'focused', source_document: 'Colorado AI Act (SB 24-205) and State AI Governance Guidance' },
  ],
  'SAI-2': [
    { procedure_id: 'SAI-2[E01]', procedure_type: 'audit_step', title: 'Audit high-risk AI system disclosure', description: 'Audit disclosures made to consumers about the use of high-risk AI systems in consequential decisions.', expected_evidence: 'Consumer disclosure records; notification templates; opt-out documentation', assessment_method: 'document_review', depth: 'focused', source_document: 'Colorado AI Act (SB 24-205) and State AI Governance Guidance' },
  ],
  'SAI-3': [
    { procedure_id: 'SAI-3[E01]', procedure_type: 'audit_step', title: 'Audit algorithmic discrimination prevention', description: 'Audit controls preventing algorithmic discrimination in high-risk AI systems including bias testing and fairness metrics.', expected_evidence: 'Bias testing reports; fairness metrics; demographic parity analysis; remediation records', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'Colorado AI Act (SB 24-205) and State AI Governance Guidance' },
    { procedure_id: 'SAI-3[T01]', procedure_type: 'test', title: 'Test bias detection mechanisms', description: 'Test bias detection mechanisms by reviewing model outputs across protected classes.', expected_evidence: 'Test results; disparate impact analysis', assessment_method: 'system_test', depth: 'comprehensive', source_document: 'Colorado AI Act (SB 24-205) and State AI Governance Guidance' },
  ],
  'SAI-7': [
    { procedure_id: 'SAI-7[E01]', procedure_type: 'audit_step', title: 'Audit AEDT compliance (NYC LL 144)', description: 'Audit compliance with NYC Local Law 144 for automated employment decision tools including annual bias audit and public posting.', expected_evidence: 'Annual bias audit report; public posting evidence; notice to candidates', assessment_method: 'document_review', depth: 'comprehensive', frequency_guidance: 'Annual bias audit; notice before each use.', source_document: 'NYC Local Law 144 and State AI Governance Guidance' },
  ],
  'SAI-8': [
    { procedure_id: 'SAI-8[E01]', procedure_type: 'audit_step', title: 'Audit bias audit requirements', description: 'Audit the bias audit process covering methodology, scope, results, and corrective actions.', expected_evidence: 'Bias audit methodology; audit results; corrective action plans', assessment_method: 'document_review', depth: 'comprehensive', source_document: 'State AI Governance Guidance' },
  ],
  'SAI-9': [
    { procedure_id: 'SAI-9[E01]', procedure_type: 'examine', title: 'Examine AI transparency reporting', description: 'Examine AI transparency and explainability reporting for completeness and public accessibility.', expected_evidence: 'Transparency reports; explainability documentation; public postings', assessment_method: 'document_review', depth: 'focused', source_document: 'State AI Governance Guidance' },
  ],
};

// ============================================================
// Seeding Function
// ============================================================
async function seedRemainingProcedures() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let totalProcedures = 0;

    const seedForFramework = async (frameworkCode, proceduresMap, label) => {
      const fwResult = await client.query(
        `SELECT id FROM frameworks WHERE code = $1`,
        [frameworkCode]
      );
      if (fwResult.rows.length === 0) {
        console.log(`  [SKIP] Framework "${frameworkCode}" not found in database — run seed-frameworks.js first`);
        return 0;
      }
      const frameworkId = fwResult.rows[0].id;
      let count = 0;

      for (const [controlId, procedures] of Object.entries(proceduresMap)) {
        const controlResult = await client.query(
          `SELECT id FROM framework_controls WHERE framework_id = $1 AND control_id = $2`,
          [frameworkId, controlId]
        );
        if (controlResult.rows.length === 0) {
          console.log(`  [SKIP] Control "${controlId}" not found in ${frameworkCode}`);
          continue;
        }

        const frameworkControlId = controlResult.rows[0].id;

        for (let i = 0; i < procedures.length; i++) {
          const proc = procedures[i];
          await client.query(
            `INSERT INTO assessment_procedures
             (framework_control_id, procedure_id, procedure_type, title, description,
              expected_evidence, assessment_method, depth, frequency_guidance,
              assessor_notes, source_document, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (procedure_id) DO NOTHING`,
            [
              frameworkControlId,
              proc.procedure_id,
              proc.procedure_type,
              proc.title,
              proc.description,
              proc.expected_evidence || null,
              proc.assessment_method || null,
              proc.depth || 'basic',
              proc.frequency_guidance || null,
              proc.assessor_notes || null,
              proc.source_document || null,
              i + 1
            ]
          );
          count++;
        }
      }

      console.log(`  [OK] ${label}: ${count} procedures seeded`);
      return count;
    };

    // Seed NERC CIP procedures (RSAW-based)
    console.log('\nSeeding NERC CIP assessment procedures (RSAW format)...');
    totalProcedures += await seedForFramework('nerc_cip', NERC_CIP_PROCEDURES, 'NERC CIP');

    // Seed NIST 800-171 procedures
    console.log('\nSeeding NIST SP 800-171A assessment procedures...');
    totalProcedures += await seedForFramework('nist_800_171', NIST_800_171_PROCEDURES, 'NIST 800-171');

    // Seed NIST Privacy procedures
    console.log('\nSeeding NIST Privacy Framework assessment procedures...');
    totalProcedures += await seedForFramework('nist_privacy', NIST_PRIVACY_PROCEDURES, 'NIST Privacy');

    // Seed FISCAM procedures
    console.log('\nSeeding FISCAM audit procedures (GAO format)...');
    totalProcedures += await seedForFramework('fiscam', FISCAM_PROCEDURES, 'FISCAM');

    // Seed FFIEC procedures
    console.log('\nSeeding FFIEC IT Examination procedures...');
    totalProcedures += await seedForFramework('ffiec', FFIEC_PROCEDURES, 'FFIEC');

    // Seed NIST 800-207 Zero Trust procedures
    console.log('\nSeeding NIST SP 800-207 Zero Trust assessment procedures...');
    totalProcedures += await seedForFramework('nist_800_207', NIST_800_207_PROCEDURES, 'NIST 800-207');

    // Seed CCPA/CPRA procedures
    console.log('\nSeeding CCPA/CPRA assessment procedures...');
    totalProcedures += await seedForFramework('ccpa_cpra', CCPA_CPRA_PROCEDURES, 'CCPA/CPRA');

    // Seed State AI Governance procedures
    console.log('\nSeeding State AI Governance assessment procedures...');
    totalProcedures += await seedForFramework('state_ai_governance', STATE_AI_GOV_PROCEDURES, 'State AI Governance');

    await client.query('COMMIT');

    console.log(`\n========================================`);
    console.log(`Total assessment procedures seeded: ${totalProcedures}`);
    console.log(`Frameworks covered: NERC CIP, NIST 800-171, NIST Privacy, FISCAM, FFIEC, NIST 800-207, CCPA/CPRA, State AI Governance`);
    console.log(`========================================\n`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedRemainingProcedures().catch(console.error);
