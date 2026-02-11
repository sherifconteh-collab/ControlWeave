/**
 * Seed Assessment Procedures - AI Governance
 *
 * Adds richer recommended assessment procedures (examine/interview/test)
 * for the AI governance frameworks shipped with ControlWeave:
 *  - NIST AI RMF 1.0 (nist_ai_rmf)
 *  - EU AI Act (eu_ai_act) with prEN 18286 add-on guidance
 *  - ISO/IEC 42001:2023 (iso_42001)
 *  - ISO/IEC 42005:2025 (iso_42005)
 *
 * Non-destructive: inserts only missing procedure_ids per framework_control.
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

const TARGET_FRAMEWORKS = [
  { code: 'nist_ai_rmf', name: 'NIST AI RMF 1.0', source: 'NIST AI RMF 1.0 + Playbook (baseline procedures)' },
  { code: 'eu_ai_act', name: 'EU AI Act', source: 'EU AI Act + prEN 18286 (recommended conformity procedures)' },
  { code: 'iso_42001', name: 'ISO/IEC 42001:2023', source: 'ISO/IEC 42001:2023 + ISO 19011:2018 (baseline procedures)' },
  { code: 'iso_42005', name: 'ISO/IEC 42005:2025', source: 'ISO/IEC 42005:2025 (baseline procedures)' },
];

function bulletList(lines) {
  const items = (Array.isArray(lines) ? lines : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return items.length ? items.map((item) => `- ${item}`).join('\n') : null;
}

function clampProcedureId(value) {
  return String(value || '').trim().slice(0, 100);
}

function normalizeControlFamily(controlId) {
  const raw = String(controlId || '').trim().toUpperCase();
  const nistStyle = raw.match(/^([A-Z]{1,10})-/);
  if (nistStyle) return nistStyle[1];
  const parts = raw.split(/[\s\-_.:/]+/).filter(Boolean);
  return parts[0] || 'GEN';
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
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 100
  };
}

function nistAiRmfProcedures(control, sourceDocument) {
  const family = normalizeControlFamily(control.control_id);
  const base = `${control.control_id} - ${control.title || 'AI governance control'}`;

  const evidenceByFamily = {
    GOVERN: [
      'AI governance charter (committee, RACI, accountability structure)',
      'AI risk management policy/standard and approval history',
      'AI system inventory/model registry with ownership and approvals',
      'AI risk register with risk owners and treatment decisions',
      'Decision logs for AI risk acceptance and exceptions'
    ],
    MAP: [
      'AI system documentation (model cards, datasheets, intended use, limitations)',
      'System boundary, data flows, and dependency mapping',
      'Stakeholder and impacted-party analysis',
      'Risk classification and contextual assumptions for the AI use case',
      'Impact assessment inputs (safety, fairness, privacy, security)'
    ],
    MEASURE: [
      'Evaluation plan and metric definitions (performance, fairness, robustness, security)',
      'Bias/fairness and robustness test reports with thresholds',
      'Monitoring plan (drift, quality, incident triggers) and dashboards/log samples',
      'Security testing evidence (adversarial testing/red teaming where applicable)',
      'Issue tracking for AI quality, safety, or governance concerns'
    ],
    MANAGE: [
      'Risk treatment plan(s) and prioritization rationale for AI risks',
      'Change management for models/data (release approvals, rollback criteria)',
      'Incident response playbooks for AI failures and escalation logs',
      'Corrective action tracking (CAPA/POA&M-style remediation for AI issues)',
      'Communication plan for impacted stakeholders and internal reporting'
    ]
  };

  const expectedEvidence = bulletList(evidenceByFamily[family] || evidenceByFamily.GOVERN);
  const frequency = 'At each AI lifecycle stage, before major releases, and after material model/data changes.';

  return [
    makeProcedure({
      frameworkControlId: control.id,
      procedureId: `${control.control_id}-E01`,
      procedureType: 'examine',
      title: `Examine governance evidence for ${control.control_id}`,
      description: `Review documented artifacts that demonstrate ${base} is defined, implemented, and operating.`,
      expectedEvidence,
      assessmentMethod: 'document_review',
      depth: 'focused',
      frequencyGuidance: frequency,
      assessorNotes: 'Trace policy -> ownership -> register -> operating evidence. Sample at least one in-scope AI system.',
      sourceDocument,
      sortOrder: 910
    }),
    makeProcedure({
      frameworkControlId: control.id,
      procedureId: `${control.control_id}-I01`,
      procedureType: 'interview',
      title: `Interview control owners for ${control.control_id}`,
      description: `Interview AI governance, product, and engineering stakeholders to confirm how ${base} operates in practice.`,
      expectedEvidence: bulletList([
        'Named control owner(s) and accountable approver(s)',
        'Demonstration of how evidence is produced and stored',
        'Examples of recent decisions, exceptions, or escalations'
      ]),
      assessmentMethod: 'personnel_interview',
      depth: 'focused',
      frequencyGuidance: frequency,
      assessorNotes: 'Ask for concrete examples from the last 90 days (or last model release).',
      sourceDocument,
      sortOrder: 920
    }),
    makeProcedure({
      frameworkControlId: control.id,
      procedureId: `${control.control_id}-T01`,
      procedureType: 'test',
      title: `Test operating effectiveness for ${control.control_id}`,
      description: `Select an in-scope AI system and verify ${base} is operating by inspecting live artifacts and records.`,
      expectedEvidence: bulletList([
        'Model registry entry showing owner, approval status, and version history',
        'Monitoring outputs (alerts, drift metrics, dashboards) tied to defined thresholds',
        'Tickets/issues showing remediation actions and closure evidence'
      ]),
      assessmentMethod: 'system_test',
      depth: 'comprehensive',
      frequencyGuidance: frequency,
      assessorNotes: 'Sample at least one high-impact AI system and one lower-impact AI system if available.',
      sourceDocument,
      sortOrder: 930
    })
  ];
}

function iso42001Procedures(control, sourceDocument) {
  const clauseFamily = normalizeControlFamily(control.control_id); // likely ISO42
  const base = `${control.control_id} - ${control.title || 'AI management system control'}`;
  const frequency = 'Per AIMS audit cycle and when in-scope AI use or risk materially changes.';

  // Clause hints are embedded in the control_id string: ISO42-<clause>.<subclause>
  const clauseMatch = String(control.control_id || '').match(/ISO42-(\d+)\.(\d+)/i);
  const clause = clauseMatch ? Number(clauseMatch[1]) : null;

  const evidenceByClause = {
    4: [
      'AIMS scope statement and applicability criteria',
      'AI system inventory and AI use-case register',
      'Interested parties register and requirements mapping',
      'Context analysis (internal/external issues) and constraints',
      'Governance boundary and interfaces with ISMS/privacy/risk programs'
    ],
    5: [
      'Leadership commitment and roles/responsibilities for AIMS',
      'Approved AI policy and communication plan',
      'Accountability structure (RACI) for AI risk decisions',
      'Management review inputs/outputs covering AI governance'
    ],
    6: [
      'AI risk assessment methodology and risk criteria',
      'AI risk register and treatment plans aligned to objectives',
      'Measurable AIMS objectives and tracking metrics',
      'Planning artifacts for changes to AI systems and controls'
    ],
    7: [
      'Resourcing plan for AIMS (budget, tools, staffing)',
      'Competence/training records for AI roles (ML, product, risk, compliance)',
      'Documented information control (versioning, approvals, retention)',
      'Operational enablement (templates, playbooks, tooling)'
    ],
    8: [
      'Operational planning and control for AI lifecycle activities',
      'AI risk assessments and risk treatment execution evidence',
      'Impact assessment records and sign-offs (link to ISO/IEC 42005 where used)',
      'Change/release approvals for models and data',
      'Supplier/third-party AI service oversight artifacts'
    ],
    9: [
      'Monitoring and measurement plan and outputs',
      'Internal audit program and audit reports',
      'Evidence of corrective actions raised from audits/monitoring',
      'KPI/KRI reporting on AI governance'
    ],
    10: [
      'Nonconformity records and corrective action plans',
      'Root cause analysis outputs and closure evidence',
      'Continual improvement register/backlog for AIMS'
    ]
  };

  const expectedEvidence = bulletList(evidenceByClause[clause] || [
    'AIMS documented information relevant to this clause',
    'Records showing the process is operating and reviewed',
    'Evidence of accountability and approvals'
  ]);

  return [
    makeProcedure({
      frameworkControlId: control.id,
      procedureId: `${control.control_id}-E01`,
      procedureType: 'examine',
      title: `Examine AIMS artifacts for ${control.control_id}`,
      description: `Review documented evidence demonstrating ${base} is defined and maintained within the AI Management System (AIMS).`,
      expectedEvidence,
      assessmentMethod: 'document_review',
      depth: 'focused',
      frequencyGuidance: frequency,
      assessorNotes: 'Confirm artifacts are approved, current, and traceable to in-scope AI systems.',
      sourceDocument,
      sortOrder: 910
    }),
    makeProcedure({
      frameworkControlId: control.id,
      procedureId: `${control.control_id}-I01`,
      procedureType: 'interview',
      title: `Interview AIMS owners for ${control.control_id}`,
      description: `Interview AIMS leadership and operational owners to confirm how ${base} is executed and monitored.`,
      expectedEvidence: bulletList([
        'Named process owner and approval authority',
        'Examples of operational decisions and escalations',
        'Evidence storage locations and retention expectations'
      ]),
      assessmentMethod: 'personnel_interview',
      depth: 'focused',
      frequencyGuidance: frequency,
      assessorNotes: 'Ask for a walkthrough of the last completed cycle (audit, review, risk assessment, or release).',
      sourceDocument,
      sortOrder: 920
    }),
    makeProcedure({
      frameworkControlId: control.id,
      procedureId: `${control.control_id}-INSP01`,
      procedureType: 'inspection',
      title: `Inspect operating evidence for ${control.control_id}`,
      description: `Select one in-scope AI system and inspect operational records proving ${base} is performed consistently.`,
      expectedEvidence: bulletList([
        'Model/data release record with approvals and traceability',
        'Risk/impact assessment record tied to the selected AI system',
        'Monitoring outputs and any follow-up corrective actions'
      ]),
      assessmentMethod: 'walkthrough',
      depth: 'comprehensive',
      frequencyGuidance: frequency,
      assessorNotes: 'Prefer a high-impact AI system and a recent release/change event for sampling.',
      sourceDocument,
      sortOrder: 930
    })
  ];
}

function iso42005Procedures(control, sourceDocument) {
  const base = `${control.control_id} - ${control.title || 'AI system impact assessment control'}`;
  const frequency = 'Before deployment, at major model/data changes, and at least annually for high-impact AI systems.';

  const expectedEvidence = bulletList([
    'Impact assessment methodology/template and scoping criteria',
    'Completed impact assessment record(s) for in-scope AI system(s)',
    'Stakeholder and impacted-party analysis with consultation notes',
    'Impact identification and evaluation outputs (safety, fairness, privacy, security, societal)',
    'Mitigation plan, sign-offs, and monitoring updates for tracked impacts'
  ]);

  return [
    makeProcedure({
      frameworkControlId: control.id,
      procedureId: `${control.control_id}-E01`,
      procedureType: 'examine',
      title: `Examine AI impact assessment artifacts for ${control.control_id}`,
      description: `Review documented artifacts that demonstrate ${base} is performed and maintained for in-scope AI systems.`,
      expectedEvidence,
      assessmentMethod: 'document_review',
      depth: 'focused',
      frequencyGuidance: frequency,
      assessorNotes: 'Confirm the impact assessment is tied to a specific model/version and is updated after material changes.',
      sourceDocument,
      sortOrder: 910
    }),
    makeProcedure({
      frameworkControlId: control.id,
      procedureId: `${control.control_id}-I01`,
      procedureType: 'interview',
      title: `Interview impact assessment stakeholders for ${control.control_id}`,
      description: `Interview the impact assessment owner(s) and key stakeholders to validate assumptions, scope, and review cadence for ${base}.`,
      expectedEvidence: bulletList([
        'Named impact assessment owner(s) and approvers',
        'Evidence of stakeholder consultation (where applicable)',
        'Examples of mitigations implemented from prior assessments'
      ]),
      assessmentMethod: 'personnel_interview',
      depth: 'focused',
      frequencyGuidance: frequency,
      assessorNotes: 'Validate the organization has criteria for when an assessment must be re-run (change triggers).',
      sourceDocument,
      sortOrder: 920
    }),
    makeProcedure({
      frameworkControlId: control.id,
      procedureId: `${control.control_id}-INSP01`,
      procedureType: 'inspection',
      title: `Inspect lifecycle updates for ${control.control_id}`,
      description: `Select an in-scope AI system and inspect whether ${base} is updated across releases and operational changes.`,
      expectedEvidence: bulletList([
        'Version history showing assessment linkage to model/data releases',
        'Monitoring outputs tied to identified impacts and thresholds',
        'Sign-off and closure evidence for mitigations/corrective actions'
      ]),
      assessmentMethod: 'walkthrough',
      depth: 'comprehensive',
      frequencyGuidance: frequency,
      assessorNotes: 'Verify traceability from impact -> mitigation -> monitoring -> decision log.',
      sourceDocument,
      sortOrder: 930
    })
  ];
}

function euAiActProcedures(control, sourceDocument) {
  const base = `${control.control_id} - ${control.title || 'EU AI Act control'}`;
  const frequency = 'Before deployment, after material model/data changes, and when risk classification or intended purpose changes.';

  const articleMatch = String(control.control_id || '').match(/Art(\d+)/i);
  const article = articleMatch ? Number(articleMatch[1]) : null;

  const evidenceByArticle = {
    6: [
      'High-risk classification determination and decision record',
      'Intended purpose statement and scope boundary',
      'Annex applicability mapping and assumptions register',
      'Risk class rationale (including excluded/low-risk determination where applicable)'
    ],
    9: [
      'Documented AI risk management process covering lifecycle stages',
      'AI risk register with risk owners, treatment, and acceptance decisions',
      'Change triggers and periodic review cadence for AI risk',
      'Conformity assessment plan/file (where applicable)'
    ],
    10: [
      'Data governance plan (data sources, provenance, quality checks, bias considerations)',
      'Training/validation/test dataset documentation and data lineage evidence',
      'Data quality metrics and documented acceptance thresholds',
      'Records of data issues, mitigations, and approvals'
    ],
    11: [
      'Technical documentation package (architecture, intended purpose, limitations)',
      'Model card/datasheet and version history',
      'Traceability from requirements to implementation and test outcomes',
      'If used: prEN 18286 documentation structure/checklist aligned to the conformity file'
    ],
    12: [
      'Logging and record-keeping configuration and retention policy',
      'Sample logs demonstrating coverage for key events and decisions',
      'Monitoring and alerting thresholds tied to AI risks',
      'Access controls and integrity protections for logs'
    ],
    13: [
      'User-facing instructions for use and limitations',
      'Transparency disclosures and communication plan',
      'Support/complaints intake process and escalation path',
      'Evidence that materials are provided to deployers/users as required'
    ],
    14: [
      'Human oversight design (roles, authority, override/stop mechanisms)',
      'Operator training/competency records and runbooks',
      'Escalation procedures for anomalies, safety issues, or misuse',
      'Evidence of oversight during actual operations'
    ],
    15: [
      'Accuracy/robustness/cybersecurity evaluation plan and results',
      'Adversarial/abuse testing evidence where applicable',
      'Monitoring plan (drift, performance, security) and thresholds',
      'Vulnerability management evidence for AI components and dependencies'
    ],
    17: [
      'Quality Management System (QMS) policy/standard and process map',
      'Change control and release approvals for AI systems',
      'CAPA / corrective action tracking for AI nonconformities',
      'If used: prEN 18286 conformity assessment template/checklist embedded in QMS workflow'
    ],
    22: [
      'Authorized representative appointment and contract terms (if applicable)',
      'Responsibilities matrix (provider/deployer/rep) and accountability evidence',
      'Records of communications with authorities (where applicable)'
    ],
    26: [
      'Deployer procedures for operating the AI system according to instructions',
      'Operational monitoring responsibilities and evidence of execution',
      'Incident/serious-incident reporting process and example records'
    ],
    27: [
      'Fundamental Rights Impact Assessment (FRIA) methodology and completed assessment',
      'Stakeholder/impacted-party analysis and consultation notes (where applicable)',
      'Mitigation plan and approval/sign-off evidence',
      'Monitoring updates tied to identified rights impacts'
    ],
    50: [
      'GenAI transparency measures (output labeling, user notices)',
      'Content provenance/watermarking approach (where applicable)',
      'Training data summary documentation and rights considerations',
      'Incident/complaint handling for harmful or misleading outputs'
    ],
    52: [
      'Prohibited practice screening policy and enforcement controls',
      'Product review checklist preventing deployment of prohibited use cases',
      'Exception/waiver policy (if any) with approvals and constraints'
    ],
    72: [
      'Compliance governance and accountability for EU AI Act obligations',
      'Penalties awareness/training for accountable roles',
      'Escalation path for noncompliance and remediation commitments'
    ]
  };

  const expectedEvidence = bulletList(
    evidenceByArticle[article] || [
      'EU AI Act conformity evidence aligned to control intent',
      'Governance records showing ownership, approvals, and review cadence',
      'Operational artifacts demonstrating the control operates in practice',
      'If used: prEN 18286-based checklists/templates referenced in the conformity file'
    ]
  );

  const technicalArticles = new Set([10, 12, 15, 50]);
  const isTechnical = article ? technicalArticles.has(article) : false;

  const verifyProcedure = isTechnical
    ? makeProcedure({
        frameworkControlId: control.id,
        procedureId: `${control.control_id}-T01`,
        procedureType: 'test',
        title: `Test technical controls for ${control.control_id}`,
        description: `Select an in-scope AI system and test technical mechanisms supporting ${base} (data controls, logging, monitoring, evaluation, and security).`,
        expectedEvidence: bulletList([
          'Screenshots/exports from monitoring, logging, and evaluation tooling',
          'Sample records tied to a recent model/data release',
          'Evidence of issue remediation or corrective actions when thresholds were exceeded'
        ]),
        assessmentMethod: 'system_test',
        depth: 'comprehensive',
        frequencyGuidance: frequency,
        assessorNotes: 'Prefer a high-impact system. Validate traceability from requirement -> test -> decision -> release.',
        sourceDocument,
        sortOrder: 930
      })
    : makeProcedure({
        frameworkControlId: control.id,
        procedureId: `${control.control_id}-INSP01`,
        procedureType: 'inspection',
        title: `Inspect operating evidence for ${control.control_id}`,
        description: `Select an in-scope AI system and inspect operational records proving ${base} is performed consistently.`,
        expectedEvidence: bulletList([
          'Recent approvals/decision logs for the sampled AI system',
          'Evidence pack or conformity file entries tied to the selected system/version',
          'Proof of review cadence and escalations for nonconformities'
        ]),
        assessmentMethod: 'walkthrough',
        depth: 'comprehensive',
        frequencyGuidance: frequency,
        assessorNotes: 'If the organization uses prEN 18286 templates, confirm the checklist is complete and traceable to artifacts.',
        sourceDocument,
        sortOrder: 930
      });

  return [
    makeProcedure({
      frameworkControlId: control.id,
      procedureId: `${control.control_id}-E01`,
      procedureType: 'examine',
      title: `Examine conformity evidence for ${control.control_id}`,
      description: `Review documented artifacts demonstrating ${base} is defined, implemented, and maintained for in-scope AI systems.`,
      expectedEvidence,
      assessmentMethod: 'document_review',
      depth: 'focused',
      frequencyGuidance: frequency,
      assessorNotes: 'Confirm artifacts are versioned, approved, and traceable to specific AI system versions and intended purposes.',
      sourceDocument,
      sortOrder: 910
    }),
    makeProcedure({
      frameworkControlId: control.id,
      procedureId: `${control.control_id}-I01`,
      procedureType: 'interview',
      title: `Interview owners for ${control.control_id}`,
      description: `Interview product, engineering, risk, and compliance stakeholders to confirm how ${base} operates in practice.`,
      expectedEvidence: bulletList([
        'Named owner(s) and approver(s) for this obligation',
        'Walkthrough of how evidence is produced, reviewed, and retained',
        'Examples of recent decisions, issues, or escalations'
      ]),
      assessmentMethod: 'personnel_interview',
      depth: 'focused',
      frequencyGuidance: frequency,
      assessorNotes: 'Ask for concrete examples from the last release or the last 90 days.',
      sourceDocument,
      sortOrder: 920
    }),
    verifyProcedure
  ];
}

function buildProcedures(frameworkCode, control, sourceDocument) {
  if (frameworkCode === 'nist_ai_rmf') return nistAiRmfProcedures(control, sourceDocument);
  if (frameworkCode === 'eu_ai_act') return euAiActProcedures(control, sourceDocument);
  if (frameworkCode === 'iso_42001') return iso42001Procedures(control, sourceDocument);
  if (frameworkCode === 'iso_42005') return iso42005Procedures(control, sourceDocument);
  return [];
}

async function seedAIGovernanceProcedures() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let inserted = 0;
    const perFramework = new Map();

    for (const fw of TARGET_FRAMEWORKS) {
      const fwResult = await client.query(
        'SELECT id FROM frameworks WHERE code = $1 AND is_active = true LIMIT 1',
        [fw.code]
      );
      if (fwResult.rows.length === 0) {
        console.log(`  [SKIP] Framework not found: ${fw.code}`);
        continue;
      }

      const controlsResult = await client.query(
        `SELECT id, control_id, title, description
         FROM framework_controls
         WHERE framework_id = $1
         ORDER BY control_id`,
        [fwResult.rows[0].id]
      );

      for (const control of controlsResult.rows) {
        const existing = await client.query(
          'SELECT procedure_id FROM assessment_procedures WHERE framework_control_id = $1',
          [control.id]
        );
        const existingIds = new Set(
          existing.rows
            .map((row) => String(row.procedure_id || '').trim())
            .filter(Boolean)
        );

        const procedures = buildProcedures(fw.code, control, fw.source);
        for (const proc of procedures) {
          if (existingIds.has(proc.procedureId)) continue;

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
          perFramework.set(fw.code, (perFramework.get(fw.code) || 0) + 1);
        }
      }
    }

    await client.query('COMMIT');

    console.log('\nAI governance assessment procedure seeding complete.');
    console.log(`Procedures inserted: ${inserted}`);
    for (const [code, count] of perFramework.entries()) {
      console.log(`  - ${code}: ${count}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('AI governance procedure seed failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedAIGovernanceProcedures().catch(() => process.exit(1));
