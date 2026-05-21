const { encrypt, hashForLookup, decrypt } = require('../../src/utils/encrypt');
const { hasPublicColumn } = require('../../src/utils/schema');

let usersEmailHashColumnAvailable = null;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function hasUsersEmailHashColumn() {
  if (usersEmailHashColumnAvailable === null) {
    usersEmailHashColumnAvailable = await hasPublicColumn('users', 'email_hash');
  }
  return usersEmailHashColumnAvailable;
}

async function findUserByEmail(client, email, options = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const select = options.select || 'id, organization_id, email, role';

  if (await hasUsersEmailHashColumn()) {
    const emailHash = hashForLookup(normalizedEmail);
    const hashMatch = await client.query(
      `SELECT ${select} FROM users WHERE email_hash = $1 LIMIT 1`,
      [emailHash]
    );
    if (hashMatch.rows.length > 0) {
      const row = hashMatch.rows[0];
      if (Object.prototype.hasOwnProperty.call(row, 'email')) {
        row.email = decrypt(row.email);
      }
      return row;
    }
  }

  const plainMatch = await client.query(
    `SELECT ${select} FROM users WHERE email = $1 LIMIT 1`,
    [normalizedEmail]
  );
  if (plainMatch.rows.length === 0) {
    return null;
  }

  const row = plainMatch.rows[0];
  if (Object.prototype.hasOwnProperty.call(row, 'email')) {
    row.email = decrypt(row.email);
  }
  return row;
}

async function ensureUserOrganizationMembership(client, userId, organizationId, role) {
  await client.query(
    `INSERT INTO user_organizations (user_id, organization_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, organization_id) DO UPDATE
       SET role = EXCLUDED.role`,
    [userId, organizationId, role]
  );
}

async function upsertUserByEmail(client, {
  organizationId,
  email,
  passwordHash,
  firstName,
  lastName,
  role,
  isActive = true,
  isPlatformAdmin = false,
  failedLoginAttempts = 0,
  lockedUntil = null,
}) {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await findUserByEmail(client, normalizedEmail, { select: 'id' });
  const useEmailHash = await hasUsersEmailHashColumn();
  const storedEmail = useEmailHash ? encrypt(normalizedEmail) : normalizedEmail;
  const emailHash = useEmailHash ? hashForLookup(normalizedEmail) : null;

  let userId;

  if (existingUser) {
    const result = useEmailHash
      ? await client.query(
        `UPDATE users
         SET organization_id = $1,
             email = $2,
             email_hash = $3,
             password_hash = $4,
             first_name = $5,
             last_name = $6,
             role = $7,
             is_active = $8,
             failed_login_attempts = $9,
             locked_until = $10,
             is_platform_admin = $11
         WHERE id = $12
         RETURNING id`,
        [
          organizationId,
          storedEmail,
          emailHash,
          passwordHash,
          firstName,
          lastName,
          role,
          isActive,
          failedLoginAttempts,
          lockedUntil,
          isPlatformAdmin,
          existingUser.id,
        ]
      )
      : await client.query(
        `UPDATE users
         SET organization_id = $1,
             email = $2,
             password_hash = $3,
             first_name = $4,
             last_name = $5,
             role = $6,
             is_active = $7,
             failed_login_attempts = $8,
             locked_until = $9,
             is_platform_admin = $10
         WHERE id = $11
         RETURNING id`,
        [
          organizationId,
          storedEmail,
          passwordHash,
          firstName,
          lastName,
          role,
          isActive,
          failedLoginAttempts,
          lockedUntil,
          isPlatformAdmin,
          existingUser.id,
        ]
      );
    userId = result.rows[0].id;
  } else {
    const result = useEmailHash
      ? await client.query(
        `INSERT INTO users (
           organization_id, email, email_hash, password_hash, first_name, last_name,
           role, is_active, failed_login_attempts, locked_until, is_platform_admin
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          organizationId,
          storedEmail,
          emailHash,
          passwordHash,
          firstName,
          lastName,
          role,
          isActive,
          failedLoginAttempts,
          lockedUntil,
          isPlatformAdmin,
        ]
      )
      : await client.query(
        `INSERT INTO users (
           organization_id, email, password_hash, first_name, last_name,
           role, is_active, failed_login_attempts, locked_until, is_platform_admin
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          organizationId,
          storedEmail,
          passwordHash,
          firstName,
          lastName,
          role,
          isActive,
          failedLoginAttempts,
          lockedUntil,
          isPlatformAdmin,
        ]
      );
    userId = result.rows[0].id;
  }

  await ensureUserOrganizationMembership(client, userId, organizationId, role);
  return userId;
}

module.exports = {
  findUserByEmail,
  normalizeEmail,
  upsertUserByEmail,
};
