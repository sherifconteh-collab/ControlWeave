// @tier: exclude
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

const OWASP_LLM_CONTROLS = [
  { control_id: 'LLM01', title: 'Prompt Injection Prevention', description: 'Implement input validation, output filtering, and privilege separation to prevent direct and indirect prompt injection attacks that manipulate LLM behavior.', priority: '1', control_type: 'technical' },
  { control_id: 'LLM02', title: 'Sensitive Information Disclosure Controls', description: 'Apply data sanitization, PII filtering, and output guardrails to prevent LLMs from revealing confidential training data, credentials, or personal information in responses.', priority: '1', control_type: 'technical' },
  { control_id: 'LLM03', title: 'Supply Chain Risk Management for AI', description: 'Vet third-party models, datasets, and plugins for integrity and provenance. Enforce SBOM tracking and signature verification to mitigate tampered or malicious AI components.', priority: '1', control_type: 'strategic' },
  { control_id: 'LLM04', title: 'Data and Model Poisoning Prevention', description: 'Validate and monitor training data pipelines for adversarial manipulation. Implement integrity checks and anomaly detection to prevent corrupted data or backdoors from compromising model behavior.', priority: '1', control_type: 'technical' },
  { control_id: 'LLM05', title: 'Insecure Output Handling Mitigations', description: 'Sanitize and encode all LLM-generated output before rendering or downstream processing to prevent injection attacks such as XSS, SSRF, or command injection via model responses.', priority: '1', control_type: 'technical' },
  { control_id: 'LLM06', title: 'Excessive Agency Restrictions', description: 'Limit the scope of actions an LLM can autonomously perform by enforcing least-privilege permissions, human-in-the-loop approvals, and bounded action sets to prevent unintended or harmful operations.', priority: '2', control_type: 'organizational' },
  { control_id: 'LLM07', title: 'System Prompt Confidentiality Controls', description: 'Protect system prompts from extraction or leakage by implementing access controls, prompt isolation techniques, and response filtering to prevent adversaries from reverse-engineering application logic.', priority: '2', control_type: 'technical' },
  { control_id: 'LLM08', title: 'Vector and Embedding Security Controls', description: 'Secure vector databases and embedding pipelines against unauthorized access, poisoning, and extraction attacks. Enforce access controls and integrity validation on stored embeddings.', priority: '2', control_type: 'technical' },
  { control_id: 'LLM09', title: 'Misinformation and Hallucination Safeguards', description: 'Implement grounding techniques, retrieval-augmented generation, and output verification to detect and reduce fabricated or inaccurate content produced by LLMs.', priority: '2', control_type: 'policy' },
  { control_id: 'LLM10', title: 'Unbounded Consumption Rate Limiting', description: 'Enforce rate limiting, token budgets, and resource quotas to prevent denial-of-service conditions caused by excessive or adversarial consumption of LLM compute and API resources.', priority: '3', control_type: 'technical' }
];

const OWASP_AGENTIC_CONTROLS = [
  { control_id: 'AGENT01', title: 'Agentic Authorization and Least Privilege', description: 'Enforce fine-grained authentication and authorization for AI agents, ensuring each agent operates with the minimum permissions required and cannot escalate privileges beyond its designated scope.', priority: '1', control_type: 'technical' },
  { control_id: 'AGENT02', title: 'Tool and Action Boundary Enforcement', description: 'Restrict agent access to approved tools and functions through allowlists and schema validation. Prevent misuse of tool APIs by enforcing strict input/output contracts and parameter boundaries.', priority: '1', control_type: 'technical' },
  { control_id: 'AGENT03', title: 'Multi-Agent Trust and Verification Controls', description: 'Establish trust boundaries and mutual authentication between cooperating agents. Validate inter-agent messages and outputs to prevent a compromised agent from poisoning the broader multi-agent system.', priority: '1', control_type: 'technical' },
  { control_id: 'AGENT04', title: 'Prompt Injection Across Agent Chains', description: 'Detect and block prompt injection attacks that propagate through chained agent interactions. Apply input sanitization and context isolation at each handoff point in multi-step agent workflows.', priority: '1', control_type: 'technical' },
  { control_id: 'AGENT05', title: 'Autonomous Action Oversight and Human-in-the-Loop', description: 'Require human approval for high-impact or irreversible agent actions. Implement oversight dashboards and escalation policies to maintain meaningful human control over autonomous decision-making.', priority: '1', control_type: 'organizational' },
  { control_id: 'AGENT06', title: 'Memory and Context Integrity Controls', description: 'Protect agent memory stores and context windows from tampering, injection, and unauthorized modification. Enforce integrity checks and access controls on persistent and session-based agent memory.', priority: '2', control_type: 'technical' },
  { control_id: 'AGENT07', title: 'Irreversible Action Prevention and Approval Gates', description: 'Identify and gate destructive or irreversible operations such as data deletion, financial transactions, or infrastructure changes behind explicit approval workflows and confirmation steps.', priority: '2', control_type: 'organizational' },
  { control_id: 'AGENT08', title: 'Agentic Supply Chain and Plugin Security', description: 'Vet and monitor third-party agent plugins, tools, and extensions for malicious behavior. Enforce provenance verification, sandboxing, and runtime permission controls for all external agent components.', priority: '2', control_type: 'strategic' },
  { control_id: 'AGENT09', title: 'Audit Logging and Explainability for Agent Actions', description: 'Capture comprehensive audit trails of all agent decisions, tool invocations, and state changes. Provide explainability mechanisms that allow reviewers to reconstruct and understand agent reasoning paths.', priority: '2', control_type: 'technical' },
  { control_id: 'AGENT10', title: 'Resource Exhaustion and Runaway Loop Prevention', description: 'Implement circuit breakers, iteration limits, and resource budgets to prevent agents from entering infinite loops or consuming excessive compute, memory, or API calls during autonomous execution.', priority: '3', control_type: 'technical' }
];

