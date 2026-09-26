'use client';

import { useEffect, useState } from 'react';
import { erpAPI, type ErpScheduleInput } from '@/lib/api';
import { errorMessage, formatDate, inputClass, Modal, primaryButton, secondaryButton } from '@/components/policies/policyShared';
import { ErrorBanner, humanize, StatusPill } from './erpShared';
import type { ErpSystem } from './SystemsPanel';

interface ConnectorType { type: string; label: string; required: string[]; optional: string[]; secrets: string[] }
interface TicketConnector { id: string; name: string; connector_type: string }
interface SyncRun { id: string; trigger: string; status: string; error: string | null; started_at: string; summary: Record<string, unknown> }

// Friendly labels for connector settings.
const SETTING_LABELS: Record<string, string> = {
  usersReportUrl: 'Users report URL',
  assignmentsReportUrl: 'Assignments report URL (optional)',
  permissionsReportUrl: 'Permissions report URL (optional)',
  baseUrl: 'SCIM base URL',
  token: 'Bearer token',
  username: 'Username',
  password: 'Password',
  host: 'Database host',
  port: 'Port (default 1521)',
  serviceName: 'Service name',
  schema: 'Schema (default APPS)',
};

const CONNECTOR_HELP: Record<string, string> = {
  workday_raas: 'Custom reports exposed as web services, run as an integration system user. Name the report columns username, full_name, email, department, manager, status and roles.',
  scim: 'Oracle Fusion Cloud ERP: https://<host>/hcmRestApi/scim. SAP Cloud Identity Services: https://<tenant>.accounts.ondemand.com/service/scim.',
  oracle_ebs_db: 'A read-only database account with SELECT on the FND user, responsibility and menu tables. Hosts on a private network need CONNECTOR_ALLOW_PRIVATE_HOSTS=true on the server.',
};

interface ConnectionDialogProps {
  system: ErpSystem;
  onClose: () => void;
  onChanged: () => void;
}

