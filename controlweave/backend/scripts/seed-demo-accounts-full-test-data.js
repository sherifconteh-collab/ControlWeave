#!/usr/bin/env node
// @tier: exclude
/**
 * seed-demo-accounts-full-test-data.js
 *
 * Orchestrates full demo data seeding across all demo tiers/accounts:
 *   1) Ensure demo accounts exist
 *   2) Normalize demo org tiers
 *   3) Seed comprehensive tier-specific data (community/pro/enterprise/govcloud)
 *   4) Pull + seed Hugging Face vulnerability test data
 *
 * Notes:
 * - One seed script per tier:
 *     community (~20%) → seed-community-test-data.js   (NovaTech Solutions)
 *     pro       (~40%) → seed-pro-test-data.js         (BrightPath Health)
 *     enterprise(~80%) → seed-enterprise-demo.js       (Meridian Financial Group)
 *     govcloud  (~90%) → seed-govcloud-test-data.js    (Vanguard Defense Systems)
 * - All demo tier accounts receive tier-aware Hugging Face findings from
 *   seed-hf-demo-data.js.
 *
 * Run:
 *   npm run seed:demo:all-test-data
 *
 * Optional:
 *   node scripts/seed-demo-accounts-full-test-data.js --tiers=pro,enterprise
 *   node scripts/seed-demo-accounts-full-test-data.js --skip-hf
 *   node scripts/seed-demo-accounts-full-test-data.js --hf-targets=admin@govcloud.com
 */
require('dotenv').config();
const path = require('path');
const { spawnSync } = require('child_process');
const pool = require('../src/config/database');

const scriptDir = __dirname;

const ALL_TIERS = ['community', 'pro', 'enterprise', 'govcloud'];

const TIER_STEP_MAP = {
  community: {
    name: 'Seed community-tier comprehensive data (~20% compliance)',
    script: 'seed-community-test-data.js'
  },
  pro: {
    name: 'Seed pro-tier comprehensive data (~40% compliance)',
    script: 'seed-pro-test-data.js'
  },
  enterprise: {
    name: 'Seed enterprise-tier CISO-quality demo data (~80% compliance)',
    script: 'seed-enterprise-demo.js'
  },
  govcloud: {
    name: 'Seed govcloud-tier NERC CIP demo data (~90% compliance)',
    script: 'seed-govcloud-test-data.js'
  }
};

const TIER_REQUIRED_FRAMEWORKS = {
  community: ['nist_csf_2.0', 'nist_800_53', 'iso_27001', 'soc2', 'nist_ai_rmf'],
  pro: ['nist_csf_2.0', 'nist_800_53', 'iso_27001', 'soc2', 'nist_ai_rmf', 'nist_800_171', 'fiscam'],
  enterprise: ['nist_csf_2.0', 'nist_800_53', 'iso_27001', 'soc2', 'hipaa', 'gdpr', 'nist_ai_rmf', 'fiscam'],
  govcloud: []
};

function parseListArg(name) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => String(arg || '').startsWith(prefix));
  if (!raw) return null;
  return raw
    .slice(prefix.length)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function resolveTiers() {
  const requested = parseListArg('tiers');
  if (!requested || !requested.length) return ALL_TIERS;

  const unique = [...new Set(requested)];
  const invalid = unique.filter((tier) => !ALL_TIERS.includes(tier));
  if (invalid.length) {
    throw new Error(`Unsupported tier(s): ${invalid.join(', ')}. Supported: ${ALL_TIERS.join(', ')}`);
  }
  return unique;
}

function buildSteps() {
  const tiers = resolveTiers();
  const skipHf = hasFlag('skip-hf');
  const hfTargets = parseListArg('hf-targets');

  const steps = [
    {
      name: 'Seed demo accounts',
      script: 'seed-demo-accounts.js'
    },
    {
      name: 'Reset demo org tiers (apply)',
      script: 'reset-demo-org-tiers.js',
      args: ['--apply']
    },
    {
      name: 'Complete demo onboarding profiles (skip onboarding for demo users)',
      script: 'seed-demo-disable-onboarding.js'
    }
  ];

  for (const tier of tiers) {
    steps.push(TIER_STEP_MAP[tier]);
  }

  // Seed feature-tab data (TPRM, RMF, evidence rules, pending evidence,
  // AI compliance monitoring, organization contacts) for each demo account
  // based on tier. Runs once and handles all demo accounts internally.
  steps.push({
    name: 'Seed tier-aware feature-tab data (TPRM, RMF, evidence rules, AI monitoring, contacts)',
    script: 'seed-demo-tier-features.js'
  });

  if (!skipHf) {
    const hfStep = {
      name: 'Seed tier-aware Hugging Face findings for selected demo accounts',
      script: 'seed-hf-demo-data.js',
      args: []
    };
    if (hfTargets && hfTargets.length) {
      hfStep.args.push(`--targets=${hfTargets.join(',')}`);
    }
    steps.push(hfStep);
  }

  return { steps, tiers, skipHf, hfTargets };
}

