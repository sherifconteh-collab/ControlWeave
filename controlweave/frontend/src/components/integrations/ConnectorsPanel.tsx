'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { integrationsHubAPI } from '@/lib/api';
import { errorMessage, inputClass, Modal, primaryButton, secondaryButton } from '@/components/policies/policyShared';

interface ConnectorTemplate {
  type: string;
  label: string;
  category: string;
  description?: string;
  required: string[];
  optional?: string[];
  secrets?: string[];
  sync_available: boolean;
}

interface RunSummary {
  findings_retrieved?: number;
  by_severity?: Record<string, number>;
  metrics?: Record<string, number | string | boolean | null>;
  evidence_id?: string;
  poam_tickets_refreshed?: number;
}

interface Connector {
  id: string;
  name: string;
  connector_type: string;
  label: string;
  category: string;
  status: 'active' | 'inactive' | 'error';
  connector_config: Record<string, string>;
  credentials_set: string[];
  sync_available: boolean;
  last_sync_at: string | null;
  last_run_status: 'success' | 'failed' | 'running' | null;
  last_run_at: string | null;
  last_run_summary: RunSummary | null;
  last_run_error: string | null;
}

interface EditorState {
  template: ConnectorTemplate;
  connector: Connector | null;
  name: string;
  values: Record<string, string>;
}

