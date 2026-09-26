'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { qaAPI } from '@/lib/api';

type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip';
type RunStatus = 'passed' | 'passed_with_warnings' | 'failed' | 'running';

interface Suite {
  id: string;
  title: string;
  description: string;
}

interface CheckInfo {
  id: string;
  suite: string;
  title: string;
  description: string;
}

interface CheckResult {
  id: string;
  suite: string;
  title: string;
  status: CheckStatus;
  detail: string;
  remediation: string | null;
  durationMs: number;
}

interface RunSummary {
  id: string;
  suites: string[];
  status: RunStatus;
  summary: { counts?: Record<CheckStatus, number>; total?: number };
  app_version: string | null;
  started_at: string;
  finished_at: string | null;
  started_by_name: string | null;
}

interface RunDetail extends RunSummary {
  results: CheckResult[];
}

const STATUS_STYLES: Record<CheckStatus, string> = {
  pass: 'bg-green-100 text-green-800',
  warn: 'bg-amber-100 text-amber-800',
  fail: 'bg-red-100 text-red-800',
  skip: 'bg-gray-100 text-gray-600',
};

const RUN_STYLES: Record<RunStatus, { label: string; className: string }> = {
  passed: { label: 'Passed', className: 'bg-green-100 text-green-800' },
  passed_with_warnings: { label: 'Passed with warnings', className: 'bg-amber-100 text-amber-800' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
  running: { label: 'Running', className: 'bg-blue-100 text-blue-800' },
};

function errorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof data?.error === 'string' ? data.error : fallback;
}

