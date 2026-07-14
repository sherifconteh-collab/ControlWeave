// @tier: community
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { exceptionsAPI, implementationsAPI, usersAPI } from '@/lib/api';
import { hasPermission } from '@/lib/access';

type ExceptionStatus = 'pending' | 'active' | 'expired' | 'revoked';
type StatusFilter = 'all' | ExceptionStatus;

interface ExceptionRow {
  id: string;
  control_id: string;
  title: string;
  reason: string;
  compensating_controls: string | null;
  business_impact: string | null;
  owner_id: string | null;
  status: ExceptionStatus;
  expires_at: string | null;
  control_code: string;
  control_title: string;
  framework_code: string;
  owner_email: string | null;
  approved_by_email: string | null;
  created_at: string;
  updated_at: string;
}

interface ControlOption {
  framework_control_id: string;
  control_code: string;
  control_title: string;
  framework_code: string;
}

interface OrgUserOption {
  id: string;
  email: string;
  full_name: string;
}

interface ExceptionFormState {
  control_id: string;
  title: string;
  reason: string;
  compensating_controls: string;
  business_impact: string;
  owner_id: string;
  expires_at: string;
}

const EMPTY_FORM: ExceptionFormState = {
  control_id: '',
  title: '',
  reason: '',
  compensating_controls: '',
  business_impact: '',
  owner_id: '',
  expires_at: '',
};

const STATUS_BADGE_CLASSES: Record<ExceptionStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  expired: 'bg-gray-200 text-gray-700',
  revoked: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<ExceptionStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  expired: 'Expired',
  revoked: 'Revoked',
};

