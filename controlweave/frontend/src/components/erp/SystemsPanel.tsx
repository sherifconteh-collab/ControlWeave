'use client';

import { useCallback, useEffect, useState } from 'react';
import { erpAPI, type ErpImportKind } from '@/lib/api';
import { errorMessage, formatDate, inputClass, Modal, primaryButton, secondaryButton } from '@/components/policies/policyShared';
import { CsvInput, ErrorBanner, humanize, NoticeBanner } from './erpShared';
import ConnectionDialog from './ConnectionDialog';

export interface ErpSystem {
  id: string;
  name: string;
  erp_type: string;
  environment: string;
  last_import_at: string | null;
  last_analysis_at: string | null;
  active_users: number;
  roles: number;
  open_conflicts: number;
  connector_type?: string | null;
  connector_label?: string | null;
  connector_config?: Record<string, string>;
  connector_credentials_set?: string[];
  sync_schedule?: 'manual' | 'daily' | 'weekly';
  sync_hour_utc?: number;
  next_sync_at?: string | null;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
  last_sync_error?: string | null;
  auto_analyze?: boolean;
  auto_monitor?: boolean;
  use_library_map?: boolean;
  ticket_connector_id?: string | null;
}

interface ErpUserRow {
  id: string;
  username: string;
  full_name: string | null;
  department: string | null;
  status: string;
  is_present: boolean;
  role_count: number;
  open_conflicts: number;
  last_login_at: string | null;
}

interface ErpUserDetail extends ErpUserRow {
  roles: { role_name: string; is_privileged: boolean; functions: string[] }[];
  conflicts: { id: string; rule_code: string; rule_name: string; severity: string; status: string }[];
}

interface ImportRun { id: string; kind: string; mode: string; row_count: number; error_count: number; created_at: string; imported_by: string | null }

export const ERP_TYPES = ['oracle_ebs', 'oracle_cloud_erp', 'sap_ecc', 'sap_s4hana', 'workday', 'netsuite', 'dynamics_365', 'peoplesoft', 'other'];

export const IMPORT_TEMPLATES: Record<ErpImportKind, { label: string; columns: string; note: string }> = {
  users: { label: 'Users', columns: 'username,full_name,email,department,manager,status,last_login_at,end_date', note: 'status: active, inactive or locked.' },
  roles: { label: 'Roles / responsibilities', columns: 'role_name,description,is_privileged', note: 'is_privileged: yes or no.' },
  assignments: { label: 'User-role assignments', columns: 'username,role_name,granted_at,expires_at', note: 'Unknown users and roles are created. Use full snapshot to remove assignments missing from the file.' },
  role_functions: { label: 'Role to business function', columns: 'role_name,function_code', note: 'function_code from the function catalog, for example AP_INVOICE_ENTRY.' },
  role_permissions: { label: 'Role to permission (transaction codes, menus)', columns: 'role_name,permission', note: 'Pair with a permission-to-function map.' },
  function_map: { label: 'Permission to business function', columns: 'permission,function_code', note: 'For example FB60,AP_INVOICE_ENTRY.' },
  emergency_sessions: { label: 'Emergency (firefighter) sessions', columns: 'username,emergency_id,started_at,ended_at,reason,activity_count,activity_summary', note: 'Each session needs an after-the-fact review.' },
  transactions: { label: 'Transactions', columns: 'txn_type,external_id,document_number,reference,vendor_id,vendor_name,amount,quantity,currency,txn_date,posted_at,created_by,approved_by,change_field', note: 'txn_type: payment, invoice, journal_entry, vendor_change, purchase_order or goods_receipt. For payments, reference is the invoice number paid; for invoices and goods receipts, the purchase order number.' },
  config: { label: 'Configuration settings', columns: 'config_key,value,category,description,changed_by,changed_at', note: 'For example SAP profile parameters or Oracle E-Business Suite profile options. Changes between extracts are recorded; use full snapshot to record removed settings.' },
  sap_usr02: { label: 'SAP table USR02 (users)', columns: 'BNAME,USTYP,UFLAG,GLTGB,TRDAT,CLASS', note: 'SE16 download saved as CSV with technical field names. UFLAG other than 0 means locked.' },
  sap_agr_users: { label: 'SAP table AGR_USERS (role assignments)', columns: 'AGR_NAME,UNAME,FROM_DAT,TO_DAT', note: 'Dates as YYYYMMDD; 99991231 means no end date.' },
  sap_agr_1251: { label: 'SAP table AGR_1251 (role authorizations)', columns: 'AGR_NAME,OBJECT,FIELD,LOW,HIGH', note: 'Only S_TCODE / TCD values are used. Wildcards and ranges are expanded against the SAP starter map; roles holding * are flagged privileged.' },
};

interface SystemsPanelProps {
  canManage: boolean;
  systems: ErpSystem[];
  onChanged: () => void;
}

