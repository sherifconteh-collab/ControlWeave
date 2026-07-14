// @tier: govcloud
'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import AiLawsJurisdictionView, { AiLawsVariant } from '@/components/aiLaws/AiLawsJurisdictionView';

export default function AiLawsPage() {
  const [variant, setVariant] = useState<AiLawsVariant>('state');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Laws</h1>
          <p className="text-gray-600 mt-2">
            Track your organization&apos;s implementation status against US state and international AI
            governance laws, with NIST AI RMF crosswalk mappings.
          </p>
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            {([
              { key: 'state', label: 'US State Laws' },
              { key: 'international', label: 'International' },
            ] as { key: AiLawsVariant; label: string }[]).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setVariant(tab.key)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  variant === tab.key ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <AiLawsJurisdictionView variant={variant} />
      </div>
    </DashboardLayout>
  );
}
