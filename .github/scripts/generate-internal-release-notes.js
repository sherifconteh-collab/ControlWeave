#!/usr/bin/env node
/**
 * generate-internal-release-notes.js
 *
 * Generates INTERNAL_RELEASE_NOTES.md for the **private ControlWeaver-Pro**
 * repository.  This document covers ALL tiers (Free → Utilities), annotates
 * every section with its tier availability, and follows the ControlWeave CM
 * release management guidelines.
 *
 * CM Release Management Guidelines (from copilot-instructions.md):
 *   Branch format : <type>/CW-<number>/<short-description>
 *   Commit format : <type>(<scope>): <description>
 *   Release branch: release/CW-<major>.<minor>.<patch>  OR  release/<version>
 *   Tag format    : v<major>.<minor>.<patch>
 *
 * Output format matches the existing RELEASE_NOTES.md structure:
 *   ## v<version> — <title>
 *   > Release Date / Version / Branch / Tag
 *   ### Overview (auto-generated)
 *   ### Added / Changed / Fixed / Security  (from CHANGELOG)
 *     - each #### subsection annotated with tier badge + technical context
 *   ### Breaking Changes   (highlighted)
 *   ### Migration Notes    (DB / API / Frontend tables)
 *   ### Tier Availability Summary (table per version)
 *
 * Usage (called by release-notes.yml generate-release-notes job):
 *   node .github/scripts/generate-internal-release-notes.js [version]
 *
 * If [version] is omitted the top versioned entry in CHANGELOG.md is used.
 *
 * Environment variables (all optional):
 *   GITHUB_WORKSPACE   — repo root (defaults to two levels up from script)
 *   OUTPUT_FILE        — absolute path for the output (defaults to INTERNAL_RELEASE_NOTES.md)
 *   GITHUB_STEP_SUMMARY — appended with a summary table when set
 *   GITHUB_SHA         — commit SHA added to the version header when set
 *   GITHUB_REF         — ref name added to the version header when set
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Configuration ────────────────────────────────────────────────────────────

const ROOT        = process.env.GITHUB_WORKSPACE || path.resolve(__dirname, '../..');
const OUTPUT_FILE = process.env.OUTPUT_FILE
  ? path.resolve(process.env.OUTPUT_FILE)
  : path.join(ROOT, 'INTERNAL_RELEASE_NOTES.md');
const STEP_SUMMARY = process.env.GITHUB_STEP_SUMMARY || '';
const GIT_SHA      = (process.env.GITHUB_SHA || '').slice(0, 8);
const GIT_REF      = process.env.GITHUB_REF || '';

// Explicit version override from CLI arg (mirrors how release-notes.yml passes version)
const VERSION_ARG  = process.argv[2] || '';

// ─── Tier metadata ────────────────────────────────────────────────────────────
//
// Maps CHANGELOG section keywords to tier availability metadata.
// Used to annotate every #### section in the internal notes.

const SECTION_TIERS = {
  // Full-stack platform sections — available across tiers (limits differ)
  'rmf': {
    tiers: '🟢 Free · Starter · Professional · Enterprise',
    note: 'Sidebar visible only when NIST 800-53, NIST 800-171, or CMMC 2.0 is active.',
    area: 'backend/frontend/migration',
  },
  'compliance framework': {
    tiers: '🟢 Free (2 max) · Starter (5 max) · Professional+ (Unlimited)',
    note: 'Crosswalk mappings available on all tiers.',
    area: 'backend/frontend',
  },
  'framework': {
    tiers: '🟢 Free (2 max) · Starter (5 max) · Professional+ (Unlimited)',
    note: 'Crosswalk mappings available on all tiers.',
    area: 'backend/frontend',
  },
  'control': {
    tiers: '🟢 All tiers — bulk updates require Starter+.',
    note: 'Custom fields and workflows require Professional+.',
    area: 'backend/frontend',
  },
  'assessment': {
    tiers: '🟢 Free (Basic only) · Starter+ (All depths)',
    note: 'Scheduled assessments and auditor workspace require Starter+.',
    area: 'backend/frontend',
  },
  'evidence': {
    tiers: '🟢 All tiers',
    note: 'Advanced retention policies require Professional+.',
    area: 'backend/frontend/storage',
  },
  'audit': {
    tiers: '🟢 All tiers',
    note: 'Immutable audit trail is available on every plan.',
    area: 'backend',
  },
  'policy': {
    tiers: '🟢 All tiers — AI policy generator requires an active LLM key.',
    note: '',
    area: 'backend/frontend',
  },
  'poam': {
    tiers: '🟢 All tiers',
    note: '',
    area: 'backend/frontend',
  },
  'dashboard': {
    tiers: '🟢 All tiers',
    note: 'Advanced analytics panels require Professional+.',
    area: 'frontend',
  },
  'report': {
    tiers: '🟢 Free (basic) · Starter+ (executive reports, risk heatmaps)',
    note: '',
    area: 'backend/frontend',
  },
  'notification': {
    tiers: '🟢 All tiers',
    note: '',
    area: 'backend/frontend',
  },
  'authentication': {
    tiers: '🟢 All tiers',
    note: 'SSO / SAML requires Enterprise.',
    area: 'backend/frontend',
  },
  'user': {
    tiers: '🟢 All tiers — Free limited to 5 seats.',
    note: 'Unlimited seats from Starter onward.',
    area: 'backend/frontend',
  },
  'rbac': {
    tiers: '🟢 All tiers',
    note: '',
    area: 'backend/frontend',
  },
  'settings': {
    tiers: '🟢 All tiers',
    note: 'LLM configuration (BYOK) available on all tiers.',
    area: 'backend/frontend',
  },
  'help': {
    tiers: '🟢 All tiers',
    note: '',
    area: 'frontend',
  },
  'mcp': {
    tiers: '🟢 All tiers',
    note: 'Requires Node 18+ and a configured JWT token.',
    area: 'backend',
  },
  'api': {
    tiers: '🟢 All tiers',
    note: 'Rate limits vary by tier.',
    area: 'backend',
  },
  // Paid-gated sections
  'cmdb': {
    tiers: '🔴 Starter · Professional · Enterprise · Utilities',
    note: 'Not available on the Free tier.',
    area: 'backend/frontend/migration',
  },
  'asset management': {
    tiers: '🔴 Starter · Professional · Enterprise · Utilities',
    note: 'Not available on the Free tier.',
    area: 'backend/frontend/migration',
  },
  'sbom': {
    tiers: '🔴 Professional · Enterprise · Utilities',
    note: 'SBOM/AIBOM tracking requires Professional+.',
    area: 'backend/frontend',
  },
  'vulnerability': {
    tiers: '🔴 Starter · Professional · Enterprise · Utilities',
    note: 'Not available on the Free tier.',
    area: 'backend/frontend',
  },
  'threat intelligence': {
    tiers: '🔴 Professional · Enterprise · Utilities',
    note: 'Requires Professional+.',
    area: 'backend/frontend',
  },
  'vendor risk': {
    tiers: '🔴 Starter · Professional · Enterprise · Utilities',
    note: 'TPRM questionnaires require Starter+.',
    area: 'backend/frontend',
  },
  'tprm': {
    tiers: '🔴 Starter · Professional · Enterprise · Utilities',
    note: '',
    area: 'backend/frontend',
  },
  'sso': {
    tiers: '🔵 Enterprise · Utilities only',
    note: 'SAML/OIDC SSO requires Enterprise.',
    area: 'backend/frontend',
  },
  'siem': {
    tiers: '🔵 Enterprise · Utilities only',
    note: '',
    area: 'backend/integrations',
  },
  'splunk': {
    tiers: '🔵 Enterprise · Utilities only',
    note: '',
    area: 'backend/integrations',
  },
  'platform & administration': {
    tiers: '🔵 Internal / Platform Admin only',
    note: 'Accessible only to platform owners (Conteh Consulting LLC).',
    area: 'backend/frontend',
  },
  'platform administration': {
    tiers: '🔵 Internal / Platform Admin only',
    note: 'Accessible only to platform owners.',
    area: 'backend/frontend',
  },
  'billing': {
    tiers: '🔴 Starter · Professional · Enterprise · Utilities',
    note: 'Stripe integration — not applicable to Free tier.',
    area: 'backend/frontend',
  },
  'multi-agent': {
    tiers: '🔴 Professional · Enterprise · Utilities',
    note: 'Multi-agent orchestration requires Professional+.',
    area: 'backend',
  },
  'rag knowledge': {
    tiers: '🔴 Professional · Enterprise · Utilities',
    note: 'Vector knowledge base requires Professional+.',
    area: 'backend',
  },
  'reasoning memory': {
    tiers: '🔴 Professional · Enterprise · Utilities',
    note: '',
    area: 'backend',
  },
  'ai platform': {
    tiers: '🟡 Free (10 req/mo, BYOK) · Starter (50 req/mo) · Professional+ (Unlimited)',
    note: 'Advanced features (Multi-Agent, RAG, Reasoning Memory) require Professional+.',
    area: 'backend/frontend',
  },
  'financial services': {
    tiers: '🔵 Utilities tier only',
    note: 'FINRA, SEC, SR 11-7 compliance — Utilities tier exclusively.',
    area: 'backend/frontend',
  },
  'marketing': {
    tiers: '⚙️ Internal / Infrastructure',
    note: 'SEO and marketing pages are public but not a platform feature.',
    area: 'frontend',
  },
  'ci/cd': {
    tiers: '⚙️ Internal / Infrastructure — not tier-gated.',
    note: '',
    area: 'ci/cd',
  },
  'release management': {
    tiers: '⚙️ Internal / Infrastructure — not tier-gated.',
    note: '',
    area: 'ci/cd',
  },
  'security': {
    tiers: '🟢 All tiers — security patches apply platform-wide.',
    note: '⚠️ Action required: update to this version to receive all security fixes.',
    area: 'backend/frontend',
  },
  'frontend': {
    tiers: '🟢 All tiers',
    note: 'UX and accessibility improvements visible across all plans.',
    area: 'frontend',
  },
};

// Technical context appended to matching bullets — helps engineers know
// what files/systems are involved.
const BULLET_CONTEXT = [
  {
    match: /migration\s+\d+|migration\b.*table/i,
    tag: '`📦 DB migration required`',
  },
  {
    match: /^-.*new.*endpoint|new.*route|added.*endpoint/i,
    tag: '`🔌 New API endpoint`',
  },
  {
    match: /breaking change/i,
    tag: '`⚠️ BREAKING CHANGE`',
  },
  {
    match: /deprecated|will be removed/i,
    tag: '`🕐 Deprecation notice`',
  },
  {
    match: /\bwebhook/i,
    tag: '`🔔 Webhook event`',
  },
  {
    match: /stripe/i,
    tag: '`💳 Stripe integration`',
  },
  {
    match: /codeql|gitleaks|sarif/i,
    tag: '`🛡️ Security tooling`',
  },
];

// ─── CM release management helpers ───────────────────────────────────────────

/**
 * Build the CM-compliant release branch name for a version.
 * Format: release/CW-<number>/<version>  — the CW number is advisory only
 * since it's not derivable from CHANGELOG.
 */
