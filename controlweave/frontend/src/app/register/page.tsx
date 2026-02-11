'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { APP_NAME, APP_POSITIONING_SHORT, APP_TAGLINE } from '@/lib/branding';

const FRAMEWORK_OPTIONS = [
  { code: 'nist_csf_2.0', label: 'NIST CSF 2.0', description: 'Great private-sector baseline for governance and operations.' },
  { code: 'iso_27001', label: 'ISO 27001', description: 'Strong fit for private companies and enterprise buyers.' },
  { code: 'soc2', label: 'SOC 2', description: 'Useful for SaaS trust reporting and customer assurance.' },
  { code: 'nist_800_53', label: 'NIST 800-53', description: 'Federal-grade control catalog with RMF workflow expectations.' },
  { code: 'nist_800_171', label: 'NIST 800-171', description: 'Required for many CUI/DoD supply-chain programs.' },
] as const;

const NIST_INFORMATION_TYPE_OPTIONS = [
  { value: 'cui', label: 'Controlled Unclassified Information (CUI)' },
  { value: 'fci', label: 'Federal Contract Information (FCI)' },
  { value: 'pii', label: 'Personally Identifiable Information (PII)' },
  { value: 'phi', label: 'Protected Health Information (PHI)' },
  { value: 'financial', label: 'Financial Information' },
  { value: 'operational', label: 'Operational / Mission Data' },
  { value: 'ip', label: 'Intellectual Property' },
  { value: 'confidential', label: 'Confidential Business Data' },
  { value: 'restricted', label: 'Restricted Data' },
  { value: 'internal', label: 'Internal Use Information' },
  { value: 'public', label: 'Public Information' },
  { value: 'pci', label: 'Payment Card Information (PCI)' },
] as const;

function toggleArrayValue(current: string[], value: string) {
  if (current.includes(value)) {
    return current.filter((entry) => entry !== value);
  }
  return [...current, value];
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [initialRole, setInitialRole] = useState<'admin' | 'auditor' | 'user'>('admin');
  const [frameworkCodes, setFrameworkCodes] = useState<string[]>(['nist_csf_2.0', 'iso_27001']);
  const [informationTypes, setInformationTypes] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const organizationIsRequired = initialRole === 'admin';
  const requiresRmfTrack = frameworkCodes.includes('nist_800_53') || frameworkCodes.includes('nist_800_171');
  const requiresNistInformationTypes = frameworkCodes.includes('nist_800_53');

  useEffect(() => {
    if (!requiresNistInformationTypes && informationTypes.length > 0) {
      setInformationTypes([]);
    }
  }, [requiresNistInformationTypes, informationTypes.length]);

  const toggleFramework = (code: string) => {
    setFrameworkCodes((current) => {
      if (current.includes(code)) {
        return current.filter((entry) => entry !== code);
      }
      return [...current, code];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }

    const normalizedOrganizationName = organizationName.trim();
    if (organizationIsRequired && !normalizedOrganizationName) {
      setError('Organization name is required for admin signup');
      return;
    }

    if (organizationIsRequired && frameworkCodes.length === 0) {
      setError('Select at least one framework to initialize your organization');
      return;
    }

    if (organizationIsRequired && requiresNistInformationTypes && informationTypes.length === 0) {
      setError('NIST 800-53 requires at least one information type selection (NIST SP 800-60).');
      return;
    }

    setLoading(true);

    try {
      await register(
        email,
        password,
        fullName,
        normalizedOrganizationName,
        initialRole,
        organizationIsRequired ? frameworkCodes : [],
        organizationIsRequired && requiresNistInformationTypes ? informationTypes : []
      );
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-800">
      <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-600 mt-2">Join {APP_NAME} - {APP_TAGLINE}</p>
          <p className="text-xs text-purple-700 mt-2 font-medium">
            Community Edition · Free tier · Open source
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label htmlFor="initialRole" className="block text-sm font-medium text-gray-700 mb-2">
              Initial Role
            </label>
            <select
              id="initialRole"
              value={initialRole}
              onChange={(e) => setInitialRole(e.target.value as 'admin' | 'auditor' | 'user')}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="admin">Admin (recommended for first user)</option>
              <option value="auditor">Auditor (read-focused)</option>
              <option value="user">User (implementation contributor)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Choose your working mode first. Admins can update role assignments later.
            </p>
          </div>

          <div>
            <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700 mb-2">
              {organizationIsRequired ? 'Organization Name' : 'Organization / Client (Optional)'}
            </label>
            <input
              id="organizationName"
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              required={organizationIsRequired}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder={organizationIsRequired ? 'Enter your organization name' : 'Optional now; can be set later'}
            />
            <p className="text-xs text-gray-500 mt-1">
              {organizationIsRequired
                ? 'Required for admin onboarding.'
                : 'You can start immediately and set organization details later.'}
            </p>
            {!organizationIsRequired && (
              <p className="text-xs text-gray-500 mt-1">
                Current account model supports one organization per login. If you manage multiple organizations, use separate accounts for now.
              </p>
            )}
          </div>

          {organizationIsRequired && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frameworks To Start With
              </label>
              <div className="space-y-2 border border-gray-200 rounded-md p-3 max-h-56 overflow-y-auto">
                {FRAMEWORK_OPTIONS.map((framework) => (
                  <label key={framework.code} className="flex items-start gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={frameworkCodes.includes(framework.code)}
                      onChange={() => toggleFramework(framework.code)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium text-gray-900">{framework.label}</span>
                      <span className="block text-xs text-gray-500">{framework.description}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Pick the frameworks that match your organization now. You can update this later in settings.
              </p>
              {requiresRmfTrack && (
                <p className="text-xs text-indigo-700 mt-1">
                  NIST 800-53/171 selected. RMF-specific onboarding fields will be enabled after signup.
                </p>
              )}

              {requiresNistInformationTypes && (
                <div className="mt-4 border border-indigo-100 bg-indigo-50 rounded-md p-3">
                  <p className="text-sm font-medium text-indigo-900">
                    Information Types Required (NIST SP 800-53 + SP 800-60)
                  </p>
                  <p className="text-xs text-indigo-800 mt-1">
                    Select the information types your system processes. This is required when 800-53 is in scope.
                  </p>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {NIST_INFORMATION_TYPE_OPTIONS.map((option) => (
                      <label key={option.value} className="flex items-start gap-2 text-sm text-indigo-900">
                        <input
                          type="checkbox"
                          checked={informationTypes.includes(option.value)}
                          onChange={() => setInformationTypes((current) => toggleArrayValue(current, option.value))}
                          className="mt-1"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="At least 12 characters"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must include uppercase, lowercase, number, and special character
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Re-enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-md font-semibold hover:bg-purple-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-purple-600 hover:text-purple-700 font-semibold">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            {APP_POSITIONING_SHORT}
          </p>
        </div>
      </div>
    </div>
  );
}
