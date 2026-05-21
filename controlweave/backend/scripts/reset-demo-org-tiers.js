#!/usr/bin/env node
// @tier: exclude
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

const DEMO_ACCOUNTS = Object.freeze([
  { email: 'admin@community.com', tier: 'enterprise', billingStatus: 'comped', paidTier: 'enterprise' },
  { email: 'admin@pro.com', tier: 'enterprise', billingStatus: 'comped', paidTier: 'enterprise' },
  { email: 'admin@enterprise.com', tier: 'enterprise', billingStatus: 'comped', paidTier: 'enterprise' },
  { email: 'admin@govcloud.com', tier: 'enterprise', billingStatus: 'comped', paidTier: 'enterprise' }
]);

function parseArgs(argv) {
  const args = [...argv];
  const out = {
    apply: false,
    password: null
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--apply') {
      out.apply = true;
      continue;
    }
    if (arg === '--password' && args[i + 1]) {
      out.password = String(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--password=')) {
      out.password = arg.substring('--password='.length);
    }
  }

  return out;
}

function formatState(row) {
  if (!row) return 'missing';
  return `${row.tier}/${row.billing_status}/${row.paid_tier || 'null'} (org=${row.organization_name})`;
}

async function fetchDemoState(client, email) {
  const result = await client.query(
    `SELECT
       u.id AS user_id,
       u.email,
       o.id AS organization_id,
       o.name AS organization_name,
       o.tier,
       o.billing_status,
       o.paid_tier,
       o.trial_status
     FROM users u
     JOIN organizations o ON o.id = u.organization_id
     WHERE LOWER(u.email) = LOWER($1)
     LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function applyTierReset(client, account, state) {
  if (!state) return null;

  const update = await client.query(
    `UPDATE organizations
     SET tier = $1,
         billing_status = $2,
         paid_tier = $3,
         trial_status = 'none',
         trial_source_tier = NULL,
         trial_started_at = NULL,
         trial_ends_at = NULL,
         trial_expired_at = NULL,
         updated_at = NOW()
     WHERE id = $4
     RETURNING id, name AS organization_name, tier, billing_status, paid_tier, trial_status`,
    [account.tier, account.billingStatus, account.paidTier, state.organization_id]
  );

  return update.rows[0] || null;
}

async function maybeResetPassword(client, userId, password) {
  if (!password) return;
  const passwordHash = await bcrypt.hash(password, 12);
  await client.query(
    `UPDATE users
     SET password_hash = $1,
         role = 'admin',
         is_active = true
     WHERE id = $2`,
    [passwordHash, userId]
  );
}

async function run() {
  const { apply, password } = parseArgs(process.argv.slice(2));
  if (password && password.length < 12) {
    throw new Error('--password must be at least 12 characters');
  }

  const client = await pool.connect();
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    touched: 0,
    missing: 0
  };

  try {
    if (apply) await client.query('BEGIN');
    console.log(`\nDemo tier reset (${summary.mode})\n`);

    for (const account of DEMO_ACCOUNTS) {
      const current = await fetchDemoState(client, account.email);
      if (!current) {
        summary.missing += 1;
        console.log(`- ${account.email}: missing`);
        continue;
      }

      const before = formatState(current);
      let after = before;

      if (apply) {
        const updated = await applyTierReset(client, account, current);
        await maybeResetPassword(client, current.user_id, password);
        after = formatState(updated);
        summary.touched += 1;
      } else {
        after = `${account.tier}/${account.billingStatus}/${account.paidTier || 'null'} (org=${current.organization_name})`;
      }

      console.log(`- ${account.email}`);
      console.log(`  before: ${before}`);
      console.log(`  target: ${after}`);
      if (password) {
        console.log('  password: reset requested');
      }
    }

    if (apply) {
      await client.query('COMMIT');
      console.log('\nChanges committed.\n');
    } else {
      console.log('\nDry-run only. Re-run with --apply to persist changes.\n');
    }

    console.log(`Summary: touched=${summary.touched}, missing=${summary.missing}`);
  } catch (error) {
    if (apply) await client.query('ROLLBACK');
    console.error(`\nFailed: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
