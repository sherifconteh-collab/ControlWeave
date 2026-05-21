// @tier: community
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getChecksum(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function normalizeMigrationSql(content) {
  return String(content)
    .replace(/^\uFEFF/, '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/'Migration\s+\d+\s+completed\.'/gi, "'Migration completed.'")
    .replace(/\s+/g, ' ')
    .trim();
}

function getNumberedMigrationEntries(migrationsDir) {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => /^\d+/.test(file))
    .sort((a, b) => a.localeCompare(b));
}

function validateMigrationDirectory(migrationsDir) {
  const entries = getNumberedMigrationEntries(migrationsDir);
  const unsupportedFiles = entries.filter((file) => path.extname(file).toLowerCase() !== '.sql');
  const sqlFiles = entries.filter((file) => path.extname(file).toLowerCase() === '.sql');
  const duplicateBodies = [];
  const seenBodies = new Map();

  for (const filename of sqlFiles) {
    const fullPath = path.join(migrationsDir, filename);
    const normalized = normalizeMigrationSql(fs.readFileSync(fullPath, 'utf8'));
    const normalizedChecksum = getChecksum(normalized);
    const existing = seenBodies.get(normalizedChecksum);

    if (existing && existing.normalized === normalized) {
      duplicateBodies.push([existing.filename, filename]);
      continue;
    }

    seenBodies.set(normalizedChecksum, { filename, normalized });
  }

  return {
    entries,
    sqlFiles,
    unsupportedFiles,
    duplicateBodies,
  };
}

module.exports = {
  getChecksum,
  getNumberedMigrationEntries,
  normalizeMigrationSql,
  validateMigrationDirectory,
};