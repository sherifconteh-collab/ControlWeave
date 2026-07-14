// @tier: enterprise
'use client';

import { useCallback, useEffect, useState } from 'react';
import { dataSovereigntyAPI } from '@/lib/api';
import {
  RegulatoryChange,
  RegulatoryJurisdiction,
  CHANGE_TYPES,
  CHANGE_STATUSES,
  IMPACT_BADGE_CLASSES,
  ShowToastFn,
  sovereigntyErrorMessage,
} from './dataSovereigntyTypes';

export default function DataSovereigntyRegulatoryChangesSection({ canManage, showToast }: { canManage: boolean; showToast: ShowToastFn }) {
  const [changes, setChanges] = useState<RegulatoryChange[]>([]);
  const [jurisdictions, setJurisdictions] = useState<RegulatoryJurisdiction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    jurisdiction_id: '',
    change_title: '',
    change_type: 'guidance' as (typeof CHANGE_TYPES)[number],
    summary: '',
    effective_date: '',
    impact_level: 'medium',
  });

  const loadAll = useCallback(async (cancelledRef?: { current: boolean }) => {
    try {
      setLoading(true);
      setError('');
      const [changesRes, jurisdictionsRes] = await Promise.all([
        dataSovereigntyAPI.getRegulatoryChanges(),
        dataSovereigntyAPI.getJurisdictions(),
      ]);
      if (!cancelledRef?.current) {
        setChanges(Array.isArray(changesRes.data?.data) ? changesRes.data.data : []);
        setJurisdictions(Array.isArray(jurisdictionsRes.data?.data) ? jurisdictionsRes.data.data : []);
      }
    } catch {
      if (!cancelledRef?.current) setError('Failed to load regulatory changes.');
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

  const submitForm = async () => {
    if (!form.jurisdiction_id || !form.change_title.trim() || !form.summary.trim()) {
      showToast('Jurisdiction, title, and summary are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      await dataSovereigntyAPI.createRegulatoryChange({
        jurisdiction_id: form.jurisdiction_id,
        change_title: form.change_title.trim(),
        change_type: form.change_type,
        summary: form.summary.trim(),
        effective_date: form.effective_date || undefined,
        impact_level: form.impact_level,
      });
      setShowForm(false);
      setForm({ jurisdiction_id: '', change_title: '', change_type: 'guidance', summary: '', effective_date: '', impact_level: 'medium' });
      await loadAll();
    } catch (err) {
      showToast(sovereigntyErrorMessage(err, 'Failed to create regulatory change.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setBusyId(id);
    try {
      await dataSovereigntyAPI.updateRegulatoryChangeStatus(id, { status });
      await loadAll();
    } catch (err) {
      showToast(sovereigntyErrorMessage(err, 'Failed to update status.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="animate-pulse h-40 rounded bg-gray-100" />;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Regulatory Changes</h3>
          <p className="text-xs text-gray-500 mt-1">Track new laws, amendments, and guidance across your operating jurisdictions.</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
          >
            + Log Change
          </button>
        )}
      </div>

      {showForm && canManage && (
        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Jurisdiction</span>
              <select
                value={form.jurisdiction_id}
                onChange={(e) => setForm((prev) => ({ ...prev, jurisdiction_id: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Select a jurisdiction...</option>
                {jurisdictions.map((j) => (
                  <option key={j.id} value={j.id}>{j.jurisdiction_name} ({j.jurisdiction_code})</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Change Type</span>
              <select
                value={form.change_type}
                onChange={(e) => setForm((prev) => ({ ...prev, change_type: e.target.value as (typeof CHANGE_TYPES)[number] }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {CHANGE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Title</span>
              <input
                type="text"
                value={form.change_title}
                onChange={(e) => setForm((prev) => ({ ...prev, change_title: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Effective Date</span>
              <input
                type="date"
                value={form.effective_date}
                onChange={(e) => setForm((prev) => ({ ...prev, effective_date: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Impact Level</span>
              <select
                value={form.impact_level}
                onChange={(e) => setForm((prev) => ({ ...prev, impact_level: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-gray-700">Summary</span>
              <textarea
                value={form.summary}
                onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
                rows={3}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
              Cancel
            </button>
            <button
              type="button"
              onClick={submitForm}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Log Change'}
            </button>
          </div>
        </div>
      )}

      {changes.length === 0 ? (
        <p className="text-sm text-gray-500">No data available. Add jurisdictions to your organization to start tracking regulatory changes.</p>
      ) : (
        <ul className="space-y-3" role="list">
          {changes.map((change) => (
            <li key={change.id} role="listitem" className="border border-gray-100 rounded-lg p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{change.change_title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {change.jurisdiction_name} &middot; {change.change_type.replace('_', ' ')}
                    {change.effective_date ? ` &middot; effective ${new Date(change.effective_date).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${IMPACT_BADGE_CLASSES[change.impact_level] || IMPACT_BADGE_CLASSES.unknown}`}
                  aria-label={`Impact level: ${change.impact_level}`}
                >
                  {change.impact_level}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-2">{change.summary}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs text-gray-500">Status:</span>
                {canManage ? (
                  <select
                    value={change.status}
                    onChange={(e) => updateStatus(change.id, e.target.value)}
                    disabled={busyId === change.id}
                    className="text-xs px-2 py-1 border border-gray-300 rounded-md disabled:opacity-50"
                  >
                    {CHANGE_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-medium text-gray-700 capitalize">{change.status}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
