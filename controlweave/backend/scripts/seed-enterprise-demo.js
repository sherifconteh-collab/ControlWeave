// @tier: exclude
/**
 * seed-enterprise-demo.js
 *
 * CISO-quality enterprise-tier demo with comprehensive test data covering
 * every major feature — designed for sales demonstrations:
 *
 *   - Enterprise org ("Meridian Financial Group", enterprise tier, active_paid)
 *   - Admin + auditor users (same org)
 *   - 8 frameworks adopted (NIST CSF 2.0, 800-53, ISO 27001, SOC 2, HIPAA, GDPR, AI RMF, FISCAM)
 *   - ~80% compliance maturity with realistic CISO-level control notes
 *   - 10 CMDB assets (financial services context)
 *   - 10 evidence files with SHA256 hashes and control links
 *   - 8 curated vulnerability findings with control work items + Hugging Face CVE enrichment
 *   - 8 POA&M items across priority levels
 *   - Assessment plan + 20 results (85% satisfied)
 *   - 3 control exceptions (active + expired)
 *   - 12 notifications (6 unread)
 *   - 6 AI decision log entries (bias flags + human review)
 *   - 13 audit log entries
 *   - 6 organization policies (security, access control, incident response, data protection, BCP/DR, TPRM)
 *     with ~18 sections, ~54 control mappings, and annual reviews
 *   - 5 data retention policies (evidence, audit logs, vulns, POA&M, assessments)
 *
 * Logins:
 *   admin@enterprise.com   / ControlWeave!2026   (admin)
 *   auditor@enterprise.com / ControlWeave!2026   (auditor — same org)
 *
 * Run:  npm run seed:enterprise-demo
 */
require('dotenv').config();
const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool   = require('../src/config/database');
const { mapCweToOwasp2025 } = require('../src/utils/owaspMapping');
const { fetchHfVulnerabilities } = require('./lib/hf-vulnerability-fetch');
const { findUserByEmail, upsertUserByEmail } = require('./lib/userSeedHelpers');

const ADMIN_EMAIL   = 'admin@enterprise.com';
const AUDITOR_EMAIL = 'auditor@enterprise.com';
const PASSWORD      = 'ControlWeave!2026';
const ORG_NAME      = 'Meridian Financial Group';
const SEED_TAG      = 'enterprise_demo_data';

