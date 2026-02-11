require('dotenv').config();
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

const DEMO_TEAM_USERS = [
  {
    email: 'auditor.lead@professional.com',
    firstName: 'Avery',
    lastName: 'Auditor',
    role: 'auditor',
    preferredRole: 'auditor_lead'
  },
  {
    email: 'auditor.staff@professional.com',
    firstName: 'Morgan',
    lastName: 'Fieldwork',
    role: 'auditor',
    preferredRole: 'auditor_fieldwork'
  },
  {
    email: 'analyst@professional.com',
    firstName: 'Jordan',
    lastName: 'Analyst',
    role: 'user',
    preferredRole: 'user'
  },
  {
    email: 'leadership@professional.com',
    firstName: 'Riley',
    lastName: 'Leadership',
    role: 'user',
    preferredRole: 'user'
  }
];

const DEMO_TEMPLATE_DEFS = [
  {
    artifactType: 'pbc',
    templateName: 'DEMO-SEED PBC Default',
    templateContent: [
      'PBC Request',
      'Control: {{control_id}} - {{control_title}}',
      'Procedure: {{procedure_id}} {{procedure_title}}',
      'Requested Evidence: {{expected_evidence}}',
      'Priority: {{priority}}',
      'Due Date: {{due_date}}',
      'Auditor Context: {{request_context}}'
    ].join('\n')
  },
  {
    artifactType: 'workpaper',
    templateName: 'DEMO-SEED Workpaper Default',
    templateContent: [
      'Workpaper Narrative',
      'Objective: {{objective}}',
      'Procedure Performed: {{procedure_performed}}',
      'Evidence Summary: {{evidence_summary}}',
      'Outcome: {{test_outcome}}',
      'Conclusion: {{conclusion}}'
    ].join('\n')
  },
  {
    artifactType: 'finding',
    templateName: 'DEMO-SEED Finding Default',
    templateContent: [
      'Finding',
      'Observation: {{description}}',
      'Criteria: {{criteria}}',
      'Cause: {{cause}}',
      'Effect: {{effect}}',
      'Recommendation: {{recommendation}}'
    ].join('\n')
  },
  {
    artifactType: 'signoff',
    templateName: 'DEMO-SEED Signoff Default',
    templateContent: [
      'Sign-off Statement',
      'Role: {{signoff_type}}',
      'Status: {{status}}',
      'Comments: {{comments}}',
      'Signed By: {{signed_by}}'
    ].join('\n')
  },
  {
    artifactType: 'engagement_report',
    templateName: 'DEMO-SEED Validation Report Default',
    templateContent: [
      'Engagement Validation Package',
      'Engagement: {{engagement_name}}',
      'Scope: {{engagement_scope}}',
      'Frameworks: {{framework_codes}}',
      'Summary: {{summary}}',
      'Recommendations: {{recommendations}}'
    ].join('\n')
  }
];

function dateOffset(days) {
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function token() {
  return crypto.randomBytes(24).toString('hex');
}

async function ensureSystemRole(client, userId, roleName) {
  const roleResult = await client.query(
    `SELECT id
     FROM roles
     WHERE name = $1
       AND is_system_role = true
     LIMIT 1`,
    [roleName]
  );
  if (roleResult.rows.length === 0) {
    return;
  }

  await client.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, roleResult.rows[0].id]
  );
}

async function ensureNamedRole(client, userId, roleName) {
  const roleResult = await client.query(
    `SELECT id
     FROM roles
     WHERE name = $1
     LIMIT 1`,
    [roleName]
  );
  if (roleResult.rows.length === 0) {
    return false;
  }

  await client.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, roleResult.rows[0].id]
  );
  return true;
}

