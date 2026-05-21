#!/usr/bin/env node

/**
 * Generate Documentation Updates Script
 *
 * Reads feature-changes.json and generates placeholder documentation
 * updates for each affected feature.
 */

const fs = require('fs');
const path = require('path');

const changesPath = path.join(process.cwd(), 'feature-changes.json');

if (!fs.existsSync(changesPath)) {
  console.log('No feature-changes.json found. Skipping doc generation.');
  process.exit(0);
}

const changes = JSON.parse(fs.readFileSync(changesPath, 'utf8'));

if (!changes.features || changes.features.length === 0) {
  console.log('No features changed. Nothing to generate.');
  process.exit(0);
}

const featuresChanged = process.env.FEATURES_CHANGED
  ? JSON.parse(process.env.FEATURES_CHANGED)
  : changes.features.map(f => f.feature);

console.log(`📝 Generating documentation updates for ${featuresChanged.length} feature(s)...\n`);

let updatedCount = 0;

for (const feature of changes.features) {
  if (!feature.docsToUpdate || feature.docsToUpdate.length === 0) {
    continue;
  }

  console.log(`  📦 ${feature.feature}`);

  for (const docPath of feature.docsToUpdate) {
    const fullPath = path.join(process.cwd(), docPath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(fullPath)) {
      console.log(`     ➕ Creating: ${docPath}`);
      const title = path.basename(docPath, '.md').replace(/_/g, ' ');
      fs.writeFileSync(fullPath, `# ${title}\n\n> This document was auto-generated and needs review.\n\nTODO: Add documentation for ${feature.feature}.\n`);
      updatedCount++;
    } else {
      // Append a change note at the end
      const content = fs.readFileSync(fullPath, 'utf8');
      const timestamp = new Date().toISOString().split('T')[0];
      const note = `\n\n---\n*Last updated: ${timestamp} — auto-detected changes in ${feature.feature} (${feature.changeType}).*\n`;

      if (!content.includes(note.trim())) {
        fs.writeFileSync(fullPath, content.trimEnd() + note);
        console.log(`     ✏️  Updated: ${docPath}`);
        updatedCount++;
      } else {
        console.log(`     ⏭️  Skipped (already noted): ${docPath}`);
      }
    }
  }
}

console.log(`\n✅ Documentation generation complete. ${updatedCount} file(s) updated.\n`);
