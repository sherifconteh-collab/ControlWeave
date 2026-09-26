#!/usr/bin/env node
'use strict';

/**
 * Regenerates migrations/156_nist_800_171_rev3_full.sql from NIST's OSCAL
 * catalog. Kept for provenance; the migration itself is what ships.
 *
 *   curl -sLo catalog.json https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-171/rev3/json/NIST_SP800-171_rev3_catalog.json
 *   node scripts/generate-800-171r3-migration.js catalog.json out.sql
 */

const c = require(require('path').resolve(process.argv[2])).catalog;
const TYPE = { '03.01':'technical','03.02':'organizational','03.03':'technical','03.04':'technical','03.05':'technical','03.06':'organizational','03.07':'organizational','03.08':'physical','03.09':'organizational','03.10':'physical','03.11':'strategic','03.12':'organizational','03.13':'technical','03.14':'technical','03.15':'policy','03.16':'organizational','03.17':'organizational' };
function paramText(params, id) {
  const p = (params || []).find((x) => x.id === id);
  if (!p) return '[Assignment: organization-defined value]';
  if (p.select) return `[Selection${p.select['how-many'] === 'one-or-more' ? ' (one or more)' : ''}: ${(p.select.choice || []).map((ch) => ch.replace(/\{\{\s*insert:\s*param,\s*([^}\s]+)\s*\}\}/g, (_, i) => paramText(params, i))).join('; ')}]`;
  return `[Assignment: ${p.usage || ('organization-defined ' + (p.label || 'value'))}]`;
}
function shortLabel(v) { const last = String(v).split('.').pop(); return /^\d+$/.test(last) ? `${Number(last)}.` : `${last}.`; }
function render(part, params, depth) {
  const label = (part.props || []).find((p) => p.name === 'label');
  let text = (part.prose || '').replace(/\{\{\s*insert:\s*param,\s*([^}\s]+)\s*\}\}/g, (_, id) => paramText(params, id));
  const lines = [];
  if (text || label) lines.push(`${'  '.repeat(Math.max(0, depth - 1))}${label && depth > 0 ? shortLabel(label.value) + ' ' : ''}${text}`.trimEnd());
  for (const child of part.parts || []) lines.push(...render(child, params, depth + 1));
  return lines;
}
const rows = [];
for (const g of c.groups) {
  for (const x of g.controls || []) {
    if ((x.props || []).some((p) => p.name === 'status' && p.value === 'withdrawn')) continue;
    const id = x.id.replace('SP_800_171_', '');
    const stmt = (x.parts || []).find((p) => p.name === 'statement');
    const desc = render(stmt, x.params, 0).filter(Boolean).join('\n');
    rows.push({ id, title: x.title, desc, type: TYPE[id.slice(0, 5)] || 'technical', family: g.title });
  }
}
const q = (s) => { if (s.includes('$cw$')) throw new Error('delimiter'); return `$cw$${s}$cw$`; };
let sql = `-- Migration 156: complete NIST SP 800-171 Rev 3 requirement set
--
-- The nist_800_171 framework shipped 24 of the 97 security requirements in
-- SP 800-171 Rev 3, so a CUI assessment covered about a quarter of what a
-- contracting officer or C3PAO expects. This migration loads all 97 active
-- requirements (withdrawn Rev 3 identifiers are omitted) with the official
-- requirement text, generated from NIST's OSCAL catalog:
--   usnistgov/oscal-content nist.gov/SP800-171/rev3/json/NIST_SP800-171_rev3_catalog.json
-- Organization-defined parameters appear as [Assignment: ...] / [Selection: ...].
--
-- Idempotent: existing rows keep their id (so implementations, evidence links
-- and crosswalks are untouched) and only their title and text are refreshed.

DO $$
DECLARE
  fw_id UUID;
BEGIN
  SELECT id INTO fw_id FROM frameworks WHERE code = 'nist_800_171';
  IF fw_id IS NULL THEN
    RAISE NOTICE 'nist_800_171 framework not present; skipping 800-171 Rev 3 content load';
    RETURN;
  END IF;

  INSERT INTO framework_controls (framework_id, control_id, title, description, control_type, priority)
  VALUES
`;
sql += rows.map((r) => `    (fw_id, '${r.id}', ${q(r.title)}, ${q(r.desc)}, '${r.type}', '${['03.01','03.03','03.05','03.13','03.14','03.11','03.06'].includes(r.id.slice(0,5)) ? '1' : '2'}')`).join(',\n');
sql += `
  ON CONFLICT (framework_id, control_id) DO UPDATE
    SET title = EXCLUDED.title,
        description = EXCLUDED.description;

  UPDATE frameworks
     SET description = 'Protecting Controlled Unclassified Information (CUI) in nonfederal systems and organizations: all 97 security requirements across 17 families.'
   WHERE id = fw_id;
END$$;
`;
require('fs').writeFileSync(process.argv[3], sql);
process.stdout.write(`${rows.length} requirements\n`);
