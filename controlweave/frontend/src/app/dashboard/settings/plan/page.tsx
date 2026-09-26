'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/access';
import { billingAPI } from '@/lib/api';

interface CatalogPlan {
  id: string;
  label: string;
  users: number;
  features: string[];
  description: string;
}

interface Entitlements {
  commercialMode: boolean;
  plan: string;
  label: string;
  source: string;
  licensee?: string;
  trialEndsAt?: string;
  features: string[];
  userLimit: number;
  activeUsers: number;
  catalog: CatalogPlan[];
  featureLabels: Record<string, string>;
}

const SOURCE_LABELS: Record<string, string> = {
  license: 'self-hosted license',
  subscription: 'subscription',
  comped: 'complimentary',
  trial: 'trial',
  default: 'free plan',
  open: 'open source',
};

function apiError(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof data?.error === 'string' ? data.error : fallback;
}

function PlanView() {
  const { user } = useAuth();
  const params = useSearchParams();
  const canManage = hasPermission(user, 'settings.manage');
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [interval, setBillingInterval] = useState<'monthly' | 'annual'>('annual');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    billingAPI.getEntitlements()
      .then((res) => setEnt(res.data?.data as Entitlements))
      .catch((err: unknown) => setError(apiError(err, 'Could not load your plan.')));
    billingAPI.getSubscription()
      .then((res) => setBillingEnabled(Boolean(res.data?.data?.billing_enabled)))
      .catch(() => setBillingEnabled(false));
  }, []);

  const checkout = async (plan: 'pro' | 'enterprise') => {
    setBusy(true);
    setError('');
    try {
      const res = await billingAPI.startCheckout(plan, interval);
      window.location.href = res.data?.data?.url as string;
    } catch (err: unknown) {
      setError(apiError(err, 'Could not start checkout.'));
      setBusy(false);
    }
  };

  const portal = async () => {
    setBusy(true);
    try {
      const res = await billingAPI.createPortalSession();
      window.location.href = res.data?.data?.url as string;
    } catch (err: unknown) {
      setError(apiError(err, 'Could not open billing.'));
      setBusy(false);
    }
  };

  const checkoutState = params.get('checkout');

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900">Plan and billing</h1>
        {checkoutState === 'success' && <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">Thank you. Your plan updates as soon as the payment is confirmed (usually within a minute).</div>}
        {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">{error}</div>}
        {!ent ? (
          <p className="mt-4 text-sm text-gray-500">Loading…</p>
        ) : !ent.commercialMode ? (
          <div className="mt-4 bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-sm text-gray-700">This deployment runs the open-source edition: every feature is included and there are no user limits.</p>
          </div>
        ) : (
          <>
            <div className="mt-4 bg-white border border-gray-200 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm text-gray-500">Current plan</div>
                <div className="text-xl font-semibold text-gray-900">{ent.label}</div>
                <div className="text-xs text-gray-500">
                  Through {SOURCE_LABELS[ent.source] || ent.source}{ent.licensee ? ` (${ent.licensee})` : ''}
                  {ent.trialEndsAt ? `, trial ends ${new Date(ent.trialEndsAt).toLocaleDateString()}` : ''}
                </div>
              </div>
              <div className="text-sm text-gray-700">
                {ent.activeUsers} of {ent.userLimit < 0 ? 'unlimited' : ent.userLimit} users
              </div>
              {canManage && billingEnabled && ent.source === 'subscription' && (
                <button type="button" onClick={portal} disabled={busy} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Manage billing</button>
              )}
            </div>

            {billingEnabled && canManage && (
              <div className="mt-6 flex items-center gap-2 text-sm" role="radiogroup" aria-label="Billing interval">
                {(['monthly', 'annual'] as const).map((i) => (
                  <button key={i} type="button" role="radio" aria-checked={interval === i} onClick={() => setBillingInterval(i)}
                    className={`px-3 py-1 rounded-md border ${interval === i ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-300 text-gray-700'}`}>
                    {i === 'monthly' ? 'Monthly' : 'Annual'}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {ent.catalog.map((plan) => (
                <div key={plan.id} className={`bg-white border rounded-lg p-4 flex flex-col ${plan.id === ent.plan ? 'border-purple-500' : 'border-gray-200'}`}>
                  <h2 className="font-semibold text-gray-900">{plan.label}</h2>
                  <p className="text-xs text-gray-600 mt-1">{plan.description}</p>
                  <p className="text-xs text-gray-700 mt-2">{plan.users < 0 ? 'Unlimited users' : `Up to ${plan.users} users`}</p>
                  <ul role="list" className="mt-2 space-y-1 text-xs text-gray-700 flex-1">
                    {plan.features.map((f) => <li role="listitem" key={f}>{ent.featureLabels[f] || f}</li>)}
                  </ul>
                  {plan.id === ent.plan ? (
                    <span className="mt-3 text-xs font-medium text-purple-700">Current plan</span>
                  ) : (plan.id === 'pro' || plan.id === 'enterprise') && billingEnabled && canManage ? (
                    <button type="button" disabled={busy} onClick={() => checkout(plan.id as 'pro' | 'enterprise')} className="mt-3 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50">
                      Choose {plan.label}
                    </button>
                  ) : plan.id === 'gov' ? (
                    <span className="mt-3 text-xs text-gray-500">Contact sales for a license key</span>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={null}>
      <PlanView />
    </Suspense>
  );
}
