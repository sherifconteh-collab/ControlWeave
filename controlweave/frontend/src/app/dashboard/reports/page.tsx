// @tier: pro
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { reportsAPI, benchmarksAPI, scheduledReportsAPI } from '@/lib/api';

type ReportType = 'compliance-pdf' | 'compliance-excel' | 'ssp-pdf' | 'ssp-json';
type ReportsView = 'on-demand' | 'scheduled';

type ScheduledReportType = 'compliance_summary' | 'framework_gap' | 'evidence_status' | 'audit_trail' | 'executive';
type ScheduledReportCadence = 'daily' | 'weekly' | 'monthly' | 'quarterly';
type ScheduledReportFormat = 'pdf' | 'csv' | 'json';

interface ScheduledReport {
  id: string;
  name: string;
  report_type: ScheduledReportType;
  schedule: ScheduledReportCadence;
  format: ScheduledReportFormat;
  recipients: string[];
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_by_email?: string;
}

interface ScheduledReportFormState {
  name: string;
  report_type: ScheduledReportType;
  schedule: ScheduledReportCadence;
  format: ScheduledReportFormat;
  recipientsInput: string;
}

const REPORT_TYPE_LABELS: Record<ScheduledReportType, string> = {
  compliance_summary: 'Compliance Summary',
  framework_gap: 'Framework Gap',
  evidence_status: 'Evidence Status',
  audit_trail: 'Audit Trail',
  executive: 'Executive',
};

const EMPTY_SCHEDULE_FORM: ScheduledReportFormState = {
  name: '',
  report_type: 'compliance_summary',
  schedule: 'weekly',
  format: 'pdf',
  recipientsInput: '',
};

