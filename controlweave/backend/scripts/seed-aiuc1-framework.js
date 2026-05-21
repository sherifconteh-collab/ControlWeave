// @tier: exclude
/**
 * Seed AIUC-1 Agentic AI Certification Framework
 *
 * Adds the AIUC-1 framework — the first independently-audited certification
 * standard purpose-built for agentic (autonomous) AI systems, developed by
 * the Artificial Intelligence Underwriting Company (AIUC) and audited by
 * Schellman as the first accredited auditor.
 *
 * AIUC-1 covers six risk domains:
 *   Data & Privacy, Security, Safety, Reliability, Accountability, Societal Impact
 *
 * Crosswalk mappings are created to:
 *   - NIST AI RMF 1.0    (nist_ai_rmf)
 *   - EU AI Act 2024     (eu_ai_act)
 *   - ISO/IEC 42001:2023 (iso_42001)
 *   - OWASP Agentic AI Top 10 2026 (owasp_agentic_top10) — optional prerequisite:
 *       OWASP crosswalks are only inserted if the owasp_agentic_top10 framework
 *       has already been seeded. If missing, those mappings are skipped with a warning.
 *
 * Non-destructive: uses upsert pattern. Safe to re-run.
 * Reference: https://aiuc.com / https://www.schellman.com
 */

require('dotenv').config();
const { Pool } = require('pg');
const { AIUC1_FRAMEWORK, AIUC1_CONTROLS, AIUC1_CROSSWALKS } = require('./lib/aiuc1-data');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ─── Helper Functions ─────────────────────────────────────────────────────────

async function upsertFramework(client, { code, name, version, description, category, tierRequired, frameworkGroup }) {
  const existing = await client.query('SELECT id FROM frameworks WHERE code = $1 LIMIT 1', [code]);
  if (existing.rows.length > 0) {
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
  const existing = await client.query(
    'SELECT id, control_id, description FROM framework_controls WHERE framework_id = $1',
    [frameworkId]
  );
  const existingMap = new Map(existing.rows.map(r => [r.control_id, r]));

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
  const missingFrameworks = new Set();
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
    if (tgtFw.rows.length === 0) { skipped++; missingFrameworks.add(cw.target_framework); continue; }

    const tgtCtrl = await client.query(
      'SELECT id FROM framework_controls WHERE framework_id = $1 AND control_id = $2 LIMIT 1',
      [tgtFw.rows[0].id, cw.target_id]
    );
    if (tgtCtrl.rows.length === 0) { skipped++; continue; }

    const duplicate = await client.query(
      'SELECT id FROM control_mappings WHERE source_control_id = $1 AND target_control_id = $2 LIMIT 1',
      [srcCtrl.rows[0].id, tgtCtrl.rows[0].id]
    );
    if (duplicate.rows.length > 0) { skipped++; continue; }

    await client.query(
      `INSERT INTO control_mappings (source_control_id, target_control_id, similarity_score, mapping_type)
       VALUES ($1, $2, $3, $4)`,
      [srcCtrl.rows[0].id, tgtCtrl.rows[0].id, cw.score, cw.type]
    );
    inserted++;
  }
  console.log(`  Crosswalks: ${inserted} inserted, ${skipped} skipped/not found.`);
  if (missingFrameworks.size > 0) {
    console.warn(`  ⚠  Missing target framework(s): ${[...missingFrameworks].join(', ')} — crosswalks to these were skipped. Seed the missing framework(s) first, then re-run.`);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('\n=== Seeding AIUC-1 Agentic AI Certification Framework ===');
    const aiuc1FwId = await upsertFramework(client, {
      code:           AIUC1_FRAMEWORK.code,
      name:           AIUC1_FRAMEWORK.name,
      version:        AIUC1_FRAMEWORK.version,
      description:    AIUC1_FRAMEWORK.description,
      category:       AIUC1_FRAMEWORK.category,
      tierRequired:   AIUC1_FRAMEWORK.tier_required,
      frameworkGroup: AIUC1_FRAMEWORK.framework_group,
    });
    await upsertControls(client, aiuc1FwId, AIUC1_CONTROLS);

    console.log('\n=== Crosswalks: AIUC-1 → NIST AI RMF / EU AI Act / ISO 42001 / OWASP Agentic ===');
    await insertCrosswalks(client, aiuc1FwId, AIUC1_CROSSWALKS);

    await client.query('COMMIT');
    console.log('\nDone. AIUC-1 framework seeded successfully.');
    console.log(`  Total controls: ${AIUC1_CONTROLS.length}`);
    console.log(`  Total crosswalk definitions: ${AIUC1_CROSSWALKS.length}`);
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
