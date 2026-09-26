'use client';

import { useCallback, useEffect, useState } from 'react';
import { erpAPI } from '@/lib/api';
import { errorMessage, formatDate, inputClass, Modal, primaryButton, secondaryButton } from '@/components/policies/policyShared';
import { ErrorBanner, StatusPill } from './erpShared';

interface Session {
  id: string;
  system_name: string;
  username: string;
  emergency_id: string;
  reason: string | null;
  started_at: string;
  ended_at: string | null;
  activity_count: number | null;
  activity_summary: string | null;
  review_status: 'pending' | 'approved' | 'escalated';
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
}

export default function EmergencyPanel({ canManage, onChanged }: { canManage: boolean; onChanged: () => void }) {
  const [rows, setRows] = useState<Session[]>([]);
  const [status, setStatus] = useState('pending');
  const [reviewing, setReviewing] = useState<{ session: Session; review_status: 'approved' | 'escalated'; review_notes: string } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await erpAPI.listEmergencySessions({ status: status || undefined });
      setRows((res.data?.data || []) as Session[]);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load emergency sessions'));
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!reviewing) return;
    setError('');
    try {
      await erpAPI.reviewEmergencySession(reviewing.session.id, { review_status: reviewing.review_status, review_notes: reviewing.review_notes });
      setReviewing(null);
      await load();
      onChanged();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not record the review'));
    }
  };

  return (
    <div>
      <ErrorBanner message={error} />
      <div className="flex items-center gap-3 mb-4">
        <select className={`${inputClass} max-w-xs`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Review status">
          <option value="pending">Awaiting review</option>
          <option value="approved">Approved</option>
          <option value="escalated">Escalated</option>
          <option value="">All</option>
        </select>
        <p className="text-sm text-gray-600">Import firefighter or break-glass session logs from the Systems tab. Every session needs an independent after-the-fact review of what was done.</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase">
            <tr><th className="px-3 py-2">User</th><th className="px-3 py-2">Emergency ID</th><th className="px-3 py-2">Session</th><th className="px-3 py-2">Reason / activity</th><th className="px-3 py-2">Review</th><th className="px-3 py-2" /></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No sessions.</td></tr>}
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2 font-medium">{s.username}<div className="text-xs text-gray-400">{s.system_name}</div></td>
                <td className="px-3 py-2">{s.emergency_id}</td>
                <td className="px-3 py-2 text-xs">{formatDate(s.started_at)}{s.ended_at ? ` to ${formatDate(s.ended_at)}` : ''}</td>
                <td className="px-3 py-2 text-xs max-w-sm">{s.reason}{s.activity_count !== null ? <div>{s.activity_count} action(s)</div> : null}{s.activity_summary ? <div className="text-gray-500">{s.activity_summary}</div> : null}</td>
                <td className="px-3 py-2"><StatusPill status={s.review_status} />{s.reviewer_name && <div className="text-xs text-gray-500">{s.reviewer_name}</div>}{s.review_notes && <div className="text-xs text-gray-500">{s.review_notes}</div>}</td>
                <td className="px-3 py-2 text-right">
                  {canManage && s.review_status === 'pending' && (
                    <button type="button" className="text-blue-700 text-xs" onClick={() => setReviewing({ session: s, review_status: 'approved', review_notes: '' })}>Review</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reviewing && (
        <Modal title={`Review ${reviewing.session.emergency_id} used by ${reviewing.session.username}`} onClose={() => setReviewing(null)}>
          <div className="space-y-3 text-sm">
            <label className="block">Outcome
              <select className={inputClass} value={reviewing.review_status} onChange={(e) => setReviewing({ ...reviewing, review_status: e.target.value as 'approved' | 'escalated' })}>
                <option value="approved">Activity was appropriate</option>
                <option value="escalated">Escalate: activity needs investigation</option>
              </select>
            </label>
            <label className="block">What you reviewed (required)
              <textarea className={inputClass} rows={3} value={reviewing.review_notes} onChange={(e) => setReviewing({ ...reviewing, review_notes: e.target.value })} placeholder="Log reviewed, ticket reference, actions checked" />
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className={secondaryButton} onClick={() => setReviewing(null)}>Cancel</button>
            <button type="button" className={primaryButton} disabled={!reviewing.review_notes.trim()} onClick={submit}>Record review</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
