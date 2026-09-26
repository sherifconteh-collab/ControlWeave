'use client';

import { useCallback, useEffect, useState } from 'react';
import { erpAPI } from '@/lib/api';
import { errorMessage, formatDate, inputClass, Modal, primaryButton, secondaryButton } from '@/components/policies/policyShared';
import { CsvInput, ErrorBanner, NoticeBanner, SeverityBadge } from './erpShared';
import { IMPORT_TEMPLATES, type ErpSystem } from './SystemsPanel';

interface ConfigRow {
  config_key: string;
  category: string | null;
  value: string | null;
  is_present: boolean | null;
  last_changed_at: string | null;
  last_changed_by: string | null;
  baseline_id: string | null;
  comparison: string | null;
  expected_value: string | null;
  severity: string | null;
  rationale: string | null;
  expectation: string | null;
  complies: boolean | null;
}

interface ConfigChange { id: string; config_key: string; old_value: string | null; new_value: string | null; changed_by: string | null; changed_at: string | null; detected_at: string; monitored: boolean }

interface BaselineForm { config_key: string; comparison: string; expected_value: string; severity: string; rationale: string }

const COMPARISONS: { id: string; label: string }[] = [
  { id: 'equals', label: 'Equals' }, { id: 'not_equals', label: 'Does not equal' }, { id: 'in', label: 'One of (comma-separated)' },
  { id: 'min', label: 'At least' }, { id: 'max', label: 'At most' }, { id: 'range', label: 'Between (low..high)' },
];

interface ConfigPanelProps {
  canManage: boolean;
  systems: ErpSystem[];
}

