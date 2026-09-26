'use client';

import { useCallback, useEffect, useState } from 'react';
import { erpAPI } from '@/lib/api';
import { errorMessage, inputClass, Modal, primaryButton, secondaryButton } from '@/components/policies/policyShared';
import { ErrorBanner, humanize, SeverityBadge } from './erpShared';

interface Rule {
  id: string;
  code: string;
  name: string;
  process: string;
  function_a: string;
  function_b: string;
  risk_description: string;
  severity: string;
  is_library: boolean;
  effective_active: boolean;
  version: number;
  open_conflicts: number;
}

interface ErpFunction { code: string; name: string; process: string }

interface RuleForm { code: string; name: string; process: string; function_a: string; function_b: string; risk_description: string; severity: string }

export default function RulesPanel({ canManage }: { canManage: boolean }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [functions, setFunctions] = useState<ErpFunction[]>([]);
  const [process, setProcess] = useState('');
  const [form, setForm] = useState<RuleForm | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, f] = await Promise.all([erpAPI.listRules(), erpAPI.listFunctions()]);
      setRules((r.data?.data || []) as Rule[]);
      setFunctions((f.data?.data || []) as ErpFunction[]);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load rules'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (rule: Rule) => {
    try {
      await erpAPI.updateRule(rule.id, { is_active: !rule.effective_active });
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not update the rule'));
    }
  };

  const create = async () => {
    if (!form) return;
    setBusy(true);
    setError('');
    try {
      await erpAPI.createRule(form);
      setForm(null);
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not add the rule'));
    } finally {
      setBusy(false);
    }
  };

  const processes = [...new Set(rules.map((r) => r.process))];
  const shown = rules.filter((r) => !process || r.process === process);

  return (
    <div>
      <ErrorBanner message={error} />
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="text-sm text-gray-700">Process
          <select className={`${inputClass} mt-1`} value={process} onChange={(e) => setProcess(e.target.value)}>
            <option value="">All</option>
            {processes.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
          </select>
        </label>
        <p className="text-xs text-gray-600 flex-1">
          The ControlWeave library defines {rules.filter((r) => r.is_library).length} function-level conflicts that apply to any ERP once roles are mapped to business functions.
          Switch library rules off for your organization, or add your own. Changes apply at the next analysis.
        </p>
        {canManage && (
          <button type="button" className={primaryButton}
            onClick={() => setForm({ code: '', name: '', process: 'procure_to_pay', function_a: functions[0]?.code || '', function_b: functions[1]?.code || '', risk_description: '', severity: 'high' })}>
            Add rule
          </button>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase">
            <tr><th className="px-3 py-2">Rule</th><th className="px-3 py-2">Conflicting functions</th><th className="px-3 py-2">Severity</th><th className="px-3 py-2">Open conflicts</th><th className="px-3 py-2">Active</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shown.map((r) => (
              <tr key={r.id} className={r.effective_active ? '' : 'opacity-50'}>
                <td className="px-3 py-2 max-w-md">
                  <div className="font-medium text-gray-900">{r.code} {r.name} {!r.is_library && <span className="text-xs text-blue-700">custom v{r.version}</span>}</div>
                  <div className="text-xs text-gray-500">{r.risk_description}</div>
                </td>
                <td className="px-3 py-2 text-xs">{r.function_a}<br />{r.function_b}</td>
                <td className="px-3 py-2"><SeverityBadge severity={r.severity} /></td>
                <td className="px-3 py-2">{r.open_conflicts}</td>
                <td className="px-3 py-2">
                  <label htmlFor={`rule-${r.id}`} className="flex items-center gap-2 text-xs">
                    <input id={`rule-${r.id}`} type="checkbox" checked={r.effective_active} disabled={!canManage} onChange={() => toggle(r)} />
                    {r.effective_active ? 'On' : 'Off'}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title="Add SoD rule" onClose={() => setForm(null)} wide>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <label>Code<input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ORG-P2P-01" /></label>
            <label>Severity
              <select className={inputClass} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                {['critical', 'high', 'medium', 'low'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </select>
            </label>
            <label className="md:col-span-2">Name<input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>First function
              <select className={inputClass} value={form.function_a} onChange={(e) => setForm({ ...form, function_a: e.target.value })}>
                {functions.map((f) => <option key={f.code} value={f.code}>{f.code}: {f.name}</option>)}
              </select>
            </label>
            <label>Second function
              <select className={inputClass} value={form.function_b} onChange={(e) => setForm({ ...form, function_b: e.target.value })}>
                {functions.map((f) => <option key={f.code} value={f.code}>{f.code}: {f.name}</option>)}
              </select>
            </label>
            <label>Process<input className={inputClass} value={form.process} onChange={(e) => setForm({ ...form, process: e.target.value })} /></label>
            <label className="md:col-span-2">Risk<textarea className={inputClass} rows={2} value={form.risk_description} onChange={(e) => setForm({ ...form, risk_description: e.target.value })} /></label>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className={secondaryButton} onClick={() => setForm(null)}>Cancel</button>
            <button type="button" className={primaryButton} disabled={busy} onClick={create}>{busy ? 'Saving…' : 'Add rule'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
