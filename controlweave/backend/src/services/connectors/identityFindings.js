'use strict';

/**
 * Shared scoring for identity-provider connectors (Okta, Microsoft Entra ID).
 * Input is a normalized user list; output is the findings and metrics a run
 * records and attaches as evidence for account management (AC-2), MFA (IA-2)
 * and access review controls.
 *
 *   { id, login, enabled, isAdmin, mfaRegistered (true|false|null),
 *     lastLoginAt, createdAt }
 */

const { daysSince } = require('./http');

function assessIdentities(users, { inactiveDays = 90, now = Date.now() } = {}) {
  const active = users.filter((u) => u.enabled);
  const mfaKnown = active.filter((u) => u.mfaRegistered !== null);
  const withoutMfa = mfaKnown.filter((u) => u.mfaRegistered === false);
  const admins = active.filter((u) => u.isAdmin);
  const inactive = active.filter((u) => {
    const idle = daysSince(u.lastLoginAt, now);
    const age = daysSince(u.createdAt, now);
    return idle === null ? age !== null && age > inactiveDays : idle > inactiveDays;
  });

  const findings = [
    ...admins.filter((u) => u.mfaRegistered === false).map((u) => ({
      severity: 'critical', rule: 'admin_without_mfa', resource: u.login,
      title: 'Administrator without multi-factor authentication'
    })),
    ...withoutMfa.filter((u) => !u.isAdmin).map((u) => ({
      severity: 'high', rule: 'user_without_mfa', resource: u.login,
      title: 'Active user without multi-factor authentication'
    })),
    ...inactive.map((u) => ({
      severity: u.isAdmin ? 'high' : 'medium', rule: 'inactive_account', resource: u.login,
      title: `Enabled account with no sign-in for more than ${inactiveDays} days`
    }))
  ];

  const metrics = {
    total_accounts: users.length,
    active_accounts: active.length,
    administrators: admins.length,
    mfa_status_known: mfaKnown.length,
    mfa_registered: mfaKnown.length - withoutMfa.length,
    mfa_coverage_percent: mfaKnown.length ? Math.round(((mfaKnown.length - withoutMfa.length) / mfaKnown.length) * 1000) / 10 : null,
    inactive_accounts: inactive.length,
    inactive_threshold_days: inactiveDays
  };
  return { findings, metrics };
}

module.exports = { assessIdentities };