export default function ConfigPanel({ canManage, systems }: ConfigPanelProps) {
  const [systemId, setSystemId] = useState(systems[0]?.id || '');
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [changes, setChanges] = useState<ConfigChange[]>([]);
  const [onlyMonitored, setOnlyMonitored] = useState(false);
  const [editing, setEditing] = useState<BaselineForm | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!systemId && systems.length) setSystemId(systems[0].id); }, [systems, systemId]);

  const load = useCallback(async () => {
    if (!systemId) return;
    try {
      const [c, ch] = await Promise.all([erpAPI.listConfig(systemId, { monitored: onlyMonitored || undefined }), erpAPI.listConfigChanges(systemId)]);
      setRows((c.data?.data || []) as ConfigRow[]);
      setChanges((ch.data?.data || []) as ConfigChange[]);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load configuration'));
    }
  }, [systemId, onlyMonitored]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<string>, fallback: string) => {
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

  const failing = rows.filter((r) => r.baseline_id && !r.complies).length;
  const monitored = rows.filter((r) => r.baseline_id).length;

  return (
    <div>
      <ErrorBanner message={error} />
      <NoticeBanner message={notice} />
      <p className="text-sm text-gray-600 mb-3 max-w-3xl">
        Import the system&apos;s settings (profile parameters, profile options, tolerances, approval limits) and set the values you approve.
        Rules CCM-CFG-01 and CCM-CFG-02 raise an exception for every setting outside its baseline and every change to a monitored setting.
      </p>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="text-sm">System
          <select className={`${inputClass} mt-1`} value={systemId} onChange={(e) => setSystemId(e.target.value)}>
            {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" checked={onlyMonitored} onChange={(e) => setOnlyMonitored(e.target.checked)} />Monitored settings only</label>
        <div className="flex-1" />
        {canManage && systemId && (
          <>
            <button type="button" className={secondaryButton} onClick={() => setImporting(true)}>Import settings</button>
            <button type="button" className={secondaryButton} disabled={busy}
              onClick={() => act(async () => {
                const res = await erpAPI.adoptBaselineLibrary(systemId);
                return `${(res.data?.data as { added: number }).added} recommended setting(s) added.`;
              }, 'Could not add recommended settings')}>
              Add recommended baselines
            </button>
            <button type="button" className={primaryButton} onClick={() => setEditing({ config_key: '', comparison: 'equals', expected_value: '', severity: 'high', rationale: '' })}>Add baseline</button>
          </>
        )}
      </div>
      <div className="text-sm text-gray-700 mb-2">{monitored} monitored setting(s), <span className={failing ? 'text-red-700 font-medium' : ''}>{failing} outside the baseline</span>.</div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto mb-6">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase">
            <tr><th className="px-3 py-2">Setting</th><th className="px-3 py-2">Current value</th><th className="px-3 py-2">Baseline</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Last changed</th><th className="px-3 py-2" /></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No settings yet. Import a configuration extract or add baselines.</td></tr>}
            {rows.map((r) => (
              <tr key={r.config_key}>
                <td className="px-3 py-2"><div className="font-medium break-all">{r.config_key}</div>{r.category && <div className="text-xs text-gray-500">{r.category}</div>}</td>
                <td className="px-3 py-2 text-xs break-all">{r.is_present === false ? 'Not reported' : r.value === null ? '' : r.value || '(blank)'}</td>
                <td className="px-3 py-2 text-xs">{r.expectation ? <>{r.expectation} {r.severity && <SeverityBadge severity={r.severity} />}{r.rationale && <div className="text-gray-500">{r.rationale}</div>}</> : 'None'}</td>
                <td className="px-3 py-2 text-xs">{r.baseline_id ? (r.complies ? <span className="text-green-700">Complies</span> : <span className="text-red-700 font-medium">Outside baseline</span>) : ''}</td>
                <td className="px-3 py-2 text-xs">{r.last_changed_at ? formatDate(r.last_changed_at) : ''}{r.last_changed_by ? ` · ${r.last_changed_by}` : ''}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {canManage && (
                    <>
                      <button type="button" className="text-blue-700 text-xs mr-2"
                        onClick={() => setEditing({ config_key: r.config_key, comparison: r.comparison || 'equals', expected_value: r.expected_value ?? r.value ?? '', severity: r.severity || 'high', rationale: r.rationale || '' })}>
                        {r.baseline_id ? 'Edit baseline' : 'Set baseline'}
                      </button>
                      {r.baseline_id && (
                        <button type="button" className="text-red-700 text-xs"
                          onClick={() => act(async () => { await erpAPI.deleteBaseline(systemId, r.baseline_id as string); return `Baseline for ${r.config_key} removed.`; }, 'Could not remove the baseline')}>
                          Remove
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="font-semibold text-gray-900 mb-2">Change history</h2>
      <ul className="space-y-2 text-sm" role="list">
        {changes.length === 0 && <li className="text-gray-500">No changes seen yet. Changes are recorded when a later extract differs from the previous one.</li>}
        {changes.map((c) => (
          <li key={c.id} role="listitem" className="bg-white border border-gray-200 rounded p-2">
            <span className="font-medium break-all">{c.config_key}</span>{c.monitored && <span className="ml-2 text-xs text-purple-700">monitored</span>}
            <div className="text-xs text-gray-600">{c.old_value ?? '(none)'} → {c.new_value ?? '(removed)'} · {c.changed_by ? `${c.changed_by} · ` : ''}{formatDate(c.changed_at || c.detected_at)}</div>
          </li>
        ))}
      </ul>

      {editing && (
        <Modal title="Configuration baseline" onClose={() => setEditing(null)}>
          <div className="space-y-3 text-sm">
            <label className="block">Setting<input className={inputClass} value={editing.config_key} onChange={(e) => setEditing({ ...editing, config_key: e.target.value })} placeholder="login/min_password_lng" /></label>
            <label className="block">Rule
              <select className={inputClass} value={editing.comparison} onChange={(e) => setEditing({ ...editing, comparison: e.target.value })}>
                {COMPARISONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label className="block">Expected value<input className={inputClass} value={editing.expected_value} onChange={(e) => setEditing({ ...editing, expected_value: e.target.value })} placeholder={editing.comparison === 'range' ? '1..5' : ''} /></label>
            <label className="block">Severity
              <select className={inputClass} value={editing.severity} onChange={(e) => setEditing({ ...editing, severity: e.target.value })}>
                {['low', 'medium', 'high', 'critical'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">Why (control or policy reference)<textarea className={inputClass} rows={2} value={editing.rationale} onChange={(e) => setEditing({ ...editing, rationale: e.target.value })} /></label>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className={secondaryButton} onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className={primaryButton} disabled={busy || !editing.config_key.trim() || !editing.expected_value.trim()}
              onClick={() => act(async () => {
                await erpAPI.saveBaseline(systemId, { ...editing, rationale: editing.rationale || undefined });
                setEditing(null);
                return 'Baseline saved. The next monitoring run checks it.';
              }, 'Could not save the baseline')}>
              Save
            </button>
          </div>
        </Modal>
      )}

      {importing && (
        <Modal title="Import configuration settings" onClose={() => setImporting(false)} wide>
          <CsvInput
            busy={busy}
            help={<>Columns: <code className="break-all">{IMPORT_TEMPLATES.config.columns}</code>. {IMPORT_TEMPLATES.config.note}</>}
            onSubmit={(csv) => act(async () => {
              const res = await erpAPI.importData(systemId, { kind: 'config', csv, mode: 'merge' });
              const r = res.data?.data as { row_count: number; error_count: number };
              setImporting(false);
              return `Imported ${r.row_count} setting(s)${r.error_count ? `, ${r.error_count} rejected` : ''}.`;
            }, 'Import failed')}
          />
        </Modal>
      )}
    </div>
  );
}
