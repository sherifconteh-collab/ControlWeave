/**
 * Seed Assessment Procedures - Rich Baseline (All Frameworks)
 *
 * Ensures each framework control has a richer recommended baseline of procedures:
 *  - examine (document review)
 *  - interview (personnel interview)
 *  - verification (test or inspection)
 *
 * Non-destructive: inserts only missing types per framework_control.
 * Skips AI governance frameworks already handled by seed-assessment-procedures-ai-governance.js.
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

const SKIP_FRAMEWORK_CODES = new Set(['nist_ai_rmf', 'iso_42001', 'iso_42005', 'eu_ai_act']);

const DEFAULT_FREQUENCY = 'At least annually and after significant changes.';

const FOCUS_GUIDANCE = {
  vulnerability: {
    evidence: [
      'Vulnerability scanning artifacts and analysis outputs (scanner reports, SBOM review, secure code scans, configuration baselines).',
      'Remediation backlog with owner, target date, risk rationale, and status.',
      'Closure evidence for remediated items (change ticket, patch/config proof, follow-up validation).'
    ],
    notes: 'If findings remain open, capture compensating controls and a time-bound remediation plan.'
  },
  access: {
    evidence: [
      'Access policy and role/entitlement matrix mapped to business need.',
      'Approvals for provisioning, privilege elevation, and periodic access reviews.',
      'Operational logs or reports that demonstrate enforcement and monitoring.'
    ],
    notes: 'Sample both standard and privileged accounts to verify least-privilege behavior.'
  },
  incident: {
    evidence: [
      'Incident response process with severity definitions and escalation rules.',
      'Recent incident records with timeline, decisions, containment, and recovery steps.',
      'After-action outputs with corrective actions tracked to closure.'
    ],
    notes: 'Validate at least one recent event from detection through closure.'
  },
  asset: {
    evidence: [
      'Current inventory of in-scope assets/services/dependencies.',
      'Configuration baseline or hardening standard aligned to the objective.',
      'Periodic review records showing inventory/baseline accuracy.'
    ],
    notes: 'Sample assets from different environments to confirm consistency.'
  },
  thirdParty: {
    evidence: [
      'Third-party risk criteria and due diligence records for in-scope providers.',
      'Contract clauses/security addenda supporting the control objective.',
      'Ongoing monitoring results and issue tracking for supplier findings.'
    ],
    notes: 'Confirm the organization can enforce and evidence supplier obligations.'
  },
  privacy: {
    evidence: [
      'Data processing records (purpose, legal basis, retention expectations) and data inventories.',
      'Policy/notice artifacts demonstrating transparency obligations.',
      'Operational records for rights requests, exceptions, and approvals.'
    ],
    notes: 'Sample at least one processing activity from governance through execution evidence.'
  },
  ai: {
    evidence: [
      'AI governance artifacts (inventory/model registry, risk register, accountability roles, decision logs).',
      'Lifecycle evidence (data controls, evaluation/testing results, monitoring criteria and outputs).',
      'Issue tracking and remediation for performance, fairness, security, or reliability concerns.'
    ],
    notes: 'Validate both governance-level and model-operations evidence for at least one in-scope AI system.'
  },
  general: {
    evidence: [
      'Policy/standard defining requirements and ownership.',
      'Implementation records showing the control is configured and operating.',
      'Review/monitoring outputs demonstrating ongoing effectiveness.'
    ],
    notes: 'Use representative samples and document exceptions with corrective actions.'
  }
};

function bulletList(lines) {
  const items = (Array.isArray(lines) ? lines : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return items.length ? items.map((item) => `- ${item}`).join('\n') : null;
}

function clampProcedureId(value) {
  return String(value || '').trim().slice(0, 100);
}

function sanitizeProcedurePrefix(controlId) {
  const normalized = String(controlId || 'CONTROL')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
  return (normalized || 'CONTROL').slice(0, 84);
}

function detectFocus(control) {
  const frameworkCode = String(control.framework_code || '').toLowerCase();
  if (['gdpr', 'hipaa', 'nist_privacy'].includes(frameworkCode)) return 'privacy';
  if (['nist_ai_rmf', 'iso_42001', 'iso_42005', 'eu_ai_act'].includes(frameworkCode)) return 'ai';

  const text = `${control.control_id || ''} ${control.title || ''} ${control.description || ''}`.toLowerCase();

  if (/(vulnerab|scan|sbom|stig|scap|patch|hardening|cve|malware|weakness|remediation)/.test(text)) return 'vulnerability';
  if (/(account|access|auth|identity|privilege|mfa|authorization)/.test(text)) return 'access';
  if (/(incident|breach|response|recovery|containment|forensic|notification)/.test(text)) return 'incident';
  if (/(asset|inventory|configuration|baseline|cmdb|system component|service account)/.test(text)) return 'asset';
  if (/(vendor|supplier|third[- ]party|external service|supply chain)/.test(text)) return 'thirdParty';
  if (/(privacy|personal data|pii|consent|data subject|ephi|phi|lawful basis|retention)/.test(text)) return 'privacy';
  if (/(ai|model|machine learning|ml|training data|human oversight|drift|fairness|transparency)/.test(text)) return 'ai';

  return 'general';
}

function makeProcedure({
  frameworkControlId,
  procedureId,
  procedureType,
  title,
  description,
  expectedEvidence,
  assessmentMethod,
  depth,
  frequencyGuidance,
  assessorNotes,
  sourceDocument,
  sortOrder
}) {
  return {
    frameworkControlId,
    procedureId: clampProcedureId(procedureId),
    procedureType,
    title,
    description,
    expectedEvidence: expectedEvidence || null,
    assessmentMethod: assessmentMethod || null,
    depth: depth || 'focused',
    frequencyGuidance: frequencyGuidance || null,
    assessorNotes: assessorNotes || null,
    sourceDocument: sourceDocument || null,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 950
  };
}

function buildRichProcedures(control) {
  const focusKey = detectFocus(control);
  const focus = FOCUS_GUIDANCE[focusKey] || FOCUS_GUIDANCE.general;

  const evidenceBase = bulletList([
    ...FOCUS_GUIDANCE.general.evidence,
    ...focus.evidence
  ]);

  const shouldTest = ['vulnerability', 'access', 'asset', 'ai'].includes(focusKey);
  const verifyType = shouldTest ? 'test' : 'inspection';
  const verifyMethod = shouldTest ? 'system_test' : 'walkthrough';

  const prefix = sanitizeProcedurePrefix(control.control_id);
  const sourceDocument = `${control.framework_name} (recommended assessment procedures)`;
  const frequency = DEFAULT_FREQUENCY;

  const examine = makeProcedure({
    frameworkControlId: control.framework_control_id,
    procedureId: `${prefix}-RICH-E01`,
    procedureType: 'examine',
    title: `Examine evidence for ${control.control_id}`,
    description: `Review documented artifacts demonstrating ${control.control_id} is defined, implemented, and maintained for ${control.framework_name}.`,
    expectedEvidence: evidenceBase,
    assessmentMethod: 'document_review',
    depth: 'focused',
    frequencyGuidance: frequency,
    assessorNotes: `Confirm artifacts are approved, current, and traceable to in-scope systems. ${focus.notes}`,
    sourceDocument,
    sortOrder: 940
  });

  const interview = makeProcedure({
    frameworkControlId: control.framework_control_id,
    procedureId: `${prefix}-RICH-I01`,
    procedureType: 'interview',
    title: `Interview control owners for ${control.control_id}`,
    description: `Interview responsible personnel to confirm how ${control.control_id} operates in practice and how evidence is produced and retained.`,
    expectedEvidence: bulletList([
      'Named owner(s) and accountable approver(s)',
      'Walkthrough of the operating process and tools',
      'Examples of recent execution, exceptions, and remediation actions'
    ]),
    assessmentMethod: 'personnel_interview',
    depth: 'focused',
    frequencyGuidance: frequency,
    assessorNotes: 'Ask for a concrete example from the last 90 days (or last review cycle).',
    sourceDocument,
    sortOrder: 945
  });

  const verifyIdSuffix = verifyType === 'test' ? 'T01' : 'INSP01';
  const verify = makeProcedure({
    frameworkControlId: control.framework_control_id,
    procedureId: `${prefix}-RICH-${verifyIdSuffix}`,
    procedureType: verifyType,
    title: `${verifyType === 'test' ? 'Test' : 'Inspect'} operating effectiveness for ${control.control_id}`,
    description: `Select a representative in-scope system/process and ${verifyType === 'test' ? 'test technical mechanisms' : 'inspect operational records'} supporting ${control.control_id}.`,
    expectedEvidence: bulletList([
      'Sample records/logs/tickets showing execution and review',
      'Evidence of monitoring and follow-up actions for exceptions',
      'Proof of accountability and approvals where required'
    ]),
    assessmentMethod: verifyMethod,
    depth: 'comprehensive',
    frequencyGuidance: frequency,
    assessorNotes: `Prefer higher-risk scope areas first. ${focus.notes}`,
    sourceDocument,
    sortOrder: 950
  });

  return { examine, interview, verify };
}

async function seedRichBaselineProcedures() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const controlsResult = await client.query(`
      SELECT
        fc.id AS framework_control_id,
        fc.control_id,
        fc.title,
        fc.description,
        f.code AS framework_code,
        f.name AS framework_name
      FROM framework_controls fc
      JOIN frameworks f ON f.id = fc.framework_id
      WHERE f.is_active = true
      ORDER BY f.code, fc.control_id
    `);

    const controls = controlsResult.rows.filter((row) => !SKIP_FRAMEWORK_CODES.has(String(row.framework_code || '')));
    if (controls.length === 0) {
      await client.query('COMMIT');
      console.log('No eligible framework controls found. Nothing to seed.');
      return;
    }

    const controlIds = controls.map((row) => row.framework_control_id);
    const existingResult = await client.query(
      `SELECT framework_control_id, procedure_id, procedure_type
       FROM assessment_procedures
       WHERE framework_control_id = ANY($1::uuid[])`,
      [controlIds]
    );

    const existingByControl = new Map();
    for (const row of existingResult.rows) {
      const id = row.framework_control_id;
      if (!existingByControl.has(id)) existingByControl.set(id, { ids: new Set(), types: new Set() });
      const entry = existingByControl.get(id);
      if (row.procedure_id) entry.ids.add(String(row.procedure_id).trim());
      if (row.procedure_type) entry.types.add(String(row.procedure_type).trim().toLowerCase());
    }

    let inserted = 0;
    const insertedByFramework = new Map();

    for (const control of controls) {
      const existing = existingByControl.get(control.framework_control_id) || { ids: new Set(), types: new Set() };
      const types = existing.types;

      const hasExamine = types.has('examine');
      const hasInterview = types.has('interview');
      const hasVerify = types.has('test') || types.has('inspection');

      if (hasExamine && hasInterview && hasVerify) continue;

      const rich = buildRichProcedures(control);
      const toInsert = [];
      if (!hasExamine) toInsert.push(rich.examine);
      if (!hasInterview) toInsert.push(rich.interview);
      if (!hasVerify) toInsert.push(rich.verify);

      for (const proc of toInsert) {
        if (existing.ids.has(proc.procedureId)) continue;

        await client.query(
          `INSERT INTO assessment_procedures
            (framework_control_id, procedure_id, procedure_type, title, description,
             expected_evidence, assessment_method, depth, frequency_guidance,
             assessor_notes, source_document, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            proc.frameworkControlId,
            proc.procedureId,
            proc.procedureType,
            proc.title,
            proc.description,
            proc.expectedEvidence,
            proc.assessmentMethod,
            proc.depth,
            proc.frequencyGuidance,
            proc.assessorNotes,
            proc.sourceDocument,
            proc.sortOrder
          ]
        );

        inserted += 1;
        existing.ids.add(proc.procedureId);
        types.add(String(proc.procedureType || '').toLowerCase());
        insertedByFramework.set(
          control.framework_code,
          (insertedByFramework.get(control.framework_code) || 0) + 1
        );
      }
    }

    await client.query('COMMIT');

    console.log('\nRich baseline assessment procedure seeding complete.');
    console.log(`Procedures inserted: ${inserted}`);
    for (const [frameworkCode, count] of insertedByFramework.entries()) {
      console.log(`  - ${frameworkCode}: ${count}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Rich baseline procedure seed failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedRichBaselineProcedures().catch(() => process.exit(1));

