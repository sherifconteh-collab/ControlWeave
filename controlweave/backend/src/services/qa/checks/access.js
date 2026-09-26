'use strict';

const pool = require('../../../config/database');

const pass = (detail, extra = {}) => ({ status: 'pass', detail, ...extra });
const warn = (detail, remediation, extra = {}) => ({ status: 'warn', detail, remediation, ...extra });
const fail = (detail, remediation, extra = {}) => ({ status: 'fail', detail, remediation, ...extra });

// Least-privilege expectations for the built-in roles. Auditors must be able
// to read everything they assess but not alter what they assess; standard
// users must not administer the organization.
const ROLE_EXPECTATIONS = Object.freeze({
  auditor: {
    must: ['controls.read', 'evidence.read', 'audit.read', 'assessments.read', 'tprm.read'],
    mustNot: ['controls.write', 'implementations.write', 'evidence.write', 'risks.write', 'tprm.write', 'users.manage', 'roles.manage', 'settings.manage']
  },
  user: {
    must: ['controls.read', 'implementations.write', 'evidence.write'],
    mustNot: ['users.manage', 'roles.manage', 'settings.manage', 'organizations.write', 'qa.run']
  }
});

module.exports = [
  {
    id: 'access.role_matrix',
    suite: 'access',
    title: 'Built-in roles follow least privilege',
    description: 'Compares the permissions granted to the built-in auditor and user roles with the expected matrix.',
    async run() {
      const result = await pool.query(
        `SELECT r.name AS role, p.name AS permission
           FROM roles r
           JOIN role_permissions rp ON rp.role_id = r.id
           JOIN permissions p ON p.id = rp.permission_id
          WHERE r.is_system_role = true AND r.name IN ('auditor', 'user')`
      );
      const granted = new Map();
      for (const row of result.rows) {
        if (!granted.has(row.role)) granted.set(row.role, new Set());
        granted.get(row.role).add(row.permission);
      }
      const excess = [];
      const missing = [];
      for (const [role, rules] of Object.entries(ROLE_EXPECTATIONS)) {
        const perms = granted.get(role) || new Set();
        for (const p of rules.mustNot) if (perms.has(p)) excess.push(`${role} has ${p}`);
        for (const p of rules.must) if (!perms.has(p)) missing.push(`${role} lacks ${p}`);
      }
      if (excess.length) {
        return fail(`Built-in roles grant more than least privilege: ${excess.join(', ')}.`, 'Remove the permission from the role under Settings > Roles, or restore the default role definitions.');
      }
      if (missing.length) {
        return warn(`Built-in roles are missing expected permissions: ${missing.join(', ')}. Affected users will see 403 errors.`, 'Re-apply the RBAC migrations or grant the permission under Settings > Roles.');
      }
      return pass('Auditor and user roles match the expected least-privilege matrix.');
    }
  },
  {
    id: 'access.admin_mfa',
    suite: 'access',
    title: 'Administrators use multi-factor authentication',
    description: 'Share of active administrators with an authenticator app enrolled.',
    async run(ctx) {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS admins,
                COUNT(*) FILTER (WHERE COALESCE(totp_enabled, false))::int AS with_mfa
           FROM users
          WHERE organization_id = $1 AND is_active = true AND role = 'admin'`,
        [ctx.organizationId]
      );
      const { admins, with_mfa: withMfa } = result.rows[0];
      const metrics = { admins, withMfa };
      if (admins === 0) return { status: 'skip', detail: 'No active administrators.' };
      if (withMfa < admins) {
        return warn(`${admins - withMfa} of ${admins} active administrator(s) have not enrolled MFA.`,
          'Ask each administrator to enable an authenticator app under Settings > Security (NIST IA-2(1), SOC 2 CC6.1).', { metrics });
      }
      return pass(`All ${admins} active administrator(s) have MFA enrolled.`, { metrics });
    }
  }
];
