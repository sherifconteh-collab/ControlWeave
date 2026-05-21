#!/usr/bin/env node
/**
 * check-doc-staleness.js
 *
 * Scans all Markdown files in the repository and reports stale content.
 *
 * Staleness criteria
 *   - A "Last Updated" date found in the file is older than STALE_DAYS (default 180).
 *   - The file references a version string that predates the current release recorded
 *     in the top-most `## [x.y.z]` entry of CHANGELOG.md.
 *
 * Outputs
 *   - doc-staleness-report.json  (machine-readable, relative to repo root)
 *   - Human-readable summary on stdout
 *   - GitHub Actions step-summary via $GITHUB_STEP_SUMMARY when available
 *   - Exit 0 always (stale docs are a warning, not a hard failure)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Configuration ────────────────────────────────────────────────────────────

const STALE_DAYS    = parseInt(process.env.STALE_DAYS || '180', 10);
const ROOT          = process.env.GITHUB_WORKSPACE || path.resolve(__dirname, '../..');
const REPORT_FILE   = path.join(ROOT, 'doc-staleness-report.json');
const STEP_SUMMARY  = process.env.GITHUB_STEP_SUMMARY || '';

const SKIP_DIRS = new Set(['node_modules', '.git', 'mirror-export', 'dist', '.next', 'build', 'coverage']);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract the most recent released version from CHANGELOG.md, e.g. "2.1.0". */
function getCurrentVersion () {
  const changelog = path.join(ROOT, 'CHANGELOG.md');
  if (!fs.existsSync(changelog)) return null;
  const content = fs.readFileSync(changelog, 'utf8');
  // Matches lines like: ## [2.1.0] — 2026-02-19  OR  ## [2.1.0] - 2026-02-19
  const match = content.match(/^## \[(\d+\.\d+\.\d+)\]/m);
  return match ? match[1] : null;
}

/** Recursively collect all .md files under `dir`, skipping SKIP_DIRS. */
function findMarkdownFiles (dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return results;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

/** Compare two semver strings. Returns negative if a < b, 0 if equal, positive if a > b. */
function compareSemver (a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Inspect a single file and return any staleness issues. */
function checkFile (filePath, currentVersion) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return { path: path.relative(ROOT, filePath), issues: [] };
  }

  const relPath = path.relative(ROOT, filePath);
  const issues  = [];

  // ── 1. Check "Last Updated" date ──────────────────────────────────────────
  const datePatterns = [
    /\*\*Last Updated[:\s]+(\d{4}-\d{2}-\d{2})\*\*/i,
    /Last Updated[:\s]+(\d{4}-\d{2}-\d{2})/i,
    /\*\*?Maintained.*?(\d{4}-\d{2}-\d{2})\*\*?/i,
    />\s*\*\*Last Updated:\*\*\s*(\d{4}-\d{2}-\d{2})/i,
  ];
  for (const pattern of datePatterns) {
    const m = content.match(pattern);
    if (m) {
      const dateStr = m[1];
      const ageDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
      if (ageDays > STALE_DAYS) {
        issues.push({
          type     : 'stale_date',
          severity : 'warning',
          message  : `"Last Updated" is ${ageDays} days old (${dateStr}; threshold: ${STALE_DAYS} days)`,
        });
      }
      break; // only check the first date found
    }
  }

  // ── 2. Outdated version references ────────────────────────────────────────
  if (currentVersion) {
    // Collect all vX.Y.Z tokens in the file
    const allRefs = [...content.matchAll(/v(\d+\.\d+\.\d+)/g)].map(m => m[1]);
    const outdated = [...new Set(allRefs)].filter(v => compareSemver(v, currentVersion) < 0);

    if (outdated.length > 0) {
      // Only flag if the file also seems to reference "current"/"latest" near the version
      const flagged = outdated.filter(v => {
        const idx = content.indexOf(`v${v}`);
        const ctx = content.slice(Math.max(0, idx - 80), idx + 80);
        return /\b(current|latest|version|release|running|installed)\b/i.test(ctx);
      });
      if (flagged.length > 0) {
        issues.push({
          type     : 'version_mismatch',
          severity : 'info',
          message  : `References older version(s) ${flagged.map(v => `v${v}`).join(', ')} near "current/latest" context (current: v${currentVersion})`,
        });
      }
    }
  }

  return { path: relPath, issues };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main () {
  const currentVersion = getCurrentVersion();

  console.log('');
  console.log('📄 ControlWeave -- Document Staleness Check');
  console.log(`   Repo root        : ${ROOT}`);
  console.log(`   Current version  : ${currentVersion || 'unknown (CHANGELOG.md not found)'}`);
  console.log(`   Stale threshold  : ${STALE_DAYS} days`);
  console.log('');

  const allFiles = findMarkdownFiles(ROOT);
  console.log(`   Scanning ${allFiles.length} Markdown files …\n`);

  const staleResults = [];
  for (const filePath of allFiles) {
    const result = checkFile(filePath, currentVersion);
    if (result.issues.length > 0) {
      staleResults.push(result);
      console.log(`⚠️  ${result.path}`);
      for (const issue of result.issues) {
        console.log(`     [${issue.severity.toUpperCase()}] ${issue.message}`);
      }
    }
  }

  // ── Write JSON report ──────────────────────────────────────────────────────
  const report = {
    generatedAt      : new Date().toISOString(),
    currentVersion   : currentVersion || null,
    staleDaysThreshold: STALE_DAYS,
    totalScanned     : allFiles.length,
    staleCount       : staleResults.length,
    results          : staleResults,
  };
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  // ── Console summary ────────────────────────────────────────────────────────
  console.log('');
  console.log('📊 Summary');
  console.log(`   Total scanned   : ${allFiles.length}`);
  console.log(`   Stale / flagged : ${staleResults.length}`);
  console.log(`   Report saved    : ${path.relative(process.cwd(), REPORT_FILE)}`);
  console.log('');

  if (staleResults.length > 0) {
    console.log(`::warning::${staleResults.length} document(s) may be stale. Review doc-staleness-report.json for details.`);
  } else {
    console.log('✅ All documents appear fresh.');
  }

  // ── GitHub Actions step summary ────────────────────────────────────────────
  if (STEP_SUMMARY) {
    const lines = [
      '## 📄 Document Staleness Report',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Files scanned | ${allFiles.length} |`,
      `| Stale / flagged | ${staleResults.length} |`,
      `| Current version | ${currentVersion ? `v${currentVersion}` : 'unknown'} |`,
      `| Stale threshold | ${STALE_DAYS} days |`,
      '',
    ];

    if (staleResults.length === 0) {
      lines.push('✅ **All documents are fresh — no staleness issues detected.**');
    } else {
      lines.push('### ⚠️ Flagged Documents', '');
      for (const r of staleResults) {
        lines.push(`#### \`${r.path}\``);
        for (const issue of r.issues) {
          lines.push(`- **[${issue.severity.toUpperCase()}]** ${issue.message}`);
        }
        lines.push('');
      }
    }

    try {
      fs.appendFileSync(STEP_SUMMARY, lines.join('\n') + '\n');
    } catch (_) {
      // Non-fatal if summary file is not writable
    }
  }
}

try {
  main();
} catch (err) {
  console.warn(`::warning::Document staleness check encountered an unexpected error: ${err.message}`);
  // Exit 0 — this check is advisory only and must never fail the workflow.
  process.exit(0);
}

