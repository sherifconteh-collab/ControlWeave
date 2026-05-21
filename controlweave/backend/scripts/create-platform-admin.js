// @tier: exclude
require('dotenv').config();
const { randomBytes } = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');
const { findUserByEmail, upsertUserByEmail } = require('./lib/userSeedHelpers');

const email = String(process.env.PLATFORM_ADMIN_EMAIL || '').trim().toLowerCase();
let password = String(process.env.PLATFORM_ADMIN_PASSWORD || '').trim();
const generatedPassword = !password;
const organizationName = String(process.env.PLATFORM_ADMIN_ORG || 'ControlWeave Platform').trim();
const firstName = String(process.env.PLATFORM_ADMIN_FIRST_NAME || 'Platform').trim();
const lastName = String(process.env.PLATFORM_ADMIN_LAST_NAME || 'Owner').trim();

if (!email) {
  console.error('Missing required env var: PLATFORM_ADMIN_EMAIL');
  process.exit(1);
}
if (!password) {
  password = `${randomBytes(9).toString('base64url')}Aa1!`;
}
if (password.length < 12) {
  console.error('PLATFORM_ADMIN_PASSWORD must be at least 12 characters');
  process.exit(1);
}

function maskEmailForLog(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized.includes('@')) return '<redacted>';
  const [local, domain] = normalized.split('@');
  if (!local || !domain) return '<redacted>';
  const safeLocal = local.length <= 2 ? `${local[0] || '*'}*` : `${local.slice(0, 2)}***`;
  return `${safeLocal}@${domain}`;
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingOrgResult = await client.query(
      'SELECT id FROM organizations WHERE name = $1 LIMIT 1',
      [organizationName]
    );
    let organizationId = existingOrgResult.rows[0]?.id;
    if (!organizationId) {
      const orgResult = await client.query(
        `INSERT INTO organizations (name, tier, billing_status)
         VALUES ($1, 'enterprise', 'active_paid')
         RETURNING id`,
        [organizationName]
      );
      organizationId = orgResult.rows[0].id;
    }
    const existingUser = await findUserByEmail(client, email, { select: 'id' });
    const existingUserId = existingUser?.id || null;
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = await upsertUserByEmail(client, {
      organizationId,
      email,
      passwordHash,
      firstName,
      lastName,
      role: 'admin',
      isActive: true,
      isPlatformAdmin: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    await client.query(
      `INSERT INTO organization_profiles
         (organization_id, onboarding_completed, onboarding_completed_at, created_by, updated_by)
       VALUES ($1, true, NOW(), $2, $2)
       ON CONFLICT (organization_id) DO UPDATE SET
         onboarding_completed = true,
         onboarding_completed_at = COALESCE(organization_profiles.onboarding_completed_at, NOW()),
         updated_by = EXCLUDED.updated_by`,
      [organizationId, existingUserId || userId]
    );

    await client.query('COMMIT');
    const mode = existingUserId ? 'updated' : 'created';
    console.log('✅ Platform admin ready');
    console.log(`   status: ${mode}`);
    console.log(`   email: ${maskEmailForLog(email)}`);
    console.log(`   organization: ${organizationName}`);
    if (generatedPassword) {
      console.log(`   generated_password: ${password}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to create/update platform admin:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