function ScheduledReportsPanel() {
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduledReportFormState>(EMPTY_SCHEDULE_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSchedules = useCallback(async (cancelledRef?: { current: boolean }) => {
    try {
      setLoading(true);
      setLoadError('');
      const response = await scheduledReportsAPI.getAll();
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      if (!cancelledRef?.current) setSchedules(data);
    } catch {
      if (!cancelledRef?.current) setLoadError('Failed to load scheduled reports.');
    } finally {
      if (!cancelledRef?.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };
    loadSchedules(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadSchedules]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_SCHEDULE_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (schedule: ScheduledReport) => {
    setEditingId(schedule.id);
    setForm({
      name: schedule.name,
      report_type: schedule.report_type,
      schedule: schedule.schedule,
      format: schedule.format,
      recipientsInput: schedule.recipients.join(', '),
    });
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_SCHEDULE_FORM);
    setFormError('');
  };

  const submitForm = async () => {
    if (!form.name.trim()) {
      setFormError('Name is required.');
      return;
    }
    const recipients = form.recipientsInput
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await scheduledReportsAPI.update(editingId, {
          name: form.name.trim(),
          schedule: form.schedule,
          format: form.format,
          recipients,
        });
      } else {
        await scheduledReportsAPI.create({
          name: form.name.trim(),
          report_type: form.report_type,
          schedule: form.schedule,
          format: form.format,
          recipients,
        });
      }
      closeForm();
      await loadSchedules();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to save scheduled report.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!window.confirm('Delete this scheduled report?')) return;
    setBusyId(id);
    try {
      await scheduledReportsAPI.remove(id);
      await loadSchedules();
    } catch {
      setStatusMessage('Failed to delete scheduled report.');
    } finally {
      setBusyId(null);
    }
  };

  const runNow = async (id: string) => {
    setBusyId(id);
    setStatusMessage('');
    try {
      await scheduledReportsAPI.runNow(id);
      setStatusMessage('Report queued — delivery depends on the background job worker and may take a few minutes.');
    } catch (err: any) {
      setStatusMessage(err.response?.data?.error || 'Failed to queue report run.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Scheduled Reports</h3>
          <p className="text-sm text-gray-600 mt-1">
            Automate recurring report delivery to a distribution list.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Schedule
        </button>
      </div>

      {statusMessage && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded text-sm">
          {statusMessage}
        </div>
      )}

      {showForm && (
        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-bold text-gray-900">{editingId ? 'Edit Schedule' : 'New Schedule'}</h4>
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Weekly executive summary"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Report Type</span>
              <select
                value={form.report_type}
                onChange={(e) => setForm((prev) => ({ ...prev, report_type: e.target.value as ScheduledReportType }))}
                disabled={Boolean(editingId)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
              >
                {(Object.keys(REPORT_TYPE_LABELS) as ScheduledReportType[]).map((type) => (
                  <option key={type} value={type}>{REPORT_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Schedule</span>
              <select
                value={form.schedule}
                onChange={(e) => setForm((prev) => ({ ...prev, schedule: e.target.value as ScheduledReportCadence }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Format</span>
              <select
                value={form.format}
                onChange={(e) => setForm((prev) => ({ ...prev, format: e.target.value as ScheduledReportFormat }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-gray-700">Recipients (comma-separated emails)</span>
              <input
                type="text"
                value={form.recipientsInput}
                onChange={(e) => setForm((prev) => ({ ...prev, recipientsInput: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="auditor@example.com, ciso@example.com"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitForm}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Schedule'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-10 rounded bg-gray-100" />
          <div className="h-10 rounded bg-gray-100" />
        </div>
      ) : loadError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {loadError}
        </div>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-gray-500">No scheduled reports yet. Create one to automate recurring delivery.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200" role="list">
            <thead className="bg-gray-50">
              <tr role="listitem">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cadence</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Format</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recipients</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {schedules.map((schedule) => (
                <tr key={schedule.id} role="listitem">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{schedule.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{REPORT_TYPE_LABELS[schedule.report_type] || schedule.report_type}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">{schedule.schedule}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 uppercase">{schedule.format}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{schedule.recipients.length}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => runNow(schedule.id)}
                        disabled={busyId === schedule.id}
                        className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded hover:bg-purple-200 disabled:opacity-50"
                      >
                        Run Now
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForm(schedule)}
                        className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSchedule(schedule.id)}
                        disabled={busyId === schedule.id}
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
    </div>
  );
}

interface FrameworkBenchmarkInsufficient {
  framework_id: string;
  framework_name: string;
  own_pct: number;
  insufficient_data: true;
  minimum_participants: number;
}

interface FrameworkBenchmarkComparison {
  framework_id: string;
  framework_name: string;
  own_pct: number;
  insufficient_data?: false;
  participants: number;
  average_pct: number;
  median_pct: number;
  percentile_rank: number;
}

type FrameworkBenchmark = FrameworkBenchmarkInsufficient | FrameworkBenchmarkComparison;

function BenchmarkBar({ label, pct, highlight }: { label: string; pct: number; highlight?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span className={highlight ? 'font-semibold text-gray-900' : ''}>{label}</span>
        <span className={highlight ? 'font-semibold text-gray-900' : ''}>{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2" aria-label={`${label} compliance ${pct.toFixed(0)} percent`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={highlight ? 'bg-blue-600 h-2 rounded-full' : 'bg-slate-400 h-2 rounded-full'}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

function IndustryBenchmarkPanel() {
  const [benchmarks, setBenchmarks] = useState<FrameworkBenchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadError('');
        const response = await benchmarksAPI.getFrameworkBenchmarks();
        const data = Array.isArray(response.data?.data) ? response.data.data : [];
        if (!cancelled) setBenchmarks(data);
      } catch {
        if (!cancelled) setLoadError('Failed to load industry benchmark data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-900">Industry Benchmark</h3>
      <p className="text-sm text-gray-600 mt-1">
        See how your compliance percentage compares to anonymized peer organizations tracking the same frameworks.
      </p>

      {loading ? (
        <div className="mt-4 animate-pulse h-24 rounded bg-gray-100" />
      ) : loadError ? (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {loadError}
        </div>
      ) : benchmarks.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No benchmark data available yet. Track a framework to see how you compare.</p>
      ) : (
        <div className="mt-4 space-y-5">
          {benchmarks.map((benchmark) => (
            <div key={benchmark.framework_id} className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
              <p className="text-sm font-medium text-gray-900">{benchmark.framework_name}</p>
              {benchmark.insufficient_data ? (
                <p className="mt-2 text-sm text-gray-500">
                  Not enough participating organizations yet (minimum {benchmark.minimum_participants}) to show a benchmark for this framework.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  <BenchmarkBar label="You" pct={benchmark.own_pct} highlight />
                  <BenchmarkBar label="Peer Median" pct={benchmark.median_pct} />
                  <BenchmarkBar label="Peer Average" pct={benchmark.average_pct} />
                  <p className="text-xs text-gray-500">
                    Compared against {benchmark.participants} organizations
                    {typeof benchmark.percentile_rank === 'number' ? ` — you rank in the ${benchmark.percentile_rank}th percentile` : ''}.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [view, setView] = useState<ReportsView>('on-demand');
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState('');

  const downloadReport = async (reportType: ReportType) => {
    setGenerating(reportType);
    setError('');
    try {
      let response;
      let contentType = 'application/octet-stream';
      let fileName = 'report';

      switch (reportType) {
        case 'compliance-pdf':
          response = await reportsAPI.downloadPDF();
          contentType = 'application/pdf';
          fileName = `compliance-report-${new Date().toISOString().split('T')[0]}.pdf`;
          break;
        case 'compliance-excel':
          response = await reportsAPI.downloadExcel();
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          fileName = `compliance-report-${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
        case 'ssp-pdf':
          response = await reportsAPI.downloadSspPdf();
          contentType = 'application/pdf';
          fileName = `ssp-${new Date().toISOString().split('T')[0]}.pdf`;
          break;
        case 'ssp-json':
          response = await reportsAPI.downloadSspJson();
          contentType = 'application/json';
          fileName = `ssp-${new Date().toISOString().split('T')[0]}.json`;
          break;
        default:
          throw new Error('Unsupported report type');
      }

      const blob = new Blob([response.data], { type: contentType });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Report generation requires Starter tier or higher. Please upgrade your plan.');
      } else {
        setError('Failed to generate report. Please try again.');
      }
      console.error('Report download error:', err);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-2">Generate and download compliance reports for auditors and stakeholders.</p>
        </div>

        {/* Cross-feature linkage */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link href="/dashboard/ai-insights"
            className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors text-xs">
            <span className="text-lg">✨</span>
            <div><div className="font-medium text-purple-800">AI Insights</div><div className="text-purple-600">Gap analysis &amp; executive report</div></div>
          </Link>
          <Link href="/dashboard/frameworks"
            className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-xs">
            <span className="text-lg">📐</span>
            <div><div className="font-medium text-blue-800">Frameworks</div><div className="text-blue-600">Active framework progress</div></div>
          </Link>
          <Link href="/dashboard/auditor-workspace"
            className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-xs">
            <span className="text-lg">🔍</span>
            <div><div className="font-medium text-green-800">Auditor Workspace</div><div className="text-green-600">Engagements, workpapers &amp; findings</div></div>
          </Link>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            {(['on-demand', 'scheduled'] as ReportsView[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setView(tab)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  view === tab ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'on-demand' ? 'On-Demand' : 'Scheduled'}
              </button>
            ))}
          </nav>
        </div>

        {view === 'scheduled' ? (
          <ScheduledReportsPanel />
        ) : (
          <>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PDF Report Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                &#x1F4C4;
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">Compliance Report (PDF)</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Full compliance status report with executive summary, framework breakdown, and detailed control listing. Ideal for board presentations and auditor submissions.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Executive Summary</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Framework Breakdown</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Control Details</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Status Color-Coding</span>
                </div>
                <button
                  onClick={() => downloadReport('compliance-pdf')}
                  disabled={generating !== null}
                  className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {generating === 'compliance-pdf' ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                      Generating...
                    </span>
                  ) : (
                    'Download PDF Report'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Excel Report Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                &#x1F4CA;
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">Compliance Report (Excel)</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Multi-sheet spreadsheet with summary metrics, per-framework compliance, and all controls with filtering. Ideal for data analysis and custom reporting.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Summary Sheet</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Frameworks Sheet</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Controls Sheet</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Filterable</span>
                </div>
                <button
                  onClick={() => downloadReport('compliance-excel')}
                  disabled={generating !== null}
                  className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {generating === 'compliance-excel' ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                      Generating...
                    </span>
                  ) : (
                    'Download Excel Report'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* SSP PDF Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-600">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                🛡️
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">System Security Plan (SSP) PDF</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Narrative SSP covering organization/system context, CIA baseline, compliance posture, asset inventory, vulnerabilities, evidence, and POA&amp;M.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Whole Picture</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Audit Narrative</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Regenerable</span>
                </div>
                <button
                  onClick={() => downloadReport('ssp-pdf')}
                  disabled={generating !== null}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {generating === 'ssp-pdf' ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                      Generating...
                    </span>
                  ) : (
                    'Download SSP PDF'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* SSP JSON Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-slate-600">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                🧾
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">System Security Plan (SSP) JSON</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Structured SSP snapshot for integrations, version control, and external automation workflows.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Machine Readable</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">API Friendly</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Regenerable</span>
                </div>
                <button
                  onClick={() => downloadReport('ssp-json')}
                  disabled={generating !== null}
                  className="mt-4 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {generating === 'ssp-json' ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                      Generating...
                    </span>
                  ) : (
                    'Download SSP JSON'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <IndustryBenchmarkPanel />

        {/* Tier info */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-800">
            <strong>Starter tier required.</strong> Report generation is available on Starter ($49/mo) and above. Free tier users can view compliance data on the dashboard.
          </p>
          <p className="text-xs text-purple-700 mt-2">
            Keep SSP content current by updating organization and system details at <code>/dashboard/organization</code>, then regenerate.
          </p>
        </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