export default function SystemsPanel({ canManage, systems, onChanged }: SystemsPanelProps) {
  const [selected, setSelected] = useState<string>('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState<{ name: string; erp_type: string; environment: string } | null>(null);
  const [importKind, setImportKind] = useState<ErpImportKind | null>(null);
  const [replace, setReplace] = useState(false);
  const [users, setUsers] = useState<ErpUserRow[]>([]);
  const [search, setSearch] = useState('');
  const [imports, setImports] = useState<ImportRun[]>([]);
  const [detail, setDetail] = useState<ErpUserDetail | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selected && systems.length) setSelected(systems[0].id);
  }, [systems, selected]);

  const loadSystem = useCallback(async () => {
    if (!selected) return;
    try {
      const [u, i] = await Promise.all([erpAPI.listUsers(selected, { search: search || undefined, limit: 200 }), erpAPI.listImports(selected)]);
      setUsers((u.data?.data || []) as ErpUserRow[]);
      setImports((i.data?.data || []) as ImportRun[]);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load the system'));
    }
  }, [selected, search]);

  useEffect(() => { loadSystem(); }, [loadSystem]);

  const run = async (fn: () => Promise<string>, fallback: string) => {
    setBusy(true);
    setError('');
    try {
      setNotice(await fn());
      onChanged();
      await loadSystem();
    } catch (err: unknown) {
      setError(errorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const system = systems.find((s) => s.id === selected);

  return (
    <div>
      <ErrorBanner message={error} />
      <NoticeBanner message={notice} />
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="text-sm text-gray-700">System
          <select className={`${inputClass} mt-1`} value={selected} onChange={(e) => setSelected(e.target.value)}>
            {systems.length === 0 && <option value="">No systems yet</option>}
            {systems.map((s) => <option key={s.id} value={s.id}>{s.name} ({humanize(s.erp_type)})</option>)}
          </select>
        </label>
        <div className="flex-1" />
        {canManage && <button type="button" className={secondaryButton} onClick={() => setCreating({ name: '', erp_type: 'oracle_ebs', environment: 'production' })}>Add system</button>}
        {canManage && system && (
          <>
            <button type="button" className={secondaryButton} onClick={() => setConnecting(true)}>Connection and schedule</button>
            <button type="button" className={secondaryButton} onClick={() => setImportKind('users')}>Import data</button>
            <button type="button" className={primaryButton} disabled={busy}
              onClick={() => run(async () => {
                const res = await erpAPI.analyze(system.id);
                const r = res.data?.data as { detected: number; new_conflicts: number; resolved: number };
                return `Analysis complete: ${r.detected} conflict(s), ${r.new_conflicts} new, ${r.resolved} resolved.`;
              }, 'Analysis failed')}>
              Run SoD analysis
            </button>
          </>
        )}
      </div>

      {system && (
        <div className="text-xs text-gray-600 mb-4">
          {system.active_users} active user(s) · {system.roles} role(s) · {system.open_conflicts} open conflict(s) ·
          last import {system.last_import_at ? formatDate(system.last_import_at) : 'never'} · last analysis {system.last_analysis_at ? formatDate(system.last_analysis_at) : 'never'}
          {system.connector_label && <> · connector {system.connector_label}</>}
          {system.last_sync_at && <> · last sync {formatDate(system.last_sync_at)} ({system.last_sync_status})</>}
          {system.sync_schedule && system.sync_schedule !== 'manual' && <> · runs {system.sync_schedule}</>}
          {system.last_sync_status === 'failed' && system.last_sync_error && <div className="text-red-700 mt-1">Last sync failed: {system.last_sync_error}</div>}
        </div>
      )}

      {system && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-gray-900">Users</h2>
              <input className={`${inputClass} max-w-xs`} placeholder="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto max-h-[32rem] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase sticky top-0">
                  <tr><th className="px-3 py-2">User</th><th className="px-3 py-2">Department</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Roles</th><th className="px-3 py-2">Open conflicts</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Import users and assignments to see entitlements.</td></tr>}
                  {users.map((u) => (
                    <tr key={u.id} className={`hover:bg-gray-50 cursor-pointer ${u.is_present ? '' : 'opacity-50'}`}
                      onClick={async () => {
                        try {
                          const res = await erpAPI.getUser(system.id, u.id);
                          setDetail(res.data?.data as ErpUserDetail);
                        } catch (err: unknown) {
                          setError(errorMessage(err, 'Failed to load the user'));
                        }
                      }}>
                      <td className="px-3 py-2"><span className="font-medium text-blue-700">{u.username}</span><div className="text-xs text-gray-500">{u.full_name}</div></td>
                      <td className="px-3 py-2 text-xs">{u.department}</td>
                      <td className="px-3 py-2 text-xs">{u.is_present ? humanize(u.status) : 'Not in latest import'}</td>
                      <td className="px-3 py-2">{u.role_count}</td>
                      <td className={`px-3 py-2 ${u.open_conflicts ? 'text-red-700 font-medium' : ''}`}>{u.open_conflicts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Import history</h2>
            <ul className="space-y-2 text-sm" role="list">
              {imports.length === 0 && <li className="text-gray-500">No imports yet.</li>}
              {imports.map((i) => (
                <li key={i.id} role="listitem" className="bg-white border border-gray-200 rounded p-2">
                  <div className="font-medium">{IMPORT_TEMPLATES[i.kind as ErpImportKind]?.label || i.kind} <span className="text-xs text-gray-500">({i.mode})</span></div>
                  <div className="text-xs text-gray-600">{i.row_count} row(s){i.error_count ? `, ${i.error_count} rejected` : ''} · {formatDate(i.created_at)}{i.imported_by ? ` · ${i.imported_by}` : ''}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {creating && (
        <Modal title="Add ERP system" onClose={() => setCreating(null)}>
          <div className="space-y-3 text-sm">
            <label className="block">Name<input className={inputClass} value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} placeholder="Oracle EBS production" /></label>
            <label className="block">ERP
              <select className={inputClass} value={creating.erp_type} onChange={(e) => setCreating({ ...creating, erp_type: e.target.value })}>
                {ERP_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
              </select>
            </label>
            <label className="block">Environment
              <select className={inputClass} value={creating.environment} onChange={(e) => setCreating({ ...creating, environment: e.target.value })}>
                <option value="production">Production</option>
                <option value="non_production">Non-production</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className={secondaryButton} onClick={() => setCreating(null)}>Cancel</button>
            <button type="button" className={primaryButton} disabled={busy || !creating.name.trim()}
              onClick={() => run(async () => {
                const res = await erpAPI.createSystem(creating);
                setSelected((res.data?.data as { id: string }).id);
                setCreating(null);
                return 'System added. Import its users, roles and assignments next.';
              }, 'Could not add the system')}>
              Add
            </button>
          </div>
        </Modal>
      )}

      {importKind && system && (
        <Modal title={`Import into ${system.name}`} onClose={() => setImportKind(null)} wide>
          <div className="flex flex-wrap gap-3 items-end mb-3 text-sm">
            <label>Data
              <select className={inputClass} value={importKind} onChange={(e) => { setImportKind(e.target.value as ErpImportKind); setReplace(false); }}>
                {(Object.keys(IMPORT_TEMPLATES) as ErpImportKind[]).map((k) => <option key={k} value={k}>{IMPORT_TEMPLATES[k].label}</option>)}
              </select>
            </label>
            {!['emergency_sessions', 'transactions'].includes(importKind) && (
              <label className="flex items-center gap-2 pb-2">
                <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                Full snapshot (remove anything not in the file)
              </label>
            )}
          </div>
          <CsvInput
            busy={busy}
            help={<>Columns: <code className="break-all">{IMPORT_TEMPLATES[importKind].columns}</code>. {IMPORT_TEMPLATES[importKind].note}</>}
            onSubmit={(csv) => run(async () => {
              const res = await erpAPI.importData(system.id, { kind: importKind, csv, mode: replace ? 'replace' : 'merge' });
              const r = res.data?.data as { row_count: number; error_count: number; errors: { line: number; error: string }[]; revocations_verified: number };
              setImportKind(null);
              return `Imported ${r.row_count} row(s)${r.error_count ? `; ${r.error_count} rejected (first: line ${r.errors[0].line}, ${r.errors[0].error})` : ''}${r.revocations_verified ? `; ${r.revocations_verified} review revocation(s) verified` : ''}.`;
            }, 'Import failed')}
          />
        </Modal>
      )}

      {connecting && system && (
        <ConnectionDialog system={system} onClose={() => setConnecting(false)} onChanged={onChanged} />
      )}

      {detail && (
        <Modal title={`${detail.username}${detail.full_name ? ` (${detail.full_name})` : ''}`} onClose={() => setDetail(null)} wide>
          <h3 className="font-semibold text-sm mb-2">Roles and functions</h3>
          <ul className="space-y-2 text-sm mb-4" role="list">
            {detail.roles.map((r) => (
              <li key={r.role_name} role="listitem">
                <span className="font-medium">{r.role_name}</span>{r.is_privileged && <span className="ml-2 text-xs text-red-700">privileged</span>}
                <div className="text-xs text-gray-600">{r.functions.length ? r.functions.join(', ') : 'No mapped functions'}</div>
              </li>
            ))}
          </ul>
          <h3 className="font-semibold text-sm mb-2">Conflicts</h3>
          <ul className="space-y-1 text-sm" role="list">
            {detail.conflicts.length === 0 && <li className="text-gray-500">None.</li>}
            {detail.conflicts.map((c) => <li key={c.id} role="listitem">{c.rule_code} {c.rule_name} <span className="text-xs text-gray-500">({c.severity}, {c.status})</span></li>)}
          </ul>
        </Modal>
      )}
    </div>
  );
}