export default function ConnectionDialog({ system, onClose, onChanged }: ConnectionDialogProps) {
  const [types, setTypes] = useState<ConnectorType[]>([]);
  const [ticketConnectors, setTicketConnectors] = useState<TicketConnector[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [connectorType, setConnectorType] = useState(system.connector_type || '');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState<ErpScheduleInput>({
    sync_schedule: system.sync_schedule || 'manual',
    sync_hour_utc: system.sync_hour_utc ?? 2,
    auto_analyze: system.auto_analyze ?? true,
    auto_monitor: system.auto_monitor ?? true,
    use_library_map: system.use_library_map ?? true,
    ticket_connector_id: system.ticket_connector_id || null,
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([erpAPI.listConnectorTypes(), erpAPI.listTicketConnectors(), erpAPI.listSyncRuns(system.id)])
      .then(([t, tc, r]) => {
        setTypes(((t.data?.data as { connectors: ConnectorType[] })?.connectors) || []);
        setTicketConnectors((tc.data?.data || []) as TicketConnector[]);
        setRuns((r.data?.data || []) as SyncRun[]);
      })
      .catch((err: unknown) => setError(errorMessage(err, 'Failed to load connection settings')));
    const initial: Record<string, string> = { ...(system.connector_config || {}) };
    for (const key of system.connector_credentials_set || []) initial[key] = '********';
    setSettings(initial);
  }, [system]);

  const template = types.find((t) => t.type === connectorType);

  const act = async (fn: () => Promise<string>, fallback: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setNotice(await fn());
      onChanged();
      const r = await erpAPI.listSyncRuns(system.id);
      setRuns((r.data?.data || []) as SyncRun[]);
    } catch (err: unknown) {
      setError(errorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Connection and schedule: ${system.name}`} onClose={onClose} wide>
      <ErrorBanner message={error} />
      {notice && <div className="mb-3 p-2 text-sm bg-green-50 border border-green-200 text-green-800 rounded" role="status">{notice}</div>}
      <section className="mb-5">
        <h3 className="font-semibold text-sm mb-2">Direct connector</h3>
        <label className="block text-sm">Connector
          <select className={inputClass} value={connectorType} onChange={(e) => { setConnectorType(e.target.value); setSettings({}); }}>
            <option value="">None (load CSV extracts)</option>
            {types.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
        </label>
        {template && (
          <>
            <p className="text-xs text-gray-600 mt-2">{CONNECTOR_HELP[template.type]}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 text-sm">
              {[...template.required, ...template.optional].map((key) => (
                <label key={key} className="block">{SETTING_LABELS[key] || key}{template.required.includes(key) ? ' *' : ''}
                  <input className={inputClass} type={template.secrets.includes(key) ? 'password' : 'text'} autoComplete="off"
                    value={settings[key] || ''} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} />
                </label>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-end mt-3">
          <button type="button" className={secondaryButton} disabled={busy}
            onClick={() => act(async () => {
              await erpAPI.setConnector(system.id, { connector_type: connectorType || null, settings });
              return connectorType ? 'Connector saved. Credentials are encrypted and never shown again.' : 'Connector removed.';
            }, 'Could not save the connector')}>
            Save connector
          </button>
        </div>
      </section>

      <section className="mb-5">
        <h3 className="font-semibold text-sm mb-2">Schedule and automation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <label className="block">Run
            <select className={inputClass} value={schedule.sync_schedule} onChange={(e) => setSchedule({ ...schedule, sync_schedule: e.target.value as ErpScheduleInput['sync_schedule'] })}>
              <option value="manual">Only when started</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label className="block">At (UTC hour)
            <input className={inputClass} type="number" min={0} max={23} value={schedule.sync_hour_utc}
              onChange={(e) => setSchedule({ ...schedule, sync_hour_utc: Math.max(0, Math.min(23, Number(e.target.value) || 0)) })} />
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(schedule.auto_analyze)} onChange={(e) => setSchedule({ ...schedule, auto_analyze: e.target.checked })} />Run SoD analysis after each sync</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(schedule.auto_monitor)} onChange={(e) => setSchedule({ ...schedule, auto_monitor: e.target.checked })} />Run monitoring rules after each sync</label>
          <label className="flex items-center gap-2 md:col-span-2"><input type="checkbox" checked={Boolean(schedule.use_library_map)} onChange={(e) => setSchedule({ ...schedule, use_library_map: e.target.checked })} />
            Use the ControlWeave starter map (SAP transaction codes, Oracle E-Business Suite form functions) alongside this system&apos;s own function map
          </label>
          <label className="block md:col-span-2">Revocation tickets
            <select className={inputClass} value={schedule.ticket_connector_id || ''} onChange={(e) => setSchedule({ ...schedule, ticket_connector_id: e.target.value || null })}>
              <option value="">Do not open tickets</option>
              {ticketConnectors.map((t) => <option key={t.id} value={t.id}>{t.name} ({humanize(t.connector_type === 'jira' ? 'jira' : 'itsm')})</option>)}
            </select>
          </label>
        </div>
        {system.next_sync_at && <p className="text-xs text-gray-600 mt-2">Next run {formatDate(system.next_sync_at)}.</p>}
        <div className="flex justify-end mt-3">
          <button type="button" className={secondaryButton} disabled={busy}
            onClick={() => act(async () => { await erpAPI.setSchedule(system.id, schedule); return 'Schedule saved.'; }, 'Could not save the schedule')}>
            Save schedule
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Run history</h3>
          <button type="button" className={primaryButton} disabled={busy}
            onClick={() => act(async () => {
              const res = await erpAPI.syncSystem(system.id);
              const run = res.data?.data as SyncRun;
              return `Run finished: ${run.status}.`;
            }, 'The run failed')}>
            {busy ? 'Running…' : 'Run now'}
          </button>
        </div>
        <ul className="space-y-2 text-sm max-h-60 overflow-y-auto" role="list">
          {runs.length === 0 && <li className="text-gray-500">No runs yet.</li>}
          {runs.map((r) => (
            <li key={r.id} role="listitem" className="border border-gray-200 rounded p-2">
              <div className="flex items-center gap-2"><StatusPill status={r.status} /><span className="text-xs text-gray-600">{humanize(r.trigger)} · {formatDate(r.started_at)}</span></div>
              {r.error && <div className="text-xs text-red-700 mt-1">{r.error}</div>}
              {r.status === 'success' && <div className="text-xs text-gray-600 mt-1 break-all">{JSON.stringify(r.summary)}</div>}
            </li>
          ))}
        </ul>
      </section>
    </Modal>
  );
}
