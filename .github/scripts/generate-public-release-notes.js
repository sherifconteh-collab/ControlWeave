#!/usr/bin/env node
/**
 * generate-public-release-notes.js
 *
 * Generates PUBLIC_RELEASE_NOTES.md for the public (community) mirror.
 *
 * Only features available on the Free tier are included.  Paid-tier sections
 * (CMDB, Vulnerability management, Threat Intelligence, Vendor Risk, SSO/SIEM,
 * Platform Administration, Billing, Real-time features, Multi-Agent AI, RAG
 * Knowledge Base, Reasoning Memory) are silently dropped so the public mirror
 * never surfaces content that implies paid entitlements.
 *
 * The output is intentionally richer than a raw CHANGELOG dump — each section
 * gains context callouts, tier badges, and getting-started hints so community
 * users immediately understand what they can do and where to find documentation.
 *
 * Usage (called by public-mirror.yml):
 *   node .github/scripts/generate-public-release-notes.js
 *
 * Environment variables (all optional):
 *   GITHUB_WORKSPACE  — repo root (defaults to two levels up from this script)
 *   OUTPUT_FILE       — path for the generated file (default: PUBLIC_RELEASE_NOTES.md in root)
 *   GITHUB_STEP_SUMMARY — appended with a summary table when set (GitHub Actions)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Configuration ────────────────────────────────────────────────────────────

const ROOT        = process.env.GITHUB_WORKSPACE || path.resolve(__dirname, '../..');
const OUTPUT_FILE = process.env.OUTPUT_FILE
  ? path.resolve(process.env.OUTPUT_FILE)
  : path.join(ROOT, 'PUBLIC_RELEASE_NOTES.md');
const STEP_SUMMARY = process.env.GITHUB_STEP_SUMMARY || '';

// ─── Free-tier section taxonomy ───────────────────────────────────────────────
//
// Section headings (#### level) that appear in CHANGELOG.md are matched against
// the lists below.  A heading matches if any keyword appears in the lower-cased
// heading text.
//
// FREE_SECTIONS  — always included verbatim + enriched
// PAID_SECTIONS  — always excluded (silently dropped)
//
// Unrecognized sections default to EXCLUDED so paid-only content is never
// accidentally published.  The script emits a warning for any section that
// falls into this catch-all — add it to FREE_SECTION_KEYWORDS if it should
// appear in the public mirror.

const FREE_SECTION_KEYWORDS = [
  'compliance framework',
  'framework',
  'control',
  'assessment',
  'evidence',
  'audit',
  'policy',
  'poam',
  'notification',
  'dashboard',
  'report',
  'settings',
  'authentication',
  'user',
  'role',
  'rbac',
  'api',
  'mcp',
  'help',
  'ci/cd',
  'release management',
  'frontend',
  'security',        // security fixes are always public
  'rmf',             // RMF lifecycle is in the community edition
  'ai platform',     // included — paid bullets are filtered at bullet level
];

const PAID_SECTION_KEYWORDS = [
  'cmdb',
  'asset management',
  'sbom',
  'aibom',
  'vulnerability',
  'threat intelligence',
  'vendor risk',
  'tprm',
  'sso',
  'siem',
  'splunk',
  'platform & administration',
  'platform administration',
  'billing',
  'stripe',
  'real-time',
  'multi-agent',
  'rag knowledge',
  'reasoning memory',
  'marketing',
];

// ─── Paid-feature bullet-level filter ────────────────────────────────────────
//
// Even within an included (free-tier) section some individual bullets describe
// paid features.  Any bullet whose lowercased text matches one of these
// patterns is silently dropped.

const PAID_BULLET_PATTERNS = [
  /multi-agent orchestrat/i,
  /rag knowledge base/i,
  /reasoning memory/i,
  /multi-model ai router/i,
  /threat intelligence/i,
  /vendor risk/i,
  /\btprm\b/i,
  /vulnerability tracking/i,
  /\bsplunk\b/i,
  /\bsso\b/i,
  /\bsiem\b/i,
  /regulatory news/i,
  /sbom|aibom/i,
  /stripe\b/i,
  /billing flow/i,
  /platform admin/i,
  /tier-based user seat/i,
  /feature flags.*subscription/i,
  /subscription.*trial/i,
  /govcloud tier.*pricing/i,
  /real-time features/i,
  /cmdb import/i,
  /vulnerability badges/i,
  /auditor demo account/i,
];

// Per-section prose that is prepended to entries to make the notes richer.
// Keys are lowercase substrings of the heading.
const SECTION_CONTEXT = {
  'rmf': {
    icon: '🔵',
    context: 'The **RMF Lifecycle** module walks your team through the full NIST SP 800-37 Rev 2 process — from system categorization through authorization and continuous monitoring — without leaving ControlWeave.',
    tip: '**Getting started:** Navigate to *RMF Lifecycle* in the sidebar (visible once you activate NIST 800-53, NIST 800-171, or CMMC 2.0).',
  },
  'compliance framework': {
    icon: '📋',
    context: 'ControlWeave supports **25+ compliance frameworks** out of the box. Free-tier organizations can activate up to 2 frameworks simultaneously and benefit from automatic crosswalk mappings between them.',
    tip: '**Getting started:** Go to *Frameworks* in the sidebar → click *Activate* on any framework to begin.',
  },
  'framework': {
    icon: '📋',
    context: 'ControlWeave supports **25+ compliance frameworks** out of the box. Free-tier organizations can activate up to 2 frameworks simultaneously and benefit from automatic crosswalk mappings between them.',
    tip: '**Getting started:** Go to *Frameworks* in the sidebar → click *Activate* on any framework to begin.',
  },
  'control': {
    icon: '🔧',
    context: '**Controls** are the heart of every compliance program. ControlWeave tracks implementation status, assigns owners, links evidence, and surfaces health scores so your team always knows where gaps exist.',
    tip: '**Getting started:** Open any active framework → drill into a control family → update implementation notes directly in the control detail view.',
  },
  'assessment': {
    icon: '📝',
    context: '**Assessments** let you conduct structured compliance evaluations against your active frameworks using NIST-standard outcomes (Satisfied / Other Than Satisfied / Not Applicable). Free users get Basic-depth assessments.',
    tip: '**Getting started:** Go to *Assessments* → *New Assessment* → choose your framework and depth.',
  },
  'evidence': {
    icon: '📁',
    context: '**Evidence** ties real-world artefacts (documents, screenshots, exports) directly to controls, giving auditors confidence that your compliance posture is substantiated — not just self-attested.',
    tip: '**Getting started:** Open any control → scroll to the Evidence panel → upload a file or paste a URL.',
  },
  'audit': {
    icon: '🔍',
    context: 'The immutable **Audit Log** records every evidence submission, status change, and user action so you always have a defensible timeline for regulators and external reviewers.',
    tip: '**Getting started:** *Settings* → *Audit Log* to search and export the event history.',
  },
  'policy': {
    icon: '📄',
    context: '**Policy management** lets you draft, version, and map organizational policies to the controls they satisfy. The AI-powered policy generator can produce a first draft from a control description in seconds.',
    tip: '**Getting started:** Go to *Controls* → select a control → click *Generate Policy* (requires an AI API key).',
  },
  'poam': {
    icon: '📌',
    context: '**Plan of Action & Milestones (POA&M)** tracks every identified weakness, assigns remediation owners, and provides a deadline-driven view that satisfies FISMA and NIST reporting requirements.',
    tip: '**Getting started:** Go to *POA&M* in the sidebar → *New Item* → link it to the relevant control.',
  },
  'notification': {
    icon: '🔔',
    context: '**Notifications** keep your team aware of control status changes, assessment completions, and approaching due dates — delivered in-app and optionally via email.',
    tip: '**Getting started:** Click the bell icon in the top-right corner to view and manage notifications.',
  },
  'dashboard': {
    icon: '📊',
    context: 'The **Dashboard** gives you an at-a-glance view of your compliance posture across all active frameworks — compliance score trends, control health distribution, evidence coverage, and priority action items.',
    tip: '**Getting started:** The dashboard is your home page after login. Use the framework selector at the top to filter by a specific framework.',
  },
  'report': {
    icon: '📈',
    context: '**Reports** let you export compliance summaries, control status grids, and evidence coverage tables in PDF or CSV format — ready to hand off to auditors or leadership.',
    tip: '**Getting started:** Go to *Reports* in the sidebar → choose a report type → configure filters → export.',
  },
  'settings': {
    icon: '⚙️',
    context: '**Settings** cover organization profile, user seats, role assignments, LLM configuration (BYOK), and notification preferences — all scoped to your organization.',
    tip: '**Getting started:** Go to *Settings* from the sidebar or the top-right avatar menu.',
  },
  'authentication': {
    icon: '🔐',
    context: '**Authentication** uses email/password login with bcrypt hashing and short-lived JWT access tokens backed by secure refresh tokens. WebAuthn (passkey) support is in progress.',
    tip: '**Getting started:** Register at `/register` or log in at `/login`. All sessions expire automatically after inactivity.',
  },
  'user': {
    icon: '👥',
    context: '**User management** lets organization admins invite up to 5 seats on the Free tier, assign built-in roles (Admin / ISSE / Auditor / Read-Only), and enforce RBAC at the API layer.',
    tip: '**Getting started:** *Settings* → *Users* → *Invite User*.',
  },
  'rbac': {
    icon: '🛡️',
    context: '**RBAC** enhancements give admins finer-grained control over what each role can read or write, including the ability to clone an existing role as a starting point.',
    tip: '**Getting started:** *Settings* → *Roles* to view or clone role definitions.',
  },
  'api': {
    icon: '🔌',
    context: 'The **REST API** follows OpenAPI 3.1 and is fully documented at `/docs/openapi.yaml`. Every endpoint requires a JWT bearer token and respects your organization\'s tier limits.',
    tip: '**Getting started:** See `docs/openapi.yaml` or run the local dev server and visit `http://localhost:3001/api-docs`.',
  },
  'mcp': {
    icon: '🤖',
    context: 'The **MCP (Model Context Protocol) server** exposes ControlWeave data as structured context that AI coding assistants and LLM tools can query — enabling AI-native compliance workflows.',
    tip: '**Getting started:** Run `npm run mcp` in the backend directory. See `docs/MCP_SETUP.md` for integration guides.',
  },
  'help': {
    icon: '💡',
    context: 'The **Help Center** provides contextual in-app documentation, quick-start guides, and links to the public wiki — reducing onboarding friction for new team members.',
    tip: '**Getting started:** Click the *?* icon in the sidebar to open the Help Center.',
  },
  'security': {
    icon: '🔒',
    context: 'Security fixes are applied across all tiers. The following improvements shipped in this release to harden the platform against identified vulnerabilities.',
    tip: '**Action required:** Update to this version to benefit from all security patches.',
  },
  'ci/cd': {
    icon: '🚀',
    context: '**CI/CD and Release Management** improvements keep the development pipeline reliable and auditable — branch naming enforcement, automated release notes, and hardened security scanning.',
    tip: '**Getting started:** See `.github/workflows/` for the full pipeline definitions.',
  },
  'release management': {
    icon: '🚀',
    context: '**CI/CD and Release Management** improvements keep the development pipeline reliable and auditable.',
    tip: '',
  },
  'frontend': {
    icon: '🎨',
    context: '**Frontend** improvements include UX polish, accessibility fixes, and performance enhancements visible across all tiers.',
    tip: '',
  },
  'ai platform': {
    icon: '🤖',
    context: 'ControlWeave ships with a **built-in AI layer** that any user can activate with their own API key (BYOK). Free users receive **10 AI requests per month** across gap analysis, policy generation, crosswalk optimization, compliance forecasting, and remediation playbooks.',
    tip: '**Getting started:** Go to *Settings* → *LLM Configuration* → enter your API key for Anthropic, OpenAI, Gemini, Grok, Groq, or Ollama.',
  },
};

// Rich description appended after each individual bullet for known free keywords.
// These are matched against the lowercased bullet text.
const BULLET_ENRICHMENT = [
  {
    match: /crosswalk/i,
    badge: '> 🔗 **Crosswalk mapping** automatically surfaces overlapping controls across frameworks so you comply once and satisfy many.\n',
  },
  {
    match: /gap analysis/i,
    badge: '> 🎯 **Gap analysis** compares your current implementation status against a target framework baseline and lists missing controls.\n',
  },
  {
    match: /compliance forecast/i,
    badge: '> 📈 **Compliance forecast** projects your score trajectory given your current remediation velocity.\n',
  },
  {
    match: /policy generator/i,
    badge: '> 📄 **Policy generator** drafts a policy document from a control description using your configured LLM — edit and publish in minutes.\n',
  },
  {
    match: /remediation playbook/i,
    badge: '> 🛠️ **Remediation playbook** generates step-by-step implementation guidance for any control gap.\n',
  },
  {
    match: /ai copilot/i,
    badge: '> 💬 **AI Copilot** is an org-aware conversational assistant. Free users get 10 requests/month with a BYOK API key.\n',
  },
  {
    match: /mcp/i,
    badge: '> 🤖 **MCP server** lets AI coding tools (Cursor, GitHub Copilot, Claude Desktop) query your compliance data as structured context.\n',
  },
  {
    match: /rbac|role/i,
    badge: '> 🛡️ **RBAC** is enforced at the API layer — every endpoint checks the caller\'s role permissions before returning data.\n',
  },
  {
    match: /audit trail|audit log|immutable log/i,
    badge: '> 🗂️ **Audit trail** entries are immutable and include the acting user, timestamp, affected resource, and change delta.\n',
  },
  {
    // Match "evidence" as a standalone feature noun; exclude references to
    // database constructs, UI widget descriptions, and status indicators.
    match: (text) => {
      if (!/\bevidence\b/i.test(text)) return false;
      return !/\b(table|schema|column|sql|_items|_count|upload widget|status badge)\b/i.test(text);
    },
    badge: '> 📎 **Evidence** can be uploaded as files (PDF, DOCX, XLSX, images) or linked as external URLs and is versioned automatically.\n',
  },
];

// Tier availability badge appended at the top of every free-tier section.
const TIER_BADGE = `> ✅ **Tier availability:** Free · Starter · Professional · Enterprise\n`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Read the CHANGELOG.md from the repo root. */
function readChangelog () {
  const p = path.join(ROOT, 'CHANGELOG.md');
  if (!fs.existsSync(p)) {
    console.error('::error::CHANGELOG.md not found at', p);
    process.exit(1);
  }
  return fs.readFileSync(p, 'utf8');
}

