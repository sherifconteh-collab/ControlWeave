/**
 * seed-demo-accounts.js
 *
 * Creates one admin account per tier so every tier can be demoed.
 * Idempotent — safe to run multiple times.
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

async function upsertOrg(client, acct) {
  // Check if a user with this email already exists — if so, use their org
  const existingUser = await client.query(
    'SELECT organization_id FROM users WHERE email = $1',
    [acct.email]
  );
  if (existingUser.rows.length > 0) {
    const orgId = existingUser.rows[0].organization_id;
    // Ensure tier is correct
    await client.query(
      'UPDATE organizations SET tier = $1, billing_status = $2 WHERE id = $3',
      [acct.tier, acct.billingStatus, orgId]
    );
    return orgId;
  }

  // Check if an org with this name already exists
  const existingOrg = await client.query(
    'SELECT id FROM organizations WHERE name = $1',
    [acct.orgName]
  );
  if (existingOrg.rows.length > 0) {
    const orgId = existingOrg.rows[0].id;
    await client.query(
      'UPDATE organizations SET tier = $1, billing_status = $2 WHERE id = $3',
      [acct.tier, acct.billingStatus, orgId]
    );
    return orgId;
  }

  // Create a new org
  const res = await client.query(
    `INSERT INTO organizations (name, tier, billing_status)
     VALUES ($1, $2, $3) RETURNING id`,
    [acct.orgName, acct.tier, acct.billingStatus]
  );
  return res.rows[0].id;
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n🌱 Seeding demo tier accounts...\n');
    const passwordHash = await bcrypt.hash(PASSWORD, 12);

    for (const acct of ACCOUNTS) {
      await client.query('BEGIN');
      try {
        const orgId = await upsertOrg(client, acct);

        // Upsert user (email is unique)
        await client.query(
          `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
           VALUES ($1, $2, $3, $4, $5, 'admin')
           ON CONFLICT (email) DO UPDATE
             SET organization_id = EXCLUDED.organization_id,
                 password_hash   = EXCLUDED.password_hash,
                 first_name      = EXCLUDED.first_name,
                 last_name       = EXCLUDED.last_name,
                 role            = 'admin'`,
          [orgId, acct.email, passwordHash, acct.firstName, acct.lastName]
        );

        // Get user id for profile
        const userRes = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [acct.email]
        );
        const userId = userRes.rows[0].id;

        // Mark onboarding complete so login goes straight to dashboard
        await client.query(
          `INSERT INTO organization_profiles
             (organization_id, onboarding_completed, onboarding_completed_at, created_by, updated_by)
           VALUES ($1, true, NOW(), $2, $2)
           ON CONFLICT (organization_id) DO UPDATE
             SET onboarding_completed    = true,
                 onboarding_completed_at = COALESCE(organization_profiles.onboarding_completed_at, NOW()),
                 updated_by = EXCLUDED.updated_by`,
          [orgId, userId]
        );

        await client.query('COMMIT');
        console.log(`  ✓ ${acct.tier.padEnd(12)} — ${acct.email}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ Failed for ${acct.email}: ${err.message}`);
      }
    }

    console.log(`\n  Password for all accounts: ${PASSWORD}`);
    console.log('\n✅ Demo accounts ready.\n');
  } finally {
    client.release();
    await pool.end();
  }
}

run();