// Crosswalk mappings: OWASP LLM -> NIST AI RMF / EU AI Act / ISO 42001
const LLM_CROSSWALKS = [
  { source: 'LLM01', target_framework: 'nist_ai_rmf', target_id: 'MS-2.5',  score: 85, type: 'related' },
  { source: 'LLM01', target_framework: 'eu_ai_act',   target_id: 'Art-9',   score: 80, type: 'related' },
  { source: 'LLM01', target_framework: 'iso_42001',   target_id: '6.1.2',   score: 75, type: 'related' },
  { source: 'LLM02', target_framework: 'nist_ai_rmf', target_id: 'GV-1.1',  score: 80, type: 'related' },
  { source: 'LLM02', target_framework: 'eu_ai_act',   target_id: 'Art-10',  score: 85, type: 'related' },
  { source: 'LLM02', target_framework: 'iso_42001',   target_id: '8.4',     score: 70, type: 'related' },
  { source: 'LLM03', target_framework: 'nist_ai_rmf', target_id: 'GV-6.1',  score: 90, type: 'equivalent' },
  { source: 'LLM03', target_framework: 'eu_ai_act',   target_id: 'Art-17',  score: 75, type: 'related' },
  { source: 'LLM03', target_framework: 'iso_42001',   target_id: '8.3',     score: 80, type: 'related' },
  { source: 'LLM04', target_framework: 'nist_ai_rmf', target_id: 'MS-2.6',  score: 88, type: 'related' },
  { source: 'LLM04', target_framework: 'eu_ai_act',   target_id: 'Art-10',  score: 82, type: 'related' },
  { source: 'LLM04', target_framework: 'iso_42001',   target_id: '8.4',     score: 78, type: 'related' },
  { source: 'LLM05', target_framework: 'nist_ai_rmf', target_id: 'MS-2.7',  score: 82, type: 'related' },
  { source: 'LLM05', target_framework: 'eu_ai_act',   target_id: 'Art-13',  score: 78, type: 'related' },
  { source: 'LLM06', target_framework: 'nist_ai_rmf', target_id: 'GV-4.1',  score: 85, type: 'related' },
  { source: 'LLM06', target_framework: 'eu_ai_act',   target_id: 'Art-14',  score: 90, type: 'equivalent' },
  { source: 'LLM06', target_framework: 'iso_42001',   target_id: '6.2',     score: 75, type: 'related' },
  { source: 'LLM07', target_framework: 'nist_ai_rmf', target_id: 'MS-2.5',  score: 75, type: 'related' },
  { source: 'LLM08', target_framework: 'nist_ai_rmf', target_id: 'MS-2.6',  score: 78, type: 'related' },
  { source: 'LLM09', target_framework: 'nist_ai_rmf', target_id: 'MG-2.2',  score: 88, type: 'related' },
  { source: 'LLM09', target_framework: 'eu_ai_act',   target_id: 'Art-13',  score: 80, type: 'related' },
  { source: 'LLM09', target_framework: 'iso_42001',   target_id: '9.1',     score: 72, type: 'related' },
  { source: 'LLM10', target_framework: 'nist_ai_rmf', target_id: 'MS-4.1',  score: 80, type: 'related' },
  { source: 'LLM10', target_framework: 'eu_ai_act',   target_id: 'Art-9',   score: 72, type: 'related' }
];

