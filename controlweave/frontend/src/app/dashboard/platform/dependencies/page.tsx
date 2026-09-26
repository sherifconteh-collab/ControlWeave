'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { dependenciesAPI, DependencyDecision } from '@/lib/api';

type Severity = 'critical' | 'high' | 'moderate' | 'low';

interface Advisory {
  id: number;
  title: string;
  url: string;
  severity: Severity;
  vulnerable_versions: string;
}

interface Finding {
  id: number;
  component: string;
  ecosystem: string;
  name: string;
  direct: boolean;
  installed: string | null;
  wanted: string | null;
  latest: string | null;
  update_type: 'major' | 'minor' | 'patch' | 'none' | 'unknown';
  advisories: Advisory[];
  max_severity: Severity | null;
  eol_date: string | null;
  note: string | null;
  decision_status: DependencyDecision;
  decision_note: string | null;
  target_version: string | null;
  snooze_until: string | null;
  poam_item_id: string | null;
}

interface Summary {
  total: number;
  security: Record<Severity, number>;
  outdated: { major: number; minor: number; patch: number };
  end_of_life: number;
  end_of_life_within_180_days: number;
}

interface Run {
  id: string;
  status: 'completed' | 'partial' | 'failed' | 'running';
  trigger: 'scheduled' | 'manual';
  started_at: string;
  finished_at: string | null;
  summary: Summary;
  errors: { source: string; detail: string }[];
}

interface Report {
  run: Run | null;
  findings: Finding[];
  schedule: { enabled: boolean; interval_hours: number };
}

type Filter = 'action' | 'security' | 'eol' | 'outdated' | 'all';

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  moderate: 'bg-amber-100 text-amber-800',
  low: 'bg-gray-100 text-gray-700',
};

const UPDATE_STYLES: Record<string, string> = {
  major: 'text-purple-700',
  minor: 'text-blue-700',
  patch: 'text-green-700',
};

const DECISION_LABELS: Record<DependencyDecision, string> = {
  open: 'Needs review',
  planned: 'Upgrade planned',
  accepted: 'Risk accepted',
  snoozed: 'Snoozed',
  done: 'Done',
};

function apiError(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof data?.error === 'string' ? data.error : fallback;
}

function isEol(f: Finding): boolean {
  return Boolean(f.eol_date && new Date(f.eol_date).getTime() < Date.now());
}

function needsAction(f: Finding): boolean {
  if (f.decision_status !== 'open') return false;
  return Boolean(f.max_severity) || isEol(f) || (f.direct && (f.update_type === 'major' || f.update_type === 'minor' || f.update_type === 'patch'));
}

