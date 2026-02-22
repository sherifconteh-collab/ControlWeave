// paid-tier-check:ignore-file
//
// check-paid-tier.js
// Detects and optionally removes paid-tier / Pro-product references from the
// ControlWeave Community Edition public repository.
//
// Usage:
//   node scripts/check-paid-tier.js          # detect only — exit 1 if violations found
//   node scripts/check-paid-tier.js --fix    # auto-fix violations — exit 1 if any remain
//
// To suppress a specific line, add the comment:  // paid-tier:ignore
// To suppress an entire file, add to the first 10 lines:  // paid-tier:ignore-file

'use strict';

const fs   = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIX_MODE  = process.argv.includes('--fix');

// ─── File selection ───────────────────────────────────────────────────────────

const INCLUDE_EXTENSIONS = new Set([
  '.js', '.ts', '.tsx', '.jsx', '.mjs',
  '.md', '.txt', '.yaml', '.yml', '.example',
]);

const EXCLUDED_DIRS = new Set([
  '.git', '.next', '.next-build', 'node_modules',
  'dist', 'build', 'coverage', 'tmp', '.cache',
]);

const EXCLUDED_FILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'tsconfig.tsbuildinfo',
]);

// Paths that legitimately reference tier names for backend enforcement logic.
// These must not be modified by this script.
const EXCLUDED_PATH_PATTERNS = [
  /(^|[/\\])backend[/\\]src[/\\]config[/\\]tierPolicy\.js$/,
  /(^|[/\\])backend[/\\]src[/\\]middleware[/\\]auth\.js$/,
  /(^|[/\\])backend[/\\]migrations[/\\]/,
  /(^|[/\\])frontend[/\\]src[/\\]lib[/\\]access\.ts$/,       // utility type file
  /(^|[/\\])scripts[/\\]check-paid-tier\.js$/,               // this script itself
  /(^|[/\\])\.github[/\\]workflows[/\\]paid-tier-check\.yml$/, // the workflow for this script
];

// ─── Detection + fix rules ────────────────────────────────────────────────────

// Line-level rules.  Each rule is applied to every line that is not ignored.
//
// fix values:
//   'delete-line'     – remove the entire line from the output
//   'inline-replace'  – call rule.replace(line) and keep the result
//                       (if the result is empty/whitespace, the line is dropped)
//   null              – flag only, no automatic fix applied

