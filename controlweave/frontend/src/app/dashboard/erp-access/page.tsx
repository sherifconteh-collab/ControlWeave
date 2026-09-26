'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/access';
import { useAddon } from '@/hooks/useAddon';
import AddonBanner from '@/components/billing/AddonBanner';
import { erpAPI } from '@/lib/api';
import { errorMessage } from '@/components/policies/policyShared';
import { ErrorBanner, StatCard, Tabs } from '@/components/erp/erpShared';
import SystemsPanel, { type ErpSystem } from '@/components/erp/SystemsPanel';
import ConflictsPanel from '@/components/erp/ConflictsPanel';
import RulesPanel from '@/components/erp/RulesPanel';
import ReviewsPanel from '@/components/erp/ReviewsPanel';
import EmergencyPanel from '@/components/erp/EmergencyPanel';

interface Summary {
  systems: number;
  active_users: number;
  open_conflicts: number;
  critical_conflicts: number;
  mitigated_conflicts: number;
  expired_acceptances: number;
  active_reviews: number;
  unverified_revocations: number;
  pending_emergency_reviews: number;
}

export default function ErpAccessPage() {
  const { user } = useAuth();
  const erpAddon = useAddon('erp');
  // Managing ERP data needs the permission and the ERP Governance add-on.
  const canManage = hasPermission(user, 'erp.manage') && erpAddon.licensed;
  const [tab, setTab] = useState('systems');
  const [systems, setSystems] = useState<ErpSystem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, sum] = await Promise.all([erpAPI.listSystems(), erpAPI.summary()]);
      setSystems((s.data?.data || []) as ErpSystem[]);
      setSummary(sum.data?.data as Summary);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load ERP access governance'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tabs = [
    { id: 'systems', label: 'Systems & users', count: summary?.systems },
    { id: 'conflicts', label: 'SoD conflicts', count: summary?.open_conflicts },
    { id: 'rules', label: 'SoD rules' },
    { id: 'reviews', label: 'Access reviews', count: summary?.active_reviews },
    { id: 'emergency', label: 'Emergency access', count: summary?.pending_emergency_reviews },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900">ERP Access Governance</h1>
        <p className="text-sm text-gray-600 mt-1 mb-4 max-w-3xl">
          Import users, roles and entitlements from any ERP, find segregation of duties conflicts at the business-function level,
          record mitigating controls, run access recertifications and review emergency access.
        </p>
        <AddonBanner addon={erpAddon} />
        <ErrorBanner message={error} />
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard label="Active ERP users" value={summary.active_users} />
            <StatCard label="Open conflicts" value={summary.open_conflicts} tone={summary.open_conflicts ? 'bad' : 'good'} hint={`${summary.critical_conflicts} critical`} />
            <StatCard label="Mitigated" value={summary.mitigated_conflicts} hint={summary.expired_acceptances ? `${summary.expired_acceptances} expired acceptance(s)` : undefined} tone={summary.expired_acceptances ? 'warn' : 'default'} />
            <StatCard label="Revocations to verify" value={summary.unverified_revocations} tone={summary.unverified_revocations ? 'warn' : 'default'} />
            <StatCard label="Emergency sessions to review" value={summary.pending_emergency_reviews} tone={summary.pending_emergency_reviews ? 'warn' : 'good'} />
          </div>
        )}
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        {tab === 'systems' && <SystemsPanel canManage={canManage} systems={systems} onChanged={load} />}
        {tab === 'conflicts' && <ConflictsPanel canManage={canManage} systems={systems} onChanged={load} />}
        {tab === 'rules' && <RulesPanel canManage={canManage} />}
        {tab === 'reviews' && <ReviewsPanel canManage={canManage} systems={systems} onChanged={load} />}
        {tab === 'emergency' && <EmergencyPanel canManage={canManage} onChanged={load} />}
      </div>
    </DashboardLayout>
  );
}
