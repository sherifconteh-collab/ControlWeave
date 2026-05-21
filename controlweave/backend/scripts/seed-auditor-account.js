// @tier: exclude
/**
 * seed-auditor-account.js
 * Creates demo accounts for auditor role users
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

const PASSWORD = 'ControlWeave!2026';

const ACCOUNTS = [
  {
    orgName: 'NovaTech Solutions',
    tier: 'enterprise',
    billingStatus: 'comped',
    email: 'auditor@community.com',
    firstName: 'Cam',
    lastName: 'Auditor',
    role: 'auditor'
  },
  {
    orgName: 'BrightPath Health',
    tier: 'enterprise',
    billingStatus: 'comped',
    email: 'auditor@pro.com',
    firstName: 'Priya',
    lastName: 'Auditor',
    role: 'auditor'
  },
  {
    orgName: 'Meridian Financial Group',
    tier: 'enterprise',
    billingStatus: 'comped',
    email: 'auditor@enterprise.com',
    firstName: 'Audrey',
    lastName: 'Auditor',
    role: 'auditor'
  },
  {
    orgName: 'Vanguard Defense Systems',
    tier: 'enterprise',
    billingStatus: 'comped',
    email: 'auditor@govcloud.com',
    firstName: 'Gina',
    lastName: 'Auditor',
    role: 'auditor'
  }
];

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n🌱 Seeding auditor demo accounts...\n');
    const passwordHash = await bcrypt.hash(PASSWORD, 12);

    for (const acct of ACCOUNTS) {
      await client.query('BEGIN');
      try {
        // Find the org by name
        const orgResult = await client.query(
          'SELECT id FROM organizations WHERE name = $1',
          [acct.orgName]
        );
        
        if (orgResult.rows.length === 0) {
          console.log(`  ✗ Organization not found: ${acct.orgName}`);
          await client.query('ROLLBACK');
          continue;
        }
        
        const orgId = orgResult.rows[0].id;

        // Upsert user (email is unique)
        await client.query(
          `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (email) DO UPDATE
             SET organization_id = EXCLUDED.organization_id,
                 password_hash   = EXCLUDED.password_hash,
                 first_name      = EXCLUDED.first_name,
                 last_name       = EXCLUDED.last_name,
                 role            = EXCLUDED.role`,
          [orgId, acct.email, passwordHash, acct.firstName, acct.lastName, acct.role]
        );

        await client.query('COMMIT');
        console.log(`  ✓ ${acct.role.padEnd(12)} — ${acct.email} (${acct.orgName})`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ Failed for ${acct.email}: ${err.message}`);
      }
    }

    console.log(`\n  Password for all accounts: ${PASSWORD}`);
    console.log('\n✅ Auditor demo accounts ready.\n');
  } finally {
    client.release();
    await pool.end();
  }
}

run();
