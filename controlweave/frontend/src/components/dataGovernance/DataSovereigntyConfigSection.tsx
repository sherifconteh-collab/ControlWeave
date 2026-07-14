// @tier: enterprise
'use client';

import { useCallback, useEffect, useState } from 'react';
import { dataSovereigntyAPI } from '@/lib/api';
import { SovereigntyConfig, ShowToastFn, sovereigntyErrorMessage } from './dataSovereigntyTypes';

export default function DataSovereigntyConfigSection({ canWrite, showToast }: { canWrite: boolean; showToast: ShowToastFn }) {
  const [config, setConfig] = useState<SovereigntyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    primary_data_region: '',
    cross_border_transfer_allowed: true,
    approved_transfer_regionsInput: '',
    data_localization_policy: '',
  });

  const loadConfig = useCallback(async (cancelledRef?: { current: boolean }) => {
    try {
      setLoading(true);
      setError('');
      const response = await dataSovereigntyAPI.getConfig();
      const data: SovereigntyConfig | undefined = response.data?.data;
      if (!cancelledRef?.current && data) {
        setConfig(data);
        setForm({
          primary_data_region: data.primary_data_region || '',
          cross_border_transfer_allowed: data.cross_border_transfer_allowed ?? true,
          approved_transfer_regionsInput: Array.isArray(data.approved_transfer_regions)
            ? data.approved_transfer_regions.join(', ')
            : '',
          data_localization_policy: data.data_localization_policy || '',
        });
      }
    } catch {
      if (!cancelledRef?.current) setError('Failed to load data sovereignty configuration.');
    } finally {
      if (!cancelledRef?.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };
    loadConfig(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadConfig]);

  const submit = async () => {
    setSaving(true);
    try {
      const approvedRegions = form.approved_transfer_regionsInput
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      await dataSovereigntyAPI.updateConfig({
        primary_data_region: form.primary_data_region.trim() || undefined,
        cross_border_transfer_allowed: form.cross_border_transfer_allowed,
        approved_transfer_regions: approvedRegions,
        data_localization_policy: form.data_localization_policy.trim() || undefined,
      });
      showToast('Data sovereignty configuration updated.');
      await loadConfig();
    } catch (err) {
      showToast(sovereigntyErrorMessage(err, 'Failed to update configuration.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-32 rounded bg-gray-100" />;
  }
  if (error) {
    return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900">Sovereignty Configuration</h3>
        <p className="text-xs text-gray-500 mt-1">
          Defines your organization&apos;s primary data region, cross-border transfer policy, and data
          localization stance.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Primary Data Region</span>
          <input
            type="text"
            value={form.primary_data_region}
            onChange={(e) => setForm((prev) => ({ ...prev, primary_data_region: e.target.value }))}
            disabled={!canWrite}
            placeholder="us-east-1"
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
          />
        </label>
        <label className="flex items-center gap-2 mt-6 md:mt-6">
          <input
            type="checkbox"
            checked={form.cross_border_transfer_allowed}
            onChange={(e) => setForm((prev) => ({ ...prev, cross_border_transfer_allowed: e.target.checked }))}
            disabled={!canWrite}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Cross-border data transfer allowed</span>
        </label>
        <label className="block md:col-span-2">
          <span className="text-xs font-medium text-gray-700">Approved Transfer Regions (comma-separated)</span>
          <input
            type="text"
            value={form.approved_transfer_regionsInput}
            onChange={(e) => setForm((prev) => ({ ...prev, approved_transfer_regionsInput: e.target.value }))}
            disabled={!canWrite}
            placeholder="EU, US, UK"
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-xs font-medium text-gray-700">Data Localization Policy</span>
          <textarea
            value={form.data_localization_policy}
            onChange={(e) => setForm((prev) => ({ ...prev, data_localization_policy: e.target.value }))}
            disabled={!canWrite}
            rows={3}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
          />
        </label>
      </div>
      {config?.sovereignty_attestation_date && (
        <p className="text-xs text-gray-500">
          Last attested {new Date(config.sovereignty_attestation_date).toLocaleDateString()}.
        </p>
      )}
      {canWrite ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          You can view configuration, but only users with <code>organizations.write</code> can update it.
        </p>
      )}
    </div>
  );
}
