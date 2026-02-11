'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { requiresOrganizationOnboarding } from '@/lib/access';

export default function Home() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        const mustCompleteOnboarding = requiresOrganizationOnboarding(user) && !user?.onboardingCompleted;
        if (mustCompleteOnboarding) {
          router.push('/onboarding');
        } else if (String(user?.role || '').toLowerCase() === 'auditor') {
          router.push('/dashboard/auditor-workspace');
        } else {
          router.push('/dashboard');
        }
      } else {
        router.push('/login');
      }
    }
  }, [user, isAuthenticated, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>
  );
}
