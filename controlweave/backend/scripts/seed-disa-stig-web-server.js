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
 * DISA STIG Web Server Security Framework
 * Based on DISA Web Server Security Requirements Guide (SRG)
 * Version: Version 3, Release 1 (V3R1)
 *
 * Security requirements for web server configuration, TLS,
 * request handling, session management, and access control
 * applied to Express.js/Node.js web servers.
 */

const disaStigWebServerFramework = {
  code: 'disa_stig_web_server',
  name: 'DISA Web Server SRG',
  version: 'V3R1',
  category: 'Cybersecurity',
  tier_required: 'community',
  description: 'DoD Web Server Security Requirements Guide covering TLS configuration, request handling, access control, logging, and hardening for web servers including Node.js/Express.',
  controls: [
    // TLS/SSL Configuration
    { control_id: 'SRG-APP-000014', title: 'TLS 1.2 Minimum', priority: '1', control_type: 'technical',
      description: 'The web server must use TLS 1.2 or higher for all connections and disable SSLv2, SSLv3, TLS 1.0, and TLS 1.1.' },
    { control_id: 'SRG-APP-000015', title: 'Strong Cipher Suites', priority: '1', control_type: 'technical',
      description: 'The web server must only allow cipher suites that use AES 256 or higher for encryption and SHA-256 or higher for hashing.' },
    { control_id: 'SRG-APP-000016', title: 'Server Certificate Validation', priority: '1', control_type: 'technical',
      description: 'The web server must use a DoD-approved certificate signed by a trusted Certificate Authority.' },
    { control_id: 'SRG-APP-000017', title: 'HSTS Enforcement', priority: '1', control_type: 'technical',
      description: 'The web server must set the Strict-Transport-Security header with a minimum max-age of 31536000 seconds (1 year).' },
    { control_id: 'SRG-APP-000018', title: 'Certificate Revocation Checking', priority: '1', control_type: 'technical',
      description: 'The web server must check certificate revocation status via OCSP or CRL before establishing TLS connections.' },

    // Security Headers
    { control_id: 'SRG-APP-000100', title: 'Content-Security-Policy Header', priority: '1', control_type: 'technical',
      description: 'The web server must set the Content-Security-Policy header to restrict script sources and prevent XSS attacks.' },
    { control_id: 'SRG-APP-000110', title: 'X-Content-Type-Options Header', priority: '1', control_type: 'technical',
      description: 'The web server must set X-Content-Type-Options: nosniff to prevent MIME type sniffing.' },
    { control_id: 'SRG-APP-000120', title: 'X-Frame-Options Header', priority: '1', control_type: 'technical',
      description: 'The web server must set X-Frame-Options to DENY or SAMEORIGIN to prevent clickjacking.' },
    { control_id: 'SRG-APP-000130', title: 'Referrer-Policy Header', priority: '2', control_type: 'technical',
      description: 'The web server must set the Referrer-Policy header to strict-origin-when-cross-origin or stricter.' },
    { control_id: 'SRG-APP-000140', title: 'Permissions-Policy Header', priority: '2', control_type: 'technical',
      description: 'The web server must set the Permissions-Policy header to disable unnecessary browser features (camera, microphone, geolocation).' },
    { control_id: 'SRG-APP-000150', title: 'Server Header Suppression', priority: '1', control_type: 'technical',
      description: 'The web server must not disclose software version information in Server, X-Powered-By, or other response headers.' },

    // Access Control
    { control_id: 'SRG-APP-000200', title: 'Authentication Required', priority: '1', control_type: 'technical',
      description: 'The web server must require authentication for all protected resources and API endpoints.' },
    { control_id: 'SRG-APP-000210', title: 'Authorization Enforcement', priority: '1', control_type: 'technical',
      description: 'The web server must enforce authorization policies ensuring users can only access resources their roles permit.' },
    { control_id: 'SRG-APP-000220', title: 'Directory Listing Disabled', priority: '1', control_type: 'technical',
      description: 'The web server must disable directory browsing and listing of directory contents.' },
    { control_id: 'SRG-APP-000230', title: 'Admin Interface Restriction', priority: '1', control_type: 'technical',
      description: 'The web server administrative interface must be restricted to authorized IP addresses or be accessible only via a management network.' },
    { control_id: 'SRG-APP-000240', title: 'CORS Policy', priority: '1', control_type: 'technical',
      description: 'The web server must implement a restrictive CORS policy and not use wildcard (*) origins in production.' },

    // Request Handling & Input Validation
    { control_id: 'SRG-APP-000300', title: 'Request Size Limits', priority: '1', control_type: 'technical',
      description: 'The web server must limit the maximum request body size, header size, and URL length to prevent buffer overflow and DoS attacks.' },
    { control_id: 'SRG-APP-000310', title: 'Rate Limiting', priority: '1', control_type: 'technical',
      description: 'The web server must implement rate limiting on authentication endpoints and API routes to mitigate brute-force and DoS attacks.' },
    { control_id: 'SRG-APP-000320', title: 'HTTP Method Restriction', priority: '1', control_type: 'technical',
      description: 'The web server must only allow HTTP methods required for the application (GET, POST, PUT, DELETE) and reject TRACE, OPTIONS where not needed.' },
    { control_id: 'SRG-APP-000330', title: 'File Upload Restrictions', priority: '1', control_type: 'technical',
      description: 'The web server must validate file uploads by type, size, and content, and store them outside the web root.' },
    { control_id: 'SRG-APP-000340', title: 'URL Path Traversal Prevention', priority: '1', control_type: 'technical',
      description: 'The web server must prevent path traversal attacks by normalizing and validating all URL paths.' },
    { control_id: 'SRG-APP-000350', title: 'Request Timeout', priority: '1', control_type: 'technical',
      description: 'The web server must enforce request timeouts to prevent slowloris and other slow HTTP attacks.' },

    // Session Management
    { control_id: 'SRG-APP-000400', title: 'Secure Session Configuration', priority: '1', control_type: 'technical',
      description: 'The web server must configure sessions with Secure, HttpOnly, and SameSite cookie attributes.' },
    { control_id: 'SRG-APP-000410', title: 'Session Timeout', priority: '1', control_type: 'technical',
      description: 'The web server must enforce session idle timeout (15 minutes) and absolute session timeout (8 hours).' },
    { control_id: 'SRG-APP-000420', title: 'Session ID Entropy', priority: '1', control_type: 'technical',
      description: 'The web server must generate session identifiers using a cryptographically secure random number generator with sufficient entropy.' },

    // Audit & Logging
    { control_id: 'SRG-APP-000500', title: 'Access Log Generation', priority: '1', control_type: 'technical',
      description: 'The web server must generate access logs containing the client IP, request method, URL, status code, user agent, and timestamp.' },
    { control_id: 'SRG-APP-000510', title: 'Error Log Generation', priority: '1', control_type: 'technical',
      description: 'The web server must log all errors, warnings, and security-relevant events with sufficient detail for forensic analysis.' },
    { control_id: 'SRG-APP-000520', title: 'Authentication Event Logging', priority: '1', control_type: 'technical',
      description: 'The web server must log all authentication attempts (successful and failed) with username, source IP, and timestamp.' },
    { control_id: 'SRG-APP-000530', title: 'Log Integrity Protection', priority: '1', control_type: 'technical',
      description: 'The web server must protect log files from unauthorized modification and implement log rotation with retention.' },
    { control_id: 'SRG-APP-000540', title: 'Security Event Forwarding', priority: '1', control_type: 'technical',
      description: 'The web server must forward security events to the organizational SIEM or centralized logging system.' },

    // Error Handling
    { control_id: 'SRG-APP-000600', title: 'Custom Error Pages', priority: '1', control_type: 'technical',
      description: 'The web server must use custom error pages that do not reveal server software, version, stack traces, or internal paths.' },
    { control_id: 'SRG-APP-000610', title: 'Debug Mode Disabled', priority: '1', control_type: 'technical',
      description: 'The web server must not run in debug mode or with verbose error reporting in production.' },

    // Hardening & Configuration
    { control_id: 'SRG-APP-000700', title: 'Unnecessary Modules Disabled', priority: '1', control_type: 'technical',
      description: 'The web server must disable or remove all unnecessary modules, middleware, and sample applications.' },
    { control_id: 'SRG-APP-000710', title: 'Process Isolation', priority: '1', control_type: 'technical',
      description: 'The web server process must run under a dedicated non-root service account with minimal filesystem permissions.' },
    { control_id: 'SRG-APP-000720', title: 'Resource Limits', priority: '1', control_type: 'technical',
      description: 'The web server must enforce resource limits (max connections, worker processes, memory) to prevent resource exhaustion.' },
    { control_id: 'SRG-APP-000730', title: 'Version Currency', priority: '1', control_type: 'organizational',
      description: 'The web server runtime (Node.js) and framework (Express) must be running supported versions with security patches applied.' },
    { control_id: 'SRG-APP-000740', title: 'Dependency Security', priority: '1', control_type: 'technical',
      description: 'The web server must regularly audit npm dependencies for known vulnerabilities using npm audit or equivalent tools.' },

    // Availability & DoS Protection
    { control_id: 'SRG-APP-000800', title: 'DDoS Mitigation', priority: '1', control_type: 'technical',
      description: 'The web server must implement or be behind DDoS mitigation controls (rate limiting, connection limits, or CDN/WAF).' },
    { control_id: 'SRG-APP-000810', title: 'Graceful Degradation', priority: '2', control_type: 'technical',
      description: 'The web server must implement graceful degradation under high load, returning appropriate status codes rather than crashing.' },
    { control_id: 'SRG-APP-000820', title: 'Health Monitoring', priority: '2', control_type: 'technical',
      description: 'The web server must expose a health check endpoint for monitoring and implement automatic restart on failure.' }
  ]
};

