#!/usr/bin/env node
require('dotenv').config();

const { Pool } = require('pg');

function toInt(value, fallback) {
  const parsed = parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toFloat(value, fallback) {
  const parsed = parseFloat(String(value || ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createPool() {
  const useConnectionString = Boolean(process.env.DATABASE_URL);
  const sslMode = String(process.env.DB_SSL_MODE || '').toLowerCase();
  const useSsl = sslMode === 'require';
  const rejectUnauthorized = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false';

  const options = useConnectionString
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
      };

  if (useSsl) {
    options.ssl = { rejectUnauthorized };
  }

  return new Pool(options);
}

async function tableExists(pool, tableName) {
  const result = await pool.query('SELECT to_regclass($1) IS NOT NULL AS present', [tableName]);
  return Boolean(result.rows[0]?.present);
}

async function getTableCount(pool, tableName) {
  const exists = await tableExists(pool, tableName);
  if (!exists) return null;
  const result = await pool.query(`SELECT COUNT(*)::bigint AS count FROM ${tableName}`);
  return parseInt(result.rows[0].count, 10);
}

function statusLabel(ok) {
  return ok ? 'ok' : 'upgrade_recommended';
}

async function run() {
  const pool = createPool();

  const thresholds = {
    dbSizeGb: toFloat(process.env.DB_UPGRADE_THRESHOLD_GB, 3),
    connectionUtilPct: toFloat(process.env.DB_UPGRADE_THRESHOLD_CONNECTION_UTILIZATION_PCT, 70),
    auditLogRows: toInt(process.env.DB_UPGRADE_THRESHOLD_AUDIT_LOG_ROWS, 250000),
    evidenceRows: toInt(process.env.DB_UPGRADE_THRESHOLD_EVIDENCE_ROWS, 50000),
    assessmentRows: toInt(process.env.DB_UPGRADE_THRESHOLD_ASSESSMENT_RESULTS_ROWS, 50000),
  };

  try {
    const sizeResult = await pool.query(
      'SELECT pg_database_size(current_database())::bigint AS bytes, current_database() AS database_name'
    );
    const dbSizeBytes = parseInt(sizeResult.rows[0].bytes, 10);
    const dbSizeGb = dbSizeBytes / (1024 * 1024 * 1024);

    const maxConnResult = await pool.query('SHOW max_connections');
    const maxConnections = parseInt(maxConnResult.rows[0].max_connections, 10);

    const activeConnResult = await pool.query(
      "SELECT COUNT(*)::int AS active FROM pg_stat_activity WHERE datname = current_database() AND state <> 'idle'"
    );
    const activeConnections = parseInt(activeConnResult.rows[0].active, 10);
    const connectionUtilPct = maxConnections > 0 ? (activeConnections / maxConnections) * 100 : 0;

    const tableCounts = {
      audit_logs: await getTableCount(pool, 'audit_logs'),
      evidence_files: await getTableCount(pool, 'evidence_files'),
      assessment_results: await getTableCount(pool, 'assessment_results'),
      vulnerabilities: await getTableCount(pool, 'vulnerabilities'),
    };

    const checks = [
      {
        metric: 'database_size_gb',
        current: Number(dbSizeGb.toFixed(3)),
        threshold: thresholds.dbSizeGb,
        status: statusLabel(dbSizeGb <= thresholds.dbSizeGb),
        note: 'Upgrade DB plan when database size exceeds threshold.'
      },
      {
        metric: 'connection_utilization_pct',
        current: Number(connectionUtilPct.toFixed(2)),
        threshold: thresholds.connectionUtilPct,
        status: statusLabel(connectionUtilPct <= thresholds.connectionUtilPct),
        note: 'Sustained high connection utilization indicates need for higher tier/pool tuning.'
      },
      {
        metric: 'audit_logs_rows',
        current: tableCounts.audit_logs,
        threshold: thresholds.auditLogRows,
        status: statusLabel(tableCounts.audit_logs === null || tableCounts.audit_logs <= thresholds.auditLogRows),
        note: 'High audit volume can drive storage and index pressure.'
      },
      {
        metric: 'evidence_files_rows',
        current: tableCounts.evidence_files,
        threshold: thresholds.evidenceRows,
        status: statusLabel(tableCounts.evidence_files === null || tableCounts.evidence_files <= thresholds.evidenceRows),
        note: 'Large evidence catalogs require larger storage and better I/O.'
      },
      {
        metric: 'assessment_results_rows',
        current: tableCounts.assessment_results,
        threshold: thresholds.assessmentRows,
        status: statusLabel(tableCounts.assessment_results === null || tableCounts.assessment_results <= thresholds.assessmentRows),
        note: 'Assessment history growth affects reporting query speed.'
      }
    ];

    const summaryStatus = checks.every((check) => check.status === 'ok') ? 'ok' : 'upgrade_recommended';

    console.log(JSON.stringify({
      database: sizeResult.rows[0].database_name,
      checked_at: new Date().toISOString(),
      thresholds,
      current: {
        db_size_gb: Number(dbSizeGb.toFixed(3)),
        active_connections: activeConnections,
        max_connections: maxConnections,
        connection_utilization_pct: Number(connectionUtilPct.toFixed(2)),
        table_counts: tableCounts
      },
      checks,
      summary_status: summaryStatus
    }, null, 2));

    if (summaryStatus !== 'ok') {
      process.exitCode = 2;
    }
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(`Capacity check failed: ${error.message}`);
  process.exit(1);
});