const LINE_RULES = [
  {
    id: 'paid.pro-url',
    pattern: /app\.controlweave\.io/,
    description: 'Pro product URL (app.controlweave.io)',
    fix: 'delete-line',
  },
  {
    id: 'paid.pro-env-var',
    pattern: /NEXT_PUBLIC_PRO_URL/,
    description: 'Pro product environment variable (NEXT_PUBLIC_PRO_URL)',
    fix: 'delete-line',
  },
  {
    id: 'paid.pro-product-name',
    pattern: /ControlWeave\s+Pro/,
    description: 'Pro product name reference ("ControlWeave Pro")',
    fix: 'delete-line',
  },
  {
    id: 'paid.pricing',
    pattern: /\$\d+\/mo/,
    description: 'Paid pricing mention (e.g. $49/mo)',
    fix: 'delete-line',
  },
  {
    id: 'paid.min-tier-nav',
    pattern: /\bminTier:\s*['"`](?:starter|professional|enterprise)['"`]/,
    description: 'Paid-tier navigation gate (minTier property on nav item)',
    fix: 'delete-line',
  },
  {
    id: 'paid.has-tier-at-least',
    pattern: /hasTierAtLeast\s*\(\s*\w+\s*,\s*['"`](?:starter|professional|enterprise)['"`]\s*\)/,
    description: 'hasTierAtLeast() guard for paid tier in UI component',
    fix: 'inline-replace',
    replace: (line) =>
      line.replace(
        /hasTierAtLeast\s*\(\s*\w+\s*,\s*['"`](?:starter|professional|enterprise)['"`]\s*\)/g,
        'false'
      ),
  },
  {
    id: 'paid.upgrade-prompt',
    pattern: /upgrade\s+(?:to\s+)?(?:ControlWeave\s+)?\bPro\b/i,
    description: 'Upgrade prompt directing users to Pro product',
    fix: 'delete-line',
  },
];

// File-level (multi-line) transforms applied before line scanning.
// These handle patterns that span multiple lines (e.g. Markdown sections).
const MULTILINE_RULES = [
  {
    id: 'paid.pro-md-section',
    description: 'Markdown section listing ControlWeave Pro features',
    applies: (relPath) => relPath.endsWith('.md'),
    test: (content) => /^##\s+What's in ControlWeave Pro/mi.test(content),
    fix: (content) =>
      content.replace(
        /\n##\s+What's in ControlWeave Pro[\s\S]*?(?=\n---\n|\n## |$)/m,
        ''
      ),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shouldIgnoreLine(line) {
  return /paid-tier:\s*ignore(?:\s|$)/i.test(line);
}

function shouldIgnoreFile(text) {
  const header = String(text).split(/\r?\n/).slice(0, 10).join('\n');
  return /paid-tier:\s*ignore-file/i.test(header);
}

function isExcludedPath(relPath) {
  return EXCLUDED_PATH_PATTERNS.some((p) => p.test(relPath));
}

function collectFiles(dir, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath  = path.relative(REPO_ROOT, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      collectFiles(fullPath, acc);
      continue;
    }

    if (!entry.isFile()) continue;
    if (EXCLUDED_FILES.has(entry.name)) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!INCLUDE_EXTENSIONS.has(ext)) continue;
    if (entry.name.endsWith('.min.js')) continue;
    if (isExcludedPath(relPath)) continue;

    acc.push({ fullPath, relPath });
  }

  return acc;
}

function isLikelyBinary(buf) {
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  return sample.includes(0);
}

function clipSnippet(text) {
  const clean = String(text).trim().replace(/\s+/g, ' ');
  return clean.length <= 160 ? clean : clean.slice(0, 157) + '...';
}

// ─── Per-file processing ──────────────────────────────────────────────────────

function processFile(fullPath, relPath, violations, fixed) {
  let raw;
  try {
    raw = fs.readFileSync(fullPath);
  } catch {
    return;
  }

  if (isLikelyBinary(raw)) return;
  let content = raw.toString('utf8');
  if (shouldIgnoreFile(content)) return;

  let contentChanged = false;

  // 1. Apply multi-line rules first (whole-file transforms)
  for (const rule of MULTILINE_RULES) {
    if (!rule.applies(relPath)) continue;
    if (!rule.test(content)) continue;

    if (FIX_MODE) {
      const patched = rule.fix(content);
      if (patched !== content) {
        content = patched;
        contentChanged = true;
        fixed.push({ file: relPath, rule: rule.id, description: rule.description });
      }
    } else {
      violations.push({ file: relPath, line: 0, rule: rule.id, description: rule.description, snippet: '' });
    }
  }

  // 2. Apply line-level rules
  // Detect the line separator used by this file so we can preserve it on write.
  const lineEnding  = content.includes('\r\n') ? '\r\n' : '\n';
  const inputLines  = content.split(/\r?\n/);
  const outputLines = [];
  let lineChanged   = false;

  for (let i = 0; i < inputLines.length; i++) {
    const origLine = inputLines[i];

    if (shouldIgnoreLine(origLine)) {
      outputLines.push(origLine);
      continue;
    }

    let currentLine = origLine;
    let lineDropped = false;

    for (const rule of LINE_RULES) {
      if (!rule.pattern.test(currentLine)) continue;

      if (!FIX_MODE || rule.fix === null) {
        // Detect-only (or unfixable rule)
        violations.push({
          file: relPath,
          line: i + 1,
          rule: rule.id,
          description: rule.description,
          snippet: clipSnippet(currentLine),
          fixable: rule.fix !== null,
        });
        if (!FIX_MODE) break; // only need first match per line for reporting
        continue;
      }

      if (rule.fix === 'delete-line') {
        lineDropped = true;
        lineChanged = true;
        fixed.push({ file: relPath, line: i + 1, rule: rule.id, description: rule.description });
        break; // line is gone, no further rules apply
      }

      if (rule.fix === 'inline-replace') {
        const patched = rule.replace(currentLine);
        if (patched.trim() === '') {
          // Replacement left nothing meaningful — drop the line
          lineDropped = true;
          lineChanged = true;
          fixed.push({ file: relPath, line: i + 1, rule: rule.id, description: rule.description });
          break;
        }
        if (patched !== currentLine) {
          currentLine = patched;
          lineChanged = true;
          fixed.push({ file: relPath, line: i + 1, rule: rule.id, description: rule.description });
        }
      }
    }

    if (!lineDropped) {
      outputLines.push(currentLine);
    } else {
      contentChanged = true;
    }
  }

  // Check if any in-line replacements occurred
  if (lineChanged) {
    contentChanged = true;
  }

  if (FIX_MODE && contentChanged) {
    const newContent = outputLines.join(lineEnding);
    fs.writeFileSync(fullPath, newContent, 'utf8');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const files = collectFiles(REPO_ROOT);

  const violations = []; // detected but not fixed
  const fixed      = []; // detected and auto-fixed

  for (const { fullPath, relPath } of files) {
    processFile(fullPath, relPath, violations, fixed);
  }

  // Report auto-fixes
  if (fixed.length > 0) {
    console.log(`\nAuto-fixed (${fixed.length}):`);
    for (const f of fixed) {
      const loc = f.line ? `:${f.line}` : '';
      console.log(`  [FIXED] ${f.file}${loc}  (${f.rule})`);
      console.log(`          ${f.description}`);
    }
  }

  // Report remaining violations
  if (violations.length > 0) {
    console.log(`\nViolations found (${violations.length}):`);
    for (const v of violations) {
      const loc       = v.line ? `:${v.line}` : '';
      const fixLabel  = v.fixable === false ? ' [manual fix required]' : '';
      console.log(`  [FAIL${fixLabel}] ${v.file}${loc}  (${v.rule})`);
      console.log(`           ${v.description}`);
      if (v.snippet) console.log(`           ${v.snippet}`);
    }
  }

  // Summary
  console.log('\nPaid-tier scan summary:');
  console.log(`  Files scanned : ${files.length}`);
  console.log(`  Auto-fixed    : ${fixed.length}`);
  console.log(`  Remaining     : ${violations.length}`);
  console.log(`  Fix mode      : ${FIX_MODE ? 'on' : 'off'}`);

  if (violations.length > 0) {
    if (!FIX_MODE) {
      console.log('\nRun with --fix to auto-remove violations where possible.');
    } else {
      console.log('\nThe violations above could not be auto-fixed and require manual review.');
    }
    process.exit(1);
  }

  if (fixed.length > 0) {
    console.log('\nAll paid-tier references have been removed.');
  } else {
    console.log('\nNo paid-tier references found. Repository is clean.');
  }

  process.exit(0);
}

main();
