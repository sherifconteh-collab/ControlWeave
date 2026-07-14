// @tier: enterprise
'use client';

import { useCallback, useEffect, useState } from 'react';
import { vendorSecurityAPI } from '@/lib/api';

type ScoreProvider = 'securityscorecard' | 'bitsight';
type ScoreTrend = 'improving' | 'declining' | 'stable' | 'new';

interface VendorScore {
  id: string;
  vendor_name: string;
  vendor_domain: string | null;
  score_provider: ScoreProvider;
  score_value: number | null;
  score_grade: string | null;
  score_date: string;
  previous_score: number | null;
  score_trend: ScoreTrend;
  assessment_url: string | null;
}

interface ManualFormState {
  vendor_name: string;
  vendor_domain: string;
  score_provider: ScoreProvider;
  score_value: string;
  score_grade: string;
  score_date: string;
}

interface MonitorFormState {
  vendor_domain: string;
  score_provider: ScoreProvider;
  api_key: string;
}

const EMPTY_MANUAL_FORM: ManualFormState = {
  vendor_name: '',
  vendor_domain: '',
  score_provider: 'securityscorecard',
  score_value: '',
  score_grade: '',
  score_date: new Date().toISOString().slice(0, 10),
};

const EMPTY_MONITOR_FORM: MonitorFormState = {
  vendor_domain: '',
  score_provider: 'securityscorecard',
  api_key: '',
};

const TREND_BADGE_CLASSES: Record<ScoreTrend, string> = {
  improving: 'bg-green-100 text-green-800',
  declining: 'bg-red-100 text-red-800',
  stable: 'bg-gray-100 text-gray-700',
  new: 'bg-blue-100 text-blue-800',
};