function StatusBadge({ status }: { status: CheckStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

export default function QaSelfTestPage() {
  const [suites, setSuites] = useState<Suite[]>([]);
  const [checks, setChecks] = useState<CheckInfo[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [current, setCurrent] = useState<RunDetail | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRuns = useCallback(async () => {
    const res = await qaAPI.listRuns(20);
    setRuns((res.data?.data || []) as RunSummary[]);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await qaAPI.getChecks();
        const data = res.data?.data as { suites: Suite[]; checks: CheckInfo[] };
        setSuites(data.suites);
        setChecks(data.checks);
        setSelected(data.suites.map((s) => s.id));
        await loadRuns();
      } catch (err: unknown) {
        setError(errorMessage(err, 'Failed to load the self-test catalog'));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadRuns]);

  const toggleSuite = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const runTests = async () => {
    setRunning(true);
    setError('');
    try {
      const res = await qaAPI.run(selected.length === suites.length ? [] : selected);
      const run = res.data?.data as RunDetail & { counts?: Record<CheckStatus, number> };
      setCurrent({ ...run, summary: { counts: run.counts, total: run.results.length } });
      await loadRuns();
    } catch (err: unknown) {
      setError(errorMessage(err, 'The self-test could not be run'));
    } finally {
      setRunning(false);
    }
  };

  const openRun = async (id: string) => {
    setError('');
    try {
      const res = await qaAPI.getRun(id);
      setCurrent(res.data?.data as RunDetail);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load that run'));
    }
  };

  const exportRun = async (format: 'csv' | 'json') => {
    if (!current) return;
    try {
      const res = await qaAPI.exportRun(current.id, format);
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `controlweave-self-test-${current.id}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Export failed'));
    }
  };

  const grouped = useMemo(() => {
    if (!current) return [];
    return suites
      .map((suite) => ({ suite, results: current.results.filter((r) => r.suite === suite.id) }))
      .filter((group) => group.results.length > 0);
  }, [current, suites]);

  const counts = current?.summary?.counts;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">QA &amp; Self-Test</h1>
          <p className="text-sm text-gray-600 mt-1 max-w-3xl">
            Verify this deployment end to end: platform health, compliance data integrity, the audit trail, core
            workflows through the live API, access control, AI provider keys and performance. Tests only create and
            remove their own records marked &quot;[QA self-test]&quot; and never change your controls. Export a run as
            acceptance-test evidence.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
            {error}
          </div>
        )}

        <section className="bg-white border border-gray-200 rounded-lg p-4 mb-6" aria-labelledby="qa-suites-heading">
          <h2 id="qa-suites-heading" className="text-sm font-semibold text-gray-900 mb-3">Test suites</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {suites.map((suite) => (
                <label key={suite.id} htmlFor={`suite-${suite.id}`} className="flex items-start gap-3 p-3 border border-gray-100 rounded-md cursor-pointer hover:bg-gray-50">
                  <input
                    id={`suite-${suite.id}`}
                    type="checkbox"
                    className="mt-1"
                    checked={selected.includes(suite.id)}
                    onChange={() => toggleSuite(suite.id)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">
                      {suite.title}{' '}
                      <span className="text-gray-400 font-normal">({checks.filter((c) => c.suite === suite.id).length} checks)</span>
                    </span>
                    <span className="block text-xs text-gray-600">{suite.description}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={runTests}
              disabled={running || selected.length === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {running ? 'Running…' : 'Run self-test'}
            </button>
            {running && <span className="text-sm text-gray-500">This usually takes a few seconds.</span>}
          </div>
        </section>

        {current && (
          <section className="bg-white border border-gray-200 rounded-lg p-4 mb-6" aria-labelledby="qa-result-heading">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 id="qa-result-heading" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  Results
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${RUN_STYLES[current.status]?.className || ''}`}>
                    {RUN_STYLES[current.status]?.label || current.status}
                  </span>
                </h2>
                <p className="text-xs text-gray-500">
                  {new Date(current.started_at).toLocaleString()}
                  {current.app_version ? ` · version ${current.app_version}` : ''}
                  {counts ? ` · ${counts.pass || 0} passed, ${counts.warn || 0} warnings, ${counts.fail || 0} failed, ${counts.skip || 0} skipped` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => exportRun('csv')} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50">Export CSV</button>
                <button type="button" onClick={() => exportRun('json')} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50">Export JSON</button>
              </div>
            </div>

            {grouped.map(({ suite, results }) => (
              <div key={suite.id} className="mb-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{suite.title}</h3>
                <ul role="list" className="divide-y divide-gray-100 border border-gray-100 rounded-md">
                  {results.map((result) => (
                    <li role="listitem" key={result.id} className="p-3">
                      <div className="flex items-start gap-3">
                        <StatusBadge status={result.status} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-gray-900">{result.title}</span>
                            <span className="text-xs text-gray-400 shrink-0">{result.durationMs} ms</span>
                          </div>
                          <p className="text-sm text-gray-700 mt-0.5 break-words">{result.detail}</p>
                          {result.remediation && result.status !== 'pass' && (
                            <p className="text-xs text-gray-600 mt-1"><span className="font-semibold">How to fix:</span> {result.remediation}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        <section className="bg-white border border-gray-200 rounded-lg p-4" aria-labelledby="qa-history-heading">
          <h2 id="qa-history-heading" className="text-sm font-semibold text-gray-900 mb-3">Run history</h2>
          {runs.length === 0 ? (
            <p className="text-sm text-gray-500">No runs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="py-2 pr-4 font-medium">Started</th>
                    <th className="py-2 pr-4 font-medium">By</th>
                    <th className="py-2 pr-4 font-medium">Result</th>
                    <th className="py-2 pr-4 font-medium">Checks</th>
                    <th className="py-2 font-medium"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-gray-700 whitespace-nowrap">{new Date(run.started_at).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-gray-700">{run.started_by_name || '—'}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${RUN_STYLES[run.status]?.className || ''}`}>
                          {RUN_STYLES[run.status]?.label || run.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-600">
                        {run.summary?.counts
                          ? `${run.summary.counts.pass || 0}✓ ${run.summary.counts.warn || 0}! ${run.summary.counts.fail || 0}✗`
                          : '—'}
                      </td>
                      <td className="py-2 text-right">
                        <button type="button" onClick={() => openRun(run.id)} className="text-purple-700 hover:underline text-sm">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
