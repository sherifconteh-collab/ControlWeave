#!/usr/bin/env node
/**
 * sync-doc-content.js
 *
 * Scans all Markdown (.md) and HTML (.html) docs in the repo and auto-fixes
 * known stale patterns:
 *
 *   1. Release badge version in README.md files
 *   2. version fields in controlweave/backend/package.json and frontend/package.json
 *   3. Old product tier names (Free→Community, Starter→Pro, Professional→Pro,
 *      Utilities→Gov Cloud & Advisory) — skips lines referencing external providers
 *   4. Migration-count wording that implies strict sequencing
 *
 * Environment variables
 *   DRY_RUN — 'true' reports what would change without writing any files (default: false)
 *
 * Outputs
 *   doc-sync-report.json           — machine-readable summary of all changes
 *   GitHub Actions step summary    — via $GITHUB_STEP_SUMMARY when available
 *   Exit 0 always                  — this is an advisory/maintenance tool
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Configuration ─────────────────────────────────────────────────────────────

const DRY_RUN     = process.env.DRY_RUN === 'true';
const ROOT        = process.env.GITHUB_WORKSPACE || path.resolve(__dirname, '../..');
const REPORT_FILE = path.join(ROOT, 'doc-sync-report.json');
const STEP_SUMMARY = process.env.GITHUB_STEP_SUMMARY || '';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'mirror-export', 'dist', '.next', 'build',
  'coverage', '.openclaw', 'uploads',
]);

// Lines containing these patterns reference external AI providers, external
// services, or LLM-provider comparison table headers; tier-name rules are
// skipped for such lines to avoid false positives.
// Groups: URLs, AI-studio domains, known provider subdomains, and the
// "| Provider |" column header that marks LLM provider comparison tables.
const EXTERNAL_PROVIDER_RE =
  /https?:\/\/|aistudio\.|console\.groq|platform\.openai|anthropic\.com|xai\.com|groq\.com|openai\.com|huggingface\.|console\.anthropic|\|\s*Provider\s*\|/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read the canonical product version.
 * Priority: top `## vX.Y.Z` in RELEASE_NOTES.md → backend package.json
 */
function getCanonicalVersion () {
  const rnPath = path.join(ROOT, 'RELEASE_NOTES.md');
  if (fs.existsSync(rnPath)) {
    const m = fs.readFileSync(rnPath, 'utf8').match(/^## v(\d+\.\d+\.\d+)/m);
    if (m) return m[1];
  }
  const pkgPath = path.join(ROOT, 'controlweave', 'backend', 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || null;
    } catch (_) {}
  }
  return null;
}

/**
 * Find the highest numbered migration file prefix (e.g. '097').
 */
function getHighestMigrationPrefix () {
  const dir = path.join(ROOT, 'controlweave', 'backend', 'migrations');
  if (!fs.existsSync(dir)) return null;
  const nums = fs.readdirSync(dir)
    .map(f => { const m = f.match(/^(\d+)/); return m ? parseInt(m[1], 10) : null; })
    .filter(n => n !== null);
  if (!nums.length) return null;
  return String(Math.max(...nums)).padStart(3, '0');
}

/** Recursively collect .md and .html files, skipping SKIP_DIRS. */
function findDocFiles (dir) {
  const results = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (_) { return results; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...findDocFiles(full));
    } else if (e.isFile() && /\.(md|html)$/i.test(e.name)) {
      results.push(full);
    }
  }
  return results;
}

// ─── Rule helpers ─────────────────────────────────────────────────────────────

/**
 * Apply a simple global regex replacement across the entire file content.
 * Returns { newContent, count } where count is number of substitutions made.
 */
function applyGlobal (content, pattern, replacement) {
  let count = 0;
  const newContent = content.replace(pattern, (...args) => {
    count++;
    return typeof replacement === 'function' ? replacement(...args) : replacement;
  });
  return { newContent, count };
}

/**
 * Apply a line-level replacement, skipping lines that match `skipLineRe`.
 * Returns { newContent, count }.
 */