export default function VendorSecurityRatingsTab() {
  const [scores, setScores] = useState<VendorScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState<ManualFormState>(EMPTY_MANUAL_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [showLiveForm, setShowLiveForm] = useState(false);
  const [monitorForm, setMonitorForm] = useState<MonitorFormState>(EMPTY_MONITOR_FORM);
  const [monitoring, setMonitoring] = useState(false);
  const [monitorError, setMonitorError] = useState('');
  const [monitorMessage, setMonitorMessage] = useState('');

  const [refreshTargetId, setRefreshTargetId] = useState<string | null>(null);
  const [refreshApiKey, setRefreshApiKey] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadScores = useCallback(async (cancelledRef?: { current: boolean }) => {
    try {
      setLoading(true);
      setError('');
      const response = await vendorSecurityAPI.getScores();
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      if (!cancelledRef?.current) setScores(data);
    } catch {
      if (!cancelledRef?.current) setError('Failed to load vendor security ratings.');
    } finally {
      if (!cancelledRef?.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };
    loadScores(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadScores]);

  const submitManualForm = async () => {
    if (!manualForm.vendor_name.trim() || !manualForm.score_date) {
      setCreateError('Vendor name and score date are required.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await vendorSecurityAPI.createScore({
        vendor_name: manualForm.vendor_name.trim(),
        vendor_domain: manualForm.vendor_domain.trim() || undefined,
        score_provider: manualForm.score_provider,
        score_value: manualForm.score_value ? Number(manualForm.score_value) : undefined,
        score_grade: manualForm.score_grade.trim() || undefined,
        score_date: manualForm.score_date,
      });
      setShowManualForm(false);
      setManualForm(EMPTY_MANUAL_FORM);
      await loadScores();
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Failed to add vendor score.');
    } finally {
      setCreating(false);
    }
  };

  const submitMonitorForm = async () => {
    if (!monitorForm.vendor_domain.trim() || !monitorForm.api_key.trim()) {
      setMonitorError('Vendor domain and API key are required.');
      return;
    }
    setMonitoring(true);
    setMonitorError('');
    setMonitorMessage('');
    try {
      await vendorSecurityAPI.setupMonitoring({
        vendor_domain: monitorForm.vendor_domain.trim(),
        score_provider: monitorForm.score_provider,
        api_key: monitorForm.api_key,
      });
      setMonitorMessage('Monitoring started — initial score fetched.');
      setShowLiveForm(false);
      setMonitorForm(EMPTY_MONITOR_FORM);
      await loadScores();
    } catch (err: any) {
      setMonitorError(err.response?.data?.error || 'Failed to start live monitoring. Verify the domain and API key.');
    } finally {
      setMonitoring(false);
    }
  };

  const confirmRefresh = async () => {
    if (!refreshTargetId || !refreshApiKey.trim()) return;
    setBusyId(refreshTargetId);
    try {
      await vendorSecurityAPI.refreshScore(refreshTargetId, { api_key: refreshApiKey.trim() });
      setRefreshTargetId(null);
      setRefreshApiKey('');
      await loadScores();
    } catch {
      setError('Failed to refresh vendor score. Verify the API key.');
    } finally {
      setBusyId(null);
    }
  };

  const deleteScore = async (id: string) => {
    if (!window.confirm('Delete this vendor security score?')) return;
    setBusyId(id);
    try {
      await vendorSecurityAPI.deleteScore(id);
      await loadScores();
    } catch {
      setError('Failed to delete vendor score.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Vendor Security Ratings</h2>
          <p className="text-sm text-gray-600 mt-1">
            SecurityScorecard and BitSight ratings for vendor risk monitoring. Manual entry always works; live refresh needs your own API key.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowManualForm((prev) => !prev)}
          className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
        >
          + Manual Entry
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {showManualForm && (
        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-900">Manual Score Entry</h3>
          <p className="text-xs text-gray-600">Record a rating you already have — no external API call is made.</p>
          {createError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
              {createError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Vendor Name</span>
              <input
                type="text"
                value={manualForm.vendor_name}
                onChange={(e) => setManualForm((prev) => ({ ...prev, vendor_name: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Vendor Domain</span>
              <input
                type="text"
                value={manualForm.vendor_domain}
                onChange={(e) => setManualForm((prev) => ({ ...prev, vendor_domain: e.target.value }))}
                placeholder="vendor.com"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Provider</span>
              <select
                value={manualForm.score_provider}
                onChange={(e) => setManualForm((prev) => ({ ...prev, score_provider: e.target.value as ScoreProvider }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="securityscorecard">SecurityScorecard</option>
                <option value="bitsight">BitSight</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Score Date</span>
              <input
                type="date"
                value={manualForm.score_date}
                onChange={(e) => setManualForm((prev) => ({ ...prev, score_date: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Score Value</span>
              <input
                type="number"
                value={manualForm.score_value}
                onChange={(e) => setManualForm((prev) => ({ ...prev, score_value: e.target.value }))}
                placeholder={manualForm.score_provider === 'bitsight' ? '250-900' : '0-100'}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Grade (optional)</span>
              <input
                type="text"
                value={manualForm.score_grade}
                onChange={(e) => setManualForm((prev) => ({ ...prev, score_grade: e.target.value }))}
                placeholder="A, B, C..."
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowManualForm(false); setManualForm(EMPTY_MANUAL_FORM); setCreateError(''); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitManualForm}
              disabled={creating}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {creating ? 'Saving...' : 'Save Score'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto" />
          <p className="text-gray-500 mt-3 text-sm">Loading...</p>
        </div>
      ) : scores.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          No vendor security scores yet. Add one manually above.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="list">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr role="listitem">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {scores.map((score) => (
                <tr key={score.id} role="listitem">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {score.vendor_name}
                    {score.vendor_domain && <div className="text-xs text-gray-500">{score.vendor_domain}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{score.score_provider}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {score.score_value ?? '—'}{score.score_grade ? ` (${score.score_grade})` : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{new Date(score.score_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TREND_BADGE_CLASSES[score.score_trend]}`}
                      aria-label={`Score trend: ${score.score_trend}`}
                    >
                      {score.score_trend}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setRefreshTargetId(score.id); setRefreshApiKey(''); }}
                        disabled={!score.vendor_domain || busyId === score.id}
                        className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded hover:bg-purple-200 disabled:opacity-50"
                        title={!score.vendor_domain ? 'vendor_domain is required to refresh' : undefined}
                      >
                        Refresh
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteScore(score.id)}
                        disabled={busyId === score.id}
                        className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {refreshTargetId && (
        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-900">Refresh from provider</h3>
          <p className="text-xs text-gray-600">Your API key is sent for this request only — it is not stored.</p>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">API Key</span>
            <input
              type="password"
              value={refreshApiKey}
              onChange={(e) => setRefreshApiKey(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setRefreshTargetId(null); setRefreshApiKey(''); }}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRefresh}
              disabled={busyId === refreshTargetId || !refreshApiKey.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Live refresh / monitoring — clearly secondary and optional */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Live Refresh (optional)</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Requires your own SecurityScorecard or BitSight API key. Nothing here works without one — manual entry above is the reliable default.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLiveForm((prev) => !prev)}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
          >
            {showLiveForm ? 'Hide' : 'Set Up Monitoring'}
          </button>
        </div>

        {monitorMessage && (
          <div className="mt-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded text-sm">
            {monitorMessage}
          </div>
        )}

        {showLiveForm && (
          <div className="mt-3 border border-gray-200 bg-gray-50 rounded-lg p-4 space-y-3">
            {monitorError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
                {monitorError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Vendor Domain</span>
                <input
                  type="text"
                  value={monitorForm.vendor_domain}
                  onChange={(e) => setMonitorForm((prev) => ({ ...prev, vendor_domain: e.target.value }))}
                  placeholder="vendor.com"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Provider</span>
                <select
                  value={monitorForm.score_provider}
                  onChange={(e) => setMonitorForm((prev) => ({ ...prev, score_provider: e.target.value as ScoreProvider }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="securityscorecard">SecurityScorecard</option>
                  <option value="bitsight">BitSight</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">API Key</span>
                <input
                  type="password"
                  value={monitorForm.api_key}
                  onChange={(e) => setMonitorForm((prev) => ({ ...prev, api_key: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </label>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={submitMonitorForm}
                disabled={monitoring}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {monitoring ? 'Starting...' : 'Start Monitoring'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
