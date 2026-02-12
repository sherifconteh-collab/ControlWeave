'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from './NotificationBell';
import { APP_NAME } from '@/lib/branding';
import { AccessUser, canAccessAuditorWorkspace, hasAnyPermission, hasPermission, hasTierAtLeast, OrganizationTier } from '@/lib/access';

interface NavigationItem {
  name: string;
  href: string;
  icon: string;
  requiredPermissions?: string[];
  requiredPermissionsAny?: string[];
  minTier?: OrganizationTier;
  isVisible?: (user: AccessUser | null | undefined) => boolean;
}

const navigation: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: '📊',
    requiredPermissions: ['dashboard.read']
  },
  {
    name: 'Frameworks',
    href: '/dashboard/frameworks',
    icon: '🎯',
    requiredPermissions: ['frameworks.read', 'organizations.read']
  },
  {
    name: 'NIST Mappings',
    href: '/dashboard/frameworks/mappings',
    icon: '🧩',
    requiredPermissions: ['frameworks.read']
  },
  {
    name: 'Controls',
    href: '/dashboard/controls',
    icon: '✅',
    requiredPermissions: ['organizations.read']
  },
  {
    name: 'Evidence',
    href: '/dashboard/evidence',
    icon: '📄',
    requiredPermissions: ['evidence.read'],
    minTier: 'starter'
  },
  {
    name: 'Assets',
    href: '/dashboard/assets',
    icon: '🏗️',
    requiredPermissions: ['assets.read'],
    minTier: 'starter'
  },
  {
    name: 'Vulnerabilities',
    href: '/dashboard/vulnerabilities',
    icon: '🛡️',
    requiredPermissions: ['assets.read'],
    minTier: 'starter'
  },
  {
    name: 'SBOM',
    href: '/dashboard/sbom',
    icon: '📦',
    requiredPermissions: ['assets.read'],
    minTier: 'professional'
  },
  {
    name: 'Assessments',
    href: '/dashboard/assessments',
    icon: '📋',
    requiredPermissions: ['assessments.read']
  },
  {
    name: 'Auditor Workspace',
    href: '/dashboard/auditor-workspace',
    icon: '🗂️',
    requiredPermissions: ['assessments.read'],
    isVisible: (currentUser) => canAccessAuditorWorkspace(currentUser)
  },
  {
    name: 'Reports',
    href: '/dashboard/reports',
    icon: '📑',
    requiredPermissions: ['reports.read'],
    minTier: 'starter'
  },
  {
    name: 'Operations',
    href: '/dashboard/operations',
    icon: '🧭',
    requiredPermissions: ['settings.manage']
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: '⚙️',
    requiredPermissionsAny: ['settings.manage', 'roles.manage']
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const visibleNavigation = navigation.filter((item) => {
    const hasRequiredPermission = item.requiredPermissions
      ? item.requiredPermissions.every((permission) => hasPermission(user, permission))
      : true;
    const hasAnyRequiredPermission = item.requiredPermissionsAny
      ? hasAnyPermission(user, item.requiredPermissionsAny)
      : true;
    const hasRequiredTier = item.minTier
      ? hasTierAtLeast(user, item.minTier)
      : true;
    const passesVisibilityGate = item.isVisible ? item.isVisible(user) : true;

    return hasRequiredPermission && hasAnyRequiredPermission && hasRequiredTier && passesVisibilityGate;
  });

  return (
    <div className="relative z-20 flex flex-col w-64 bg-gray-900 min-h-screen overflow-visible">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 bg-gray-800 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">{APP_NAME}</h1>
      </div>

      {/* User Info */}
      <div className="relative z-30 p-4 border-b border-gray-700 overflow-visible">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold">
            {user?.fullName?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.fullName || 'User'}
            </p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <NotificationBell />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {visibleNavigation.map((item) => {
          const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
          return (
            <Link
              key={`${item.href}-${item.name}`}
              href={item.href}
              className={`
                flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
                ${
                  isActive
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }
              `}
            >
              <span className="mr-3 text-lg">{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={logout}
          className="w-full flex items-center px-4 py-2 text-sm font-medium text-gray-300 rounded-lg hover:bg-gray-800 hover:text-white transition-colors"
        >
          <span className="mr-3">🚪</span>
          Logout
        </button>
      </div>
    </div>
  );
}
