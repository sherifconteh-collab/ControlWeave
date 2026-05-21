// @tier: exclude
require('dotenv').config();

const pool = require('../src/config/database');
const { decrypt } = require('../src/utils/encrypt');

async function getUserForeignKeys(client) {
  const result = await client.query(
    `SELECT tc.table_name, kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = 'public'
       AND ccu.table_name = 'users'
       AND ccu.column_name = 'id'
     ORDER BY tc.table_name, kcu.column_name`
  );

  return result.rows;
}

async function mergeReference(client, tableName, columnName, canonicalId, duplicateId) {
  if (tableName === 'user_organizations' && columnName === 'user_id') {
    await client.query(
      `INSERT INTO user_organizations (user_id, organization_id, role)
       SELECT $1, organization_id, role
       FROM user_organizations
       WHERE user_id = $2
       ON CONFLICT (user_id, organization_id) DO UPDATE
         SET role = EXCLUDED.role`,
      [canonicalId, duplicateId]
    );
    await client.query(
      `DELETE FROM user_organizations WHERE user_id = $1`,
      [duplicateId]
    );
    return;
  }

  if (tableName === 'user_roles' && columnName === 'user_id') {
    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, role_id
       FROM user_roles
       WHERE user_id = $2
       ON CONFLICT DO NOTHING`,
      [canonicalId, duplicateId]
    );
    await client.query(
      `DELETE FROM user_roles WHERE user_id = $1`,
      [duplicateId]
    );
    return;
  }

  await client.query(
    `UPDATE ${tableName}
     SET ${columnName} = $1
     WHERE ${columnName} = $2`,
    [canonicalId, duplicateId]
  );
}

function normalizeEmail(storedEmail) {
  return String(decrypt(storedEmail) || '').trim().toLowerCase();
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const usersResult = await client.query(
      `SELECT id, email, organization_id, role, is_active, is_platform_admin,
              password_hash, first_name, last_name, created_at, updated_at
       FROM users
       ORDER BY created_at ASC, id ASC`
    );

    const groups = new Map();
    for (const row of usersResult.rows) {
      const normalizedEmail = normalizeEmail(row.email);
      if (!normalizedEmail) continue;
      if (!groups.has(normalizedEmail)) {
        groups.set(normalizedEmail, []);
      }
      groups.get(normalizedEmail).push(row);
    }

    const foreignKeys = await getUserForeignKeys(client);
    const duplicateGroups = [...groups.entries()]
      .map(([email, rows]) => ({ email, rows }))
      .filter((group) => group.rows.length > 1);

    let removedUsers = 0;
    for (const group of duplicateGroups) {
      const orderedRows = [...group.rows].sort((a, b) => {
        const createdCompare = new Date(a.created_at) - new Date(b.created_at);
        if (createdCompare !== 0) return createdCompare;
        return String(a.id).localeCompare(String(b.id));
      });

      const canonical = orderedRows[0];
      const newest = [...orderedRows].sort((a, b) => {
        const updatedCompare = new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
        if (updatedCompare !== 0) return updatedCompare;
        return String(b.id).localeCompare(String(a.id));
      })[0];

      await client.query(
        `UPDATE users
         SET password_hash = COALESCE($2, password_hash),
             first_name = COALESCE(NULLIF($3, ''), first_name),
             last_name = COALESCE(NULLIF($4, ''), last_name),
             role = COALESCE(NULLIF($5, ''), role),
             is_active = COALESCE(is_active, false) OR COALESCE($6, false),
             is_platform_admin = COALESCE(is_platform_admin, false) OR COALESCE($7, false),
             updated_at = NOW()
         WHERE id = $1`,
        [
          canonical.id,
          newest.password_hash,
          newest.first_name,
          newest.last_name,
          newest.role,
          newest.is_active,
          newest.is_platform_admin,
        ]
      );

      for (const duplicate of orderedRows.slice(1)) {
        for (const foreignKey of foreignKeys) {
          await mergeReference(
            client,
            foreignKey.table_name,
            foreignKey.column_name,
            canonical.id,
            duplicate.id
          );
        }

        await client.query(
          `DELETE FROM users WHERE id = $1`,
          [duplicate.id]
        );
        removedUsers += 1;
      }
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({
      success: true,
      duplicateGroups: duplicateGroups.length,
      removedUsers,
    }));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