async function ensureUser(client, { organizationId, email, passwordHash, firstName, lastName, role }) {
  const userLookup = await client.query(
    `SELECT id
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email]
  );

  if (userLookup.rows.length === 0) {
    const inserted = await client.query(
      `INSERT INTO users (
         organization_id, email, password_hash, first_name, last_name, role, is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id`,
      [organizationId, email, passwordHash, firstName, lastName, role]
    );
    return inserted.rows[0].id;
  }

  const userId = userLookup.rows[0].id;
  await client.query(
    `UPDATE users
     SET organization_id = $2,
         password_hash = $3,
         first_name = $4,
         last_name = $5,
         role = $6,
         is_active = true,
         updated_at = NOW()
     WHERE id = $1`,
    [userId, organizationId, passwordHash, firstName, lastName, role]
  );
  return userId;
}

async function ensureTemplate(client, { organizationId, ownerUserId, artifactType, templateName, templateContent }) {
  await client.query(
    `UPDATE audit_artifact_templates
     SET is_default = false, updated_at = NOW()
     WHERE organization_id = $1
       AND owner_user_id = $2
       AND artifact_type = $3
       AND is_active = true`,
    [organizationId, ownerUserId, artifactType]
  );

  const existing = await client.query(
    `SELECT id
     FROM audit_artifact_templates
     WHERE organization_id = $1
       AND owner_user_id = $2
       AND artifact_type = $3
       AND template_name = $4
     LIMIT 1`,
    [organizationId, ownerUserId, artifactType, templateName]
  );

  if (existing.rows.length > 0) {
    await client.query(
      `UPDATE audit_artifact_templates
       SET template_content = $3,
           template_format = 'text',
           is_default = true,
           is_active = true,
           updated_at = NOW()
       WHERE id = $1
         AND organization_id = $2`,
      [existing.rows[0].id, organizationId, templateContent]
    );
    return;
  }

  await client.query(
    `INSERT INTO audit_artifact_templates (
       organization_id, artifact_type, template_name, template_content,
       template_format, is_default, is_active, created_by, owner_user_id
     )
     VALUES ($1, $2, $3, $4, 'text', true, true, $5, $5)`,
    [organizationId, artifactType, templateName, templateContent, ownerUserId]
  );
}

function pickRow(rows, index) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[index % rows.length];
}

async function seedAdminDemoWorkspace() {
  const client = await pool.connect();
  try {
    console.log('\nSeeding admin demo workspace state...\n');
    await client.query('BEGIN');

    // 1) Resolve or create demo organization.
    let organizationId = null;
    const orgByAdmin = await client.query(
      `SELECT o.id
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.email = $1
       LIMIT 1`,
      [DEMO_ADMIN_EMAIL]
    );

    if (orgByAdmin.rows.length > 0) {
      organizationId = orgByAdmin.rows[0].id;
    } else {
      const existingOrg = await client.query(
        `SELECT id
         FROM organizations
         WHERE name = $1
         ORDER BY created_at ASC
         LIMIT 1`,
        [DEMO_ORG_NAME]
      );
      if (existingOrg.rows.length > 0) {
        organizationId = existingOrg.rows[0].id;
      } else {
        const insertedOrg = await client.query(
          `INSERT INTO organizations (name, tier)
           VALUES ($1, 'professional')
           RETURNING id`,
          [DEMO_ORG_NAME]
        );
        organizationId = insertedOrg.rows[0].id;
      }
    }

    await client.query(
      `UPDATE organizations
       SET tier = 'professional',
           updated_at = NOW()
       WHERE id = $1`,
      [organizationId]
    );

    // 2) Force demo admin account.
    const passwordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10);
    const adminUserId = await ensureUser(client, {
      organizationId,
      email: DEMO_ADMIN_EMAIL,
      passwordHash,
      firstName: 'Demo',
      lastName: 'Admin',
      role: 'admin'
    });
    await ensureSystemRole(client, adminUserId, 'admin');

    // 3) Mark org onboarding complete so admin is not redirected to onboarding.
    await client.query(
      `INSERT INTO organization_profiles (
         organization_id,
         data_sensitivity_types,
         onboarding_completed,
         onboarding_completed_at,
         created_by,
         updated_by,
         created_at,
         updated_at
       )
       VALUES (
         $1,
         $2::text[],
         true,
         NOW(),
         $3,
         $3,
         NOW(),
         NOW()
       )
       ON CONFLICT (organization_id) DO UPDATE SET
         data_sensitivity_types = CASE
           WHEN COALESCE(array_length(organization_profiles.data_sensitivity_types, 1), 0) = 0
             THEN EXCLUDED.data_sensitivity_types
           ELSE organization_profiles.data_sensitivity_types
         END,
         onboarding_completed = true,
         onboarding_completed_at = COALESCE(
           organization_profiles.onboarding_completed_at,
           EXCLUDED.onboarding_completed_at
         ),
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [organizationId, ['confidential', 'restricted', 'pii'], adminUserId]
    );

    // 4) Ensure frameworks are attached.
    const frameworkRows = await client.query(
      `SELECT id, code
       FROM frameworks
       WHERE is_active = true
         AND code = ANY($1::text[])`,
      [DEMO_FRAMEWORK_CODES]
    );
    for (const row of frameworkRows.rows) {
      await client.query(
        `INSERT INTO organization_frameworks (organization_id, framework_id)
         VALUES ($1, $2)
         ON CONFLICT (organization_id, framework_id) DO NOTHING`,
        [organizationId, row.id]
      );
    }
    const frameworkCodes = frameworkRows.rows.map((row) => row.code);

    // 5) Ensure demo team users for admin settings tests.
    const teamUserIds = {};
    for (const teamUser of DEMO_TEAM_USERS) {
      const id = await ensureUser(client, {
        organizationId,
        email: teamUser.email,
        passwordHash,
        firstName: teamUser.firstName,
        lastName: teamUser.lastName,
        role: teamUser.role
      });
      teamUserIds[teamUser.email] = id;
      await ensureSystemRole(client, id, teamUser.role);
      if (teamUser.preferredRole && teamUser.preferredRole !== teamUser.role) {
        await ensureNamedRole(client, id, teamUser.preferredRole);
      }
    }

    const leadAuditorId = teamUserIds['auditor.lead@professional.com'] || adminUserId;
    const analystUserId = teamUserIds['analyst@professional.com'] || adminUserId;
    const leadershipUserId = teamUserIds['leadership@professional.com'] || adminUserId;

    // 6) Seed one canonical engagement for auditor workspace testing.
    const engagementName = 'FY 2026 Auditor Readiness Engagement (Demo)';
    const existingEngagement = await client.query(
      `SELECT id
       FROM audit_engagements
       WHERE organization_id = $1
         AND name = $2
       LIMIT 1`,
      [organizationId, engagementName]
    );

    let engagementId = null;
    if (existingEngagement.rows.length > 0) {
      engagementId = existingEngagement.rows[0].id;
      await client.query(
        `UPDATE audit_engagements
         SET engagement_type = 'external_audit',
             scope = $3,
             framework_codes = $4::text[],
             status = 'fieldwork',
             period_start = $5,
             period_end = $6,
             lead_auditor_id = $7,
             engagement_owner_id = $8,
             updated_at = NOW()
         WHERE id = $1
           AND organization_id = $2`,
        [
          engagementId,
          organizationId,
          'Core SaaS platform controls, CMDB assets, AI governance controls, and customer-facing evidence workflows.',
          frameworkCodes,
          dateOffset(-30),
          dateOffset(30),
          leadAuditorId,
          adminUserId
        ]
      );
    } else {
      const insertedEngagement = await client.query(
        `INSERT INTO audit_engagements (
           organization_id, name, engagement_type, scope, framework_codes, status,
           period_start, period_end, lead_auditor_id, engagement_owner_id, created_by
         )
         VALUES (
           $1, $2, 'external_audit', $3, $4::text[], 'fieldwork',
           $5, $6, $7, $8, $9
         )
         RETURNING id`,
        [
          organizationId,
          engagementName,
          'Core SaaS platform controls, CMDB assets, AI governance controls, and customer-facing evidence workflows.',
          frameworkCodes,
          dateOffset(-30),
          dateOffset(30),
          leadAuditorId,
          adminUserId,
          adminUserId
        ]
      );
      engagementId = insertedEngagement.rows[0].id;
    }

    // 7) Resolve procedure/control references for linked artifacts.
    const procedureRows = await client.query(
      `SELECT
         ap.id AS assessment_procedure_id,
         COALESCE(ap.procedure_id, ap.id::text) AS procedure_code,
         ap.title AS procedure_title,
         ap.expected_evidence,
         fc.id AS control_db_id,
         fc.control_id,
         f.code AS framework_code
       FROM assessment_procedures ap
       JOIN framework_controls fc ON fc.id = ap.framework_control_id
       JOIN frameworks f ON f.id = fc.framework_id
       JOIN organization_frameworks ofw
         ON ofw.framework_id = f.id
        AND ofw.organization_id = $1
       ORDER BY f.code, fc.control_id, ap.sort_order
       LIMIT 12`,
      [organizationId]
    );

    const fallbackControls = await client.query(
      `SELECT
         fc.id AS control_db_id,
         fc.control_id,
         f.code AS framework_code
       FROM framework_controls fc
       JOIN frameworks f ON f.id = fc.framework_id
       JOIN organization_frameworks ofw
         ON ofw.framework_id = f.id
        AND ofw.organization_id = $1
       ORDER BY f.code, fc.control_id
       LIMIT 12`,
      [organizationId]
    );

    // 8) Recreate demo-seeded engagement artifacts idempotently.
    await client.query(
      `DELETE FROM audit_findings
       WHERE organization_id = $1
         AND engagement_id = $2
         AND title LIKE 'DEMO-SEED:%'`,
      [organizationId, engagementId]
    );
    await client.query(
      `DELETE FROM audit_workpapers
       WHERE organization_id = $1
         AND engagement_id = $2
         AND title LIKE 'DEMO-SEED:%'`,
      [organizationId, engagementId]
    );
    await client.query(
      `DELETE FROM audit_pbc_requests
       WHERE organization_id = $1
         AND engagement_id = $2
         AND title LIKE 'DEMO-SEED:%'`,
      [organizationId, engagementId]
    );

    const pbcSeedRows = [
      {
        title: 'DEMO-SEED: Access review evidence package',
        priority: 'high',
        status: 'open',
        dueDate: dateOffset(10),
        context: 'Provide latest quarterly privileged access review package with approvals.'
      },
      {
        title: 'DEMO-SEED: Vulnerability remediation closure package',
        priority: 'critical',
        status: 'submitted',
        dueDate: dateOffset(5),
        context: 'Provide patch validation and scanner rerun evidence for critical findings.'
      },
      {
        title: 'DEMO-SEED: Incident tabletop completion pack',
        priority: 'medium',
        status: 'accepted',
        dueDate: dateOffset(-2),
        context: 'Provide tabletop attendee records, outcomes, and corrective actions.'
      }
    ];

    const insertedPbcRows = [];
    for (let i = 0; i < pbcSeedRows.length; i++) {
      const procedure = pickRow(procedureRows.rows, i);
      const controlFallback = pickRow(fallbackControls.rows, i);
      const details = [
        `Procedure: ${procedure?.procedure_code || 'N/A'}`,
        `Control: ${procedure?.control_id || controlFallback?.control_id || 'N/A'}`,
        `Framework: ${(procedure?.framework_code || controlFallback?.framework_code || 'N/A').toUpperCase()}`,
        `Requested Evidence: ${procedure?.expected_evidence || 'Supporting artifacts and screenshots validating control operation.'}`,
        `Context: ${pbcSeedRows[i].context}`
      ].join('\n');

      const inserted = await client.query(
        `INSERT INTO audit_pbc_requests (
           organization_id, engagement_id, title, request_details, priority, status,
           due_date, assigned_to, response_notes, created_by, assessment_procedure_id
         )
         VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11
         )
         RETURNING id, assessment_procedure_id`,
        [
          organizationId,
          engagementId,
          pbcSeedRows[i].title,
          details,
          pbcSeedRows[i].priority,
          pbcSeedRows[i].status,
          pbcSeedRows[i].dueDate,
          leadAuditorId,
          pbcSeedRows[i].status === 'accepted' ? 'Customer provided complete evidence package.' : null,
          adminUserId,
          procedure?.assessment_procedure_id || null
        ]
      );
      insertedPbcRows.push(inserted.rows[0]);
    }

    const workpaperSeedRows = [
      {
        title: 'DEMO-SEED: Access controls sampling narrative',
        status: 'finalized',
        objective: 'Validate role-based access reviews and privileged account governance.',
        procedurePerformed: 'Sampled 20 privileged accounts across production and staging and verified approval history.',
        conclusion: 'Design and operation are effective for sampled population.'
      },
      {
        title: 'DEMO-SEED: Vulnerability closure verification narrative',
        status: 'in_review',
        objective: 'Validate remediation evidence for critical and high-risk vulnerabilities.',
        procedurePerformed: 'Validated remediation tickets and reran targeted scans on exposed assets.',
        conclusion: 'One critical item remains pending independent validation.'
      }
    ];

    const insertedWorkpaperRows = [];
    for (let i = 0; i < workpaperSeedRows.length; i++) {
      const procedure = pickRow(procedureRows.rows, i + 1);
      const controlFallback = pickRow(fallbackControls.rows, i + 1);
      const inserted = await client.query(
        `INSERT INTO audit_workpapers (
           organization_id, engagement_id, control_id, assessment_procedure_id, title, objective, procedure_performed, conclusion,
           status, prepared_by, reviewed_by, reviewer_notes, prepared_at, reviewed_at
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8,
           $9, $10, $11, $12, NOW() - ($13::int || ' days')::interval,
           CASE WHEN $15 THEN NOW() - ($14::int || ' days')::interval ELSE NULL END
         )
         RETURNING id`,
        [
          organizationId,
          engagementId,
          procedure?.control_db_id || controlFallback?.control_db_id || null,
          procedure?.assessment_procedure_id || null,
          workpaperSeedRows[i].title,
          workpaperSeedRows[i].objective,
          workpaperSeedRows[i].procedurePerformed,
          workpaperSeedRows[i].conclusion,
          workpaperSeedRows[i].status,
          leadAuditorId,
          adminUserId,
          workpaperSeedRows[i].status === 'finalized' ? 'Reviewed and accepted by engagement owner.' : 'Pending final reviewer sign-off.',
          i + 2,
          i + 1,
          workpaperSeedRows[i].status === 'finalized'
        ]
      );
      insertedWorkpaperRows.push(inserted.rows[0]);
    }

    const findingSeedRows = [
      {
        title: 'DEMO-SEED: Privileged access exception approvals are inconsistently documented',
        severity: 'high',
        status: 'remediating',
        description: 'Sample testing identified privileged access exceptions without standardized approval evidence.',
        recommendation: 'Enforce exception workflow with mandatory dual-approval and automated evidence retention.',
        managementResponse: 'IAM team implemented workflow in ticketing system; validation scheduled this sprint.',
        dueDate: dateOffset(21)
      },
      {
        title: 'DEMO-SEED: Vulnerability remediation SLA breached for one critical item',
        severity: 'medium',
        status: 'accepted',
        description: 'One critical vulnerability exceeded target SLA due to maintenance window constraints.',
        recommendation: 'Adopt emergency patch path and weekly executive exception review for critical backlog.',
        managementResponse: 'Operations accepted risk temporarily with compensating controls; patch set for weekend maintenance.',
        dueDate: dateOffset(14)
      }
    ];

    for (let i = 0; i < findingSeedRows.length; i++) {
      const procedure = pickRow(procedureRows.rows, i + 2);
      const controlFallback = pickRow(fallbackControls.rows, i + 2);
      await client.query(
        `INSERT INTO audit_findings (
           organization_id, engagement_id, related_pbc_request_id, related_workpaper_id, control_id,
           title, description, severity, status, recommendation, management_response,
           owner_user_id, due_date, created_by
         )
         VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10, $11,
           $12, $13, $14
         )`,
        [
          organizationId,
          engagementId,
          insertedPbcRows[i]?.id || null,
          insertedWorkpaperRows[i]?.id || null,
          procedure?.control_db_id || controlFallback?.control_db_id || null,
          findingSeedRows[i].title,
          findingSeedRows[i].description,
          findingSeedRows[i].severity,
          findingSeedRows[i].status,
          findingSeedRows[i].recommendation,
          findingSeedRows[i].managementResponse,
          analystUserId,
          findingSeedRows[i].dueDate,
          adminUserId
        ]
      );
    }

    const signoffTypes = [
      {
        signoffType: 'customer_acknowledgment',
        signedBy: analystUserId,
        comments: 'Customer team reviewed evidence package and acknowledges residual risks.'
      },
      {
        signoffType: 'auditor',
        signedBy: leadAuditorId,
        comments: 'Auditor confirms procedures executed and evidence retained.'
      },
      {
        signoffType: 'company_leadership',
        signedBy: leadershipUserId,
        comments: 'Leadership accepts remediation plan and operating risk posture.'
      },
      {
        signoffType: 'auditor_firm_recommendation',
        signedBy: leadAuditorId,
        comments: 'Recommend customer proceed with quarterly control health check and monthly exception review.'
      }
    ];

    await client.query(
      `DELETE FROM audit_signoffs
       WHERE organization_id = $1
         AND engagement_id = $2
         AND signoff_type = ANY($3::text[])`,
      [organizationId, engagementId, signoffTypes.map((item) => item.signoffType)]
    );

    for (const signoff of signoffTypes) {
      await client.query(
        `INSERT INTO audit_signoffs (
           organization_id, engagement_id, signoff_type, status, comments, signed_by
         )
         VALUES ($1, $2, $3, 'approved', $4, $5)`,
        [organizationId, engagementId, signoff.signoffType, signoff.comments, signoff.signedBy]
      );
    }

    // 9) Seed default templates tied to admin profile only.
    for (const template of DEMO_TEMPLATE_DEFS) {
      await ensureTemplate(client, {
        organizationId,
        ownerUserId: adminUserId,
        artifactType: template.artifactType,
        templateName: template.templateName,
        templateContent: template.templateContent
      });
    }

    // 10) Ensure one active read-only workspace link exists.
    const existingWorkspaceLink = await client.query(
      `SELECT id
       FROM auditor_workspace_links
       WHERE organization_id = $1
         AND engagement_id = $2
         AND name = $3
       LIMIT 1`,
      [organizationId, engagementId, 'DEMO-SEED External Workspace Link']
    );

    if (existingWorkspaceLink.rows.length > 0) {
      await client.query(
        `UPDATE auditor_workspace_links
         SET active = true,
             read_only = true,
             expires_at = NOW() + INTERVAL '90 day'
         WHERE id = $1`,
        [existingWorkspaceLink.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO auditor_workspace_links (
           organization_id, engagement_id, token, name, read_only, expires_at, active, created_by
         )
         VALUES ($1, $2, $3, $4, true, NOW() + INTERVAL '90 day', true, $5)`,
        [organizationId, engagementId, token(), 'DEMO-SEED External Workspace Link', adminUserId]
      );
    }

    await client.query('COMMIT');

    console.log('Admin demo workspace seed complete.\n');
    console.log(`Organization: ${DEMO_ORG_NAME} (${organizationId})`);
    console.log(`Admin login: ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD}`);
    console.log('Additional demo users (same password):');
    console.log('  - auditor.lead@professional.com');
    console.log('  - auditor.staff@professional.com');
    console.log('  - analyst@professional.com');
    console.log('  - leadership@professional.com');
    console.log('Seeded data: onboarding-complete state, engagement, PBC, workpapers, findings, signoffs, profile-scoped templates, workspace link.\n');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Admin demo workspace seed failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedAdminDemoWorkspace().catch(() => process.exit(1));
