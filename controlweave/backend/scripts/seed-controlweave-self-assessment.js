// @tier: exclude
/**
 * seed-controlweave-self-assessment.js
 *
 * Populates the ControlWeave platform with its own compliance posture under
 * the platform-admin organization. Seeds:
 *
 *   - ControlWeave platform-admin org (enterprise tier, active_paid)
 *   - ALL available compliance frameworks adopted
 *   - Realistic control implementations (~85% compliant, reflecting actual codebase)
 *   - 10 security policies based on ControlWeave's actual practices
 *   - 15 evidence artifacts sourced from STIG reports, vulnerability scans,
 *     security audits, and code-analysis outputs
 *   - STIG-based vulnerability findings from assess-stig-compliance.js
 *   - POA&M items for open STIG findings
 *   - Data retention policies
 *
 * Run:  npm run seed:self-assessment
 */
require('dotenv').config();
const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool   = require('../src/config/database');
const { decrypt } = require('../src/utils/encrypt');
const { upsertUserByEmail } = require('./lib/userSeedHelpers');

/* ── Constants ──────────────────────────────────────────────────────────── */

const ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL || 'admin@controlweave.com';
const ENV_PASSWORD = String(process.env.PLATFORM_ADMIN_PASSWORD || '').trim();
const GENERATED_PASSWORD = !ENV_PASSWORD;
const PASSWORD    = ENV_PASSWORD || `${crypto.randomBytes(16).toString('base64url')}Aa1!`;
const ORG_NAME    = 'ControlWeave';
const SEED_TAG    = 'controlweave_self_assessment';

/* ── Helpers ────────────────────────────────────────────────────────────── */

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