export default function ExceptionsPage() {
  const { user } = useAuth();
  const canWrite = hasPermission(user, 'controls.write');

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [controlOptions, setControlOptions] = useState<ControlOption[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUserOption[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ExceptionFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);
  const [revokeNote, setRevokeNote] = useState('');

  const loadExceptions = useCallback(async (cancelledRef?: { current: boolean }) => {
    try {
      setLoading(true);
      setLoadError('');
      const response = await exceptionsAPI.getList(statusFilter === 'all' ? undefined : { status: statusFilter });
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      if (!cancelledRef?.current) setExceptions(data);
    } catch {
      if (!cancelledRef?.current) setLoadError('Failed to load control exceptions.');
    } finally {
      if (!cancelledRef?.current) setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    const cancelledRef = { current: false };
    loadExceptions(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadExceptions]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await implementationsAPI.getAll();
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        const options: ControlOption[] = rows.map((row: {
          framework_control_id: string;
          control_code: string;
          control_title: string;
          framework_code: string;
        }) => ({
          framework_control_id: row.framework_control_id,
          control_code: row.control_code,
          control_title: row.control_title,
          framework_code: row.framework_code,
        }));
        if (!cancelled) setControlOptions(options);
      } catch {
        // Non-fatal — the control picker will just show no options.
      }
      try {
        const response = await usersAPI.getOrgUsers();
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        if (!cancelled) setOrgUsers(rows);
      } catch {
        // Non-fatal — owner picker is optional; omit it if the caller can't read users.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openCreateForm = () => {
    setForm(EMPTY_FORM);
    setCreateError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setCreateError('');
  };

  const submitForm = async () => {
    if (!form.control_id) {
      setCreateError('Select a control.');
      return;
    }
    if (!form.title.trim() || !form.reason.trim()) {
      setCreateError('Title and reason are required.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await exceptionsAPI.create({
        control_id: form.control_id,
        title: form.title.trim(),
        reason: form.reason.trim(),
        compensating_controls: form.compensating_controls.trim() || undefined,
        business_impact: form.business_impact.trim() || undefined,
        owner_id: form.owner_id || undefined,
        expires_at: form.expires_at || undefined,
      });
      closeForm();
      await loadExceptions();
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Failed to create control exception.');
    } finally {
      setCreating(false);
    }
  };

  const approveException = async (id: string) => {
    setBusyId(id);
    try {
      await exceptionsAPI.approve(id);
      await loadExceptions();
    } catch {
      setLoadError('Failed to approve control exception.');
    } finally {
      setBusyId(null);
    }
  };

  const openRevokePrompt = (id: string) => {
    setRevokeTargetId(id);
    setRevokeNote('');
  };

  const confirmRevoke = async () => {
    if (!revokeTargetId) return;
    setBusyId(revokeTargetId);
    try {
      await exceptionsAPI.revoke(revokeTargetId, revokeNote.trim() ? { note: revokeNote.trim() } : undefined);
      setRevokeTargetId(null);
      setRevokeNote('');
      await loadExceptions();
    } catch {
      setLoadError('Failed to revoke control exception.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Control Exceptions</h1>
            <p className="text-gray-600 mt-2">Track risk acceptances and compensating controls for exceptions to your compliance baseline.</p>
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={openCreateForm}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              + New Exception
            </button>
          )}
        </div>

        {/* Status filter tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            {(['all', 'pending', 'active', 'expired', 'revoked'] as StatusFilter[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  statusFilter === tab ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'all' ? 'All' : STATUS_LABELS[tab]}
              </button>
            ))}
          </nav>
        </div>

        {showForm && canWrite && (
          <div className="bg-white rounded-lg shadow-md border border-purple-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">New Exception</h2>
            {createError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {createError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Control</span>
                <select
                  value={form.control_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, control_id: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select a control...</option>
                  {controlOptions.map((option) => (
                    <option key={option.framework_control_id} value={option.framework_control_id}>
                      {option.framework_code} · {option.control_code} — {option.control_title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Title</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Short summary of the exception"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Reason</span>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Why can't this control be fully implemented?"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Compensating Controls</span>
                <textarea
                  value={form.compensating_controls}
                  onChange={(e) => setForm((prev) => ({ ...prev, compensating_controls: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Mitigations in place while this exception is active"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Business Impact</span>
                <textarea
                  value={form.business_impact}
                  onChange={(e) => setForm((prev) => ({ ...prev, business_impact: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Impact if this exception is denied or revoked"
                />
              </label>
              {orgUsers.length > 0 && (
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Owner</span>
                  <select
                    value={form.owner_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, owner_id: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Unassigned</option>
                    {orgUsers.map((orgUser) => (
                      <option key={orgUser.id} value={orgUser.id}>
                        {orgUser.full_name || orgUser.email}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Expires</span>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, expires_at: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitForm}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {creating ? 'Submitting...' : 'Submit Exception'}
              </button>
            </div>
          </div>
        )}

        {revokeTargetId && (
          <div className="bg-white rounded-lg shadow-md border border-red-200 p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Revoke exception</h3>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Note (optional)</span>
              <textarea
                value={revokeNote}
                onChange={(e) => setRevokeNote(e.target.value)}
                rows={2}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Reason for revocation"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevokeTargetId(null)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRevoke}
                disabled={busyId === revokeTargetId}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
              >
                Confirm Revoke
              </button>
            </div>
          </div>
        )}

        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            <div className="animate-pulse h-24 rounded-lg bg-gray-100" />
            <div className="animate-pulse h-24 rounded-lg bg-gray-100" />
          </div>
        ) : exceptions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500">No control exceptions {statusFilter !== 'all' ? `with status "${STATUS_LABELS[statusFilter]}"` : ''} found.</p>
          </div>
        ) : (
          <ul role="list" className="space-y-3">
            {exceptions.map((exception) => (
              <li
                key={exception.id}
                role="listitem"
                className="bg-white rounded-lg shadow-md p-5 border-l-4 border-purple-400"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-gray-900">{exception.title}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE_CLASSES[exception.status]}`}
                        aria-label={`Status: ${STATUS_LABELS[exception.status]}`}
                      >
                        {STATUS_LABELS[exception.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      <Link href={`/dashboard/controls/${exception.control_id}`} className="text-purple-600 hover:underline">
                        {exception.framework_code} · {exception.control_code}
                      </Link>
                      {' — '}{exception.control_title}
                    </p>
                    <p className="text-sm text-gray-700 mt-2">{exception.reason}</p>
                    {exception.business_impact && (
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="font-semibold">Business impact: </span>{exception.business_impact}
                      </p>
                    )}
                    {exception.compensating_controls && (
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="font-semibold">Compensating controls: </span>{exception.compensating_controls}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {exception.expires_at ? `Expires ${new Date(exception.expires_at).toLocaleDateString()}` : 'No expiration set'}
                      {exception.owner_email ? ` · Owner: ${exception.owner_email}` : ''}
                      {exception.approved_by_email ? ` · Approved by: ${exception.approved_by_email}` : ''}
                    </p>
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-2 shrink-0">
                      {exception.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => approveException(exception.id)}
                          disabled={busyId === exception.id}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}
                      {(exception.status === 'pending' || exception.status === 'active') && (
                        <button
                          type="button"
                          onClick={() => openRevokePrompt(exception.id)}
                          disabled={busyId === exception.id}
                          className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}
