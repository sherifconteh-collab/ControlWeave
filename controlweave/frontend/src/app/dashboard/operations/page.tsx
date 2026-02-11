'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { opsAPI } from '@/lib/api';

interface OpsOverview {
  summary: {
    total_users: number;
    active_users: number;
    active_users_7d: number;
    events_24h: number;
    failures_24h: number;
    open_vulnerabilities: number;
    active_poam_items: number;
    open_issue_count: number;
  };
  jobs: Record<string, number>;
  webhooks: Record<string, number>;
  top_events_7d: Array<{ event_type: string; count: number }>;
  recent_failures: Array<{ id: string; event_type: string; resource_type: string; failure_reason: string | null; details: any; created_at: string; actor_name: string }>;
}

export default function OperationsCenterPage() {
  const [overview, setOverview] = useState<OpsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await opsAPI.getOverview();
      setOverview(response.data?.data || null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load operations center.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'process_jobs' | 'run_retention' | 'process_webhooks') => {
    try {
      setActionLoading(action);
      if (action === 'process_jobs') {
        await opsAPI.processJobs({ limit: 25 });
      }
      if (action === 'run_retention') {
        await opsAPI.runRetention();
      }
      if (action === 'process_webhooks') {
        await opsAPI.processWebhooks({ limit: 50 });
      }
      await loadOverview();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Operation failed.');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Operations Center</h1>
            <p className="text-sm text-gray-600 mt-1">
              Monitor usage, queue health, and operational risk across your tenant.
            </p>
          </div>
          <button
            onClick={loadOverview}
            className="px-4 py-2 text-sm border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading operations...</div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
        ) : overview ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Metric label="Active Users" value={overview.summary.active_users.toString()} hint={`Total ${overview.summary.total_users}`} />
              <Metric label="Events (24h)" value={overview.summary.events_24h.toString()} hint={`${overview.summary.failures_24h} failed`} />
              <Metric label="Open Issues" value={overview.summary.open_issue_count.toString()} hint="Vuln + POA&M + queues" />
              <Metric label="Active Users (7d)" value={overview.summary.active_users_7d.toString()} hint="unique logins" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                <h3 className="text-lg font-semibold text-gray-900">Queues</h3>
                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  <div>Jobs: queued {overview.jobs.queued || 0} · failed {overview.jobs.failed || 0} · running {overview.jobs.running || 0}</div>
                  <div>Webhooks: pending {overview.webhooks.pending || 0} · failed {overview.webhooks.failed || 0} · delivered {overview.webhooks.delivered || 0}</div>
                </div>
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => handleAction('process_jobs')}
                    disabled={actionLoading !== ''}
                    className="w-full px-3 py-2 text-sm bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50"
                  >
                    {actionLoading === 'process_jobs' ? 'Processing...' : 'Process Jobs'}
                  </button>
                  <button
                    onClick={() => handleAction('process_webhooks')}
                    disabled={actionLoading !== ''}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {actionLoading === 'process_webhooks' ? 'Processing...' : 'Flush Webhooks'}
                  </button>
                  <button
                    onClick={() => handleAction('run_retention')}
                    disabled={actionLoading !== ''}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {actionLoading === 'run_retention' ? 'Running...' : 'Run Retention'}
                  </button>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                <h3 className="text-lg font-semibold text-gray-900">Security Signals</h3>
                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  <div>Open vulnerabilities: {overview.summary.open_vulnerabilities}</div>
                  <div>Active POA&M items: {overview.summary.active_poam_items}</div>
                  <div>Failed events (24h): {overview.summary.failures_24h}</div>
                </div>
                <div className="mt-4 border-t pt-3">
                  <h4 className="text-xs font-semibold text-gray-500">Top Events (7d)</h4>
                  <div className="mt-2 space-y-1 text-xs text-gray-600">
                    {overview.top_events_7d.length === 0 ? (
                      <div>No events logged.</div>
                    ) : (
                      overview.top_events_7d.map((event) => (
                        <div key={event.event_type} className="flex items-center justify-between">
                          <span>{event.event_type}</span>
                          <span className="text-gray-400">{event.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                <h3 className="text-lg font-semibold text-gray-900">Recent Failures</h3>
                <div className="mt-3 space-y-2 text-xs text-gray-600 max-h-[280px] overflow-y-auto">
                  {overview.recent_failures.length === 0 ? (
                    <div>No recent failures.</div>
                  ) : (
                    overview.recent_failures.map((failure) => (
                      <div key={failure.id} className="border rounded-md p-2">
                        <div className="text-[11px] text-gray-500">{new Date(failure.created_at).toLocaleString()}</div>
                        <div className="text-sm font-semibold text-gray-900">{failure.event_type}</div>
                        <div className="text-[11px] text-gray-500">Actor: {failure.actor_name}</div>
                        {failure.failure_reason && (
                          <div className="text-[11px] text-rose-600 mt-1">{failure.failure_reason}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
      {hint && <div className="text-[11px] text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}
