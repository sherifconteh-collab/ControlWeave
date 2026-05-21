// @tier: exclude
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

/**
 * DISA STIG Application Server Security Requirements Guide
 * Based on DISA Application Server SRG
 * Version: Version 3, Release 1 (V3R1)
 *
 * Security requirements for the Node.js application server runtime,
 * process management, deployment configuration, middleware pipeline,
 * and operational security aligned with DoD standards.
 *
 * NOTE: This is distinct from disa_stig_app (secure development practices)
 * and disa_stig_web_server (HTTP/TLS serving). This SRG covers the
 * application server runtime itself.
 */

const disaStigAppServerFramework = {
  code: 'disa_stig_app_server',
  name: 'DISA Application Server SRG',
  version: 'V3R1',
  category: 'Cybersecurity',
  tier_required: 'community',
  description: 'DoD Application Server Security Requirements Guide covering Node.js runtime configuration, process isolation, middleware security, deployment hardening, and operational controls.',
  controls: [
    // Runtime Configuration & Hardening
    { control_id: 'AS-SRG-000010', title: 'Supported Runtime Version', priority: '1', control_type: 'technical',
      description: 'The application server must run a vendor-supported runtime version (Node.js LTS) with all security patches applied.' },
    { control_id: 'AS-SRG-000020', title: 'Non-Root Process Execution', priority: '1', control_type: 'technical',
      description: 'The application server process must run under a dedicated, non-privileged service account and never as root.' },
    { control_id: 'AS-SRG-000030', title: 'Environment Variable Protection', priority: '1', control_type: 'technical',
      description: 'The application server must protect sensitive environment variables (secrets, API keys, DB credentials) from exposure in logs, error messages, or process listings.' },
    { control_id: 'AS-SRG-000040', title: 'Debug and Inspection Ports Disabled', priority: '1', control_type: 'technical',
      description: 'The application server must not expose Node.js inspector/debug ports (--inspect, --inspect-brk) in production environments.' },
    { control_id: 'AS-SRG-000050', title: 'NODE_ENV Production Mode', priority: '1', control_type: 'technical',
      description: 'The application server must run with NODE_ENV=production to disable development-mode features, verbose errors, and stack traces.' },
    { control_id: 'AS-SRG-000060', title: 'Memory Limits', priority: '1', control_type: 'technical',
      description: 'The application server must enforce memory limits (--max-old-space-size) to prevent unbounded heap growth and DoS conditions.' },
    { control_id: 'AS-SRG-000070', title: 'Startup Integrity Check', priority: '2', control_type: 'technical',
      description: 'The application server must verify the integrity of application files (e.g., npm ci --ignore-scripts verification) before starting.' },

    // Process Management & Availability
    { control_id: 'AS-SRG-000100', title: 'Process Supervision', priority: '1', control_type: 'technical',
      description: 'The application server must be managed by a process supervisor (systemd, PM2, or container orchestrator) that automatically restarts on failure.' },
    { control_id: 'AS-SRG-000110', title: 'Graceful Shutdown', priority: '1', control_type: 'technical',
      description: 'The application server must handle SIGTERM/SIGINT signals to gracefully drain connections and close database pools before exiting.' },
    { control_id: 'AS-SRG-000120', title: 'Cluster Mode / Horizontal Scaling', priority: '2', control_type: 'technical',
      description: 'The application server should use cluster mode or multiple instances behind a load balancer for high availability.' },
    { control_id: 'AS-SRG-000130', title: 'Health Check Endpoint', priority: '1', control_type: 'technical',
      description: 'The application server must expose a health check endpoint that verifies runtime, database, and dependency connectivity for monitoring and orchestration.' },
    { control_id: 'AS-SRG-000140', title: 'Resource Exhaustion Protection', priority: '1', control_type: 'technical',
      description: 'The application server must protect against resource exhaustion by limiting concurrent connections, request queue depth, and event loop blocking.' },

    // Middleware & Request Pipeline Security
    { control_id: 'AS-SRG-000200', title: 'Middleware Ordering', priority: '1', control_type: 'technical',
      description: 'The application server must load security middleware (helmet, cors, rate limiter, auth) before business logic routes in the pipeline.' },
    { control_id: 'AS-SRG-000210', title: 'Body Parser Limits', priority: '1', control_type: 'technical',
      description: 'The application server must configure body parser middleware with size limits to prevent large payload DoS attacks.' },
    { control_id: 'AS-SRG-000220', title: 'CORS Configuration', priority: '1', control_type: 'technical',
      description: 'The application server must configure CORS middleware with an explicit allowlist of origins and not use wildcard (*) in production.' },
    { control_id: 'AS-SRG-000230', title: 'Helmet Security Headers', priority: '1', control_type: 'technical',
      description: 'The application server must use helmet (or equivalent) middleware to set security headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.' },
    { control_id: 'AS-SRG-000240', title: 'Error Handling Middleware', priority: '1', control_type: 'technical',
      description: 'The application server must have a global error handler that catches unhandled exceptions and rejections without exposing internals.' },
    { control_id: 'AS-SRG-000250', title: 'Request ID Tracing', priority: '2', control_type: 'technical',
      description: 'The application server should generate a unique request ID for each request and include it in logs and responses for traceability.' },

    // Authentication & Session Infrastructure
    { control_id: 'AS-SRG-000300', title: 'Token Validation', priority: '1', control_type: 'technical',
      description: 'The application server must validate JWT tokens on every protected request, checking signature, expiration, issuer, and audience claims.' },
    { control_id: 'AS-SRG-000310', title: 'Token Secret Management', priority: '1', control_type: 'technical',
      description: 'The application server must store JWT signing secrets securely (environment variables or secrets manager) and rotate them periodically.' },
    { control_id: 'AS-SRG-000320', title: 'Session Concurrency Control', priority: '1', control_type: 'technical',
      description: 'The application server must enforce session concurrency limits and provide mechanisms to revoke active sessions.' },
    { control_id: 'AS-SRG-000330', title: 'Refresh Token Security', priority: '1', control_type: 'technical',
      description: 'The application server must store refresh tokens securely (hashed in the database) and invalidate them on logout or password change.' },

    // Dependency & Module Security
    { control_id: 'AS-SRG-000400', title: 'Dependency Audit', priority: '1', control_type: 'technical',
      description: 'The application server must audit npm dependencies for known vulnerabilities (npm audit) on every build and before deployment.' },
    { control_id: 'AS-SRG-000410', title: 'Lockfile Enforcement', priority: '1', control_type: 'technical',
      description: 'The application server must use a lockfile (package-lock.json) and install with npm ci to ensure deterministic, reproducible builds.' },
    { control_id: 'AS-SRG-000420', title: 'No eval or Dynamic Require', priority: '1', control_type: 'technical',
      description: 'The application server must not use eval(), Function(), or dynamic require() with user-controlled input.' },
    { control_id: 'AS-SRG-000430', title: 'Prototype Pollution Prevention', priority: '1', control_type: 'technical',
      description: 'The application server must guard against prototype pollution by freezing critical prototypes or using Object.create(null) for lookup maps.' },
    { control_id: 'AS-SRG-000440', title: 'Supply Chain Integrity', priority: '1', control_type: 'organizational',
      description: 'The application server dependencies must be sourced from verified registries with integrity hashes checked on install.' },

    // Database Connection Security
    { control_id: 'AS-SRG-000500', title: 'Connection Pool Configuration', priority: '1', control_type: 'technical',
      description: 'The application server must use connection pooling with configured min/max connections, idle timeout, and connection validation.' },
    { control_id: 'AS-SRG-000510', title: 'Database TLS Connections', priority: '1', control_type: 'technical',
      description: 'The application server must connect to the database using TLS with certificate verification (sslmode=verify-full or equivalent).' },
    { control_id: 'AS-SRG-000520', title: 'Parameterized Queries Only', priority: '1', control_type: 'technical',
      description: 'The application server must use parameterized queries ($1, $2 placeholders) for all database operations and never concatenate user input into SQL.' },
    { control_id: 'AS-SRG-000530', title: 'Least-Privilege Database Account', priority: '1', control_type: 'technical',
      description: 'The application server must connect to the database with a dedicated account that has only the minimum required privileges (no superuser, no CREATE DATABASE).' },

    // Logging & Observability
    { control_id: 'AS-SRG-000600', title: 'Structured Logging', priority: '1', control_type: 'technical',
      description: 'The application server must produce structured logs (JSON format) with timestamp, level, request ID, user ID, and event type.' },
    { control_id: 'AS-SRG-000610', title: 'Sensitive Data Redaction', priority: '1', control_type: 'technical',
      description: 'The application server must redact passwords, tokens, API keys, and PII from all log output.' },
    { control_id: 'AS-SRG-000620', title: 'Unhandled Rejection Logging', priority: '1', control_type: 'technical',
      description: 'The application server must log all unhandled promise rejections and uncaught exceptions with full stack traces (server-side only).' },
    { control_id: 'AS-SRG-000630', title: 'Performance Metrics', priority: '2', control_type: 'technical',
      description: 'The application server should expose runtime metrics (event loop lag, heap usage, active handles) for monitoring and alerting.' },

    // Deployment & CI/CD
    { control_id: 'AS-SRG-000700', title: 'Immutable Deployments', priority: '1', control_type: 'organizational',
      description: 'The application server must be deployed via immutable artifacts (Docker images, tarballs) built in CI/CD — not via manual file edits on servers.' },
    { control_id: 'AS-SRG-000710', title: 'Build Artifact Scanning', priority: '1', control_type: 'technical',
      description: 'The application server build artifacts must be scanned for vulnerabilities (container scanning, SAST) before deployment.' },
    { control_id: 'AS-SRG-000720', title: 'Rollback Capability', priority: '1', control_type: 'organizational',
      description: 'The deployment pipeline must support rollback to the previous known-good version within 15 minutes.' },
    { control_id: 'AS-SRG-000730', title: 'Secrets Injection at Runtime', priority: '1', control_type: 'technical',
      description: 'Secrets must be injected at runtime via environment variables or secrets manager — never baked into build artifacts or container images.' },

    // File Handling & Upload Security
    { control_id: 'AS-SRG-000800', title: 'Upload Directory Isolation', priority: '1', control_type: 'technical',
      description: 'The application server must store uploaded files outside the web-accessible document root and serve them through controlled routes.' },
    { control_id: 'AS-SRG-000810', title: 'File Type Validation', priority: '1', control_type: 'technical',
      description: 'The application server must validate uploaded file types by content (magic bytes) — not just extension — and reject disallowed types.' },
    { control_id: 'AS-SRG-000820', title: 'Upload Size Limits', priority: '1', control_type: 'technical',
      description: 'The application server must enforce per-file and per-request upload size limits via multer or equivalent middleware.' },
    { control_id: 'AS-SRG-000830', title: 'Temporary File Cleanup', priority: '2', control_type: 'technical',
      description: 'The application server must clean up temporary files (uploads, report generation) within a bounded time to prevent disk exhaustion.' }
  ]
};

