const fs = require('fs');
const path = require('path');

/**
 * Auto-review documentation changes
 * This script automatically reviews and acknowledges documentation updates
 * to reduce manual review burden.
 */

async function autoReviewDocumentation() {
  console.log('🤖 Starting automated documentation review...');
  
  // DOCS_TO_REVIEW=all sweeps every tracked markdown file instead of the subset
  // a pipeline run queued. The queued subset is what gates the review issue, but
  // it only ever covers docs whose feature changed — a broken link in any other
  // file stays invisible until that feature happens to be touched. Running the
  // sweep is how the backlog behind this script's own review queue was found.
  const docsToReview = resolveDocList(process.env.DOCS_TO_REVIEW);


  const reviewResults = {
    reviewed: [],
    issues: [],
    timestamp: new Date().toISOString(),
    autoApproved: false
  };

  // Define automated checks
  const checks = [
    { name: 'File Exists', check: checkFileExists },
    { name: 'Valid Markdown', check: checkValidMarkdown },
    { name: 'No Broken Links', check: checkLinks },
    { name: 'Screenshots Referenced', check: checkScreenshotReferences },
    { name: 'Consistent Headers', check: checkHeaders },
    { name: 'Code Blocks Formatted', check: checkCodeBlocks }
  ];

  console.log(`📋 Reviewing ${docsToReview.length} documents...`);

  for (const docPath of docsToReview) {
    console.log(`\n📄 Reviewing: ${docPath}`);
    const docReview = {
      path: docPath,
      checks: [],
      passed: true
    };

    for (const check of checks) {
      try {
        const result = await check.check(docPath);
        docReview.checks.push({
          name: check.name,
          passed: result.passed,
          message: result.message
        });
        
        if (!result.passed) {
          docReview.passed = false;
          console.log(`  ❌ ${check.name}: ${result.message}`);
        } else {
          console.log(`  ✅ ${check.name}`);
        }
      } catch (error) {
        docReview.checks.push({
          name: check.name,
          passed: false,
          message: error.message
        });
        docReview.passed = false;
        console.log(`  ⚠️  ${check.name}: ${error.message}`);
      }
    }

    reviewResults.reviewed.push(docReview);
    
    if (!docReview.passed) {
      reviewResults.issues.push({
        document: docPath,
        failedChecks: docReview.checks.filter(c => !c.passed)
      });
    }
  }

  // Determine if auto-approval is possible
  const allPassed = reviewResults.reviewed.every(r => r.passed);
  reviewResults.autoApproved = allPassed;

  console.log('\n' + '='.repeat(60));
  console.log('📊 Review Summary:');
  console.log(`   Total documents: ${reviewResults.reviewed.length}`);
  console.log(`   Passed: ${reviewResults.reviewed.filter(r => r.passed).length}`);
  console.log(`   Issues: ${reviewResults.issues.length}`);
  console.log(`   Auto-approved: ${reviewResults.autoApproved ? '✅ YES' : '❌ NO'}`);
  console.log('='.repeat(60));

  // Save review results
  fs.writeFileSync(
    'doc-review-results.json',
    JSON.stringify(reviewResults, null, 2)
  );

  // Set GitHub Actions output using environment files (replaces deprecated set-output command)
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `auto_approved=${reviewResults.autoApproved}\n`);
    fs.appendFileSync(githubOutput, `issues_count=${reviewResults.issues.length}\n`);
    fs.appendFileSync(githubOutput, `review_summary=${generateSummary(reviewResults)}\n`);
  } else {
    // Fallback for local testing
    console.log(`auto_approved=${reviewResults.autoApproved}`);
    console.log(`issues_count=${reviewResults.issues.length}`);
    console.log(`review_summary=${generateSummary(reviewResults)}`);
  }

  return reviewResults;
}

/**
 * Turn the DOCS_TO_REVIEW value into a list of document paths.
 *
 * Accepts a JSON array (what the workflow passes) or the literal `all`, which
 * enumerates every tracked markdown file except agent-instruction directories.
 */
