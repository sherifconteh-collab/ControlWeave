'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { requiresOrganizationOnboarding } from '@/lib/access';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  organizationId: string;
  organizationName?: string;
  organizationTier?: string;
  billingStatus?: string;
  trialStatus?: string;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  onboardingCompleted?: boolean;
  roles: string[];
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithTokens: (accessToken: string, refreshToken: string, userData?: any) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string,
    organizationName?: string,
    initialRole?: 'admin' | 'auditor' | 'user',
    frameworkCodes?: string[],
    informationTypes?: string[]
  ) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check if user is logged in on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const mapCurrentUser = (userData: any): User => ({
    id: userData.id,
    email: userData.email,
    fullName: userData.full_name,
    role: userData.role,
    organizationId: userData.organization?.id || '',
    organizationName: userData.organization?.name,
    organizationTier: userData.organization?.tier,
    billingStatus: userData.organization?.billing_status,
    trialStatus: userData.organization?.trial_status,
    trialStartedAt: userData.organization?.trial_started_at || null,
    trialEndsAt: userData.organization?.trial_ends_at || null,
    onboardingCompleted: Boolean(userData.organization?.onboarding_completed),
    roles: userData.roles || [],
    permissions: userData.permissions || []
  });

  const resolvePostAuthRoute = (currentUser: User) => {
    if (requiresOrganizationOnboarding(currentUser) && !currentUser.onboardingCompleted) {
      return '/onboarding';
    }

    if (String(currentUser.role || '').toLowerCase() === 'auditor') {
      return '/dashboard/auditor-workspace';
    }

    return '/dashboard';
  };

  const fetchCurrentUser = async (): Promise<User> => {
    const response = await authAPI.getCurrentUser();
    return mapCurrentUser(response.data.data);
  };

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setLoading(false);
        return;
      }

      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login({ email, password });
      const { tokens } = response.data.data;

      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);

      const currentUser = await fetchCurrentUser();
      setUser(currentUser);

      router.push(resolvePostAuthRoute(currentUser));
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  };

  const loginWithTokens = async (accessToken: string, refreshToken: string, _userData?: any) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);
    router.push(resolvePostAuthRoute(currentUser));
  };

  const register = async (
    email: string,
    password: string,
    fullName: string,
    organizationName: string = '',
    initialRole: 'admin' | 'auditor' | 'user' = 'admin',
    frameworkCodes: string[] = [],
    informationTypes: string[] = []
  ) => {
    try {
      const response = await authAPI.register({
        email,
        password,
        fullName,
        organizationName,
        initialRole,
        frameworkCodes,
        informationTypes
      });
      const { tokens } = response.data.data;

      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);

      const currentUser = await fetchCurrentUser();
      setUser(currentUser);

      router.push(resolvePostAuthRoute(currentUser));
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithTokens,
        register,
        refreshUser,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