function dateOnly(value: string | null): string {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

export default function DependenciesPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [filter, setFilter] = useState<Filter>('action');
  const [component, setComponent] = useState('');
  const [search, setSearch] = useState('');
  const [checking, setChecking] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await dependenciesAPI.getReport();
      setReport(res.data?.data as Report);
    } catch (err: unknown) {
      setError(apiError(err, 'Failed to load dependencies'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runCheck = async () => {
    setChecking(true);
    setError('');
    setNotice('');
    try {
      await dependenciesAPI.runCheck();
      await load();
      setNotice('Check complete.');
    } catch (err: unknown) {
      setError(apiError(err, 'The check could not run'));
    } finally {
      setChecking(false);
    }
  };

  const decide = async (f: Finding, status: DependencyDecision) => {
    let note: string | undefined;
    let snoozeUntil: string | undefined;
    if (status === 'accepted') {
      const input = window.prompt(`Why is it acceptable to keep ${f.name} ${f.installed || ''}? (recorded in the audit log)`);
      if (!input) return;
      note = input;
    }
    if (status === 'snoozed') {
      snoozeUntil = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    }
    const key = `${f.component}|${f.name}`;
    setBusyKey(key);
    setError('');
    try {
      await dependenciesAPI.setDecision({ component: f.component, name: f.name, status, note, snooze_until: snoozeUntil, target_version: f.latest || undefined });
      await load();
    } catch (err: unknown) {
      setError(apiError(err, 'Could not save the decision'));
    } finally {
      setBusyKey(null);
    }
  };

  const createPoam = async (f: Finding) => {
    const key = `${f.component}|${f.name}`;
    setBusyKey(key);
    setError('');
    try {
      const res = await dependenciesAPI.createPoam(f.component, f.name);
      const item = res.data?.data as { title: string; due_date: string };
      setNotice(`POA&M created: ${item.title} (due ${dateOnly(item.due_date)}).`);
      await load();
    } catch (err: unknown) {
      setError(apiError(err, 'Could not create the POA&M item'));
    } finally {
      setBusyKey(null);
    }
  };

  const exportCsv = async () => {
    try {
      const res = await dependenciesAPI.exportCsv();
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'controlweave-dependencies.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(apiError(err, 'Export failed'));
    }
  };

  const components = useMemo(() => [...new Set((report?.findings || []).map((f) => f.component))], [report]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (report?.findings || []).filter((f) => {
      if (component && f.component !== component) return false;
      if (term && !f.name.toLowerCase().includes(term)) return false;
      if (filter === 'action') return needsAction(f);
      if (filter === 'security') return Boolean(f.max_severity);
      if (filter === 'eol') return Boolean(f.eol_date);
      if (filter === 'outdated') return f.direct && ['major', 'minor', 'patch'].includes(f.update_type);
      return true;
    });
  }, [report, filter, component, search]);

  const run = report?.run || null;
  const summary = run?.summary;
  const actionCount = (report?.findings || []).filter(needsAction).length;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dependencies</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-3xl">
              Everything ControlWeave runs on: backend and frontend packages, the Node.js runtime, PostgreSQL and the container
              base images. Shows newer versions, known vulnerabilities and end-of-life software, so the operations team can plan
              upgrades and keep a record of each decision.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {run ? `Last checked ${new Date(run.finished_at || run.started_at).toLocaleString()} (${run.trigger})` : 'Not checked yet'}
              {report?.schedule.enabled ? ` - runs automatically every ${report.schedule.interval_hours} hours` : ' - automatic checks are off'}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={exportCsv} disabled={!run} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">Export CSV</button>
            <button type="button" onClick={runCheck} disabled={checking} className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50">
              {checking ? 'Checking…' : 'Check now'}
            </button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">{error}</div>}
        {notice && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">{notice}</div>}
        {run?.status === 'partial' && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
            Some sources could not be reached, so results may be incomplete: {run.errors.map((e) => `${e.source} (${e.detail})`).join('; ')}.
          </div>
        )}

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className={`text-2xl font-bold ${actionCount ? 'text-purple-700' : 'text-gray-900'}`}>{actionCount}</div>
              <div className="text-xs text-gray-600">Need review</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className={`text-2xl font-bold ${summary.security.critical + summary.security.high ? 'text-red-600' : 'text-gray-900'}`}>
                {summary.security.critical + summary.security.high}
              </div>
              <div className="text-xs text-gray-600">Critical or high vulnerabilities ({summary.security.moderate + summary.security.low} lower)</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className={`text-2xl font-bold ${summary.end_of_life ? 'text-red-600' : 'text-gray-900'}`}>{summary.end_of_life}</div>
              <div className="text-xs text-gray-600">End of life ({summary.end_of_life_within_180_days} within 180 days)</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-900">{summary.outdated.major}</div>
              <div className="text-xs text-gray-600">Major updates available</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-900">{summary.outdated.minor + summary.outdated.patch}</div>
              <div className="text-xs text-gray-600">Minor or patch updates</div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {([
            ['action', 'Needs review'],
            ['security', 'Vulnerabilities'],
            ['eol', 'End of life'],
            ['outdated', 'Updates available'],
            ['all', 'All'],
          ] as [Filter, string][]).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value}
              className={`px-3 py-1 text-sm rounded-full border ${filter === value ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-300 text-gray-700'}`}>
              {label}
            </button>
          ))}
          <select aria-label="Component" value={component} onChange={(e) => setComponent(e.target.value)} className="ml-auto text-sm border border-gray-300 rounded-md px-2 py-1">
            <option value="">All components</option>
            {components.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="search" aria-label="Search dependencies" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="text-sm border border-gray-300 rounded-md px-2 py-1" />
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase">
              <tr>
                <th className="px-3 py-2">Dependency</th>
                <th className="px-3 py-2">Installed</th>
                <th className="px-3 py-2">Latest</th>
                <th className="px-3 py-2">Risk</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!report && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">Loading…</td></tr>}
              {report && !run && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">No check has run yet. Choose Check now.</td></tr>}
              {run && visible.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">{filter === 'action' ? 'Nothing needs review.' : 'No dependencies match.'}</td></tr>
              )}
              {visible.map((f) => {
                const key = `${f.component}|${f.name}`;
                return (
                  <tr key={f.id} className="align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900 break-all">{f.name}</div>
                      <div className="text-xs text-gray-500">{f.component} - {f.ecosystem}{f.direct ? '' : ' - transitive'}</div>
                      {f.note && <div className="text-xs text-gray-500 mt-1 max-w-md">{f.note}</div>}
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{f.installed || '-'}{f.wanted && <div className="text-xs text-gray-400">{f.wanted}</div>}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {f.latest || '-'}
                      {['major', 'minor', 'patch'].includes(f.update_type) && <div className={`text-xs font-medium ${UPDATE_STYLES[f.update_type]}`}>{f.update_type} update</div>}
                    </td>
                    <td className="px-3 py-2">
                      {f.advisories.map((a) => (
                        <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="block text-xs mb-1 hover:underline">
                          <span className={`px-1.5 py-0.5 rounded font-semibold ${SEVERITY_STYLES[a.severity]}`}>{a.severity}</span> {a.title}
                        </a>
                      ))}
                      {f.eol_date && (
                        <span className={`text-xs ${isEol(f) ? 'text-red-700 font-medium' : 'text-amber-700'}`}>
                          {isEol(f) ? 'End of life' : 'End of life on'} {dateOnly(f.eol_date)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {DECISION_LABELS[f.decision_status]}
                      {f.decision_status === 'snoozed' && f.snooze_until ? ` until ${dateOnly(f.snooze_until)}` : ''}
                      {f.poam_item_id && <Link href={`/dashboard/poam/${f.poam_item_id}`} className="block text-purple-700 hover:underline">POA&amp;M</Link>}
                      {f.decision_note && <div className="text-gray-500 mt-1">{f.decision_note}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1 justify-end">
                        {!f.poam_item_id && (f.decision_status === 'open' || f.decision_status === 'snoozed') && (
                          <button type="button" disabled={busyKey === key} onClick={() => createPoam(f)} className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">Plan upgrade</button>
                        )}
                        {f.decision_status !== 'accepted' && (
                          <button type="button" disabled={busyKey === key} onClick={() => decide(f, 'accepted')} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Accept risk</button>
                        )}
                        {f.decision_status === 'open' && (
                          <button type="button" disabled={busyKey === key} onClick={() => decide(f, 'snoozed')} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Snooze 30 days</button>
                        )}
                        {f.decision_status !== 'open' && (
                          <button type="button" disabled={busyKey === key} onClick={() => decide(f, 'open')} className="px-2 py-1 text-xs text-gray-600 hover:underline">Reopen</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Plan upgrade creates a POA&amp;M item in your organization with a due date set by severity (critical 15 days, high or end of
          life 30, moderate 90, other 180). When a later check finds the upgrade installed and nothing left to fix, it is marked Done automatically.
        </p>
      </div>
    </DashboardLayout>
  );
}