async function seedDisaStigWebServer() {
  const client = await pool.connect();
  try {
    console.log('Starting DISA STIG Web Server framework seeding...');

    await client.query('BEGIN');

    // Check if framework already exists
    const existingFramework = await client.query(
      'SELECT id FROM frameworks WHERE code = $1',
      [disaStigWebServerFramework.code]
    );

    let frameworkId;
    if (existingFramework.rows.length > 0) {
      frameworkId = existingFramework.rows[0].id;
      console.log(`Framework ${disaStigWebServerFramework.code} already exists with ID ${frameworkId}`);

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
          disaStigWebServerFramework.code,
          disaStigWebServerFramework.name,
          disaStigWebServerFramework.version,
          disaStigWebServerFramework.category,
          disaStigWebServerFramework.tier_required,
          disaStigWebServerFramework.description
        ]
      );
      frameworkId = frameworkResult.rows[0].id;
      console.log(`Created framework ${disaStigWebServerFramework.code} with ID ${frameworkId}`);
    }

    // Insert controls
    console.log(`Inserting ${disaStigWebServerFramework.controls.length} controls...`);
    let insertedCount = 0;

    for (const control of disaStigWebServerFramework.controls) {
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

    console.log(`Inserted ${insertedCount} controls for DISA STIG Web Server framework`);

    await client.query('COMMIT');
    console.log('DISA STIG Web Server framework seeding completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding DISA STIG Web Server framework:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeding
if (require.main === module) {
  seedDisaStigWebServer()
    .then(() => {
      console.log('Seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDisaStigWebServer, disaStigWebServerFramework };
