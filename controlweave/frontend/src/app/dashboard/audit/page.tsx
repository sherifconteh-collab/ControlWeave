'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { auditAPI } from '@/lib/api';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  userName?: string;
  email: string;
  ipAddress: string;
  userAgent?: string;
  success: boolean;
  createdAt: string;
  failureReason?: string;
  details?: Record<string, unknown> | string | null;
}

interface SplunkLiveResponseData {
  configured: boolean;
  message?: string;
  sid?: string;
  search?: string;
  earliest_time?: string;
  latest_time?: string;
  result_count?: number;
  results?: Array<Record<string, unknown>>;
}

type ViewMode = 'table' | 'oneline';

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [onelineEntries, setOnelineEntries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [splunkLive, setSplunkLive] = useState<SplunkLiveResponseData | null>(null);
  const [splunkLoading, setSplunkLoading] = useState(true);
  const [splunkError, setSplunkError] = useState('');
  const [selectedSplunkEvent, setSelectedSplunkEvent] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!selectedLog && !selectedSplunkEvent) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedLog(null);
        setSelectedSplunkEvent(null);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedLog, selectedSplunkEvent]);

  useEffect(() => {
    loadLogs();
    loadEventTypes();
  }, [selectedEventType]);

  useEffect(() => {
    loadSplunkLive();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100, offset: 0 };
      if (selectedEventType !== 'all') {
        params.eventType = selectedEventType;
      }

      const [tableResponse, onelineResponse] = await Promise.all([
        auditAPI.getLogs(params),
        auditAPI.getOneline(params),
      ]);

      const payload = tableResponse.data.data;
      const rawLogs = Array.isArray(payload) ? payload : payload?.logs || [];

      const mappedLogs: AuditLog[] = rawLogs.map((log: any) => ({
        id: log.id,
        eventType: log.eventType || log.event_type,
        resourceType: log.resourceType || log.resource_type || undefined,
        resourceId: log.resourceId || log.resource_id || undefined,
        userName: log.userName || log.user_name || undefined,
        email: log.email || log.user_email || '',
        ipAddress: log.ipAddress || log.ip_address || '',
        userAgent: log.userAgent || log.user_agent || undefined,
        success: Boolean(log.success),
        createdAt: log.createdAt || log.created_at,
        failureReason: log.failureReason || log.failure_reason || undefined,
        details: log.details || null,
      }));

      setLogs(mappedLogs);
      setOnelineEntries(Array.isArray(onelineResponse.data.data) ? onelineResponse.data.data : []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSplunkLive = async () => {
    try {
      setSplunkLoading(true);
      setSplunkError('');

      const response = await auditAPI.getSplunkLive({
        maxEvents: 50,
        earliestTime: '-24h@h',
        latestTime: 'now',
      });

      const payload: SplunkLiveResponseData = response.data?.data || { configured: false, results: [] };
      payload.results = Array.isArray(payload.results) ? payload.results : [];
      setSplunkLive(payload);
    } catch (err: any) {
      console.error('Failed to load Splunk live audit events:', err);
      setSplunkError(err.response?.data?.details || err.response?.data?.error || 'Failed to fetch Splunk live events');
      setSplunkLive(null);
    } finally {
      setSplunkLoading(false);
    }
  };

  const loadEventTypes = async () => {
    try {
      const response = await auditAPI.getEventTypes();
      const payload = response.data.data;
      const types = Array.isArray(payload) ? payload : payload?.eventTypes || [];
      setEventTypes(types);
    } catch (err) {
      console.error('Failed to load event types:', err);
    }
  };

  const getEventBadgeClass = (success: boolean) => {
    return success
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  };

  const formatEventType = (eventType: string) =>
    eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const toJsonString = (value: unknown) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const toPrettyJson = (value: unknown) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const escapeCsv = (value: unknown) => {
    const stringValue = value === null || value === undefined ? '' : String(value);
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  const stringOrDash = (value: unknown) => {
    if (value === null || value === undefined) return '-';
    const trimmed = String(value).trim();
    return trimmed || '-';
  };

  const formatSplunkTimestamp = (value: unknown) => {
    if (value === null || value === undefined) return '-';
    const raw = String(value).trim();
    if (!raw) return '-';

    const parsedNumber = Number(raw);
    if (!Number.isNaN(parsedNumber) && Number.isFinite(parsedNumber)) {
      const fromEpoch = new Date(parsedNumber < 1e12 ? parsedNumber * 1000 : parsedNumber);
      if (!Number.isNaN(fromEpoch.getTime())) {
        return format(fromEpoch, 'MMM d, yyyy HH:mm:ss');
      }
    }

    const fromString = new Date(raw);
    if (!Number.isNaN(fromString.getTime())) {
      return format(fromString, 'MMM d, yyyy HH:mm:ss');
    }

    return raw;
  };

  const getSplunkEventType = (event: Record<string, unknown>) =>
    stringOrDash(event.event || event.action || event.event_type || event.signature || event.tag);

  const getSplunkEventTimestamp = (event: Record<string, unknown>) =>
    formatSplunkTimestamp(event._time || event.time || event.timestamp);

  const getSplunkEventHost = (event: Record<string, unknown>) =>
    stringOrDash(event.host || event.source || event.src || event.dest);

  const getSplunkEventSummary = (event: Record<string, unknown>) =>
    stringOrDash(event.message || event.msg || event._raw || event.description);

  const handleExport = () => {
    if (logs.length === 0) return;

    const headers = [
      'timestamp',
      'event_type',
      'resource_type',
      'resource_id',
      'user_name',
      'user_email',
      'ip_address',
      'user_agent',
      'status',
      'failure_reason',
      'details'
    ];

    const rows = logs.map((log) => [
      log.createdAt,
      log.eventType,
      log.resourceType || '',
      log.resourceId || '',
      log.userName || '',
      log.email || '',
      log.ipAddress || '',
      log.userAgent || '',
      log.success ? 'success' : 'failed',
      log.failureReason || '',
      toJsonString(log.details)
    ]);

    const csv = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const suffix = selectedEventType === 'all' ? 'all-events' : selectedEventType;
    const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');

    link.href = url;
    link.download = `audit-logs-${suffix}-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyOneline = async () => {
    if (onelineEntries.length === 0) return;
    try {
      await navigator.clipboard.writeText(onelineEntries.join('\n'));
    } catch {
      console.error('Failed to copy audit log to clipboard');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-2">
            Unified audit trail with deep event context across frameworks and models
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Type
              </label>
              <select
                value={selectedEventType}
                onChange={(e) => setSelectedEventType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Events</option>
                {eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                View
              </label>
              <div className="flex rounded-md border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition ${
                    viewMode === 'table'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setViewMode('oneline')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition border-l border-gray-300 ${
                    viewMode === 'oneline'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Oneline
                </button>
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={loadLogs}
                className="px-6 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 transition"
              >
                Refresh
              </button>
            </div>
            <div className="flex items-end">
              {viewMode === 'table' ? (
                <button
                  onClick={handleExport}
                  disabled={logs.length === 0}
                  className="px-6 py-2 border border-purple-600 text-purple-700 font-medium rounded-md hover:bg-purple-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export CSV
                </button>
              ) : (
                <button
                  onClick={handleCopyOneline}
                  disabled={onelineEntries.length === 0}
                  className="px-6 py-2 border border-purple-600 text-purple-700 font-medium rounded-md hover:bg-purple-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Copy
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Audit Trail Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-2xl mr-3">📝</span>
            <div>
              <h3 className="font-bold text-gray-900">Unified, In-Depth Audit Evidence</h3>
              <p className="text-sm text-gray-700 mt-1">
                These logs capture <strong>what</strong> (event type), <strong>when</strong> (timestamp),
                <strong> where</strong> (IP address), <strong>who</strong> (user email), and{' '}
                <strong>outcome</strong> (success/failure), plus context (<strong>resource</strong>,{' '}
                <strong>details</strong>) for security-relevant events across all frameworks and models.
              </p>
            </div>
          </div>
        </div>

        {/* Audit Logs — Table or Oneline */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-purple-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Event Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.length > 0 ? (
                    logs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {formatEventType(log.eventType)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {log.email || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                          {log.ipAddress || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getEventBadgeClass(
                              log.success
                            )}`}
                          >
                            {log.success ? 'Success' : 'Failed'}
                          </span>
                          {!log.success && log.failureReason && (
                            <p className="text-xs text-red-600 mt-1">{log.failureReason}</p>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        No audit logs found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg shadow-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
              <span className="text-xs font-mono text-gray-400">audit log --oneline</span>
              <span className="text-xs text-gray-500">{onelineEntries.length} entries</span>
            </div>
            <div className="p-4 overflow-x-auto max-h-[600px] overflow-y-auto">
              {onelineEntries.length > 0 ? (
                <pre className="text-sm font-mono leading-6 whitespace-pre">
                  {onelineEntries.map((line, i) => {
                    const [shortId, ...rest] = line.split(' ');
                    const isSuccess = line.endsWith('[SUCCESS]');
                    return (
                      <span key={i} className="block">
                        <span className="text-yellow-400">{shortId}</span>
                        {' '}
                        <span className={isSuccess ? 'text-green-400' : 'text-red-400'}>
                          {rest.join(' ')}
                        </span>
                      </span>
                    );
                  })}
                </pre>
              ) : (
                <p className="text-gray-500 text-sm font-mono">No audit logs found</p>
              )}
            </div>
          </div>
        )}

        {/* Results Count */}
        {!loading && logs.length > 0 && (
          <div className="text-sm text-gray-600 text-center">
            Showing {logs.length} audit logs (most recent first)
          </div>
        )}

        {selectedLog && (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close log details"
              className="absolute inset-0 bg-black/40"
              onClick={() => setSelectedLog(null)}
            />
            <aside className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Audit Event Detail</p>
                  <h2 className="text-lg font-bold text-gray-900">{formatEventType(selectedLog.eventType)}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Close
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getEventBadgeClass(selectedLog.success)}`}>
                    {selectedLog.success ? 'Success' : 'Failed'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {format(new Date(selectedLog.createdAt), 'MMM d, yyyy HH:mm:ss')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <DetailField label="Event Type" value={selectedLog.eventType} mono />
                  <DetailField label="Resource Type" value={selectedLog.resourceType || '-'} />
                  <DetailField label="Resource ID" value={selectedLog.resourceId || '-'} mono />
                  <DetailField label="User Name" value={selectedLog.userName || '-'} />
                  <DetailField label="User Email" value={selectedLog.email || '-'} />
                  <DetailField label="IP Address" value={selectedLog.ipAddress || '-'} mono />
                </div>

                <DetailField label="User Agent" value={selectedLog.userAgent || '-'} />

                {selectedLog.failureReason && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Failure Reason</h3>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                      {selectedLog.failureReason}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Event Details (JSON)</h3>
                  <div className="bg-gray-50 border rounded-lg p-3 overflow-auto max-h-[320px]">
                    <pre className="text-xs text-gray-800 whitespace-pre-wrap break-words">
                      {toPrettyJson(selectedLog.details) || '{}'}
                    </pre>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-white border rounded-lg p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-sm text-gray-900 mt-1 break-words ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
