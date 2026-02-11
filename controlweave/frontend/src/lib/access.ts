export type OrganizationTier = 'free' | 'starter' | 'professional' | 'enterprise' | 'utilities';

export const TIER_LEVELS: Record<string, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
  utilities: 3,
};

export interface AccessUser {
  role?: string;
  roles?: string[];
  permissions?: string[];
  organizationTier?: string;
  onboardingCompleted?: boolean;
}

function normalizeRoleNames(user: AccessUser | null | undefined): string[] {
  if (!user) return [];
  const primaryRole = String(user.role || '').toLowerCase().trim();
  const mappedRoles = Array.isArray(user.roles)
    ? user.roles.map((entry) => String(entry || '').toLowerCase().trim())
    : [];
  return [primaryRole, ...mappedRoles].filter((entry) => entry.length > 0);
}

export function normalizeTier(tier?: string | null): OrganizationTier {
  const value = String(tier || '').toLowerCase();
  if (value in TIER_LEVELS) {
    return value as OrganizationTier;
  }
  return 'free';
}

export function hasPermission(user: AccessUser | null | undefined, permission: string): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const permissions = user.permissions || [];
  return permissions.includes('*') || permissions.includes(permission);
}

export function hasAnyPermission(user: AccessUser | null | undefined, permissions: string[]): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function hasTierAtLeast(user: AccessUser | null | undefined, minTier: OrganizationTier): boolean {
  if (!user) return false;
  const userLevel = TIER_LEVELS[normalizeTier(user.organizationTier)];
  const requiredLevel = TIER_LEVELS[normalizeTier(minTier)];
  return userLevel >= requiredLevel;
}

export function requiresOrganizationOnboarding(user: AccessUser | null | undefined): boolean {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  if (role !== 'admin') return false;

  const normalizedRoles = Array.isArray(user.roles)
    ? user.roles.map((entry) => String(entry || '').toLowerCase())
    : [];

  return !normalizedRoles.includes('auditor');
}

export function canAccessAuditorWorkspace(user: AccessUser | null | undefined): boolean {
  const roleNames = normalizeRoleNames(user);
  return roleNames.some((entry) => /^auditor(?:_|$)/.test(entry));
}
