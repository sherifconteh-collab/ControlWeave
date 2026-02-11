require('dotenv').config();
const { Pool } = require('pg');

const useConnectionString = Boolean(process.env.DATABASE_URL);
const sslMode = String(process.env.DB_SSL_MODE || '').toLowerCase();
const useSsl = sslMode === 'require';
const rejectUnauthorized = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false';

const poolOptions = {
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECT_TIMEOUT_MS || '2000', 10),
};

if (useSsl) {
  poolOptions.ssl = { rejectUnauthorized };
}

if (useConnectionString) {
  poolOptions.connectionString = process.env.DATABASE_URL;
} else {
  poolOptions.host = process.env.DB_HOST;
  poolOptions.port = process.env.DB_PORT;
  poolOptions.database = process.env.DB_NAME;
  poolOptions.user = process.env.DB_USER;
  poolOptions.password = process.env.DB_PASSWORD;
}

const pool = new Pool(poolOptions);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;