const FRAMEWORK_CODES = [
  'nist_csf_2.0', 'nist_800_53', 'iso_27001', 'soc2',
  'hipaa', 'gdpr', 'nist_ai_rmf', 'fiscam',
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
    console.log('\n🚀 Seeding CISO-quality enterprise demo data (Meridian Financial Group)…\n');
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
        "UPDATE organizations SET name = $1, tier = 'enterprise', billing_status = 'active_paid' WHERE id = $2",
        [ORG_NAME, orgId]
      );
      console.log('  ↺ Existing org found — upgraded to enterprise');
    } else {
      const existingOrg = await client.query(
        'SELECT id FROM organizations WHERE name = $1', [ORG_NAME]
      );
      if (existingOrg.rows.length > 0) {
        orgId = existingOrg.rows[0].id;
        await client.query(
          "UPDATE organizations SET tier = 'enterprise', billing_status = 'active_paid' WHERE id = $1",
          [orgId]
        );
      } else {
        const r = await client.query(
          `INSERT INTO organizations (name, tier, billing_status, trial_status)
           VALUES ($1, 'enterprise', 'active_paid', 'none') RETURNING id`,
          [ORG_NAME]
        );
        orgId = r.rows[0].id;
      }
      console.log('  ✓ Enterprise org created / updated');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Users (admin + auditor)
    // ──────────────────────────────────────────────────────────────────────────
    const adminId = await upsertUserByEmail(client, {
      organizationId: orgId,
      email: ADMIN_EMAIL,
      passwordHash,
      firstName: 'Enterprise',
      lastName: 'Admin',
      role: 'admin',
    });

    const auditorId = await upsertUserByEmail(client, {
      organizationId: orgId,
      email: AUDITOR_EMAIL,
      passwordHash,
      firstName: 'Alex',
      lastName: 'Auditor',
      role: 'auditor',
    });

    // Populate full organization profile (CISO-quality demo data)
    await client.query(
      `INSERT INTO organization_profiles (
         organization_id,
         company_legal_name, company_description, industry, website,
         headquarters_location, employee_count_range,
         system_name, system_description,
         authorization_boundary, operating_environment_summary,
         confidentiality_impact, integrity_impact, availability_impact, impact_rationale,
         environment_types, deployment_model, cloud_providers, data_sensitivity_types,
         rmf_stage, rmf_notes,
         compliance_profile, nist_adoption_mode,
         onboarding_completed, onboarding_completed_at,
         created_by, updated_by
       ) VALUES (
         $1,
         $3, $4, $5, $6,
         $7, $8,
         $9, $10,
         $11, $12,
         'high', 'high', 'high', $13,
         $14::text[], 'multi_cloud', $15::text[], $16::text[],
         'assess', $17,
         'hybrid', 'mandatory',
         true, NOW(),
         $2, $2
       )
       ON CONFLICT (organization_id) DO UPDATE
         SET company_legal_name = EXCLUDED.company_legal_name,
             company_description = EXCLUDED.company_description,
             industry = EXCLUDED.industry,
             website = EXCLUDED.website,
             headquarters_location = EXCLUDED.headquarters_location,
             employee_count_range = EXCLUDED.employee_count_range,
             system_name = EXCLUDED.system_name,
             system_description = EXCLUDED.system_description,
             authorization_boundary = EXCLUDED.authorization_boundary,
             operating_environment_summary = EXCLUDED.operating_environment_summary,
             confidentiality_impact = EXCLUDED.confidentiality_impact,
             integrity_impact = EXCLUDED.integrity_impact,
             availability_impact = EXCLUDED.availability_impact,
             impact_rationale = EXCLUDED.impact_rationale,
             environment_types = EXCLUDED.environment_types,
             deployment_model = EXCLUDED.deployment_model,
             cloud_providers = EXCLUDED.cloud_providers,
             data_sensitivity_types = EXCLUDED.data_sensitivity_types,
             rmf_stage = EXCLUDED.rmf_stage,
             rmf_notes = EXCLUDED.rmf_notes,
             compliance_profile = EXCLUDED.compliance_profile,
             nist_adoption_mode = EXCLUDED.nist_adoption_mode,
             onboarding_completed = true,
             onboarding_completed_at = COALESCE(organization_profiles.onboarding_completed_at, NOW()),
             updated_by = $2`,
      [
        orgId,
        adminId,
        'Meridian Financial Group',
        'Meridian Financial Group is a Fortune 500 financial services and technology company providing trading platforms, banking services, payment processing, and AI-driven fraud detection across 40+ countries. Subject to multiple regulatory regimes including FISMA, HIPAA, PCI DSS, SOX, and GDPR.', // ip-hygiene:ignore — fictional demo company description, not standards text
        'Financial Services & Technology',
        'https://meridianfinancial.example.com',
        'New York, NY, United States',
        '5001-10000',
        'Meridian Financial Group Integrated Financial Platform',
        'Enterprise financial services platform encompassing trading systems, customer banking portals, payment processing gateways, AI fraud detection engines, and supporting infrastructure. Processes 2M+ transactions daily across regulated markets with PCI DSS Level 1 certification.',
        'The authorization boundary includes all production systems within the Meridian Financial Group AWS and Azure environments, on-premises data centers in NY and VA, the corporate VPN, and all endpoints managed by the enterprise MDM solution. Third-party SaaS integrations (CRM, ITSM, HCM platforms) are outside the boundary but connected via approved API gateways.',
        'Multi-cloud deployment across AWS (us-east-1, eu-west-1) and Azure (East US, West Europe) with on-premises data centers in New York and Virginia. Production workloads run on Kubernetes (EKS/AKS) with hardware security modules (HSMs) for key management. Disaster recovery site in Virginia with 4-hour RTO.',
        'All three CIA impact levels are rated HIGH due to: (1) Confidentiality — processing of PII, PHI, PCI cardholder data, and proprietary trading algorithms; (2) Integrity — financial transactions requiring ACID compliance and regulatory audit trails; (3) Availability — real-time trading platform with contractual 99.99% uptime SLA and regulatory reporting deadlines.',
        '{production,staging,development,on_prem,cloud}',
        '{AWS,Azure,Akamai CDN}',
        '{pii,phi,pci,financial,confidential,restricted}',
        'Currently in the Assess phase of the NIST RMF lifecycle. Security controls have been implemented across all major systems. Independent assessment team is conducting SP 800-53A evaluations with preliminary results showing 85% satisfaction rate. Target: complete assessment and submit Authorization package by Q3 2026.'
      ]
    );
    console.log('  ✓ Admin + auditor users created, organization profile populated');

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
        `Enterprise demo prerequisites missing framework catalog entries: ${missingFrameworkCodes.join(', ')}. Seed the global framework catalog first.`
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
    // 4. Control implementations — ~80% compliant
    //    Distribution: 38% verified, 22% implemented, 18% satisfied_via_crosswalk,
    //                  12% in_progress, 5% needs_review, 3% not_started, 2% not_applicable
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
      throw new Error('Enterprise demo prerequisites missing framework controls. No control implementations can be seeded.');
    }

    // Bucket boundaries
    const b1 = Math.round(total * 0.38);  // verified
    const b2 = Math.round(total * 0.60);  // implemented
    const b3 = Math.round(total * 0.78);  // satisfied_via_crosswalk
    const b4 = Math.round(total * 0.90);  // in_progress
    const b5 = Math.round(total * 0.95);  // needs_review
    const b6 = Math.round(total * 0.98);  // not_started

    const verifiedNotes = [
      'Annual penetration test confirms control effectiveness. Evidence on file.',
      'Third-party audit validated control implementation. No findings.',
      'Security assessment team verified control operating effectively.',
      'Quarterly review completed. Control meets all acceptance criteria.',
      'Independent assessor confirmed control effectiveness per FISMA requirements.',
    ];
    const implementedNotes = [
      'Policy deployed across all business units. Awaiting third-party verification cycle.',
      'Technical implementation complete. Evidence collection in progress.',
      'Control deployed to production environment. Monitoring effectiveness.',
      'Implementation verified by engineering team. Pending external audit.',
    ];
    const crosswalkNotes = [
      'Auto-satisfied via NIST 800-53 AC-2 crosswalk (≥90% similarity match).',
      'Inherited satisfaction from ISO 27001 A.5.15 mapping.',
      'Crosswalk auto-satisfaction applied per framework mapping policy.',
    ];
    const inProgressNotes = [
      'Rollout in progress across 4 business units. ETA Q2 2026.',
      'Implementation 60% complete. Integration testing underway.',
      'Pilot deployment to trading floor. Full rollout pending board approval.',
    ];
    const needsReviewNotes = [
      'Annual review overdue. Scheduling for next quarter.',
      'Evidence refresh required. Last reviewed 14 months ago.',
    ];
    const notStartedNotes = [
      'Backlogged — prioritized for next planning cycle.',
      'Deferred to FY2027 budget allocation.',
    ];
    const naNotes = [
      'Not applicable to financial services operations.',
      'Excluded from scope per authorization boundary.',
    ];

    let implCount = 0;
    const verifiedControlIds    = [];
    const implementedControlIds = [];
    const crosswalkedControlIds = [];
    const inProgressControlIds  = [];
    const needsReviewControlIds = [];
    const notStartedControlIds  = [];

    for (let i = 0; i < total; i++) {
      let status, notes;
      if (i < b1) {
        status = 'verified';
        notes = verifiedNotes[i % verifiedNotes.length];
      } else if (i < b2) {
        status = 'implemented';
        notes = implementedNotes[i % implementedNotes.length];
      } else if (i < b3) {
        status = 'satisfied_via_crosswalk';
        notes = crosswalkNotes[i % crosswalkNotes.length];
      } else if (i < b4) {
        status = 'in_progress';
        notes = inProgressNotes[i % inProgressNotes.length];
      } else if (i < b5) {
        status = 'needs_review';
        notes = needsReviewNotes[i % needsReviewNotes.length];
      } else if (i < b6) {
        status = 'not_started';
        notes = notStartedNotes[i % notStartedNotes.length];
      } else {
        status = 'not_applicable';
        notes = naNotes[i % naNotes.length];
      }

      const implDate = (status === 'verified' || status === 'implemented')
        ? new Date(Date.now() - Math.random() * 60 * 86400000).toISOString()
        : null;

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
    console.log(`      needs_review: ${needsReviewControlIds.length}  |  not_started: ${notStartedControlIds.length}  |  not_applicable: ${total - b6}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 5. CMDB — environments, assets, service accounts
    // ──────────────────────────────────────────────────────────────────────────
    const envResult = await client.query(`
      INSERT INTO environments (
        organization_id, name, code, environment_type,
        contains_pii, contains_phi, data_classification, security_level, criticality, owner_id
      )
      VALUES ($1, 'Production', 'prod-demo', 'production', true, true, 'restricted', 'high', 'critical', $2)
      ON CONFLICT (organization_id, code) DO UPDATE SET
        name = EXCLUDED.name, contains_pii = true, contains_phi = true,
        data_classification = 'restricted', security_level = 'high', criticality = 'critical',
        updated_at = NOW()
      RETURNING id
    `, [orgId, adminId]);
    const envId = envResult.rows[0].id;

    const vaultResult = await client.query(`
      INSERT INTO password_vaults (organization_id, name, vault_type, vault_url, is_active)
      VALUES ($1, 'Meridian Financial Vault', 'hashicorp_vault', 'https://vault.meridianfinancial.local', true)
      ON CONFLICT (organization_id, name) DO UPDATE SET is_active = true
      RETURNING id
    `, [orgId]);
    const vaultId = vaultResult.rows[0].id;

    const catRows = await client.query('SELECT id, code FROM asset_categories');
    const catByCode = new Map(catRows.rows.map(r => [r.code, r.id]));

    const assetDefs = [
      { name: 'Trading Platform API',        category: 'software',  hostname: 'trade-api-01',   ip: '10.40.1.10', classification: 'restricted',   criticality: 'critical' },
      { name: 'Customer Banking Portal',     category: 'software',  hostname: 'banking-web-01', ip: '10.40.1.11', classification: 'restricted',   criticality: 'critical' },
      { name: 'Core Database Cluster',       category: 'hardware',  hostname: 'db-cluster-01',  ip: '10.40.1.40', classification: 'restricted',   criticality: 'critical' },
      { name: 'Enterprise SIEM',             category: 'software',  hostname: 'siem-01',        ip: '10.40.1.60', version: '8.14.0', classification: 'confidential', criticality: 'high' },
      { name: 'Identity & Access Management',category: 'software',  hostname: 'iam-01',         ip: '10.40.1.61', classification: 'restricted',   criticality: 'high' },
      { name: 'Payment Processing Gateway',  category: 'software',  hostname: 'pay-gw-01',      ip: '10.40.1.12', classification: 'restricted',   criticality: 'critical' },
      { name: 'AI Fraud Detection Engine',   category: 'ai_agent',  modelType: 'llm', aiRisk: 'limited', classification: 'restricted', criticality: 'high' },
      { name: 'Endpoint Security Fleet',     category: 'hardware',  hostname: 'endpoint-gw',    ip: '10.40.1.70', classification: 'internal',     criticality: 'medium' },
      { name: 'Disaster Recovery Cluster',   category: 'hardware',  hostname: 'dr-cluster-01',  ip: '10.40.2.10', classification: 'confidential', criticality: 'high' },
      { name: 'Data Warehouse',              category: 'hardware',  hostname: 'dw-01',           ip: '10.40.1.80', classification: 'confidential', criticality: 'high' },
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
       VALUES ($1,'gsc-payment-svc','system_user','Payment gateway service account for transaction processing',$2,
               'Required for PCI-DSS compliant payment processing',$3,'/gsc/payment-svc','api_key',30,
               CURRENT_DATE + INTERVAL '30 day','admin','Payment processing zone',14,
               CURRENT_DATE + INTERVAL '14 day',$2,'active',true)
       ON CONFLICT (organization_id, account_name) DO UPDATE SET
         owner_id=EXCLUDED.owner_id, vault_id=EXCLUDED.vault_id, is_active=true, updated_at=NOW()`,
      [orgId, adminId, vaultId]
    );
    console.log(`  ✓ ${assetDefs.length} CMDB assets + environment + service account + vault`);

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Evidence files linked to controls
    // ──────────────────────────────────────────────────────────────────────────
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'enterprise-demo');
    ensureDir(uploadsDir);

    const evidenceDocs = [
      { fileName: 'Information_Security_Policy_v4.pdf', desc: 'Organization-wide information security policy approved by Board of Directors', mime: 'application/pdf' },
      { fileName: 'Penetration_Test_Report_Q1_2026.pdf', desc: 'External penetration test conducted by CrowdStrike — 3 critical, 7 high findings remediated', mime: 'application/pdf' },
      { fileName: 'SOC2_Type_II_Report_2025.pdf', desc: 'Independent SOC 2 Type II audit report covering Trust Services Criteria', mime: 'application/pdf' }, // ip-hygiene:ignore
      { fileName: 'Access_Review_Q4_2025.xlsx', desc: 'Quarterly privileged access review — 98% attestation rate across 2,400 accounts', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { fileName: 'Incident_Response_Plan_v3.pdf', desc: 'Incident response plan with tabletop exercise results from Q4 2025', mime: 'application/pdf' },
      { fileName: 'Vendor_Risk_Assessment_AWS_2025.pdf', desc: 'Third-party risk assessment for AWS — SOC 2 Type II current, BAA in place', mime: 'application/pdf' }, // ip-hygiene:ignore
      { fileName: 'BCP_DR_Test_Results_Q4_2025.pdf', desc: 'Annual BCP/DR exercise results — RTO achieved in 4 hours, RPO within 1 hour', mime: 'application/pdf' },
      { fileName: 'Privacy_Impact_Assessment_AI.pdf', desc: 'Privacy impact assessment for AI fraud detection system deployment', mime: 'application/pdf' },
      { fileName: 'Security_Awareness_Training_Records_2025.xlsx', desc: 'Security awareness training completion records — 98% completion rate across 5,000 employees', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { fileName: 'Encryption_Key_Management_Procedure.pdf', desc: 'Key rotation and management standard operating procedures for all environments', mime: 'application/pdf' },
    ];

    const linkedEvidenceIds = [];
    for (let i = 0; i < evidenceDocs.length; i++) {
      const ev = evidenceDocs[i];
      const content = `Enterprise Demo Evidence — ${ev.fileName}\nGenerated: ${new Date().toISOString()}`;
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
           ['enterprise-demo', 'financial-services'], sha256(content)]
        );
        evId = ins.rows[0].id;
      }
      linkedEvidenceIds.push(evId);

      // Link first 8 evidence items to first 8 verified controls
      if (i < verifiedControlIds.length && i < 8) {
        await client.query(
          `INSERT INTO evidence_control_links (evidence_id, control_id, notes)
           VALUES ($1, $2, 'Linked via enterprise demo data seed')
           ON CONFLICT (evidence_id, control_id) DO NOTHING`,
          [evId, verifiedControlIds[i].id]
        );
      }
    }
    console.log(`  ✓ ${evidenceDocs.length} evidence files linked to controls`);

    // ──────────────────────────────────────────────────────────────────────────
    // 7. Vulnerability findings + vulnerability_control_work_items
    // ──────────────────────────────────────────────────────────────────────────
    await client.query(
      `DELETE FROM vulnerability_findings WHERE organization_id = $1 AND metadata->>'seed_tag' = $2`,
      [orgId, SEED_TAG]
    );

    const vulnDefs = [
      { source:'ACAS', standard:'CVE/NVD', key:'ent-demo-001', vulnId:'CVE-2025-29927', title:'Next.js authorization bypass via middleware headers', severity:'critical', cvss:9.1, status:'open', daysAgo:7, asset:'Trading Platform API', cwe:'CWE-287', kev:true, exploit:true, dueInDays:14 },
      { source:'ACAS', standard:'CVE/NVD', key:'ent-demo-002', vulnId:'CVE-2025-21298', title:'Windows OLE remote code execution via crafted document', severity:'high', cvss:8.8, status:'in_progress', daysAgo:14, asset:'Endpoint Security Fleet', cwe:'CWE-416', kev:false, exploit:true, dueInDays:21 },
      { source:'ACAS', standard:'CVE/NVD', key:'ent-demo-003', vulnId:'CVE-2025-24813', title:'Apache Tomcat partial PUT RCE in banking portal', severity:'high', cvss:7.9, status:'in_progress', daysAgo:10, asset:'Customer Banking Portal', cwe:'CWE-502', kev:false, exploit:false, dueInDays:30 },
      { source:'STIG', standard:'DISA STIG', key:'ent-demo-004', vulnId:'RHEL-09-211010', title:'SSH root login permitted on database cluster', severity:'high', cvss:7.5, status:'open', daysAgo:21, asset:'Core Database Cluster', cwe:null, kev:false, exploit:false, dueInDays:14 },
      { source:'SBOM', standard:'CycloneDX', key:'ent-demo-005', vulnId:'CVE-2024-47195', title:'Financial platform transitive dependency vulnerability', severity:'medium', cvss:6.4, status:'open', daysAgo:30, asset:'Payment Processing Gateway', cwe:'CWE-1321', kev:false, exploit:false, dueInDays:45 },
      { source:'SCAP', standard:'CIS Benchmarks', key:'ent-demo-006', vulnId:'CIS-AWS-2.1.5', title:'S3 bucket public access not blocked for data warehouse', severity:'medium', cvss:5.8, status:'open', daysAgo:15, asset:'Data Warehouse', cwe:null, kev:false, exploit:false, dueInDays:30 },
      { source:'SAST', standard:'OWASP ASVS', key:'ent-demo-007', vulnId:'CVE-2024-38819', title:'Spring framework path traversal in banking portal', severity:'medium', cvss:5.3, status:'risk_accepted', daysAgo:45, asset:'Customer Banking Portal', cwe:'CWE-22', kev:false, exploit:false, dueInDays:60 },
      { source:'SAST', standard:'OWASP ASVS', key:'ent-demo-008', vulnId:'OWASP-ASVS-3.4.2', title:'Session token insufficient entropy in trading platform', severity:'low', cvss:3.1, status:'remediated', daysAgo:60, asset:'Trading Platform API', cwe:'CWE-331', kev:false, exploit:false, dueInDays:90 },
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
      { vulnIdx: 3, controls: inProgressControlIds.slice(2, 3),  effect: 'non_compliant', action: 'poam',              actionStatus: 'open' },
      { vulnIdx: 4, controls: crosswalkedControlIds.slice(0, 1), effect: 'partial',       action: 'risk_acceptance',   actionStatus: 'accepted' },
      { vulnIdx: 5, controls: crosswalkedControlIds.slice(1, 2), effect: 'partial',       action: 'poam',              actionStatus: 'open' },
      { vulnIdx: 6, controls: implementedControlIds.slice(0, 1), effect: 'partial',       action: 'close_control_gap',  actionStatus: 'in_progress' },
      { vulnIdx: 2, controls: implementedControlIds.slice(1, 2), effect: 'compliant',     action: 'close_control_gap',  actionStatus: 'resolved' },
      { vulnIdx: 7, controls: verifiedControlIds.slice(0, 1),    effect: 'compliant',     action: 'false_positive_review', actionStatus: 'closed' },
    ];

    let workItemCount = 0;
    for (const wi of ncWorkItems) {
      const vuln = insertedVulns[wi.vulnIdx];
      if (!vuln) continue;
      for (const ctrl of wi.controls) {
        if (!ctrl) continue;
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
    console.log(`  ✓ ${insertedVulns.length} curated vulnerability findings + ${workItemCount} control work items`);

    // ──────────────────────────────────────────────────────────────────────────
    // 7b. Hugging Face CVE enrichment — pull real-world CVEs to supplement curated data
    // ──────────────────────────────────────────────────────────────────────────
    const HF_VULN_COUNT = 20; // additional HF-sourced vulns on top of 8 curated
    const assetNames = Array.from(assetIdByName.keys());
    let hfVulnCount = 0;
    let hfWorkItemCount = 0;
    try {
      console.log('  ⬇ Fetching Hugging Face CVE data for enterprise enrichment...');
      const hfVulns = await fetchHfVulnerabilities(HF_VULN_COUNT, {
        sources: ['ACAS', 'SBOM', 'SCAP', 'STIG', 'SAST'],
        statuses: ['open', 'in_progress', 'risk_accepted', 'false_positive', 'remediated']
      });

      // Collect all control IDs for work item linking
      const allControlIds = [
        ...notStartedControlIds, ...inProgressControlIds,
        ...crosswalkedControlIds, ...implementedControlIds, ...verifiedControlIds
      ].filter(Boolean);

      for (let i = 0; i < hfVulns.length; i++) {
        const hv = hfVulns[i];
        const findingKey = `ent-hf-${String(i + 1).padStart(3, '0')}`;
        // Cycle through real assets so HF vulns are distributed across the environment
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
             CASE WHEN $14::int < 0 THEN CURRENT_DATE + ($14::int||' days')::interval ELSE CURRENT_DATE + ($14::int||' days')::interval END,
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

        // Link every 3rd HF vuln to a control as a work item for richer AI analysis
        if (i % 3 === 0 && allControlIds.length > 0) {
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
      console.warn('    Curated vulnerability data is still seeded. HF enrichment will be added on next run with network access.');
    }

    console.log(`  ✓ Total: ${insertedVulns.length + hfVulnCount} vulnerability findings + ${workItemCount + hfWorkItemCount} control work items`);

    // ──────────────────────────────────────────────────────────────────────────
    // 8. POA&M items
    // ──────────────────────────────────────────────────────────────────────────
    const poamData = [
      { title: 'Remediate Next.js CVE-2025-29927 in Trading Platform',       priority: 'critical', status: 'open' },
      { title: 'Deploy Privileged Access Workstation (PAW) solution',         priority: 'high',     status: 'in_progress' },
      { title: 'Complete GDPR Article 30 records of processing update',       priority: 'high',     status: 'in_progress' },
      { title: 'Implement SIEM alerting for after-hours admin access',       priority: 'medium',   status: 'open' },
      { title: 'Renew third-party SOC 2 audit engagement',                   priority: 'medium',   status: 'open' },
      { title: 'Rotate all service account credentials in payment zone',     priority: 'high',     status: 'in_progress' },
      { title: 'Conduct tabletop exercise for ransomware scenario',          priority: 'medium',   status: 'open' },
      { title: 'Complete vendor risk assessment backlog (14 vendors)',        priority: 'low',      status: 'open' },
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
    // 9. Assessment plan + results (~85% satisfied)
    // ──────────────────────────────────────────────────────────────────────────
    const planName = 'Annual FISMA Compliance Assessment 2026';
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
         VALUES ($1,$2,'Comprehensive annual FISMA compliance assessment covering all adopted frameworks.',
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

    if (procedures.rows.length === 0) {
      throw new Error('Enterprise demo prerequisites missing assessment procedures. Seed baseline assessment procedures first.');
    }

    for (const row of procedures.rows) {
      await client.query(
        `INSERT INTO assessment_plan_procedures (assessment_plan_id, assessment_procedure_id)
         VALUES ($1,$2) ON CONFLICT (assessment_plan_id, assessment_procedure_id) DO NOTHING`,
        [planId, row.id]
      );
    }

    // Cleanup prior seeded assessment results for idempotent re-runs
    await client.query(
      `DELETE FROM assessment_results WHERE organization_id = $1`,
      [orgId]
    );

    // ~85% satisfied: pattern repeats 17 satisfied out of 20
    const resultStatuses = [
      'satisfied','satisfied','satisfied','satisfied','satisfied',
      'satisfied','satisfied','satisfied','other_than_satisfied',
      'satisfied','satisfied','satisfied','satisfied',
      'satisfied','other_than_satisfied','satisfied','satisfied',
      'satisfied','satisfied','other_than_satisfied',
    ];
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
         st === 'satisfied' ? 'Control objective met; evidence supports effective implementation.' : 'Exception observed — compensating control exists but gap noted.',
         'Evidence reviewed during assessment period.',
         st === 'satisfied' ? 'low' : (i % 4 === 0 ? 'high' : 'medium'),
         st !== 'satisfied',
         i + 1]
      );
    }
    console.log(`  ✓ Assessment plan + ${Math.min(20, procedures.rows.length)} results (~85% satisfied)`);

    // ──────────────────────────────────────────────────────────────────────────
    // 10. Control exceptions (2 active + 1 expired)
    // ──────────────────────────────────────────────────────────────────────────
    const exceptionDefs = [
      {
        ctrlIdx: 0,
        title: 'MFA waiver for legacy trading terminal',
        reason: 'Legacy trading terminal does not support modern MFA protocols. Vendor upgrade scheduled for Q3 2026.',
        compensating: 'IP allowlisting restricted to trading floor subnet + mandatory VPN with certificate-based authentication.',
        impact: 'Low — compensating controls reduce residual risk. Trading terminal isolated on dedicated VLAN.',
        active: true,
        expiresDays: 90,
      },
      {
        ctrlIdx: 1,
        title: 'Encryption exception for on-prem backup tapes',
        reason: 'Legacy tape backup system does not support AES-256 encryption. Hardware refresh in FY2026 capital budget.',
        compensating: 'Physical vault with dual-person access control, 24/7 CCTV monitoring, and tamper-evident seals.',
        impact: 'Medium — physical security controls compensate. Data exposure risk limited to physical theft scenario.',
        active: true,
        expiresDays: 60,
      },
      {
        ctrlIdx: 2,
        title: 'FIPS 140-2 exception for legacy auth module',
        reason: 'Legacy authentication module uses non-FIPS-validated cryptographic library. Module scheduled for replacement.',
        compensating: 'Network segmentation and enhanced monitoring as compensating controls.',
        impact: 'N/A — exception expired. Module replacement completed.',
        active: false,
        expiresDays: -30,
      },
    ];

    // Cleanup prior seeded exceptions for idempotent re-runs
    await client.query(
      `DELETE FROM control_exceptions WHERE organization_id = $1`,
      [orgId]
    );

    const exceptionControls = inProgressControlIds.slice(0, 3);
    for (let i = 0; i < exceptionDefs.length && i < exceptionControls.length; i++) {
      const def = exceptionDefs[i];
      const ctrl = exceptionControls[def.ctrlIdx];
      if (!ctrl) continue;
      await client.query(
        `INSERT INTO control_exceptions (
           organization_id, control_id, title, reason, compensating_controls,
           business_impact, owner_id, approved_by, status, approved_at, expires_at, created_by
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$7)
         ON CONFLICT DO NOTHING`,
        [orgId, ctrl.id,
         `Exception: ${ctrl.control_id} — ${def.title}`,
         def.reason,
         def.compensating,
         def.impact,
         adminId, adminId,
         def.active ? 'active' : 'expired',
         def.active ? new Date().toISOString() : new Date(Date.now() - 90*86400000).toISOString(),
         new Date(Date.now() + def.expiresDays*86400000).toISOString().split('T')[0]]
      );
    }
    console.log('  ✓ Control exceptions (2 active + 1 expired)');

    // ──────────────────────────────────────────────────────────────────────────
    // 11. Notifications (12 — 6 unread for admin)
    // ──────────────────────────────────────────────────────────────────────────
    const notifications = [
      { type: 'control_due',         title: 'Controls Due for Review',          message: 'Multiple controls require periodic review — check the Controls tab.',                                    link: '/dashboard/controls',            read: false },
      { type: 'status_change',       title: 'Control Verified',                 message: 'AC-2 (Account Management) has been verified by the audit team.',                                          link: '/dashboard/controls',            read: false },
      { type: 'crosswalk',           title: 'Crosswalk Satisfaction Applied',   message: 'ISO 27001 A.5.15 auto-satisfied via crosswalk from NIST 800-53 AC-2 (95% match).',                        link: '/dashboard/frameworks/mappings', read: false }, // ip-hygiene:ignore
      { type: 'system',              title: 'New POA&M Item',                   message: 'Critical POA&M: Remediate Next.js CVE-2025-29927 in Trading Platform.',                                   link: '/dashboard/operations',          read: false },
      { type: 'assessment_needed',   title: 'Assessment Required',              message: 'Annual FISMA compliance assessment has open procedures requiring assessor input.',                         link: '/dashboard/assessments',         read: false },
      { type: 'vulnerability_alert', title: 'Critical Vulnerability Detected',  message: 'CVE-2025-29927 (CVSS 9.1) detected on Trading Platform API. KEV-listed — remediate within 14 days.',     link: '/dashboard/vulnerabilities',     read: false },
      { type: 'control_due',         title: 'Overdue Control',                  message: 'IA-2 (Identification and Authentication) review is 7 days overdue.',                                      link: '/dashboard/controls',            read: true  },
      { type: 'status_change',       title: 'Vulnerability Work Item Updated',  message: 'CVE-2025-21298 control-gap work item moved to in_progress.',                                              link: '/dashboard/vulnerabilities',     read: true  },
      { type: 'crosswalk',           title: 'New Crosswalk Opportunity',        message: 'NIST CSF DE.CM-01 could auto-satisfy SOC 2 CC7.1 — review crosswalk settings.',                           link: '/dashboard/frameworks/mappings', read: true  }, // ip-hygiene:ignore
      { type: 'system',              title: 'Evidence Expiring',                message: 'Penetration test evidence will expire in 30 days — schedule re-assessment.',                               link: '/dashboard/evidence',            read: true  },
      { type: 'assessment_needed',   title: 'Assessment Results Available',     message: 'FISMA assessment: 17/20 procedures satisfied. Review other_than_satisfied findings.',                      link: '/dashboard/assessments',         read: true  },
      { type: 'vulnerability_alert', title: 'Vulnerability Remediated',         message: 'OWASP-ASVS-3.4.2 session token entropy issue remediated on Trading Platform API.',                        link: '/dashboard/vulnerabilities',     read: true  },
    ];
    // Cleanup prior seeded notifications for idempotent re-runs
    await client.query(
      `DELETE FROM notifications WHERE organization_id = $1`,
      [orgId]
    );

    let notifCount = 0;
    for (let i = 0; i < notifications.length; i++) {
      const n = notifications[i];
      await client.query(
        `INSERT INTO notifications (organization_id, user_id, type, title, message, link, is_read, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW() - ($8 * interval '1 hour'))`,
        [orgId, adminId, n.type, n.title, n.message, n.link, n.read, i * 3]
      );
      // Auditor gets crosswalk + assessment + status_change + vulnerability notifications
      if (['crosswalk', 'assessment_needed', 'status_change', 'vulnerability_alert'].includes(n.type)) {
        await client.query(
          `INSERT INTO notifications (organization_id, user_id, type, title, message, link, is_read, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,false,NOW() - ($7 * interval '1 hour'))`,
          [orgId, auditorId, n.type, n.title, n.message, n.link, i * 3 + 1]
        );
      }
      notifCount++;
    }
    console.log(`  ✓ ${notifCount} notifications (admin: 6 unread, auditor subset)`);

    // ──────────────────────────────────────────────────────────────────────────
    // 12. AI decision log (6 entries — 2 bias flags, 2 human-reviewed+approved)
    // ──────────────────────────────────────────────────────────────────────────
    const aiDecisions = [
      {
        input: { type: 'gap_analysis', frameworks: ['nist_800_53','iso_27001','soc2','hipaa'], total_controls: total, industry: 'financial_services' }, // ip-hygiene:ignore
        output: { gaps: inProgressControlIds.length + notStartedControlIds.length, critical: 4, recommendations: ['Prioritize AC-2 account management implementation','Complete IA-2 multi-factor authentication rollout','Review SC-7 boundary protection for trading systems','Address HIPAA PHI access logging gaps'] }, // ip-hygiene:ignore
        risk: 'high', framework: 'NIST AI RMF', model: 'claude-sonnet-4-5-20250929',
        reviewed: true, outcome: 'approved', notes: 'Gap analysis approved by CISO. Recommendations aligned with FY2026 security roadmap.',
        bias: [],
      },
      {
        input: { type: 'compliance_report', period: 'Q1 2026', frameworks: ['soc2','hipaa'], industry: 'financial_services' },
        output: { text: 'Overall compliance posture demonstrates strong maturity at 80%+ control implementation. The organization exhibits exceptional commitment to regulatory compliance across financial services frameworks.' },
        risk: 'medium', framework: 'EU AI Act', model: 'claude-sonnet-4-5-20250929',
        reviewed: false, outcome: null, notes: null,
        bias: [{ type: 'subjectivity', description: 'Uses subjective terms ("exceptional commitment", "strong maturity") — consider replacing with quantitative metrics for board-level reporting.' }],
      },
      {
        input: { type: 'vendor_risk', vendor: 'Payment Processor X', services: ['payment_gateway','tokenization'], data: ['PCI','PII','financial'] },
        output: { risk_score: 68, risk_level: 'high', findings: ['PCI DSS attestation expires in 30 days','No independent pen test in 14 months','Subprocessor list not updated since 2024'] },
        risk: 'high', framework: 'NIST AI RMF', model: 'claude-sonnet-4-5-20250929',
        reviewed: false, outcome: null, notes: null,
        bias: [{ type: 'vendor_naming', description: 'Vendor name referenced throughout assessment — verify scoring reflects objective criteria independent of vendor relationship.' }],
      },
      {
        input: { type: 'incident_response_playbook', incident: 'ransomware', severity: 'critical', affected_systems: ['trading-platform','core-db','payment-gw'] },
        output: { steps: ['Isolate affected trading systems from network immediately','Activate BCP — switch to disaster recovery cluster','Preserve forensic evidence on core database cluster','Notify SEC/FINRA within regulatory timeframes','Engage CrowdStrike IR retainer'] },
        risk: 'high', framework: 'NIST AI RMF', model: 'gpt-4o',
        reviewed: true, outcome: 'approved', notes: 'Ransomware playbook reviewed and approved by CISO and General Counsel. Regulatory notification steps validated.',
        bias: [],
      },
      {
        input: { type: 'ai_risk_assessment', system: 'fraud_detection_engine', risk_category: 'algorithmic_bias', data_types: ['transaction_data','customer_demographics'] },
        output: { risk_level: 'medium', findings: ['Model shows 3.2% false positive rate disparity across demographic groups','Explainability documentation incomplete for regulatory review','Model drift detection not yet automated'] },
        risk: 'medium', framework: 'NIST AI RMF', model: 'claude-sonnet-4-5-20250929',
        reviewed: false, outcome: null, notes: null,
        bias: [],
      },
      {
        input: { type: 'compliance_forecast', current_score: 80, target_score: 95, timeline_months: 12, frameworks: ['nist_800_53','fiscam'] },
        output: { projected_score: 92, confidence: 0.82, key_risks: ['Budget constraints for PAW deployment','Vendor dependency for legacy trading terminal upgrade','Staff turnover in compliance team'] },
        risk: 'low', framework: 'NIST AI RMF', model: 'claude-sonnet-4-5-20250929',
        reviewed: false, outcome: null, notes: null,
        bias: [],
      },
    ];
    // Cleanup prior seeded AI decision log entries for idempotent re-runs
    await client.query(
      `DELETE FROM ai_decision_log WHERE organization_id = $1`,
      [orgId]
    );

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
    await client.query(
      `DELETE FROM audit_logs WHERE organization_id=$1 AND details->>'seed_tag'=$2`,
      [orgId, SEED_TAG]
    );

    const auditEvents = [
      { type: 'user_login',               resource: 'auth',                   resId: null,                       success: true,  failReason: null,                       min: 480, details: { seed_tag: SEED_TAG, summary: 'user_login event' } },
      { type: 'frameworks_updated',        resource: 'organization_frameworks',resId: null,                       success: true,  failReason: null,                       min: 450, details: { seed_tag: SEED_TAG, summary: 'frameworks_updated event' } },
      { type: 'control_status_changed',    resource: 'control',               resId: verifiedControlIds[0]?.id,  success: true,  failReason: null,                       min: 400, details: { seed_tag: SEED_TAG, old_status: 'implemented', status: 'verified', notes: 'Annual penetration test confirms control effectiveness.' } },
      { type: 'control_status_changed',    resource: 'control',               resId: implementedControlIds[0]?.id, success: true, failReason: null,                      min: 380, details: { seed_tag: SEED_TAG, old_status: 'in_progress', status: 'implemented', notes: 'Technical implementation complete and verified by engineering.' } },
      { type: 'crosswalk_auto_satisfied',  resource: 'control',               resId: crosswalkedControlIds[0]?.id, success: true, failReason: null,                      min: 360, details: { seed_tag: SEED_TAG, old_status: 'not_started', status: 'satisfied_via_crosswalk', notes: 'Auto-satisfied via crosswalk mapping (≥90% similarity).' } },
      { type: 'evidence_uploaded',         resource: 'evidence',              resId: linkedEvidenceIds[0],       success: true,  failReason: null,                       min: 320, details: { seed_tag: SEED_TAG, summary: 'evidence_uploaded event' } },
      { type: 'vulnerability_scan_imported', resource: 'vulnerability',       resId: insertedVulns[0]?.id,       success: true,  failReason: null,                       min: 280, details: { seed_tag: SEED_TAG, summary: 'vulnerability_scan_imported event' } },
      { type: 'poam_created',             resource: 'poam',                   resId: null,                       success: true,  failReason: null,                       min: 240, details: { seed_tag: SEED_TAG, summary: 'poam_created event' } },
      { type: 'report_generated',         resource: 'report',                 resId: null,                       success: true,  failReason: null,                       min: 200, details: { seed_tag: SEED_TAG, summary: 'report_generated event' } },
      { type: 'ai_analysis_requested',    resource: 'ai',                     resId: null,                       success: true,  failReason: null,                       min: 160, details: { seed_tag: SEED_TAG, summary: 'ai_analysis_requested event' } },
      { type: 'assessment_result_recorded',resource: 'assessment_procedure',  resId: procedures.rows[0]?.id,     success: true,  failReason: null,                       min: 120, details: { seed_tag: SEED_TAG, summary: 'assessment_result_recorded event' } },
      { type: 'settings_updated',         resource: 'organization_settings',  resId: null,                       success: true,  failReason: null,                       min: 60,  details: { seed_tag: SEED_TAG, summary: 'settings_updated event' } },
      { type: 'ai_analysis_requested',    resource: 'ai',                     resId: null,                       success: false, failReason: 'Provider API key not set', min: 30,  details: { seed_tag: SEED_TAG, summary: 'ai_analysis_requested event' } },
    ];
    for (const ev of auditEvents) {
      await client.query(
        `INSERT INTO audit_logs (organization_id, user_id, event_type, resource_type, resource_id,
           details, ip_address, user_agent, success, failure_reason, created_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,NOW() - ($11::int||' minutes')::interval)`,
        [orgId, adminId, ev.type, ev.resource, ev.resId,
         JSON.stringify(ev.details),
         '10.40.1.5', 'Enterprise Demo Seed', ev.success, ev.failReason, ev.min]
      );
    }
    console.log(`  ✓ ${auditEvents.length} audit log entries`);

    // ──────────────────────────────────────────────────────────────────────────
    // 14. Organization Policies — financial services CISO-level policy library
    // ──────────────────────────────────────────────────────────────────────────

    // Clean up prior seeded policies (cascades to sections, mappings, reviews)
    const priorPolicies = await client.query(
      'SELECT id FROM organization_policies WHERE organization_id = $1',
      [orgId]
    );
    if (priorPolicies.rows.length > 0) {
      const priorPolicyIds = priorPolicies.rows.map(r => r.id);
      const priorSections = await client.query(
        'SELECT id FROM policy_sections WHERE policy_id = ANY($1::uuid[])',
        [priorPolicyIds]
      );
      if (priorSections.rows.length > 0) {
        const priorSectionIds = priorSections.rows.map(r => r.id);
        await client.query(
          'DELETE FROM policy_control_mappings WHERE policy_section_id = ANY($1::uuid[])',
          [priorSectionIds]
        );
      }
      await client.query(
        'DELETE FROM policy_reviews WHERE policy_id = ANY($1::uuid[])',
        [priorPolicyIds]
      );
      await client.query(
        'DELETE FROM policy_sections WHERE policy_id = ANY($1::uuid[])',
        [priorPolicyIds]
      );
      await client.query(
        'DELETE FROM organization_policies WHERE id = ANY($1::uuid[])',
        [priorPolicyIds]
      );
    }

    // Helper: find controls by ID prefix (e.g. 'AC-', 'AU-')
    const controlsByPrefix = (prefix) => controls.filter(c => c.control_id.startsWith(prefix));

    const policyDefs = [
      {
        name: 'Information Security Policy',
        type: 'security_policy',
        description: 'Enterprise-wide information security policy establishing the security governance framework, roles and responsibilities, and baseline security requirements for all Meridian Financial Group information assets and operations.',
        version: '2.1',
        status: 'published',
        effectiveDaysAgo: 180,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Access Control Requirements',
            content: 'All access to Meridian Financial Group information systems must follow the principle of least privilege. Access is granted based on job function and requires manager approval with annual recertification for all privileged accounts.',
            familyCode: 'AC', familyName: 'Access Control',
            controlPrefix: 'AC-',
          },
          {
            number: '2.0', title: 'Audit and Accountability',
            content: 'Comprehensive audit logging is mandatory for all critical information systems. Audit records must capture user identity, event type, timestamp, and outcome. Logs are retained for a minimum of five years per regulatory requirements.',
            familyCode: 'AU', familyName: 'Audit and Accountability',
            controlPrefix: 'AU-',
          },
          {
            number: '3.0', title: 'Identification and Authentication',
            content: 'Multi-factor authentication is required for all remote access, privileged accounts, and customer-facing applications. Authentication mechanisms must meet NIST SP 800-63B assurance levels appropriate for the system risk classification.',
            familyCode: 'IA', familyName: 'Identification and Authentication',
            controlPrefix: 'IA-',
          },
          {
            number: '4.0', title: 'System and Communications Protection',
            content: 'All data in transit and at rest must be encrypted using FIPS 140-2 validated cryptographic modules. Network segmentation separates trading systems, customer data zones, and corporate infrastructure with monitored firewall boundaries.',
            familyCode: 'SC', familyName: 'System and Communications Protection',
            controlPrefix: 'SC-',
          },
        ],
      },
      {
        name: 'Access Control & Identity Management Policy',
        type: 'access_control_policy',
        description: 'Defines standards for identity lifecycle management, privileged access governance, and multi-factor authentication requirements across all Meridian Financial Group environments, aligned with FFIEC and NIST guidelines.',
        version: '3.0',
        status: 'published',
        effectiveDaysAgo: 90,
        reviewFrequencyDays: 180,
        sections: [
          {
            number: '1.0', title: 'Privileged Access Management',
            content: 'All privileged accounts must be managed through the enterprise PAM solution with session recording enabled. Standing privileges are prohibited; just-in-time access elevation is required with a maximum session duration of four hours.',
            familyCode: 'AC', familyName: 'Access Control',
            controlPrefix: 'AC-',
          },
          {
            number: '2.0', title: 'Multi-Factor Authentication Standards',
            content: 'FIDO2/WebAuthn is the primary authentication standard for all staff. SMS-based OTP is prohibited for privileged and externally-facing accounts. Hardware security keys are mandatory for administrators and trading floor personnel.',
            familyCode: 'IA', familyName: 'Identification and Authentication',
            controlPrefix: 'IA-',
          },
          {
            number: '3.0', title: 'Service Account Governance',
            content: 'Service accounts must be registered in the enterprise CMDB with a designated human owner. Credentials are stored in HashiCorp Vault with automatic rotation every 30 days. Orphaned accounts are disabled within 48 hours of detection.',
            familyCode: 'AC', familyName: 'Access Control',
            controlPrefix: 'AC-',
          },
        ],
      },
      {
        name: 'Incident Response Policy',
        type: 'incident_response_policy',
        description: 'Establishes the incident response lifecycle for Meridian Financial Group, including detection, analysis, containment, eradication, and recovery procedures aligned with NIST SP 800-61 and financial sector regulatory requirements.',
        version: '2.0',
        status: 'published',
        effectiveDaysAgo: 120,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Detection and Analysis',
            content: 'The Security Operations Center monitors all critical systems 24/7 using SIEM correlation rules and behavioral analytics. Alerts are triaged within 15 minutes with severity classification following the four-tier model defined in Appendix A.',
            familyCode: 'IR', familyName: 'Incident Response',
            controlPrefix: 'IR-',
          },
          {
            number: '2.0', title: 'Containment and Eradication',
            content: 'Containment actions must be initiated within one hour of confirmed incident declaration. Network isolation, credential revocation, and forensic imaging are standard first-response procedures. Eradication requires root cause confirmation before system restoration.',
            familyCode: 'IR', familyName: 'Incident Response',
            controlPrefix: 'IR-',
          },
          {
            number: '3.0', title: 'Recovery and Post-Incident Review',
            content: 'System recovery follows the prioritized asset restoration plan maintained in the CMDB. A post-incident review is conducted within 72 hours of incident closure. Lessons learned feed directly into control improvement backlog items.',
            familyCode: 'IR', familyName: 'Incident Response',
            controlPrefix: 'IR-',
          },
        ],
      },
      {
        name: 'Data Protection & Privacy Policy',
        type: 'data_governance_policy',
        description: 'Governs the classification, handling, retention, and cross-border transfer of sensitive data including PII, PHI, and financial records, ensuring compliance with GDPR, CCPA, GLBA, and internal data governance standards.',
        version: '1.5',
        status: 'published',
        effectiveDaysAgo: 60,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Data Classification and Handling',
            content: 'All data assets must be classified under the four-tier scheme: Public, Internal, Confidential, and Restricted. Classification determines encryption requirements, access controls, and retention periods. Data owners are responsible for initial classification.',
            familyCode: 'MP', familyName: 'Media Protection',
            controlPrefix: 'MP-',
          },
          {
            number: '2.0', title: 'PII and Customer Data Handling',
            content: 'Personally identifiable information must be encrypted at rest and in transit. Access to PII requires explicit business justification and is limited to designated data stewards. Automated DLP tools monitor for unauthorized PII exfiltration.',
            familyCode: 'SI', familyName: 'System and Information Integrity',
            controlPrefix: 'SI-',
          },
          {
            number: '3.0', title: 'Cross-Border Data Transfers',
            content: 'Data transfers to jurisdictions outside the approved list require a transfer impact assessment and legal review. Standard Contractual Clauses or Binding Corporate Rules must be in place prior to any transfer of restricted or confidential data.',
            familyCode: 'SC', familyName: 'System and Communications Protection',
            controlPrefix: 'SC-',
          },
        ],
      },
      {
        name: 'Business Continuity & Disaster Recovery Policy',
        type: 'business_continuity_policy',
        description: 'Defines business continuity planning and disaster recovery requirements for Meridian Financial Group, including RTO/RPO targets, annual testing cadence, and crisis communication procedures for critical financial services operations.',
        version: '1.0',
        status: 'approved',
        effectiveDaysAgo: null,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Business Continuity Planning',
            content: 'All critical business functions must have documented continuity plans with a maximum RTO of four hours and RPO of one hour. Plans are tested semi-annually through tabletop exercises and annually through full failover tests.',
            familyCode: 'CP', familyName: 'Contingency Planning',
            controlPrefix: 'CP-',
          },
          {
            number: '2.0', title: 'Disaster Recovery Testing',
            content: 'DR failover tests are conducted quarterly for Tier-1 systems and annually for all others. Test results are documented with remediation items tracked in the POA&M system. The DR site must demonstrate full operational capability within the defined RTO.',
            familyCode: 'CP', familyName: 'Contingency Planning',
            controlPrefix: 'CP-',
          },
        ],
      },
      {
        name: 'Third-Party Risk Management Policy',
        type: 'vendor_risk_policy',
        description: 'Establishes requirements for assessing, monitoring, and managing risks associated with third-party vendors, cloud service providers, and supply chain partners processing Meridian Financial Group data or providing critical services.',
        version: '0.9',
        status: 'draft',
        effectiveDaysAgo: null,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Vendor Assessment and Due Diligence',
            content: 'All vendors with access to confidential or restricted data must complete a security assessment prior to onboarding. Critical vendors require annual SOC 2 Type II reports and penetration test summaries. Risk ratings drive ongoing monitoring frequency.', // ip-hygiene:ignore — fictional demo policy, not standards text
            familyCode: 'SA', familyName: 'System and Services Acquisition',
            controlPrefix: 'SA-',
          },
          {
            number: '2.0', title: 'Supply Chain Risk Management',
            content: 'Software supply chain integrity is validated through SBOM analysis and dependency scanning. Vendors must attest to secure development practices and notify Meridian Financial Group within 24 hours of any security incident affecting shared services.',
            familyCode: 'SA', familyName: 'System and Services Acquisition',
            controlPrefix: 'SA-',
          },
        ],
      },
    ];

    let policyCount = 0;
    let sectionCount = 0;
    let mappingCount = 0;
    let reviewCount = 0;

    for (const pDef of policyDefs) {
      const effectiveDate = pDef.effectiveDaysAgo != null
        ? new Date(Date.now() - pDef.effectiveDaysAgo * 86400000).toISOString().slice(0, 10)
        : null;
      const nextReviewDate = effectiveDate
        ? new Date(Date.now() - pDef.effectiveDaysAgo * 86400000 + pDef.reviewFrequencyDays * 86400000).toISOString().slice(0, 10)
        : new Date(Date.now() + pDef.reviewFrequencyDays * 86400000).toISOString().slice(0, 10);
      const approvedAt = pDef.status !== 'draft'
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

        // Map section to up to 3 relevant controls by prefix
        const matchingControls = controlsByPrefix(sec.controlPrefix).slice(0, 3);
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
           `Annual review completed. Policy updated to v${pDef.version} with minor clarifications to align with latest regulatory guidance.`,
           nextReviewDate]
        );
        reviewCount++;
      }
    }

    console.log(`  ✓ ${policyCount} organization policies, ${sectionCount} sections, ${mappingCount} control mappings, ${reviewCount} reviews`);

    // ──────────────────────────────────────────────────────────────────────────
    // 15. Data Retention Policies
    // ──────────────────────────────────────────────────────────────────────────

    // Clean up prior retention policies for idempotency
    await client.query(
      'DELETE FROM data_retention_policies WHERE organization_id = $1',
      [orgId]
    );

    const retentionDefs = [
      { name: 'Evidence Document Retention',       resourceType: 'evidence',                days: 2555, autoEnforce: false }, // 7 years — SOX/FINRA requirement
      { name: 'Audit Log Retention',               resourceType: 'audit_logs',              days: 1825, autoEnforce: true  }, // 5 years — FFIEC/GLBA guidance
      { name: 'Vulnerability Finding Retention',   resourceType: 'vulnerability_findings',  days: 1095, autoEnforce: false }, // 3 years — PCI-DSS minimum
      { name: 'POA&M Record Retention',            resourceType: 'poam_items',              days: 2190, autoEnforce: false }, // 6 years — FISMA/OMB lifecycle
      { name: 'Assessment Result Retention',       resourceType: 'assessment_results',      days: 2555, autoEnforce: true  }, // 7 years — SOX/FINRA requirement
    ];

    for (const rd of retentionDefs) {
      await client.query(
        `INSERT INTO data_retention_policies
           (organization_id, policy_name, resource_type, retention_days, auto_enforce, active, created_by)
         VALUES ($1,$2,$3,$4,$5,true,$6)`,
        [orgId, rd.name, rd.resourceType, rd.days, rd.autoEnforce, adminId]
      );
    }

    console.log(`  ✓ ${retentionDefs.length} data retention policies`);

    // ──────────────────────────────────────────────────────────────────────────
    await client.query('COMMIT');

    // Post-commit verification — confirm critical data actually persisted
    const verify = await pool.query(
      `SELECT op.onboarding_completed,
              (SELECT COUNT(*) FROM organization_frameworks WHERE organization_id = $1) AS fw_count,
              (SELECT COUNT(*) FROM control_implementations WHERE organization_id = $1) AS impl_count
       FROM organization_profiles op
       WHERE op.organization_id = $1`,
      [orgId]
    );
    if (verify.rows.length === 0 || !verify.rows[0].onboarding_completed) {
      console.error('\n⚠️  Post-commit verification FAILED: onboarding_completed is not true.');
      console.error('    The enterprise demo account may redirect to onboarding instead of the dashboard.');
      console.error('    Re-run this script or use: node scripts/complete-demo-onboarding-via-api.js\n');
      process.exitCode = 1;
    } else {
      const v = verify.rows[0];
      console.log(`\n  ✓ Verified: onboarding_completed=true, ${v.fw_count} frameworks, ${v.impl_count} control implementations`);
    }

    // Summary
    const compliant = verifiedControlIds.length + implementedControlIds.length + crosswalkedControlIds.length;
    const compliancePct = total > 0 ? Math.round((compliant / total) * 1000) / 10 : 0;

    console.log('\n✅ Enterprise demo data ready!\n');
    console.log(`  📊  ~80% Compliance — ${compliancePct}% (${compliant}/${total} controls)`);
    console.log(`  🔑  ${ADMIN_EMAIL} / ${PASSWORD}   (admin role)`);
    console.log(`  🔑  ${AUDITOR_EMAIL} / ${PASSWORD}  (auditor role — same org)\n`);
    console.log('  What to test per tab:\n');
    console.log('  📈  Dashboard         Compliance %, framework breakdown, control health scores');
    console.log('  📋  Frameworks        8 frameworks adopted (NIST CSF/800-53, ISO 27001, SOC 2, HIPAA, GDPR, AI RMF, FISCAM)');
    console.log('  ✅  Controls          Verified/implemented/crosswalk/in-progress/needs-review/not-started/N-A');
    console.log('  🔗  Crosswalk         Auto-satisfied controls, similarity scores, inheritance working');
    console.log('  🛡️   Vulnerabilities   8 findings (critical→low), control work items (NC + partial + compliant)');
    console.log('  📝  Assessments       Annual FISMA plan, 20 results (~85% satisfied)');
    console.log('  📄  Evidence          10 documents linked to verified controls');
    console.log('  📋  POA&M             8 items: critical/high/medium/low, various statuses');
    console.log('  🖥️   CMDB/Assets       10 assets (financial services), environment, service account, vault');
    console.log('  ⚠️   Exceptions        3 control exceptions (2 active + 1 expired)');
    console.log('  🤖  AI Decisions      6 entries, 2 bias flags, 2 human-reviewed+approved');
    console.log('  🔔  Notifications     12 notifications (6 unread admin, auditor subset)');
    console.log('  📜  Audit Logs        13 entries covering all event types');
    console.log('  📑  Policies          6 organization policies (published/approved/draft) with section-to-control mappings');
    console.log('  🗄️   Data Retention    5 retention policies (evidence, audit logs, vulns, POA&M, assessments)');
    console.log('  👤  Auditor Login     Same org — sees controls + relevant notifications\n');

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
