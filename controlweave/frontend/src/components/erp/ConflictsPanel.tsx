'use client';

import { useCallback, useEffect, useState } from 'react';
import { erpAPI } from '@/lib/api';
import { errorMessage, formatDate, inputClass, Modal, primaryButton, secondaryButton } from '@/components/policies/policyShared';
import { ErrorBanner, humanize, SeverityBadge, StatusPill } from './erpShared';
import type { ErpSystem } from './SystemsPanel';

interface Conflict {
  id: string;
  level: 'user' | 'role';
  rule_code: string;
  rule_name: string;
  process: string;
  severity: string;
  risk_description: string;
  function_a: string;
  function_b: string;
  roles_a: string[];
  roles_b: string[];
  status: string;
  username: string | null;
  full_name: string | null;
  role_name: string | null;
  system_name: string;
  mitigating_control_name: string | null;
  accepted_until: string | null;
  decision_notes: string | null;
  last_detected_at: string;
}

interface MitigatingControl { id: string; name: string; frequency: string; conflicts_covered: number }

interface Decision {
  conflict: Conflict;
  action: 'mitigate' | 'accept' | 'reopen';
  mitigating_control_id: string;
  notes: string;
  accepted_until: string;
  new_control: { name: string; description: string; frequency: string } | null;
}

interface ConflictsPanelProps {
  canManage: boolean;
  systems: ErpSystem[];
  onChanged: () => void;
}

