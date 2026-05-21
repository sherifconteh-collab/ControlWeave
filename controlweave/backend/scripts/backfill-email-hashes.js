// @tier: exclude
require('dotenv').config();

const pool = require('../src/config/database');
const { decrypt, hashForLookup } = require('../src/utils/encrypt');
const { hasPublicColumn } = require('../src/utils/schema');

async function run() {
  const emailHashColumnExists = await hasPublicColumn('users', 'email_hash');
  if (!emailHashColumnExists) {
    throw new Error('users.email_hash column is missing. Apply migration 098/099 before backfilling.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const usersResult = await client.query(
      `SELECT id, email, email_hash
       FROM users
       WHERE email IS NOT NULL`
    );

    let scanned = 0;
    let updated = 0;
    let unchanged = 0;

    for (const row of usersResult.rows) {
      scanned += 1;
      const normalizedEmail = String(decrypt(row.email) || '').trim().toLowerCase();
      if (!normalizedEmail) {
        unchanged += 1;
        continue;
      }

      const desiredHash = hashForLookup(normalizedEmail);
      if (row.email_hash === desiredHash) {
        unchanged += 1;
        continue;
      }

      await client.query(
        `UPDATE users
         SET email_hash = $1
         WHERE id = $2`,
        [desiredHash, row.id]
      );
      updated += 1;
    }

    await client.query('COMMIT');

    console.log(JSON.stringify({
      success: true,
      scanned,
      updated,
      unchanged,
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