interface ConnectorsPanelProps {
  canManage: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  domain: 'Okta domain (acme.okta.com)',
  apiToken: 'API token',
  tenantId: 'Directory (tenant) ID',
  clientId: 'Application (client) ID',
  clientSecret: 'Client secret',
  inactiveDays: 'Inactive after (days, default 90)',
  baseUrl: 'Base URL',
  projectKey: 'Project key',
  email: 'Account email (Jira Cloud)',
  personalAccessToken: 'Personal access token (Jira Data Center)',
  jql: 'JQL filter (optional)',
  issueType: 'Issue type for new tickets (default Task)',
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

const METRIC_LABELS: Record<string, string> = {
  active_accounts: 'active accounts',
  mfa_coverage_percent: '% MFA coverage',
  administrators: 'administrators',
  inactive_accounts: 'inactive',
  open: 'open',
  overdue: 'overdue',
  resolved_last_30_days: 'resolved (30 days)',
};

function StatusPill({ status }: { status: Connector['status'] }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-500',
    error: 'bg-red-100 text-red-700',
  };
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize ${colors[status] || colors.inactive}`}>{status}</span>;
}

export default function ConnectorsPanel({ canManage }: ConnectorsPanelProps) {
  const [templates, setTemplates] = useState<ConnectorTemplate[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [tab, setTab] = useState<'available' | 'installed'>('available');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tmpl, conn] = await Promise.all([integrationsHubAPI.getTemplates(), integrationsHubAPI.getConnectors()]);
      setTemplates((tmpl.data?.data || []) as ConnectorTemplate[]);
      setConnectors((conn.data?.data || []) as Connector[]);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load integrations.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEditor = (template: ConnectorTemplate, connector: Connector | null) => {
    setError(null);
    setEditor({
      template,
      connector,
      name: connector ? connector.name : template.label,
      values: connector ? { ...connector.connector_config } : {},
    });
  };

  const save = async () => {
    if (!editor) return;
    const secrets = new Set(editor.template.secrets || []);
    const authConfig: Record<string, string> = {};
    const connectorConfig: Record<string, string> = {};
    Object.entries(editor.values).forEach(([key, value]) => {
      if (secrets.has(key)) { if (value) authConfig[key] = value; } else connectorConfig[key] = value;
    });
    setSaving(true);
    setError(null);
    try {
      if (editor.connector) {
        await integrationsHubAPI.updateConnector(editor.connector.id, { name: editor.name, auth_config: authConfig, connector_config: connectorConfig });
      } else {
        await integrationsHubAPI.createConnector({ name: editor.name, connector_type: editor.template.type, auth_config: authConfig, connector_config: connectorConfig, status: 'active' });
        setTab('installed');
      }
      setEditor(null);
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not save the connector.'));
    } finally {
      setSaving(false);
    }
  };

  const run = async (connector: Connector) => {
    setBusyId(connector.id);
    setError(null);
    setNotice(null);
    try {
      const res = await integrationsHubAPI.runConnector(connector.id);
      const summary = (res.data?.data?.result_summary || {}) as RunSummary;
      setNotice(`${connector.name}: sync complete, ${summary.findings_retrieved ?? 0} finding(s)${summary.evidence_id ? '; snapshot saved as evidence' : ''}.`);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Sync failed.'));
    } finally {
      setBusyId(null);
      await load();
    }
  };

  const remove = async (connector: Connector) => {
    if (!confirm(`Remove ${connector.name}? Stored credentials are deleted.`)) return;
    setBusyId(connector.id);
    try {
      await integrationsHubAPI.deleteConnector(connector.id);
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to remove the connector.'));
    } finally {
      setBusyId(null);
    }
  };

  const templateFor = (type: string) => templates.find((t) => t.type === type);

  return (
    <div>
      <div className="flex gap-4 border-b border-gray-200 mb-6" role="tablist">
        {(['available', 'installed'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'installed' ? `Installed (${connectors.length})` : 'Available connectors'}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">{error}</div>}
      {notice && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">{notice}</div>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : tab === 'available' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.type} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm flex flex-col gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-gray-900">{t.label}</h3>
                  <span className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-600">{t.category}</span>
                  {!t.sync_available && <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Sync coming soon</span>}
                </div>
                {t.description && <p className="text-sm text-gray-500">{t.description}</p>}
              </div>
              {canManage && (
                <button type="button" className={`${primaryButton} mt-auto`} onClick={() => openEditor(t, null)}>Configure</button>
              )}
            </div>
          ))}
        </div>
      ) : connectors.length === 0 ? (
        <p className="text-center py-12 text-gray-500">No connectors installed yet.</p>
      ) : (
        <div className="space-y-3">
          {connectors.map((c) => {
            const summary = c.last_run_summary;
            return (
              <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-gray-900">{c.name}</span>
                      <span className="text-xs text-gray-500">{c.label}</span>
                      <StatusPill status={c.status} />
                    </div>
                    <div className="text-xs text-gray-500 space-x-3">
                      <span>{c.last_sync_at ? `Last successful sync ${format(new Date(c.last_sync_at), 'MMM d, yyyy HH:mm')}` : 'Never synced'}</span>
                      {c.credentials_set.length > 0 && <span>Credentials stored encrypted</span>}
                    </div>
                    {c.last_run_status === 'failed' && c.last_run_error && <p className="text-xs text-red-600 mt-1">Last run failed: {c.last_run_error}</p>}
                    {c.last_run_status === 'success' && summary && (
                      <p className="text-xs text-gray-600 mt-1">
                        {summary.findings_retrieved ?? 0} finding(s)
                        {summary.metrics && Object.entries(METRIC_LABELS)
                          .filter(([key]) => summary.metrics && summary.metrics[key] !== undefined && summary.metrics[key] !== null)
                          .map(([key, label]) => ` - ${summary.metrics?.[key]} ${label}`).join('')}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" className={secondaryButton} disabled={!c.sync_available || busyId === c.id} onClick={() => run(c)} title={c.sync_available ? undefined : 'Sync is not available for this connector type yet'}>
                        {busyId === c.id ? 'Syncing…' : 'Sync now'}
                      </button>
                      <button type="button" className={secondaryButton} onClick={() => { const t = templateFor(c.connector_type); if (t) openEditor(t, c); }}>Edit</button>
                      <button type="button" className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50" disabled={busyId === c.id} onClick={() => remove(c)}>Remove</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editor && (
        <Modal title={`${editor.connector ? 'Edit' : 'Configure'} ${editor.template.label}`} onClose={() => setEditor(null)}>
          <div className="space-y-3">
            {editor.template.description && <p className="text-sm text-gray-600">{editor.template.description}</p>}
            <div>
              <label htmlFor="connector-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input id="connector-name" className={inputClass} value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
            </div>
            {[...editor.template.required, ...(editor.template.optional || [])].map((key) => {
              const secret = (editor.template.secrets || []).includes(key);
              const stored = secret && editor.connector?.credentials_set.includes(key);
              return (
                <div key={key}>
                  <label htmlFor={`field-${key}`} className="block text-sm font-medium text-gray-700 mb-1">
                    {fieldLabel(key)}{editor.template.required.includes(key) ? ' *' : ''}
                  </label>
                  <input
                    id={`field-${key}`}
                    type={secret ? 'password' : 'text'}
                    autoComplete="off"
                    className={inputClass}
                    value={editor.values[key] || ''}
                    placeholder={stored ? 'Stored - leave blank to keep' : ''}
                    onChange={(e) => setEditor({ ...editor, values: { ...editor.values, [key]: e.target.value } })}
                  />
                </div>
              );
            })}
            <p className="text-xs text-gray-500">Secrets are encrypted at rest and are never shown again after saving.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={secondaryButton} onClick={() => setEditor(null)}>Cancel</button>
              <button type="button" className={primaryButton} disabled={saving || !editor.name.trim()} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
