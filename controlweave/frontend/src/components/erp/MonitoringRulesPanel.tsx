'use client';

import { useCallback, useEffect, useState } from 'react';
import { erpAPI, financialAuditAPI } from '@/lib/api';
import { errorMessage, inputClass, Modal, primaryButton, secondaryButton } from '@/components/policies/policyShared';
import { ErrorBanner, humanize, SeverityBadge } from './erpShared';

type ParamValue = number | string | boolean;

interface ParamSpec { type: 'number' | 'integer' | 'boolean' | 'timezone'; min?: number; max?: number; default: ParamValue }

interface MonitoringRule {
  code: string;
  name: string;
  description: string;
  txn_type: string;
  severity: string;
  is_active: boolean;
  parameters: Record<string, ParamValue>;
  parameter_specs: Record<string, ParamSpec>;
  rcm_entry_id: string | null;
  control_ref: string | null;
}

interface RcmOption { id: string; control_ref: string; control_description: string }

export default function MonitoringRulesPanel({ canManage }: { canManage: boolean }) {
  const [rules, setRules] = useState<MonitoringRule[]>([]);
  const [rcm, setRcm] = useState<RcmOption[]>([]);
  const [editing, setEditing] = useState<{ rule: MonitoringRule; params: Record<string, string>; rcm_entry_id: string } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await erpAPI.listMonitoringRules();
      setRules((res.data?.data || []) as MonitoringRule[]);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load rules'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const edit = async (rule: MonitoringRule) => {
    try {
      const res = await financialAuditAPI.listRcm({ status: 'active', limit: 500 });
      setRcm((res.data?.data || []) as RcmOption[]);
    } catch {
      setRcm([]);
    }
    setEditing({ rule, params: Object.fromEntries(Object.entries(rule.parameters).map(([k, v]) => [k, String(v)])), rcm_entry_id: rule.rcm_entry_id || '' });
  };

  const save = async (rule: MonitoringRule, data: Parameters<typeof erpAPI.updateMonitoringRule>[1]) => {
    setError('');
    try {
      await erpAPI.updateMonitoringRule(rule.code, data);
      setEditing(null);
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not save the rule'));
    }
  };

  const typed = (spec: ParamSpec, value: string): ParamValue => {
    if (spec.type === 'boolean') return value === 'true';
    if (spec.type === 'timezone') return value;
    return Number(value);
  };

  return (
    <div>
      <ErrorBanner message={error} />
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase">
            <tr><th className="px-3 py-2">Rule</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Severity</th><th className="px-3 py-2">Settings</th><th className="px-3 py-2">Evidences control</th><th className="px-3 py-2">Active</th><th className="px-3 py-2" /></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rules.map((r) => (
              <tr key={r.code} className={r.is_active ? '' : 'opacity-50'}>
                <td className="px-3 py-2 max-w-md"><div className="font-medium">{r.code} {r.name}</div><div className="text-xs text-gray-500">{r.description}</div></td>
                <td className="px-3 py-2 text-xs">{humanize(r.txn_type)}</td>
                <td className="px-3 py-2"><SeverityBadge severity={r.severity} /></td>
                <td className="px-3 py-2 text-xs">{Object.entries(r.parameters).map(([k, v]) => <div key={k}>{humanize(k)}: {String(v)}</div>)}</td>
                <td className="px-3 py-2 text-xs">{r.control_ref || ''}</td>
                <td className="px-3 py-2">
                  <label htmlFor={`ccm-${r.code}`} className="flex items-center gap-2 text-xs">
                    <input id={`ccm-${r.code}`} type="checkbox" checked={r.is_active} disabled={!canManage} onChange={() => save(r, { is_active: !r.is_active })} />
                    {r.is_active ? 'On' : 'Off'}
                  </label>
                </td>
                <td className="px-3 py-2 text-right">{canManage && <button type="button" className="text-blue-700 text-xs" onClick={() => edit(r)}>Configure</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={`${editing.rule.code} ${editing.rule.name}`} onClose={() => setEditing(null)}>
          <div className="space-y-3 text-sm">
            {Object.entries(editing.rule.parameter_specs).map(([name, spec]) => (
              <label key={name} className="block">{humanize(name)}
                {spec.type === 'boolean' ? (
                  <select className={inputClass} value={editing.params[name]} onChange={(e) => setEditing({ ...editing, params: { ...editing.params, [name]: e.target.value } })}>
                    <option value="true">Yes</option><option value="false">No</option>
                  </select>
                ) : (
                  <input className={inputClass} type={spec.type === 'timezone' ? 'text' : 'number'} min={spec.min} max={spec.max} value={editing.params[name]}
                    onChange={(e) => setEditing({ ...editing, params: { ...editing.params, [name]: e.target.value } })} />
                )}
              </label>
            ))}
            <label className="block">Risk-control matrix control this rule evidences
              <select className={inputClass} value={editing.rcm_entry_id} onChange={(e) => setEditing({ ...editing, rcm_entry_id: e.target.value })}>
                <option value="">None</option>
                {rcm.map((c) => <option key={c.id} value={c.id}>{c.control_ref}: {c.control_description.slice(0, 80)}</option>)}
              </select>
              <span className="text-xs text-gray-500">When set, every run records a full-population operating effectiveness test for that control.</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className={secondaryButton} onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className={primaryButton}
              onClick={() => save(editing.rule, {
                parameters: Object.fromEntries(Object.entries(editing.rule.parameter_specs).map(([name, spec]) => [name, typed(spec, editing.params[name])])),
                rcm_entry_id: editing.rcm_entry_id || null,
              })}>
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
