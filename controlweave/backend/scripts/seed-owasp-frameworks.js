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
  { control_id: 'LLM01', title: 'Prompt Injection Prevention',                priority: '1', control_type: 'technical' },
  { control_id: 'LLM02', title: 'Sensitive Information Disclosure Controls',   priority: '1', control_type: 'technical' },
  { control_id: 'LLM03', title: 'Supply Chain Risk Management for AI',         priority: '1', control_type: 'strategic' },
  { control_id: 'LLM04', title: 'Data and Model Poisoning Prevention',         priority: '1', control_type: 'technical' },
  { control_id: 'LLM05', title: 'Insecure Output Handling Mitigations',        priority: '1', control_type: 'technical' },
  { control_id: 'LLM06', title: 'Excessive Agency Restrictions',               priority: '2', control_type: 'organizational' },
  { control_id: 'LLM07', title: 'System Prompt Confidentiality Controls',      priority: '2', control_type: 'technical' },
  { control_id: 'LLM08', title: 'Vector and Embedding Security Controls',      priority: '2', control_type: 'technical' },
  { control_id: 'LLM09', title: 'Misinformation and Hallucination Safeguards', priority: '2', control_type: 'policy' },
  { control_id: 'LLM10', title: 'Unbounded Consumption Rate Limiting',         priority: '3', control_type: 'technical' }
];

const OWASP_AGENTIC_CONTROLS = [
  { control_id: 'AGENT01', title: 'Agentic Authorization and Least Privilege',         priority: '1', control_type: 'technical' },
  { control_id: 'AGENT02', title: 'Tool and Action Boundary Enforcement',               priority: '1', control_type: 'technical' },
  { control_id: 'AGENT03', title: 'Multi-Agent Trust and Verification Controls',        priority: '1', control_type: 'technical' },
  { control_id: 'AGENT04', title: 'Prompt Injection Across Agent Chains',               priority: '1', control_type: 'technical' },
  { control_id: 'AGENT05', title: 'Autonomous Action Oversight and Human-in-the-Loop',  priority: '1', control_type: 'organizational' },
  { control_id: 'AGENT06', title: 'Memory and Context Integrity Controls',              priority: '2', control_type: 'technical' },
  { control_id: 'AGENT07', title: 'Irreversible Action Prevention and Approval Gates',  priority: '2', control_type: 'organizational' },
  { control_id: 'AGENT08', title: 'Agentic Supply Chain and Plugin Security',           priority: '2', control_type: 'strategic' },
  { control_id: 'AGENT09', title: 'Audit Logging and Explainability for Agent Actions', priority: '2', control_type: 'technical' },
  { control_id: 'AGENT10', title: 'Resource Exhaustion and Runaway Loop Prevention',    priority: '3', control_type: 'technical' }
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

async function upsertFramework(client, code, name, version, description, category, tierRequired) {
  const existing = await client.query('SELECT id FROM frameworks WHERE code = $1 LIMIT 1', [code]);
  if (existing.rows.length > 0) {
    console.log(`  Framework '${code}' already exists — skipping.`);
    return existing.rows[0].id;
  }
  const result = await client.query(
    `INSERT INTO frameworks (code, name, version, description, category, tier_required, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
    [code, name, version, description, category, tierRequired]
  );
  console.log(`  Inserted framework '${code}' (id=${result.rows[0].id})`);
  return result.rows[0].id;
}

async function upsertControls(client, frameworkId, controls) {
  let inserted = 0;
  for (const ctrl of controls) {
    const existing = await client.query(
      'SELECT id FROM framework_controls WHERE framework_id = $1 AND control_id = $2',
      [frameworkId, ctrl.control_id]
    );
    if (existing.rows.length > 0) continue;
    await client.query(
      `INSERT INTO framework_controls (framework_id, control_id, title, priority, control_type)
       VALUES ($1, $2, $3, $4, $5)`,
      [frameworkId, ctrl.control_id, ctrl.title, ctrl.priority, ctrl.control_type]
    );
    inserted++;
  }
  console.log(`  Controls: ${inserted} inserted, ${controls.length - inserted} already existed.`);
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
    const llmFwId = await upsertFramework(client,
      'owasp_llm_top10', 'OWASP LLM Top 10 (2025)', '2025',
      'The OWASP Top 10 for Large Language Model Applications identifies the most critical security risks for LLM deployments.',
      'AI Security', 'professional'
    );
    await upsertControls(client, llmFwId, OWASP_LLM_CONTROLS);

    console.log('\n=== Seeding OWASP Agentic AI Top 10 (2026) ===');
    const agentFwId = await upsertFramework(client,
      'owasp_agentic_top10', 'OWASP Agentic AI Top 10 (2026)', '2026',
      'Security risks specific to agentic and autonomous AI applications and multi-agent pipelines.',
      'AI Security', 'professional'
    );
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
