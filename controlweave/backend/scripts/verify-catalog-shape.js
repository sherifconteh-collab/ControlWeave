#!/usr/bin/env node
// @tier: community
/**
 * Regression guard on the generated NIST 800-53 catalog (TEVV-DB).
 *
 * This replaces an inline check that verified seed-missing-controls.js carried
 * MA/MP/PE/PS/PT/SA/SR, on the premise that seed-frameworks.js did not cover
 * them. That premise went stale when the OSCAL import began generating all 20
 * families, and it would not have caught the thing actually worth catching:
 * the catalog silently losing its enhancement layer or its baseline
 * membership. Both are produced by a generator, so both can regress wholesale
 * in a single bad run -- which is exactly the failure a string-presence grep
 * cannot see.
 *
 * A script rather than an inline `node -e` in the workflow: the assertions
 * contain JS template literals, and `${...}` inside a double-quoted shell
 * string is interpolated by bash before node ever sees it.
 *
 * Exit codes: 0 catalog intact, 1 regression detected.
 */
const catalog = require('./lib/frameworks/nist_800_53.js');

// Sourced from the official OSCAL Rev 5.2.0 catalog and the NIST SP 800-53B
// LOW/MODERATE/HIGH profiles. Update these only alongside a deliberate
// re-import against a newer NIST release.
const EXPECTED = {
  families: 20,
  base: 300,
  enhancements: 714,
  baselines: { low: 149, moderate: 287, high: 370 }
};

function main() {
  const controls = catalog.controls || [];
  const failures = [];
  const fail = (msg) => failures.push(msg);

  const base = controls.filter((c) => !c.is_enhancement).length;
  const enhancements = controls.filter((c) => c.is_enhancement).length;
  const families = new Set(controls.map((c) => c.control_id.split('-')[0]));
  const inBaseline = (b) => controls.filter((c) => (c.baselines || []).includes(b)).length;

  if (families.size !== EXPECTED.families) {
    fail(`expected ${EXPECTED.families} control families, found ${families.size}`);
  }
  if (base !== EXPECTED.base) {
    fail(`expected ${EXPECTED.base} base controls, found ${base}`);
  }
  if (enhancements !== EXPECTED.enhancements) {
    fail(`expected ${EXPECTED.enhancements} enhancements, found ${enhancements}`);
  }
  for (const [baseline, expected] of Object.entries(EXPECTED.baselines)) {
    const actual = inBaseline(baseline);
    if (actual !== expected) {
      fail(`${baseline} baseline: expected ${expected} controls, found ${actual}`);
    }
  }

  // An enhancement with no parent is invisible in the UI hierarchy, which
  // derives nesting from this field rather than from the identifier.
  const orphans = controls.filter((c) => c.is_enhancement && !c.parent_control_id);
  if (orphans.length) {
    fail(`${orphans.length} enhancements have no parent_control_id (e.g. ${orphans[0].control_id})`);
  }

  // Parents must resolve within the same catalog, or the seed's second pass
  // warns and leaves the hierarchy incomplete.
  const ids = new Set(controls.map((c) => c.control_id));
  const unresolved = controls.filter((c) => c.parent_control_id && !ids.has(c.parent_control_id));
  if (unresolved.length) {
    fail(`${unresolved.length} controls reference a parent not in the catalog (e.g. ${unresolved[0].control_id})`);
  }

  // The frontend detects sub-controls with /\(\d+\)$/ and finds children by
  // `parent + '('` prefix. A dotted identifier silently breaks that nesting,
  // which is why the importer reads the label prop rather than the OSCAL id.
  const dotted = controls.filter((c) => c.control_id.includes('.'));
  if (dotted.length) {
    fail(`${dotted.length} controls use dotted identifiers (e.g. ${dotted[0].control_id}); expected parenthesized form`);
  }

  if (failures.length) {
    for (const f of failures) console.error(`FAIL  ${f}`);
    process.exit(1);
  }

  console.log(
    `OK  800-53 catalog: ${base} base + ${enhancements} enhancements across `
    + `${families.size} families; baselines `
    + `${inBaseline('low')}/${inBaseline('moderate')}/${inBaseline('high')}`
  );
}

main();
