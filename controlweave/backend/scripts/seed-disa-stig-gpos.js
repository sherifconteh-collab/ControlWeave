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
 * DISA STIG General Purpose Operating System (GPOS) Framework
 * Based on DISA Canonical Ubuntu 22.04 LTS STIG
 * Version: Version 2, Release 1 (V2R1)
 *
 * Security requirements for the Linux operating system hosting
 * ControlWeave, covering user access, auditing, file integrity,
 * network security, and system hardening.
 */

const disaStigGposFramework = {
  code: 'disa_stig_gpos',
  name: 'DISA General Purpose Operating System STIG',
  version: 'V2R1',
  category: 'Cybersecurity',
  tier_required: 'community',
  description: 'DoD General Purpose Operating System Security Technical Implementation Guide covering Linux/Ubuntu system hardening, access control, auditing, network security, and patch management.',
  controls: [
    // User Access & Authentication
    { control_id: 'UBTU-22-000001', title: 'SSH Key-Based Authentication', priority: '1', control_type: 'technical',
      description: 'The operating system must enforce SSH key-based authentication and disable password authentication for remote access where possible.' },
    { control_id: 'UBTU-22-000010', title: 'Password Complexity', priority: '1', control_type: 'technical',
      description: 'The operating system must enforce password complexity by requiring at least one uppercase, one lowercase, one digit, and one special character.' },
    { control_id: 'UBTU-22-000020', title: 'Password Minimum Length', priority: '1', control_type: 'technical',
      description: 'The operating system must enforce a minimum password length of 15 characters.' },
    { control_id: 'UBTU-22-000030', title: 'Account Lockout', priority: '1', control_type: 'technical',
      description: 'The operating system must lock accounts after three consecutive failed login attempts for a period of 15 minutes.' },
    { control_id: 'UBTU-22-000040', title: 'Root Account Restriction', priority: '1', control_type: 'technical',
      description: 'The operating system must not allow direct root login via SSH; privileged access must use sudo with individual accounts.' },
    { control_id: 'UBTU-22-000050', title: 'Inactive Account Disable', priority: '1', control_type: 'technical',
      description: 'The operating system must disable accounts that have been inactive for 35 days.' },
    { control_id: 'UBTU-22-000060', title: 'Password Expiration', priority: '2', control_type: 'technical',
      description: 'The operating system must enforce a maximum password age of 60 days.' },
    { control_id: 'UBTU-22-000070', title: 'Password History', priority: '2', control_type: 'technical',
      description: 'The operating system must prohibit password reuse for a minimum of five generations.' },
    { control_id: 'UBTU-22-000080', title: 'Multi-Factor Authentication', priority: '1', control_type: 'technical',
      description: 'The operating system must implement multi-factor authentication for remote access to privileged accounts.' },

    // Audit & Logging
    { control_id: 'UBTU-22-001000', title: 'Audit System Enabled', priority: '1', control_type: 'technical',
      description: 'The operating system must have auditd (or equivalent) installed and enabled to capture security-relevant events.' },
    { control_id: 'UBTU-22-001010', title: 'Login Event Auditing', priority: '1', control_type: 'technical',
      description: 'The operating system must audit all login and logout events, including failed login attempts.' },
    { control_id: 'UBTU-22-001020', title: 'Privileged Command Auditing', priority: '1', control_type: 'technical',
      description: 'The operating system must audit all uses of sudo, su, and other privileged commands.' },
    { control_id: 'UBTU-22-001030', title: 'File Access Auditing', priority: '1', control_type: 'technical',
      description: 'The operating system must audit access to security-relevant files (/etc/passwd, /etc/shadow, /etc/sudoers).' },
    { control_id: 'UBTU-22-001040', title: 'System Configuration Auditing', priority: '1', control_type: 'technical',
      description: 'The operating system must audit modifications to system configuration files, cron jobs, and startup scripts.' },
    { control_id: 'UBTU-22-001050', title: 'Audit Log Protection', priority: '1', control_type: 'technical',
      description: 'Audit log files must be owned by root and have permissions of 600 or more restrictive.' },
    { control_id: 'UBTU-22-001060', title: 'Audit Log Retention', priority: '1', control_type: 'organizational',
      description: 'Audit logs must be retained for a minimum of one year with at least 90 days available online.' },
    { control_id: 'UBTU-22-001070', title: 'Remote Log Forwarding', priority: '1', control_type: 'technical',
      description: 'The operating system must forward audit logs to a centralized log server or SIEM.' },
    { control_id: 'UBTU-22-001080', title: 'Disk Space Monitoring for Logs', priority: '1', control_type: 'technical',
      description: 'The operating system must alert when audit log storage reaches 75% capacity.' },

    // File System & Integrity
    { control_id: 'UBTU-22-002000', title: 'File Integrity Monitoring', priority: '1', control_type: 'technical',
      description: 'The operating system must implement file integrity monitoring (AIDE, Tripwire, or equivalent) for critical system files.' },
    { control_id: 'UBTU-22-002010', title: 'Home Directory Permissions', priority: '1', control_type: 'technical',
      description: 'User home directories must have permissions of 750 or more restrictive.' },
    { control_id: 'UBTU-22-002020', title: 'SUID/SGID Review', priority: '1', control_type: 'technical',
      description: 'The operating system must regularly review files with SUID/SGID bits and remove the bits from unauthorized files.' },
    { control_id: 'UBTU-22-002030', title: 'World-Writable Files', priority: '1', control_type: 'technical',
      description: 'The operating system must not have world-writable files outside of designated temporary directories.' },
    { control_id: 'UBTU-22-002040', title: 'Separate Partitions', priority: '2', control_type: 'technical',
      description: 'The operating system must use separate partitions for /tmp, /var, /var/log, and /home with appropriate mount options (noexec, nosuid).' },
    { control_id: 'UBTU-22-002050', title: 'Filesystem Encryption', priority: '1', control_type: 'technical',
      description: 'The operating system must use LUKS or equivalent full-disk encryption for data-at-rest protection on all non-ephemeral storage.' },

    // Network Security
    { control_id: 'UBTU-22-003000', title: 'Firewall Configuration', priority: '1', control_type: 'technical',
      description: 'The operating system must have a host-based firewall (ufw/iptables/nftables) enabled with a default-deny inbound policy.' },
    { control_id: 'UBTU-22-003010', title: 'SSH Hardening', priority: '1', control_type: 'technical',
      description: 'The SSH daemon must be configured with Protocol 2 only, MaxAuthTries 4, PermitEmptyPasswords no, and ClientAliveInterval 600.' },
    { control_id: 'UBTU-22-003020', title: 'Unused Services Disabled', priority: '1', control_type: 'technical',
      description: 'The operating system must disable or remove all unnecessary network services (telnet, rsh, rlogin, FTP, NFS if not needed).' },
    { control_id: 'UBTU-22-003030', title: 'IP Forwarding Disabled', priority: '1', control_type: 'technical',
      description: 'The operating system must not have IP forwarding enabled unless the system is a designated router.' },
    { control_id: 'UBTU-22-003040', title: 'ICMP Redirect Rejection', priority: '1', control_type: 'technical',
      description: 'The operating system must not accept ICMP redirects by default and must log martian packets.' },
    { control_id: 'UBTU-22-003050', title: 'TCP SYN Cookies', priority: '1', control_type: 'technical',
      description: 'The operating system must enable TCP SYN cookies to mitigate SYN flood attacks.' },
    { control_id: 'UBTU-22-003060', title: 'Network Time Synchronization', priority: '1', control_type: 'technical',
      description: 'The operating system must synchronize time with an authoritative NTP source with authenticated NTP.' },

    // System Hardening
    { control_id: 'UBTU-22-004000', title: 'Kernel Hardening', priority: '1', control_type: 'technical',
      description: 'The operating system must enable kernel security features: ASLR (randomize_va_space=2), ExecShield, and restrict kernel pointer exposure.' },
    { control_id: 'UBTU-22-004010', title: 'Core Dump Restriction', priority: '1', control_type: 'technical',
      description: 'The operating system must disable or restrict core dumps to prevent information disclosure.' },
    { control_id: 'UBTU-22-004020', title: 'Banner Configuration', priority: '2', control_type: 'technical',
      description: 'The operating system must display the Standard Mandatory DoD Notice and Consent Banner before granting local or remote access.' },
    { control_id: 'UBTU-22-004030', title: 'USB Storage Restriction', priority: '2', control_type: 'technical',
      description: 'The operating system must disable USB mass storage drivers unless operationally required.' },
    { control_id: 'UBTU-22-004040', title: 'Automatic Updates', priority: '1', control_type: 'technical',
      description: 'The operating system must be configured to apply security patches automatically or have a documented patch management process.' },
    { control_id: 'UBTU-22-004050', title: 'SELinux/AppArmor', priority: '1', control_type: 'technical',
      description: 'The operating system must have SELinux or AppArmor enabled and enforcing to provide mandatory access control.' },

    // Software & Patch Management
    { control_id: 'UBTU-22-005000', title: 'Package Integrity Verification', priority: '1', control_type: 'technical',
      description: 'The operating system must verify the integrity of all packages using GPG signatures before installation.' },
    { control_id: 'UBTU-22-005010', title: 'Authorized Repositories Only', priority: '1', control_type: 'technical',
      description: 'The operating system must only install software from authorized APT repositories.' },
    { control_id: 'UBTU-22-005020', title: 'Patch Currency', priority: '1', control_type: 'organizational',
      description: 'The operating system must be running a supported version with security patches applied within 30 days of release.' },
    { control_id: 'UBTU-22-005030', title: 'Unnecessary Software Removal', priority: '1', control_type: 'technical',
      description: 'The operating system must have all unnecessary software packages removed (games, development tools in production, etc.).' },
    { control_id: 'UBTU-22-005040', title: 'Container Runtime Security', priority: '1', control_type: 'technical',
      description: 'If Docker or container runtimes are installed, they must be configured with rootless mode or appropriate security profiles.' },

    // Availability & Recovery
    { control_id: 'UBTU-22-006000', title: 'System Backup', priority: '1', control_type: 'technical',
      description: 'The operating system must have automated backup procedures with tested recovery to meet RPO/RTO objectives.' },
    { control_id: 'UBTU-22-006010', title: 'Resource Monitoring', priority: '1', control_type: 'technical',
      description: 'The operating system must monitor CPU, memory, disk, and network utilization and alert on thresholds.' },
    { control_id: 'UBTU-22-006020', title: 'Process Accounting', priority: '2', control_type: 'technical',
      description: 'The operating system must have process accounting enabled to track resource usage by process.' }
  ]
};

