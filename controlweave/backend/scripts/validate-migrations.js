// @tier: community
const path = require('path');
const { validateMigrationDirectory } = require('./lib/migrationValidation');

const migrationsDir = path.join(__dirname, '../migrations');

function fail(message) {
  console.error(`Migration validation failed: ${message}`);
  process.exit(1);
}

function main() {
  const validation = validateMigrationDirectory(migrationsDir);

  if (validation.unsupportedFiles.length > 0) {
    fail(`unsupported migration files detected: ${validation.unsupportedFiles.join(', ')}`);
  }

  if (validation.duplicateBodies.length > 0) {
    const pairs = validation.duplicateBodies
      .map(([first, second]) => `${first} = ${second}`)
      .join('; ');
    fail(`duplicate migration bodies detected: ${pairs}`);
  }

  console.log(`Migration validation passed for ${validation.sqlFiles.length} SQL migrations.`);
}

main();