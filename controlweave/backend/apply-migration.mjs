import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function runMigration() {
  const migrationFile = process.argv[2] || '006_ai_decision_log.sql';
  const client = await pool.connect();

  try {
    console.log(`Running migration: ${migrationFile}`);
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations', migrationFile),
      'utf8'
    );

    await client.query(sql);
    console.log(`Applied migration: ${migrationFile}`);
  } catch (err) {
    console.error(`Migration failed: ${err.message}`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();