async function seedDisaStigGpos() {
  const client = await pool.connect();
  try {
    console.log('Starting DISA STIG General Purpose OS framework seeding...');

    await client.query('BEGIN');

    // Check if framework already exists
    const existingFramework = await client.query(
      'SELECT id FROM frameworks WHERE code = $1',
      [disaStigGposFramework.code]
    );

    let frameworkId;
    if (existingFramework.rows.length > 0) {
      frameworkId = existingFramework.rows[0].id;
      console.log(`Framework ${disaStigGposFramework.code} already exists with ID ${frameworkId}`);

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
          disaStigGposFramework.code,
          disaStigGposFramework.name,
          disaStigGposFramework.version,
          disaStigGposFramework.category,
          disaStigGposFramework.tier_required,
          disaStigGposFramework.description
        ]
      );
      frameworkId = frameworkResult.rows[0].id;
      console.log(`Created framework ${disaStigGposFramework.code} with ID ${frameworkId}`);
    }

    // Insert controls
    console.log(`Inserting ${disaStigGposFramework.controls.length} controls...`);
    let insertedCount = 0;

    for (const control of disaStigGposFramework.controls) {
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

    console.log(`Inserted ${insertedCount} controls for DISA STIG General Purpose OS framework`);

    await client.query('COMMIT');
    console.log('DISA STIG General Purpose OS framework seeding completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding DISA STIG General Purpose OS framework:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeding
if (require.main === module) {
  seedDisaStigGpos()
    .then(() => {
      console.log('Seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDisaStigGpos, disaStigGposFramework };
