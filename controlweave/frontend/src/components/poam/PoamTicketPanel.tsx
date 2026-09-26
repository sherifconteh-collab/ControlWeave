'use client';

import { useEffect, useState } from 'react';
import { integrationsHubAPI } from '@/lib/api';

interface PoamTicketPanelProps {
  poamItemId: string;
  ticketKey: string | null | undefined;
  ticketUrl: string | null | undefined;
  ticketStatus: string | null | undefined;
  ticketSyncedAt: string | null | undefined;
  canManage: boolean;
  onChange: () => void;
}

interface JiraConnector {
  id: string;
  name: string;
  connector_type: string;
}

function apiError(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof data?.error === 'string' ? data.error : fallback;
}

// Remediation ticket for a POA&M item. Linking needs settings.manage because it
// uses a connector's stored credentials; everyone who can see the item sees
// the ticket and its last synced status.
export default function PoamTicketPanel({ poamItemId, ticketKey, ticketUrl, ticketStatus, ticketSyncedAt, canManage, onChange }: PoamTicketPanelProps) {
  const [connectors, setConnectors] = useState<JiraConnector[]>([]);
  const [connectorId, setConnectorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!canManage || ticketKey) return;
    integrationsHubAPI.getConnectors()
      .then((res) => {
        const jira = ((res.data?.data || []) as JiraConnector[]).filter((c) => c.connector_type === 'jira');
        setConnectors(jira);
        if (jira[0]) setConnectorId(jira[0].id);
      })
      .catch(() => setConnectors([]));
  }, [canManage, ticketKey]);

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      await integrationsHubAPI.createPoamTicket(connectorId, poamItemId);
      onChange();
    } catch (err: unknown) {
      setError(apiError(err, 'Could not create the ticket'));
    } finally {
      setBusy(false);
    }
  };

  if (!ticketKey && (!canManage || connectors.length === 0)) return null;

  return (
    <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-2">
      <h2 className="text-sm font-semibold text-gray-900">Remediation ticket</h2>
      {ticketKey ? (
        <p className="text-sm text-gray-700">
          {ticketUrl ? <a href={ticketUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{ticketKey}</a> : ticketKey}
          {ticketStatus ? ` - ${ticketStatus}` : ''}
          {ticketSyncedAt && <span className="block text-xs text-gray-500">Status as of {new Date(ticketSyncedAt).toLocaleString()} (refreshed on each Jira sync)</span>}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {connectors.length > 1 && (
            <select aria-label="Jira connector" className="text-sm border border-gray-300 rounded px-2 py-1.5" value={connectorId} onChange={(e) => setConnectorId(e.target.value)}>
              {connectors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button type="button" onClick={create} disabled={busy || !connectorId} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {busy ? 'Creating…' : 'Create Jira ticket'}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </section>
  );
}
