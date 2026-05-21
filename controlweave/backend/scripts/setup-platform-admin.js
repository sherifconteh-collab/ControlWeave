// @tier: exclude
/**
 * setup-platform-admin.js
 *
 * Creates (or updates) the platform admin account.
 * Only requires DATABASE_URL — no Railway CLI needed.
 *
 * Usage:
 *   DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=require" \
 *   node controlweave/backend/scripts/setup-platform-admin.js
 *
 * Get DATABASE_URL from:
 *   Railway dashboard → Postgres service → Variables tab → DATABASE_URL
 *
 * Required:
 *   PLATFORM_ADMIN_EMAIL
 *
 * Optional overrides:
 *   PLATFORM_ADMIN_PASSWORD   (default: auto-generated, printed to console)
 *   PLATFORM_ADMIN_FIRST_NAME (default: Platform)
 *   PLATFORM_ADMIN_LAST_NAME  (default: Admin)
 *   PLATFORM_ADMIN_ORG        (default: ControlWeave Platform)
 */

require('dotenv').config();
const { randomBytes } = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const email     = String(process.env.PLATFORM_ADMIN_EMAIL      || '').trim().toLowerCase();
const firstName = String(process.env.PLATFORM_ADMIN_FIRST_NAME || 'Platform').trim();
const lastName  = String(process.env.PLATFORM_ADMIN_LAST_NAME  || 'Admin').trim();
const orgName   = String(process.env.PLATFORM_ADMIN_ORG        || 'ControlWeave Platform').trim();
let   password  = String(process.env.PLATFORM_ADMIN_PASSWORD   || '').trim();

const generated = !password;
if (generated) {
  password = `CW-${randomBytes(9).toString('base64url')}!1`;
}

function maskEmailForLog(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized.includes('@')) return '<redacted>';
  const [local, domain] = normalized.split('@');
  if (!local || !domain) return '<redacted>';
  const safeLocal = local.length <= 2 ? `${local[0] || '*'}*` : `${local.slice(0, 2)}***`;
  return `${safeLocal}@${domain}`;
}

if (!process.env.DATABASE_URL) {
  console.error('\nMissing DATABASE_URL.\n');
  console.error('Get it from: Railway dashboard → Postgres service → Variables tab → DATABASE_URL\n');
  console.error('Then run:\n');
  console.error('  DATABASE_URL="postgresql://..." node controlweave/backend/scripts/setup-platform-admin.js\n');
  process.exit(1);
}

if (!email) {
  console.error('\nMissing PLATFORM_ADMIN_EMAIL.\n');
  console.error('Set it in environment variables and re-run the script.\n');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert the platform org
    let orgId;
    const existingOrg = await client.query(
      'SELECT id FROM organizations WHERE name = $1 LIMIT 1',
      [orgName]
    );
    if (existingOrg.rows.length > 0) {
      orgId = existingOrg.rows[0].id;
    } else {
      const orgRes = await client.query(
        `INSERT INTO organizations (name, tier, billing_status)
         VALUES ($1, 'enterprise', 'active_paid')
         RETURNING id`,
        [orgName]
      );
      orgId = orgRes.rows[0].id;
    }

    // Upsert the user with is_platform_admin = true
    const hash = await bcrypt.hash(password, 12);
    const userRes = await client.query(
      `INSERT INTO users
         (organization_id, email, password_hash, first_name, last_name, role, is_active, is_platform_admin)
       VALUES ($1, $2, $3, $4, $5, 'admin', true, true)
       ON CONFLICT (email) DO UPDATE SET
         organization_id  = EXCLUDED.organization_id,
         password_hash    = EXCLUDED.password_hash,
         first_name       = EXCLUDED.first_name,
         last_name        = EXCLUDED.last_name,
         role             = 'admin',
         is_active        = true,
         is_platform_admin = true
       RETURNING id, email, (xmax = 0) AS inserted`,
      [orgId, email, hash, firstName, lastName]
    );

    await client.query('COMMIT');

    const { inserted } = userRes.rows[0];
    console.log('\n✅  Platform admin ready\n');
    console.log(`   status   : ${inserted ? 'created' : 'updated'}`);
    console.log(`   email    : ${maskEmailForLog(email)}`);
    console.log(`   org      : ${orgName}`);
    if (generated) {
      console.log(`   password : <generated — check deployment logs>`);
    }
    console.log('\n   Login at your app URL → use the credentials above.\n');
    console.log('   The "Platform Overview" and "All Organizations" sections');
    console.log('   will appear in the sidebar once you sign in.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Failed:', err.message, '\n');
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