async function seedDisaStigAppServer() {
  const client = await pool.connect();
  try {
    console.log('Starting DISA STIG Application Server framework seeding...');

    await client.query('BEGIN');

    // Check if framework already exists
    const existingFramework = await client.query(
      'SELECT id FROM frameworks WHERE code = $1',
      [disaStigAppServerFramework.code]
    );

    let frameworkId;
    if (existingFramework.rows.length > 0) {
      frameworkId = existingFramework.rows[0].id;
      console.log(`Framework ${disaStigAppServerFramework.code} already exists with ID ${frameworkId}`);

      // Delete existing controls
      await client.query(
        'DELETE FROM framework_controls WHERE framework_id = $1',
        [frameworkId]
      );
      console.log('Deleted existing controls');
    } else {
      // Insert framework
      const frameworkResult = await client.query(
        `INSERT INTO frameworks (code, name, version, category, tier_required, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          disaStigAppServerFramework.code,
          disaStigAppServerFramework.name,
          disaStigAppServerFramework.version,
          disaStigAppServerFramework.category,
          disaStigAppServerFramework.tier_required,
          disaStigAppServerFramework.description
        ]
      );
      frameworkId = frameworkResult.rows[0].id;
      console.log(`Created framework ${disaStigAppServerFramework.code} with ID ${frameworkId}`);
    }

    // Insert controls
    console.log(`Inserting ${disaStigAppServerFramework.controls.length} controls...`);
    let insertedCount = 0;

    for (const control of disaStigAppServerFramework.controls) {
      await client.query(
        `INSERT INTO framework_controls
         (framework_id, control_id, title, priority, control_type, description)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          frameworkId,
          control.control_id,
          control.title,
          control.priority,
          control.control_type,
          control.description || null
        ]
      );
      insertedCount++;
    }

    console.log(`Inserted ${insertedCount} controls for DISA STIG Application Server framework`);

    await client.query('COMMIT');
    console.log('DISA STIG Application Server framework seeding completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding DISA STIG Application Server framework:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeding
if (require.main === module) {
  seedDisaStigAppServer()
    .then(() => {
      console.log('Seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDisaStigAppServer, disaStigAppServerFramework };
