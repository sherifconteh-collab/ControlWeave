'use client';

import Link from 'next/link';
import type { AddonState } from '@/hooks/useAddon';

interface AddonBannerProps {
  addon: AddonState;
}

/**
 * Shown on an add-on module's pages when the organization has not licensed
 * it. Existing data stays readable; creating, importing and running are
 * disabled until the module is added.
 */
export default function AddonBanner({ addon }: AddonBannerProps) {
  if (addon.loading || addon.licensed) return null;
  return (
    <div className="mb-4 border border-purple-200 bg-purple-50 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3" role="status">
      <div className="max-w-3xl">
        <div className="font-semibold text-purple-900">{addon.label} is a separately licensed module</div>
        <p className="text-sm text-purple-800 mt-1">
          It is not included in any plan. Add it to your subscription, or ask for a license key for a self-hosted deployment.
          Anything already recorded here stays available to view and export.
        </p>
      </div>
      <Link href="/dashboard/settings/plan#addons" className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700">
        Add {addon.label}
      </Link>
    </div>
  );
}
