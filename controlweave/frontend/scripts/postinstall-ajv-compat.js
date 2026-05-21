#!/usr/bin/env node
/**
 * Compatibility shim for ESLint 10 with ajv 8.x
 * Copies json-schema-draft-04.json from ajv 6.x to ajv 8.x node_modules
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const targetDir = path.join(__dirname, '..', 'node_modules', 'ajv', 'lib', 'refs');
const targetFile = path.join(targetDir, 'json-schema-draft-04.json');

// Check if already exists
if (fs.existsSync(targetFile)) {
  console.log('json-schema-draft-04.json already exists, skipping');
  process.exit(0);
}

// Create directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Download the file
const url = 'https://raw.githubusercontent.com/ajv-validator/ajv/v6.12.6/lib/refs/json-schema-draft-04.json';

console.log('Downloading json-schema-draft-04.json for ajv 8.x compatibility...');

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    fs.writeFileSync(targetFile, data);
    console.log('Successfully installed json-schema-draft-04.json compatibility shim');
  });
}).on('error', (err) => {
  // Non-fatal: ajv 6.x already includes this file. Warn and continue.
  console.warn('Could not download json-schema-draft-04.json (non-fatal):', err.message);
});