function cmBranchName (version) {
  return `release/${version}`;
}

/** Build the CM-compliant tag name. */
function cmTagName (version) {
  return `v${version}`;
}

/** Build the CM-compliant commit message for the release notes commit. */
function cmCommitMessage (version) {
  return `docs(release): generate internal release notes for v${version} [skip ci]`;
}

// ─── CHANGELOG parsing ────────────────────────────────────────────────────────

function readChangelog () {
  const p = path.join(ROOT, 'CHANGELOG.md');
  if (!fs.existsSync(p)) {
    console.error('::error::CHANGELOG.md not found at', p);
    process.exit(1);
  }
  return fs.readFileSync(p, 'utf8');
}

/**
 * Parse CHANGELOG.md into version blocks.
 * Returns [{ version, date, lines }]
 */
function parseChangelog (content) {
  const blocks = [];
  let current  = null;

  for (const raw of content.split('\n')) {
    const line = raw.trimEnd();

    const vMatch = line.match(/^## \[([^\]]+)\](?:\s*[—–-]\s*(.+))?$/);
    if (vMatch) {
      if (current) blocks.push(current);
      current = { version: vMatch[1], date: vMatch[2] || '', lines: [] };
      continue;
    }

    // Stop the current block at any other ## heading (trailing sections)
    if (/^## /.test(line) && current) {
      blocks.push(current);
      current = null;
      continue;
    }

    if (current) current.lines.push(line);
  }
  if (current) blocks.push(current);

  return blocks;
}

// ─── Section enrichment ───────────────────────────────────────────────────────

/** Look up tier metadata for a #### section heading. */
function getTierMeta (heading) {
  const lower = heading.toLowerCase();
  for (const [key, meta] of Object.entries(SECTION_TIERS)) {
    if (lower.includes(key)) return meta;
  }
  // Default — unclassified
  return {
    tiers: '🟢 All tiers',
    note: '',
    area: 'backend/frontend',
  };
}

/** Optionally append a technical inline tag after a matching bullet. */
function tagBullet (bullet) {
  for (const rule of BULLET_CONTEXT) {
    if (rule.match.test(bullet)) {
      return `${bullet}  <!-- ${rule.tag} -->`;
    }
  }
  return bullet;
}

/**
 * Collect all migration references from a block's lines.
 * Returns an array of strings like "Migration 085: rmf_packages, …"
 */
function extractMigrations (lines) {
  const migrations = [];
  for (const line of lines) {
    const m = line.match(/[Mm]igration\s+(\d+)[:\s]+(.+)/);
    if (m) migrations.push(`**Migration ${m[1]}**: ${m[2].trim()}`);
  }
  return migrations;
}

/**
 * Collect lines that look like breaking-change notices.
 */
function extractBreakingChanges (lines) {
  const breaking = [];
  for (const line of lines) {
    if (/breaking change|BREAKING/i.test(line)) {
      breaking.push(line.replace(/^[-*]\s*/, '').trim());
    }
  }
  return breaking;
}

/**
 * Collect lines that look like deprecation notices.
 */
function extractDeprecations (lines) {
  return lines.filter(l => /deprecated|will be removed/i.test(l));
}

/**
 * Build the enriched lines for a version block.
 */
function buildVersionSection (block) {
  const out = [];

  let   currentSectionHeading = '';
  let   currentSectionMeta    = null;
  let   headerEmitted         = false;

  for (const line of block.lines) {
    // ### level — Added / Changed / Fixed / Security / Deprecated
    if (/^### /.test(line)) {
      if (currentSectionMeta && !headerEmitted) {
        // Safety flush — should not happen but guard anyway
      }
      currentSectionHeading = '';
      currentSectionMeta    = null;
      headerEmitted         = false;
      out.push(line);
      continue;
    }

    // #### level — feature area
    if (/^#### /.test(line)) {
      currentSectionHeading = line.replace(/^####\s*/, '');
      currentSectionMeta    = getTierMeta(currentSectionHeading);
      headerEmitted         = false;

      out.push(line);
      out.push('');
      // Tier badge
      out.push(`> **Tier:** ${currentSectionMeta.tiers}`);
      if (currentSectionMeta.note) {
        out.push(`> ${currentSectionMeta.note}`);
      }
      out.push(`> **Affected area:** \`${currentSectionMeta.area}\``);
      out.push('');

      headerEmitted = true;
      continue;
    }

    // Bullet points — tag with technical context inline
    if (/^- /.test(line)) {
      out.push(tagBullet(line));
    } else {
      out.push(line);
    }
  }

  return out;
}

/**
 * Build the tier availability summary table for a version.
 * Uses counts of sections per tier classification.
 */
function buildTierSummaryTable (lines) {
  const counts = {
    community: 0,
    pro: 0,
    enterprise: 0,
    govcloud: 0,
    internal: 0,
  };

  for (const line of lines) {
    if (/^#### /.test(line)) {
      const heading = line.replace(/^####\s*/, '');
      const meta    = getTierMeta(heading);
      const t       = meta.tiers.toLowerCase();
      if (t.includes('internal') || t.includes('infrastructure')) {
        counts.internal++;
      } else if (t.includes('govcloud') && !t.includes('pro') && !t.includes('enterprise') && !t.includes('community') && !t.includes('all tiers')) {
        // Gov Cloud-only feature (no standard tier path)
        counts.govcloud++;
      } else if (t.includes('community') || t.includes('free') || t.includes('all tiers')) {
        counts.community++;
      } else if (t.includes('pro') || t.includes('starter')) {
        counts.pro++;
      } else if (t.includes('enterprise') || t.includes('professional')) {
        counts.enterprise++;
      } else {
        counts.community++; // fallback
      }
    }
  }

  return [
    '### 📊 Tier Availability Summary',
    '',
    '| Tier | New/Changed Sections |',
    '|------|---------------------|',
    `| 🟢 Community | ${counts.community} |`,
    `| 🟡 Pro | ${counts.pro} |`,
    `| 🔵 Enterprise | ${counts.enterprise} |`,
    `| ⚙️ Gov Cloud | ${counts.govcloud} |`,
    `| ⚙️ Internal/Infra | ${counts.internal} |`,
    '',
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main () {
  console.log('');
  console.log('📋 ControlWeave — Internal Release Notes Generator');
  console.log(`   Repo root   : ${ROOT}`);
  console.log(`   Output file : ${OUTPUT_FILE}`);
  console.log(`   Version arg : ${VERSION_ARG || '(auto — use top CHANGELOG entry)'}`);
  if (GIT_SHA) console.log(`   Git SHA     : ${GIT_SHA}`);
  if (GIT_REF) console.log(`   Git ref     : ${GIT_REF}`);
  console.log('');

  const changelog = readChangelog();
  const allBlocks = parseChangelog(changelog);

  console.log(`   Parsed ${allBlocks.length} version block(s) from CHANGELOG.md`);

  // ── Determine which blocks to process ─────────────────────────────────────
  let targetBlocks = allBlocks;

  if (VERSION_ARG) {
    // Normalise to bare semver (strip leading 'v') so "v1.0.0" and "1.0.0" both match.
    // Do NOT include [Unreleased] when a specific version is requested — unreleased
    // items should not appear in a versioned release-notes run.
    const v = VERSION_ARG.replace(/^v/, '');
    targetBlocks = allBlocks.filter(b => b.version === v);
    if (targetBlocks.length === 0) {
      console.warn(`::warning::Version ${VERSION_ARG} not found in CHANGELOG.md — processing all blocks.`);
      targetBlocks = allBlocks;
    }
  }

  // ── Build the document ────────────────────────────────────────────────────
  const today  = new Date().toISOString().split('T')[0];
  const docLines = [
    '# ControlWeave Internal Release Notes',
    '',
    '> **⚠️ INTERNAL — PRIVATE REPOSITORY ONLY**  ',
    '> This document covers **all tiers** (Free through Utilities) and is **not** mirrored to the',
    '> public ControlWeave repository. It is generated automatically from `CHANGELOG.md` by',
    '> `.github/scripts/generate-internal-release-notes.js` on every release.',
    '>',
    '> For public-facing (community-tier only) release notes see `PUBLIC_RELEASE_NOTES.md` (generated',
    '> during mirror runs) or the GitHub Release page.',
    '',
    '## CM Release Management Reference',
    '',
    '| Item | Convention |',
    '|------|-----------|',
    '| Branch format | `<type>/CW-<number>/<short-description>` |',
    '| Release branch | `release/CW-<number>/<version>` or `release/<version>` |',
    '| Tag format | `v<major>.<minor>.<patch>` |',
    '| Commit format | `<type>(<scope>): <description>` |',
    '| Merge into | `staging` → `main` |',
    '| Notes commit | `docs(release): generate internal release notes for v<ver> [skip ci]` |',
    '',
    '---',
    '',
  ];

  let versionsProcessed = 0;

  for (const block of targetBlocks) {
    const isUnreleased = block.version === 'Unreleased';
    const version      = isUnreleased ? 'Unreleased' : block.version;
    const tagName      = isUnreleased ? '(not yet tagged)' : cmTagName(version);
    const branchName   = isUnreleased ? 'main / staging' : cmBranchName(version);

    // ── Version heading ───────────────────────────────────────────────────
    docLines.push(isUnreleased
      ? '## [Unreleased]'
      : `## v${version}${block.date ? ` — ${block.date}` : ''}`
    );
    docLines.push('');

    // CM metadata callout
    docLines.push('> | Field | Value |');
    docLines.push('> |-------|-------|');
    if (!isUnreleased) {
      docLines.push(`> | **Version** | \`${version}\` |`);
      docLines.push(`> | **Release date** | ${block.date || today} |`);
      docLines.push(`> | **Tag** | \`${tagName}\` |`);
      docLines.push(`> | **Release branch** | \`${branchName}\` |`);
    } else {
      docLines.push(`> | **Status** | Unreleased — changes staged for next release |`);
    }
    if (GIT_SHA) docLines.push(`> | **Built from** | \`${GIT_SHA}\` |`);
    if (GIT_REF) docLines.push(`> | **Ref** | \`${GIT_REF}\` |`);
    docLines.push('');

    // ── Extract special subsections ───────────────────────────────────────
    const migrations    = extractMigrations(block.lines);
    const breakings     = extractBreakingChanges(block.lines);
    const deprecations  = extractDeprecations(block.lines);

    // ── Breaking changes callout (at the top, before detailed notes) ──────
    if (breakings.length > 0) {
      docLines.push('### ⚠️ Breaking Changes');
      docLines.push('');
      docLines.push('> **Action required** — review the migration steps below before deploying.');
      docLines.push('');
      for (const b of breakings) {
        docLines.push(`- ${b}`);
      }
      docLines.push('');
    }

    // ── Enriched body ─────────────────────────────────────────────────────
    const enrichedLines = buildVersionSection(block);
    docLines.push(...enrichedLines);

    // ── Deprecation callout ───────────────────────────────────────────────
    if (deprecations.length > 0) {
      docLines.push('');
      docLines.push('### 🕐 Deprecation Notices');
      docLines.push('');
      for (const d of deprecations) {
        docLines.push(d.startsWith('-') ? d : `- ${d}`);
      }
    }

    // ── Migration summary ─────────────────────────────────────────────────
    if (migrations.length > 0) {
      docLines.push('');
      docLines.push('### 📦 Database Migrations');
      docLines.push('');
      docLines.push('> Run these migrations in order before starting the updated server.');
      docLines.push('');
      for (const m of migrations) {
        docLines.push(`- ${m}`);
      }
      docLines.push('');
      docLines.push('```bash');
      docLines.push('# Apply all pending migrations');
      docLines.push('cd controlweave/backend && npm run migrate');
      docLines.push('```');
    }

    // ── Tier summary table ────────────────────────────────────────────────
    docLines.push('');
    docLines.push(...buildTierSummaryTable(block.lines));

    docLines.push('');
    docLines.push('---');
    docLines.push('');

    versionsProcessed++;
    console.log(`   ✅  Processed ${version}`);
  }

  if (versionsProcessed === 0) {
    docLines.push('_No release entries found in CHANGELOG.md._');
    docLines.push('');
  }

  docLines.push(`<!-- Generated by generate-internal-release-notes.js on ${new Date().toISOString()} -->`);
  docLines.push(`<!-- CM commit convention: ${cmCommitMessage('<version>')} -->`);

  const content = docLines.join('\n');

  try {
    fs.writeFileSync(OUTPUT_FILE, content + '\n');
  } catch (err) {
    console.error(`::error::Failed to write output file: ${err.message}`);
    process.exit(1);
  }

  console.log('');
  console.log(`📝 Written: ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  console.log(`   Versions processed : ${versionsProcessed}`);
  console.log('');

  // ── GitHub Actions step summary ───────────────────────────────────────────
  if (STEP_SUMMARY) {
    const summary = [
      '## 📋 Internal Release Notes Generated',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| CHANGELOG versions parsed | ${allBlocks.length} |`,
      `| Versions in this output | ${versionsProcessed} |`,
      `| Output file | \`INTERNAL_RELEASE_NOTES.md\` |`,
      '',
      '> Internal release notes cover **all tiers** (Free → Utilities) and are never mirrored publicly.',
      '',
    ];
    try {
      fs.appendFileSync(STEP_SUMMARY, summary.join('\n') + '\n');
    } catch (_) { /* non-fatal */ }
  }
}

main();