function runStep(step) {
  const scriptPath = path.join(scriptDir, step.script);
  const args = [scriptPath, ...(step.args || [])];

  console.log(`\n▶ ${step.name}`);
  const result = spawnSync(process.execPath, args, {
    cwd: path.join(scriptDir, '..'),
    env: process.env,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${step.script} failed with exit code ${result.status}`);
  }
}

function collectRequiredFrameworkCodes(tiers) {
  return [...new Set(
    tiers.flatMap((tier) => TIER_REQUIRED_FRAMEWORKS[tier] || [])
  )];
}

async function queryScalar(sql, params = []) {
  const result = await pool.query(sql, params);
  return Number(result.rows[0]?.count || 0);
}

async function ensureGlobalPrerequisites(tiers) {
  const requiredFrameworkCodes = collectRequiredFrameworkCodes(tiers);

  const [
    totalFrameworks,
    totalFrameworkControls,
    organizationFrameworkLinks,
    controlImplementationCount,
    assessmentProcedureCount
  ] = await Promise.all([
    queryScalar('SELECT COUNT(*) AS count FROM frameworks'),
    queryScalar('SELECT COUNT(*) AS count FROM framework_controls'),
    queryScalar('SELECT COUNT(*) AS count FROM organization_frameworks'),
    queryScalar('SELECT COUNT(*) AS count FROM control_implementations'),
    queryScalar('SELECT COUNT(*) AS count FROM assessment_procedures')
  ]);

  const frameworksResult = requiredFrameworkCodes.length > 0
    ? await pool.query(
        `SELECT f.code, COUNT(fc.id)::int AS control_count
         FROM frameworks f
         LEFT JOIN framework_controls fc ON fc.framework_id = f.id
         WHERE f.code = ANY($1::text[])
         GROUP BY f.code`,
        [requiredFrameworkCodes]
      )
    : { rows: [] };

  const foundCodes = new Set(frameworksResult.rows.map((row) => row.code));
  const missingFrameworks = requiredFrameworkCodes.filter((code) => !foundCodes.has(code));
  const emptyFrameworks = frameworksResult.rows
    .filter((row) => Number(row.control_count || 0) === 0)
    .map((row) => row.code);

  const needsFrameworkBootstrap =
    totalFrameworks === 0 ||
    totalFrameworkControls === 0 ||
    missingFrameworks.length > 0 ||
    emptyFrameworks.length > 0;

  if (needsFrameworkBootstrap) {
    const isSafeToBootstrap = organizationFrameworkLinks === 0 && controlImplementationCount === 0;
    if (!isSafeToBootstrap) {
      const problems = [
        missingFrameworks.length ? `missing frameworks: ${missingFrameworks.join(', ')}` : null,
        emptyFrameworks.length ? `frameworks with 0 controls: ${emptyFrameworks.join(', ')}` : null,
        totalFrameworkControls === 0 ? 'framework_controls is empty' : null
      ].filter(Boolean).join('; ');

      throw new Error(
        `Global framework catalog is incomplete (${problems}). Refusing to auto-bootstrap because organization framework/control data already exists. Run catalog repair first, then rerun the demo seed.`
      );
    }

    runStep({
      name: 'Bootstrap global framework catalog for demo seeding',
      script: 'seed-frameworks.js'
    });
  }

  if (assessmentProcedureCount === 0) {
    runStep({
      name: 'Seed baseline assessment procedures',
      script: 'seed-assessment-procedures-rich-all.js'
    });
  }
}

async function run() {
  try {
    const { steps, tiers, skipHf, hfTargets } = buildSteps();

    console.log('\n🚀 Starting full demo account test-data seeding...\n');
    console.log(`   Tiers: ${tiers.join(', ')}`);
    console.log(`   Hugging Face: ${skipHf ? 'disabled' : `enabled${hfTargets?.length ? ` (targets: ${hfTargets.join(', ')})` : ''}`}`);

    await ensureGlobalPrerequisites(tiers);

    for (const step of steps) {
      runStep(step);
    }

    console.log('\n✅ Full demo account test-data seeding complete.\n');
  } finally {
    await pool.end().catch(() => {});
  }
}

run().catch((error) => {
  console.error(`\n❌ Demo full seed failed: ${error.message}\n`);
  process.exit(1);
});
