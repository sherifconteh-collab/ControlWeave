'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/access';
import { useAddon } from '@/hooks/useAddon';
import AddonBanner from '@/components/billing/AddonBanner';
import { erpAPI } from '@/lib/api';
import { errorMessage, formatDate, inputClass, Modal, primaryButton, secondaryButton } from '@/components/policies/policyShared';
import { CsvInput, downloadBlob, ErrorBanner, formatMoney, humanize, NoticeBanner, SeverityBadge, StatCard, StatusPill, Tabs } from '@/components/erp/erpShared';
import { IMPORT_TEMPLATES, type ErpSystem } from '@/components/erp/SystemsPanel';
import MonitoringRulesPanel from '@/components/erp/MonitoringRulesPanel';
import ConfigPanel from '@/components/erp/ConfigPanel';

interface MonitoringException {
  id: string;
  rule_code: string;
  rule_name: string;
  severity: string;
  status: string;
  title: string;
  amount: string | null;
  system_name: string;
  details: Record<string, unknown>;
  first_detected_at: string;
  resolution_notes: string | null;
}

interface Summary { transactions: number; last_run_at: string | null; open_exceptions: number; critical_exceptions: number }
interface Run { id: string; system_name: string; started_at: string; started_by_name: string | null; results: { rule_code: string; population: number; detected: number; new_exceptions: number; control_test?: string }[] }

