// @tier: enterprise
'use client';

import { useCallback, useEffect, useState } from 'react';
import { dataSovereigntyAPI } from '@/lib/api';
import {
  RegulatoryJurisdiction,
  RecommendedFramework,
  OrgJurisdiction,
  PRESENCE_TYPES,
  ShowToastFn,
  sovereigntyErrorMessage,
} from './dataSovereigntyTypes';

export default function DataSovereigntyJurisdictionsSection({ canWrite, showToast }: { canWrite: boolean; showToast: ShowToastFn }) {
  const [referenceJurisdictions, setReferenceJurisdictions] = useState<RegulatoryJurisdiction[]>([]);
  const [orgJurisdictions, setOrgJurisdictions] = useState<OrgJurisdiction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ jurisdiction_id: '', presence_type: 'office' as (typeof PRESENCE_TYPES)[number], compliance_required: false, notes: '' });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [lookupCode, setLookupCode] = useState('');
  const [lookupResult, setLookupResult] = useState<{ jurisdiction_name: string; recommended_frameworks: RecommendedFramework[] } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const loadAll = useCallback(async (cancelledRef?: { current: boolean }) => {
    try {
      setLoading(true);
      setError('');
      const [refRes, orgRes] = await Promise.all([
        dataSovereigntyAPI.getJurisdictions(),
        dataSovereigntyAPI.getOrgJurisdictions(),
      ]);
      if (!cancelledRef?.current) {
        setReferenceJurisdictions(Array.isArray(refRes.data?.data) ? refRes.data.data : []);
        setOrgJurisdictions(Array.isArray(orgRes.data?.data) ? orgRes.data.data : []);
      }
    } catch {
      if (!cancelledRef?.current) setError('Failed to load jurisdiction data.');
    } finally {
      if (!cancelledRef?.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };
    loadAll(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadAll]);

  const submitAdd = async () => {
    if (!addForm.jurisdiction_id) {
      showToast('Select a jurisdiction to add.', 'error');
      return;
    }
    setSaving(true);
    try {
      await dataSovereigntyAPI.addOrgJurisdiction({
        jurisdiction_id: addForm.jurisdiction_id,
        presence_type: addForm.presence_type,
        compliance_required: addForm.compliance_required,
        notes: addForm.notes.trim() || undefined,
      });
      setShowAddForm(false);
      setAddForm({ jurisdiction_id: '', presence_type: 'office', compliance_required: false, notes: '' });
      await loadAll();
    } catch (err) {
      showToast(sovereigntyErrorMessage(err, 'Failed to add jurisdiction.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeJurisdiction = async (id: string) => {
    if (!window.confirm('Remove this jurisdiction from your organization?')) return;
    setBusyId(id);
    try {
      await dataSovereigntyAPI.removeOrgJurisdiction(id);
      await loadAll();
    } catch (err) {
      showToast(sovereigntyErrorMessage(err, 'Failed to remove jurisdiction.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const runLookup = async () => {
    if (!lookupCode.trim()) return;
    setLookupLoading(true);
    setLookupError('');
    setLookupResult(null);
    try {
      const response = await dataSovereigntyAPI.getJurisdictionFrameworks(lookupCode.trim().toUpperCase());
      setLookupResult(response.data?.data || null);
    } catch (err) {
      setLookupError(sovereigntyErrorMessage(err, 'Failed to fetch recommended frameworks for this jurisdiction.'));
    } finally {
      setLookupLoading(false);
    }
  };

  if (loading) return <div className="animate-pulse h-40 rounded bg-gray-100" />;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Organization Jurisdictions</h3>
            <p className="text-xs text-gray-500 mt-1">Where your organization operates and which compliance obligations apply.</p>
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={() => setShowAddForm((prev) => !prev)}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
            >
              + Add Jurisdiction
            </button>
          )}
        </div>

        {showAddForm && canWrite && (
          <div className="border border-purple-200 bg-purple-50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Jurisdiction</span>
                <select
                  value={addForm.jurisdiction_id}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, jurisdiction_id: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select a jurisdiction...</option>
                  {referenceJurisdictions.map((j) => (
                    <option key={j.id} value={j.id}>{j.jurisdiction_name} ({j.jurisdiction_code})</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Presence Type</span>
                <select
                  value={addForm.presence_type}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, presence_type: e.target.value as (typeof PRESENCE_TYPES)[number] }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {PRESENCE_TYPES.map((p) => (
                    <option key={p} value={p}>{p.replace('_', ' ')}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={addForm.compliance_required}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, compliance_required: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Compliance required</span>
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-medium text-gray-700">Notes</span>
                <input
                  type="text"
                  value={addForm.notes}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAdd}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {orgJurisdictions.length === 0 ? (
          <p className="text-sm text-gray-500">No jurisdictions added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200" role="list">
              <thead className="bg-gray-50">
                <tr role="listitem">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jurisdiction</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Presence</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Compliance Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Primary AI Law</th>
                  {canWrite && <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orgJurisdictions.map((oj) => (
                  <tr key={oj.id} role="listitem">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{oj.jurisdiction_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{oj.presence_type.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{oj.compliance_status.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{oj.primary_ai_law || '—'}</td>
                    {canWrite && (
                      <td className="px-4 py-3 text-sm">
                        <button
                          type="button"
                          onClick={() => removeJurisdiction(oj.id)}
                          disabled={busyId === oj.id}
                          className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Jurisdiction Reference</h3>
          <p className="text-xs text-gray-500 mt-1">Look up recommended frameworks for any tracked jurisdiction.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <select
            value={lookupCode}
            onChange={(e) => setLookupCode(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent md:w-64"
          >
            <option value="">Select a jurisdiction...</option>
            {referenceJurisdictions.map((j) => (
              <option key={j.id} value={j.jurisdiction_code}>{j.jurisdiction_name} ({j.jurisdiction_code})</option>
            ))}
          </select>
          <button
            type="button"
            onClick={runLookup}
            disabled={lookupLoading || !lookupCode}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {lookupLoading ? 'Looking up...' : 'Get Recommended Frameworks'}
          </button>
        </div>
        {lookupError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">{lookupError}</div>
        )}
        {lookupResult && (
          lookupResult.recommended_frameworks.length === 0 ? (
            <p className="text-sm text-gray-500">No recommended frameworks configured for {lookupResult.jurisdiction_name} yet.</p>
          ) : (
            <ul className="space-y-2" role="list">
              {lookupResult.recommended_frameworks.map((fw) => (
                <li key={fw.id} role="listitem" className="text-sm border border-gray-100 rounded px-3 py-2">
                  <span className="font-medium text-gray-900">{fw.name}</span>
                  {fw.version && <span className="text-gray-500 ml-1">v{fw.version}</span>}
                  {fw.description && <p className="text-xs text-gray-500 mt-0.5">{fw.description}</p>}
                </li>
              ))}
            </ul>
          )
        )}

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">All Tracked Jurisdictions</p>
          {referenceJurisdictions.length === 0 ? (
            <p className="text-sm text-gray-500">No data available.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {referenceJurisdictions.map((j) => (
                <div key={j.id} className="text-xs border border-gray-100 rounded px-3 py-2">
                  <span className="font-medium text-gray-800">{j.jurisdiction_name}</span>
                  <span className="text-gray-400 ml-1">({j.jurisdiction_code})</span>
                  <div className="text-gray-500 mt-0.5">{j.primary_ai_law || 'No AI law tracked'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