export default function ConflictsPanel({ canManage, systems, onChanged }: ConflictsPanelProps) {
  const [rows, setRows] = useState<Conflict[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ system_id: '', status: '', severity: '', level: '' });
  const [controls, setControls] = useState<MitigatingControl[]>([]);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const [c, m] = await Promise.all([erpAPI.listConflicts({ ...params, limit: 500 }), erpAPI.listMitigatingControls()]);
      setRows((c.data?.data || []) as Conflict[]);
      setTotal(c.data?.pagination?.total || 0);
      setControls((m.data?.data || []) as MitigatingControl[]);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load conflicts'));
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!decision) return;
    setBusy(true);
    setError('');
    try {
      let controlId = decision.mitigating_control_id;
      if (decision.action === 'mitigate' && decision.new_control) {
        const res = await erpAPI.createMitigatingControl(decision.new_control);
        controlId = (res.data?.data as { id: string }).id;
      }
      await erpAPI.decideConflict(decision.conflict.id, {
        action: decision.action,
        mitigating_control_id: decision.action === 'mitigate' ? controlId : undefined,
        notes: decision.notes || undefined,
        accepted_until: decision.action === 'accept' && decision.accepted_until ? decision.accepted_until : undefined,
      });
      setDecision(null);
      await load();
      onChanged();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not record the decision'));
    } finally {
      setBusy(false);
    }
  };

  const setFilter = (key: keyof typeof filters, value: string) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div>
      <ErrorBanner message={error} />
      <div className="flex flex-wrap gap-3 mb-4 text-sm">
        <select className={`${inputClass} max-w-xs`} value={filters.system_id} onChange={(e) => setFilter('system_id', e.target.value)} aria-label="System">
          <option value="">All systems</option>
          {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={`${inputClass} max-w-[12rem]`} value={filters.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Status">
          <option value="">Unresolved</option>
          {['open', 'mitigated', 'accepted', 'resolved'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
        <select className={`${inputClass} max-w-[12rem]`} value={filters.severity} onChange={(e) => setFilter('severity', e.target.value)} aria-label="Severity">
          <option value="">Any severity</option>
          {['critical', 'high', 'medium', 'low'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
        <select className={`${inputClass} max-w-[12rem]`} value={filters.level} onChange={(e) => setFilter('level', e.target.value)} aria-label="Level">
          <option value="">Users and roles</option>
          <option value="user">Users</option>
          <option value="role">Role design</option>
        </select>
        <span className="self-center text-gray-500">{total} conflict(s)</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase">
            <tr><th className="px-3 py-2">Severity</th><th className="px-3 py-2">Rule</th><th className="px-3 py-2">Who</th><th className="px-3 py-2">Through roles</th><th className="px-3 py-2">Status</th><th className="px-3 py-2" /></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No conflicts match. Import entitlements and run the SoD analysis to find them.</td></tr>}
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2"><SeverityBadge severity={c.severity} /></td>
                <td className="px-3 py-2 max-w-md">
                  <div className="font-medium text-gray-900">{c.rule_code} {c.rule_name}</div>
                  <div className="text-xs text-gray-500">{c.risk_description}</div>
                </td>
                <td className="px-3 py-2">
                  {c.level === 'user' ? <><div className="font-medium">{c.username}</div><div className="text-xs text-gray-500">{c.full_name}</div></> : <><div className="font-medium">Role: {c.role_name}</div><div className="text-xs text-gray-500">Every holder is in conflict</div></>}
                  <div className="text-xs text-gray-400">{c.system_name}</div>
                </td>
                <td className="px-3 py-2 text-xs">
                  <div>{c.function_a}: {c.roles_a.join(', ')}</div>
                  <div>{c.function_b}: {c.roles_b.join(', ')}</div>
                </td>
                <td className="px-3 py-2">
                  <StatusPill status={c.status} />
                  {c.mitigating_control_name && <div className="text-xs text-gray-600 mt-1">{c.mitigating_control_name}</div>}
                  {c.accepted_until && <div className="text-xs text-gray-600 mt-1">until {formatDate(c.accepted_until)}</div>}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {canManage && c.status !== 'resolved' && (
                    <button type="button" className="text-blue-700 text-xs"
                      onClick={() => setDecision({ conflict: c, action: c.status === 'open' ? 'mitigate' : 'reopen', mitigating_control_id: '', notes: '', accepted_until: '', new_control: null })}>
                      Decide
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {decision && (
        <Modal title={`${decision.conflict.rule_code}: ${decision.conflict.username || decision.conflict.role_name}`} onClose={() => setDecision(null)} wide>
          <p className="text-sm text-gray-700 mb-3">{decision.conflict.risk_description} The fix is to remove one of the roles; when that is not possible, record a mitigating control or a time-boxed acceptance.</p>
          <div className="space-y-3 text-sm">
            <label className="block">Decision
              <select className={inputClass} value={decision.action} onChange={(e) => setDecision({ ...decision, action: e.target.value as Decision['action'] })}>
                <option value="mitigate">Mitigate with a compensating control</option>
                <option value="accept">Accept the risk</option>
                {decision.conflict.status !== 'open' && <option value="reopen">Reopen</option>}
              </select>
            </label>
            {decision.action === 'mitigate' && (
              decision.new_control ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border border-gray-200 rounded p-3">
                  <label>Control name<input className={inputClass} value={decision.new_control.name} onChange={(e) => setDecision({ ...decision, new_control: { ...decision.new_control!, name: e.target.value } })} /></label>
                  <label>Frequency
                    <select className={inputClass} value={decision.new_control.frequency} onChange={(e) => setDecision({ ...decision, new_control: { ...decision.new_control!, frequency: e.target.value } })}>
                      {['daily', 'weekly', 'monthly', 'quarterly'].map((f) => <option key={f} value={f}>{humanize(f)}</option>)}
                    </select>
                  </label>
                  <label className="md:col-span-2">What is reviewed, by whom<textarea className={inputClass} rows={2} value={decision.new_control.description} onChange={(e) => setDecision({ ...decision, new_control: { ...decision.new_control!, description: e.target.value } })} /></label>
                </div>
              ) : (
                <div className="flex gap-2 items-end">
                  <label className="flex-1">Mitigating control
                    <select className={inputClass} value={decision.mitigating_control_id} onChange={(e) => setDecision({ ...decision, mitigating_control_id: e.target.value })}>
                      <option value="">Select a control</option>
                      {controls.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.frequency})</option>)}
                    </select>
                  </label>
                  <button type="button" className={secondaryButton} onClick={() => setDecision({ ...decision, new_control: { name: '', description: '', frequency: 'monthly' } })}>New control</button>
                </div>
              )
            )}
            {decision.action === 'accept' && (
              <label className="block">Accepted until<input type="date" className={inputClass} value={decision.accepted_until} onChange={(e) => setDecision({ ...decision, accepted_until: e.target.value })} /></label>
            )}
            <label className="block">Notes{decision.action === 'accept' ? ' (business justification, required)' : ''}
              <textarea className={inputClass} rows={3} value={decision.notes} onChange={(e) => setDecision({ ...decision, notes: e.target.value })} />
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className={secondaryButton} onClick={() => setDecision(null)}>Cancel</button>
            <button type="button" className={primaryButton} disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Record decision'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