const AGENTIC_CROSSWALKS = [
  { source: 'AGENT01', target_framework: 'nist_ai_rmf', target_id: 'GV-4.1',  score: 90, type: 'equivalent' },
  { source: 'AGENT01', target_framework: 'eu_ai_act',   target_id: 'Art-14',  score: 88, type: 'related' },
  { source: 'AGENT02', target_framework: 'nist_ai_rmf', target_id: 'GV-4.2',  score: 85, type: 'related' },
  { source: 'AGENT02', target_framework: 'eu_ai_act',   target_id: 'Art-9',   score: 78, type: 'related' },
  { source: 'AGENT03', target_framework: 'nist_ai_rmf', target_id: 'GV-6.1',  score: 82, type: 'related' },
  { source: 'AGENT03', target_framework: 'iso_42001',   target_id: '8.3',     score: 75, type: 'related' },
  { source: 'AGENT04', target_framework: 'nist_ai_rmf', target_id: 'MS-2.5',  score: 88, type: 'related' },
  { source: 'AGENT04', target_framework: 'eu_ai_act',   target_id: 'Art-9',   score: 82, type: 'related' },
  { source: 'AGENT05', target_framework: 'nist_ai_rmf', target_id: 'GV-4.1',  score: 92, type: 'equivalent' },
  { source: 'AGENT05', target_framework: 'eu_ai_act',   target_id: 'Art-14',  score: 95, type: 'equivalent' },
  { source: 'AGENT05', target_framework: 'iso_42001',   target_id: '6.2',     score: 80, type: 'related' },
  { source: 'AGENT06', target_framework: 'nist_ai_rmf', target_id: 'MS-2.7',  score: 78, type: 'related' },
  { source: 'AGENT07', target_framework: 'nist_ai_rmf', target_id: 'MG-3.1',  score: 80, type: 'related' },
  { source: 'AGENT07', target_framework: 'eu_ai_act',   target_id: 'Art-14',  score: 85, type: 'related' },
  { source: 'AGENT08', target_framework: 'nist_ai_rmf', target_id: 'GV-6.1',  score: 88, type: 'related' },
  { source: 'AGENT08', target_framework: 'eu_ai_act',   target_id: 'Art-17',  score: 80, type: 'related' },
  { source: 'AGENT09', target_framework: 'nist_ai_rmf', target_id: 'GV-1.7',  score: 85, type: 'related' },
  { source: 'AGENT09', target_framework: 'eu_ai_act',   target_id: 'Art-12',  score: 90, type: 'equivalent' },
  { source: 'AGENT09', target_framework: 'iso_42001',   target_id: '9.1',     score: 82, type: 'related' },
  { source: 'AGENT10', target_framework: 'nist_ai_rmf', target_id: 'MS-4.1',  score: 82, type: 'related' },
  { source: 'AGENT10', target_framework: 'eu_ai_act',   target_id: 'Art-9',   score: 75, type: 'related' }
];

async function upsertFramework(client, { code, name, version, description, category, tierRequired, frameworkGroup }) {
  const existing = await client.query('SELECT id FROM frameworks WHERE code = $1 LIMIT 1', [code]);
  if (existing.rows.length > 0) {
    // Backfill framework_group only when not already set
    if (frameworkGroup) {
      await client.query(
        'UPDATE frameworks SET framework_group = $1 WHERE code = $2 AND framework_group IS NULL',
        [frameworkGroup, code]
      );
    }
    console.log(`  Framework '${code}' already exists — skipping.`);
    return existing.rows[0].id;
  }
  const result = await client.query(
    `INSERT INTO frameworks (code, name, version, description, category, tier_required, is_active, framework_group)
     VALUES ($1, $2, $3, $4, $5, $6, true, $7) RETURNING id`,
    [code, name, version, description, category, tierRequired, frameworkGroup || null]
  );
  console.log(`  Inserted framework '${code}' (id=${result.rows[0].id})`);
  return result.rows[0].id;
}