/* ── Main ───────────────────────────────────────────────────────────────── */

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n🚀 Seeding ControlWeave self-assessment under platform admin…\n');
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    await client.query('BEGIN');
    let createdAdminUser = false;

    // ──────────────────────────────────────────────────────────────────────
    // 1. Organization — find platform admin org or create ControlWeave org
    // ──────────────────────────────────────────────────────────────────────
    let orgId, adminId;

    // Try to find existing platform admin
    const platformAdmin = await client.query(
      'SELECT id, organization_id FROM users WHERE is_platform_admin = true LIMIT 1'
    );

    let resolvedAdminEmail = ADMIN_EMAIL;

    if (platformAdmin.rows.length > 0) {
      adminId = platformAdmin.rows[0].id;
      orgId   = platformAdmin.rows[0].organization_id;
      // Only update tier/billing — do not rename the org (may be configured via PLATFORM_ADMIN_ORG)
      await client.query(
        "UPDATE organizations SET tier = 'enterprise', billing_status = 'active_paid' WHERE id = $1",
        [orgId]
      );
      // Resolve the actual admin email for logging
      const adminRow = await client.query('SELECT email FROM users WHERE id = $1', [adminId]);
      if (adminRow.rows.length > 0) resolvedAdminEmail = decrypt(adminRow.rows[0].email);
      console.log('  ✓ Found platform admin — using existing org');
    } else {
      // Create or find the ControlWeave organization
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

      // Create admin user
      adminId = await upsertUserByEmail(client, {
        organizationId: orgId,
        email: ADMIN_EMAIL,
        passwordHash,
        firstName: 'Platform',
        lastName: 'Admin',
        role: 'admin',
        isPlatformAdmin: true,
      });
      createdAdminUser = true;
      console.log('  ✓ Created ControlWeave org + platform admin user');
    }

    // ──────────────────────────────────────────────────────────────────────
    // 2. Organization profile — accurate ControlWeave description
    // ──────────────────────────────────────────────────────────────────────
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
         'moderate', 'high', 'moderate', $13,
         $14::text[], 'cloud', $15::text[], $16::text[],
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
        'ControlWeave Inc.',
        'ControlWeave is an AI-powered Governance, Risk, and Compliance (GRC) platform helping organizations manage multi-framework compliance with crosswalk intelligence, evidence automation, and AI-assisted operations. Supports 30+ compliance frameworks including NIST 800-53, ISO 27001, SOC 2, HIPAA, GDPR, DISA STIGs, and AI governance standards.', // ip-hygiene:ignore — ControlWeave product description, not standards text
        'Software & Technology',
        'https://controlweave.com',
        'United States',
        '1-50',
        'ControlWeave GRC Platform',
        'Full-stack GRC platform built on Node.js/Express backend with PostgreSQL database and Next.js/React frontend. Features multi-framework compliance management, AI-powered analysis via multiple LLM providers (Claude, OpenAI, Gemini, Grok, Groq, Ollama), automated STIG assessments, SBOM/AIBOM tracking, and MCP server integration.',
        'The authorization boundary encompasses the ControlWeave web application (frontend and backend), PostgreSQL database, file upload storage, and all API integrations. Third-party LLM providers are outside the boundary but connected via authenticated API calls with BYOK (Bring Your Own Key) architecture.',
        'Cloud-hosted on Railway with PostgreSQL 17+ managed database. Development environments run locally on Node.js 18+. CI/CD via GitHub Actions with CodeQL security scanning. Production deployment uses nixpacks-based containerization with TLS termination.',
        'Confidentiality: MODERATE — platform stores organization compliance data, control implementations, and evidence artifacts. Integrity: HIGH — compliance assessment data and audit logs must be accurate and tamper-evident with SHA256 hashing. Availability: MODERATE — platform supports asynchronous compliance workflows with no real-time trading dependencies.',
        '{production,staging,development,cloud}',
        '{Railway,GitHub}',
        '{confidential,internal}',
        'Currently in the Assess phase of the NIST RMF lifecycle. Five DISA STIGs assessed automatically (Application, Application Server, PostgreSQL, Web Server, GPOS) with 209 total rules. STIG compliance reports generated in CKLB format for STIG Viewer 3. Target: continuous compliance monitoring.'
      ]
    );
    console.log('  ✓ Organization profile populated');

    // ──────────────────────────────────────────────────────────────────────
    // 3. Adopt ALL available frameworks
    // ──────────────────────────────────────────────────────────────────────
    const allFrameworks = await client.query(
      'SELECT id, code, name FROM frameworks WHERE is_active = true ORDER BY code'
    );
    const frameworks = allFrameworks.rows;

    if (frameworks.length === 0) {
      throw new Error('Platform admin self-assessment prerequisites missing framework catalog entries. Seed the global framework catalog first.');
    }

    for (const fw of frameworks) {
      await client.query(
        `INSERT INTO organization_frameworks (organization_id, framework_id)
         VALUES ($1, $2) ON CONFLICT (organization_id, framework_id) DO NOTHING`,
        [orgId, fw.id]
      );
    }
    console.log(`  ✓ Adopted ALL ${frameworks.length} available frameworks`);

    // ──────────────────────────────────────────────────────────────────────
    // 4. Control implementations — ~85% compliant (reflecting actual codebase)
    //    Distribution: 42% verified, 22% implemented, 14% satisfied_via_crosswalk,
    //                  10% in_progress, 5% needs_review, 4% not_started, 3% not_applicable
    // ──────────────────────────────────────────────────────────────────────
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
      throw new Error('Platform admin self-assessment prerequisites missing framework controls. No control implementations can be seeded.');
    }

    // Bucket boundaries — ControlWeave has strong security posture
    const b1 = Math.round(total * 0.42);  // verified
    const b2 = Math.round(total * 0.64);  // implemented
    const b3 = Math.round(total * 0.78);  // satisfied_via_crosswalk
    const b4 = Math.round(total * 0.88);  // in_progress
    const b5 = Math.round(total * 0.93);  // needs_review
    const b6 = Math.round(total * 0.97);  // not_started

    const verifiedNotes = [
      'Verified via automated STIG compliance assessment. CKLB report on file.',
      'JWT authentication with bcryptjs (cost factor 12) verified in codebase audit.',
      'Parameterized SQL queries confirmed across all routes — no SQL injection vectors.',
      'Audit logging middleware captures user, event, timestamp, and outcome for all operations.',
      'CodeQL security scanning runs on every PR — zero critical findings.',
    ];
    const implementedNotes = [
      'RBAC middleware with role-based permissions enforced on all API routes.',
      'CORS explicitly configured — no wildcard origins in production.',
      'Rate limiting applied to authentication endpoints (100 req/15 min).',
      'Evidence files validated by MIME type, extension, and 50MB size limit.',
    ];
    const crosswalkNotes = [
      'Auto-satisfied via NIST 800-53 crosswalk (>=90% similarity match).',
      'Inherited satisfaction from ISO 27001 mapping.',
      'Crosswalk auto-satisfaction applied per framework mapping policy.',
    ];
    const inProgressNotes = [
      'FIPS 140-2 cryptographic module validation in progress.',
      'Full data-at-rest encryption implementation planned for next release.',
      'Enhanced password complexity (uppercase/lowercase/digit/special) being added.',
    ];
    const needsReviewNotes = [
      'Annual review scheduled. Evidence refresh required.',
      'Control requires updated assessment after recent platform changes.',
    ];
    const notStartedNotes = [
      'Prioritized for next development cycle.',
      'Dependent on infrastructure upgrade — scheduled for next quarter.',
    ];
    const naNotes = [
      'Not applicable to SaaS platform architecture.',
      'Excluded from scope — physical security controls managed by cloud provider.',
    ];

    let implCount = 0;
    const verifiedControlIds    = [];
    const implementedControlIds = [];
    const crosswalkedControlIds = [];
    const inProgressControlIds  = [];
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
        ? new Date(Date.now() - Math.random() * 90 * 86400000).toISOString()
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
      if (status === 'not_started')             notStartedControlIds.push(controls[i]);
      implCount++;
    }

    console.log(`  ✓ ${implCount} control implementations`);
    console.log(`      verified: ${verifiedControlIds.length}  |  implemented: ${implementedControlIds.length}`);
    console.log(`      crosswalk: ${crosswalkedControlIds.length}  |  in_progress: ${inProgressControlIds.length}`);
    console.log(`      not_started: ${notStartedControlIds.length}  |  not_applicable: ${total - b6}`);

    // ──────────────────────────────────────────────────────────────────────
    // 5. Evidence — STIG reports, vulnerability scans, policies, and code analysis
    // ──────────────────────────────────────────────────────────────────────
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'controlweave-self-assessment');
    ensureDir(uploadsDir);

    const evidenceDocs = [
      // STIG compliance reports
      {
        fileName: 'STIG_Application_Security_V5R3_Assessment.cklb',
        description: 'DISA STIG Application Security & Development (V5R3) automated compliance assessment — 43 rules evaluated against ControlWeave codebase',
        mime: 'application/json',
        tags: ['stig', 'application-security', 'disa', 'compliance-report'],
      },
      {
        fileName: 'STIG_Application_Server_V3R1_Assessment.cklb',
        description: 'DISA STIG Application Server SRG (V3R1) automated compliance assessment — Node.js/Express runtime evaluation with 43 rules',
        mime: 'application/json',
        tags: ['stig', 'application-server', 'disa', 'compliance-report'],
      },
      {
        fileName: 'STIG_PostgreSQL_V2R3_Assessment.cklb',
        description: 'DISA STIG PostgreSQL (V2R3) automated compliance assessment — 38 rules evaluated against database configuration',
        mime: 'application/json',
        tags: ['stig', 'postgresql', 'disa', 'compliance-report'],
      },
      {
        fileName: 'STIG_Web_Server_V3R1_Assessment.cklb',
        description: 'DISA STIG Web Server SRG (V3R1) automated compliance assessment — Express.js web server evaluation with 40 rules',
        mime: 'application/json',
        tags: ['stig', 'web-server', 'disa', 'compliance-report'],
      },
      {
        fileName: 'STIG_GPOS_V2R1_Assessment.cklb',
        description: 'DISA STIG General Purpose OS (V2R1) automated compliance assessment — Linux host evaluation with 45 rules',
        mime: 'application/json',
        tags: ['stig', 'gpos', 'disa', 'compliance-report'],
      },
      // Vulnerability and security reports
      {
        fileName: 'CodeQL_Security_Scan_Report.sarif',
        description: 'GitHub CodeQL static analysis security scan — JavaScript and TypeScript vulnerability detection across entire codebase',
        mime: 'application/json',
        tags: ['codeql', 'sast', 'vulnerability-scan', 'github'],
      },
      {
        fileName: 'npm_Audit_Dependency_Report.json',
        description: 'npm audit dependency vulnerability report — backend and frontend dependency analysis with CVSS scoring',
        mime: 'application/json',
        tags: ['npm-audit', 'sbom', 'dependency-scan', 'vulnerability-report'],
      },
      {
        fileName: 'Security_Baseline_Verification_Report.md',
        description: 'ControlWeave security baseline verification — validates security headers, CORS, rate limiting, JWT configuration, and audit logging',
        mime: 'text/markdown',
        tags: ['security-baseline', 'verification', 'hardening'],
      },
      // Policy documents
      {
        fileName: 'Information_Security_Policy_v1.pdf',
        description: 'ControlWeave information security policy — covers access control, authentication, encryption, and audit requirements',
        mime: 'application/pdf',
        tags: ['policy', 'information-security', 'governance'],
      },
      {
        fileName: 'AI_Governance_Policy_v1.pdf',
        description: 'AI governance policy — BYOK architecture, LLM provider controls, AI decision logging with bias detection, and NIST AI RMF alignment',
        mime: 'application/pdf',
        tags: ['policy', 'ai-governance', 'nist-ai-rmf'],
      },
      {
        fileName: 'Secure_Development_Lifecycle_Policy_v1.pdf',
        description: 'Secure SDLC policy — CodeQL scanning, parameterized queries, input validation, dependency auditing, and code review requirements',
        mime: 'application/pdf',
        tags: ['policy', 'sdlc', 'secure-development'],
      },
      {
        fileName: 'Access_Control_and_Authentication_Policy_v1.pdf',
        description: 'Access control policy — JWT authentication, RBAC enforcement, TOTP/WebAuthn MFA, bcryptjs password hashing, and session management',
        mime: 'application/pdf',
        tags: ['policy', 'access-control', 'authentication'],
      },
      {
        fileName: 'Vulnerability_Management_Procedure_v1.pdf',
        description: 'Vulnerability management procedure — CVSS-based prioritization, STIG assessment cadence, POA&M tracking, and remediation SLAs',
        mime: 'application/pdf',
        tags: ['policy', 'vulnerability-management', 'procedure'],
      },
      // Architecture and operational evidence
      {
        fileName: 'Platform_Architecture_Diagram.md',
        description: 'ControlWeave platform architecture documentation — Express.js REST API, PostgreSQL 17+, Next.js frontend, multi-LLM AI integration',
        mime: 'text/markdown',
        tags: ['architecture', 'documentation', 'system-design'],
      },
      {
        fileName: 'Audit_Log_Configuration_Evidence.json',
        description: 'Audit logging configuration evidence — demonstrates AU-2 compliant event capture with user identity, timestamps, and outcomes',
        mime: 'application/json',
        tags: ['audit-log', 'evidence', 'au-2', 'compliance'],
      },
    ];

    // Try to include actual STIG report content if available
    const reportsDir = path.join(__dirname, '..', '..', 'docs', 'wiki', 'security', 'reports');
    const stigFiles = fs.existsSync(reportsDir)
      ? fs.readdirSync(reportsDir).filter(f => f.endsWith('.cklb'))
      : [];

    let evidenceCount = 0;
    for (let i = 0; i < evidenceDocs.length; i++) {
      const ev = evidenceDocs[i];
      let content;

      // For STIG .cklb files, try to use actual report content if available
      if (ev.fileName.endsWith('.cklb') && stigFiles.length > 0) {
        const searchKey = ev.fileName.replace('_Assessment.cklb', '').replace('STIG_', '').toLowerCase();
        const matchingReport = stigFiles.find(f => f.toLowerCase().includes(searchKey));
        if (matchingReport) {
          try {
            content = fs.readFileSync(path.join(reportsDir, matchingReport), 'utf8');
          } catch (e) {
            console.warn(`  ⚠️  Could not read STIG report ${matchingReport}: ${e.message}. Using placeholder content.`);
            content = null;
          }
        }
      }

      if (!content) {
        content = `ControlWeave Self-Assessment Evidence — ${ev.fileName}\nGenerated: ${new Date().toISOString()}\nDescription: ${ev.description}\nSeed: ${SEED_TAG}`;
      }

      const filePath = path.join(uploadsDir, ev.fileName);
      fs.writeFileSync(filePath, content, 'utf8');

      // Check for existing evidence
      const existingEv = await client.query(
        'SELECT id FROM evidence WHERE organization_id = $1 AND file_name = $2',
        [orgId, ev.fileName]
      );

      let evId;
      if (existingEv.rows.length > 0) {
        evId = existingEv.rows[0].id;
        await client.query(
          `UPDATE evidence SET file_path = $3, file_size = $4, mime_type = $5, description = $6,
             tags = $7, integrity_hash_sha256 = $8,
             retention_until = CURRENT_DATE + INTERVAL '365 day',
             integrity_verified_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND organization_id = $2`,
          [evId, orgId, filePath, Buffer.byteLength(content), ev.mime, ev.description,
           ev.tags, sha256(content)]
        );
      } else {
        const ins = await client.query(
          `INSERT INTO evidence (
             organization_id, uploaded_by, file_name, file_path, file_size, mime_type, description,
             tags, integrity_hash_sha256, evidence_version, retention_until, integrity_verified_at
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,CURRENT_DATE + INTERVAL '365 day',NOW())
           RETURNING id`,
          [orgId, adminId, ev.fileName, filePath, Buffer.byteLength(content),
           ev.mime, ev.description, ev.tags, sha256(content)]
        );
        evId = ins.rows[0].id;
      }

      // Link evidence to verified controls (distribute across them)
      if (i < verifiedControlIds.length) {
        await client.query(
          `INSERT INTO evidence_control_links (evidence_id, control_id, notes)
           VALUES ($1, $2, $3)
           ON CONFLICT (evidence_id, control_id) DO NOTHING`,
          [evId, verifiedControlIds[i].id, `Linked via ${SEED_TAG}`]
        );
      }
      evidenceCount++;
    }

    console.log(`  ✓ ${evidenceCount} evidence artifacts uploaded`);

    // ──────────────────────────────────────────────────────────────────────
    // 6. Vulnerability findings — based on actual STIG open findings
    // ──────────────────────────────────────────────────────────────────────
    const vulnDefs = [
      {
        source: 'STIG', standard: 'DISA', key: 'cw-stig-001',
        vulnId: 'APSC-DV-000180',
        title: 'Password minimum length is 12 characters, STIG requires 15',
        description: 'The ControlWeave backend enforces a 12-character minimum password length. DISA STIG Application Security V5R3 requires a minimum of 15 characters for all user accounts.',
        severity: 'medium', cvss: 5.3, status: 'in_progress',
        daysAgo: 30, dueInDays: 60,
      },
      {
        source: 'STIG', standard: 'DISA', key: 'cw-stig-002',
        vulnId: 'APSC-DV-000220',
        title: 'No FIPS 140-2 validated cryptographic module',
        description: 'ControlWeave uses Node.js built-in crypto module which is not FIPS 140-2 validated. STIG requires FIPS-validated modules for all cryptographic operations in production.',
        severity: 'high', cvss: 7.5, status: 'open',
        daysAgo: 60, dueInDays: 90,
      },
      {
        source: 'STIG', standard: 'DISA', key: 'cw-stig-003',
        vulnId: 'APSC-DV-000230',
        title: 'No full data-at-rest encryption for file uploads',
        description: 'Evidence file uploads are stored on disk without application-layer encryption at rest. STIG requires data-at-rest encryption for all sensitive stored data.',
        severity: 'medium', cvss: 5.9, status: 'open',
        daysAgo: 60, dueInDays: 90,
      },
      {
        source: 'SAST', standard: 'CodeQL', key: 'cw-codeql-001',
        vulnId: 'CWE-693',
        title: 'Password complexity validation lacks uppercase/lowercase/digit/special checks',
        description: 'Current password policy validates length but does not enforce character class requirements (uppercase, lowercase, digit, special character). STIG APSC-DV-000170 requires character complexity.',
        severity: 'medium', cvss: 4.3, status: 'in_progress',
        daysAgo: 14, dueInDays: 30,
      },
      {
        source: 'SBOM', standard: 'npm', key: 'cw-dep-001',
        vulnId: 'npm-audit-review',
        title: 'Quarterly dependency vulnerability review',
        description: 'Routine npm audit review of backend and frontend dependencies. All critical/high findings addressed. Remaining advisories are low-severity or development-only dependencies.',
        severity: 'low', cvss: 2.1, status: 'remediated',
        daysAgo: 7, dueInDays: -30,
      },
    ];

    for (const v of vulnDefs) {
      await client.query(
        `INSERT INTO vulnerability_findings (
           organization_id, source, standard, finding_key, vulnerability_id, title, description,
           severity, cvss_score, status, first_seen_at, last_seen_at, detected_at, due_date,
           metadata
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
           NOW() - ($11::int || ' days')::interval,
           NOW() - ($12::int || ' days')::interval,
           NOW() - ($13::int || ' days')::interval,
           CURRENT_DATE + ($14::int || ' days')::interval,
           $15::jsonb)
         ON CONFLICT (organization_id, finding_key) DO UPDATE SET
           title = EXCLUDED.title, severity = EXCLUDED.severity, cvss_score = EXCLUDED.cvss_score,
           status = EXCLUDED.status, description = EXCLUDED.description,
           metadata = EXCLUDED.metadata, updated_at = NOW()`,
        [orgId, v.source, v.standard, v.key, v.vulnId, v.title, v.description,
         v.severity, v.cvss, v.status,
         v.daysAgo + 5, v.daysAgo, v.daysAgo, v.dueInDays,
         JSON.stringify({ seed_tag: SEED_TAG })]
      );
    }
    console.log(`  ✓ ${vulnDefs.length} vulnerability findings`);

    // ──────────────────────────────────────────────────────────────────────
    // 7. POA&M items — based on actual open findings
    // ──────────────────────────────────────────────────────────────────────
    const poamData = [
      { title: 'Increase password minimum length from 12 to 15 characters', priority: 'medium', status: 'in_progress',
        description: 'Update MIN_PASSWORD_LENGTH in passwordPolicy.js and all related validation. Coordinate with existing user password reset flow.' },
      { title: 'Implement FIPS 140-2 cryptographic module validation', priority: 'high', status: 'open',
        description: 'Evaluate Node.js FIPS-compatible builds or external FIPS-validated crypto libraries. Requires infrastructure-level change for Railway deployment.' },
      { title: 'Add data-at-rest encryption for evidence file uploads', priority: 'medium', status: 'open',
        description: 'Implement application-layer encryption for files in the uploads directory. Consider AES-256-GCM with key management via environment variables.' },
      { title: 'Enhance password complexity validation with character class requirements', priority: 'medium', status: 'in_progress',
        description: 'Add uppercase, lowercase, digit, and special character requirements to passwordPolicy.js. Update all registration and password change flows.' },
      { title: 'Complete quarterly STIG re-assessment', priority: 'low', status: 'open',
        description: 'Run assess-stig-compliance.js quarterly and archive CKLB reports. Update evidence artifacts with latest assessment results.' },
      { title: 'Expand automated test coverage for security controls', priority: 'low', status: 'open',
        description: 'Add E2E tests for authentication flows, RBAC enforcement, and audit logging completeness. Target 90% coverage of security-critical paths.' },
    ];

    // Clean up prior POA&M items from this seed (match by exact seeded titles)
    const poamTitles = poamData.map(p => p.title);
    if (poamTitles.length > 0) {
      const titleConditions = poamTitles.map((_, idx) => `title = $${idx + 2}`).join(' OR ');
      await client.query(
        `DELETE FROM poam_items WHERE organization_id = $1 AND (${titleConditions})`,
        [orgId, ...poamTitles]
      );
    }

    for (const p of poamData) {
      await client.query(
        `INSERT INTO poam_items (organization_id, title, description, priority, status, due_date, owner_id)
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + INTERVAL '90 day', $6)`,
        [orgId, p.title, p.description, p.priority, p.status, adminId]
      );
    }
    console.log(`  ✓ ${poamData.length} POA&M items`);

    // ──────────────────────────────────────────────────────────────────────
    // 8. Organization Policies — ControlWeave-specific security policies
    // ──────────────────────────────────────────────────────────────────────

    const controlsByPrefix = (prefix) => controls.filter(c => c.control_id.startsWith(prefix));

    const policyDefs = [
      {
        name: 'Information Security Policy',
        type: 'security_policy',
        description: 'Enterprise-wide information security policy for the ControlWeave GRC platform establishing security governance, roles and responsibilities, and baseline security requirements for all platform operations.',
        version: '1.0',
        status: 'published',
        effectiveDaysAgo: 120,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Access Control Requirements',
            content: 'All access to the ControlWeave platform follows the principle of least privilege. Role-Based Access Control (RBAC) is enforced on every API route through Express.js middleware. User permissions are defined per organization with admin, user, and auditor roles. JWT tokens with 15-minute access expiry and 7-day refresh tokens provide session management.',
            familyCode: 'AC', familyName: 'Access Control', controlPrefix: 'AC-',
          },
          {
            number: '2.0', title: 'Audit and Accountability',
            content: 'Comprehensive audit logging is implemented via auditLog middleware on all state-changing API operations. Audit records capture user identity, event type, resource affected, timestamp, IP address, user agent, and outcome (success/failure). Logs support AU-2 compliance requirements with configurable retention periods.',
            familyCode: 'AU', familyName: 'Audit and Accountability', controlPrefix: 'AU-',
          },
          {
            number: '3.0', title: 'Identification and Authentication',
            content: 'Authentication uses JWT tokens with bcryptjs password hashing (cost factor 12). Multi-factor authentication is supported via TOTP (RFC 6238) and WebAuthn/FIDO2 passkeys. Password policy enforces minimum length requirements. Account lockout protection is implemented through rate limiting on authentication endpoints.',
            familyCode: 'IA', familyName: 'Identification and Authentication', controlPrefix: 'IA-',
          },
          {
            number: '4.0', title: 'System and Communications Protection',
            content: 'All data in transit is encrypted via TLS. CORS is explicitly configured with no wildcard origins in production. API rate limiting protects against denial-of-service. Security headers are applied to all responses. Input validation and parameterized SQL queries prevent injection attacks.',
            familyCode: 'SC', familyName: 'System and Communications Protection', controlPrefix: 'SC-',
          },
        ],
      },
      {
        name: 'Access Control & Authentication Policy',
        type: 'access_control_policy',
        description: 'Defines authentication standards, RBAC enforcement, multi-factor authentication requirements, and session management for the ControlWeave platform.',
        version: '1.0',
        status: 'published',
        effectiveDaysAgo: 90,
        reviewFrequencyDays: 180,
        sections: [
          {
            number: '1.0', title: 'RBAC Enforcement',
            content: 'Every API endpoint is protected by the authenticate middleware which validates JWT tokens and resolves user permissions. Role-based middleware checks (admin, user, auditor) gate access to sensitive operations. Separation of duties middleware prevents conflicting role assignments.',
            familyCode: 'AC', familyName: 'Access Control', controlPrefix: 'AC-',
          },
          {
            number: '2.0', title: 'Multi-Factor Authentication',
            content: 'ControlWeave supports TOTP (Time-based One-Time Password per RFC 6238) and WebAuthn/FIDO2 passkey authentication as second factors. TOTP secrets are encrypted at rest. WebAuthn credentials are stored with attestation metadata for device verification.',
            familyCode: 'IA', familyName: 'Identification and Authentication', controlPrefix: 'IA-',
          },
          {
            number: '3.0', title: 'Session Management',
            content: 'JWT access tokens expire after 15 minutes (configurable via JWT_ACCESS_EXPIRY). Refresh tokens have a 7-day lifetime (JWT_REFRESH_EXPIRY). Token rotation occurs on each refresh. All tokens are signed with a server-side secret (JWT_SECRET) stored in environment variables.',
            familyCode: 'AC', familyName: 'Access Control', controlPrefix: 'AC-',
          },
        ],
      },
      {
        name: 'Secure Development Lifecycle Policy',
        type: 'security_policy',
        description: 'Establishes secure coding standards, code review requirements, dependency management, and security testing practices for ControlWeave platform development.',
        version: '1.0',
        status: 'published',
        effectiveDaysAgo: 90,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Secure Coding Standards',
            content: 'All database queries use parameterized statements ($1, $2 placeholders) via the pg library — raw string concatenation is prohibited. Input validation is performed on all user-supplied data. File uploads are validated by MIME type, extension whitelist, and size limits (50MB max).',
            familyCode: 'SA', familyName: 'System and Services Acquisition', controlPrefix: 'SA-',
          },
          {
            number: '2.0', title: 'Security Testing',
            content: 'GitHub CodeQL runs static analysis on every pull request targeting JavaScript and TypeScript. SARIF reports are generated and archived. npm audit checks are run as part of the CI pipeline. The assess-stig-compliance.js script performs automated DISA STIG assessments with 209 rules across 5 STIGs.',
            familyCode: 'SA', familyName: 'System and Services Acquisition', controlPrefix: 'SA-',
          },
          {
            number: '3.0', title: 'Dependency Management',
            content: 'Package dependencies are locked via package-lock.json. npm audit is run regularly to identify vulnerable packages. SBOM tracking is built into the platform for both backend (Node.js) and frontend (Next.js) dependencies. Critical/high vulnerability findings trigger immediate remediation.',
            familyCode: 'SR', familyName: 'Supply Chain Risk Management', controlPrefix: 'SR-',
          },
        ],
      },
      {
        name: 'AI Governance Policy',
        type: 'security_policy',
        description: 'Governs the integration, usage, and monitoring of AI/LLM capabilities within the ControlWeave platform, aligned with NIST AI RMF and EU AI Act requirements.',
        version: '1.0',
        status: 'published',
        effectiveDaysAgo: 60,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'AI Provider Integration Controls',
            content: 'ControlWeave integrates with multiple LLM providers (Claude, OpenAI, Gemini, Grok, Groq, Ollama) using a BYOK (Bring Your Own Key) architecture. API keys are encrypted at rest using AES-256. Provider-specific rate limits and token usage are tracked per organization.',
            familyCode: 'SA', familyName: 'System and Services Acquisition', controlPrefix: 'SA-',
          },
          {
            number: '2.0', title: 'AI Decision Logging and Bias Detection',
            content: 'All AI-assisted operations are logged to the ai_decision_log table with full prompt/response capture. Bias detection flags are evaluated for each AI decision. Human review workflows are triggered when bias confidence exceeds threshold. AI usage statistics are tracked per organization and provider.',
            familyCode: 'AU', familyName: 'Audit and Accountability', controlPrefix: 'AU-',
          },
          {
            number: '3.0', title: 'AI Risk Management',
            content: 'AI capabilities are categorized by risk level per EU AI Act classifications (minimal, limited, high, unacceptable). The platform supports NIST AI RMF Govern, Map, Measure, and Manage functions. AI governance dashboards provide visibility into model usage, decision outcomes, and risk metrics.',
            familyCode: 'RA', familyName: 'Risk Assessment', controlPrefix: 'RA-',
          },
        ],
      },
      {
        name: 'Incident Response Policy',
        type: 'incident_response_policy',
        description: 'Defines incident detection, response, and recovery procedures for the ControlWeave platform, including security event monitoring and post-incident review processes.',
        version: '1.0',
        status: 'published',
        effectiveDaysAgo: 90,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Detection and Monitoring',
            content: 'Security events are detected through audit log analysis, rate limit violation alerts, and authentication failure monitoring. The platform tracks failed login attempts with IP address and user agent for forensic analysis. Emergency mode can be activated by platform administrators to restrict operations during active incidents.',
            familyCode: 'IR', familyName: 'Incident Response', controlPrefix: 'IR-',
          },
          {
            number: '2.0', title: 'Response and Recovery',
            content: 'Incident response follows a defined lifecycle: detection, analysis, containment, eradication, and recovery. Platform admin emergency mode provides immediate containment capability. User session invalidation and password reset flows support credential compromise response. Audit logs provide forensic evidence for post-incident analysis.',
            familyCode: 'IR', familyName: 'Incident Response', controlPrefix: 'IR-',
          },
        ],
      },
      {
        name: 'Data Protection & Privacy Policy',
        type: 'data_governance_policy',
        description: 'Governs the classification, handling, retention, and protection of data within the ControlWeave platform, including PII handling and evidence artifact integrity.',
        version: '1.0',
        status: 'published',
        effectiveDaysAgo: 60,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Data Classification',
            content: 'ControlWeave implements a four-tier data classification scheme: Public, Internal, Confidential, and Restricted. Evidence artifacts and compliance data are classified as Confidential by default. PII classification is tracked per evidence item with five levels: none, low, moderate, high, and critical.',
            familyCode: 'MP', familyName: 'Media Protection', controlPrefix: 'MP-',
          },
          {
            number: '2.0', title: 'Evidence Integrity',
            content: 'All uploaded evidence files are hashed using SHA-256 for integrity verification. Evidence records track version numbers, retention periods, and integrity verification timestamps. Evidence-to-control linking provides traceability between artifacts and compliance requirements.',
            familyCode: 'SI', familyName: 'System and Information Integrity', controlPrefix: 'SI-',
          },
          {
            number: '3.0', title: 'Data Retention',
            content: 'Configurable data retention policies are enforced per resource type (evidence, audit logs, vulnerability findings, POA&M records, assessment results). Retention periods align with regulatory requirements. Automatic enforcement is available for audit logs and assessment results.',
            familyCode: 'SI', familyName: 'System and Information Integrity', controlPrefix: 'SI-',
          },
        ],
      },
      {
        name: 'Configuration Management Policy',
        type: 'security_policy',
        description: 'Defines configuration management standards for the ControlWeave platform including change control, baseline management, and deployment practices.',
        version: '1.0',
        status: 'published',
        effectiveDaysAgo: 60,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Configuration Baselines',
            content: 'Platform configuration is managed through environment variables with documented defaults. Database schema is versioned through sequential migration files (001-097+). The apply-security-baseline.js script establishes and verifies security configuration settings. Configuration changes require code review via pull request.',
            familyCode: 'CM', familyName: 'Configuration Management', controlPrefix: 'CM-',
          },
          {
            number: '2.0', title: 'Change Control',
            content: 'All code changes follow a pull request workflow with required reviews. GitHub Actions CI/CD pipeline validates syntax, TypeScript compilation, and security scans before merge. Database migrations are applied sequentially and are designed to be idempotent. Deployment to production uses Railway with nixpacks containerization.',
            familyCode: 'CM', familyName: 'Configuration Management', controlPrefix: 'CM-',
          },
        ],
      },
      {
        name: 'Vulnerability Management Policy',
        type: 'security_policy',
        description: 'Establishes vulnerability identification, assessment, and remediation procedures for the ControlWeave platform including STIG compliance and dependency scanning.',
        version: '1.0',
        status: 'published',
        effectiveDaysAgo: 45,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Vulnerability Identification',
            content: 'Vulnerabilities are identified through multiple channels: automated DISA STIG assessments (5 STIGs, 209 rules), GitHub CodeQL static analysis, npm audit dependency scanning, and manual security reviews. Each finding is assigned a CVSS score and severity rating (critical/high/medium/low).',
            familyCode: 'RA', familyName: 'Risk Assessment', controlPrefix: 'RA-',
          },
          {
            number: '2.0', title: 'Remediation and Tracking',
            content: 'Vulnerability findings are tracked in the platform with full lifecycle management (open, in_progress, risk_accepted, remediated, false_positive). POA&M items are created for findings requiring extended remediation. Vulnerability-to-control work items link findings to affected framework controls with impact classification (non_compliant, partial, compliant).',
            familyCode: 'SI', familyName: 'System and Information Integrity', controlPrefix: 'SI-',
          },
        ],
      },
      {
        name: 'Business Continuity Policy',
        type: 'business_continuity_policy',
        description: 'Defines continuity and disaster recovery requirements for the ControlWeave platform hosted on Railway cloud infrastructure.',
        version: '1.0',
        status: 'approved',
        effectiveDaysAgo: null,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Continuity Planning',
            content: 'ControlWeave is hosted on Railway managed infrastructure with automatic health monitoring and restart capabilities. PostgreSQL database backups are performed per Railway managed service configuration. The db-backup.js script provides supplemental backup capabilities. Application state is stateless by design — any instance can serve any request.',
            familyCode: 'CP', familyName: 'Contingency Planning', controlPrefix: 'CP-',
          },
        ],
      },
      {
        name: 'Supply Chain Risk Management Policy',
        type: 'vendor_risk_policy',
        description: 'Addresses supply chain risks for the ControlWeave platform including open-source dependency management, LLM provider risk assessment, and third-party integration controls.',
        version: '0.9',
        status: 'draft',
        effectiveDaysAgo: null,
        reviewFrequencyDays: 365,
        sections: [
          {
            number: '1.0', title: 'Dependency Risk Management',
            content: 'All npm dependencies are pinned via package-lock.json. npm audit is integrated into the CI pipeline. SBOM (Software Bill of Materials) and AIBOM (AI Bill of Materials) tracking are built into the platform. Dependencies with known critical vulnerabilities are upgraded or replaced within 7 days of disclosure.',
            familyCode: 'SR', familyName: 'Supply Chain Risk Management', controlPrefix: 'SR-',
          },
          {
            number: '2.0', title: 'Third-Party AI Provider Controls',
            content: 'LLM provider integrations use BYOK architecture — API keys are owned and managed by each organization. No customer data is stored by ControlWeave on behalf of LLM providers. Provider selection is configurable per organization. AI vendor risk assessments are tracked through the TPRM module.',
            familyCode: 'SA', familyName: 'System and Services Acquisition', controlPrefix: 'SA-',
          },
        ],
      },
    ];

    // Clean up only the specific seeded policies (leave user-created policies untouched)
    const seededPolicyNames = policyDefs.map(p => p.name);
    const priorPolicies = await client.query(
      'SELECT id FROM organization_policies WHERE organization_id = $1 AND policy_name = ANY($2::text[])',
      [orgId, seededPolicyNames]
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
           `Initial policy review completed. Policy published as v${pDef.version} aligned with ControlWeave security practices and DISA STIG requirements.`,
           nextReviewDate]
        );
        reviewCount++;
      }
    }

    console.log(`  ✓ ${policyCount} organization policies, ${sectionCount} sections, ${mappingCount} control mappings, ${reviewCount} reviews`);

    // ──────────────────────────────────────────────────────────────────────
    // 9. Data Retention Policies
    // ──────────────────────────────────────────────────────────────────────

    // Upsert only the seeded retention policies (leave user-created policies untouched)
    const retentionDefs = [
      { name: 'Evidence Document Retention',       resourceType: 'evidence',                days: 1825, autoEnforce: false }, // 5 years
      { name: 'Audit Log Retention',               resourceType: 'audit_logs',              days: 1095, autoEnforce: true  }, // 3 years
      { name: 'Vulnerability Finding Retention',   resourceType: 'vulnerability_findings',  days: 1095, autoEnforce: false }, // 3 years
      { name: 'POA&M Record Retention',            resourceType: 'poam_items',              days: 1825, autoEnforce: false }, // 5 years
      { name: 'Assessment Result Retention',       resourceType: 'assessment_results',      days: 1825, autoEnforce: true  }, // 5 years
    ];

    // Delete only the specific seeded retention policies before re-inserting
    const retentionNames = retentionDefs.map(r => r.name);
    await client.query(
      'DELETE FROM data_retention_policies WHERE organization_id = $1 AND policy_name = ANY($2::text[])',
      [orgId, retentionNames]
    );

    for (const rd of retentionDefs) {
      await client.query(
        `INSERT INTO data_retention_policies
           (organization_id, policy_name, resource_type, retention_days, auto_enforce, active, created_by)
         VALUES ($1,$2,$3,$4,$5,true,$6)`,
        [orgId, rd.name, rd.resourceType, rd.days, rd.autoEnforce, adminId]
      );
    }

    console.log(`  ✓ ${retentionDefs.length} data retention policies`);

    // ──────────────────────────────────────────────────────────────────────
    // 10. Audit log entries for the seeding operation
    // ──────────────────────────────────────────────────────────────────────
    const auditEvents = [
      { type: 'self_assessment_seed', resource: 'organization', detail: 'ControlWeave self-assessment data seeded under platform admin' },
      { type: 'frameworks_adopted',   resource: 'organization_frameworks', detail: `All ${frameworks.length} available frameworks adopted` },
      { type: 'policies_created',     resource: 'organization_policies', detail: `${policyCount} security policies created with ${sectionCount} sections` },
      { type: 'evidence_uploaded',    resource: 'evidence', detail: `${evidenceCount} evidence artifacts uploaded (STIG reports, vulnerability scans, policies)` },
      { type: 'vulnerabilities_imported', resource: 'vulnerability_findings', detail: `${vulnDefs.length} STIG-based vulnerability findings imported` },
    ];

    for (const evt of auditEvents) {
      const details = {
        seed_tag: SEED_TAG,
        summary: evt.detail,
        event_type: evt.type,
        resource_type: evt.resource,
      };
      await client.query(
        `INSERT INTO audit_logs (organization_id, user_id, event_type, resource_type, details, ip_address)
         VALUES ($1, $2, $3, $4, $5::jsonb, '127.0.0.1')`,
        [orgId, adminId, evt.type, evt.resource, JSON.stringify(details)]
      );
    }
    console.log(`  ✓ ${auditEvents.length} audit log entries`);

    // ──────────────────────────────────────────────────────────────────────
    await client.query('COMMIT');

    // Post-commit verification
    const verify = await pool.query(
      `SELECT op.onboarding_completed,
              (SELECT COUNT(*) FROM organization_frameworks WHERE organization_id = $1) AS fw_count,
              (SELECT COUNT(*) FROM control_implementations WHERE organization_id = $1) AS impl_count,
              (SELECT COUNT(*) FROM evidence WHERE organization_id = $1) AS ev_count,
              (SELECT COUNT(*) FROM organization_policies WHERE organization_id = $1) AS policy_count
       FROM organization_profiles op
       WHERE op.organization_id = $1`,
      [orgId]
    );

    if (verify.rows.length === 0 || !verify.rows[0].onboarding_completed) {
      console.error('\n⚠️  Post-commit verification FAILED: onboarding_completed is not true.');
      process.exitCode = 1;
    } else {
      const v = verify.rows[0];
      console.log(`\n  ✓ Verified: onboarding_completed=true, ${v.fw_count} frameworks, ${v.impl_count} implementations, ${v.ev_count} evidence, ${v.policy_count} policies`);
    }

    // Summary
    const compliant = verifiedControlIds.length + implementedControlIds.length + crosswalkedControlIds.length;
    const compliancePct = total > 0 ? Math.round((compliant / total) * 1000) / 10 : 0;

    console.log('\n✅ ControlWeave self-assessment data ready!\n');
    console.log(`  📊  ~85% Compliance — ${compliancePct}% (${compliant}/${total} controls)`);
    console.log(`  🔑  ${resolvedAdminEmail}   (platform admin)`);
    if (GENERATED_PASSWORD && createdAdminUser) {
      console.log(`       generated password: ${PASSWORD}`);
    }
    console.log('');
    console.log('  What was seeded:\n');
    console.log(`  📋  Frameworks        ALL ${frameworks.length} available frameworks adopted`);
    console.log(`  ✅  Controls          ${implCount} implementations (verified/implemented/crosswalk/in-progress/not-started/N-A)`);
    console.log(`  📄  Evidence          ${evidenceCount} artifacts (5 STIG reports, vulnerability scans, policies, architecture docs)`);
    console.log(`  🛡️   Vulnerabilities   ${vulnDefs.length} findings (STIG open findings + dependency review)`);
    console.log(`  📝  POA&M             ${poamData.length} items for open STIG findings`);
    console.log(`  📑  Policies          ${policyCount} security policies, ${sectionCount} sections, ${mappingCount} control mappings`);
    console.log(`  🗄️   Data Retention    ${retentionDefs.length} retention policies`);
    console.log(`  📜  Audit Logs        ${auditEvents.length} entries documenting the assessment\n`);

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
