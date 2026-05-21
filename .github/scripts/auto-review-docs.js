const fs = require('fs');
const path = require('path');

/**
 * Auto-review documentation changes
 * This script automatically reviews and acknowledges documentation updates
 * to reduce manual review burden.
 */

async function autoReviewDocumentation() {
  console.log('🤖 Starting automated documentation review...');
  
  const docsToReview = process.env.DOCS_TO_REVIEW 
    ? JSON.parse(process.env.DOCS_TO_REVIEW) 
    : [];
  
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

  if (!hasHeader) {
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

  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Extract markdown links
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links = [...content.matchAll(linkRegex)];
  
  let brokenLinks = [];
  
  for (const [fullMatch, text, url] of links) {
    // Skip external URLs, anchors, and mailto/tel links
    if (url.startsWith('http') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      continue;
    }
    
    // Check if relative file path exists
    const linkPath = path.join(path.dirname(fullPath), url.split('#')[0]);
    if (!fs.existsSync(linkPath)) {
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

  const content = fs.readFileSync(fullPath, 'utf8');
  
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
  const lines = content.split('\n');
  
  let headerLevels = [];
  let issues = [];
  let inCodeBlock = false;
  
  for (const line of lines) {
    // Track fenced code blocks so we skip # comments inside them
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

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
  
  // Count code block markers
  const codeBlockMarkers = (content.match(/```/g) || []).length;
  
  // Must be even (opening and closing)
  if (codeBlockMarkers % 2 !== 0) {
    return {
      passed: false,
      message: 'Unclosed code block detected'
    };
  }

  return {
    passed: true,
    message: `${codeBlockMarkers / 2} code blocks properly formatted`
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
