// @tier: enterprise
'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/access';
import { useToast } from '@/hooks/useToast';
import DataSovereigntyConfigSection from './DataSovereigntyConfigSection';
import DataSovereigntyJurisdictionsSection from './DataSovereigntyJurisdictionsSection';
import DataSovereigntyRegulatoryChangesSection from './DataSovereigntyRegulatoryChangesSection';
import DataSovereigntyGapAnalysisSection from './DataSovereigntyGapAnalysisSection';

type SovereigntySubTab = 'config' | 'jurisdictions' | 'regulatory-changes' | 'gap-analysis';

const SUB_TABS: { key: SovereigntySubTab; label: string }[] = [
  { key: 'config', label: 'Config' },
  { key: 'jurisdictions', label: 'Jurisdictions' },
  { key: 'regulatory-changes', label: 'Regulatory Changes' },
  { key: 'gap-analysis', label: 'Gap Analysis' },
];

export default function DataSovereigntyTab() {
  const { user } = useAuth();
  const { toast, toastType, showToast } = useToast();
  const canWriteOrg = hasPermission(user, 'organizations.write');
  const canManageFrameworks = hasPermission(user, 'frameworks.manage');
  const [subTab, setSubTab] = useState<SovereigntySubTab>('config');

  return (
    <div className="space-y-4">
      {toast && (
        <div role="status" aria-live="polite" className={`fixed top-6 right-6 z-50 px-4 py-2 rounded-lg shadow text-white ${toastType === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast}
        </div>
      )}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Data Sovereignty</h2>
        <p className="text-sm text-gray-600 mt-1">
          Track where your organization operates, cross-border transfer policy, and jurisdiction-specific
          regulatory obligations.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSubTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                subTab === tab.key ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {subTab === 'config' && <DataSovereigntyConfigSection canWrite={canWriteOrg} showToast={showToast} />}
      {subTab === 'jurisdictions' && <DataSovereigntyJurisdictionsSection canWrite={canWriteOrg} showToast={showToast} />}
      {subTab === 'regulatory-changes' && <DataSovereigntyRegulatoryChangesSection canManage={canManageFrameworks} showToast={showToast} />}
      {subTab === 'gap-analysis' && <DataSovereigntyGapAnalysisSection />}
    </div>
  );
}
