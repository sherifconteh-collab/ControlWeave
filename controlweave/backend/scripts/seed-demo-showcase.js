require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

const DEMO_ORG_NAME = 'Enterprise Solutions Ltd';
const DEMO_ADMIN_EMAIL = 'admin@professional.com';
const DEMO_ADMIN_PASSWORD = 'Test1234!';
const DEMO_FRAMEWORK_CODES = [
  'nist_csf_2.0',
  'nist_800_53',
  'nist_ai_rmf',
  'eu_ai_act',
  'iso_42001',
  'iso_42005',
  'hipaa',
  'gdpr',
  'soc2'
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function seedDemoShowcase() {
  const client = await pool.connect();
  try {
    console.log('\nSeeding demo showcase data...\n');
    await client.query('BEGIN');

    // 1) Resolve demo organization (idempotent).
    let organization = null;

    const orgFromAdmin = await client.query(
      `SELECT o.id, o.name, o.tier
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.email = $1
       LIMIT 1`,
      [DEMO_ADMIN_EMAIL]
    );
    if (orgFromAdmin.rows.length > 0) {
      organization = orgFromAdmin.rows[0];
    } else {
      const existingOrg = await client.query(
        `SELECT id, name, tier
         FROM organizations
         WHERE name = $1
         ORDER BY created_at ASC
         LIMIT 1`,
        [DEMO_ORG_NAME]
      );
      if (existingOrg.rows.length > 0) {
        organization = existingOrg.rows[0];
      } else {
        const insertedOrg = await client.query(
          `INSERT INTO organizations (name, tier)
           VALUES ($1, 'professional')
           RETURNING id, name, tier`,
          [DEMO_ORG_NAME]
        );
        organization = insertedOrg.rows[0];
      }
    }

    await client.query(
      'UPDATE organizations SET tier = $2, updated_at = NOW() WHERE id = $1',
      [organization.id, 'professional']
    );

    // 2) Ensure demo admin user exists.
    const adminLookup = await client.query(
      'SELECT id, email FROM users WHERE email = $1 LIMIT 1',
      [DEMO_ADMIN_EMAIL]
    );

    let adminUserId;
    if (adminLookup.rows.length === 0) {
      const passwordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10);
      const createdUser = await client.query(`
        INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
        VALUES ($1, $2, $3, 'Demo', 'Admin', 'admin', true)
        RETURNING id
      `, [organization.id, DEMO_ADMIN_EMAIL, passwordHash]);
      adminUserId = createdUser.rows[0].id;
    } else {
      adminUserId = adminLookup.rows[0].id;
      await client.query(
        'UPDATE users SET organization_id = $2, role = $3, is_active = true, updated_at = NOW() WHERE id = $1',
        [adminUserId, organization.id, 'admin']
      );
    }

    // 3) Attach frameworks to demo org.
    const frameworks = await client.query(
      `SELECT id, code
       FROM frameworks
       WHERE is_active = true AND code = ANY($1::text[])`,
      [DEMO_FRAMEWORK_CODES]
    );

    const frameworkIdByCode = new Map(frameworks.rows.map((row) => [row.code, row.id]));
    for (const code of DEMO_FRAMEWORK_CODES) {
      const frameworkId = frameworkIdByCode.get(code);
      if (!frameworkId) continue;
      await client.query(
        `INSERT INTO organization_frameworks (organization_id, framework_id)
         VALUES ($1, $2)
         ON CONFLICT (organization_id, framework_id) DO NOTHING`,
        [organization.id, frameworkId]
      );
    }

    // 4) Seed control implementations with mixed statuses.
    const controls = await client.query(
      `SELECT fc.id, fc.control_id, f.code AS framework_code
       FROM framework_controls fc
       JOIN frameworks f ON f.id = fc.framework_id
       JOIN organization_frameworks ofw ON ofw.framework_id = f.id AND ofw.organization_id = $1
       ORDER BY f.code, fc.control_id
       LIMIT 60`,
      [organization.id]
    );

    for (let i = 0; i < controls.rows.length; i++) {
      const control = controls.rows[i];
      let status = 'not_started';
      if (i < 24) status = 'implemented';
      else if (i < 44) status = 'in_progress';
      else if (i < 52) status = 'needs_review';

      if (status === 'not_started') continue;

      await client.query(`
        INSERT INTO control_implementations (
          control_id, organization_id, status, implementation_notes, assigned_to, notes, implementation_date, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (control_id, organization_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          implementation_notes = EXCLUDED.implementation_notes,
          assigned_to = EXCLUDED.assigned_to,
          notes = EXCLUDED.notes,
          implementation_date = EXCLUDED.implementation_date
      `, [
        control.id,
        organization.id,
        status,
        `Demo seed: ${status} for ${control.framework_code} ${control.control_id}`,
        adminUserId,
        'Seeded for demo walkthrough',
        status === 'implemented' ? new Date().toISOString().split('T')[0] : null
      ]);
    }

    // 5) Seed assessment plan and link procedures.
    const planName = 'Q1 2026 Internal Audit Plan (Demo)';
    const planResult = await client.query(
      `SELECT id FROM assessment_plans
       WHERE organization_id = $1 AND name = $2
       LIMIT 1`,
      [organization.id, planName]
    );

    let planId;
    if (planResult.rows.length > 0) {
      planId = planResult.rows[0].id;
      await client.query(
        `UPDATE assessment_plans
         SET status = 'in_progress', depth = 'focused', lead_assessor_id = $3, updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [planId, organization.id, adminUserId]
      );
    } else {
      const createdPlan = await client.query(`
        INSERT INTO assessment_plans (
          organization_id, name, description, assessment_type, depth, status, lead_assessor_id, start_date
        )
        VALUES ($1, $2, $3, 'annual', 'focused', 'in_progress', $4, CURRENT_DATE - INTERVAL '14 day')
        RETURNING id
      `, [organization.id, planName, 'Demo assessment plan with seeded procedures/results.', adminUserId]);
      planId = createdPlan.rows[0].id;
    }

    const procedures = await client.query(
      `SELECT ap.id
       FROM assessment_procedures ap
       JOIN framework_controls fc ON fc.id = ap.framework_control_id
       JOIN frameworks f ON f.id = fc.framework_id
       JOIN organization_frameworks ofw ON ofw.framework_id = f.id AND ofw.organization_id = $1
       ORDER BY f.code, fc.control_id, ap.procedure_id
       LIMIT 25`,
      [organization.id]
    );

    for (const row of procedures.rows) {
      await client.query(
        `INSERT INTO assessment_plan_procedures (assessment_plan_id, assessment_procedure_id)
         VALUES ($1, $2)
         ON CONFLICT (assessment_plan_id, assessment_procedure_id) DO NOTHING`,
        [planId, row.id]
      );
    }

    const resultStatuses = ['satisfied', 'other_than_satisfied', 'satisfied', 'satisfied', 'other_than_satisfied'];
    for (let i = 0; i < Math.min(10, procedures.rows.length); i++) {
      const procedureId = procedures.rows[i].id;
      const status = resultStatuses[i % resultStatuses.length];
      await client.query(
        `INSERT INTO assessment_results (
          organization_id, assessment_procedure_id, assessor_id, status, finding, evidence_collected,
          risk_level, remediation_required, assessed_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() - ($9::int || ' days')::interval, NOW(), NOW())`,
        [
          organization.id,
          procedureId,
          adminUserId,
          status,
          status === 'satisfied' ? 'Control objective met in sampled population.' : 'Exception observed in sampled evidence.',
          'Seeded demo evidence notes and walkthrough references.',
          status === 'satisfied' ? 'low' : 'medium',
          status !== 'satisfied',
          i + 1
        ]
      );
    }

    // 6) Seed notifications.
    const notifications = [
      {
        type: 'control_due',
        title: 'Demo: High Priority Controls Need Review',
        message: '8 controls are in needs_review status. Validate implementation evidence before audit.',
        link: '/dashboard/controls'
      },
      {
        type: 'assessment_needed',
        title: 'Demo: Assessment Plan In Progress',
        message: 'Q1 2026 Internal Audit Plan includes 25 procedures ready for assessor updates.',
        link: '/dashboard/assessments'
      },
      {
        type: 'system',
        title: 'Demo: Showcase Dataset Loaded',
        message: 'Frameworks, CMDB assets, implementations, and evidence were seeded for a product walkthrough.',
        link: '/dashboard'
      }
    ];

    for (const item of notifications) {
      await client.query(
        `INSERT INTO notifications (organization_id, user_id, type, title, message, link, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, NOW())
         ON CONFLICT DO NOTHING`,
        [organization.id, adminUserId, item.type, item.title, item.message, item.link]
      );
    }

    // 7) Ensure CMDB core objects and assets exist for this org.
    const environmentResult = await client.query(`
      INSERT INTO environments (
        organization_id, name, code, environment_type,
        contains_pii, contains_phi, data_classification, security_level, criticality, owner_id
      )
      VALUES ($1, 'Production', 'prod', 'production', true, false, 'restricted', 'high', 'critical', $2)
      ON CONFLICT (organization_id, code)
      DO UPDATE SET
        name = EXCLUDED.name,
        environment_type = EXCLUDED.environment_type,
        contains_pii = EXCLUDED.contains_pii,
        data_classification = EXCLUDED.data_classification,
        security_level = EXCLUDED.security_level,
        criticality = EXCLUDED.criticality,
        owner_id = EXCLUDED.owner_id,
        updated_at = NOW()
      RETURNING id
    `, [organization.id, adminUserId]);
    const environmentId = environmentResult.rows[0].id;

    const vaultResult = await client.query(`
      INSERT INTO password_vaults (organization_id, name, vault_type, vault_url, is_active)
      VALUES ($1, 'Demo Vault', 'hashicorp_vault', 'https://vault.demo.local', true)
      ON CONFLICT (organization_id, name)
      DO UPDATE SET
        vault_type = EXCLUDED.vault_type,
        vault_url = EXCLUDED.vault_url,
        is_active = true
      RETURNING id
    `, [organization.id]);
    const vaultId = vaultResult.rows[0].id;

    const categoryRows = await client.query('SELECT id, code FROM asset_categories');
    const categoryByCode = new Map(categoryRows.rows.map((row) => [row.code, row.id]));

    const assetDefinitions = [
      {
        name: 'Demo Web Server',
        category: 'hardware',
        hostname: 'demo-web-01',
        ip: '10.20.0.10',
        classification: 'restricted',
        criticality: 'high'
      },
      {
        name: 'Demo Database Server',
        category: 'hardware',
        hostname: 'demo-db-01',
        ip: '10.20.0.20',
        classification: 'restricted',
        criticality: 'critical'
      },
      {
        name: 'Demo SIEM Platform',
        category: 'software',
        version: '9.0.0',
        classification: 'confidential',
        criticality: 'high'
      },
      {
        name: 'Demo Cloud Storage',
        category: 'cloud',
        provider: 'AWS',
        region: 'us-east-1',
        classification: 'restricted',
        criticality: 'high'
      },
      {
        name: 'Demo AI Risk Classifier',
        category: 'ai_agent',
        modelType: 'llm',
        aiRisk: 'limited',
        classification: 'confidential',
        criticality: 'medium'
      }
    ];

    for (const definition of assetDefinitions) {
      const categoryId = categoryByCode.get(definition.category);
      if (!categoryId) continue;

      const existing = await client.query(
        `SELECT id
         FROM assets
         WHERE organization_id = $1 AND name = $2
         LIMIT 1`,
        [organization.id, definition.name]
      );

      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE assets
           SET category_id = $2,
               owner_id = $3,
               environment_id = $4,
               hostname = COALESCE($5, hostname),
               ip_address = COALESCE($6, ip_address),
               version = COALESCE($7, version),
               cloud_provider = COALESCE($8, cloud_provider),
               cloud_region = COALESCE($9, cloud_region),
               ai_model_type = COALESCE($10, ai_model_type),
               ai_risk_level = COALESCE($11, ai_risk_level),
               security_classification = $12,
               criticality = $13,
               status = 'active',
               updated_at = NOW()
           WHERE id = $1 AND organization_id = $14`,
          [
            existing.rows[0].id,
            categoryId,
            adminUserId,
            environmentId,
            definition.hostname || null,
            definition.ip || null,
            definition.version || null,
            definition.provider || null,
            definition.region || null,
            definition.modelType || null,
            definition.aiRisk || null,
            definition.classification,
            definition.criticality,
            organization.id
          ]
        );
      } else {
        await client.query(
          `INSERT INTO assets (
             organization_id, category_id, name, owner_id, environment_id, status,
             hostname, ip_address, version, cloud_provider, cloud_region,
             ai_model_type, ai_risk_level, security_classification, criticality, created_at, updated_at
           )
           VALUES (
             $1, $2, $3, $4, $5, 'active',
             $6, $7, $8, $9, $10,
             $11, $12, $13, $14, NOW(), NOW()
           )`,
          [
            organization.id,
            categoryId,
            definition.name,
            adminUserId,
            environmentId,
            definition.hostname || null,
            definition.ip || null,
            definition.version || null,
            definition.provider || null,
            definition.region || null,
            definition.modelType || null,
            definition.aiRisk || null,
            definition.classification,
            definition.criticality
          ]
        );
      }
    }

    const seededAssetNames = assetDefinitions.map((item) => item.name);
    const seededAssets = await client.query(
      `SELECT id, name
       FROM assets
       WHERE organization_id = $1 AND name = ANY($2::text[])`,
      [organization.id, seededAssetNames]
    );
    const assetIdByName = new Map(seededAssets.rows.map((row) => [row.name, row.id]));

    await client.query(
      `INSERT INTO service_accounts (
         organization_id, account_name, account_type, description, owner_id, business_justification,
         vault_id, vault_path, credential_type, rotation_frequency_days, next_rotation_date,
         privilege_level, scope, review_frequency_days, next_review_date, reviewer_id, status, is_active
       )
       VALUES (
         $1, 'demo-app-service', 'system_user', 'Demo application service account', $2, 'Needed for demo application integrations',
         $3, '/demo/app-service', 'password', 90, CURRENT_DATE + INTERVAL '90 day',
         'write', 'Demo application data stores', 90, CURRENT_DATE + INTERVAL '90 day', $2, 'active', true
       )
       ON CONFLICT (organization_id, account_name)
       DO UPDATE SET
         owner_id = EXCLUDED.owner_id,
         vault_id = EXCLUDED.vault_id,
         privilege_level = EXCLUDED.privilege_level,
         status = 'active',
         is_active = true,
         updated_at = NOW()`,
      [organization.id, adminUserId, vaultId]
    );

    // 8) Seed evidence files and links.
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'demo');
    ensureDir(uploadsDir);

    const evidenceControls = controls.rows.slice(0, 3);
    for (let i = 0; i < evidenceControls.length; i++) {
      const control = evidenceControls[i];
      const fileName = `demo-evidence-${i + 1}.txt`;
      const filePath = path.join(uploadsDir, fileName);
      const content = [
        `Demo evidence file ${i + 1}`,
        `Framework: ${control.framework_code}`,
        `Control: ${control.control_id}`,
        `Generated at: ${new Date().toISOString()}`
      ].join('\n');
      fs.writeFileSync(filePath, content, 'utf8');

      const hash = sha256(content);
      const existingEvidence = await client.query(
        `SELECT id FROM evidence
         WHERE organization_id = $1 AND file_name = $2
         LIMIT 1`,
        [organization.id, fileName]
      );

      let evidenceId;
      if (existingEvidence.rows.length > 0) {
        evidenceId = existingEvidence.rows[0].id;
        await client.query(
          `UPDATE evidence
           SET file_path = $3,
               file_size = $4,
               mime_type = 'text/plain',
               description = $5,
               tags = $6,
               integrity_hash_sha256 = $7,
               retention_until = CURRENT_DATE + INTERVAL '365 day',
               integrity_verified_at = NOW(),
               updated_at = NOW()
           WHERE id = $1 AND organization_id = $2`,
          [
            evidenceId,
            organization.id,
            filePath,
            Buffer.byteLength(content),
            `Seeded demo evidence for ${control.framework_code} ${control.control_id}`,
            ['demo', 'walkthrough', control.framework_code],
            hash
          ]
        );
      } else {
        const insertedEvidence = await client.query(
          `INSERT INTO evidence (
             organization_id, uploaded_by, file_name, file_path, file_size, mime_type, description, tags,
             integrity_hash_sha256, evidence_version, retention_until, integrity_verified_at, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, 'text/plain', $6, $7, $8, 1, CURRENT_DATE + INTERVAL '365 day', NOW(), NOW(), NOW())
           RETURNING id`,
          [
            organization.id,
            adminUserId,
            fileName,
            filePath,
            Buffer.byteLength(content),
            `Seeded demo evidence for ${control.framework_code} ${control.control_id}`,
            ['demo', 'walkthrough', control.framework_code],
            hash
          ]
        );
        evidenceId = insertedEvidence.rows[0].id;
      }

      await client.query(
        `INSERT INTO evidence_control_links (evidence_id, control_id, notes)
         VALUES ($1, $2, $3)
         ON CONFLICT (evidence_id, control_id) DO NOTHING`,
        [evidenceId, control.id, 'Seeded demo evidence link']
      );
    }

    // 9) Seed audit logs for showcase visibility (idempotent via seed_tag).
    await client.query(
      `DELETE FROM audit_logs
       WHERE organization_id = $1
         AND details->>'seed_tag' = 'demo_showcase'`,
      [organization.id]
    );

    const firstControlId = controls.rows[0]?.id || null;
    const secondControlId = controls.rows[1]?.id || null;
    const firstProcedureId = procedures.rows[0]?.id || null;

    const auditEvents = [
      {
        eventType: 'user_login',
        resourceType: 'auth',
        resourceId: null,
        success: true,
        failureReason: null,
        ipAddress: '10.20.0.5',
        minutesAgo: 360,
        details: { seed_tag: 'demo_showcase', summary: 'Admin user signed in to start compliance review.' }
      },
      {
        eventType: 'frameworks_updated',
        resourceType: 'organization_frameworks',
        resourceId: null,
        success: true,
        failureReason: null,
        ipAddress: '10.20.0.5',
        minutesAgo: 330,
        details: { seed_tag: 'demo_showcase', summary: 'Enabled multiple frameworks for unified control coverage.' }
      },
      {
        eventType: 'control_status_changed',
        resourceType: 'control',
        resourceId: firstControlId,
        success: true,
        failureReason: null,
        ipAddress: '10.20.0.10',
        minutesAgo: 300,
        details: { seed_tag: 'demo_showcase', from: 'in_progress', to: 'implemented' }
      },
      {
        eventType: 'control_status_changed',
        resourceType: 'control',
        resourceId: secondControlId,
        success: true,
        failureReason: null,
        ipAddress: '10.20.0.11',
        minutesAgo: 260,
        details: { seed_tag: 'demo_showcase', from: 'not_started', to: 'needs_review' }
      },
      {
        eventType: 'assessment_result_recorded',
        resourceType: 'assessment_procedure',
        resourceId: firstProcedureId,
        success: true,
        failureReason: null,
        ipAddress: '10.20.0.15',
        minutesAgo: 220,
        details: { seed_tag: 'demo_showcase', summary: 'Assessment result captured for in-progress audit plan.' }
      },
      {
        eventType: 'evidence_uploaded',
        resourceType: 'evidence',
        resourceId: null,
        success: true,
        failureReason: null,
        ipAddress: '10.20.0.20',
        minutesAgo: 190,
        details: { seed_tag: 'demo_showcase', summary: 'Evidence artifact attached to mapped controls.' }
      },
      {
        eventType: 'notification_created',
        resourceType: 'notification',
        resourceId: null,
        success: true,
        failureReason: null,
        ipAddress: '10.20.0.22',
        minutesAgo: 150,
        details: { seed_tag: 'demo_showcase', summary: 'Compliance reminder notification generated.' }
      },
      {
        eventType: 'report_generated',
        resourceType: 'report',
        resourceId: null,
        success: true,
        failureReason: null,
        ipAddress: '10.20.0.30',
        minutesAgo: 120,
        details: { seed_tag: 'demo_showcase', summary: 'Generated executive compliance summary report.' }
      },
      {
        eventType: 'ai_analysis_requested',
        resourceType: 'ai',
        resourceId: null,
        success: false,
        failureReason: 'Provider API key not configured',
        ipAddress: '10.20.0.31',
        minutesAgo: 90,
        details: { seed_tag: 'demo_showcase', feature: 'gap_analysis' }
      },
      {
        eventType: 'audit_logs_viewed',
        resourceType: 'audit',
        resourceId: null,
        success: true,
        failureReason: null,
        ipAddress: '10.20.0.5',
        minutesAgo: 45,
        details: { seed_tag: 'demo_showcase', summary: 'User reviewed audit trail entries.' }
      },
      {
        eventType: 'settings_updated',
        resourceType: 'organization_settings',
        resourceId: null,
        success: true,
        failureReason: null,
        ipAddress: '10.20.0.5',
        minutesAgo: 20,
        details: { seed_tag: 'demo_showcase', summary: 'Updated compliance reporting preferences.' }
      }
    ];

    for (const event of auditEvents) {
      await client.query(
        `INSERT INTO audit_logs (
           organization_id, user_id, event_type, resource_type, resource_id,
           details, ip_address, user_agent, success, failure_reason, created_at
         )
         VALUES (
           $1, $2, $3, $4, $5,
           $6::jsonb, $7, $8, $9, $10, NOW() - ($11::int || ' minutes')::interval
         )`,
        [
          organization.id,
          adminUserId,
          event.eventType,
          event.resourceType,
          event.resourceId,
          JSON.stringify(event.details),
          event.ipAddress,
          'Demo Showcase Seeder',
          event.success,
          event.failureReason,
          event.minutesAgo
        ]
      );
    }

    // 10) Seed vulnerability findings (ACAS/SBOM/STIG + cross-framework standards).
    await client.query(
      `DELETE FROM vulnerability_findings
       WHERE organization_id = $1
         AND metadata->>'seed_tag' = 'demo_showcase'`,
      [organization.id]
    );

    const vulnerabilityFindings = [
      {
        source: 'ACAS',
        standard: 'CVE/NVD',
        findingKey: 'demo-acas-web-0001',
        vulnerabilityId: 'CVE-2025-38123',
        title: 'OpenSSL privilege escalation vulnerability',
        description: 'ACAS detected vulnerable OpenSSL version on web server.',
        severity: 'critical',
        cvss: 9.8,
        status: 'open',
        daysAgo: 21,
        assetName: 'Demo Web Server',
        packageName: 'openssl',
        componentName: 'openssl-libs',
        versionDetected: '1.1.1k',
        cweId: 'CWE-269',
        kevListed: true,
        exploitAvailable: true,
        dueInDays: 3
      },
      {
        source: 'ACAS',
        standard: 'CISA KEV',
        findingKey: 'demo-acas-db-0002',
        vulnerabilityId: 'CVE-2024-6387',
        title: 'OpenSSH regreSSHion remote code execution',
        description: 'Known exploited OpenSSH issue detected on database host.',
        severity: 'high',
        cvss: 8.1,
        status: 'in_progress',
        daysAgo: 16,
        assetName: 'Demo Database Server',
        packageName: 'openssh-server',
        componentName: 'openssh',
        versionDetected: '8.8p1',
        cweId: 'CWE-787',
        kevListed: true,
        exploitAvailable: true,
        dueInDays: 5
      },
      {
        source: 'STIG',
        standard: 'DISA STIG',
        findingKey: 'demo-stig-web-0003',
        vulnerabilityId: 'RHEL-09-255140',
        title: 'Auditd configuration not capturing privileged command execution',
        description: 'STIG control check failed for privileged command auditing.',
        severity: 'high',
        cvss: 7.5,
        status: 'open',
        daysAgo: 13,
        assetName: 'Demo Web Server',
        stigId: 'RHEL-09-255140',
        cweId: null,
        kevListed: false,
        exploitAvailable: false,
        dueInDays: 14
      },
      {
        source: 'STIG',
        standard: 'SCAP',
        findingKey: 'demo-stig-db-0004',
        vulnerabilityId: 'RHEL-09-232010',
        title: 'Unapproved services enabled on database server',
        description: 'SCAP baseline scan flagged non-compliant service hardening.',
        severity: 'medium',
        cvss: 6.3,
        status: 'open',
        daysAgo: 9,
        assetName: 'Demo Database Server',
        stigId: 'RHEL-09-232010',
        cweId: null,
        kevListed: false,
        exploitAvailable: false,
        dueInDays: 20
      },
      {
        source: 'SBOM',
        standard: 'CycloneDX',
        findingKey: 'demo-sbom-siem-0005',
        vulnerabilityId: 'CVE-2023-38545',
        title: 'Embedded libcurl vulnerable dependency in SIEM add-on',
        description: 'CycloneDX SBOM analysis detected vulnerable dependency path.',
        severity: 'medium',
        cvss: 6.5,
        status: 'open',
        daysAgo: 7,
        assetName: 'Demo SIEM Platform',
        packageName: 'curl',
        componentName: 'libcurl',
        versionDetected: '7.79.1',
        cweId: 'CWE-20',
        kevListed: false,
        exploitAvailable: true,
        dueInDays: 21
      },
      {
        source: 'SBOM',
        standard: 'SPDX',
        findingKey: 'demo-sbom-ai-0006',
        vulnerabilityId: 'CVE-2022-29217',
        title: 'Prototype pollution in transitive npm dependency',
        description: 'SPDX manifest reveals vulnerable transitive package in AI service.',
        severity: 'medium',
        cvss: 5.6,
        status: 'risk_accepted',
        daysAgo: 5,
        assetName: 'Demo AI Risk Classifier',
        packageName: 'lodash',
        componentName: 'lodash.merge',
        versionDetected: '4.6.1',
        cweId: 'CWE-1321',
        kevListed: false,
        exploitAvailable: false,
        dueInDays: 45
      },
      {
        source: 'SCAP',
        standard: 'CIS Benchmarks',
        findingKey: 'demo-scap-cloud-0007',
        vulnerabilityId: 'CIS-AWS-3.8',
        title: 'S3 bucket versioning disabled for critical storage',
        description: 'Configuration benchmark non-compliance found in cloud storage controls.',
        severity: 'high',
        cvss: 7.2,
        status: 'in_progress',
        daysAgo: 4,
        assetName: 'Demo Cloud Storage',
        packageName: null,
        componentName: 'aws-s3',
        versionDetected: null,
        cweId: null,
        kevListed: false,
        exploitAvailable: false,
        dueInDays: 10
      },
      {
        source: 'SAST',
        standard: 'OWASP ASVS',
        findingKey: 'demo-sast-ai-0008',
        vulnerabilityId: 'OWASP-ASVS-5.3.4',
        title: 'Insufficient output encoding in AI response rendering path',
        description: 'Static analysis found unsanitized output path in UI integration.',
        severity: 'low',
        cvss: 3.9,
        status: 'remediated',
        daysAgo: 2,
        assetName: 'Demo AI Risk Classifier',
        packageName: null,
        componentName: 'frontend-renderer',
        versionDetected: null,
        cweId: 'CWE-79',
        kevListed: false,
        exploitAvailable: false,
        dueInDays: 30
      }
    ];

    const insertedVulns = [];
    for (const finding of vulnerabilityFindings) {
      const assetId = assetIdByName.get(finding.assetName) || null;
      const insertResult = await client.query(
        `INSERT INTO vulnerability_findings (
           organization_id, asset_id, source, standard, finding_key, vulnerability_id, title, description,
           severity, cvss_score, status, first_seen_at, last_seen_at, detected_at, due_date,
           package_name, component_name, version_detected, stig_id, cwe_id,
           kev_listed, exploit_available, metadata
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8,
           $9, $10, $11,
           NOW() - ($12::int || ' days')::interval,
           NOW() - ($13::int || ' days')::interval,
           NOW() - ($14::int || ' days')::interval,
           CURRENT_DATE + ($15::int || ' days')::interval,
           $16, $17, $18, $19, $20,
           $21, $22, $23::jsonb
         )
         ON CONFLICT (organization_id, finding_key)
         DO UPDATE SET
           asset_id = EXCLUDED.asset_id,
           source = EXCLUDED.source,
           standard = EXCLUDED.standard,
           vulnerability_id = EXCLUDED.vulnerability_id,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           severity = EXCLUDED.severity,
           cvss_score = EXCLUDED.cvss_score,
           status = EXCLUDED.status,
           first_seen_at = EXCLUDED.first_seen_at,
           last_seen_at = EXCLUDED.last_seen_at,
           detected_at = EXCLUDED.detected_at,
           due_date = EXCLUDED.due_date,
           package_name = EXCLUDED.package_name,
           component_name = EXCLUDED.component_name,
           version_detected = EXCLUDED.version_detected,
           stig_id = EXCLUDED.stig_id,
           cwe_id = EXCLUDED.cwe_id,
           kev_listed = EXCLUDED.kev_listed,
           exploit_available = EXCLUDED.exploit_available,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
         RETURNING id, finding_key, vulnerability_id, source`,
        [
          organization.id,
          assetId,
          finding.source,
          finding.standard,
          finding.findingKey,
          finding.vulnerabilityId,
          finding.title,
          finding.description,
          finding.severity,
          finding.cvss,
          finding.status,
          finding.daysAgo + 10,
          finding.daysAgo,
          finding.daysAgo,
          finding.dueInDays,
          finding.packageName || null,
          finding.componentName || null,
          finding.versionDetected || null,
          finding.stigId || null,
          finding.cweId || null,
          finding.kevListed,
          finding.exploitAvailable,
          JSON.stringify({
            seed_tag: 'demo_showcase',
            framework_alignment: ['NIST CSF', 'NIST 800-53', 'ISO 27001', 'SOC 2', 'HIPAA'],
            ingestion_channel: finding.source
          })
        ]
      );

      insertedVulns.push(insertResult.rows[0]);
    }

    for (let i = 0; i < insertedVulns.length; i++) {
      const vuln = insertedVulns[i];
      await client.query(
        `INSERT INTO audit_logs (
           organization_id, user_id, event_type, resource_type, resource_id, details,
           ip_address, user_agent, success, failure_reason, created_at
         )
         VALUES (
           $1, $2, 'vulnerability_scan_imported', 'vulnerability', $3,
           $4::jsonb, $5, 'Demo Showcase Seeder', true, NULL,
           NOW() - ($6::int || ' minutes')::interval
         )`,
        [
          organization.id,
          adminUserId,
          vuln.id,
          JSON.stringify({
            seed_tag: 'demo_showcase',
            finding_key: vuln.finding_key,
            vulnerability_id: vuln.vulnerability_id,
            source: vuln.source
          }),
          '10.20.0.40',
          80 - i * 4
        ]
      );
    }

    await client.query('COMMIT');

    console.log('Demo showcase seed complete.\n');
    console.log(`Organization: ${DEMO_ORG_NAME} (${organization.id})`);
    console.log(`Tier: professional`);
    console.log(`Admin login: ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD}`);
    console.log(`Frameworks attached: ${DEMO_FRAMEWORK_CODES.join(', ')}`);
    console.log('Seeded data: frameworks, implementations, assessments, notifications, CMDB assets, service account, evidence files, vulnerability findings.\n');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Demo showcase seed failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemoShowcase().catch(() => process.exit(1));
