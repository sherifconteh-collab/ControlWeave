// @tier: exclude
/**
 * seed-pro-test-data.js
 *
 * Comprehensive pro-tier test data designed for maturity level 2
 * (~40% compliant) compliance posture.  Seeds every major tab with realistic data:
 *
 *   - Pro org  ("BrightPath Health", pro tier, active_paid)
 *   - Admin + auditor users (same org)
 *   - Pro-accessible frameworks adopted
 *   - ~40 % of controls implemented/verified (maturity 2)
 *   - Crosswalk auto-satisfaction records (satisfied_via_crosswalk)
 *   - Vulnerability findings with control-effect work items (compliant + NC)
 *   - Assessment plan + results (satisfied & other_than_satisfied)
 *   - Evidence files linked to controls
 *   - POA&M items (various priorities / statuses)
 *   - CMDB assets, environments, service accounts
 *   - Control exceptions (active + expired)
 *   - AI decision-log entries (with bias flags)
 *   - In-app notifications
 *   - Audit-log entries
 *   - Organization policies (HIPAA, InfoSec, Access Control, IR, BC/DR) with sections + control mappings
 *   - Data retention policies (HIPAA §164.530(j) aligned)
 *   - Hugging Face CVE enrichment (graceful fallback if unreachable)
 *
 * Logins
 *   admin@pro.com  / ControlWeave!2026   (admin)
 *   auditor@pro.com / ControlWeave!2026  (auditor — same org)
 *
 * Run:  npm run seed:pro-test-data
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const pool    = require('../src/config/database');
const { mapCweToOwasp2025 } = require('../src/utils/owaspMapping');
const { fetchHfVulnerabilities } = require('./lib/hf-vulnerability-fetch');
const { findUserByEmail, upsertUserByEmail } = require('./lib/userSeedHelpers');

const ADMIN_EMAIL   = 'admin@pro.com';
const AUDITOR_EMAIL = 'auditor@pro.com';
const PASSWORD      = 'ControlWeave!2026';
const ORG_NAME      = 'BrightPath Health';
const SEED_TAG      = 'starter_test_data';

// Starter-accessible frameworks
const FRAMEWORK_CODES = [
  'nist_csf_2.0', 'nist_800_53', 'iso_27001', 'soc2',
  'nist_ai_rmf', 'nist_800_171', 'fiscam',
];

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n🚀 Seeding comprehensive starter test data (maturity 2)…\n');
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    await client.query('BEGIN');

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Organization
    // ──────────────────────────────────────────────────────────────────────────
    let orgId;
    const existingAdmin = await findUserByEmail(client, ADMIN_EMAIL, { select: 'organization_id' });
    if (existingAdmin) {
      orgId = existingAdmin.organization_id;
      await client.query(
        "UPDATE organizations SET name = $1, tier = 'pro', billing_status = 'active_paid' WHERE id = $2",
        [ORG_NAME, orgId]
      );
      console.log('  ↺ Existing org found — updated to pro');
    } else {
      const existingOrg = await client.query(
        'SELECT id FROM organizations WHERE name = $1', [ORG_NAME]
      );
      if (existingOrg.rows.length > 0) {
        orgId = existingOrg.rows[0].id;
        await client.query(
          "UPDATE organizations SET tier = 'pro', billing_status = 'active_paid' WHERE id = $1",
          [orgId]
        );
      } else {
        const r = await client.query(
          `INSERT INTO organizations (name, tier, billing_status, trial_status)
           VALUES ($1, 'pro', 'active_paid', 'none') RETURNING id`,
          [ORG_NAME]
        );
        orgId = r.rows[0].id;
      }
      console.log('  ✓ Starter org created / updated');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Users (admin + auditor)
    // ──────────────────────────────────────────────────────────────────────────
    const adminId = await upsertUserByEmail(client, {
      organizationId: orgId,
      email: ADMIN_EMAIL,
      passwordHash,
      firstName: 'Sam',
      lastName: 'Starter',
      role: 'admin',
    });

    const auditorId = await upsertUserByEmail(client, {
      organizationId: orgId,
      email: AUDITOR_EMAIL,
      passwordHash,
      firstName: 'Sara',
      lastName: 'Auditor',
      role: 'auditor',
    });

    // Mark onboarding complete
    await client.query(
      `INSERT INTO organization_profiles (organization_id, onboarding_completed, onboarding_completed_at, created_by, updated_by)
       VALUES ($1, true, NOW(), $2, $2)
       ON CONFLICT (organization_id) DO UPDATE
         SET onboarding_completed = true,
             onboarding_completed_at = COALESCE(organization_profiles.onboarding_completed_at, NOW()),
             updated_by = $2`,
      [orgId, adminId]
    );
    console.log('  ✓ Admin + auditor users created');

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Adopt frameworks
    // ──────────────────────────────────────────────────────────────────────────
    const fwRes = await client.query(
      'SELECT id, code FROM frameworks WHERE code = ANY($1::text[]) AND is_active = true',
      [FRAMEWORK_CODES]
    );
    const frameworks = fwRes.rows;
    const fwIdByCode = new Map(frameworks.map(f => [f.code, f.id]));
    const missingFrameworkCodes = FRAMEWORK_CODES.filter((code) => !fwIdByCode.has(code));

    if (missingFrameworkCodes.length > 0) {
      throw new Error(
        `Pro demo prerequisites missing framework catalog entries: ${missingFrameworkCodes.join(', ')}. Seed the global framework catalog first.`
      );
    }

    for (const fw of frameworks) {
      await client.query(
        `INSERT INTO organization_frameworks (organization_id, framework_id)
         VALUES ($1, $2) ON CONFLICT (organization_id, framework_id) DO NOTHING`,
        [orgId, fw.id]
      );
    }
    console.log(`  ✓ Adopted ${frameworks.length} frameworks`);

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Control implementations — maturity level 2 (~40 % compliant)
    //    Distribution: 15 % verified, 15 % implemented, 5 % satisfied_via_crosswalk,
    //                  10 % in_progress, 5 % needs_review, 50 % not_started
    //    (NO not_applicable — still building out)
    // ──────────────────────────────────────────────────────────────────────────
    const allControls = await client.query(
      `SELECT fc.id, fc.control_id, fc.title, f.code AS fw_code, f.id AS fw_id
       FROM framework_controls fc
       JOIN frameworks f ON f.id = fc.framework_id
       WHERE f.id = ANY($1::uuid[])
       ORDER BY f.code, fc.control_id`,
      [frameworks.map(f => f.id)]
    );
    const controls = allControls.rows;
    const total = controls.length;

    if (total === 0) {
      throw new Error('Pro demo prerequisites missing framework controls. No control implementations can be seeded.');
    }

    // Bucket boundaries
    const b1 = Math.round(total * 0.15);  // verified
    const b2 = Math.round(total * 0.30);  // implemented
    const b3 = Math.round(total * 0.35);  // satisfied_via_crosswalk
    const b4 = Math.round(total * 0.45);  // in_progress
    const b5 = Math.round(total * 0.50);  // needs_review

    let implCount = 0;
    const crosswalkedControlIds = [];
    const implementedControlIds = [];
    const verifiedControlIds    = [];
    const inProgressControlIds  = [];
    const needsReviewControlIds = [];
    const notStartedControlIds  = [];

    for (let i = 0; i < total; i++) {
      let status;
      if      (i < b1) status = 'verified';
      else if (i < b2) status = 'implemented';
      else if (i < b3) status = 'satisfied_via_crosswalk';
      else if (i < b4) status = 'in_progress';
      else if (i < b5) status = 'needs_review';
      else             status = 'not_started';

      const implDate = (status === 'verified' || status === 'implemented')
        ? new Date(Date.now() - Math.random() * 60 * 86400000).toISOString()
        : null;

      const VERIFIED_NOTES = [
        'Verified during 2025 HIPAA Security Rule audit. ONC Certified EHR environment confirmed compliant with §164.312 technical safeguards. Evidence package reviewed by external assessor.', // ip-hygiene:ignore — fictional demo
        'Third-party penetration test (Coalfire, Q1 2026) validated control effectiveness across all PHI-bearing systems. BAA compliance confirmed for 14 business associates.',
        'HHS OCR readiness review confirmed control implementation aligns with HIPAA administrative safeguard requirements. Audit trail retained per §164.530(j).', // ip-hygiene:ignore — fictional demo
        'HITRUST CSF v11 validated assessment confirmed control operating effectiveness. Independent assessor verified PHI encryption and access logging meet r2 certification requirements.',
        'Annual BAA validation completed for all downstream covered entities and business associates. Control verified against HIPAA §164.314 organizational requirements.', // ip-hygiene:ignore — fictional demo
      ];

      const IMPLEMENTED_NOTES = [
        'Epic EHR integration hardened with FHIR R4 API security controls. OAuth 2.0 + SMART-on-FHIR authorization enforced for all clinical data endpoints.',
        'Azure Healthcare APIs deployed with PHI encryption at rest (AES-256) and in transit (TLS 1.3). Azure Key Vault manages HIPAA-required encryption keys with HSM backing.', // ip-hygiene:ignore — fictional demo
        'HL7 FHIR API gateway configured with rate limiting, token-based auth, and audit logging. All PHI access events forwarded to Splunk SIEM for §164.312(b) compliance.',
        'HITRUST CSF alignment completed for access control family. Role-based access provisioning integrated with Azure AD Privileged Identity Management for clinical systems.',
        'PHI encryption at rest enforced across all Azure SQL and Blob Storage instances. Customer-managed keys rotated quarterly per HIPAA technical safeguard §164.312(a)(2)(iv).', // ip-hygiene:ignore — fictional demo
      ];

      const CROSSWALK_NOTES = [
        'Auto-satisfied via HIPAA→NIST 800-53 crosswalk mapping (≥90% similarity). §164.312 technical safeguards map directly to NIST AC and SC control families.', // ip-hygiene:ignore — fictional demo
        'Inherited from HITRUST CSF→ISO 27001 Annex A mapping. HITRUST control 01.a (Access Control Policy) satisfies ISO A.5.15 with 94% alignment score.', // ip-hygiene:ignore — fictional demo
        'Cross-framework satisfaction: HIPAA §164.308(a)(1) (Security Management Process) maps to NIST RA-3 and SOC 2 CC3.2 at ≥92% match confidence.', // ip-hygiene:ignore — fictional demo
        'HITRUST→NIST AI RMF crosswalk applied. HITRUST privacy controls satisfy MAP 1.1 and GOVERN 1.1 requirements for AI systems processing PHI.',
      ];

      const IN_PROGRESS_NOTES = [
        'HITRUST r2 certification roadmap Phase 2 in progress. Gap remediation for 19.a (Encryption of Sensitive Information) expected complete Q3 2026.',
        'Telehealth platform hardening underway. Implementing end-to-end encryption and session recording per HIPAA §164.312(e)(1) for remote patient consultations.', // ip-hygiene:ignore — fictional demo
        'PHI de-identification pipeline (Safe Harbor method) under development. Statistical expert review scheduled for Q2 2026 per §164.514(b) requirements.',
        'Migrating clinical workstation fleet to CrowdStrike Falcon with HIPAA BAA. Phase 1 (nursing stations) 70% complete; Phase 2 (physician devices) scheduled Q3.', // ip-hygiene:ignore — fictional demo
      ];

      const NOT_STARTED_NOTES = [
        'Identified as gap in 2025 HIPAA risk analysis (RA-2025-HC-047). Budget request submitted for FY26 Q3 implementation pending compliance remediation funding approval.', // ip-hygiene:ignore — fictional demo
        'Backlogged per HIPAA Security Officer prioritization. Dependent on Azure AD P2 license upgrade. Compensating control: manual access reviews conducted quarterly.', // ip-hygiene:ignore — fictional demo
        'Deferred per risk acceptance RA-2025-HC-012. Current compensating control: WAF with PHI-pattern detection rules. Full implementation budgeted for FY27 roadmap.',
        'Scoped for HITRUST r2 certification Phase 3 (Q4 2026). Vendor evaluation for medical device security monitoring (MedCrypt vs Medigate) in progress.',
        'Gap identified in latest OCR-style mock audit. Remediation plan drafted and pending CISO approval. Estimated 120 engineering hours for full implementation.',
      ];

      let notes;
      switch (status) {
        case 'verified':                notes = VERIFIED_NOTES[i % VERIFIED_NOTES.length]; break;
        case 'implemented':             notes = IMPLEMENTED_NOTES[i % IMPLEMENTED_NOTES.length]; break;
        case 'satisfied_via_crosswalk': notes = CROSSWALK_NOTES[i % CROSSWALK_NOTES.length]; break;
        case 'in_progress':             notes = IN_PROGRESS_NOTES[i % IN_PROGRESS_NOTES.length]; break;
        case 'needs_review':            notes = IN_PROGRESS_NOTES[i % IN_PROGRESS_NOTES.length]; break;
        default:                        notes = NOT_STARTED_NOTES[i % NOT_STARTED_NOTES.length];
      }

      await client.query(
        `INSERT INTO control_implementations
           (organization_id, control_id, status, assigned_to, notes, implementation_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (organization_id, control_id) DO UPDATE
           SET status = EXCLUDED.status, notes = EXCLUDED.notes, implementation_date = EXCLUDED.implementation_date`,
        [orgId, controls[i].id, status, adminId, notes, implDate]
      );

      if (status === 'verified')                verifiedControlIds.push(controls[i]);
      if (status === 'implemented')             implementedControlIds.push(controls[i]);
      if (status === 'satisfied_via_crosswalk') crosswalkedControlIds.push(controls[i]);
      if (status === 'in_progress')             inProgressControlIds.push(controls[i]);
      if (status === 'needs_review')            needsReviewControlIds.push(controls[i]);
      if (status === 'not_started')             notStartedControlIds.push(controls[i]);
      implCount++;
    }

    console.log(`  ✓ ${implCount} control implementations`);
    console.log(`      verified: ${verifiedControlIds.length}  |  implemented: ${implementedControlIds.length}`);
    console.log(`      crosswalk: ${crosswalkedControlIds.length}  |  in_progress: ${inProgressControlIds.length}`);
    console.log(`      needs_review: ${needsReviewControlIds.length}  |  not_started: ${notStartedControlIds.length}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 5. CMDB — environments, assets, service accounts
    // ──────────────────────────────────────────────────────────────────────────
    const envResult = await client.query(`
      INSERT INTO environments (
        organization_id, name, code, environment_type,
        contains_pii, contains_phi, data_classification, security_level, criticality, owner_id
      )
      VALUES ($1, 'Production', 'prod-starter', 'production', true, false, 'confidential', 'medium', 'high', $2)
      ON CONFLICT (organization_id, code) DO UPDATE SET
        name = EXCLUDED.name, contains_pii = true, contains_phi = false,
        data_classification = 'confidential', security_level = 'medium', criticality = 'high',
        updated_at = NOW()
      RETURNING id
    `, [orgId, adminId]);
    const envId = envResult.rows[0].id;

    const vaultResult = await client.query(`
      INSERT INTO password_vaults (organization_id, name, vault_type, vault_url, is_active)
      VALUES ($1, 'Starter Test Vault', 'hashicorp_vault', 'https://vault.starter.local', true)
      ON CONFLICT (organization_id, name) DO UPDATE SET is_active = true
      RETURNING id
    `, [orgId]);
    const vaultId = vaultResult.rows[0].id;

    const catRows = await client.query('SELECT id, code FROM asset_categories');
    const catByCode = new Map(catRows.rows.map(r => [r.code, r.id]));

    const assetDefs = [
      { name: 'Starter Web App',       category: 'software',  hostname: 'starter-web-01',  ip: '10.40.1.10', classification: 'confidential', criticality: 'high'     },
      { name: 'Starter Database',      category: 'hardware',  hostname: 'starter-db-01',   ip: '10.40.1.20', classification: 'confidential', criticality: 'high'     },
      { name: 'Log Aggregator',        category: 'software',  version: '7.10.0',           classification: 'internal',     criticality: 'medium'   },
      { name: 'Cloud Identity Broker', category: 'cloud',     provider: 'AWS', region: 'us-west-2', classification: 'confidential', criticality: 'high' },
      { name: 'AI Risk Analyzer',      category: 'ai_agent',  modelType: 'llm', aiRisk: 'medium', classification: 'internal', criticality: 'medium' },
      { name: 'Office Workstations',   category: 'hardware',  hostname: 'starter-ws-gw',   ip: '10.40.2.1',  classification: 'internal',     criticality: 'low'      },
      { name: 'Cloud File Storage',    category: 'cloud',     provider: 'GCP', region: 'us-central1', classification: 'confidential', criticality: 'medium' },
    ];
    const assetIdByName = new Map();

    for (const def of assetDefs) {
      const catId = catByCode.get(def.category);
      if (!catId) continue;

      const existing = await client.query(
        'SELECT id FROM assets WHERE organization_id = $1 AND name = $2 LIMIT 1',
        [orgId, def.name]
      );

      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE assets SET category_id=$2, owner_id=$3, environment_id=$4,
             hostname=COALESCE($5,hostname), ip_address=COALESCE($6,ip_address),
             version=COALESCE($7,version), cloud_provider=COALESCE($8,cloud_provider),
             cloud_region=COALESCE($9,cloud_region), ai_model_type=COALESCE($10,ai_model_type),
             ai_risk_level=COALESCE($11,ai_risk_level),
             security_classification=$12, criticality=$13, status='active', updated_at=NOW()
           WHERE id=$1`,
          [existing.rows[0].id, catId, adminId, envId,
           def.hostname||null, def.ip||null, def.version||null,
           def.provider||null, def.region||null, def.modelType||null, def.aiRisk||null,
           def.classification, def.criticality]
        );
        assetIdByName.set(def.name, existing.rows[0].id);
      } else {
        const ins = await client.query(
          `INSERT INTO assets (organization_id, category_id, name, owner_id, environment_id, status,
             hostname, ip_address, version, cloud_provider, cloud_region,
             ai_model_type, ai_risk_level, security_classification, criticality)
           VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
          [orgId, catId, def.name, adminId, envId,
           def.hostname||null, def.ip||null, def.version||null,
           def.provider||null, def.region||null, def.modelType||null, def.aiRisk||null,
           def.classification, def.criticality]
        );
        assetIdByName.set(def.name, ins.rows[0].id);
      }
    }

    // Service account
    await client.query(
      `INSERT INTO service_accounts (
         organization_id, account_name, account_type, description, owner_id, business_justification,
         vault_id, vault_path, credential_type, rotation_frequency_days, next_rotation_date,
         privilege_level, scope, review_frequency_days, next_review_date, reviewer_id, status, is_active
       )
       VALUES ($1,'starter-svc-app','system_user','Starter application service account',$2,
               'Required for production integrations',$3,'/starter/svc-app','api_key',90,
               CURRENT_DATE + INTERVAL '90 day','standard','Production application services',60,
               CURRENT_DATE + INTERVAL '60 day',$2,'active',true)
       ON CONFLICT (organization_id, account_name) DO UPDATE SET
         owner_id=EXCLUDED.owner_id, vault_id=EXCLUDED.vault_id, is_active=true, updated_at=NOW()`,
      [orgId, adminId, vaultId]
    );
    console.log(`  ✓ ${assetDefs.length} CMDB assets + environment + service account`);

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Evidence files linked to controls
    // ──────────────────────────────────────────────────────────────────────────
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'starter-test');
    ensureDir(uploadsDir);

    const evidenceDocs = [
      { fileName: 'Security_Policy_v1.pdf', desc: 'Organization-wide information security policy (initial version)', mime: 'application/pdf' },
      { fileName: 'Access_Control_Review.pdf', desc: 'Access control review and user permissions audit', mime: 'application/pdf' },
      { fileName: 'CUI_Handling_Procedures.pdf', desc: 'Controlled Unclassified Information handling procedures', mime: 'application/pdf' },
      { fileName: 'Network_Diagram_v1.pdf', desc: 'Network architecture and boundary documentation', mime: 'application/pdf' },
      { fileName: 'Risk_Assessment_Initial.pdf', desc: 'Initial organizational risk assessment', mime: 'application/pdf' },
      { fileName: 'Incident_Response_Draft.pdf', desc: 'Draft incident response plan', mime: 'application/pdf' },
      { fileName: 'Employee_Security_Training.pdf', desc: 'Security awareness training completion records', mime: 'application/pdf' },
      { fileName: 'Asset_Inventory_Q1.xlsx', desc: 'Quarterly asset inventory and classification report', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    ];

    const linkedEvidenceIds = [];
    for (let i = 0; i < evidenceDocs.length; i++) {
      const ev = evidenceDocs[i];
      const content = `Starter Test Evidence — ${ev.fileName}\nGenerated: ${new Date().toISOString()}`;
      const filePath = path.join(uploadsDir, ev.fileName);
      fs.writeFileSync(filePath, content, 'utf8');

      const existingEv = await client.query(
        'SELECT id FROM evidence WHERE organization_id = $1 AND file_name = $2 LIMIT 1',
        [orgId, ev.fileName]
      );

      let evId;
      if (existingEv.rows.length > 0) {
        evId = existingEv.rows[0].id;
        await client.query(
          `UPDATE evidence SET file_path=$3, file_size=$4, mime_type=$5, description=$6,
             integrity_hash_sha256=$7, retention_until=CURRENT_DATE + INTERVAL '365 day',
             integrity_verified_at=NOW(), updated_at=NOW()
           WHERE id=$1 AND organization_id=$2`,
          [evId, orgId, filePath, Buffer.byteLength(content), ev.mime, ev.desc, sha256(content)]
        );
      } else {
        const ins = await client.query(
          `INSERT INTO evidence (organization_id, uploaded_by, file_name, file_path, file_size, mime_type, description,
             tags, integrity_hash_sha256, evidence_version, retention_until, integrity_verified_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,CURRENT_DATE + INTERVAL '365 day',NOW()) RETURNING id`,
          [orgId, adminId, ev.fileName, filePath, Buffer.byteLength(content), ev.mime, ev.desc,
           ['starter-test', 'maturity-2'], sha256(content)]
        );
        evId = ins.rows[0].id;
      }
      linkedEvidenceIds.push(evId);

      // Link first 8 evidence items to first 8 verified controls
      if (i < verifiedControlIds.length) {
        await client.query(
          `INSERT INTO evidence_control_links (evidence_id, control_id, notes)
           VALUES ($1, $2, 'Linked via starter test data seed')
           ON CONFLICT (evidence_id, control_id) DO NOTHING`,
          [evId, verifiedControlIds[i].id]
        );
      }
    }
    console.log(`  ✓ ${evidenceDocs.length} evidence files linked to controls`);

    // ──────────────────────────────────────────────────────────────────────────
    // 7. Vulnerability findings + vulnerability_control_work_items (NC + partial + compliant)
    // ──────────────────────────────────────────────────────────────────────────
    await client.query(
      `DELETE FROM vulnerability_findings WHERE organization_id = $1 AND metadata->>'seed_tag' = $2`,
      [orgId, SEED_TAG]
    );

    const vulnDefs = [
      { source:'ACAS', standard:'CVE/NVD', key:'str-acas-001', vulnId:'CVE-2025-30001', title:'SQL injection in web application login',
        severity:'critical', cvss:9.1, status:'open', daysAgo:10, asset:'Starter Web App', cwe:'CWE-89', kev:true, exploit:true, dueInDays:5 },
      { source:'ACAS', standard:'CISA KEV', key:'str-acas-002', vulnId:'CVE-2025-30002', title:'Authentication bypass in identity broker',
        severity:'high', cvss:8.1, status:'open', daysAgo:7, asset:'Cloud Identity Broker', cwe:'CWE-287', kev:true, exploit:true, dueInDays:10 },
      { source:'STIG', standard:'DISA STIG', key:'str-stig-003', vulnId:'RHEL-09-212100', title:'Password complexity requirements not enforced',
        severity:'high', cvss:7.0, status:'in_progress', daysAgo:12, asset:'Starter Database', cwe:null, kev:false, exploit:false, dueInDays:14 },
      { source:'SBOM', standard:'CycloneDX', key:'str-sbom-004', vulnId:'CVE-2024-48001', title:'Outdated dependency with known XSS vulnerability',
        severity:'medium', cvss:5.9, status:'open', daysAgo:6, asset:'Starter Web App', cwe:'CWE-79', kev:false, exploit:true, dueInDays:21 },
      { source:'SCAP', standard:'CIS Benchmarks', key:'str-scap-005', vulnId:'CIS-GCP-3.1', title:'Logging not enabled for all cloud storage buckets',
        severity:'medium', cvss:5.2, status:'in_progress', daysAgo:9, asset:'Cloud File Storage', cwe:null, kev:false, exploit:false, dueInDays:30 },
      { source:'SAST', standard:'OWASP ASVS', key:'str-sast-006', vulnId:'OWASP-ASVS-2.1.1', title:'Weak password policy on user registration',
        severity:'low', cvss:3.8, status:'remediated', daysAgo:18, asset:'Starter Web App', cwe:'CWE-521', kev:false, exploit:false, dueInDays:45 },
    ];

    const insertedVulns = [];
    for (const v of vulnDefs) {
      const assetId = assetIdByName.get(v.asset) || null;
      const res = await client.query(
        `INSERT INTO vulnerability_findings (
           organization_id, asset_id, source, standard, finding_key, vulnerability_id, title, description,
           severity, cvss_score, status, first_seen_at, last_seen_at, detected_at, due_date,
           cwe_id, owasp_top10_2025_category, kev_listed, exploit_available, metadata
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
           NOW()-($12::int||' days')::interval, NOW()-($13::int||' days')::interval,
           NOW()-($14::int||' days')::interval, CURRENT_DATE+($15::int||' days')::interval,
           $16,$17,$18,$19,$20::jsonb)
         ON CONFLICT (organization_id, finding_key) DO UPDATE SET
           title=EXCLUDED.title, severity=EXCLUDED.severity, cvss_score=EXCLUDED.cvss_score,
           status=EXCLUDED.status, cwe_id=EXCLUDED.cwe_id,
           owasp_top10_2025_category=EXCLUDED.owasp_top10_2025_category,
           metadata=EXCLUDED.metadata, updated_at=NOW()
         RETURNING id, finding_key`,
        [orgId, assetId, v.source, v.standard, v.key, v.vulnId, v.title, v.title,
         v.severity, v.cvss, v.status,
         v.daysAgo+5, v.daysAgo, v.daysAgo, v.dueInDays,
         v.cwe, mapCweToOwasp2025(v.cwe), v.kev, v.exploit,
         JSON.stringify({ seed_tag: SEED_TAG })]
      );
      insertedVulns.push({ ...res.rows[0], severity: v.severity });
    }

    // Link vulnerabilities to framework controls with compliant / non_compliant / partial effects
    const ncWorkItems = [
      { vulnIdx: 0, controls: notStartedControlIds.slice(0, 2),  effect: 'non_compliant', action: 'poam',              actionStatus: 'open' },
      { vulnIdx: 1, controls: inProgressControlIds.slice(0, 2),  effect: 'non_compliant', action: 'close_control_gap',  actionStatus: 'in_progress' },
      { vulnIdx: 2, controls: inProgressControlIds.slice(2, 3),  effect: 'partial',       action: 'poam',              actionStatus: 'open' },
      { vulnIdx: 3, controls: crosswalkedControlIds.slice(0, 1), effect: 'partial',       action: 'risk_acceptance',   actionStatus: 'accepted' },
      { vulnIdx: 4, controls: implementedControlIds.slice(0, 1), effect: 'compliant',     action: 'close_control_gap',  actionStatus: 'resolved' },
      { vulnIdx: 5, controls: verifiedControlIds.slice(0, 1),    effect: 'compliant',     action: 'false_positive_review', actionStatus: 'closed' },
    ];

    let workItemCount = 0;
    for (const wi of ncWorkItems) {
      const vuln = insertedVulns[wi.vulnIdx];
      if (!vuln) continue;
      for (const ctrl of wi.controls) {
        if (!ctrl) continue;
        // Find the implementation id
        const implRes = await client.query(
          'SELECT id FROM control_implementations WHERE organization_id=$1 AND control_id=$2',
          [orgId, ctrl.id]
        );
        const implId = implRes.rows.length > 0 ? implRes.rows[0].id : null;

        await client.query(
          `INSERT INTO vulnerability_control_work_items (
             organization_id, vulnerability_id, framework_control_id, implementation_id,
             action_type, action_status, control_effect, response_summary, due_date,
             owner_id, created_by, metadata
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CURRENT_DATE + ($9::int||' days')::interval, $10,$10,$11::jsonb)
           ON CONFLICT (organization_id, vulnerability_id, framework_control_id) DO UPDATE SET
             action_status=EXCLUDED.action_status, control_effect=EXCLUDED.control_effect, updated_at=NOW()`,
          [orgId, vuln.id, ctrl.id, implId,
           wi.action, wi.actionStatus, wi.effect,
           `${wi.effect === 'non_compliant' ? 'Control gap identified' : wi.effect === 'partial' ? 'Partial remediation in progress' : 'Control verified effective'} — ${ctrl.control_id}`,
           wi.actionStatus === 'closed' ? -10 : 30,
           adminId,
           JSON.stringify({ seed_tag: SEED_TAG })]
        );
        workItemCount++;
      }
    }
    console.log(`  ✓ ${insertedVulns.length} vulnerability findings + ${workItemCount} control work items (NC + partial + compliant)`);

    // ──────────────────────────────────────────────────────────────────────────
    // 7b. Hugging Face CVE enrichment — pull real-world CVEs for richer demo data
    // ──────────────────────────────────────────────────────────────────────────
    const HF_VULN_COUNT = 6;
    const assetNames = Array.from(assetIdByName.keys());
    let hfVulnCount = 0;
    let hfWorkItemCount = 0;
    try {
      console.log('  ⬇ Fetching Hugging Face CVE data for pro-tier enrichment...');
      const hfVulns = await fetchHfVulnerabilities(HF_VULN_COUNT, {
        sources: ['ACAS', 'SBOM', 'SCAP', 'STIG', 'SAST', 'DAST'],
        statuses: ['open', 'in_progress', 'remediated', 'risk_accepted']
      });

      const allControlIds = [
        ...notStartedControlIds, ...inProgressControlIds,
        ...needsReviewControlIds, ...implementedControlIds, ...verifiedControlIds
      ].filter(Boolean);

      for (let i = 0; i < hfVulns.length; i++) {
        const hv = hfVulns[i];
        const findingKey = `pro-hf-${String(i + 1).padStart(3, '0')}`;
        const assetName = assetNames[i % assetNames.length];
        const assetId = assetIdByName.get(assetName) || null;
        const daysAgo = 5 + Math.floor(Math.random() * 90);
        const dueInDays = hv.status === 'remediated' ? -5 : (hv.severity === 'critical' ? 14 : hv.severity === 'high' ? 30 : 45);

        const res = await client.query(
          `INSERT INTO vulnerability_findings (
             organization_id, asset_id, source, standard, finding_key, vulnerability_id, title, description,
             severity, cvss_score, status, first_seen_at, last_seen_at, detected_at, due_date,
             cwe_id, owasp_top10_2025_category, kev_listed, exploit_available, metadata
           )
           VALUES ($1,$2,$3,'CVE/NVD',$4,$5,$6,$7,$8,$9,$10,
             NOW()-($11::int||' days')::interval, NOW()-($12::int||' days')::interval,
             NOW()-($13::int||' days')::interval,
             CURRENT_DATE + ($14::int||' days')::interval,
             $15,$16,false,false,$17::jsonb)
           ON CONFLICT (organization_id, finding_key) DO UPDATE SET
             title=EXCLUDED.title, severity=EXCLUDED.severity, cvss_score=EXCLUDED.cvss_score,
             status=EXCLUDED.status, metadata=EXCLUDED.metadata, updated_at=NOW()
           RETURNING id, finding_key`,
          [orgId, assetId, hv.source, findingKey, hv.cve, hv.title, hv.description,
           hv.severity, hv.cvss, hv.status,
           daysAgo + 3, daysAgo, daysAgo, dueInDays,
           hv.cwe, mapCweToOwasp2025(hv.cwe),
           JSON.stringify({ seed_tag: SEED_TAG, source: 'huggingface', dataset: hv.dataset })]
        );
        hfVulnCount++;

        // Link every other HF vuln to a control as a work item
        if (i % 2 === 0 && allControlIds.length > 0) {
          const ctrl = allControlIds[i % allControlIds.length];
          const implRes = await client.query(
            'SELECT id FROM control_implementations WHERE organization_id=$1 AND control_id=$2',
            [orgId, ctrl.id]
          );
          const implId = implRes.rows.length > 0 ? implRes.rows[0].id : null;
          const effect = hv.severity === 'critical' || hv.severity === 'high' ? 'non_compliant' : 'partial';
          const action = effect === 'non_compliant' ? 'poam' : 'close_control_gap';
          await client.query(
            `INSERT INTO vulnerability_control_work_items (
               organization_id, vulnerability_id, framework_control_id, implementation_id,
               action_type, action_status, control_effect, response_summary, due_date,
               owner_id, created_by, metadata
             )
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CURRENT_DATE + '30 days'::interval, $9,$9,$10::jsonb)
             ON CONFLICT (organization_id, vulnerability_id, framework_control_id) DO NOTHING`,
            [orgId, res.rows[0].id, ctrl.id, implId,
             action, hv.status === 'remediated' ? 'closed' : 'open', effect,
             `HF-sourced ${hv.cve} — ${effect === 'non_compliant' ? 'control gap identified' : 'partial remediation needed'} for ${ctrl.control_id}`,
             adminId,
             JSON.stringify({ seed_tag: SEED_TAG, source: 'huggingface' })]
          );
          hfWorkItemCount++;
        }
      }
      console.log(`  ✓ ${hfVulnCount} Hugging Face CVE findings + ${hfWorkItemCount} work items (real-world enrichment)`);
    } catch (hfErr) {
      console.warn(`  ⚠ Hugging Face enrichment skipped: ${String(hfErr?.message || hfErr)}`);
      console.warn('    Curated vulnerability data is still seeded. HF enrichment will be retried on next run if connectivity is restored.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 8. POA&M items
    // ──────────────────────────────────────────────────────────────────────────
    const poamData = [
      { title: 'Remediate SQL injection in web application login',             priority: 'critical', status: 'open' },
      { title: 'Implement MFA for administrative accounts',                    priority: 'high',     status: 'in_progress' },
      { title: 'Establish CUI handling and labeling procedures',               priority: 'high',     status: 'in_progress' },
      { title: 'Deploy endpoint detection and response tooling',               priority: 'medium',   status: 'open' },
      { title: 'Create formal incident response plan',                         priority: 'medium',   status: 'open' },
      { title: 'Complete initial security awareness training',                 priority: 'medium',   status: 'closed' },
      { title: 'Enforce password complexity across all systems',               priority: 'high',     status: 'closed' },
      { title: 'Document network boundary and data flow diagrams',             priority: 'low',      status: 'open' },
    ];
    let poamCount = 0;
    for (const item of poamData) {
      const exists = await client.query(
        'SELECT id FROM poam_items WHERE organization_id=$1 AND title=$2', [orgId, item.title]
      );
      if (exists.rows.length === 0) {
        const due = new Date();
        due.setDate(due.getDate() + Math.floor(Math.random() * 90) + 14);
        await client.query(
          `INSERT INTO poam_items (organization_id, title, description, priority, status, due_date, owner_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [orgId, item.title, `${item.title}. Track milestone progress via POA&M dashboard.`,
           item.priority, item.status, due.toISOString(), adminId]
        );
        poamCount++;
      }
    }
    console.log(`  ✓ ${poamCount} POA&M items`);

    // ──────────────────────────────────────────────────────────────────────────
    // 9. Assessment plan + results
    // ──────────────────────────────────────────────────────────────────────────
    const planName = 'Initial Compliance Assessment 2026 (Starter)';
    let planId;
    const existingPlan = await client.query(
      'SELECT id FROM assessment_plans WHERE organization_id=$1 AND name=$2 LIMIT 1',
      [orgId, planName]
    );
    if (existingPlan.rows.length > 0) {
      planId = existingPlan.rows[0].id;
      await client.query(
        `UPDATE assessment_plans SET status='in_progress', depth='comprehensive', lead_assessor_id=$3, updated_at=NOW()
         WHERE id=$1 AND organization_id=$2`,
        [planId, orgId, adminId]
      );
    } else {
      const ins = await client.query(
        `INSERT INTO assessment_plans (organization_id, name, description, assessment_type, depth, status, lead_assessor_id, start_date)
         VALUES ($1,$2,'Initial compliance assessment covering all adopted starter frameworks.',
                 'annual','comprehensive','in_progress',$3,CURRENT_DATE - INTERVAL '30 day') RETURNING id`,
        [orgId, planName, adminId]
      );
      planId = ins.rows[0].id;
    }

    // Link procedures and create results
    const procedures = await client.query(
      `SELECT ap.id FROM assessment_procedures ap
       JOIN framework_controls fc ON fc.id = ap.framework_control_id
       JOIN frameworks f ON f.id = fc.framework_id
       JOIN organization_frameworks ofw ON ofw.framework_id = f.id AND ofw.organization_id = $1
       ORDER BY f.code, fc.control_id, ap.procedure_id LIMIT 30`,
      [orgId]
    );

    for (const row of procedures.rows) {
      await client.query(
        `INSERT INTO assessment_plan_procedures (assessment_plan_id, assessment_procedure_id)
         VALUES ($1,$2) ON CONFLICT (assessment_plan_id, assessment_procedure_id) DO NOTHING`,
        [planId, row.id]
      );
    }

    // ~50% satisfied, ~50% other_than_satisfied
    const resultStatuses = ['satisfied','other_than_satisfied','satisfied','other_than_satisfied','satisfied',
                            'other_than_satisfied','satisfied','other_than_satisfied','satisfied','other_than_satisfied'];
    for (let i = 0; i < Math.min(20, procedures.rows.length); i++) {
      const st = resultStatuses[i % resultStatuses.length];
      await client.query(
        `INSERT INTO assessment_results (
           organization_id, assessment_procedure_id, assessor_id, status, finding, evidence_collected,
           risk_level, remediation_required, assessed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW() - ($9::int||' days')::interval)`,
        [orgId, procedures.rows[i].id,
         i % 3 === 0 ? auditorId : adminId,
         st,
         st === 'satisfied' ? 'Control objective met; evidence supports effective implementation.' : 'Gap identified — control not yet fully implemented or evidence insufficient.',
         'Evidence reviewed during assessment period.',
         st === 'satisfied' ? 'low' : (i % 4 === 0 ? 'high' : 'medium'),
         st !== 'satisfied',
         i + 1]
      );
    }
    console.log(`  ✓ Assessment plan + ${Math.min(20, procedures.rows.length)} results (~50% satisfied + ~50% other_than_satisfied)`);

    // ──────────────────────────────────────────────────────────────────────────
    // 10. Control exceptions
    // ──────────────────────────────────────────────────────────────────────────
    const exceptionControls = inProgressControlIds.slice(0, 3);
    for (let i = 0; i < exceptionControls.length; i++) {
      const ctrl = exceptionControls[i];
      const isActive = i < 2;
      await client.query(
        `INSERT INTO control_exceptions (
           organization_id, control_id, title, reason, compensating_controls,
           business_impact, owner_id, approved_by, status, approved_at, expires_at, created_by
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$7)
         ON CONFLICT DO NOTHING`,
        [orgId, ctrl.id,
         `Exception: ${ctrl.control_id} — ${isActive ? 'Active waiver' : 'Expired legacy exception'}`,
         isActive ? 'Implementation delayed due to resource constraints; compensating control in place.' : 'Historical exception — no longer valid.',
         'Manual review process and enhanced monitoring as compensating controls.',
         isActive ? 'Low — compensating controls reduce residual risk to acceptable level.' : 'N/A — exception expired.',
         adminId, adminId,
         isActive ? 'active' : 'expired',
         isActive ? new Date().toISOString() : new Date(Date.now() - 90*86400000).toISOString(),
         isActive ? new Date(Date.now() + 180*86400000).toISOString().split('T')[0] : new Date(Date.now() - 30*86400000).toISOString().split('T')[0]]
      );
    }
    console.log('  ✓ Control exceptions (active + expired)');

    // ──────────────────────────────────────────────────────────────────────────
    // 11. Notifications
    // ──────────────────────────────────────────────────────────────────────────
    const notifications = [
      { type: 'control_due',       title: 'Controls Due for Review',               message: 'Multiple controls require periodic review — check the Controls tab.',                          link: '/dashboard/controls',            read: false },
      { type: 'status_change',     title: 'Control Verified',                       message: 'AC-2 (Account Management) has been verified by the audit team.',                                link: '/dashboard/controls',            read: false },
      { type: 'crosswalk',         title: 'Crosswalk Satisfaction Applied',          message: 'ISO 27001 A.5.15 auto-satisfied via crosswalk from NIST 800-53 AC-2 (90% match).',              link: '/dashboard/frameworks/mappings', read: false }, // ip-hygiene:ignore
      { type: 'system',            title: 'New POA&M Item',                          message: 'Critical POA&M: Remediate SQL injection in web application login.',                             link: '/dashboard/operations',          read: false },
      { type: 'assessment_needed', title: 'Assessment Required',                     message: 'Initial compliance assessment has open procedures requiring assessor input.',                    link: '/dashboard/assessments',         read: false },
      { type: 'control_due',       title: 'Overdue Control',                         message: 'IA-2 (Identification and Authentication) review is 7 days overdue.',                            link: '/dashboard/controls',            read: true  },
      { type: 'status_change',     title: 'Vulnerability Work Item Updated',         message: 'CVE-2025-30002 control-gap work item moved to in_progress.',                                    link: '/dashboard/vulnerabilities',     read: true  },
      { type: 'crosswalk',         title: 'New Crosswalk Opportunity',               message: 'NIST CSF DE.CM-01 could auto-satisfy SOC 2 CC7.1 — review crosswalk settings.',                 link: '/dashboard/frameworks/mappings', read: true  }, // ip-hygiene:ignore
      { type: 'system',            title: 'Evidence Expiring',                        message: 'Security policy evidence will expire in 30 days — schedule update.',                            link: '/dashboard/evidence',            read: true  },
    ];
    let notifCount = 0;
    for (let i = 0; i < notifications.length; i++) {
      const n = notifications[i];
      await client.query(
        `INSERT INTO notifications (organization_id, user_id, type, title, message, link, is_read, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW() - ($8 * interval '1 hour'))`,
        [orgId, adminId, n.type, n.title, n.message, n.link, n.read, i * 3]
      );
      // Auditor gets crosswalk + assessment + status_change notifications
      if (['crosswalk', 'assessment_needed', 'status_change'].includes(n.type)) {
        await client.query(
          `INSERT INTO notifications (organization_id, user_id, type, title, message, link, is_read, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,false,NOW() - ($7 * interval '1 hour'))`,
          [orgId, auditorId, n.type, n.title, n.message, n.link, i * 3 + 1]
        );
      }
      notifCount++;
    }
    console.log(`  ✓ ${notifCount} notifications (admin: 5 unread, auditor: crosswalk/assessment/status)`);

    // ──────────────────────────────────────────────────────────────────────────
    // 12. AI decision log
    // ──────────────────────────────────────────────────────────────────────────
    const aiDecisions = [
      {
        input: { type: 'gap_analysis', frameworks: ['nist_800_53','nist_800_171','soc2'], total_controls: total },
        output: { gaps: inProgressControlIds.length + needsReviewControlIds.length + notStartedControlIds.length, critical: 5, recommendations: ['Prioritize AC-2 implementation','Begin IA-2 rollout','Address CUI handling gaps'] },
        risk: 'high', framework: 'NIST AI RMF', model: 'claude-sonnet-4-5-20250929',
        reviewed: true, outcome: 'approved', notes: 'Gap analysis approved — prioritization plan created for maturity improvement.',
        bias: [],
      },
      {
        input: { type: 'crosswalk_optimization', source_framework: 'nist_800_53', target_framework: 'iso_27001' },
        output: { overlap_percentage: 72, auto_satisfiable: crosswalkedControlIds.length, effort_reduction_hours: 45 },
        risk: 'low', framework: 'NIST AI RMF', model: 'claude-sonnet-4-5-20250929',
        reviewed: false, outcome: null, notes: null,
        bias: [],
      },
      {
        input: { type: 'compliance_report', period: 'Q4 2025', frameworks: ['nist_800_171'] },
        output: { text: 'Organization is in early stages of compliance maturity. Significant gaps remain in CUI protection and access control families.' },
        risk: 'medium', framework: 'NIST AI RMF', model: 'claude-sonnet-4-5-20250929',
        reviewed: false, outcome: null, notes: null,
        bias: [{ type: 'subjectivity', description: 'Uses subjective terms ("early stages") — consider replacing with quantitative metrics.' }],
      },
      {
        input: { type: 'vendor_risk', vendor: 'GCP', services: ['GCS','Compute','IAM'], data: ['PII'] },
        output: { risk_score: 52, risk_level: 'medium', findings: ['SOC 2 Type II report current','No recent penetration test on file','DPA needs renewal'] },
        risk: 'medium', framework: 'NIST AI RMF', model: 'gpt-4o',
        reviewed: true, outcome: 'approved', notes: 'Vendor risk accepted with conditions — DPA renewal scheduled.',
        bias: [{ type: 'vendor_naming', description: 'Vendor name referenced in assessment text — ensure objective criteria used.' }],
      },
      {
        input: { type: 'remediation_prioritization', vulnerabilities: 6, critical: 1, high: 2 },
        output: { priority_order: ['CVE-2025-30001','CVE-2025-30002','RHEL-09-212100'], effort_estimate_hours: 80 },
        risk: 'high', framework: 'NIST AI RMF', model: 'claude-sonnet-4-5-20250929',
        reviewed: false, outcome: null, notes: null,
        bias: [],
      },
    ];
    let aiCount = 0;
    for (const d of aiDecisions) {
      const inputText  = JSON.stringify(d.input);
      const outputText = typeof d.output === 'string'
        ? JSON.stringify({ text: d.output })
        : JSON.stringify(d.output);
      await client.query(
        `INSERT INTO ai_decision_log
           (organization_id, input_data, input_hash, output_data, output_hash,
            human_reviewed, risk_level, regulatory_framework, model_version,
            correlation_id, session_id, processing_timestamp,
            bias_flags, bias_reviewed, review_outcome, review_notes)
         VALUES ($1,$2::jsonb,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,
                 NOW() - (($12)::int * interval '1 hour'),
                 $13::jsonb, false, $14, $15)`,
        [orgId, inputText, sha256(inputText), outputText, sha256(outputText),
         d.reviewed, d.risk, d.framework, d.model,
         crypto.randomUUID(), crypto.randomUUID(),
         Math.floor(Math.random() * 72) + 1,
         JSON.stringify(d.bias), d.outcome, d.notes]
      );
      aiCount++;
    }
    console.log(`  ✓ ${aiCount} AI decisions (2 with bias flags, 2 approved via human review)`);

    // ──────────────────────────────────────────────────────────────────────────
    // 13. Audit log entries
    // ──────────────────────────────────────────────────────────────────────────
    // audit_logs is append-only (migration 120) -- bypass the guard for this
    // tagged demo-data reset only.
    await client.query('ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_update');
    await client.query(
      `DELETE FROM audit_logs WHERE organization_id=$1 AND details->>'seed_tag'=$2`,
      [orgId, SEED_TAG]
    );
    await client.query('ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_update');

    const auditEvents = [
      { type: 'user_login',               resource: 'auth',                   resId: null,                    success: true,  failReason: null,                         min: 480 },
      { type: 'frameworks_updated',        resource: 'organization_frameworks',resId: null,                    success: true,  failReason: null,                         min: 450 },
      { type: 'control_status_changed',    resource: 'control',               resId: verifiedControlIds[0]?.id,  success: true,  failReason: null,                      min: 400 },
      { type: 'control_status_changed',    resource: 'control',               resId: implementedControlIds[0]?.id, success: true, failReason: null,                     min: 380 },
      { type: 'crosswalk_auto_satisfied',  resource: 'control',               resId: crosswalkedControlIds[0]?.id, success: true, failReason: null,                     min: 360 },
      { type: 'evidence_uploaded',         resource: 'evidence',              resId: linkedEvidenceIds[0],    success: true,  failReason: null,                         min: 320 },
      { type: 'assessment_result_recorded',resource: 'assessment_procedure',  resId: procedures.rows[0]?.id,  success: true,  failReason: null,                         min: 280 },
      { type: 'vulnerability_scan_imported', resource: 'vulnerability',       resId: insertedVulns[0]?.id,    success: true,  failReason: null,                         min: 240 },
      { type: 'poam_created',             resource: 'poam',                   resId: null,                    success: true,  failReason: null,                         min: 200 },
      { type: 'report_generated',         resource: 'report',                 resId: null,                    success: true,  failReason: null,                         min: 160 },
      { type: 'ai_analysis_requested',    resource: 'ai',                     resId: null,                    success: true,  failReason: null,                         min: 120 },
      { type: 'settings_updated',         resource: 'organization_settings',  resId: null,                    success: true,  failReason: null,                         min: 60  },
      { type: 'ai_analysis_requested',    resource: 'ai',                     resId: null,                    success: false, failReason: 'Provider API key not set',   min: 30  },
    ];
    for (const ev of auditEvents) {
      await client.query(
        `INSERT INTO audit_logs (organization_id, user_id, event_type, resource_type, resource_id,
           details, ip_address, user_agent, success, failure_reason, created_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,NOW() - ($11::int||' minutes')::interval)`,
        [orgId, adminId, ev.type, ev.resource, ev.resId,
         JSON.stringify({ seed_tag: SEED_TAG, summary: `${ev.type} event` }),
         '10.40.1.5', 'Starter Test Seed', ev.success, ev.failReason, ev.min]
      );
    }
    console.log(`  ✓ ${auditEvents.length} audit log entries`);

    // ──────────────────────────────────────────────────────────────────────────
    // 14. Organization Policies + sections + control mappings
    // ──────────────────────────────────────────────────────────────────────────

    // Helper: find controls by ID prefix (e.g. 'AC-', 'AU-')
    const controlsByPrefix = (prefix) => controls.filter(c => c.control_id.startsWith(prefix));

    const policyDefs = [
      {
        name: 'HIPAA Security Policy',
        type: 'security_policy',
        description: 'Establishes PHI safeguards including technical, administrative, and physical controls required under the HIPAA Security Rule (45 CFR Part 164 Subpart C) for BrightPath Health clinical and administrative systems.', // ip-hygiene:ignore — fictional demo policy
        version: '2.1',
        status: 'published',
        effectiveDaysAgo: 365,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Technical Safeguards for ePHI',
            content: 'All electronic PHI must be encrypted at rest using AES-256 and in transit using TLS 1.3 per §164.312(a)(2)(iv) and §164.312(e)(1). Azure Healthcare APIs enforce encryption by default. Epic EHR database encryption is managed via Azure SQL Transparent Data Encryption with customer-managed keys rotated quarterly.',
            familyCode: 'SC', familyName: 'System and Communications Protection',
            controlPrefix: 'SC-',
          },
          {
            number: '2.0', title: 'Administrative Safeguards',
            content: 'The HIPAA Security Officer conducts annual risk analyses per §164.308(a)(1)(ii)(A). Workforce security training is mandatory within 30 days of hire and annually thereafter per §164.308(a)(5). Sanction policy violations are documented and reported to the Privacy Officer within 24 hours.', // ip-hygiene:ignore — fictional demo policy
            familyCode: 'PL', familyName: 'Planning',
            controlPrefix: 'PL-',
          },
          {
            number: '3.0', title: 'Physical Safeguards',
            content: 'Facility access controls per §164.310(a)(1) are enforced via badge-reader systems at all BrightPath Health clinical locations. Server rooms require dual-factor badge + biometric entry. Workstation security per §164.310(b) mandates auto-lock after 5 minutes of inactivity on all clinical endpoints.',
            familyCode: 'PE', familyName: 'Physical and Environmental Protection',
            controlPrefix: 'PE-',
          },
        ],
      },
      {
        name: 'Information Security Policy',
        type: 'security_policy',
        description: 'Defines the overall security governance framework for BrightPath Health, establishing security roles, responsibilities, risk management processes, and baseline security requirements aligned with NIST 800-53 and HITRUST CSF.',
        version: '1.3',
        status: 'published',
        effectiveDaysAgo: 270,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Security Governance and Roles',
            content: 'The CISO reports to the CIO with dotted-line to the Board Audit Committee. The HIPAA Security Officer, Privacy Officer, and IT Security team maintain operational responsibility. Security steering committee meets quarterly to review risk posture, incident trends, and compliance metrics across all clinical and administrative systems.', // ip-hygiene:ignore — fictional demo policy
            familyCode: 'PL', familyName: 'Planning',
            controlPrefix: 'PL-',
          },
          {
            number: '2.0', title: 'Risk Management Framework',
            content: 'BrightPath Health adopts NIST SP 800-37 Risk Management Framework integrated with HITRUST CSF. Annual risk assessments cover all PHI-bearing systems, medical devices, and third-party integrations. Risk register is maintained in ControlWeave with quarterly executive reporting and OCR readiness review alignment.',
            familyCode: 'RA', familyName: 'Risk Assessment',
            controlPrefix: 'RA-',
          },
        ],
      },
      {
        name: 'Access Control & Authentication Policy',
        type: 'access_control_policy',
        description: 'Governs identity lifecycle management, role-based access controls, multi-factor authentication, and EHR access controls for BrightPath Health workforce members, contractors, and business associates.',
        version: '2.0',
        status: 'published',
        effectiveDaysAgo: 180,
        reviewFrequencyDays: 180,
        sections: [
          {
            number: '1.0', title: 'Authentication and MFA Standards',
            content: 'All workforce members authenticate via Azure AD with FIDO2/WebAuthn MFA for clinical systems. Epic EHR access requires context-aware authentication with location and device posture checks. Service accounts use managed identities where supported; API keys rotate every 90 days via Azure Key Vault. SMS-based OTP is prohibited for PHI-bearing systems.',
            familyCode: 'IA', familyName: 'Identification and Authentication',
            controlPrefix: 'IA-',
          },
          {
            number: '2.0', title: 'Role-Based Access and EHR Controls',
            content: 'Epic EHR access follows minimum necessary standard per §164.502(b). Clinical roles (physician, nurse, pharmacist) have pre-defined access templates. Break-the-glass access is logged and reviewed within 24 hours. Quarterly access recertification is mandatory for all users with PHI access. Offboarding triggers automated deprovisioning within 4 hours.',
            familyCode: 'AC', familyName: 'Access Control',
            controlPrefix: 'AC-',
          },
          {
            number: '3.0', title: 'Privileged Access Management',
            content: 'Administrative access to production PHI systems requires Azure AD Privileged Identity Management with just-in-time elevation, 4-hour maximum session duration, and mandatory MFA re-authentication. All privileged sessions are recorded and reviewed monthly by the Security Operations team.',
            familyCode: 'AC', familyName: 'Access Control',
            controlPrefix: 'AC-',
          },
        ],
      },
      {
        name: 'Incident Response & Breach Notification Policy',
        type: 'incident_response_policy',
        description: 'Defines the incident response lifecycle and HIPAA breach notification procedures for BrightPath Health, including the 60-day notification requirement under §164.404 and HHS OCR reporting obligations.', // ip-hygiene:ignore — fictional demo policy
        version: '1.5',
        status: 'published',
        effectiveDaysAgo: 150,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Detection, Triage, and Containment',
            content: 'Microsoft Sentinel SIEM and CrowdStrike Falcon provide 24/7 threat detection for all clinical and administrative systems. Security incidents are triaged within 30 minutes using the severity matrix. PHI-involved incidents are escalated to the Privacy Officer within 1 hour. Containment actions include credential revocation, network isolation, and Epic EHR emergency access suspension.',
            familyCode: 'IR', familyName: 'Incident Response',
            controlPrefix: 'IR-',
          },
          {
            number: '2.0', title: 'HIPAA Breach Notification',
            content: 'Breach risk assessment follows the four-factor test per §164.402. If a breach is confirmed, individual notification to affected patients must occur within 60 days per §164.404(b). Breaches affecting 500+ individuals require concurrent notification to HHS OCR and prominent media outlets. All breach investigations and notifications are documented in the breach log with 6-year retention.',
            familyCode: 'IR', familyName: 'Incident Response',
            controlPrefix: 'IR-',
          },
        ],
      },
      {
        name: 'Business Continuity & Disaster Recovery Policy',
        type: 'business_continuity_policy',
        description: 'Establishes recovery time objectives (RTO) and recovery point objectives (RPO) for BrightPath Health clinical systems, ensuring continuity of patient care and PHI availability per HIPAA §164.308(a)(7) contingency plan requirements.', // ip-hygiene:ignore — fictional demo policy
        version: '1.2',
        status: 'published',
        effectiveDaysAgo: 210,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Clinical System Recovery Objectives',
            content: 'Epic EHR production: RTO 4 hours / RPO 15 minutes. Clinical imaging (PACS): RTO 8 hours / RPO 1 hour. Telehealth platform: RTO 2 hours / RPO 30 minutes. Azure geo-redundant storage ensures cross-region failover. Downtime procedures for clinical staff are documented and tested semi-annually per HIPAA contingency plan requirements.', // ip-hygiene:ignore — fictional demo policy
            familyCode: 'CP', familyName: 'Contingency Planning',
            controlPrefix: 'CP-',
          },
          {
            number: '2.0', title: 'Backup and Recovery Testing',
            content: 'PHI database backups are performed hourly with Azure SQL geo-replication to paired region. Full restore testing is conducted quarterly with results documented as evidence. Annual tabletop disaster recovery exercise involves clinical leadership, IT, and compliance teams. Recovery procedures are validated against HIPAA §164.308(a)(7)(ii)(D) testing requirements.', // ip-hygiene:ignore — fictional demo policy
            familyCode: 'CP', familyName: 'Contingency Planning',
            controlPrefix: 'CP-',
          },
        ],
      },
    ];

    let policyCount = 0, sectionCount = 0, mappingCount = 0, reviewCount = 0;
    for (const pDef of policyDefs) {
      const effectiveDate = pDef.effectiveDaysAgo != null
        ? new Date(Date.now() - pDef.effectiveDaysAgo * 86400000).toISOString()
        : null;
      const nextReviewDate = pDef.effectiveDaysAgo != null
        ? new Date(Date.now() - pDef.effectiveDaysAgo * 86400000 + pDef.reviewFrequencyDays * 86400000).toISOString()
        : null;
      const approvedAt = pDef.status === 'published' || pDef.status === 'approved'
        ? new Date(Date.now() - (pDef.effectiveDaysAgo || 30) * 86400000 - 7 * 86400000).toISOString()
        : null;
      const publishedAt = pDef.status === 'published'
        ? new Date(Date.now() - pDef.effectiveDaysAgo * 86400000).toISOString()
        : null;

      const policyRes = await client.query(
        `INSERT INTO organization_policies
           (organization_id, policy_name, policy_type, description, version, status,
            effective_date, review_frequency_days, next_review_date,
            created_by, approved_by, approved_at, published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [orgId, pDef.name, pDef.type, pDef.description, pDef.version, pDef.status,
         effectiveDate, pDef.reviewFrequencyDays, nextReviewDate,
         adminId, approvedAt ? adminId : null, approvedAt, publishedAt]
      );
      const policyId = policyRes.rows[0].id;
      policyCount++;

      for (let si = 0; si < pDef.sections.length; si++) {
        const sec = pDef.sections[si];
        const secRes = await client.query(
          `INSERT INTO policy_sections
             (organization_id, policy_id, section_number, section_title, section_content,
              framework_family_code, framework_family_name, display_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING id`,
          [orgId, policyId, sec.number, sec.title, sec.content,
           sec.familyCode, sec.familyName, si + 1]
        );
        const sectionId = secRes.rows[0].id;
        sectionCount++;

        // Map section to up to 2 relevant controls by prefix
        const matchingControls = controlsByPrefix(sec.controlPrefix).slice(0, 2);
        for (const ctrl of matchingControls) {
          await client.query(
            `INSERT INTO policy_control_mappings
               (organization_id, policy_section_id, control_id, framework_id, mapping_notes)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (policy_section_id, control_id) DO NOTHING`,
            [orgId, sectionId, ctrl.id, ctrl.fw_id,
             `Mapped via ${sec.familyCode} family alignment`]
          );
          mappingCount++;
        }
      }

      // Add a completed policy review for published policies
      if (pDef.status === 'published') {
        const reviewDate = new Date(Date.now() - (pDef.effectiveDaysAgo || 30) * 86400000).toISOString().slice(0, 10);
        await client.query(
          `INSERT INTO policy_reviews
             (organization_id, policy_id, review_type, review_date, reviewed_by,
              review_status, review_notes, next_review_date, changes_made, requires_user_acknowledgment)
           VALUES ($1,$2,'annual',$3,$4,'completed',
                   $5,$6,true,false)`,
          [orgId, policyId, reviewDate, adminId,
           `Annual review of ${pDef.name} completed by Sam Rivera (CISO). No material changes required.`,
           nextReviewDate]
        );
        reviewCount++;
      }
    }
    console.log(`  ✓ ${policyCount} organization policies, ${sectionCount} sections, ${mappingCount} control mappings, ${reviewCount} reviews`);

    // ──────────────────────────────────────────────────────────────────────────
    // 15. Data Retention Policies
    // ──────────────────────────────────────────────────────────────────────────

    await client.query(
      'DELETE FROM data_retention_policies WHERE organization_id = $1',
      [orgId]
    );

    const retentionPolicies = [
      { dataType: 'evidence', retentionDays: 2190, description: 'Compliance evidence retained for 6 years per HIPAA record retention requirements' }, // ip-hygiene:ignore — fictional demo
      { dataType: 'audit_logs', retentionDays: 2190, description: 'Audit trail retained for 6 years per HIPAA administrative requirements' },
      { dataType: 'vulnerability_findings', retentionDays: 1095, description: 'Vulnerability records retained for 3 years for trend analysis and HIPAA risk assessment input' }, // ip-hygiene:ignore — fictional demo
      { dataType: 'assessment_results', retentionDays: 2190, description: 'HIPAA security risk assessment results retained for 6 years per record retention policy' }, // ip-hygiene:ignore — fictional demo
    ];

    for (const rp of retentionPolicies) {
      await client.query(
        `INSERT INTO data_retention_policies
           (organization_id, policy_name, resource_type, retention_days, auto_enforce, active, created_by)
         VALUES ($1,$2,$3,$4,true,true,$5)`,
        [orgId, `${rp.dataType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Retention`,
         rp.dataType, rp.retentionDays, adminId]
      );
    }
    console.log(`  ✓ ${retentionPolicies.length} data retention policies (HIPAA §164.530(j) aligned)`);

    // ──────────────────────────────────────────────────────────────────────────
    await client.query('COMMIT');

    // Summary
    const compliant = verifiedControlIds.length + implementedControlIds.length + crosswalkedControlIds.length;
    const compliancePct = total > 0 ? Math.round((compliant / total) * 1000) / 10 : 0;

    console.log('\n✅ Starter test data ready!\n');
    console.log(`  📊  Maturity Level 2 — ${compliancePct}% compliance (${compliant}/${total} controls)`);
    console.log(`  🔑  ${ADMIN_EMAIL} / ${PASSWORD}   (admin role)`);
    console.log(`  🔑  ${AUDITOR_EMAIL} / ${PASSWORD}  (auditor role — same org)\n`);
    console.log('  What to test per tab:\n');
    console.log('  📈  Dashboard         Compliance %, framework breakdown, control health scores');
    console.log('  📋  Frameworks        Starter frameworks adopted, crosswalk mappings visible');
    console.log('  ✅  Controls          Verified/implemented/crosswalk/in-progress/needs-review/not-started mix');
    console.log('  🔗  Crosswalk         Auto-satisfied controls, similarity scores, inheritance working');
    console.log(`  🛡️   Vulnerabilities   6 curated + ${hfVulnCount} HF findings, control work items (NC + partial + compliant)`);
    console.log('  📝  Assessments       Initial plan, 20 results (~50% satisfied + ~50% other_than_satisfied)');
    console.log('  📄  Evidence          8 documents linked to verified controls');
    console.log('  📋  POA&M             8 items: critical/high/medium/low, open/in-progress/closed');
    console.log('  🖥️   CMDB/Assets       7 assets, environment, service account, password vault');
    console.log('  ⚠️   Exceptions        3 control exceptions (active + expired)');
    console.log('  🤖  AI Decisions      5 entries, 2 bias flags, 2 human-reviewed');
    console.log('  🔔  Notifications     9 notifications (5 unread admin, auditor subset)');
    console.log('  📜  Audit Logs        13 entries covering all event types');
    console.log('  📑  Policies          5 healthcare policies with sections + control mappings');
    console.log('  🗄️   Retention         4 data retention policies (HIPAA §164.530(j) aligned)');
    console.log('  👤  Auditor Login     Same org — sees controls + relevant notifications');
    console.log('  ⚙️   Settings          LLM config, notification preferences\n');

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Seed failed:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
