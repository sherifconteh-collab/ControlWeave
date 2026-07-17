// @tier: exclude
/**
 * seed-community-test-data.js
 *
 * Comprehensive community-tier test data designed for low-maturity (level 1)
 * compliance posture (~20% compliant).  Seeds every major tab with realistic data:
 *
 *   - Community org  ("NovaTech Solutions", community tier, community billing)
 *   - Admin + auditor users (same org)
 *   - 5 community-tier frameworks adopted
 *   - ~20 % of controls implemented (maturity 1)
 *   - Vulnerability findings with control-effect work items (NC + partial + compliant)
 *   - Assessment plan + results (mostly other_than_satisfied)
 *   - Evidence files linked to controls
 *   - POA&M items (various priorities / statuses)
 *   - CMDB assets, environments, service accounts
 *   - Control exceptions (active + expired)
 *   - AI decision-log entries (with bias flags)
 *   - In-app notifications
 *   - Audit-log entries
 *   - Organization policies with sections + control mappings + reviews
 *   - Data retention policies
 *   - Hugging Face CVE enrichment (graceful fallback if unreachable)
 *
 * Logins
 *   admin@community.com  / ControlWeave!2026   (admin)
 *   auditor@community.com / ControlWeave!2026  (auditor — same org)
 *
 * Run:  npm run seed:community-test-data
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

const ADMIN_EMAIL   = 'admin@community.com';
const AUDITOR_EMAIL = 'auditor@community.com';
const PASSWORD      = 'ControlWeave!2026';
const ORG_NAME      = 'NovaTech Solutions';
const SEED_TAG      = 'free_test_data';

// Free-tier frameworks
const FRAMEWORK_CODES = [
  'nist_csf_2.0', 'nist_800_53', 'iso_27001', 'soc2',
  'nist_ai_rmf',
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
    console.log('\n🚀 Seeding comprehensive free-tier test data (maturity 1, ~20% compliant)…\n');
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
        "UPDATE organizations SET name = $1, tier = 'community', billing_status = 'community' WHERE id = $2",
        [ORG_NAME, orgId]
      );
      console.log('  ↺ Existing org found — set to free tier');
    } else {
      const existingOrg = await client.query(
        'SELECT id FROM organizations WHERE name = $1', [ORG_NAME]
      );
      if (existingOrg.rows.length > 0) {
        orgId = existingOrg.rows[0].id;
        await client.query(
          "UPDATE organizations SET tier = 'community', billing_status = 'community' WHERE id = $1",
          [orgId]
        );
      } else {
        const r = await client.query(
          `INSERT INTO organizations (name, tier, billing_status, trial_status)
           VALUES ($1, 'community', 'community', 'none') RETURNING id`,
          [ORG_NAME]
        );
        orgId = r.rows[0].id;
      }
      console.log('  ✓ Free org created / updated');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Users (admin + auditor)
    // ──────────────────────────────────────────────────────────────────────────
    const adminId = await upsertUserByEmail(client, {
      organizationId: orgId,
      email: ADMIN_EMAIL,
      passwordHash,
      firstName: 'Fred',
      lastName: 'Free',
      role: 'admin',
    });

    const auditorId = await upsertUserByEmail(client, {
      organizationId: orgId,
      email: AUDITOR_EMAIL,
      passwordHash,
      firstName: 'Faye',
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
        `Community demo prerequisites missing framework catalog entries: ${missingFrameworkCodes.join(', ')}. Seed the global framework catalog first.`
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
    // 4. Control implementations — maturity level 1 (~20 % compliant)
    //    Distribution: 10 % implemented, 5 % in_progress, 5 % needs_review,
    //                  80 % not_started
    //    (NO verified, NO crosswalk, NO not_applicable — too early)
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
      throw new Error('Community demo prerequisites missing framework controls. No control implementations can be seeded.');
    }

    // Bucket boundaries
    const b1 = Math.round(total * 0.10);  // implemented
    const b2 = Math.round(total * 0.15);  // in_progress
    const b3 = Math.round(total * 0.20);  // needs_review

    let implCount = 0;
    const implementedControlIds = [];
    const inProgressControlIds  = [];
    const needsReviewControlIds = [];
    const notStartedControlIds  = [];

    for (let i = 0; i < total; i++) {
      let status;
      if      (i < b1) status = 'implemented';
      else if (i < b2) status = 'in_progress';
      else if (i < b3) status = 'needs_review';
      else             status = 'not_started';

      const implDate = (status === 'implemented')
        ? new Date(Date.now() - Math.random() * 60 * 86400000).toISOString()
        : null;

      const implementedNotes = [
        'AWS GuardDuty deployed across all production accounts. Alert routing to PagerDuty configured.',
        'Datadog SIEM integration live. Log ingestion verified for all Kubernetes namespaces.',
        'SOC 2 Type II audit confirmed control effectiveness. Vanta continuous monitoring active.',
        'GitHub Advanced Security GHAS enabled on all repos. Secret scanning + Dependabot alerts triaged weekly.',
        'Terraform IaC enforces this control via aws_security_group module. Drift detection enabled in Spacelift.',
      ];
      const inProgressNotes = [
        'Migrating from basic IAM to Okta SSO. Phase 1 (engineering team) complete, Phase 2 (all-hands) scheduled Q2.',
        'Crowdstrike Falcon agent rollout 60% complete across fleet. macOS endpoints pending MDM push.',
        'Implementing HashiCorp Vault for secrets management. Dev environment integrated, staging next sprint.',
      ];
      const needsReviewNotes = [
        'Control implemented 14 months ago; annual evidence refresh overdue. Scheduled for Q2 recertification.',
        'Initial CloudTrail config deployed but log completeness audit pending. Ticket INFRA-2847 tracks gap.',
      ];
      const notStartedNotes = [
        'Identified in annual risk assessment RA-2025-003. Budget approved for FY26 Q3 implementation.',
        'Backlogged in Jira epic SEC-142. Dependent on Okta SSO rollout completing first.',
        'Deferred per risk acceptance RA-2025-007. Compensating control (WAF rate limiting) in place until implementation.',
        'Scoped for FY26 roadmap. Vendor evaluation (Wiz vs Orca) in progress for cloud security posture management.',
      ];

      let notes;
      switch (status) {
        case 'implemented':  notes = implementedNotes[i % implementedNotes.length]; break;
        case 'in_progress':  notes = inProgressNotes[i % inProgressNotes.length]; break;
        case 'needs_review': notes = needsReviewNotes[i % needsReviewNotes.length]; break;
        default:             notes = notStartedNotes[i % notStartedNotes.length];
      }

      await client.query(
        `INSERT INTO control_implementations
           (organization_id, control_id, status, assigned_to, notes, implementation_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (organization_id, control_id) DO UPDATE
           SET status = EXCLUDED.status, notes = EXCLUDED.notes, implementation_date = EXCLUDED.implementation_date`,
        [orgId, controls[i].id, status, adminId, notes, implDate]
      );

      if (status === 'implemented')  implementedControlIds.push(controls[i]);
      if (status === 'in_progress')  inProgressControlIds.push(controls[i]);
      if (status === 'needs_review') needsReviewControlIds.push(controls[i]);
      if (status === 'not_started')  notStartedControlIds.push(controls[i]);
      implCount++;
    }

    console.log(`  ✓ ${implCount} control implementations`);
    console.log(`      implemented: ${implementedControlIds.length}  |  in_progress: ${inProgressControlIds.length}`);
    console.log(`      needs_review: ${needsReviewControlIds.length}  |  not_started: ${notStartedControlIds.length}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 5. CMDB — environments, assets, service accounts
    // ──────────────────────────────────────────────────────────────────────────
    const envResult = await client.query(`
      INSERT INTO environments (
        organization_id, name, code, environment_type,
        contains_pii, contains_phi, data_classification, security_level, criticality, owner_id
      )
      VALUES ($1, 'Production', 'prod-free', 'production', true, false, 'confidential', 'medium', 'high', $2)
      ON CONFLICT (organization_id, code) DO UPDATE SET
        name = EXCLUDED.name, contains_pii = true, contains_phi = false,
        data_classification = 'confidential', security_level = 'medium', criticality = 'high',
        updated_at = NOW()
      RETURNING id
    `, [orgId, adminId]);
    const envId = envResult.rows[0].id;

    const vaultResult = await client.query(`
      INSERT INTO password_vaults (organization_id, name, vault_type, vault_url, is_active)
      VALUES ($1, 'Free Tier Vault', 'hashicorp_vault', 'https://vault.free.local', true)
      ON CONFLICT (organization_id, name) DO UPDATE SET is_active = true
      RETURNING id
    `, [orgId]);
    const vaultId = vaultResult.rows[0].id;

    const catRows = await client.query('SELECT id, code FROM asset_categories');
    const catByCode = new Map(catRows.rows.map(r => [r.code, r.id]));

    const assetDefs = [
      { name: 'Free Web Server',        category: 'hardware',  hostname: 'free-web-01',   ip: '10.30.1.10', classification: 'confidential', criticality: 'high'     },
      { name: 'Free Database',          category: 'hardware',  hostname: 'free-db-01',    ip: '10.30.1.20', classification: 'confidential', criticality: 'high'     },
      { name: 'Free Log Collector',     category: 'software',  version: '3.2.1',          classification: 'internal',     criticality: 'medium'   },
      { name: 'Free Cloud Storage',     category: 'cloud',     provider: 'AWS', region: 'us-west-2', classification: 'confidential', criticality: 'medium' },
      { name: 'Free Mail Gateway',      category: 'software',  hostname: 'free-mail-gw',  ip: '10.30.2.10', classification: 'internal',     criticality: 'medium'   },
      { name: 'Free Endpoint Laptop',   category: 'hardware',  hostname: 'free-laptop-01', ip: '10.30.3.10', classification: 'internal',     criticality: 'low'      },
      { name: 'Free CI/CD Pipeline',    category: 'cloud',     provider: 'GitHub', region: 'us-east-1', classification: 'internal', criticality: 'medium' },
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
       VALUES ($1,'free-svc-app','system_user','Free tier application service account',$2,
               'Required for basic application integrations',$3,'/free/svc-app','api_key',90,
               CURRENT_DATE + INTERVAL '90 day','standard','Production application',60,
               CURRENT_DATE + INTERVAL '60 day',$2,'active',true)
       ON CONFLICT (organization_id, account_name) DO UPDATE SET
         owner_id=EXCLUDED.owner_id, vault_id=EXCLUDED.vault_id, is_active=true, updated_at=NOW()`,
      [orgId, adminId, vaultId]
    );
    console.log(`  ✓ ${assetDefs.length} CMDB assets + environment + service account`);

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Evidence files linked to controls
    // ──────────────────────────────────────────────────────────────────────────
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'free-test');
    ensureDir(uploadsDir);

    const evidenceDocs = [
      { fileName: 'Draft_Security_Policy.pdf', desc: 'Initial draft of organization security policy', mime: 'application/pdf' },
      { fileName: 'Initial_Risk_Assessment.pdf', desc: 'Preliminary risk assessment covering core systems', mime: 'application/pdf' },
      { fileName: 'Basic_Access_Control_List.xlsx', desc: 'Spreadsheet listing user access rights', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { fileName: 'Network_Diagram_v1.pdf', desc: 'First version of network topology diagram', mime: 'application/pdf' },
      { fileName: 'Acceptable_Use_Policy.pdf', desc: 'Employee acceptable use policy document', mime: 'application/pdf' },
      { fileName: 'Asset_Inventory_Spreadsheet.xlsx', desc: 'Manual asset inventory tracking spreadsheet', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { fileName: 'Password_Policy_Draft.pdf', desc: 'Draft password and authentication policy', mime: 'application/pdf' },
      { fileName: 'Backup_Procedure_Notes.pdf', desc: 'Informal backup procedure documentation', mime: 'application/pdf' },
    ];

    const linkedEvidenceIds = [];
    for (let i = 0; i < evidenceDocs.length; i++) {
      const ev = evidenceDocs[i];
      const content = `Free Tier Test Evidence — ${ev.fileName}\nGenerated: ${new Date().toISOString()}`;
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
           ['free-test', 'maturity-1'], sha256(content)]
        );
        evId = ins.rows[0].id;
      }
      linkedEvidenceIds.push(evId);

      // Link evidence items to implemented controls
      if (i < implementedControlIds.length) {
        await client.query(
          `INSERT INTO evidence_control_links (evidence_id, control_id, notes)
           VALUES ($1, $2, 'Linked via free-tier test data seed')
           ON CONFLICT (evidence_id, control_id) DO NOTHING`,
          [evId, implementedControlIds[i].id]
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
      { source:'ACAS', standard:'CVE/NVD', key:'free-acas-001', vulnId:'CVE-2025-50001', title:'Unpatched web server remote code execution',
        severity:'critical', cvss:9.4, status:'open', daysAgo:10, asset:'Free Web Server', cwe:'CWE-94', kev:true, exploit:true, dueInDays:5 },
      { source:'ACAS', standard:'CISA KEV', key:'free-acas-002', vulnId:'CVE-2025-50002', title:'SQL injection in database driver',
        severity:'high', cvss:8.1, status:'open', daysAgo:8, asset:'Free Database', cwe:'CWE-89', kev:true, exploit:true, dueInDays:10 },
      { source:'STIG', standard:'DISA STIG', key:'free-stig-003', vulnId:'RHEL-09-210100', title:'Missing audit log configuration',
        severity:'high', cvss:7.2, status:'open', daysAgo:6, asset:'Free Log Collector', cwe:null, kev:false, exploit:false, dueInDays:14 },
      { source:'SBOM', standard:'CycloneDX', key:'free-sbom-004', vulnId:'CVE-2024-60001', title:'Outdated TLS library in mail gateway',
        severity:'medium', cvss:6.0, status:'in_progress', daysAgo:12, asset:'Free Mail Gateway', cwe:'CWE-326', kev:false, exploit:false, dueInDays:21 },
      { source:'SCAP', standard:'CIS Benchmarks', key:'free-scap-005', vulnId:'CIS-AWS-3.1', title:'S3 bucket public access not blocked',
        severity:'medium', cvss:5.5, status:'open', daysAgo:4, asset:'Free Cloud Storage', cwe:null, kev:false, exploit:false, dueInDays:30 },
      { source:'SAST', standard:'OWASP ASVS', key:'free-sast-006', vulnId:'OWASP-ASVS-2.1.1', title:'Weak password policy on application login',
        severity:'low', cvss:3.2, status:'open', daysAgo:15, asset:'Free Web Server', cwe:'CWE-521', kev:false, exploit:false, dueInDays:45 },
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
      { vulnIdx: 0, controls: notStartedControlIds.slice(0, 2),    effect: 'non_compliant', action: 'poam',              actionStatus: 'open' },
      { vulnIdx: 1, controls: notStartedControlIds.slice(2, 4),    effect: 'non_compliant', action: 'close_control_gap', actionStatus: 'open' },
      { vulnIdx: 2, controls: inProgressControlIds.slice(0, 1),    effect: 'partial',       action: 'poam',              actionStatus: 'in_progress' },
      { vulnIdx: 3, controls: needsReviewControlIds.slice(0, 1),   effect: 'partial',       action: 'risk_acceptance',   actionStatus: 'open' },
      { vulnIdx: 4, controls: implementedControlIds.slice(0, 1),   effect: 'compliant',     action: 'close_control_gap', actionStatus: 'resolved' },
      { vulnIdx: 5, controls: implementedControlIds.slice(1, 2),   effect: 'compliant',     action: 'false_positive_review', actionStatus: 'closed' },
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
    const HF_VULN_COUNT = 4;
    const assetNames = Array.from(assetIdByName.keys());
    let hfVulnCount = 0;
    let hfWorkItemCount = 0;
    try {
      console.log('  ⬇ Fetching Hugging Face CVE data for community enrichment...');
      const hfVulns = await fetchHfVulnerabilities(HF_VULN_COUNT, {
        sources: ['ACAS', 'SBOM', 'SCAP', 'SAST'],
        statuses: ['open', 'in_progress', 'remediated']
      });

      const allControlIds = [
        ...notStartedControlIds, ...inProgressControlIds,
        ...needsReviewControlIds, ...implementedControlIds
      ].filter(Boolean);

      for (let i = 0; i < hfVulns.length; i++) {
        const hv = hfVulns[i];
        const findingKey = `free-hf-${String(i + 1).padStart(3, '0')}`;
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
      { title: 'Patch critical RCE vulnerability on web server',              priority: 'critical', status: 'open' },
      { title: 'Implement basic MFA for admin accounts',                     priority: 'high',     status: 'open' },
      { title: 'Establish formal access control policy',                     priority: 'high',     status: 'in_progress' },
      { title: 'Configure centralized logging for all servers',              priority: 'medium',   status: 'open' },
      { title: 'Create incident response plan document',                     priority: 'medium',   status: 'open' },
      { title: 'Block public access on cloud storage buckets',               priority: 'medium',   status: 'in_progress' },
      { title: 'Complete initial security awareness training',               priority: 'low',      status: 'closed' },
      { title: 'Document password policy and distribute to staff',           priority: 'low',      status: 'open' },
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
    const planName = 'Initial Compliance Assessment (Free Tier)';
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
         VALUES ($1,$2,'Initial compliance assessment for free-tier organization.',
                 'annual','comprehensive','in_progress',$3,CURRENT_DATE - INTERVAL '14 day') RETURNING id`,
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

    // ~60% other_than_satisfied, ~40% satisfied for low maturity
    const resultStatuses = ['other_than_satisfied','other_than_satisfied','other_than_satisfied',
                            'satisfied','other_than_satisfied','satisfied','other_than_satisfied',
                            'other_than_satisfied','satisfied','satisfied'];
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
         st === 'satisfied' ? 'Control objective met; basic evidence supports implementation.' : 'Gap identified — control not yet implemented or evidence insufficient.',
         'Evidence reviewed during assessment period.',
         st === 'satisfied' ? 'low' : (i % 4 === 0 ? 'high' : 'medium'),
         st !== 'satisfied',
         i + 1]
      );
    }
    console.log(`  ✓ Assessment plan + ${Math.min(20, procedures.rows.length)} results (~60% other_than_satisfied, ~40% satisfied)`);

    // ──────────────────────────────────────────────────────────────────────────
    // 10. Control exceptions
    // ──────────────────────────────────────────────────────────────────────────
    const exceptionControls = inProgressControlIds.concat(needsReviewControlIds).slice(0, 3);
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
      { type: 'control_due',       title: 'Controls Due for Review',               message: 'Multiple controls require initial review — check the Controls tab.',                            link: '/dashboard/controls',            read: false },
      { type: 'status_change',     title: 'Control Implemented',                    message: 'AC-1 (Policy and Procedures) has been marked as implemented.',                                  link: '/dashboard/controls',            read: false },
      { type: 'crosswalk',         title: 'Crosswalk Opportunity Available',         message: 'ISO 27001 A.5.1 could be satisfied via crosswalk from NIST 800-53 AC-1 — review settings.',    link: '/dashboard/frameworks/mappings', read: false }, // ip-hygiene:ignore
      { type: 'system',            title: 'New POA&M Item Created',                  message: 'Critical POA&M: Patch critical RCE vulnerability on web server.',                              link: '/dashboard/operations',          read: false },
      { type: 'assessment_needed', title: 'Assessment Required',                     message: 'Initial compliance assessment has open procedures requiring assessor input.',                   link: '/dashboard/assessments',         read: false },
      { type: 'control_due',       title: 'Overdue Control',                         message: 'AU-2 (Event Logging) review is 5 days overdue.',                                               link: '/dashboard/controls',            read: true  },
      { type: 'status_change',     title: 'Vulnerability Finding Added',             message: 'CVE-2025-50001 critical vulnerability detected on Free Web Server.',                            link: '/dashboard/vulnerabilities',     read: true  },
      { type: 'crosswalk',         title: 'New Framework Mapping',                   message: 'NIST CSF PR.AC-01 maps to SOC 2 CC6.1 — review crosswalk settings.',                            link: '/dashboard/frameworks/mappings', read: true  }, // ip-hygiene:ignore
      { type: 'system',            title: 'Evidence Uploaded',                        message: 'Draft_Security_Policy.pdf has been uploaded and linked to a control.',                         link: '/dashboard/evidence',            read: true  },
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
        input: { type: 'gap_analysis', frameworks: ['nist_csf_2.0','nist_800_53','iso_27001'], total_controls: total },
        output: { gaps: inProgressControlIds.length + notStartedControlIds.length + needsReviewControlIds.length, critical: 8, recommendations: ['Establish baseline security policy','Implement access controls','Begin audit logging'] },
        risk: 'high', framework: 'NIST AI RMF', model: 'claude-sonnet-4-5-20250929',
        reviewed: true, outcome: 'approved', notes: 'Gap analysis approved — high gap count expected for maturity level 1.',
        bias: [],
      },
      {
        input: { type: 'control_prioritization', frameworks: ['nist_800_53'], maturity_level: 1 },
        output: { priority_list: ['AC-1','AC-2','AU-2','IA-2','SC-7'], effort_estimate_hours: 240 },
        risk: 'low', framework: 'NIST AI RMF', model: 'claude-sonnet-4-5-20250929',
        reviewed: false, outcome: null, notes: null,
        bias: [],
      },
      {
        input: { type: 'compliance_report', period: 'Q1 2026', frameworks: ['soc2'] },
        output: { text: 'Organization is in early stages of compliance. Significant gaps remain across most control families.' },
        risk: 'medium', framework: 'NIST AI RMF', model: 'claude-sonnet-4-5-20250929',
        reviewed: false, outcome: null, notes: null,
        bias: [{ type: 'subjectivity', description: 'Uses subjective terms ("significant gaps") — consider replacing with quantitative metrics.' }],
      },
      {
        input: { type: 'risk_assessment', scope: 'infrastructure', assets: ['Free Web Server','Free Database'] },
        output: { risk_score: 78, risk_level: 'high', findings: ['Unpatched servers','No centralized logging','Missing MFA'] },
        risk: 'high', framework: 'NIST AI RMF', model: 'gpt-4o',
        reviewed: true, outcome: 'approved', notes: 'Risk assessment findings confirmed — remediation plan created.',
        bias: [{ type: 'severity_inflation', description: 'Risk score may be inflated by counting related sub-findings separately.' }],
      },
      {
        input: { type: 'policy_generation', policy: 'information_security', scope: 'organization-wide' },
        output: { sections: ['Purpose','Scope','Roles and Responsibilities','Access Control','Incident Response','Review Cadence'] },
        risk: 'low', framework: 'NIST AI RMF', model: 'claude-sonnet-4-5-20250929',
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
      { type: 'user_login',               resource: 'auth',                   resId: null,                           success: true,  failReason: null,                         min: 480 },
      { type: 'frameworks_updated',        resource: 'organization_frameworks',resId: null,                           success: true,  failReason: null,                         min: 450 },
      { type: 'control_status_changed',    resource: 'control',               resId: implementedControlIds[0]?.id,   success: true,  failReason: null,                         min: 400 },
      { type: 'control_status_changed',    resource: 'control',               resId: implementedControlIds[1]?.id,   success: true,  failReason: null,                         min: 380 },
      { type: 'evidence_uploaded',         resource: 'evidence',              resId: linkedEvidenceIds[0],           success: true,  failReason: null,                         min: 360 },
      { type: 'evidence_uploaded',         resource: 'evidence',              resId: linkedEvidenceIds[1],           success: true,  failReason: null,                         min: 320 },
      { type: 'assessment_result_recorded',resource: 'assessment_procedure',  resId: procedures.rows[0]?.id,         success: true,  failReason: null,                         min: 280 },
      { type: 'vulnerability_scan_imported', resource: 'vulnerability',       resId: insertedVulns[0]?.id,           success: true,  failReason: null,                         min: 240 },
      { type: 'poam_created',             resource: 'poam',                   resId: null,                           success: true,  failReason: null,                         min: 200 },
      { type: 'report_generated',         resource: 'report',                 resId: null,                           success: true,  failReason: null,                         min: 160 },
      { type: 'ai_analysis_requested',    resource: 'ai',                     resId: null,                           success: true,  failReason: null,                         min: 120 },
      { type: 'settings_updated',         resource: 'organization_settings',  resId: null,                           success: true,  failReason: null,                         min: 60  },
      { type: 'ai_analysis_requested',    resource: 'ai',                     resId: null,                           success: false, failReason: 'Provider API key not set',   min: 30  },
    ];
    for (const ev of auditEvents) {
      await client.query(
        `INSERT INTO audit_logs (organization_id, user_id, event_type, resource_type, resource_id,
           details, ip_address, user_agent, success, failure_reason, created_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,NOW() - ($11::int||' minutes')::interval)`,
        [orgId, adminId, ev.type, ev.resource, ev.resId,
         JSON.stringify({ seed_tag: SEED_TAG, summary: `${ev.type} event` }),
         '10.30.1.5', 'Free Test Seed', ev.success, ev.failReason, ev.min]
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
        name: 'Information Security Policy',
        type: 'security_policy',
        description: 'Establishes the security governance framework, roles, and baseline security requirements for all NovaTech Solutions information assets, cloud infrastructure, and SaaS operations.',
        version: '1.0',
        status: 'published',
        effectiveDaysAgo: 180,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Purpose and Scope',
            content: 'This policy applies to all NovaTech Solutions employees, contractors, and third-party integrators. It governs the protection of customer data, source code repositories, and production infrastructure across AWS and GitHub environments.',
            familyCode: 'PL', familyName: 'Planning',
            controlPrefix: 'PL-',
          },
          {
            number: '2.0', title: 'Cloud Security Baseline',
            content: 'All production workloads must run in hardened Kubernetes clusters with network policies enforced. AWS GuardDuty, CloudTrail, and Config Rules are mandatory for all accounts. Infrastructure changes require Terraform plan review and approval.',
            familyCode: 'SC', familyName: 'System and Communications Protection',
            controlPrefix: 'SC-',
          },
          {
            number: '3.0', title: 'Data Protection Requirements',
            content: 'Customer data is encrypted at rest using AES-256 and in transit using TLS 1.3. Database backups are encrypted and stored in a separate AWS region. PII access requires explicit role-based authorization and is logged to the SIEM.',
            familyCode: 'SC', familyName: 'System and Communications Protection',
            controlPrefix: 'SC-',
          },
        ],
      },
      {
        name: 'Acceptable Use Policy',
        type: 'acceptable_use_policy',
        description: 'Defines acceptable use standards for employee devices, SaaS tooling, and corporate data to protect NovaTech Solutions intellectual property and customer information.',
        version: '1.0',
        status: 'published',
        effectiveDaysAgo: 90,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Device and Endpoint Standards',
            content: 'All employee laptops must be enrolled in Jamf (macOS) or Intune (Windows) MDM with full-disk encryption, automatic OS patching, and endpoint detection (CrowdStrike Falcon) enabled. Personal devices may not access production systems.',
            familyCode: 'AC', familyName: 'Access Control',
            controlPrefix: 'AC-',
          },
          {
            number: '2.0', title: 'SaaS and Cloud Tool Usage',
            content: 'Only IT-approved SaaS applications may process customer data. Shadow IT is prohibited. Employees must use SSO (Okta) for all approved tools and may not share credentials or bypass MFA requirements under any circumstances.',
            familyCode: 'AC', familyName: 'Access Control',
            controlPrefix: 'AC-',
          },
        ],
      },
      {
        name: 'Incident Response Plan',
        type: 'incident_response_policy',
        description: 'Defines the incident response lifecycle for NovaTech Solutions, including detection, triage, containment, and post-incident review procedures aligned with SOC 2 CC7 and NIST SP 800-61.', // ip-hygiene:ignore — fictional demo policy description
        version: '1.0',
        status: 'published',
        effectiveDaysAgo: 120,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Detection and Triage',
            content: 'Datadog and PagerDuty provide 24/7 alerting for production anomalies. Security incidents are triaged within 30 minutes using the severity matrix in Appendix A. The on-call engineer escalates to the Security Lead for Sev-1 and Sev-2 incidents.',
            familyCode: 'IR', familyName: 'Incident Response',
            controlPrefix: 'IR-',
          },
          {
            number: '2.0', title: 'Containment and Recovery',
            content: 'Containment actions include revoking compromised credentials, isolating affected pods via network policy, and rotating secrets in HashiCorp Vault. Recovery follows the runbook in Confluence with RTO targets defined per service tier in the CMDB.',
            familyCode: 'IR', familyName: 'Incident Response',
            controlPrefix: 'IR-',
          },
          {
            number: '3.0', title: 'Post-Incident Review',
            content: 'A blameless post-mortem is conducted within 72 hours of incident closure. Action items are tracked as Jira tickets in the SEC project. Lessons learned are presented at the monthly engineering all-hands and feed into control improvement backlog.',
            familyCode: 'IR', familyName: 'Incident Response',
            controlPrefix: 'IR-',
          },
        ],
      },
      {
        name: 'Access Control Policy',
        type: 'access_control_policy',
        description: 'Defines authentication, authorization, and identity lifecycle management standards for NovaTech Solutions, covering Okta SSO, AWS IAM, and GitHub organization access controls.',
        version: '1.0',
        status: 'published',
        effectiveDaysAgo: 60,
        reviewFrequencyDays: 180,
        sections: [
          {
            number: '1.0', title: 'Authentication Standards',
            content: 'All staff must authenticate via Okta SSO with FIDO2/WebAuthn as the primary MFA method. SMS-based OTP is prohibited. Service accounts use short-lived OIDC tokens where supported; static API keys are rotated every 90 days via Vault.',
            familyCode: 'IA', familyName: 'Identification and Authentication',
            controlPrefix: 'IA-',
          },
          {
            number: '2.0', title: 'Least Privilege and Access Reviews',
            content: 'Access follows the principle of least privilege. AWS IAM roles are scoped per-service with permission boundaries. GitHub organization membership and repository access are reviewed quarterly. Offboarding triggers automated deprovisioning within 4 hours.',
            familyCode: 'AC', familyName: 'Access Control',
            controlPrefix: 'AC-',
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
           `Annual review of ${pDef.name} completed. No material changes required.`,
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

    const retentionDefs = [
      { name: 'Evidence Document Retention',       resourceType: 'evidence',                days: 1095, autoEnforce: false }, // 3 years — SOC 2 requirements
      { name: 'Audit Log Retention',               resourceType: 'audit_logs',              days: 365,  autoEnforce: true  }, // 1 year — minimum audit trail
      { name: 'Vulnerability Finding Retention',   resourceType: 'vulnerability_findings',  days: 730,  autoEnforce: false }, // 2 years — trend analysis
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

    // Summary
    const compliant = implementedControlIds.length;
    const compliancePct = total > 0 ? Math.round((compliant / total) * 1000) / 10 : 0;

    console.log('\n✅ Free-tier test data ready!\n');
    console.log(`  📊  Maturity Level 1 — ${compliancePct}% compliance (${compliant}/${total} controls)`);
    console.log(`  🔑  ${ADMIN_EMAIL} / ${PASSWORD}   (admin role)`);
    console.log(`  🔑  ${AUDITOR_EMAIL} / ${PASSWORD}  (auditor role — same org)\n`);
    console.log('  What to test per tab:\n');
    console.log('  📈  Dashboard         Low compliance %, mostly not_started controls');
    console.log('  📋  Frameworks        5 free-tier frameworks adopted');
    console.log('  ✅  Controls          Implemented/in-progress/needs-review/not-started mix (~20% done)');
    console.log(`  🛡️   Vulnerabilities   6 curated + ${hfVulnCount} HF findings, control work items`);
    console.log('  📝  Assessments       Initial plan, 20 results (~60% other_than_satisfied)');
    console.log('  📄  Evidence          8 documents linked to implemented controls');
    console.log('  📋  POA&M             8 items: critical/high/medium/low, open/in-progress/closed');
    console.log('  🖥️   CMDB/Assets       7 assets, environment, service account, password vault');
    console.log('  ⚠️   Exceptions        3 control exceptions (active + expired)');
    console.log('  🤖  AI Decisions      5 entries, 2 bias flags, 2 human-reviewed');
    console.log('  🔔  Notifications     9 notifications (5 unread admin, auditor subset)');
    console.log('  📜  Audit Logs        13 entries covering all event types');
    console.log('  📑  Policies          4 organization policies with sections + control mappings');
    console.log('  🗄️   Retention         3 data retention policies (evidence, audit logs, vulns)');
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
