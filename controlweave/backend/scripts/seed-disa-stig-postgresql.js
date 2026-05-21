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
 * DISA STIG PostgreSQL Database Security Framework
 * Based on DISA PostgreSQL 9.x STIG
 * Version: Version 2, Release 3 (V2R3)
 *
 * Security requirements for PostgreSQL database configuration,
 * authentication, access control, auditing, and data protection
 * aligned with DoD security standards.
 */

const disaStigPostgresqlFramework = {
  code: 'disa_stig_postgresql',
  name: 'DISA PostgreSQL STIG',
  version: 'V2R3',
  category: 'Cybersecurity',
  tier_required: 'community',
  description: 'DoD PostgreSQL Security Technical Implementation Guide covering database authentication, access control, auditing, encryption, and secure configuration.',
  controls: [
    // Authentication & Access Control
    { control_id: 'PGS9-00-000100', title: 'PostgreSQL Login Authentication', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must limit the number of concurrent sessions to an organization-defined number per user for all accounts and/or account types.' },
    { control_id: 'PGS9-00-000200', title: 'User Account Management', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must enforce approved authorizations for logical access to information and system resources in accordance with applicable access control policies.' },
    { control_id: 'PGS9-00-000300', title: 'Privileged Role Separation', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must separate user functionality (including user interface services) from database management functionality.' },
    { control_id: 'PGS9-00-000400', title: 'Password Encryption', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must use NIST FIPS 140-2 or 140-3 validated cryptographic modules for cryptographic operations including the generation of cryptographic hashes and data protection.' },
    { control_id: 'PGS9-00-000500', title: 'Authentication Method', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must use approved authentication methods (scram-sha-256 or certificate-based) and not allow md5 or trust authentication for remote connections.' },
    { control_id: 'PGS9-00-000600', title: 'Default Account Security', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must prohibit the use of the postgres superuser account for application connections and disable default accounts.' },
    { control_id: 'PGS9-00-000700', title: 'Connection Limits', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must limit the number of connections per user/database and enforce connection timeouts for idle sessions.' },
    { control_id: 'PGS9-00-000800', title: 'Host-Based Authentication', priority: '1', control_type: 'technical',
      description: 'PostgreSQL pg_hba.conf must be configured to restrict connections to authorized hosts, databases, and users only.' },

    // Audit & Logging
    { control_id: 'PGS9-00-001000', title: 'Audit Logging Configuration', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must produce audit records containing sufficient information to establish what type of events occurred, the sources, and the outcomes.' },
    { control_id: 'PGS9-00-001100', title: 'DDL Statement Auditing', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must generate audit records when privileges/permissions are added, modified, or deleted (DDL statements).' },
    { control_id: 'PGS9-00-001200', title: 'Login Attempt Auditing', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must generate audit records for all successful and failed login attempts, including the identity of the user and the timestamp.' },
    { control_id: 'PGS9-00-001300', title: 'Data Access Auditing', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must generate audit records when security objects are accessed (SELECT on sensitive tables).' },
    { control_id: 'PGS9-00-001400', title: 'Data Modification Auditing', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must generate audit records when data modifications occur (INSERT, UPDATE, DELETE on critical tables).' },
    { control_id: 'PGS9-00-001500', title: 'Audit Log Protection', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must protect audit logs from unauthorized access, modification, or deletion.' },
    { control_id: 'PGS9-00-001600', title: 'Audit Log Retention', priority: '1', control_type: 'organizational',
      description: 'PostgreSQL audit logs must be retained for a minimum of one year and be accessible for at least 90 days.' },
    { control_id: 'PGS9-00-001700', title: 'pgaudit Extension', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must use the pgaudit extension (or equivalent) to provide detailed session and object audit logging.' },

    // Encryption & Data Protection
    { control_id: 'PGS9-00-002000', title: 'TLS Encryption for Connections', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must use TLS 1.2 or higher to encrypt all client-server connections and reject unencrypted connections.' },
    { control_id: 'PGS9-00-002100', title: 'Certificate-Based TLS', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must use valid server certificates signed by a DoD-approved Certificate Authority for TLS connections.' },
    { control_id: 'PGS9-00-002200', title: 'Data-at-Rest Encryption', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must implement cryptographic mechanisms to prevent unauthorized disclosure of data at rest (tablespace encryption or filesystem-level encryption).' },
    { control_id: 'PGS9-00-002300', title: 'Backup Encryption', priority: '1', control_type: 'technical',
      description: 'PostgreSQL backups must be encrypted using FIPS 140-2 approved algorithms.' },
    { control_id: 'PGS9-00-002400', title: 'Password Storage', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must store database user passwords using scram-sha-256 hashing and not md5.' },

    // Configuration & Hardening
    { control_id: 'PGS9-00-003000', title: 'Secure Installation', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must be installed with only the necessary components and extensions; unnecessary modules must be removed.' },
    { control_id: 'PGS9-00-003100', title: 'Listening Address Restriction', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must be configured to listen only on authorized interfaces and not bind to 0.0.0.0 in production.' },
    { control_id: 'PGS9-00-003200', title: 'Port Configuration', priority: '2', control_type: 'technical',
      description: 'PostgreSQL must run on a non-default port or have network-level protections in place for the default port (5432).' },
    { control_id: 'PGS9-00-003300', title: 'File Permission Hardening', priority: '1', control_type: 'technical',
      description: 'PostgreSQL data directory and configuration files must have restrictive file permissions (owner-only read/write).' },
    { control_id: 'PGS9-00-003400', title: 'Version Currency', priority: '1', control_type: 'organizational',
      description: 'PostgreSQL must be running a supported version with all applicable security patches applied.' },
    { control_id: 'PGS9-00-003500', title: 'Shared Memory Configuration', priority: '2', control_type: 'technical',
      description: 'PostgreSQL shared_buffers, work_mem, and other memory parameters must be configured according to security baselines.' },
    { control_id: 'PGS9-00-003600', title: 'Statement Timeout', priority: '2', control_type: 'technical',
      description: 'PostgreSQL must enforce statement_timeout to prevent long-running queries from consuming excessive resources.' },

    // Object & Schema Security
    { control_id: 'PGS9-00-004000', title: 'Schema Separation', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must separate application data into dedicated schemas and revoke privileges on the public schema.' },
    { control_id: 'PGS9-00-004100', title: 'Object Ownership', priority: '1', control_type: 'technical',
      description: 'PostgreSQL database objects must be owned by accounts authorized for ownership and not the postgres superuser.' },
    { control_id: 'PGS9-00-004200', title: 'Role-Based Access Control', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must implement role-based access control with granular privileges on tables, views, and functions.' },
    { control_id: 'PGS9-00-004300', title: 'Row-Level Security', priority: '2', control_type: 'technical',
      description: 'PostgreSQL must use row-level security policies where appropriate to enforce multi-tenant data isolation.' },

    // Availability & Recovery
    { control_id: 'PGS9-00-005000', title: 'Backup Strategy', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must have automated backup procedures (pg_dump, pg_basebackup, or WAL archiving) with tested recovery procedures.' },
    { control_id: 'PGS9-00-005100', title: 'Replication Security', priority: '1', control_type: 'technical',
      description: 'PostgreSQL replication must use encrypted connections and dedicated replication accounts with minimal privileges.' },
    { control_id: 'PGS9-00-005200', title: 'Point-in-Time Recovery', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must support point-in-time recovery via WAL archiving and have recovery objectives documented.' },

    // Monitoring & Maintenance
    { control_id: 'PGS9-00-006000', title: 'Connection Monitoring', priority: '1', control_type: 'technical',
      description: 'PostgreSQL must be monitored for unauthorized connection attempts, excessive failed logins, and unusual query patterns.' },
    { control_id: 'PGS9-00-006100', title: 'Performance Monitoring', priority: '2', control_type: 'technical',
      description: 'PostgreSQL must have performance monitoring to detect resource exhaustion, slow queries, and potential denial-of-service conditions.' },
    { control_id: 'PGS9-00-006200', title: 'Vacuum and Maintenance', priority: '2', control_type: 'technical',
      description: 'PostgreSQL autovacuum must be enabled and configured to maintain database health and prevent transaction ID wraparound.' }
  ]
};

async function seedDisaStigPostgresql() {
  const client = await pool.connect();
  try {
    console.log('Starting DISA STIG PostgreSQL framework seeding...');

    await client.query('BEGIN');

    // Check if framework already exists
    const existingFramework = await client.query(
      'SELECT id FROM frameworks WHERE code = $1',
      [disaStigPostgresqlFramework.code]
    );

    let frameworkId;
    if (existingFramework.rows.length > 0) {
      frameworkId = existingFramework.rows[0].id;
      console.log(`Framework ${disaStigPostgresqlFramework.code} already exists with ID ${frameworkId}`);

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
          disaStigPostgresqlFramework.code,
          disaStigPostgresqlFramework.name,
          disaStigPostgresqlFramework.version,
          disaStigPostgresqlFramework.category,
          disaStigPostgresqlFramework.tier_required,
          disaStigPostgresqlFramework.description
        ]
      );
      frameworkId = frameworkResult.rows[0].id;
      console.log(`Created framework ${disaStigPostgresqlFramework.code} with ID ${frameworkId}`);
    }

    // Insert controls
    console.log(`Inserting ${disaStigPostgresqlFramework.controls.length} controls...`);
    let insertedCount = 0;

    for (const control of disaStigPostgresqlFramework.controls) {
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

    console.log(`Inserted ${insertedCount} controls for DISA STIG PostgreSQL framework`);

    await client.query('COMMIT');
    console.log('DISA STIG PostgreSQL framework seeding completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding DISA STIG PostgreSQL framework:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeding
if (require.main === module) {
  seedDisaStigPostgresql()
    .then(() => {
      console.log('Seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDisaStigPostgresql, disaStigPostgresqlFramework };