export default function ErpMonitoringPage() {
  const { user } = useAuth();
  const erpAddon = useAddon('erp');
  // Managing ERP data needs the permission and the ERP Governance add-on.
  const canManage = hasPermission(user, 'erp.manage') && erpAddon.licensed;
  const [tab, setTab] = useState('exceptions');
  const [systems, setSystems] = useState<ErpSystem[]>([]);
  const [systemId, setSystemId] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [exceptions, setExceptions] = useState<MonitoringException[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [status, setStatus] = useState('');
  const [importing, setImporting] = useState(false);
  const [working, setWorking] = useState<{ item: MonitoringException; status: string; notes: string } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, sum, ex, rn] = await Promise.all([
        erpAPI.listSystems(),
        erpAPI.monitoringSummary(),
        erpAPI.listExceptions({ system_id: systemId || undefined, status: status || undefined, limit: 500 }),
        erpAPI.listMonitoringRuns({ system_id: systemId || undefined }),
      ]);
      const list = (s.data?.data || []) as ErpSystem[];
      setSystems(list);
      if (!systemId && list.length) setSystemId(list[0].id);
      setSummary(sum.data?.data as Summary);
      setExceptions((ex.data?.data || []) as MonitoringException[]);
      setRuns((rn.data?.data || []) as Run[]);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load transaction monitoring'));
    }
  }, [systemId, status]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<string>, fallback: string) => {
    setBusy(true);
    setError('');
    try {
      setNotice(await fn());
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ERP Transaction Monitoring</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-3xl">
              Test every payment, invoice, journal entry and vendor master change instead of a sample: duplicate payments,
              payments after bank-detail changes, self-approved or after-hours journals, and segregation of duties conflicts that were actually exercised.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-sm text-gray-700">System
              <select className={`${inputClass} mt-1`} value={systemId} onChange={(e) => setSystemId(e.target.value)}>
                {systems.length === 0 && <option value="">Add a system under ERP Access Governance</option>}
                {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            {canManage && systemId && (
              <>
                <button type="button" className={secondaryButton} onClick={() => setImporting(true)}>Import transactions</button>
                <button type="button" className={primaryButton} disabled={busy}
                  onClick={() => run(async () => {
                    const res = await erpAPI.runMonitoring(systemId);
                    const results = (res.data?.data as { results: Run['results'] }).results;
                    return `Run complete: ${results.reduce((n, r) => n + r.new_exceptions, 0)} new exception(s) across ${results.length} rule(s).`;
                  }, 'Monitoring run failed')}>
                  Run monitoring
                </button>
              </>
            )}
          </div>
        </div>
        <AddonBanner addon={erpAddon} />
        <ErrorBanner message={error} />
        <NoticeBanner message={notice} />
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Transactions loaded" value={summary.transactions.toLocaleString()} />
            <StatCard label="Open exceptions" value={summary.open_exceptions} tone={summary.open_exceptions ? 'warn' : 'good'} />
            <StatCard label="Critical" value={summary.critical_exceptions} tone={summary.critical_exceptions ? 'bad' : 'good'} />
            <StatCard label="Last run" value={summary.last_run_at ? formatDate(summary.last_run_at) : 'Never'} />
          </div>
        )}
        <Tabs tabs={[{ id: 'exceptions', label: 'Exceptions' }, { id: 'rules', label: 'Rules' }, { id: 'configuration', label: 'Configuration' }, { id: 'runs', label: 'Run history' }]} active={tab} onChange={setTab} />

        {tab === 'exceptions' && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <select className={`${inputClass} max-w-xs`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
                <option value="">Open and investigating</option>
                {['open', 'investigating', 'resolved', 'false_positive'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </select>
              <button type="button" className={secondaryButton}
                onClick={async () => {
                  try {
                    const res = await erpAPI.exportExceptions({ system_id: systemId || undefined, status: status || undefined });
                    downloadBlob(res.data as Blob, 'erp-monitoring-exceptions.csv');
                  } catch (err: unknown) {
                    setError(errorMessage(err, 'Export failed'));
                  }
                }}>
                Export CSV
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase">
                  <tr><th className="px-3 py-2">Severity</th><th className="px-3 py-2">Exception</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Found</th><th className="px-3 py-2">Status</th><th className="px-3 py-2" /></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {exceptions.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No exceptions. Import transactions and run monitoring.</td></tr>}
                  {exceptions.map((e) => (
                    <tr key={e.id}>
                      <td className="px-3 py-2"><SeverityBadge severity={e.severity} /></td>
                      <td className="px-3 py-2 max-w-xl"><div className="font-medium text-gray-900">{e.title}</div><div className="text-xs text-gray-500">{e.rule_code} {e.rule_name}</div></td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatMoney(e.amount)}</td>
                      <td className="px-3 py-2 text-xs">{formatDate(e.first_detected_at)}</td>
                      <td className="px-3 py-2"><StatusPill status={e.status} />{e.resolution_notes && <div className="text-xs text-gray-500 max-w-xs">{e.resolution_notes}</div>}</td>
                      <td className="px-3 py-2 text-right">
                        {canManage && <button type="button" className="text-blue-700 text-xs" onClick={() => setWorking({ item: e, status: e.status === 'open' ? 'investigating' : e.status, notes: e.resolution_notes || '' })}>Update</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'rules' && <MonitoringRulesPanel canManage={canManage} />}

        {tab === 'configuration' && <ConfigPanel canManage={canManage} systems={systems} />}

        {tab === 'runs' && (
          <ul className="space-y-3" role="list">
            {runs.length === 0 && <li className="text-sm text-gray-500">No runs yet.</li>}
            {runs.map((r) => (
              <li key={r.id} role="listitem" className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
                <div className="font-medium">{formatDate(r.started_at)} · {r.system_name}{r.started_by_name ? ` · ${r.started_by_name}` : ''}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1 mt-2 text-xs text-gray-700">
                  {r.results.map((x) => (
                    <div key={x.rule_code}>{x.rule_code}: {x.detected} found ({x.new_exceptions} new) of {x.population}{x.control_test ? <> · test <StatusPill status={x.control_test} /></> : null}</div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        {importing && systemId && (
          <Modal title="Import transactions" onClose={() => setImporting(false)} wide>
            <CsvInput
              busy={busy}
              help={<>Columns: <code className="break-all">{IMPORT_TEMPLATES.transactions.columns}</code>. {IMPORT_TEMPLATES.transactions.note} Rows are matched on txn_type and external_id, so re-importing an extract updates it.</>}
              onSubmit={(csv) => run(async () => {
                const res = await erpAPI.importData(systemId, { kind: 'transactions', csv });
                const r = res.data?.data as { row_count: number; error_count: number; errors: { line: number; error: string }[] };
                setImporting(false);
                return `Imported ${r.row_count} transaction(s)${r.error_count ? `; ${r.error_count} rejected (first: line ${r.errors[0].line}, ${r.errors[0].error})` : ''}.`;
              }, 'Import failed')}
            />
          </Modal>
        )}

        {working && (
          <Modal title={working.item.title} onClose={() => setWorking(null)}>
            <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 mb-3 whitespace-pre-wrap">{JSON.stringify(working.item.details, null, 2)}</pre>
            <div className="space-y-3 text-sm">
              <label className="block">Status
                <select className={inputClass} value={working.status} onChange={(e) => setWorking({ ...working, status: e.target.value })}>
                  {['open', 'investigating', 'resolved', 'false_positive'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                </select>
              </label>
              <label className="block">Investigation notes{['resolved', 'false_positive'].includes(working.status) ? ' (required)' : ''}
                <textarea className={inputClass} rows={3} value={working.notes} onChange={(e) => setWorking({ ...working, notes: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" className={secondaryButton} onClick={() => setWorking(null)}>Cancel</button>
              <button type="button" className={primaryButton} disabled={busy}
                onClick={() => run(async () => {
                  await erpAPI.updateException(working.item.id, { status: working.status, resolution_notes: working.notes || undefined });
                  setWorking(null);
                  return 'Exception updated.';
                }, 'Could not update the exception')}>
                Save
              </button>
            </div>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
}