function applyPerLine (content, pattern, replacement, skipLineRe) {
  let count = 0;
  const newContent = content
    .split('\n')
    .map(line => {
      if (skipLineRe && skipLineRe.test(line)) return line;
      return line.replace(pattern, (...args) => {
        count++;
        return typeof replacement === 'function' ? replacement(...args) : replacement;
      });
    })
    .join('\n');
  return { newContent, count };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main () {
  const version        = getCanonicalVersion();
  const migrationMax   = getHighestMigrationPrefix();

  console.log('');
  console.log('🔄 ControlWeave — Doc Content Sync');
  console.log(`   Repo root          : ${ROOT}`);
  console.log(`   Canonical version  : ${version || 'unknown'}`);
  console.log(`   Highest migration  : ${migrationMax ? migrationMax : 'unknown'}`);
  console.log(`   Mode               : ${DRY_RUN ? 'DRY RUN (read-only)' : 'WRITE'}`);
  console.log('');

  // ── Build per-file rules ───────────────────────────────────────────────────

  // Rules: { description, matchFile, apply }
  // apply(content, filePath) → { newContent, count }
  const rules = [];

  // 1. Release badge in README.md files
  if (version) {
    rules.push({
      description: `Release badge → v${version}`,
      matchFile: f => path.basename(f) === 'README.md',
      apply: (content) => applyGlobal(
        content,
        /img\.shields\.io\/badge\/Release-v\d+\.\d+\.\d+-green/g,
        `img.shields.io/badge/Release-v${version}-green`,
      ),
    });

    // 2. package.json version fields (backend + frontend only)
    const PKG_TARGETS = [
      path.join(ROOT, 'controlweave', 'backend', 'package.json'),
      path.join(ROOT, 'controlweave', 'frontend', 'package.json'),
    ].map(p => p.toLowerCase());

    rules.push({
      description: `package.json "version" → ${version}`,
      matchFile: f => PKG_TARGETS.includes(f.toLowerCase()),
      apply: (content) => applyGlobal(
        content,
        /"version":\s*"\d+\.\d+\.\d+"/,
        `"version": "${version}"`,
      ),
    });

    // 2b. Top version heading in controlweave/docs/RELEASE_NOTES.md
    const DOCS_RN = path.join(ROOT, 'controlweave', 'docs', 'RELEASE_NOTES.md');
    rules.push({
      description: `docs/RELEASE_NOTES.md top version → ${version}`,
      matchFile: f => f === DOCS_RN,
      apply: (content) => {
        // Only update the first "## Version X.Y.Z" heading to the canonical version
        const newContent = content.replace(
          /^(## Version )\d+\.\d+\.\d+/m,
          `$1${version}`,
        );
        return { newContent, count: content !== newContent ? 1 : 0 };
      },
    });

    // 2c. Release badge in controlweave/README.md
    const README_BADGE = path.join(ROOT, 'controlweave', 'README.md');
    rules.push({
      description: `controlweave/README.md release badge → v${version}`,
      matchFile: f => f === README_BADGE,
      apply: (content) => {
        const newContent = content.replace(
          /(https:\/\/img\.shields\.io\/badge\/Release-v)\d+\.\d+\.\d+(-[a-z]+\.svg)/g,
          `$1${version}$2`,
        );
        return { newContent, count: content !== newContent ? 1 : 0 };
      },
    });
  }

  // 3. Tier name corrections (line-level, skip external-provider lines)
  const tierRules = [
    // Markdown bold + table cells
    { pattern: /\*\*Free Tier\*\*/g,           replacement: '**Community Tier**',            description: 'Free Tier (bold) → Community Tier' },
    { pattern: /\*\*Free tier\*\*/g,           replacement: '**Community tier**',            description: 'Free tier (bold) → Community tier' },
    { pattern: /\|\s*Free\s*\|/g,              replacement: '| Community |',                 description: 'Table cell | Free | → | Community |' },
    { pattern: /\bFree Tier\b/g,              replacement: 'Community Tier',               description: 'Free Tier → Community Tier' },
    { pattern: /\bFree tier\b/g,              replacement: 'Community tier',               description: 'Free tier → Community tier' },
    { pattern: /\*\*Starter Tier\*\*/g,        replacement: '**Pro Tier**',                  description: 'Starter Tier (bold) → Pro Tier' },
    { pattern: /\*\*Starter tier\*\*/g,        replacement: '**Pro tier**',                  description: 'Starter tier (bold) → Pro tier' },
    { pattern: /\|\s*Starter\s*\|/g,           replacement: '| Pro |',                       description: 'Table cell | Starter | → | Pro |' },
    { pattern: /\bStarter Tier\b/g,           replacement: 'Pro Tier',                     description: 'Starter Tier → Pro Tier' },
    { pattern: /\bStarter tier\b/g,           replacement: 'Pro tier',                     description: 'Starter tier → Pro tier' },
    { pattern: /\bStarter\+\b/g,              replacement: 'Pro+',                         description: 'Starter+ → Pro+' },
    { pattern: /\*\*Professional Tier\*\*/g,   replacement: '**Pro Tier**',                  description: 'Professional Tier (bold) → Pro Tier' },
    { pattern: /\*\*Professional tier\*\*/g,   replacement: '**Pro tier**',                  description: 'Professional tier (bold) → Pro tier' },
    { pattern: /\|\s*Professional\s*\|/g,      replacement: '| Pro |',                       description: 'Table cell | Professional | → | Pro |' },
    { pattern: /\bProfessional Tier\b/g,      replacement: 'Pro Tier',                     description: 'Professional Tier → Pro Tier' },
    { pattern: /\bProfessional tier\b/g,      replacement: 'Pro tier',                     description: 'Professional tier → Pro tier' },
    { pattern: /\*\*Utilities Tier\*\*/g,      replacement: '**Gov Cloud & Advisory Tier**', description: 'Utilities Tier (bold) → Gov Cloud & Advisory Tier' },
    { pattern: /\*\*Utilities tier\*\*/g,      replacement: '**Gov Cloud & Advisory tier**', description: 'Utilities tier (bold) → Gov Cloud & Advisory tier' },
    { pattern: /\|\s*Utilities\s*\|/g,         replacement: '| Gov Cloud & Advisory |',      description: 'Table cell | Utilities | → | Gov Cloud & Advisory |' },
    { pattern: /\bUtilities Tier\b/g,         replacement: 'Gov Cloud & Advisory Tier',    description: 'Utilities Tier → Gov Cloud & Advisory Tier' },
    { pattern: /\bUtilities tier\b/g,         replacement: 'Gov Cloud & Advisory tier',    description: 'Utilities tier → Gov Cloud & Advisory tier' },
  ];

  for (const tr of tierRules) {
    rules.push({
      description: tr.description,
      matchFile: f => /\.(md|html)$/i.test(f),
      apply: (content) => applyPerLine(
        content,
        tr.pattern,
        tr.replacement,
        EXTERNAL_PROVIDER_RE,
      ),
    });
  }

  // 4. Migration wording — fix implied strict sequencing
  if (migrationMax) {
    const migrationFixes = [
      // "N sequential SQL migration files" style
      {
        pattern: /\d+\s+sequential\s+SQL\s+migration(?:\s+files)?/gi,
        replacement: `SQL migrations up to ${migrationMax} (applied in lexicographic order)`,
      },
      // "N SQL migration files (run in order)" style
      {
        pattern: /\d+\s+SQL\s+migration\s+files?\s+\(run\s+in\s+order\)/gi,
        replacement: `SQL migrations up to ${migrationMax} (applied in lexicographic order)`,
      },
    ];
    for (const mf of migrationFixes) {
      rules.push({
        description: 'Migration wording: remove implied strict sequence',
        matchFile: f => /\.md$/i.test(f),
        apply: (content) => applyGlobal(content, mf.pattern, mf.replacement),
      });
    }
  }

  // ── Scan and apply ─────────────────────────────────────────────────────────

  const allFiles = findDocFiles(ROOT);
  // Also include the two package.json files if a version rule exists
  if (version) {
    const pkgFiles = [
      path.join(ROOT, 'controlweave', 'backend', 'package.json'),
      path.join(ROOT, 'controlweave', 'frontend', 'package.json'),
    ].filter(f => fs.existsSync(f) && !allFiles.includes(f));
    allFiles.push(...pkgFiles);
  }

  console.log(`   Scanning ${allFiles.length} files …\n`);

  const changed = [];

  for (const filePath of allFiles) {
    const relPath  = path.relative(ROOT, filePath);
    const applicable = rules.filter(r => r.matchFile(filePath));
    if (!applicable.length) continue;

    let content;
    try { content = fs.readFileSync(filePath, 'utf8'); }
    catch (_) { continue; }

    const original = content;
    const fileChanges = [];

    for (const rule of applicable) {
      const { newContent, count } = rule.apply(content, filePath);
      if (count > 0) {
        fileChanges.push({ rule: rule.description, count });
        content = newContent;
      }
    }

    if (fileChanges.length && content !== original) {
      changed.push({ path: relPath, changes: fileChanges });
      console.log(`✏️  ${relPath}`);
      for (const c of fileChanges) {
        console.log(`     ${c.count}× ${c.rule}`);
      }
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, content, 'utf8');
      }
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────

  const report = {
    generatedAt   : new Date().toISOString(),
    dryRun        : DRY_RUN,
    version       : version || null,
    migrationMax  : migrationMax || null,
    totalScanned  : allFiles.length,
    filesChanged  : changed.length,
    changes       : changed,
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  console.log('');
  console.log('📊 Summary');
  console.log(`   Files scanned  : ${allFiles.length}`);
  console.log(`   Files changed  : ${changed.length}${DRY_RUN ? ' (dry run — not written)' : ''}`);
  console.log(`   Report saved   : ${path.relative(process.cwd(), REPORT_FILE)}`);
  console.log('');

  if (changed.length === 0) {
    console.log('✅ All docs are already up to date — nothing to fix.');
  } else if (DRY_RUN) {
    console.log(`ℹ️  Dry run: ${changed.length} file(s) would be updated.`);
    console.log(`::warning::${changed.length} doc file(s) have stale content. Re-run without DRY_RUN to auto-fix.`);
  } else {
    console.log(`✅ Updated ${changed.length} file(s).`);
  }

  // ── GitHub Actions step summary ────────────────────────────────────────────

  if (STEP_SUMMARY) {
    const lines = [
      '## 🔄 Doc Content Sync Report',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Files scanned | ${allFiles.length} |`,
      `| Files updated | ${changed.length} |`,
      `| Canonical version | ${version ? `v${version}` : 'unknown'} |`,
      `| Highest migration | ${migrationMax ? migrationMax : 'unknown'} |`,
      `| Mode | ${DRY_RUN ? '🔍 Dry run' : '✏️ Write'} |`,
      '',
    ];

    if (changed.length === 0) {
      lines.push('✅ **All docs are up to date — nothing to fix.**');
    } else {
      lines.push(`### ${DRY_RUN ? '🔍 Would update' : '✏️ Updated'} ${changed.length} file(s)`, '');
      for (const f of changed) {
        lines.push(`#### \`${f.path}\``);
        for (const c of f.changes) {
          lines.push(`- ${c.count}× ${c.rule}`);
        }
        lines.push('');
      }
    }

    try { fs.appendFileSync(STEP_SUMMARY, lines.join('\n') + '\n'); }
    catch (_) { /* non-fatal */ }
  }
}

try {
  main();
} catch (err) {
  console.warn(`::warning::sync-doc-content.js encountered an unexpected error: ${err.message}`);
  if (err.stack) console.warn(err.stack);
  process.exit(0);
}
