/**
 * seed-govcloud-test-data.js
 *
 * CISO-quality showcase data for the govcloud demo account.
 * Models a regulated North American electric utility (~8,500 employees)
 * with OT/IT convergence and mandatory NERC CIP compliance.
 * Target maturity: ~90% compliant (regulators demand near-perfect compliance).
 *
 * Seeds every major feature tab:
 *   - Vanguard Defense Systems (govcloud tier, active_paid)
 *   - Admin + auditor users
 *   - ALL active frameworks (dynamic query) including NERC CIP
 *   - ~90% of controls implemented/verified (maturity level 4+)
 *   - OT/IT convergence CMDB (SCADA, EMS, DCS, substations, PI Historian)
 *   - 10 evidence files (NERC CIP compliance reports, OT security assessments)
 *   - 10 vulnerability findings (OT/ICS-relevant CVEs + SBOM supply chain + NERC audit findings)
 *   - 8 Hugging Face CVE enrichment findings (real-world defense/OT context)
 *   - Vulnerability control work items
 *   - Assessment plan + 25 results (~88% satisfied — NERC CIP self-assessment)
 *   - 8 POA&M items (NERC CIP focused)
 *   - 3 control exceptions (SERC-approved + expired)
 *   - 6 AI decision-log entries (2 bias flags, 2 human-reviewed)
 *   - 12 in-app notifications (6 unread)
 *   - 13 audit-log entries
 *   - 6 organization policies (NERC CIP/CMMC/defense) with sections + control mappings + reviews
 *   - 5 data retention policies (NERC CIP/DFARS 6-7 year retention)
 *   - Hugging Face CVE enrichment (graceful fallback if unreachable)
 *
 * Logins:
 *   admin@govcloud.com   / ControlWeave!2026   (admin)
 *   auditor@govcloud.com / ControlWeave!2026   (auditor — same org)
 *
 * Run:  npm run seed:govcloud-test-data
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

const ADMIN_EMAIL   = 'admin@govcloud.com';
const AUDITOR_EMAIL = 'auditor@govcloud.com';
const PASSWORD      = 'ControlWeave!2026';
const ORG_NAME      = 'Vanguard Defense Systems';
const SEED_TAG      = 'govcloud_demo_data';

// Rotating realistic notes — NERC CIP / utility context
const VERIFIED_NOTES = [
  'CIP-007 verification completed per annual NERC CIP audit. SERC regional entity review: zero violations.',
  'Electronic Security Perimeter (ESP) verified. All access points logged and reviewed — no exceptions.',
  'NERC CIP audit satisfied. Evidence submitted to SERC and accepted without findings.',
  'BES Cyber System categorization verified against CIP-002 criteria. High and Medium assets confirmed.',
  'CIP-004 personnel and training requirements verified. 100% of BES Cyber System personnel certified.',
  'CIP-006 physical security perimeter inspection passed. Camera coverage complete, badge access logs reviewed.',
  'Annual BES asset inventory reconciliation complete. No unaccounted BES Cyber Systems identified.',
  'CIP-010 configuration change management process verified. Change log complete and auditor-reviewed.',
  'Patch management compliance verified for all High BES Cyber Systems. 100% patch coverage this quarter.',
  'CIP-013 supply chain risk management plan reviewed and approved by SERC. No findings.',
  'FISMA-equivalent assessment satisfied — NIST 800-53 controls mapped to NERC CIP requirements.',
  'ISO 27001 surveillance audit passed. OT/IT security controls verified across both network segments.',
];

const IMPLEMENTED_NOTES = [
  'Policy deployed to all BES Cyber Systems. Patch window schedule documented and approved.',
  'Access control list updated for all Electronic Security Perimeters. Firewall rules validated.',
  'CIP-008 incident response plan updated and distributed. Table-top exercise scheduled for Q2 2026.',
  'Baseline configuration documented for all High-impact BES Cyber Systems. Change control active.',
  'Physical security upgrade complete — Hanwha cameras installed at 12 substations. Monitoring active.',
  'Supply chain risk assessment completed for 4 of 6 critical OT vendors. Remaining 2 in progress.',
  'CIP-009 recovery plan updated following DR exercise. Recovery time objectives validated.',
];

const CROSSWALK_NOTES = [
  'Auto-satisfied via NERC CIP CIP-005 → NIST CSF PR.AC crosswalk. ESP controls equivalent.',
  'Satisfied via CIP-007 → NIST 800-53 CM-7 crosswalk. System security management overlaps confirmed.',
  'Auto-satisfied via CIP-004 → ISO 27001 A.7 crosswalk. Personnel security requirements equivalent.',
  'CIP-006 → NIST 800-53 PE-3 crosswalk satisfied. Physical access controls meet both frameworks.',
  'Satisfied via NIST CSF PR.IP crosswalk — baseline configuration management controls equivalent.',
];

const IN_PROGRESS_NOTES = [
  'Remediating SERC audit finding F-2025-007. Patch deployment in progress for 3 legacy RTU devices.',
  'CIP-013 vendor assessment in progress for Schweitzer Engineering (SEL). Security questionnaire sent.',
  'Electronic access control matrix update in progress following substation commissioning (SUB-047).',
  'OT network segmentation enhancement underway. VLAN restructure to meet updated CIP-005 requirements.',
];

const NEEDS_REVIEW_NOTES = [
  'Scheduled for quarterly NERC CIP compliance review. Evidence refresh due: April 30, 2026.',
  'Policy language under review following NERC CIP v7 standard updates. Legal review pending.',
];

const NOT_STARTED_NOTES = [
  'Deferred — applies only to Transmission Owner functions; Vanguard Defense Systems is Distribution only.',
  'Not in scope for current NERC CIP applicability determination. Documented in applicability matrix.',
];

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function pickNote(notesArray, index) {
  return notesArray[index % notesArray.length];
}

async function upsertUser(client, organizationId, email, passwordHash, firstName, lastName, role) {
  return upsertUserByEmail(client, {
    organizationId,
    email,
    passwordHash,
    firstName,
    lastName,
    role,
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
  });
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n🚀 Seeding CISO-quality govcloud demo data (Vanguard Defense Systems)…\n');
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash(PASSWORD, 12);

    // ────────────────────────────────────────────────────────────────────────
    // 1. Organization
    // ────────────────────────────────────────────────────────────────────────
    let orgId;
    const existingUser = await findUserByEmail(client, ADMIN_EMAIL, { select: 'organization_id' });
    if (existingUser) {
      orgId = existingUser.organization_id;
      await client.query(
        "UPDATE organizations SET tier = 'govcloud', billing_status = 'active_paid' WHERE id = $1",
        [orgId]
      );
      console.log('  ↺ Existing org found — verified as govcloud tier');
    } else {
      const existingOrg = await client.query('SELECT id FROM organizations WHERE name = $1', [ORG_NAME]);
      if (existingOrg.rows.length > 0) {
        orgId = existingOrg.rows[0].id;
        await client.query(
          "UPDATE organizations SET tier = 'govcloud', billing_status = 'active_paid' WHERE id = $1",
          [orgId]
        );
      } else {
        const inserted = await client.query(
          `INSERT INTO organizations (name, tier, billing_status, trial_status)
           VALUES ($1, 'govcloud', 'active_paid', 'none') RETURNING id`,
          [ORG_NAME]
        );
        orgId = inserted.rows[0].id;
      }
      console.log('  ✓ Govcloud org created / updated');
    }

    // ────────────────────────────────────────────────────────────────────────
    // 2. Users (admin + auditor)
    // ────────────────────────────────────────────────────────────────────────
    const adminId   = await upsertUser(client, orgId, ADMIN_EMAIL,   passwordHash, 'Uma',  'Utilities', 'admin');
    const auditorId = await upsertUser(client, orgId, AUDITOR_EMAIL, passwordHash, 'Uri',  'Auditor',   'auditor');

    await client.query(
      `INSERT INTO organization_profiles (organization_id, onboarding_completed, onboarding_completed_at, created_by, updated_by)
       VALUES ($1, true, NOW(), $2, $2)
       ON CONFLICT (organization_id) DO UPDATE
         SET onboarding_completed = true,
             onboarding_completed_at = COALESCE(organization_profiles.onboarding_completed_at, NOW()),
             updated_by = EXCLUDED.updated_by`,
      [orgId, adminId]
    );
    console.log('  ✓ Admin + auditor users ready');

    // ────────────────────────────────────────────────────────────────────────
    // 3. Adopt ALL active frameworks (govcloud tier unlocks everything)
    // ────────────────────────────────────────────────────────────────────────
    const frameworksRes = await client.query('SELECT id, code FROM frameworks WHERE is_active = true ORDER BY code');
    const frameworks    = frameworksRes.rows;

    if (frameworks.length === 0) {
      throw new Error('GovCloud demo prerequisites missing framework catalog entries. Seed the global framework catalog first.');
    }

    for (const fw of frameworks) {
      await client.query(
        `INSERT INTO organization_frameworks (organization_id, framework_id)
         VALUES ($1, $2) ON CONFLICT (organization_id, framework_id) DO NOTHING`,
        [orgId, fw.id]
      );
    }
    console.log(`  ✓ Adopted ${frameworks.length} frameworks`);

    // ────────────────────────────────────────────────────────────────────────
    // 4. Control implementations — ~90% compliant
    //    verified: 50% | implemented: 22% | crosswalk: 16%
    //    in_progress: 8% | needs_review: 2% | not_started: 2%
    // ────────────────────────────────────────────────────────────────────────
    const controlsRes = await client.query(
      `SELECT fc.id, fc.control_id, fc.title, f.code AS fw_code, f.id AS fw_id
       FROM framework_controls fc
       JOIN organization_frameworks ofw ON ofw.framework_id = fc.framework_id
       JOIN frameworks f ON f.id = fc.framework_id
       WHERE ofw.organization_id = $1
       ORDER BY f.code, fc.control_id`,
      [orgId]
    );
    const controls = controlsRes.rows;
    const total    = controls.length;

    if (total === 0) {
      throw new Error('GovCloud demo prerequisites missing framework controls. No control implementations can be seeded.');
    }

    const b1 = Math.round(total * 0.50);  // verified
    const b2 = Math.round(total * 0.72);  // implemented
    const b3 = Math.round(total * 0.88);  // satisfied_via_crosswalk
    const b4 = Math.round(total * 0.96);  // in_progress
    const b5 = Math.round(total * 0.98);  // needs_review

    const verifiedControlIds    = [];
    const implementedControlIds = [];
    const inProgressControlIds  = [];
    let verifiedIdx = 0, implementedIdx = 0, crosswalkIdx = 0, inProgressIdx = 0, needsReviewIdx = 0, notStartedIdx = 0;

    for (let i = 0; i < total; i++) {
      let status, notes;
      const implDate = (i < b2)
        ? new Date(Date.now() - Math.floor(Math.random() * 75) * 86400000).toISOString()
        : null;

      if (i < b1) {
        status = 'verified';
        notes  = pickNote(VERIFIED_NOTES, verifiedIdx++);
        verifiedControlIds.push(controls[i]);
      } else if (i < b2) {
        status = 'implemented';
        notes  = pickNote(IMPLEMENTED_NOTES, implementedIdx++);
        implementedControlIds.push(controls[i]);
      } else if (i < b3) {
        status = 'satisfied_via_crosswalk';
        notes  = pickNote(CROSSWALK_NOTES, crosswalkIdx++);
      } else if (i < b4) {
        status = 'in_progress';
        notes  = pickNote(IN_PROGRESS_NOTES, inProgressIdx++);
        inProgressControlIds.push(controls[i]);
      } else if (i < b5) {
        status = 'needs_review';
        notes  = pickNote(NEEDS_REVIEW_NOTES, needsReviewIdx++);
      } else {
        status = 'not_started';
        notes  = pickNote(NOT_STARTED_NOTES, notStartedIdx++);
      }

      await client.query(
        `INSERT INTO control_implementations
           (organization_id, control_id, status, assigned_to, notes, implementation_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (organization_id, control_id) DO UPDATE
           SET status = EXCLUDED.status,
               assigned_to = EXCLUDED.assigned_to,
               notes = EXCLUDED.notes,
               implementation_date = EXCLUDED.implementation_date`,
        [orgId, controls[i].id, status, adminId, notes, implDate]
      );
    }

    console.log(`  ✓ ${total} control implementations`);
    console.log(`      verified: ${verifiedControlIds.length} | implemented: ${implementedControlIds.length} | in_progress: ${inProgressControlIds.length}`);

    // ────────────────────────────────────────────────────────────────────────
    // 5. CMDB — OT/IT convergence environments, assets, service accounts
    // ────────────────────────────────────────────────────────────────────────
    const otEnvResult = await client.query(`
      INSERT INTO environments (
        organization_id, name, code, environment_type,
        contains_pii, contains_phi, data_classification, security_level, criticality, owner_id
      )
      VALUES ($1, 'OT Network (BES Cyber Systems)', 'ot-bes-prod', 'production', false, false, 'restricted', 'high', 'critical', $2)
      ON CONFLICT (organization_id, code) DO UPDATE SET
        name = EXCLUDED.name, data_classification = 'restricted',
        security_level = 'high', criticality = 'critical', updated_at = NOW()
      RETURNING id
    `, [orgId, adminId]);
    const otEnvId = otEnvResult.rows[0].id;

    const itEnvResult = await client.query(`
      INSERT INTO environments (
        organization_id, name, code, environment_type,
        contains_pii, contains_phi, data_classification, security_level, criticality, owner_id
      )
      VALUES ($1, 'Corporate IT Network', 'corp-it-prod', 'production', true, false, 'confidential', 'moderate', 'high', $2)
      ON CONFLICT (organization_id, code) DO UPDATE SET
        name = EXCLUDED.name, contains_pii = true,
        data_classification = 'confidential', security_level = 'moderate', criticality = 'high',
        updated_at = NOW()
      RETURNING id
    `, [orgId, adminId]);
    const itEnvId = itEnvResult.rows[0].id;

    const vaultResult = await client.query(`
      INSERT INTO password_vaults (organization_id, name, vault_type, vault_url, is_active)
      VALUES ($1, 'Utility Ops CyberArk Vault', 'cyberark', 'https://cyberark.utilityops.internal', true)
      ON CONFLICT (organization_id, name) DO UPDATE SET is_active = true
      RETURNING id
    `, [orgId]);
    const vaultId = vaultResult.rows[0].id;

    const catRows = await client.query('SELECT id, code FROM asset_categories');
    const catByCode = new Map(catRows.rows.map(r => [r.code, r.id]));

    const assetDefs = [
      { name: 'Energy Management System (EMS)',       category: 'software',  envId: otEnvId, hostname: 'ot-ems-primary',   ip: '192.168.1.10', version: 'GE PSCAD 2024', classification: 'restricted',   criticality: 'critical' },
      { name: 'SCADA Control Platform',               category: 'software',  envId: otEnvId, hostname: 'ot-scada-01',      ip: '192.168.1.11', version: 'OSIsoft PI 2023', classification: 'restricted',  criticality: 'critical' },
      { name: 'Substation Automation Controller',     category: 'hardware',  envId: otEnvId, hostname: 'ot-sub-rtu-047',   ip: '192.168.1.12',                            classification: 'restricted',   criticality: 'critical' },
      { name: 'PI Historian Server',                  category: 'hardware',  envId: otEnvId, hostname: 'ot-historian-01',  ip: '192.168.1.40',                            classification: 'restricted',   criticality: 'high'     },
      { name: 'OT/IT Demarcation Firewall',           category: 'network',   envId: otEnvId, hostname: 'ot-fw-dmz-01',     ip: '192.168.1.1',  version: 'Fortinet FNOS 7.4', classification: 'restricted', criticality: 'critical' },
      { name: 'Corporate Domain Controller',          category: 'software',  envId: itEnvId, hostname: 'corp-dc-01',       ip: '10.50.1.10',   version: 'Windows Server 2022', classification: 'confidential', criticality: 'high' },
      { name: 'GIS Asset Management System',          category: 'software',  envId: itEnvId, hostname: 'corp-gis-01',      ip: '10.50.1.11',   version: 'ESRI ArcGIS 11.2', classification: 'internal',    criticality: 'medium'   },
      { name: 'OT Backup and Recovery System',        category: 'hardware',  envId: otEnvId, hostname: 'ot-backup-01',     ip: '192.168.1.50',                            classification: 'restricted',   criticality: 'high'     },
      { name: 'Operational Technology SIEM',          category: 'software',  envId: itEnvId, hostname: 'corp-siem-01',     ip: '10.50.1.60',   version: 'Claroty CTD 4.9',  classification: 'confidential', criticality: 'high'    },
      { name: 'Employee Identity Platform (IdP)',     category: 'software',  envId: itEnvId, hostname: 'corp-idp-01',      ip: '10.50.1.20',   version: 'Okta ISUE 2024',   classification: 'confidential', criticality: 'medium'   },
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
             version=COALESCE($7,version), security_classification=$8, criticality=$9,
             status='active', updated_at=NOW()
           WHERE id=$1`,
          [existing.rows[0].id, catId, adminId, def.envId,
           def.hostname||null, def.ip||null, def.version||null,
           def.classification, def.criticality]
        );
        assetIdByName.set(def.name, existing.rows[0].id);
      } else {
        const ins = await client.query(
          `INSERT INTO assets (organization_id, category_id, name, owner_id, environment_id, status,
             hostname, ip_address, version, security_classification, criticality)
           VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$8,$9,$10) RETURNING id`,
          [orgId, catId, def.name, adminId, def.envId,
           def.hostname||null, def.ip||null, def.version||null,
           def.classification, def.criticality]
        );
        assetIdByName.set(def.name, ins.rows[0].id);
      }
    }

    // Service accounts
    const svcAccounts = [
      {
        name: 'svc-ems-data-collector', type: 'system_user', cred: 'api_key',
        desc: 'EMS real-time data collection service account', biz: 'Required for automated SCADA telemetry collection and historian writes',
        vaultPath: '/utility-ops/ot/svc-ems-collector', rotation: 90, privilege: 'write',
        scope: 'OT network EMS and PI Historian read/write interfaces'
      },
      {
        name: 'svc-compliance-audit', type: 'service_principal', cred: 'oauth_token',
        desc: 'NERC CIP compliance audit automation account', biz: 'Automated evidence collection for SERC annual CIP audit submissions',
        vaultPath: '/utility-ops/compliance/svc-audit', rotation: 90, privilege: 'read',
        scope: 'Read-only access to BES Cyber System logs and compliance evidence repositories'
      },
    ];
    for (const svc of svcAccounts) {
      await client.query(
        `INSERT INTO service_accounts (
           organization_id, account_name, account_type, description, owner_id, business_justification,
           vault_id, vault_path, credential_type, rotation_frequency_days, next_rotation_date,
           privilege_level, scope, review_frequency_days, next_review_date, reviewer_id, status, is_active
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                 CURRENT_DATE + ($10::integer * interval '1 day'),
                 $11,$12,90, CURRENT_DATE + interval '90 day',$5,'active',true)
         ON CONFLICT (organization_id, account_name) DO UPDATE SET
           owner_id=EXCLUDED.owner_id, vault_id=EXCLUDED.vault_id, is_active=true, updated_at=NOW()`,
        [orgId, svc.name, svc.type, svc.desc, adminId, svc.biz,
         vaultId, svc.vaultPath, svc.cred, svc.rotation, svc.privilege, svc.scope]
      );
    }
    console.log(`  ✓ ${assetDefs.length} CMDB assets (OT/IT) + 2 environments + ${svcAccounts.length} service accounts`);

    // ────────────────────────────────────────────────────────────────────────
    // 6. Evidence files linked to controls
    // ────────────────────────────────────────────────────────────────────────
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'govcloud-demo');
    ensureDir(uploadsDir);

    const evidenceDocs = [
      { fileName: 'NERC_CIP_Compliance_Report_2025.pdf',           desc: 'Annual NERC CIP compliance filing submitted to SERC Reliability Corporation — zero violations reported', mime: 'application/pdf',     size: 1887436, tags: ['nerc_cip', 'compliance', 'annual'] },
      { fileName: 'SERC_Audit_Response_Q4_2025.pdf',               desc: 'SERC audit response package for CIP-005 and CIP-007 — all findings resolved, no remaining open items', mime: 'application/pdf',     size: 983040,  tags: ['nerc_cip', 'audit', 'serc'] },
      { fileName: 'BES_Cyber_System_Inventory_v5.xlsx',            desc: 'Approved BES Cyber System inventory per CIP-002-6 — 47 High, 112 Medium impact assets documented', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 225280, tags: ['nerc_cip', 'cmdb', 'inventory'] },
      { fileName: 'OT_Network_Security_Assessment.pdf',            desc: 'ICS/OT security assessment conducted by Dragos Inc — 6 findings, all remediated or accepted', mime: 'application/pdf',     size: 1228800, tags: ['assessment', 'ot-security', 'ics'] },
      { fileName: 'Incident_Response_Plan_ICS_v4.pdf',             desc: 'OT-specific IRP covering BES Cyber System incidents per CIP-008-6 — includes NERC E-ISAC escalation procedures', mime: 'application/pdf', size: 440320, tags: ['incident-response', 'nerc_cip', 'ics'] },
      { fileName: 'Access_Control_Review_BES_Q1_2026.xlsx',        desc: 'Electronic Access Control review per CIP-004-7 — 847 access permissions reviewed, 23 removals actioned', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 189440, tags: ['access-control', 'nerc_cip', 'quarterly'] },
      { fileName: 'Supply_Chain_Risk_Management_Plan.pdf',         desc: 'CIP-013-2 supply chain risk management plan — covers 34 OT vendors including Siemens, ABB, GE, and SEL', mime: 'application/pdf', size: 389120, tags: ['supply-chain', 'nerc_cip', 'vendor-risk'] },
      { fileName: 'Physical_Security_Inspection_Report.pdf',       desc: 'CIP-006-6 physical security perimeter inspection — 14 substations and 2 control centers inspected, zero violations', mime: 'application/pdf', size: 296960, tags: ['physical-security', 'nerc_cip'] },
      { fileName: 'Recovery_Plan_Test_Results_2025.pdf',           desc: 'CIP-009-6 recovery plan annual test — full recovery of EMS and SCADA within 4-hour RTO objective achieved', mime: 'application/pdf', size: 348160, tags: ['bcp', 'recovery', 'nerc_cip'] },
      { fileName: 'Security_Awareness_Training_ICS_2025.xlsx',     desc: 'OT/ICS security awareness training completion records — 98.6% completion (8,380/8,500 utility staff)', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 97280, tags: ['training', 'awareness', 'nerc_cip'] },
    ];

    const linkedEvidenceIds = [];
    for (let i = 0; i < evidenceDocs.length; i++) {
      const ev = evidenceDocs[i];
      const hashContent   = `${ORG_NAME}:${ev.fileName}:${ev.desc}`;
      const filePath      = `/uploads/govcloud-demo/${ev.fileName}`;
      const integrityHash = sha256(hashContent);

      const localPath = path.join(uploadsDir, ev.fileName);
      if (!fs.existsSync(localPath)) {
        fs.writeFileSync(localPath, `Vanguard Defense Systems — NERC CIP Demo Evidence\n${ev.desc}\nGenerated: ${new Date().toISOString()}\n`, 'utf8');
      }

      const existingEv = await client.query(
        'SELECT id FROM evidence WHERE organization_id = $1 AND file_name = $2 LIMIT 1',
        [orgId, ev.fileName]
      );

      let evId;
      if (existingEv.rows.length > 0) {
        evId = existingEv.rows[0].id;
        await client.query(
          `UPDATE evidence SET file_path=$3, file_size=$4, mime_type=$5, description=$6,
             tags=$7, integrity_hash_sha256=$8, retention_until=CURRENT_DATE + INTERVAL '2190 day',
             integrity_verified_at=NOW(), updated_at=NOW()
           WHERE id=$1 AND organization_id=$2`,
          [evId, orgId, filePath, ev.size, ev.mime, ev.desc, ev.tags, integrityHash]
        );
      } else {
        const ins = await client.query(
          `INSERT INTO evidence (organization_id, uploaded_by, file_name, file_path, file_size, mime_type, description,
             tags, integrity_hash_sha256, evidence_version, retention_until, integrity_verified_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,CURRENT_DATE + INTERVAL '2190 day',NOW()) RETURNING id`,
          [orgId, adminId, ev.fileName, filePath, ev.size, ev.mime, ev.desc, ev.tags, integrityHash]
        );
        evId = ins.rows[0].id;
      }
      linkedEvidenceIds.push(evId);

      // Link first 8 evidence items to verified controls
      if (i < 8 && i < verifiedControlIds.length) {
        await client.query(
          `INSERT INTO evidence_control_links (evidence_id, control_id, notes)
           VALUES ($1, $2, $3)
           ON CONFLICT (evidence_id, control_id) DO NOTHING`,
          [evId, verifiedControlIds[i].id,
           `${ev.fileName} — evidence collected for NERC CIP ${i < 4 ? 'CIP-007' : i < 6 ? 'CIP-005' : 'CIP-004'} control verification.`]
        );
      }
    }
    console.log(`  ✓ ${evidenceDocs.length} evidence files (NERC CIP) + ${Math.min(8, verifiedControlIds.length)} control links`);

    // ────────────────────────────────────────────────────────────────────────
    // 7. Vulnerability findings + control work items (OT/ICS context)
    // ────────────────────────────────────────────────────────────────────────
    await client.query(
      `DELETE FROM vulnerability_findings WHERE organization_id = $1 AND metadata->>'seed_tag' = $2`,
      [orgId, SEED_TAG]
    );

    const vulnDefs = [
      {
        source: 'ACAS', standard: 'CVE/NVD', key: 'util-demo-001', vulnId: 'CVE-2025-27840',
        title: 'Siemens SCALANCE XB-200 industrial switch remote code execution',
        desc: 'A critical stack buffer overflow in Siemens SCALANCE XB-200 series industrial switches allows unauthenticated RCE via crafted HTTP requests. Affects firmware versions <4.5. Present on OT network perimeter switches.',
        severity: 'critical', cvss: 9.4, status: 'open', daysAgo: 7, assetName: 'SCADA Control Platform',
        cwe: 'CWE-121', kev: false, exploit: true, dueInDays: 14,
        frameworks: ['nerc_cip', 'nist_csf_2.0', 'nist_800_53'],
      },
      {
        source: 'ACAS', standard: 'CVE/NVD', key: 'util-demo-002', vulnId: 'CVE-2024-47555',
        title: 'GE Vernova EMS authentication bypass via session fixation',
        desc: 'The GE Vernova Energy Management System web interface is vulnerable to session fixation attacks, allowing an attacker with network access to hijack operator sessions and issue dispatch commands.',
        severity: 'high', cvss: 8.7, status: 'in_progress', daysAgo: 21, assetName: 'Energy Management System (EMS)',
        cwe: 'CWE-384', kev: false, exploit: false, dueInDays: 30,
        frameworks: ['nerc_cip', 'nist_800_53'],
      },
      {
        source: 'ACAS', standard: 'CVE/NVD', key: 'util-demo-003', vulnId: 'CVE-2024-33001',
        title: 'OSIsoft PI Historian SQL injection in data query API',
        desc: 'An authenticated SQL injection vulnerability in the OSIsoft PI Historian AF Server data query API allows read access to process historian data outside authorized query scope.',
        severity: 'high', cvss: 7.8, status: 'open', daysAgo: 35, assetName: 'PI Historian Server',
        cwe: 'CWE-89', kev: false, exploit: false, dueInDays: 30,
        frameworks: ['nerc_cip', 'nist_800_53', 'iso_27001'],
      },
      {
        source: 'STIG', standard: 'NERC CIP Audit Finding', key: 'util-demo-004', vulnId: 'CIP-007-6-R2-2025-F007',
        title: 'NERC CIP-007-6 R2: Security patch applied outside authorized maintenance window',
        desc: 'SERC audit finding F-2025-007: Two Medium-impact BES Cyber Systems (SUB-047 RTU A and B) received firmware patches outside the authorized 35-day maintenance window. Documentation submitted — waiting for SERC acceptance.',
        severity: 'high', cvss: 7.5, status: 'open', daysAgo: 14, assetName: 'Substation Automation Controller',
        cwe: null, kev: false, exploit: false, dueInDays: 30,
        frameworks: ['nerc_cip'],
      },
      {
        source: 'SCAP', standard: 'CIS Benchmarks', key: 'util-demo-005', vulnId: 'CVE-2024-29944',
        title: 'Fortinet FortiOS management interface accessible from OT network segment',
        desc: 'CIS Benchmark finding: The OT/IT demarcation firewall management interface is reachable from within the OT network segment, violating least-privilege access requirements for management plane traffic.',
        severity: 'medium', cvss: 6.7, status: 'in_progress', daysAgo: 28, assetName: 'OT/IT Demarcation Firewall',
        cwe: 'CWE-284', kev: false, exploit: false, dueInDays: 45,
        frameworks: ['nerc_cip', 'nist_csf_2.0', 'nist_800_53'],
      },
      {
        source: 'ACAS', standard: 'CVE/NVD', key: 'util-demo-006', vulnId: 'CVE-2023-30991',
        title: 'Weak default credential in legacy SEL RTU (risk accepted)',
        desc: 'A Schweitzer Engineering (SEL) RTU device at Substation 22 was found using a factory-default Telnet password that cannot be changed without firmware replacement. Risk accepted with compensating controls pending hardware refresh (Q3 2027 budget).',
        severity: 'medium', cvss: 6.1, status: 'risk_accepted', daysAgo: 90, assetName: 'Substation Automation Controller',
        cwe: 'CWE-1391', kev: false, exploit: false, dueInDays: null,
        frameworks: ['nerc_cip', 'nist_800_53'],
      },
      {
        source: 'SCAP', standard: 'CIS Benchmarks', key: 'util-demo-007', vulnId: 'CIS-ICS-3.5',
        title: 'OT remote access not routed through approved jump server (CIS ICS 3.5)',
        desc: 'CIS ICS Controls benchmark finding: Remote maintenance access to 4 substation controllers bypasses the designated jump server, connecting directly from vendor laptops. Requires firewall rule remediation.',
        severity: 'medium', cvss: 5.9, status: 'open', daysAgo: 14, assetName: 'Corporate Domain Controller',
        cwe: 'CWE-269', kev: false, exploit: false, dueInDays: 45,
        frameworks: ['nerc_cip', 'nist_csf_2.0'],
      },
      {
        source: 'STIG', standard: 'NERC CIP Audit Finding', key: 'util-demo-008', vulnId: 'NERC-CIP-007-PATCH-01',
        title: 'CIP-007-6 R2: Patch log incomplete for 2 BES Cyber Systems — remediated',
        desc: 'SERC found that patch management logs for OT Backup Node A and B were missing security patch entries for October 2025. Logs have been reconstructed from vendor records and submitted to SERC. Finding closed.',
        severity: 'low', cvss: 3.2, status: 'remediated', daysAgo: 60, assetName: 'OT Backup and Recovery System',
        cwe: null, kev: false, exploit: false, dueInDays: null,
        frameworks: ['nerc_cip'],
      },
      {
        source: 'SBOM', standard: 'CycloneDX', key: 'util-demo-009', vulnId: 'CVE-2024-48990',
        title: 'Vulnerable firmware version in Schweitzer SEL-751 relay',
        desc: 'CycloneDX SBOM analysis identified Schweitzer SEL-751 protection relay firmware v3.4.2 contains a known stack-based buffer overflow. Affects relay communication module used in 8 distribution substations. Firmware upgrade coordinated with SEL through CIP-013 supply chain process.',
        severity: 'high', cvss: 7.6, status: 'in_progress', daysAgo: 18, assetName: 'Substation Automation Controller',
        cwe: 'CWE-121', kev: false, exploit: false, dueInDays: 30,
        frameworks: ['nerc_cip', 'nist_800_53'],
      },
      {
        source: 'SBOM', standard: 'CycloneDX', key: 'util-demo-010', vulnId: 'CVE-2024-45321',
        title: 'OpenSSL vulnerability in SCADA HMI software',
        desc: 'CycloneDX SBOM analysis of SCADA HMI application (GE iFIX v6.5) identified bundled OpenSSL 1.1.1w with known timing side-channel vulnerability. Affects operator workstation TLS connections to PI Historian. Vendor patch pending — compensating network segmentation controls in place per CIP-005.',
        severity: 'medium', cvss: 5.3, status: 'open', daysAgo: 25, assetName: 'SCADA Control Platform',
        cwe: 'CWE-203', kev: false, exploit: false, dueInDays: 45,
        frameworks: ['nerc_cip', 'nist_csf_2.0', 'nist_800_53'],
      },
    ];

    const workItemEffects  = ['non_compliant', 'non_compliant', 'partial', 'non_compliant', 'partial', 'compliant', 'partial', 'compliant', 'non_compliant', 'partial'];
    const workItemActions  = ['poam', 'close_control_gap', 'poam', 'poam', 'close_control_gap', 'risk_acceptance', 'poam', 'false_positive_review', 'poam', 'close_control_gap'];
    const workItemStatuses = ['open', 'in_progress', 'open', 'open', 'in_progress', 'accepted', 'open', 'resolved', 'in_progress', 'open'];

    let vulnCount = 0;
    for (let vi = 0; vi < vulnDefs.length; vi++) {
      const v = vulnDefs[vi];
      const detectedAt  = new Date(Date.now() - v.daysAgo * 86400000);
      const firstSeenAt = new Date(detectedAt.getTime() - 14 * 86400000);
      const dueDate     = v.dueInDays ? new Date(Date.now() + v.dueInDays * 86400000) : null;
      const owaspCat    = v.cwe ? mapCweToOwasp2025(v.cwe) : null;
      const assetId     = assetIdByName.get(v.assetName) || null;

      const vulnRes = await client.query(
        `INSERT INTO vulnerability_findings (
           organization_id, asset_id, source, standard, finding_key, vulnerability_id,
           title, description, severity, cvss_score, status,
           first_seen_at, last_seen_at, detected_at, due_date,
           cwe_id, owasp_top10_2025_category, kev_listed, exploit_available, metadata
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb)
         RETURNING id`,
        [
          orgId, assetId, v.source, v.standard, v.key, v.vulnId,
          v.title, v.desc, v.severity, v.cvss, v.status,
          firstSeenAt, detectedAt, detectedAt, dueDate,
          v.cwe, owaspCat, v.kev, v.exploit,
          JSON.stringify({ seed_tag: SEED_TAG, frameworks: v.frameworks }),
        ]
      );
      const vulnId = vulnRes.rows[0].id;

      const ctlPool = verifiedControlIds.length > 0 ? verifiedControlIds : implementedControlIds;
      if (ctlPool.length > 0) {
        const ctl = ctlPool[vi % ctlPool.length];
        const implRes = await client.query(
          'SELECT id FROM control_implementations WHERE organization_id = $1 AND control_id = $2 LIMIT 1',
          [orgId, ctl.id]
        );
        if (implRes.rows.length > 0) {
          await client.query(
            `INSERT INTO vulnerability_control_work_items (
               organization_id, vulnerability_id, framework_control_id, implementation_id,
               action_type, action_status, control_effect, response_summary, due_date, owner_id, created_by, metadata
             )
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11::jsonb)
             ON CONFLICT DO NOTHING`,
            [
              orgId, vulnId, ctl.id, implRes.rows[0].id,
              workItemActions[vi], workItemStatuses[vi], workItemEffects[vi],
              `${v.severity === 'critical' ? 'Critical OT finding — escalated to CISO and NERC CIP compliance team.' : v.severity === 'high' ? 'High-priority remediation tracked in NERC CIP POA&M register.' : 'Documented per NERC CIP evidence retention requirements.'}`,
              dueDate, adminId,
              JSON.stringify({ seed_tag: SEED_TAG }),
            ]
          );
        }
      }
      vulnCount++;
    }
    console.log(`  ✓ ${vulnCount} vulnerability findings (OT/ICS + SBOM context) + control work items`);

    // ────────────────────────────────────────────────────────────────────────
    // 7b. Hugging Face CVE enrichment — pull real-world CVEs for defense/OT context
    // ────────────────────────────────────────────────────────────────────────
    const HF_VULN_COUNT = 8;
    const assetNames = Array.from(assetIdByName.keys());
    let hfVulnCount = 0;
    let hfWorkItemCount = 0;
    try {
      console.log('  ⬇ Fetching Hugging Face CVE data for GovCloud defense enrichment...');
      const hfVulns = await fetchHfVulnerabilities(HF_VULN_COUNT, {
        sources: ['ACAS', 'DISA STIG', 'SBOM', 'SCAP'],
        statuses: ['open', 'in_progress', 'remediated']
      });

      const allControlIds = [
        ...verifiedControlIds, ...implementedControlIds, ...inProgressControlIds
      ].filter(Boolean);

      for (let i = 0; i < hfVulns.length; i++) {
        const hv = hfVulns[i];
        const findingKey = `govcloud-hf-${String(i + 1).padStart(3, '0')}`;
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
             `HF-sourced ${hv.cve} — ${effect === 'non_compliant' ? 'NERC CIP control gap identified' : 'partial remediation tracked in POA&M register'} for ${ctrl.control_id}`,
             adminId,
             JSON.stringify({ seed_tag: SEED_TAG, source: 'huggingface' })]
          );
          hfWorkItemCount++;
        }
      }
      console.log(`  ✓ ${hfVulnCount} Hugging Face CVE findings + ${hfWorkItemCount} work items (defense/OT enrichment)`);
    } catch (hfErr) {
      console.warn(`  ⚠ Hugging Face enrichment skipped: ${String(hfErr?.message || hfErr)}`);
      console.warn('    Curated vulnerability data is still seeded. HF enrichment will be retried on next run if connectivity is restored.');
    }

    // ────────────────────────────────────────────────────────────────────────
    // 8. POA&M items (NERC CIP focused)
    // ────────────────────────────────────────────────────────────────────────
    const poamItems = [
      { title: 'Remediate Siemens SCALANCE CVE-2025-27840 on OT perimeter switches',
        desc: 'Emergency firmware update for all SCALANCE XB-200 switches (14 units) on OT network. Coordinate with OT operations for maintenance window. Validate with ACAS rescan. Document as CIP-007 patch management event.',
        priority: 'critical', status: 'open', dueDays: 14 },
      { title: 'Complete CIP-007 patch documentation for SERC audit finding F-2025-007',
        desc: 'Prepare and submit patch management documentation for SUB-047 RTU A and B to resolve SERC audit finding F-2025-007. Documentation due to SERC by April 15, 2026.',
        priority: 'high', status: 'in_progress', dueDays: 30 },
      { title: 'Deploy OT remote access jump server for vendor maintenance sessions',
        desc: 'Procure and deploy dedicated jump server (Privileged Remote Access) in OT DMZ to enforce policy for all vendor remote access to BES Cyber Systems. CIP-005 and CIP-007 compliance requirement.',
        priority: 'high', status: 'in_progress', dueDays: 45 },
      { title: 'Complete CIP-013 supply chain risk review for 6 pending OT vendors',
        desc: 'Annual supply chain risk review required for: Siemens (SCADA), ABB (protection relays), Landis+Gyr (AMI), Itron (meters), Aclara (NMS), and OSIsoft (Historian). CIP-013-2 compliance deadline: June 1, 2026.',
        priority: 'high', status: 'open', dueDays: 45 },
      { title: 'Update BES Cyber System inventory after SUB-047 and SUB-062 commissioning',
        desc: 'Two new substations (SUB-047 and SUB-062) were commissioned in Q1 2026. CIP-002-6 applicability determination and asset categorization must be completed within 30 days of commissioning.',
        priority: 'medium', status: 'open', dueDays: 60 },
      { title: 'Conduct CIP-008 ICS incident response tabletop exercise',
        desc: 'Annual ICS incident response drill per CIP-008-6. Scenario: ransomware affecting Energy Management System. Participants: OT operations, IT security, legal, executive team, and regional E-ISAC liaison.',
        priority: 'medium', status: 'open', dueDays: 90 },
      { title: 'Implement automated patch compliance reporting for NERC CIP dashboard',
        desc: 'Build automated monthly report integrating Claroty CTD and ACAS scan data to show patch compliance rate per BES Cyber System. Reduces manual SERC audit evidence preparation time by approximately 40 hours/year.',
        priority: 'medium', status: 'in_progress', dueDays: 60 },
      { title: 'Annual review and update of Electronic Access Control matrix (CIP-004-7)',
        desc: 'Annual review of all electronic access permissions to BES Cyber Systems per CIP-004-7. Review covers 847 permissions across 159 BES Cyber Systems. Owner: CISO team. Deadline: Q2 2026.',
        priority: 'low', status: 'open', dueDays: 120 },
    ];

    let poamCount = 0;
    for (const item of poamItems) {
      const existing = await client.query(
        'SELECT id FROM poam_items WHERE organization_id = $1 AND title = $2 LIMIT 1',
        [orgId, item.title]
      );
      if (existing.rows.length === 0) {
        const due = new Date(Date.now() + item.dueDays * 86400000);
        await client.query(
          `INSERT INTO poam_items (organization_id, title, description, priority, status, due_date, owner_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [orgId, item.title, item.desc, item.priority, item.status, due.toISOString(), adminId]
        );
        poamCount++;
      }
    }
    console.log(`  ✓ ${poamCount} POA&M items (NERC CIP focused)`);

    // ────────────────────────────────────────────────────────────────────────
    // 9. Assessment plan + procedures + results
    // ────────────────────────────────────────────────────────────────────────
    const planTitle = 'NERC CIP Annual Compliance Self-Assessment 2026 (Vanguard Defense Systems)';
    let planId;
    const existingPlan = await client.query(
      'SELECT id FROM assessment_plans WHERE organization_id = $1 AND name = $2 LIMIT 1',
      [orgId, planTitle]
    );
    if (existingPlan.rows.length > 0) {
      planId = existingPlan.rows[0].id;
    } else {
      const startDate = new Date(Date.now() - 45 * 86400000);
      const planRes = await client.query(
        `INSERT INTO assessment_plans (organization_id, name, description, assessment_type, depth, status, lead_assessor_id, start_date)
         VALUES ($1,$2,$3,'annual','comprehensive','in_progress',$4,$5) RETURNING id`,
        [orgId, planTitle,
         'Comprehensive annual NERC CIP self-assessment covering CIP-002 through CIP-014 standards for all High and Medium-impact BES Cyber Systems. Results submitted to SERC Reliability Corporation.',
         adminId, startDate.toISOString()]
      );
      planId = planRes.rows[0].id;
    }

    const procRes = await client.query(
      `SELECT ap.id
       FROM assessment_procedures ap
       JOIN framework_controls fc ON fc.id = ap.framework_control_id
       JOIN frameworks f ON f.id = fc.framework_id
       JOIN organization_frameworks ofw ON ofw.framework_id = f.id AND ofw.organization_id = $1
       ORDER BY
         CASE WHEN lower(f.code) = 'nerc_cip' THEN 0 ELSE 1 END,
         f.code,
         fc.control_id,
         ap.procedure_id
       LIMIT 25`,
      [orgId]
    );
    const procedures = procRes.rows;

    if (procedures.length === 0) {
      throw new Error('GovCloud demo prerequisites missing assessment procedures. Seed baseline assessment procedures first.');
    }

    for (const row of procedures) {
      await client.query(
        `INSERT INTO assessment_plan_procedures (assessment_plan_id, assessment_procedure_id)
         VALUES ($1,$2)
         ON CONFLICT (assessment_plan_id, assessment_procedure_id) DO NOTHING`,
        [planId, row.id]
      );
    }

    await client.query(
      `DELETE FROM assessment_results WHERE organization_id = $1`,
      [orgId]
    );

    // ~88% satisfied
    const satisfiedPattern = ['satisfied', 'satisfied', 'satisfied', 'satisfied', 'satisfied', 'satisfied', 'satisfied', 'other_than_satisfied', 'satisfied', 'satisfied', 'satisfied', 'satisfied', 'other_than_satisfied'];
    let resultCount = 0;
    for (let ri = 0; ri < Math.min(procedures.length, 25); ri++) {
      const proc = procedures[ri];
      const isSatisfied = satisfiedPattern[ri % satisfiedPattern.length] === 'satisfied';
      const assessed = new Date(Date.now() - (25 - ri) * 86400000);

      const existingResult = await client.query(
        'SELECT id FROM assessment_results WHERE assessment_procedure_id = $1 AND organization_id = $2 LIMIT 1',
        [proc.id, orgId]
      );
      if (existingResult.rows.length === 0) {
        await client.query(
          `INSERT INTO assessment_results (organization_id, assessment_procedure_id, assessor_id, status, finding, evidence_collected, risk_level, remediation_required, assessed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            orgId, proc.id, auditorId,
            isSatisfied ? 'satisfied' : 'other_than_satisfied',
            isSatisfied
              ? 'NERC CIP control requirement satisfied. Evidence reviewed by compliance team and found complete. No audit findings raised.'
              : 'Control implementation requires attention. ' + (ri % 2 === 0 ? 'Evidence documentation incomplete — missing configuration baseline records.' : 'Process not consistently applied across all in-scope BES Cyber Systems.') + ' Remediation plan required.',
            isSatisfied ? 'BES Cyber System configuration logs, access records, and policy documentation reviewed.' : 'Partial evidence — configuration evidence available but audit trail incomplete.',
            isSatisfied ? 'low' : (ri % 3 === 0 ? 'high' : 'medium'),
            !isSatisfied,
            assessed.toISOString(),
          ]
        );
        resultCount++;
      }
    }
    console.log(`  ✓ NERC CIP assessment plan: ${resultCount} results (~88% satisfied)`);

    // ────────────────────────────────────────────────────────────────────────
    // 10. Control exceptions (NERC CIP context)
    // ────────────────────────────────────────────────────────────────────────
    const exceptions = [
      {
        control: verifiedControlIds[0],
        title: 'CIP-007-6 patch exception — legacy SEL-321 relay firmware (SERC-approved)',
        reason: 'SEL-321 protection relays at 6 transmission substations run firmware version 5.1.7, which has a known vulnerability (CVE-2023-30991). Firmware update requires relay replacement ($4.2M capital expenditure). SERC has granted a TFE (Technical Feasibility Exception).',
        compensating: 'Telnet disabled on all affected relays. Relays isolated to dedicated VLAN with ACL-restricted access. Monthly manual vulnerability scan. Physical access badge-controlled. CyberArk session recording for any maintenance access.',
        impact: 'Legacy relay firmware vulnerability present at 6 substations. Telnet interface exploitable if attacker gains network access to relay VLAN.',
        status: 'active', expiresInDays: 120,
      },
      {
        control: verifiedControlIds[1],
        title: 'CIP-006 physical access log retention exception — paper-based rural substations',
        reason: 'Three remote substations (SUB-112, SUB-118, SUB-127) use paper sign-in logs due to lack of reliable network connectivity for electronic access control. Digital upgrade on 5-year infrastructure roadmap.',
        compensating: 'Paper logs scanned and uploaded to SharePoint monthly. Physical locks changed quarterly. Camera coverage 24/7 via cellular-connected DVR. Remote site inspection quarterly by field crew.',
        impact: 'Electronic access log immediately upon access not available for 3 substations. Monthly upload creates a documentation gap.',
        status: 'active', expiresInDays: 90,
      },
      {
        control: verifiedControlIds[2] || inProgressControlIds[0],
        title: 'CIP-013 vendor exception — single-source OT vendor (expired)',
        reason: 'Schweitzer Engineering (SEL) is sole-source for protection relay firmware. Prior exception allowed waiver of security questionnaire requirement due to absence of competitive alternatives. Exception expired and not renewed — full questionnaire now required annually.',
        compensating: 'SEL SOC 2 Type II report on file. Annual security review call conducted with SEL security team. Vulnerability monitoring via CISA ICS-CERT advisories.', // ip-hygiene:ignore
        impact: 'Sole-source vendor relationship creates supply chain risk concentration.',
        status: 'expired', expiresInDays: -60,
      },
    ];

    let excCount = 0;
    for (const ex of exceptions) {
      if (!ex.control) continue;
      const existing = await client.query(
        'SELECT id FROM control_exceptions WHERE organization_id = $1 AND title = $2 LIMIT 1',
        [orgId, ex.title]
      );
      if (existing.rows.length === 0) {
        const approvedAt = new Date(Date.now() - 90 * 86400000);
        const expiresAt  = new Date(Date.now() + ex.expiresInDays * 86400000);
        await client.query(
          `INSERT INTO control_exceptions (organization_id, control_id, title, reason, compensating_controls, business_impact, owner_id, approved_by, status, approved_at, expires_at, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$7)`,
          [orgId, ex.control.id, ex.title, ex.reason, ex.compensating, ex.impact,
           adminId, auditorId, ex.status, approvedAt.toISOString(), expiresAt.toISOString()]
        );
        excCount++;
      }
    }
    console.log(`  ✓ ${excCount} control exceptions (NERC CIP TFE + paper log exception + 1 expired)`);

    // ────────────────────────────────────────────────────────────────────────
    // 11. In-app notifications (12 total — 6 unread for admin)
    // ────────────────────────────────────────────────────────────────────────
    const notifications = [
      { type: 'vulnerability_alert', title: 'Critical OT Vulnerability: CVE-2025-27840', message: 'Siemens SCALANCE RCE (CVSS 9.4) detected on OT network perimeter switches. Affects 14 devices. Remediation due in 14 days.', link: '/dashboard/vulnerabilities', read: false, hoursAgo: 4 },
      { type: 'assessment_needed',   title: 'NERC CIP Self-Assessment: 5 Procedures Outstanding', message: 'Annual CIP self-assessment has 5 procedures requiring evidence submission before April 30, 2026 SERC deadline.', link: '/dashboard/assessments', read: false, hoursAgo: 8 },
      { type: 'control_due',         title: 'CIP-007 Patch Window Opening: March 15–21', message: 'Quarterly NERC CIP patch maintenance window opens in 5 days. 23 patches queued for BES Cyber Systems.', link: '/dashboard/controls', read: false, hoursAgo: 16 },
      { type: 'system',              title: 'POA&M Created: Siemens SCALANCE Remediation', message: 'Critical POA&M item created for CVE-2025-27840 SCALANCE RCE. Due: 14 days. Owner: OT Security team.', link: '/dashboard/operations', read: false, hoursAgo: 24 },
      { type: 'status_change',       title: 'Control Verified: CIP-007-6 R2 Patch Management', message: 'Q1 2026 patch management cycle complete. CIP-007-6 R2 verified across all High-impact BES Cyber Systems.', link: '/dashboard/controls', read: false, hoursAgo: 36 },
      { type: 'crosswalk',           title: 'Crosswalk: CIP-005 → NIST CSF PR.AC auto-satisfied', message: 'NERC CIP CIP-005 Electronic Security Perimeter crosswalk satisfied 8 NIST CSF controls. Review crosswalk mappings.', link: '/dashboard/frameworks/mappings', read: false, hoursAgo: 48 }, // ip-hygiene:ignore
      { type: 'vulnerability_alert', title: 'SERC Audit Finding F-2025-007 Response Submitted', message: 'CIP-007 patch documentation submitted to SERC for finding F-2025-007. Awaiting SERC acceptance (expected 30 days).', link: '/dashboard/vulnerabilities', read: true, hoursAgo: 60 },
      { type: 'control_due',         title: 'CIP-004 Personnel Review Due: April 30', message: 'Annual CIP-004-7 personnel training and access review due in 21 days. 847 permissions to review.', link: '/dashboard/controls', read: true, hoursAgo: 72 },
      { type: 'system',              title: 'Supply Chain Risk Review: 6 OT Vendors Pending', message: 'CIP-013-2 annual supply chain risk reviews overdue for 6 OT vendors. TPRM questionnaires sent. Responses pending.', link: '/dashboard/operations', read: true, hoursAgo: 84 },
      { type: 'assessment_needed',   title: 'CIP-009 Recovery Plan Annual Test Passed', message: 'CIP-009-6 recovery plan test completed. All BES Cyber Systems recovered within 4-hour RTO. Evidence uploaded.', link: '/dashboard/assessments', read: true, hoursAgo: 96 },
      { type: 'status_change',       title: 'Evidence Uploaded: NERC CIP Compliance Report 2025', message: 'Annual NERC CIP compliance filing uploaded and linked to 8 CIP controls. Ready for SERC submission.', link: '/dashboard/evidence', read: true, hoursAgo: 120 },
      { type: 'crosswalk',           title: 'New Crosswalk: NIST 800-53 SI-3 → CIP-007 R4', message: 'ControlWeaver identified crosswalk between NIST 800-53 SI-3 (Malicious Code Protection) and CIP-007-6 R4. Enable to auto-satisfy 6 controls.', link: '/dashboard/frameworks/mappings', read: true, hoursAgo: 144 }, // ip-hygiene:ignore
    ];

    let notifCount = 0;
    for (const n of notifications) {
      await client.query(
        `INSERT INTO notifications (organization_id, user_id, type, title, message, link, is_read, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, NOW() - ($8 * interval '1 hour'))`,
        [orgId, adminId, n.type, n.title, n.message, n.link, n.read, n.hoursAgo]
      );
      if (n.type === 'assessment_needed' || n.type === 'status_change') {
        await client.query(
          `INSERT INTO notifications (organization_id, user_id, type, title, message, link, is_read, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,false, NOW() - ($7 * interval '1 hour'))`,
          [orgId, auditorId, n.type, n.title, n.message, n.link, n.hoursAgo + 3]
        );
      }
      notifCount++;
    }
    console.log(`  ✓ ${notifCount} notifications for admin (6 unread)`);

    // ────────────────────────────────────────────────────────────────────────
    // 12. AI Decision Log (6 entries — utility/OT compliance context)
    // ────────────────────────────────────────────────────────────────────────
    const aiDecisions = [
      {
        input: { frameworks: ['nerc_cip', 'nist_csf_2.0', 'nist_800_53', 'iso_27001'], ot_assets: 6, it_assets: 4, org: 'Vanguard Defense Systems' },
        output: { gaps: 8, nerc_cip_gaps: 3, recommendations: ['Remediate CVE-2025-27840 SCALANCE switches immediately', 'Complete CIP-013 vendor reviews for 6 OT vendors', 'Implement OT jump server for vendor remote access'], projected_score_90_days: 93 },
        risk_level: 'medium', framework: 'NIST AI RMF', model: 'claude-sonnet-4-6',
        reviewed: false, bias_flags: [],
      },
      {
        input: { report_type: 'serc_compliance_brief', period: '2025', frameworks: ['nerc_cip'], audience: 'serc_regional_entity' },
        output: { text: 'Vanguard Defense Systems demonstrated strong compliance with NERC CIP standards throughout 2025, achieving zero violations in all CIP-002 through CIP-014 standard categories. The organization maintains exceptional security posture across all High and Medium-impact BES Cyber Systems.' },
        risk_level: 'low', framework: 'EU AI Act', model: 'claude-sonnet-4-6',
        reviewed: false,
        bias_flags: [{ type: 'subjectivity', description: 'SERC compliance brief uses qualitative language ("strong compliance", "exceptional security posture") — regulatory submissions should use objective metrics and evidence-based language only.' }],
      },
      {
        input: { vendor: 'Siemens Energy AG', services: ['SCADA_hardware', 'firmware_updates', 'remote_support'], data_types: ['operational_technology', 'grid_telemetry'], annual_spend: 3800000, cip_013_applicable: true },
        output: { risk_score: 38, risk_level: 'medium', findings: ['Remote support access uses shared credentials (remediation required)', 'SBOM not available for SCALANCE firmware', 'Incident notification SLA not contractually defined'], certifications_verified: ['IEC 62443', 'ISO 27001'], next_review: '2027-01-01' }, // ip-hygiene:ignore
        risk_level: 'medium', framework: 'EU AI Act', model: 'claude-sonnet-4-6',
        reviewed: false,
        bias_flags: [{ type: 'vendor_naming', description: 'Vendor-specific findings reference Siemens by name — validate findings are based on objective evidence rather than vendor reputation or media reports.' }],
      },
      {
        input: { control_id: 'CIP-007-6-R2', current_status: 'in_progress', framework: 'nerc_cip', serc_audit_finding: 'F-2025-007', remediation_deadline: '2026-04-15' },
        output: { steps: ['Retrieve all October 2025 patch records from ACAS and vendor maintenance logs', 'Reconstruct patch timeline for SUB-047 RTU A and B with timestamps', 'Validate patch applicability determinations against CIP-007 R2 criteria', 'Prepare SERC response package with all supporting evidence', 'Submit via NERC CRSM portal by April 15, 2026'], estimated_effort_hours: 16 },
        risk_level: 'medium', framework: 'NIST AI RMF', model: 'claude-sonnet-4-6',
        reviewed: true, review_outcome: 'approved',
        review_notes: 'CIP-007 remediation playbook reviewed and approved by Compliance Manager. Steps align with SERC evidence submission requirements. Assigned to OT Security team.',
        bias_flags: [],
      },
      {
        input: { incident_type: 'ics_cyberattack', severity: 'critical', affected_systems: ['EMS', 'SCADA', 'SUB-047'], potential_grid_impact: true, nerc_cip_incident: true },
        output: { phase_1_immediate: 'Activate Emergency Operations Center. Isolate EMS and SCADA from NERC E-ISAC network connection. DO NOT shut down operational OT — follow CIP-008 manual override procedures.', phase_2_notify: 'Notify NERC E-ISAC within 1 hour (mandatory CIP-008-6 R4 obligation). Notify SERC within 4 hours. Notify DOE CESER if grid reliability impacted.', phase_3_preserve: 'Preserve forensic images of compromised systems. Engage Dragos DFIR retainer. Do not restore from backup until forensics complete.', nerc_cip_obligations: ['CIP-008-6 R4: NERC E-ISAC notification (1 hour)', 'CIP-008-6 R5: Incident response plan activation', 'SERC notification (4 hours)', 'DOE OE-417 report if >200MW impact (24 hours)'] },
        risk_level: 'high', framework: 'NIST AI RMF', model: 'claude-sonnet-4-6',
        reviewed: true, review_outcome: 'approved',
        review_notes: 'ICS incident response playbook reviewed and approved by CISO and Legal. NERC CIP obligations and timelines are accurate. Pre-approved for use in tabletop exercises.',
        bias_flags: [],
      },
      {
        input: { analysis_type: 'crosswalk_optimization', source_framework: 'nerc_cip', target_frameworks: ['nist_csf_2.0', 'nist_800_53', 'iso_27001'], control_overlap_threshold: 0.85 },
        output: { crosswalk_opportunities: 47, high_confidence: 31, evidence_reuse_savings: '38% reduction in duplicate evidence collection', top_mappings: [{ cip: 'CIP-007-6', nist: 'CM-7, CM-8', similarity: 0.94 }, { cip: 'CIP-005-7', nist_csf: 'PR.AC-4, PR.AC-5', similarity: 0.91 }] },
        risk_level: 'low', framework: 'EU AI Act', model: 'claude-sonnet-4-6',
        reviewed: false, bias_flags: [],
      },
    ];

    let aiCount = 0;
    for (let ai = 0; ai < aiDecisions.length; ai++) {
      const d = aiDecisions[ai];
      const inputText  = JSON.stringify(d.input);
      const outputData = typeof d.output === 'string' ? { text: d.output } : d.output;
      const outputText = JSON.stringify(outputData);
      const inputHash  = crypto.createHash('sha256').update(inputText).digest('hex');
      const outputHash = crypto.createHash('sha256').update(outputText).digest('hex');

      await client.query(
        `INSERT INTO ai_decision_log
           (organization_id, input_data, input_hash, output_data, output_hash,
            human_reviewed, risk_level, regulatory_framework, model_version,
            correlation_id, session_id, processing_timestamp,
            bias_flags, bias_reviewed, review_outcome, review_notes)
         VALUES ($1,$2::jsonb,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,
                 NOW() - (($12)::int * interval '1 hour'),
                 $13::jsonb, false, $14, $15)`,
        [
          orgId, inputText, inputHash, outputText, outputHash,
          d.reviewed || false, d.risk_level, d.framework, d.model,
          crypto.randomUUID(), crypto.randomUUID(),
          (ai + 1) * 14,
          JSON.stringify(d.bias_flags),
          d.review_outcome || null,
          d.review_notes   || null,
        ]
      );
      aiCount++;
    }
    console.log(`  ✓ ${aiCount} AI decision log entries (2 bias flags, 2 human-reviewed)`);

    // ────────────────────────────────────────────────────────────────────────
    // 13. Audit log entries
    // ────────────────────────────────────────────────────────────────────────
    const auditEvents = [
      { user: adminId,   event: 'user_login',                resource: 'user',                   details: { method: 'password+mfa', mfa_type: 'totp' },                                                             minsAgo: 2880 },
      { user: adminId,   event: 'frameworks_updated',        resource: 'organization_framework',  details: { action: 'all_frameworks_adopted', count: frameworks.length },                                           minsAgo: 2820 },
      { user: adminId,   event: 'control_status_changed',    resource: 'control_implementation',  details: { control: 'CIP-007-6-R2', from: 'in_progress', to: 'verified', framework: 'nerc_cip' },                  minsAgo: 2760 },
      { user: adminId,   event: 'evidence_uploaded',         resource: 'evidence',                details: { file: 'NERC_CIP_Compliance_Report_2025.pdf', size_bytes: 1887436, controls_linked: 3 },                  minsAgo: 2400 },
      { user: adminId,   event: 'vulnerability_scan_imported', resource: 'vulnerability_finding', details: { source: 'ACAS', findings: 8, critical: 1, high: 3, medium: 3, low: 1, ot_assets: 6 },                   minsAgo: 2160 },
      { user: adminId,   event: 'poam_created',              resource: 'poam_item',               details: { title: 'Remediate Siemens SCALANCE CVE-2025-27840', priority: 'critical', due_days: 14 },                minsAgo: 1920 },
      { user: auditorId, event: 'assessment_result_recorded', resource: 'assessment_result',      details: { control: 'CIP-005-7', status: 'satisfied', risk: 'low', framework: 'nerc_cip' },                        minsAgo: 1800 },
      { user: adminId,   event: 'control_status_changed',    resource: 'control_implementation',  details: { control: 'CIP-004-7', from: 'implemented', to: 'verified', framework: 'nerc_cip' },                     minsAgo: 1680 },
      { user: adminId,   event: 'crosswalk_auto_satisfied',  resource: 'control_implementation',  details: { source_control: 'CIP-005-7', target_framework: 'nist_csf_2.0', satisfied_controls: 8, similarity: 0.91 }, minsAgo: 1440 },
      { user: adminId,   event: 'ai_analysis_requested',     resource: 'ai_decision_log',         details: { analysis_type: 'crosswalk_optimization', source: 'nerc_cip', opportunities_found: 47 },                  minsAgo: 1200 },
      { user: adminId,   event: 'report_generated',          resource: 'report',                  details: { type: 'serc_compliance_brief', format: 'pdf', framework: 'nerc_cip', period: '2025' },                   minsAgo: 960 },
      { user: auditorId, event: 'user_login',                resource: 'user',                    details: { method: 'password+mfa', mfa_type: 'yubikey' },                                                           minsAgo: 480 },
      { user: adminId,   event: 'settings_updated',          resource: 'organization',            details: { setting: 'notification_preferences', changes: ['nerc_cip_alerts_enabled', 'weekly_digest_on'] },          minsAgo: 120 },
    ];

    for (const ev of auditEvents) {
      await client.query(
        `INSERT INTO audit_logs (organization_id, user_id, event_type, resource_type, details, ip_address, user_agent, success, created_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,'10.50.1.5','ControlWeaver-Demo-Seed/1.0',true, NOW() - ($6 * interval '1 minute'))`,
        [orgId, ev.user, ev.event, ev.resource, JSON.stringify(ev.details), ev.minsAgo]
      );
    }
    console.log(`  ✓ ${auditEvents.length} audit log entries`);

    // ────────────────────────────────────────────────────────────────────────
    // 14. Organization Policies — NERC CIP / CMMC / defense context
    // ────────────────────────────────────────────────────────────────────────

    const controlsByPrefix = (prefix) => controls.filter(c => c.control_id.startsWith(prefix));

    const policyDefs = [
      {
        name: 'NERC CIP Compliance Policy',
        type: 'security_policy',
        description: 'Governs BES Cyber System security across CIP-002 through CIP-014 reliability standards. Defines organizational roles, compliance workflows, evidence management, and SERC regional entity reporting obligations for Vanguard Defense Systems\' critical infrastructure.',
        version: '3.2',
        status: 'published',
        effectiveDaysAgo: 365,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'BES Cyber System Categorization and Governance',
            content: 'All BES Cyber Systems shall be categorized per CIP-002-5.1a criteria. High, Medium, and Low impact ratings are assigned based on Bright-Line criteria. The NERC CIP Compliance Manager maintains the BES Cyber System inventory and reviews categorizations quarterly. Changes require CISO approval and SERC notification within 60 days.',
            familyCode: 'RA', familyName: 'Risk Assessment',
            controlPrefixes: ['RA-', 'PM-'],
            mappingNotes: 'nerc_cip:CIP-002-5.1a, nist_800_53:RA-3',
          },
          {
            number: '2.0', title: 'Electronic Security Perimeter Controls',
            content: 'All High and Medium BES Cyber Systems must reside within defined Electronic Security Perimeters (ESPs). Inbound/outbound access is restricted to business-justified connections documented in access control lists. Firewall rules are reviewed semi-annually. Interactive remote access requires multi-factor authentication and is routed through approved Intermediate Systems.',
            familyCode: 'SC', familyName: 'System and Communications Protection',
            controlPrefixes: ['SC-', 'AC-'],
            mappingNotes: 'nerc_cip:CIP-005-7-R1, nist_800_53:SC-7',
          },
          {
            number: '3.0', title: 'Security Patch Management',
            content: 'Security patches for BES Cyber Systems shall be evaluated within 35 days of availability per CIP-007-6 R2. Critical patches for High-impact systems are fast-tracked within 14 days. All patch activities are documented in the CIP evidence management system with before/after configuration baselines retained for 6 years.',
            familyCode: 'SI', familyName: 'System and Information Integrity',
            controlPrefixes: ['SI-'],
            mappingNotes: 'nerc_cip:CIP-007-6-R2, nist_800_53:SI-2',
          },
        ],
      },
      {
        name: 'Information Security Policy',
        type: 'security_policy',
        description: 'Establishes the overall security governance framework for Vanguard Defense Systems, covering both OT/ICS and corporate IT environments. Aligns with NIST 800-53, CMMC Level 2, and NERC CIP requirements for defense contractor operations.',
        version: '2.1',
        status: 'published',
        effectiveDaysAgo: 270,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Security Governance and Roles',
            content: 'The CISO has authority over all information security programs including OT security, CMMC compliance, and NERC CIP obligations. The OT Security Manager reports to the CISO and oversees BES Cyber System security. Security governance council meets monthly to review risk posture, compliance status, and incident trends.',
            familyCode: 'PL', familyName: 'Planning',
            controlPrefixes: ['PL-', 'PM-'],
            mappingNotes: 'nist_800_53:PL-1, cmmc:CA.L2-3.12.1',
          },
          {
            number: '2.0', title: 'Defense-in-Depth Architecture',
            content: 'Network architecture follows NIST SP 800-82 guidelines with defined Purdue Model zones. OT/IT demarcation is enforced at Layer 3.5 with next-generation firewalls. All CUI is encrypted at rest (AES-256) and in transit (TLS 1.3). CMMC enclave boundaries are documented and enforced through network segmentation and data loss prevention controls.',
            familyCode: 'SC', familyName: 'System and Communications Protection',
            controlPrefixes: ['SC-'],
            mappingNotes: 'nist_800_53:SC-7, cmmc:SC.L2-3.13.1',
          },
        ],
      },
      {
        name: 'Physical Security Policy',
        type: 'physical_security_policy',
        description: 'Defines CIP-006 physical security perimeter controls, substation access management, camera monitoring requirements, and visitor escort procedures for all BES Cyber System locations.',
        version: '2.0',
        status: 'published',
        effectiveDaysAgo: 180,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Physical Security Perimeter Definition',
            content: 'Physical Security Perimeters (PSPs) are defined for all locations housing High and Medium BES Cyber Systems. PSP boundaries are documented with diagrams updated within 30 days of changes. Access points are limited to the minimum necessary and equipped with card readers, mantrap entries (for High-impact), and 90-day badge access log retention.',
            familyCode: 'PE', familyName: 'Physical and Environmental Protection',
            controlPrefixes: ['PE-'],
            mappingNotes: 'nerc_cip:CIP-006-6-R1, nist_800_53:PE-3',
          },
          {
            number: '2.0', title: 'Surveillance and Monitoring',
            content: 'All PSP access points and critical infrastructure areas are monitored by Hanwha PTZ cameras with 90-day recording retention. Camera health is verified daily via automated NVR heartbeat checks. Alarmed doors trigger Security Operations Center alerts within 15 seconds. Annual physical security audits verify camera coverage, door sensor functionality, and badge reader logs.',
            familyCode: 'PE', familyName: 'Physical and Environmental Protection',
            controlPrefixes: ['PE-'],
            mappingNotes: 'nerc_cip:CIP-006-6-R2, nist_800_53:PE-6',
          },
          {
            number: '3.0', title: 'Visitor Management',
            content: 'All visitors to PSP-designated areas must be logged, issued temporary badges, and continuously escorted by authorized personnel. Visitor access logs are retained for 90 days per CIP-006. Vendors performing maintenance on BES Cyber Systems require pre-approved Personnel Risk Assessments per CIP-004 before physical access is granted.',
            familyCode: 'PE', familyName: 'Physical and Environmental Protection',
            controlPrefixes: ['PE-'],
            mappingNotes: 'nerc_cip:CIP-006-6-R4, nist_800_53:PE-8',
          },
        ],
      },
      {
        name: 'Cybersecurity Incident Response Policy',
        type: 'incident_response_policy',
        description: 'Defines the CIP-008 incident response lifecycle including detection, classification, reporting (1-hour requirement for Reportable Cyber Security Incidents), CISA coordination, evidence preservation, and lessons learned for BES Cyber System incidents.',
        version: '2.3',
        status: 'published',
        effectiveDaysAgo: 120,
        reviewFrequencyDays: 180,
        sections: [
          {
            number: '1.0', title: 'Incident Detection and Classification',
            content: 'BES Cyber System security events are monitored via OT SIEM (Dragos Platform) and correlated with corporate SIEM (Splunk). Incidents are classified as Reportable Cyber Security Incidents (RCSI) per CIP-008-6 criteria. The 1-hour reporting clock starts upon RCSI determination. The OT SOC operates 24/7/365 with Tier 1-3 escalation paths.',
            familyCode: 'IR', familyName: 'Incident Response',
            controlPrefixes: ['IR-'],
            mappingNotes: 'nerc_cip:CIP-008-6-R1, nist_800_53:IR-4',
          },
          {
            number: '2.0', title: 'Reporting and Coordination',
            content: 'Reportable Cyber Security Incidents must be reported to E-ISAC within 1 hour of determination. The CISO coordinates with CISA, FBI (for defense-related incidents), and NERC as required. Post-incident evidence packages are prepared for SERC within 90 days. Table-top exercises are conducted quarterly with lessons learned documented.',
            familyCode: 'IR', familyName: 'Incident Response',
            controlPrefixes: ['IR-'],
            mappingNotes: 'nerc_cip:CIP-008-6-R2, nist_800_53:IR-6',
          },
        ],
      },
      {
        name: 'Personnel & Training Policy',
        type: 'personnel_security_policy',
        description: 'Defines CIP-004 personnel risk assessment requirements, annual cybersecurity training obligations, security clearance management, and access revocation procedures for all personnel with BES Cyber System access.',
        version: '1.8',
        status: 'published',
        effectiveDaysAgo: 210,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Personnel Risk Assessment',
            content: 'All personnel with authorized electronic or unescorted physical access to BES Cyber Systems must complete a Personnel Risk Assessment (PRA) per CIP-004-7 R3, including identity verification, 7-year criminal history check, and employment verification. PRAs are refreshed every 7 years. Contractor PRAs must be completed before access provisioning.',
            familyCode: 'PS', familyName: 'Personnel Security',
            controlPrefixes: ['PS-'],
            mappingNotes: 'nerc_cip:CIP-004-7-R3, nist_800_53:PS-3',
          },
          {
            number: '2.0', title: 'Cybersecurity Awareness Training',
            content: 'Annual cybersecurity training is mandatory for all personnel with BES Cyber System access per CIP-004-7 R2. Training covers social engineering, phishing, physical security awareness, CUI handling (for CMMC roles), and OT-specific threat scenarios. Training completion is tracked and non-compliant personnel have access suspended until remediation.',
            familyCode: 'AT', familyName: 'Awareness and Training',
            controlPrefixes: ['AT-'],
            mappingNotes: 'nerc_cip:CIP-004-7-R2, nist_800_53:AT-2',
          },
          {
            number: '3.0', title: 'Access Revocation',
            content: 'Upon termination or role change, BES Cyber System access (electronic and physical) must be revoked within 24 hours per CIP-004-7 R5. Shared account passwords are changed within 24 hours when any user with knowledge of the password is terminated. Security clearances are coordinated with the FSO for revocation or downgrade.',
            familyCode: 'PS', familyName: 'Personnel Security',
            controlPrefixes: ['PS-', 'AC-'],
            mappingNotes: 'nerc_cip:CIP-004-7-R5, nist_800_53:PS-4',
          },
        ],
      },
      {
        name: 'Supply Chain Risk Management Policy',
        type: 'supply_chain_policy',
        description: 'Establishes CIP-013 supply chain risk management controls, CMMC flow-down requirements for subcontractors, SBOM requirements for OT/ICS software, and vendor security assessment procedures for critical infrastructure supply chain integrity.',
        version: '1.5',
        status: 'published',
        effectiveDaysAgo: 150,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Vendor Risk Assessment Process',
            content: 'All vendors providing hardware, software, or services for BES Cyber Systems must complete a supply chain risk assessment per CIP-013-2 R1. Assessments evaluate vendor security practices, software integrity verification methods, vulnerability disclosure processes, and remote access capabilities. Critical vendors (Siemens, ABB, SEL, GE Vernova) undergo enhanced annual reviews.',
            familyCode: 'SA', familyName: 'System and Services Acquisition',
            controlPrefixes: ['SA-'],
            mappingNotes: 'nerc_cip:CIP-013-2-R1, nist_800_53:SA-12',
          },
          {
            number: '2.0', title: 'SBOM and Software Integrity',
            content: 'All OT/ICS software procurements require CycloneDX or SPDX Software Bills of Materials (SBOMs). SBOMs are analyzed for known vulnerabilities before deployment. Firmware integrity is verified via vendor-provided hashes. SBOM refresh is required with each software update cycle. SBOM analysis findings feed into CIP-007 patch management process.',
            familyCode: 'SA', familyName: 'System and Services Acquisition',
            controlPrefixes: ['SA-'],
            mappingNotes: 'nerc_cip:CIP-010-4-R1, nist_800_53:SA-11',
          },
          {
            number: '3.0', title: 'CMMC Flow-Down and Subcontractor Security',
            content: 'Defense subcontractors handling CUI must maintain CMMC Level 2 certification. Flow-down clauses in DFARS 252.204-7012 are included in all subcontracts. Subcontractor compliance is verified annually via self-assessment or third-party audit. Non-compliant subcontractors are placed on probation with 90-day remediation deadlines.',
            familyCode: 'SA', familyName: 'System and Services Acquisition',
            controlPrefixes: ['SA-'],
            mappingNotes: 'cmmc:SA.L2-3.9.1, nist_800_53:SA-9',
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

        // Map section to relevant controls by prefix(es)
        const prefixes = sec.controlPrefixes || [sec.controlPrefix].filter(Boolean);
        const matchingControls = prefixes.flatMap(p => controlsByPrefix(p)).slice(0, 2);
        for (const ctrl of matchingControls) {
          await client.query(
            `INSERT INTO policy_control_mappings
               (organization_id, policy_section_id, control_id, framework_id, mapping_notes)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (policy_section_id, control_id) DO NOTHING`,
            [orgId, sectionId, ctrl.id, ctrl.fw_id,
             sec.mappingNotes || `Mapped via ${sec.familyCode} family alignment`]
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
           `Annual review of ${pDef.name} completed by Eve Marshall (CISO). Policy aligned with current NERC CIP standards and CMMC requirements. No material changes required.`,
           nextReviewDate]
        );
        reviewCount++;
      }
    }
    console.log(`  ✓ ${policyCount} organization policies, ${sectionCount} sections, ${mappingCount} control mappings, ${reviewCount} reviews`);

    // ────────────────────────────────────────────────────────────────────────
    // 15. Data Retention Policies — NERC CIP / DFARS / CMMC requirements
    // ────────────────────────────────────────────────────────────────────────

    await client.query(
      'DELETE FROM data_retention_policies WHERE organization_id = $1',
      [orgId]
    );

    const retentionPolicies = [
      { dataType: 'evidence', retentionDays: 2190, description: 'Compliance evidence retained for 6 years per NERC CIP record retention requirements and CMMC assessment documentation' },
      { dataType: 'audit_logs', retentionDays: 2555, description: 'Audit trail retained for 7 years per NERC CIP-004/007 and DFARS 252.204-7012 requirements' },
      { dataType: 'vulnerability_findings', retentionDays: 2190, description: 'Vulnerability records retained for 6 years for NERC CIP-007 patch management evidence and CMMC POA&M tracking' },
      { dataType: 'assessment_results', retentionDays: 2190, description: 'CIP compliance assessment results retained for 6 years per NERC reliability standard documentation requirements' },
      { dataType: 'poam_items', retentionDays: 2555, description: 'Remediation plans retained for 7 years per NERC mitigation plan and CMMC POA&M closeout requirements' },
    ];

    for (const rp of retentionPolicies) {
      await client.query(
        `INSERT INTO data_retention_policies
           (organization_id, policy_name, resource_type, retention_days, auto_enforce, active, created_by)
         VALUES ($1,$2,$3,$4,true,true,$5)`,
        [orgId, `${rp.dataType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Retention — NERC CIP/DFARS`, rp.dataType, rp.retentionDays, adminId]
      );
    }
    console.log(`  ✓ ${retentionPolicies.length} data retention policies (NERC CIP/DFARS/CMMC)`);

    await client.query('COMMIT');

    console.log('\n✅ Gov Cloud demo data ready! (Vanguard Defense Systems)\n');
    console.log('  🔑  admin@govcloud.com   / ControlWeave!2026   (admin)');
    console.log('  🔑  auditor@govcloud.com / ControlWeave!2026   (auditor — same org)\n');
    console.log(`  📊  Maturity: ~90% compliant | ${frameworks.length} frameworks (incl. NERC CIP) | Electric utility context`);
    console.log('  🏗️   CMDB: 10 OT/IT assets (EMS, SCADA, substation, PI Historian, OT firewall + corporate IT)');
    console.log('  📄  Evidence: 10 NERC CIP/OT documents (compliance filing, SERC audit response, BES inventory)');
    console.log(`  🔍  Vulnerabilities: 10 OT/ICS+SBOM findings + ${hfVulnCount} HF-sourced CVEs (defense/OT enrichment)`);
    console.log('  📋  POA&M: 8 NERC CIP focused items (SCALANCE patch, CIP-013 vendors, jump server)');
    console.log('  ✅  Assessments: NERC CIP annual self-assessment 2026 (~88% satisfied)');
    console.log('  🤖  AI Decisions: 6 entries (ICS incident response, crosswalk optimization, vendor risk)');
    console.log(`  📑  Policies: ${policyCount} NERC CIP/CMMC policies, ${sectionCount} sections, ${mappingCount} control mappings`);
    console.log(`  🗄️   Retention: ${retentionPolicies.length} data retention policies (NERC CIP/DFARS/CMMC — 6-7 year retention)\n`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`\n❌ Gov Cloud demo seed failed: ${error.message}\n`);
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
