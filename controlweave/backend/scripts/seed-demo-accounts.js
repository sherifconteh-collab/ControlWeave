/**
 * seed-demo-accounts.js
 *
 * Creates one admin account per tier so every tier can be demoed.
 * Idempotent — safe to run multiple times (ON CONFLICT DO NOTHING / DO UPDATE).
 *
 * Accounts created:
 *   admin@professional.com / Test1234!  — professional tier
 *   admin@enterprise.com   / Test1234!  — enterprise tier
 *   admin@starter.com      / Test1234!  — starter tier
 *   admin@free.com         / Test1234!  — free tier
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

const PASSWORD = 'Test1234!';

const ACCOUNTS = [
  {
    orgName: 'Enterprise Solutions Ltd',
    tier: 'professional',
    billingStatus: 'active',
    email: 'admin@professional.com',
    firstName: 'Alice',
    lastName: 'Admin'
  },
  {
    orgName: 'Global Systems Corp',
    tier: 'enterprise',
    billingStatus: 'active',
    email: 'admin@enterprise.com',
    firstName: 'Eve',
    lastName: 'Enterprise'
  },
  {
    orgName: 'TechStart Inc',
    tier: 'starter',
    billingStatus: 'active',
    email: 'admin@starter.com',
    firstName: 'Sam',
    lastName: 'Starter'
  },
  {
    orgName: 'Acme Corp',
    tier: 'free',
    billingStatus: 'free',
    email: 'admin@free.com',
    firstName: 'Fred',
    lastName: 'Free'
  }
];

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n🌱 Seeding demo tier accounts...\n');
    const passwordHash = await bcrypt.hash(PASSWORD, 12);

    for (const acct of ACCOUNTS) {
      await client.query('BEGIN');

      // Upsert org
      const orgRes = await client.query(
        `INSERT INTO organizations (name, tier, billing_status)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE
           SET tier = EXCLUDED.tier,
               billing_status = EXCLUDED.billing_status
         RETURNING id`,
        [acct.orgName, acct.tier, acct.billingStatus]
      );
      const orgId = orgRes.rows[0].id;

      // Upsert user
      await client.query(
        `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5, 'admin')
         ON CONFLICT (email) DO UPDATE
           SET organization_id = EXCLUDED.organization_id,
               password_hash   = EXCLUDED.password_hash,
               first_name      = EXCLUDED.first_name,
               last_name       = EXCLUDED.last_name`,
        [orgId, acct.email, passwordHash, acct.firstName, acct.lastName]
      );

      // Ensure onboarding is marked complete so login goes straight to dashboard
      await client.query(
        `INSERT INTO organization_profiles (organization_id, onboarding_completed, onboarding_completed_at, created_by, updated_by)
         SELECT $1, true, NOW(), u.id, u.id FROM users u WHERE u.email = $2
         ON CONFLICT (organization_id) DO UPDATE
           SET onboarding_completed    = true,
               onboarding_completed_at = COALESCE(organization_profiles.onboarding_completed_at, NOW())`,
        [orgId, acct.email]
      );

      await client.query('COMMIT');
      console.log(`  ✓ ${acct.tier.padEnd(12)} — ${acct.email}`);
    }

    console.log(`\n  Password for all accounts: ${PASSWORD}`);
    console.log('\n✅ Demo accounts ready.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
