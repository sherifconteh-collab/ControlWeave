#!/usr/bin/env node

/**
 * Update Feature Map Script
 *
 * Updates feature-docs-map.json with metadata from the latest
 * documentation generation run (timestamps, last change type, etc.).
 */

const fs = require('fs');
const path = require('path');

const changesPath = path.join(process.cwd(), 'feature-changes.json');
const mappingPath = path.join(__dirname, '..', 'feature-docs-map.json');

if (!fs.existsSync(changesPath)) {
  console.log('No feature-changes.json found. Skipping feature map update.');
  process.exit(0);
}

if (!fs.existsSync(mappingPath)) {
  console.log('No feature-docs-map.json found. Skipping.');
  process.exit(0);
}

const changes = JSON.parse(fs.readFileSync(changesPath, 'utf8'));
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

if (!changes.features || changes.features.length === 0) {
  console.log('No features changed. Feature map unchanged.');
  process.exit(0);
}

console.log('🗺️  Updating feature-docs-map.json...\n');

let updated = false;

for (const feature of changes.features) {
  const entry = mapping.featureMapping[feature.feature];
  if (!entry) {
    console.log(`  ⚠️  Feature "${feature.feature}" not found in mapping — skipping.`);
    continue;
  }

  entry.lastUpdated = new Date().toISOString();
  entry.lastChangeType = feature.changeType;
  updated = true;
  console.log(`  ✅ ${feature.feature}: recorded ${feature.changeType} update`);
}

if (updated) {
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2) + '\n');
  console.log('\n✅ Feature map updated.\n');
} else {
  console.log('\nNo updates applied to feature map.\n');
}
