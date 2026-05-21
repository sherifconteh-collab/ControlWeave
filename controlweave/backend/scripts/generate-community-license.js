// @tier: exclude
/**
 * generate-community-license.js
 *
 * Generates a self-signed community license key for this self-hosted
 * ControlWeave installation.  Community tier is free — no sales contact or
 * payment required.
 *
 * What it does:
 *   1. Generates a local RSA-2048 key pair (private key discarded after use).
 *   2. Signs a community-tier JWT license with the private key.
 *   3. Either prints the key + public key to the console (default), or
 *      writes both directly to the server_license database table
 *      (pass --activate to activate without using the API).
 *
 * Usage:
 *
 *   # Print key to console (then paste into the license settings UI):
 *   node scripts/generate-community-license.js
 *
 *   # Activate directly in the database (requires DATABASE_URL):
 *   DATABASE_URL="postgresql://..." node scripts/generate-community-license.js --activate
 *
 * Environment variables:
 *   DATABASE_URL        — required only for --activate mode
 *   PLATFORM_ADMIN_ORG  — optional org name to embed in the licensee field
 *                          (default: "community")
 */

'use strict';

require('dotenv').config();

const { generateCommunityKey, saveLicenseToDb, validateLicenseKey, setLocalPublicKey } = require('../src/services/licenseService');

const activate = process.argv.includes('--activate');
const licensee = (process.env.PLATFORM_ADMIN_ORG || 'community').trim();

async function main() {
  console.log('\n🔑  Generating community license key…\n');

  const { licenseKey, publicKey } = await generateCommunityKey(licensee, -1);

  // Self-validate before printing/activating.
  setLocalPublicKey(publicKey);
  const result = validateLicenseKey(licenseKey);
  if (!result.valid) {
    console.error(`❌  Self-validation failed: ${result.error}`);
    process.exit(1);
  }

  console.log('✅  Community license generated successfully.\n');
  console.log(`   Licensee   : ${result.licensee}`);
  console.log(`   Tier       : ${result.tier}`);
  console.log(`   Seats      : unlimited`);
  console.log(`   Maintenance: ${result.maintenanceUntil || 'N/A'}`);
  console.log('');

  if (activate) {
    if (!process.env.DATABASE_URL) {
      console.error('❌  DATABASE_URL is required for --activate mode.');
      console.error('   Get it from: Railway dashboard → Postgres service → Variables → DATABASE_URL\n');
      process.exit(1);
    }

    const { Pool } = require('pg');
    const sslConfig = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false'
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: true };
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: sslConfig });

    try {
      await saveLicenseToDb(pool, licenseKey, result, null, publicKey);
      console.log('✅  License activated in database. Restart the server to apply.\n');
    } finally {
      await pool.end();
    }
  } else {
    console.log('─────────────────────────────────────────────────────────────────────');
    console.log('Add these to your .env (or Railway Variables):\n');
    console.log(`LICENSE_KEY=${licenseKey}`);
    console.log('');
    console.log(`CONTROLWEAVE_LICENSE_PUBKEY="${publicKey.replace(/\n/g, '\\n')}"`);
    console.log('─────────────────────────────────────────────────────────────────────');
    console.log('');
    console.log('Alternatively, use the Platform Admin UI:');
    console.log('  Settings → License → Generate Community License');
    console.log('');
    console.log('Or activate via the API:');
    console.log('  POST /api/v1/license/generate-community  (platform admin credentials)');
    console.log('');
  }
}

main().catch((err) => {
  console.error(`\n❌  Error: ${err.message}\n`);
  process.exit(1);
});