async function upsertControls(client, frameworkId, controls) {
  // Prefetch all existing controls for this framework in a single query
  const existing = await client.query(
    'SELECT id, control_id, description FROM framework_controls WHERE framework_id = $1',
    [frameworkId]
  );
  const existingMap = new Map(existing.rows.map(r => [r.control_id, r]));

  // Separate into new inserts vs description backfills
  const toInsert = [];
  const toBackfill = [];
  for (const ctrl of controls) {
    const row = existingMap.get(ctrl.control_id);
    if (!row) {
      toInsert.push(ctrl);
    } else if (!row.description && ctrl.description) {
      toBackfill.push({ id: row.id, description: ctrl.description });
    }
  }

  // Bulk insert new controls
  if (toInsert.length > 0) {
    const placeholders = toInsert.map((_, i) => {
      const b = i * 6;
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`;
    }).join(', ');
    const params = toInsert.flatMap(ctrl => [
      frameworkId, ctrl.control_id, ctrl.title, ctrl.description, ctrl.priority, ctrl.control_type,
    ]);
    await client.query(
      `INSERT INTO framework_controls (framework_id, control_id, title, description, priority, control_type)
       VALUES ${placeholders}`,
      params
    );
  }

  // Backfill descriptions for existing controls that have NULL description
  if (toBackfill.length > 0) {
    const ids = toBackfill.map(r => r.id);
    const descs = toBackfill.map(r => r.description);
    await client.query(
      `UPDATE framework_controls SET description = v.desc
       FROM unnest($1::uuid[], $2::text[]) AS v(id, desc)
       WHERE framework_controls.id = v.id`,
      [ids, descs]
    );
  }

  console.log(`  Controls: ${toInsert.length} inserted, ${toBackfill.length} descriptions backfilled, ${controls.length - toInsert.length - toBackfill.length} unchanged.`);
}

async function insertCrosswalks(client, sourceFrameworkId, crosswalks) {
  let inserted = 0;
  let skipped = 0;
  for (const cw of crosswalks) {
    const srcCtrl = await client.query(
      'SELECT id FROM framework_controls WHERE framework_id = $1 AND control_id = $2 LIMIT 1',
      [sourceFrameworkId, cw.source]
    );
    if (srcCtrl.rows.length === 0) { skipped++; continue; }

    const tgtFw = await client.query(
      'SELECT id FROM frameworks WHERE code = $1 LIMIT 1',
      [cw.target_framework]
    );
    if (tgtFw.rows.length === 0) { skipped++; continue; }

    const tgtCtrl = await client.query(
      'SELECT id FROM framework_controls WHERE framework_id = $1 AND control_id = $2 LIMIT 1',
      [tgtFw.rows[0].id, cw.target_id]
    );
    if (tgtCtrl.rows.length === 0) { skipped++; continue; }

    const existing = await client.query(
      'SELECT id FROM control_mappings WHERE source_control_id = $1 AND target_control_id = $2 LIMIT 1',
      [srcCtrl.rows[0].id, tgtCtrl.rows[0].id]
    );
    if (existing.rows.length > 0) { skipped++; continue; }

    await client.query(
      `INSERT INTO control_mappings (source_control_id, target_control_id, similarity_score, mapping_type)
       VALUES ($1, $2, $3, $4)`,
      [srcCtrl.rows[0].id, tgtCtrl.rows[0].id, cw.score, cw.type]
    );
    inserted++;
  }
  console.log(`  Crosswalks: ${inserted} inserted, ${skipped} skipped/not found.`);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('\n=== Seeding OWASP LLM Top 10 (2025) ===');
    const llmFwId = await upsertFramework(client, {
      code: 'owasp_llm_top10', name: 'OWASP LLM Top 10 (2025)', version: '2025',
      description: 'The OWASP Top 10 for Large Language Model Applications identifies the most critical security risks for LLM deployments.',
      category: 'AI Security', tierRequired: 'enterprise', frameworkGroup: 'owasp_ai',
    });
    await upsertControls(client, llmFwId, OWASP_LLM_CONTROLS);

    console.log('\n=== Seeding OWASP Agentic AI Top 10 (2026) ===');
    const agentFwId = await upsertFramework(client, {
      code: 'owasp_agentic_top10', name: 'OWASP Agentic AI Top 10 (2026)', version: '2026',
      description: 'Security risks specific to agentic and autonomous AI applications and multi-agent pipelines.',
      category: 'AI Security', tierRequired: 'enterprise', frameworkGroup: 'owasp_ai',
    });
    await upsertControls(client, agentFwId, OWASP_AGENTIC_CONTROLS);

    console.log('\n=== Crosswalks: OWASP LLM -> NIST AI RMF / EU AI Act / ISO 42001 ===');
    await insertCrosswalks(client, llmFwId, LLM_CROSSWALKS);

    console.log('\n=== Crosswalks: Agentic -> NIST AI RMF / EU AI Act / ISO 42001 ===');
    await insertCrosswalks(client, agentFwId, AGENTIC_CROSSWALKS);

    await client.query('COMMIT');
    console.log('\nDone. All OWASP frameworks seeded successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

main();