/**
 * Parse CHANGELOG.md into an array of version blocks.
 * Each block: { version, date, lines: string[] }
 */
function parseChangelog (content) {
  const blocks  = [];
  let current   = null;

  for (const raw of content.split('\n')) {
    const line = raw.trimEnd();

    // Match: ## [Unreleased] or ## [0.3.0] — 2026-02-18
    const vMatch = line.match(/^## \[([^\]]+)\](?:\s*[—–-]\s*(.+))?$/);
    if (vMatch) {
      if (current) blocks.push(current);
      current = { version: vMatch[1], date: vMatch[2] || '', lines: [] };
      continue;
    }

    // Stop the current block at any other ## heading (e.g. trailing sections)
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

/** Decide whether a #### section heading is free-tier, paid-tier, or uncategorized. */
function classifySection (heading) {
  const lower = heading.toLowerCase();
  if (PAID_SECTION_KEYWORDS.some(k => lower.includes(k))) return 'paid';
  if (FREE_SECTION_KEYWORDS.some(k => lower.includes(k))) return 'free';
  return 'unknown';
}

/**
 * Enrich a single bullet point with an optional supplemental callout block.
 * Returns the bullet unchanged if no enrichment rule matches.
 */
function enrichBullet (bullet) {
  for (const rule of BULLET_ENRICHMENT) {
    const matches = typeof rule.match === 'function'
      ? rule.match(bullet)
      : rule.match.test(bullet);
    if (matches) {
      return bullet + '\n' + rule.badge;
    }
  }
  return bullet;
}

/**
 * Given the lines of a version block, filter to only free-tier #### sections
 * and return enriched markdown lines.
 */
function filterAndEnrichBlock (lines) {
  const output       = [];
  let   sectionClass = 'free';  // top-level ### headers are always kept
  let   sectionCtx   = null;
  let   sectionEmitted = false;
  const unknownSections = [];

  for (const line of lines) {
    // ### level — change type (Added, Changed, Fixed, Security) — always keep
    if (/^### /.test(line)) {
      output.push(line);
      sectionClass    = 'free';
      sectionCtx      = null;
      sectionEmitted  = false;
      continue;
    }

    // #### level — feature section — classify
    if (/^#### /.test(line)) {
      const heading = line.replace(/^####\s*/, '');
      sectionClass  = classifySection(heading);

      if (sectionClass === 'unknown') {
        unknownSections.push(heading);
        // Default-exclude — drop heading + all subsequent bullets and warn
        sectionCtx     = null;
        sectionEmitted = false;
        continue;
      }

      if (sectionClass === 'paid') {
        sectionCtx     = null;
        sectionEmitted = false;
        continue;   // drop heading + all subsequent bullets
      }

      // Free section: look up context enrichment
      const ctxKey = Object.keys(SECTION_CONTEXT).find(k => heading.toLowerCase().includes(k));
      sectionCtx    = ctxKey ? SECTION_CONTEXT[ctxKey] : null;
      sectionEmitted = false;

      // Emit the heading with optional icon
      const icon = sectionCtx ? sectionCtx.icon + ' ' : '';
      output.push(`#### ${icon}${heading}`);
      output.push('');
      output.push(TIER_BADGE);

      if (sectionCtx && sectionCtx.context) {
        output.push(sectionCtx.context);
        output.push('');
      }

      sectionEmitted = true;
      continue;
    }

    // Skip content that belongs to a paid or unrecognized section
    if (sectionClass === 'paid' || sectionClass === 'unknown') continue;

    // Bullet or blank line — keep and optionally enrich
    if (/^- /.test(line)) {
      // Drop bullets that describe paid-tier-only features
      if (PAID_BULLET_PATTERNS.some(p => p.test(line))) continue;
      output.push(enrichBullet(line));
    } else {
      output.push(line);
    }
  }

  if (unknownSections.length > 0) {
    console.warn('::warning::Unrecognized CHANGELOG sections (excluded by default — add to FREE_SECTION_KEYWORDS if free-tier):', unknownSections.join(', '));
  }

  // Append "Getting started" tips after each section's bullets
  // (We rebuild output once more to insert tips at section boundaries)
  return insertTips(output);
}

/**
 * Post-process output lines to inject "Getting started" tips at the end of
 * each #### section (before the next ### or #### heading).
 */
function insertTips (lines) {
  const result      = [];
  let   pendingTip  = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // When we hit a new heading, flush the pending tip first
    if (/^(###|####) /.test(line) && pendingTip) {
      result.push('');
      result.push(pendingTip);
      pendingTip = null;
    }

    result.push(line);

    // Capture the tip for the current #### section
    if (/^#### /.test(line)) {
      // Look ahead to find the section context
      const heading = line.replace(/^####\s*[^\w]*/, '');
      const ctxKey  = Object.keys(SECTION_CONTEXT).find(k => heading.toLowerCase().includes(k));
      const ctx     = ctxKey ? SECTION_CONTEXT[ctxKey] : null;
      pendingTip    = ctx && ctx.tip ? `> 💡 ${ctx.tip}` : null;
    }
  }

  // Flush any remaining tip at end of block
  if (pendingTip) {
    result.push('');
    result.push(pendingTip);
  }

  return result;
}

/**
 * Remove runs of 3+ blank lines that can result from dropped sections.
 */
function collapseBlankLines (lines) {
  const out = [];
  let   blanks = 0;
  for (const l of lines) {
    if (l.trim() === '') {
      blanks++;
      if (blanks <= 2) out.push(l);
    } else {
      blanks = 0;
      out.push(l);
    }
  }
  return out;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main () {
  console.log('');
  console.log('📦 ControlWeave — Public Release Notes Generator');
  console.log(`   Repo root   : ${ROOT}`);
  console.log(`   Output file : ${OUTPUT_FILE}`);
  console.log('');

  const changelog  = readChangelog();
  const allBlocks  = parseChangelog(changelog);

  console.log(`   Parsed ${allBlocks.length} version block(s) from CHANGELOG.md`);

  // ── Build the public release notes document ───────────────────────────────
  const docLines = [
    '# ControlWeave Community Edition — Release Notes',
    '',
    '> This document contains release notes for features available on the **Free tier** of ControlWeave.',
    '> Premium-only features (CMDB, Vulnerability Management, Threat Intelligence, Vendor Risk,',
    '> Enterprise Integrations, etc.) are excluded.',
    '>',
    '> For the full changelog see the private repository. For upgrade information visit',
    '> [controlweave.com/pricing](https://controlweave.com/pricing).',
    '',
    '---',
    '',
  ];

  let versionsIncluded = 0;

  for (const block of allBlocks) {
    const heading = block.version === 'Unreleased'
      ? '## [Unreleased]'
      : `## [${block.version}]${block.date ? ` — ${block.date}` : ''}`;

    const filtered = filterAndEnrichBlock(block.lines);
    // Strip any trailing horizontal rule the CHANGELOG itself has between blocks
    const trimmed   = filtered.filter((l, i, arr) => {
      if (l === '---') {
        // Drop if it's the last non-empty line in the block
        const rest = arr.slice(i + 1).filter(x => x.trim() !== '');
        return rest.length > 0;
      }
      return true;
    });
    const collapsed = collapseBlankLines(trimmed);

    // Skip versions where all sections were paid (nothing left after filtering)
    const hasContent = collapsed.some(l => /^- /.test(l) || /^#### /.test(l));
    if (!hasContent) {
      console.log(`   ⏭  Skipped ${block.version} — no free-tier content after filtering.`);
      continue;
    }

    docLines.push(heading);
    if (block.date) {
      docLines.push('');
      docLines.push(`> **Released:** ${block.date}`);
    }
    docLines.push('');
    docLines.push(...collapsed);
    docLines.push('');
    docLines.push('---');
    docLines.push('');

    versionsIncluded++;
    console.log(`   ✅  Included ${block.version}`);
  }

  if (versionsIncluded === 0) {
    docLines.push('_No versioned release notes are available yet for the community edition._');
    docLines.push('');
  }

  docLines.push(`<!-- Generated by generate-public-release-notes.js on ${new Date().toISOString()} -->`);

  const content = docLines.join('\n');
  fs.writeFileSync(OUTPUT_FILE, content + '\n');

  console.log('');
  console.log(`📝 Written: ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  console.log(`   Versions included : ${versionsIncluded} / ${allBlocks.length}`);
  console.log('');

  // ── GitHub Actions step summary ───────────────────────────────────────────
  if (STEP_SUMMARY) {
    const summary = [
      '## 📦 Public Release Notes Generated',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| CHANGELOG versions parsed | ${allBlocks.length} |`,
      `| Versions included (free-tier content) | ${versionsIncluded} |`,
      `| Output file | \`PUBLIC_RELEASE_NOTES.md\` |`,
      '',
      '> Only Free-tier features are included. Paid-only sections are automatically excluded.',
      '',
    ];
    try {
      fs.appendFileSync(STEP_SUMMARY, summary.join('\n') + '\n');
    } catch (_) { /* non-fatal */ }
  }
}

main();
