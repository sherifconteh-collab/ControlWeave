'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { requiresOrganizationOnboarding } from '@/lib/access';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { WebSocketStatusIndicator } from './WebSocketStatusIndicator';
import Sidebar from './Sidebar';
import AICopilot from './AICopilot';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  
  const mustCompleteOnboarding = Boolean(
    user && requiresOrganizationOnboarding(user) && !user.onboardingCompleted
  );

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (mustCompleteOnboarding) {
      router.push('/onboarding');
    }
  }, [mustCompleteOnboarding, isAuthenticated, loading, router]);

  // Get access token for WebSocket authentication
  useEffect(() => {
    if (isAuthenticated) {
      const accessToken = localStorage.getItem('accessToken');
      setToken(accessToken);
    }
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || mustCompleteOnboarding) {
    return null;
  }

  return (
    <WebSocketProvider token={token} enabled={isAuthenticated}>
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">{children}</div>
        </main>
        <AICopilot />
        <WebSocketStatusIndicator />
      </div>
    </WebSocketProvider>
  );
}
