#!/usr/bin/env node
// @tier: exclude
/**
 * seed-demo-disable-onboarding.js
 *
 * Marks onboarding as completed for all standard demo account organizations so
 * demo users can sign in and use the app without onboarding prompts.
 */
require('dotenv').config();
const pool = require('../src/config/database');

const DEMO_EMAILS = Object.freeze([
  'admin@community.com',
  'auditor@community.com',
  'admin@pro.com',
  'auditor@pro.com',
  'admin@enterprise.com',
  'auditor@enterprise.com',
  'admin@govcloud.com',
  'auditor@govcloud.com'
]);

async function run() {
  const client = await pool.connect();
  try {
    console.log('\nCompleting onboarding for demo organizations...\n');
    await client.query('BEGIN');

    const orgsRes = await client.query(
      `SELECT DISTINCT u.organization_id
       FROM users u
       WHERE LOWER(u.email) = ANY($1::text[])
         AND u.organization_id IS NOT NULL`,
      [DEMO_EMAILS.map((email) => email.toLowerCase())]
    );

    const orgIds = orgsRes.rows.map((row) => row.organization_id).filter(Boolean);
    if (!orgIds.length) {
      console.log('No demo organizations found from configured demo accounts.');
      await client.query('COMMIT');
      return;
    }

    const actorRes = await client.query(
      `SELECT id, organization_id, email
       FROM users
       WHERE LOWER(email) = ANY($1::text[])
       ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, created_at ASC`,
      [DEMO_EMAILS.map((email) => email.toLowerCase())]
    );

    const actorByOrg = new Map();
    for (const row of actorRes.rows) {
      if (!actorByOrg.has(row.organization_id)) {
        actorByOrg.set(row.organization_id, row.id);
      }
    }

    let touched = 0;
    for (const orgId of orgIds) {
      const actorId = actorByOrg.get(orgId) || null;
      await client.query(
        `INSERT INTO organization_profiles (
           organization_id,
           onboarding_completed,
           onboarding_completed_at,
           created_by,
           updated_by
         )
         VALUES ($1, true, NOW(), $2, $2)
         ON CONFLICT (organization_id) DO UPDATE
           SET onboarding_completed = true,
               onboarding_completed_at = COALESCE(organization_profiles.onboarding_completed_at, NOW()),
               updated_by = COALESCE($2, organization_profiles.updated_by)`,
        [orgId, actorId]
      );
      touched += 1;
    }

    await client.query('COMMIT');
    console.log(`✓ Onboarding completed for ${touched} demo organization(s).\n`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  const msg = error?.message || String(error);
  console.error(`\n❌ Failed to complete demo onboarding: ${msg}\n`);
  process.exit(1);
});
