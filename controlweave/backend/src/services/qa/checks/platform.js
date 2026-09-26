'use strict';

const fs = require('fs');
const path = require('path');
const pool = require('../../../config/database');

const pass = (detail, extra = {}) => ({ status: 'pass', detail, ...extra });
const warn = (detail, remediation, extra = {}) => ({ status: 'warn', detail, remediation, ...extra });
const fail = (detail, remediation, extra = {}) => ({ status: 'fail', detail, remediation, ...extra });

const MIGRATIONS_DIR = path.join(__dirname, '../../../../migrations');
const storageService = require('../../storageService');

module.exports = [
  {
    id: 'platform.database',
    suite: 'platform',
    title: 'Database reachable and responsive',
    description: 'Round-trip query latency to PostgreSQL.',
    async run() {
      const started = Date.now();
      const result = await pool.query('SELECT current_setting(\'server_version_num\')::int AS version');
      const latency = Date.now() - started;
      const major = Math.floor(result.rows[0].version / 10000);
      const metrics = { latencyMs: latency, postgresMajor: major };
      if (major < 17) {
        return warn(`PostgreSQL ${major} responded in ${latency}ms.`, 'ControlWeave supports PostgreSQL 17 or later; upgrade the database.', { metrics });
      }
      if (latency > 250) {
        return warn(`PostgreSQL ${major} responded in ${latency}ms.`, 'Latency above 250ms slows every page; check database sizing and region.', { metrics });
      }
      return pass(`PostgreSQL ${major} responded in ${latency}ms.`, { metrics });
    }
  },
  {
    id: 'platform.migrations',
    suite: 'platform',
    title: 'All database migrations applied',
    description: 'Every migration file shipped with this version is recorded as applied.',
    async run() {
      const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{3}_.*\.sql$/.test(f));
      const applied = await pool.query('SELECT filename FROM schema_migrations');
      const appliedSet = new Set(applied.rows.map((r) => r.filename));
      const pending = files.filter((f) => !appliedSet.has(f));
      const metrics = { shipped: files.length, applied: appliedSet.size, pending: pending.length };
      if (pending.length > 0) {
        return fail(`${pending.length} migration(s) not applied: ${pending.slice(0, 5).join(', ')}${pending.length > 5 ? ', ...' : ''}`,
          'Run `npm run migrate` in the backend (Railway runs it automatically on deploy).', { metrics });
      }
      return pass(`All ${files.length} migrations applied.`, { metrics });
    }
  },
  {
    id: 'platform.security_config',
    suite: 'platform',
    title: 'Security configuration',
    description: 'Secrets, encryption keys, proxy trust and CORS are production-grade.',
    async run() {
      const problems = [];
      const cautions = [];
      if (String(process.env.JWT_SECRET || '').length < 32) problems.push('JWT_SECRET is shorter than 32 characters');
      for (const key of ['ENCRYPTION_KEY', 'HMAC_KEY']) {
        if (!process.env[key]) {
          (process.env.NODE_ENV === 'production' ? problems : cautions).push(`${key} is not set (development fallback key in use)`);
        }
      }
      const origins = String(process.env.CORS_ORIGIN || '');
      if (origins.includes('*')) cautions.push('CORS_ORIGIN contains "*" (ignored in production)');
      if (process.env.NODE_ENV !== 'production') cautions.push(`NODE_ENV is "${process.env.NODE_ENV || 'unset'}", not production`);
      if (String(process.env.DEMO_AUTO_SEED || '').toLowerCase() === 'true') cautions.push('Shared demo accounts are enabled (DEMO_AUTO_SEED=true)');
      if (problems.length) return fail(problems.join('; '), 'Set the missing secrets in the deployment environment and restart.');
      if (cautions.length) return warn(cautions.join('; '), 'Acceptable for a test environment; review before production use.');
      return pass('Secrets and encryption keys configured for production.');
    }
  },
  {
    id: 'platform.storage',
    suite: 'platform',
    title: 'Evidence storage writable and durable',
    description: 'The server can write, read back and delete a file in evidence storage.',
    async run() {
      const info = storageService.describe();
      const metrics = { driver: info.driver, durable: info.durable };
      const { ok } = await storageService.probe();
      if (!ok) return fail('File read back did not match what was written.', 'Check the storage volume or bucket for corruption.', { metrics });
      if (!info.durable) {
        return warn(`Storage is writable, but files are kept only at ${info.location}, which is not marked persistent and may be lost on redeploy.`,
          'Set S3_BUCKET to use object storage, or mount a persistent volume at UPLOADS_DIR (on self-hosted installs, set STORAGE_LOCAL_DURABLE=true once the directory is on durable disk).', { metrics });
      }
      return pass(`Evidence storage (${info.driver}, ${info.location}) is writable, durable and reads back correctly.`, { metrics });
    }
  },
  {
    id: 'platform.dependencies',
    suite: 'platform',
    title: 'Dependencies checked and free of unaddressed critical vulnerabilities',
    description: 'A dependency check ran in the last 48 hours and every critical or high vulnerability or end-of-life component has a decision (platform owners only).',
    async run(ctx) {
      // Platform dependency data is visible to the platform owner only.
      const owner = await pool.query('SELECT is_platform_admin FROM users WHERE id = $1', [ctx.userId]);
      if (!owner.rows[0] || !owner.rows[0].is_platform_admin) {
        return { status: 'skip', detail: 'Only the platform owner can see platform dependency status.' };
      }
      const { rows: [run] } = await pool.query(
        "SELECT id, finished_at FROM dependency_check_runs WHERE status IN ('completed', 'partial') ORDER BY started_at DESC LIMIT 1"
      );
      if (!run) return warn('No dependency check has run yet.', 'Open Platform Admin -> Dependencies and choose Check now.');
      const { rows: [counts] } = await pool.query(
        `SELECT COUNT(*) FILTER (WHERE f.max_severity = 'critical') AS critical,
                COUNT(*) FILTER (WHERE f.max_severity = 'high' OR (f.eol_date IS NOT NULL AND f.eol_date < CURRENT_DATE)) AS high
           FROM dependency_findings f
           LEFT JOIN dependency_decisions d ON d.component = f.component AND d.name = f.name
          WHERE f.run_id = $1
            AND (d.status IS NULL OR d.status = 'open' OR (d.status = 'snoozed' AND d.snooze_until < CURRENT_DATE))`,
        [run.id]
      );
      const metrics = { critical: Number(counts.critical), highOrEndOfLife: Number(counts.high) };
      const ageHours = (Date.now() - new Date(run.finished_at).getTime()) / 3600000;
      if (metrics.critical > 0) {
        return fail(`${metrics.critical} dependency(ies) with critical vulnerabilities have no remediation decision.`, 'Plan the upgrade (POA&M) or record a risk acceptance in Platform Admin -> Dependencies.', { metrics });
      }
      if (metrics.highOrEndOfLife > 0) {
        return warn(`${metrics.highOrEndOfLife} dependency(ies) with high-severity vulnerabilities or past end of life have no decision.`, 'Review them in Platform Admin -> Dependencies.', { metrics });
      }
      if (ageHours > 48) {
        return warn(`The last dependency check was ${Math.round(ageHours)} hours ago.`, 'Check that DEPENDENCY_CHECK_ENABLED is not false, or run a check now.', { metrics });
      }
      return pass('Dependencies were checked recently and every serious finding has a decision.', { metrics });
    }
  },
  {
    id: 'platform.email',
    suite: 'platform',
    title: 'Outbound email configured',
    description: 'SMTP is configured so password resets, reminders and vendor questionnaires are delivered.',
    async run(ctx) {
      if (process.env.SMTP_HOST) return pass(`SMTP configured via environment (${process.env.SMTP_HOST}).`);
      const platform = await pool.query("SELECT 1 FROM platform_settings WHERE setting_key = 'smtp_host' AND COALESCE(setting_value, '') <> '' LIMIT 1").catch(() => ({ rows: [] }));
      if (platform.rows.length) return pass('SMTP configured in platform settings.');
      const org = await pool.query(
        "SELECT 1 FROM organization_settings WHERE organization_id = $1 AND setting_key = 'smtp_host' AND COALESCE(setting_value, '') <> '' LIMIT 1",
        [ctx.organizationId]
      ).catch(() => ({ rows: [] }));
      if (org.rows.length) return pass('SMTP configured for this organization.');
      return warn('No SMTP server configured; emails (password resets, reminders, vendor questionnaires) are silently skipped.',
        'Configure SMTP under Settings > Email, or set SMTP_HOST/SMTP_USER/SMTP_PASS.');
    }
  },
  {
    id: 'platform.cache',
    suite: 'platform',
    title: 'Shared cache for multiple instances',
    description: 'Redis backs rate limiting and real-time updates when running more than one instance.',
    async run() {
      if (process.env.REDIS_URL || process.env.REDIS_HOST) return pass('Redis is configured.');
      return warn('Redis is not configured; rate limits and real-time updates are per-instance.',
        'Fine for a single instance. Set REDIS_URL before scaling out to multiple replicas.');
    }
  }
];