function resolveDocList(raw) {
  if (!raw) return [];
  if (raw.trim() === 'all') {
    return require('child_process')
      .execSync('git ls-files "*.md"', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter((f) => f && !f.startsWith('.claude/') && !f.startsWith('.openclaw/'));
  }
  return JSON.parse(raw);
}

/**
 * Classify every line as prose, a fence delimiter, or code-block content.
 *
 * Follows CommonMark's fence rules rather than toggling on every ``` seen:
 *
 * - A fence must start a line (prose that mentions ``` mid-sentence is not one).
 * - A closing fence must be at least as long as the one that opened the block
 *   and carry no info string. That is what lets a ````markdown block quote an
 *   inner ```bash block — a doc-about-docs pattern this repo uses heavily.
 *   Toggling on every fence desynchronizes there and reports the *inverse* of
 *   the truth: code read as prose and prose read as code.
 *
 * Returns one entry per line: { text, isFence, inCode, unclosed }.
 */
function scanFences(content) {
  const lines = content.split('\n');
  let openLength = 0;
  const scanned = lines.map((text) => {
    const match = text.match(/^ {0,3}(`{3,})(.*)$/);
    if (match) {
      const length = match[1].length;
      const info = match[2].trim();
      if (openLength === 0) {
        openLength = length;
        return { text, isFence: true, inCode: true };
      }
      // Only a bare, long-enough run of backticks closes the block.
      if (length >= openLength && info === '') {
        openLength = 0;
        return { text, isFence: true, inCode: true };
      }
      // A shorter or info-bearing fence is just content of the open block.
      return { text, isFence: false, inCode: true };
    }
    return { text, isFence: false, inCode: openLength > 0 };
  });
  const unclosed = openLength > 0;
  return scanned.map((entry) => ({ ...entry, unclosed }));
}

/**
 * Blank out fenced code blocks and inline code spans.
 *
 * A markdown link inside a code block is documentation *about* links — a
 * template, a shell command, or a syntax example — not a link that should
 * resolve. Counting those as broken produced false failures in every file that
 * documents markdown itself (AUTO_REVIEW_SYSTEM.md, WIKI_MAINTENANCE.md,
 * screenshots/README.md), which is what kept the review queue permanently red.
 *
 * Lines are preserved so reported positions stay meaningful.
 */
function stripCode(content) {
  return scanFences(content)
    .map(({ text, inCode }) => {
      if (inCode) return '';
      // Inline code spans: `[text](path)` is an example, not a link.
      return text.replace(/`[^`]*`/g, '');
    })
    .join('\n');
}

/**
 * Resolve a relative link target the way GitHub does when rendering.
 *
 * GitHub wiki pages link to each other without the `.md` extension, and a link
 * to a directory resolves to its README. Requiring the literal path to exist
 * on disk flagged both as broken.
 */
function linkTargetExists(basePath, url) {
  const target = path.join(basePath, url);
  return (
    fs.existsSync(target) ||
    fs.existsSync(`${target}.md`) ||
    fs.existsSync(path.join(target, 'README.md'))
  );
}

// GitHub wiki reserves these filenames for page fragments (sidebar, footer,
// header). They are injected into other pages and correctly have no H1.
const WIKI_FRAGMENTS = new Set(['_Sidebar.md', '_Footer.md', '_Header.md']);

// GitHub issue and PR templates are titled by their YAML front matter (`name:`),
// so requiring an H1 in the body flags the documented convention as a defect.
function isTemplateWithFrontMatter(docPath, content) {
  const normalized = docPath.split(path.sep).join('/');
  const isTemplate =
    normalized.includes('.github/ISSUE_TEMPLATE/') ||
    /(^|\/)(pull_request_template|PULL_REQUEST_TEMPLATE)\.md$/i.test(normalized);
  return isTemplate && content.startsWith('---');
}

function checkFileExists(docPath) {
  const fullPath = path.join(process.cwd(), docPath);
  const exists = fs.existsSync(fullPath);
  return {
    passed: exists,
    message: exists ? 'File exists' : 'File not found'
  };
}

function checkValidMarkdown(docPath) {
  const fullPath = path.join(process.cwd(), docPath);
  if (!fs.existsSync(fullPath)) {
    return { passed: false, message: 'File not found' };
  }

  const content = fs.readFileSync(fullPath, 'utf8');

  // Basic markdown validation
  const hasHeader = /^#\s+.+/m.test(content);
  const notEmpty = content.trim().length > 0;
  const noInvalidChars = !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content);

  const headerExempt =
    WIKI_FRAGMENTS.has(path.basename(docPath)) || isTemplateWithFrontMatter(docPath, content);
  if (!hasHeader && !headerExempt) {
    return { passed: false, message: 'No header found' };
  }
  if (!notEmpty) {
    return { passed: false, message: 'File is empty' };
  }
  if (!noInvalidChars) {
    return { passed: false, message: 'Contains invalid characters' };
  }

  return { passed: true, message: 'Valid markdown structure' };
}

function checkLinks(docPath) {
  const fullPath = path.join(process.cwd(), docPath);
  if (!fs.existsSync(fullPath)) {
    return { passed: false, message: 'File not found' };
  }

  const content = stripCode(fs.readFileSync(fullPath, 'utf8'));

  // Extract markdown links
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links = [...content.matchAll(linkRegex)];

  let brokenLinks = [];

  for (const [fullMatch, text, url] of links) {
    // Skip external URLs, anchors, and mailto/tel links
    if (url.startsWith('http') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      continue;
    }

    if (!linkTargetExists(path.dirname(fullPath), url.split('#')[0])) {
      brokenLinks.push(url);
    }
  }

  return {
    passed: brokenLinks.length === 0,
    message: brokenLinks.length === 0 
      ? `All ${links.length} links valid`
      : `Found ${brokenLinks.length} broken links: ${brokenLinks.slice(0, 3).join(', ')}`
  };
}

function checkScreenshotReferences(docPath) {
  const fullPath = path.join(process.cwd(), docPath);
  if (!fs.existsSync(fullPath)) {
    return { passed: false, message: 'File not found' };
  }

  const content = stripCode(fs.readFileSync(fullPath, 'utf8'));

  // Find image references
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const images = [...content.matchAll(imageRegex)];
  
  if (images.length === 0) {
    // No images is OK - not all docs need screenshots
    return { passed: true, message: 'No screenshots referenced (OK)' };
  }

  let missingImages = [];
  
  for (const [fullMatch, alt, url] of images) {
    // Skip external URLs
    if (url.startsWith('http')) {
      continue;
    }
    
    // Check if image file exists
    const imagePath = path.join(path.dirname(fullPath), url);
    if (!fs.existsSync(imagePath)) {
      missingImages.push(url);
    }
  }

  return {
    passed: missingImages.length === 0,
    message: missingImages.length === 0
      ? `All ${images.length} screenshots found`
      : `Missing ${missingImages.length} screenshots`
  };
}

function checkHeaders(docPath) {
  const fullPath = path.join(process.cwd(), docPath);
  if (!fs.existsSync(fullPath)) {
    return { passed: false, message: 'File not found' };
  }

  const content = fs.readFileSync(fullPath, 'utf8');

  let headerLevels = [];
  let issues = [];

  // Shared fence scanner, so a shell `# comment` inside a nested code block is
  // never mistaken for a heading.
  for (const { text, inCode } of scanFences(content)) {
    if (inCode) continue;
    const line = text;

    const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      headerLevels.push(level);
      
      // Check for header level skipping (e.g., H1 -> H3)
      if (headerLevels.length > 1) {
        const prevLevel = headerLevels[headerLevels.length - 2];
        if (level > prevLevel + 1) {
          issues.push(`Header level skip: H${prevLevel} -> H${level}`);
        }
      }
    }
  }

  return {
    passed: issues.length === 0,
    message: issues.length === 0
      ? `${headerLevels.length} headers properly structured`
      : issues[0]
  };
}

function checkCodeBlocks(docPath) {
  const fullPath = path.join(process.cwd(), docPath);
  if (!fs.existsSync(fullPath)) {
    return { passed: false, message: 'File not found' };
  }

  const content = fs.readFileSync(fullPath, 'utf8');

  // Ask the fence scanner whether a block is still open at end of file. A raw
  // parity count of ``` anywhere in the file reported healthy files as broken:
  // prose describing fences ("blocks have opening ``` and closing ```") counted
  // as markers, and a ````outer block quoting a ```inner one counted as three.
  const scanned = scanFences(content);
  if (scanned.length > 0 && scanned[0].unclosed) {
    return {
      passed: false,
      message: 'Unclosed code block detected'
    };
  }

  const blocks = scanned.filter((entry) => entry.isFence).length / 2;
  return {
    passed: true,
    message: `${blocks} code blocks properly formatted`
  };
}

function generateSummary(results) {
  const passed = results.reviewed.filter(r => r.passed).length;
  const total = results.reviewed.length;
  
  if (results.autoApproved) {
    return `✅ All ${total} documents passed automated review`;
  } else {
    return `⚠️ ${passed}/${total} documents passed - ${results.issues.length} issues found`;
  }
}

// Run if called directly
if (require.main === module) {
  autoReviewDocumentation()
    .then(results => {
      if (!results.autoApproved) {
        process.exit(1); // Exit with error if issues found
      }
    })
    .catch(error => {
      console.error('❌ Auto-review failed:', error);
      process.exit(1);
    });
}

module.exports = { autoReviewDocumentation };
