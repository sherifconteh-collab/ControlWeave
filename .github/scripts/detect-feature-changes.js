#!/usr/bin/env node

/**
 * Feature Change Detection Script
 *
 * Analyzes git diff to detect which features have changed and determines
 * which documentation needs to be updated.
 *
 * Always writes feature-changes.json on every code path so downstream
 * workflow steps never hit an ENOENT error.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load feature-to-docs mapping
const mappingPath = path.join(__dirname, '..', 'feature-docs-map.json');
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

/**
 * Convert a glob-style pattern to a proper RegExp.
 * Escapes regex-special characters first, then converts glob wildcards.
 */
function globToRegex(pattern) {
  const escaped = pattern
    .replace(/[\\^$+?.()|[\]{}]/g, '\\$&')  // escape all regex-special chars
    .replace(/\*\*/g, '\0')                   // placeholder for **
    .replace(/\*/g, '[^/]*')                  // single * = any within one segment
    .replace(/\0/g, '.*');                    // ** = any across segments
  return new RegExp(escaped);
}

/**
 * Test whether a file path matches any of the given glob patterns.
 */
function matchesAny(file, patterns) {
  return patterns.some(p => globToRegex(p).test(file));
}

/**
 * Build a results object and write it to feature-changes.json + GH outputs.
 */
function writeResults(features, docsNeeded, changeType) {
  const results = {
    features,
    docsNeeded,
    changeType: changeType || 'none',
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync('feature-changes.json', JSON.stringify(results, null, 2));

  if (process.env.GITHUB_OUTPUT) {
    const featureNames = features.map(f => f.feature);
    const docsToReview = [...new Set(features.flatMap(f => Array.isArray(f.docsToUpdate) ? f.docsToUpdate : []))];
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `features=${JSON.stringify(featureNames)}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `docs_to_review=${JSON.stringify(docsToReview)}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `docs_needed=${docsNeeded}\n`);
  }

  return results;
}

/**
 * Get changed files from git
 */
function getChangedFiles() {
  try {
    const diff = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' });
    return diff.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('Error getting changed files:', error.message);
    return [];
  }
}

/**
 * Get commit messages since last tag or last 10 commits
 */
function getRecentCommits() {
  try {
    const commits = execSync('git log --pretty=format:"%s" -10', { encoding: 'utf8' });
    return commits.trim().split('\n');
  } catch (error) {
    console.error('Error getting commits:', error.message);
    return [];
  }
}

/**
 * Detect change type based on patterns
 */
function detectChangeType(changedFiles, commits) {
  const { changeDetectionRules } = mapping;
  
  // Check for major changes
  for (const pattern of changeDetectionRules.major.patterns) {
    if (commits.some(msg => msg.toLowerCase().includes(pattern.toLowerCase()))) {
      return 'major';
    }
  }
  
  // Check for file removals (major change)
  if (changedFiles.some(file => {
    try {
      return !fs.existsSync(file);
    } catch {
      return false;
    }
  })) {
    return 'major';
  }
  
  // Check for minor changes (new features)
  for (const pattern of changeDetectionRules.minor.patterns) {
    if (commits.some(msg => msg.toLowerCase().includes(pattern.toLowerCase()))) {
      return 'minor';
    }
  }
  
  // Check for UI changes
  if (changedFiles.some(file => 
    changeDetectionRules['ui-change'].filePatterns.some(pattern =>
      globToRegex(pattern).test(file)
    )
  )) {
    return 'ui-change';
  }
  
  return 'patch';
}

/**
 * Match changed files to features
 */
function matchFeatures(changedFiles) {
  const affectedFeatures = new Map();
  
  for (const [featureName, featureConfig] of Object.entries(mapping.featureMapping)) {
    const { codePatterns, documentation, screenshots } = featureConfig;
    
    // Check if any changed file matches this feature's code patterns
    const isAffected = changedFiles.some(file => matchesAny(file, codePatterns));
    
    if (isAffected) {
      affectedFeatures.set(featureName, {
        feature: featureName,
        codePatterns: codePatterns.filter(pattern =>
          changedFiles.some(file => globToRegex(pattern).test(file))
        ),
        docsToUpdate: documentation,
        screenshotsNeeded: screenshots,
        changedFiles: changedFiles.filter(file => matchesAny(file, codePatterns))
      });
    }
  }
  
  return affectedFeatures;
}

/**
 * Determine if UI changes require screenshots
 */
function needsScreenshots(feature, changedFiles, changeType) {
  if (changeType === 'ui-change') {
    return true;
  }
  
  // Check if frontend files were changed
  const frontendFiles = changedFiles.filter(file =>
    file.includes('/frontend/') || file.endsWith('.tsx') || file.endsWith('.jsx')
  );
  
  return frontendFiles.length > 0;
}

/**
 * Main detection logic
 */
function detectChanges() {
  console.log('🔍 Detecting feature changes...\n');
  
  const changedFiles = getChangedFiles();
  const commits = getRecentCommits();
  
  if (changedFiles.length === 0) {
    console.log('No files changed.');
    return writeResults([], false, 'none');
  }
  
  console.log(`📝 Changed files: ${changedFiles.length}`);
  console.log(`📋 Recent commits: ${commits.length}\n`);
  
  const changeType = detectChangeType(changedFiles, commits);
  console.log(`🏷️  Change type detected: ${changeType}\n`);
  
  const affectedFeatures = matchFeatures(changedFiles);
  
  if (affectedFeatures.size === 0) {
    console.log('✅ No feature changes detected that require documentation updates.');
    return writeResults([], false, changeType);
  }
  
  console.log(`🎯 Features affected: ${affectedFeatures.size}\n`);
  
  const featureChanges = [];
  
  for (const [featureName, featureData] of affectedFeatures) {
    const screenshotsRequired = needsScreenshots(featureName, featureData.changedFiles, changeType);
    
    const change = {
      feature: featureName,
      changeType: changeType,
      docsToUpdate: featureData.docsToUpdate,
      screenshotsNeeded: screenshotsRequired ? featureData.screenshotsNeeded : [],
      changedFiles: featureData.changedFiles,
      codePatterns: featureData.codePatterns
    };
    
    featureChanges.push(change);
    
    console.log(`  📦 ${featureName}`);
    console.log(`     Type: ${changeType}`);
    console.log(`     Files: ${change.changedFiles.length}`);
    console.log(`     Docs: ${change.docsToUpdate.length}`);
    console.log(`     Screenshots: ${screenshotsRequired ? '✅ Required' : '❌ Not required'}`);
    console.log('');
  }
  
  const results = writeResults(featureChanges, featureChanges.length > 0, changeType);
  
  console.log('✅ Detection complete. Results written to feature-changes.json\n');
  
  return results;
}

// Run detection
if (require.main === module) {
  try {
    detectChanges();
  } catch (error) {
    console.error('❌ Error during detection:', error);
    process.exit(1);
  }
}

module.exports = { detectChanges, matchFeatures, detectChangeType };
