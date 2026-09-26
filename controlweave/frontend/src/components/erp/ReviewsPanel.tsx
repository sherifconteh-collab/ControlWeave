'use client';

import { useCallback, useEffect, useState } from 'react';
import { erpAPI, usersAPI } from '@/lib/api';
import { errorMessage, formatDate, inputClass, Modal, primaryButton, secondaryButton } from '@/components/policies/policyShared';
import { downloadBlob, ErrorBanner, NoticeBanner, StatusPill } from './erpShared';
import type { ErpSystem } from './SystemsPanel';

interface Review {
  id: string;
  name: string;
  system_name: string;
  status: string;
  due_date: string | null;
  items: number;
  pending: number;
  revoked: number;
  revocations_verified: number;
  created_at: string;
}

interface ReviewItem {
  id: string;
  username: string;
  decision: 'pending' | 'certified' | 'revoke';
  roles_to_revoke: string[];
  notes: string | null;
  revocation_verified_at: string | null;
  reviewer_name?: string | null;
  routed_by?: string | null;
  ticket_key?: string | null;
  ticket_url?: string | null;
  ticket_status?: string | null;
  ticket_error?: string | null;
  snapshot: { full_name?: string; department?: string; roles?: string[]; privileged_roles?: string[]; functions?: string[]; open_conflicts?: number; last_login_at?: string | null };
}

interface ReviewDetail extends Omit<Review, 'items'> { items: ReviewItem[]; total_items: number; routing?: string }

interface OrgUser { id: string; first_name?: string; last_name?: string; email?: string }

interface ReviewsPanelProps {
  canManage: boolean;
  systems: ErpSystem[];
  onChanged: () => void;
}

export default function ReviewsPanel({ canManage, systems, onChanged }: ReviewsPanelProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [open, setOpen] = useState<ReviewDetail | null>(null);
  const [creating, setCreating] = useState<{ system_id: string; name: string; due_date: string; reviewer_id: string; routing: 'reviewer' | 'manager' } | null>(null);
  const [mine, setMine] = useState(false);
  const [people, setPeople] = useState<OrgUser[]>([]);
  const [revoking, setRevoking] = useState<{ item: ReviewItem; roles: string[]; notes: string } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await erpAPI.listReviews();
      setReviews((res.data?.data || []) as Review[]);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load reviews'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openReview = async (id: string, onlyMine = mine) => {
    try {
      const res = await erpAPI.getReview(id, { limit: 500, mine: onlyMine || undefined });
      setOpen(res.data?.data as ReviewDetail);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load the review'));
    }
  };

  const startCreate = async () => {
    try {
      const res = await usersAPI.getOrgUsers();
      const list = (res.data?.data?.users || res.data?.data || []) as OrgUser[];
      setPeople(Array.isArray(list) ? list : []);
    } catch {
      setPeople([]);
    }
    setCreating({ system_id: systems[0]?.id || '', name: `${new Date().getFullYear()} Q${Math.floor(new Date().getMonth() / 3) + 1} access review`, due_date: '', reviewer_id: '', routing: 'reviewer' });
  };

  const decide = async (item: ReviewItem, decision: 'certified' | 'revoke' | 'pending', roles: string[] = [], notes = '') => {
    if (!open) return;
    setError('');
    try {
      await erpAPI.decideReviewItem(open.id, item.id, { decision, roles_to_revoke: roles, notes: notes || undefined });
      await openReview(open.id);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not record the decision'));
    }
  };

  const run = async (fn: () => Promise<string>, fallback: string) => {
    setBusy(true);
    setError('');
    try {
      setNotice(await fn());
      await load();
      onChanged();
    } catch (err: unknown) {
      setError(errorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <ErrorBanner message={error} />
      <NoticeBanner message={notice} />
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-600 max-w-3xl">Each review snapshots the system&apos;s active users with their roles, functions and open conflicts. Items can go to each user&apos;s manager. Completing a review opens a revocation ticket per revoked user when the system is linked to Jira or the ITSM connector, and revocations are marked verified once a later import shows the access removed.</p>
        {canManage && systems.length > 0 && <button type="button" className={primaryButton} onClick={startCreate}>Start review</button>}
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase">
            <tr><th className="px-3 py-2">Review</th><th className="px-3 py-2">System</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Progress</th><th className="px-3 py-2">Revocations</th><th className="px-3 py-2">Due</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reviews.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No access reviews yet.</td></tr>}
            {reviews.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openReview(r.id)}>
                <td className="px-3 py-2 font-medium text-blue-700">{r.name}</td>
                <td className="px-3 py-2">{r.system_name}</td>
                <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                <td className="px-3 py-2 text-xs">{r.items - r.pending} of {r.items} decided</td>
                <td className="px-3 py-2 text-xs">{r.revoked ? `${r.revocations_verified} of ${r.revoked} verified` : 'None'}</td>
                <td className="px-3 py-2 text-xs">{r.due_date ? formatDate(r.due_date) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <Modal title="Start ERP access review" onClose={() => setCreating(null)}>
          <div className="space-y-3 text-sm">
            <label className="block">System
              <select className={inputClass} value={creating.system_id} onChange={(e) => setCreating({ ...creating, system_id: e.target.value })}>
                {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="block">Name<input className={inputClass} value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} /></label>
            <label className="block">Due date<input type="date" className={inputClass} value={creating.due_date} onChange={(e) => setCreating({ ...creating, due_date: e.target.value })} /></label>
            <label className="block">Route items to
              <select className={inputClass} value={creating.routing} onChange={(e) => setCreating({ ...creating, routing: e.target.value as 'reviewer' | 'manager' })}>
                <option value="reviewer">One reviewer</option>
                <option value="manager">Each user&apos;s manager (matched by email), otherwise the reviewer</option>
              </select>
            </label>
            <label className="block">{creating.routing === 'manager' ? 'Fallback reviewer' : 'Reviewer'}
              <select className={inputClass} value={creating.reviewer_id} onChange={(e) => setCreating({ ...creating, reviewer_id: e.target.value })}>
                <option value="">Access governance managers only</option>
                {people.map((p) => <option key={p.id} value={p.id}>{[p.first_name, p.last_name].filter(Boolean).join(' ') || p.email}</option>)}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className={secondaryButton} onClick={() => setCreating(null)}>Cancel</button>
            <button type="button" className={primaryButton} disabled={busy || !creating.system_id || !creating.name.trim()}
              onClick={() => run(async () => {
                const res = await erpAPI.createReview({ ...creating, due_date: creating.due_date || undefined, reviewer_id: creating.reviewer_id || undefined });
                setCreating(null);
                const created = res.data?.data as { item_count: number; routing_result?: { routed_to_manager: number; default_reviewer: number } | null };
                const routed = created.routing_result ? ` ${created.routing_result.routed_to_manager} routed to managers, ${created.routing_result.default_reviewer} to the fallback reviewer.` : '';
                return `Review started with ${created.item_count} user(s).${routed}`;
              }, 'Could not start the review')}>
              Start
            </button>
          </div>
        </Modal>
      )}

      {open && (
        <Modal title={`${open.name} (${open.system_name})`} onClose={() => setOpen(null)} wide>
          <div className="flex flex-wrap gap-2 mb-3">
            <button type="button" className={secondaryButton}
              onClick={async () => {
                try {
                  const res = await erpAPI.exportReview(open.id);
                  downloadBlob(res.data as Blob, 'erp-access-review.csv');
                } catch (err: unknown) {
                  setError(errorMessage(err, 'Export failed'));
                }
              }}>
              Export CSV
            </button>
            <label className="flex items-center gap-2 text-sm px-2">
              <input type="checkbox" checked={mine} onChange={(e) => { setMine(e.target.checked); openReview(open.id, e.target.checked); }} />
              Only items assigned to me
            </label>
            {canManage && open.status === 'active' && (
              <button type="button" className={primaryButton} disabled={busy}
                onClick={() => run(async () => {
                  const res = await erpAPI.completeReview(open.id);
                  const done = res.data?.data as { tickets?: { created: number; failed: number; reason?: string } | null };
                  setOpen(null);
                  const t = done.tickets;
                  const tickets = !t ? '' : t.reason ? ` ${t.reason}.` : ` ${t.created} revocation ticket(s) opened${t.failed ? `, ${t.failed} failed (retry from the review)` : ''}.`;
                  return `Review completed and filed as evidence.${tickets}`;
                }, 'Could not complete the review')}>
                Complete review
              </button>
            )}
            {canManage && open.items.some((i) => i.decision === 'revoke' && !i.ticket_key && !i.revocation_verified_at) && (
              <button type="button" className={secondaryButton} disabled={busy}
                onClick={() => run(async () => {
                  const res = await erpAPI.createRevocationTickets(open.id);
                  const t = res.data?.data as { created: number; failed: number; reason?: string };
                  await openReview(open.id);
                  return t.reason || `${t.created} revocation ticket(s) opened${t.failed ? `, ${t.failed} failed` : ''}.`;
                }, 'Could not open tickets')}>
                Open revocation tickets
              </button>
            )}
          </div>
          <div className="max-h-[28rem] overflow-y-auto border border-gray-200 rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase sticky top-0">
                <tr><th className="px-3 py-2">User</th><th className="px-3 py-2">Roles</th><th className="px-3 py-2">Conflicts</th><th className="px-3 py-2">Decision</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {open.items.map((i) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2"><div className="font-medium">{i.username}</div><div className="text-xs text-gray-500">{i.snapshot.full_name} {i.snapshot.department ? `· ${i.snapshot.department}` : ''}</div>
                      {i.reviewer_name && <div className="text-xs text-gray-500">Reviewer: {i.reviewer_name}{i.routed_by === 'manager' ? ' (manager)' : ''}</div>}</td>
                    <td className="px-3 py-2 text-xs">
                      {(i.snapshot.roles || []).map((r) => <div key={r} className={(i.snapshot.privileged_roles || []).includes(r) ? 'text-red-700' : ''}>{r}</div>)}
                    </td>
                    <td className={`px-3 py-2 ${i.snapshot.open_conflicts ? 'text-red-700 font-medium' : ''}`}>{i.snapshot.open_conflicts || 0}</td>
                    <td className="px-3 py-2">
                      {open.status === 'active' ? (
                        <div className="flex gap-1">
                          <button type="button" onClick={() => decide(i, 'certified')} className={`px-2 py-0.5 rounded text-xs border ${i.decision === 'certified' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300'}`}>Certify</button>
                          <button type="button" onClick={() => setRevoking({ item: i, roles: i.roles_to_revoke, notes: i.notes || '' })} className={`px-2 py-0.5 rounded text-xs border ${i.decision === 'revoke' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300'}`}>Revoke</button>
                        </div>
                      ) : <StatusPill status={i.decision} />}
                      {i.decision === 'revoke' && <div className="text-xs text-gray-600 mt-1">{i.roles_to_revoke.join(', ') || 'All access'}{i.revocation_verified_at ? ' · verified' : ' · awaiting import'}</div>}
                      {i.ticket_key && (
                        <div className="text-xs mt-1">
                          Ticket {i.ticket_url ? <a href={i.ticket_url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{i.ticket_key}</a> : i.ticket_key}
                          {i.ticket_status ? ` · ${i.ticket_status}` : ''}
                        </div>
                      )}
                      {i.ticket_error && !i.ticket_key && <div className="text-xs text-red-700 mt-1">Ticket failed: {i.ticket_error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {revoking && (
        <Modal title={`Revoke access for ${revoking.item.username}`} onClose={() => setRevoking(null)}>
          <fieldset className="space-y-1 text-sm mb-3">
            <legend className="mb-1">Roles to remove</legend>
            {(revoking.item.snapshot.roles || []).map((r) => (
              <label key={r} htmlFor={`revoke-${r}`} className="flex items-center gap-2">
                <input id={`revoke-${r}`} type="checkbox" checked={revoking.roles.includes(r)}
                  onChange={(e) => setRevoking({ ...revoking, roles: e.target.checked ? [...revoking.roles, r] : revoking.roles.filter((x) => x !== r) })} />
                {r}
              </label>
            ))}
          </fieldset>
          <label className="block text-sm">Notes (required when removing all access)
            <textarea className={inputClass} rows={2} value={revoking.notes} onChange={(e) => setRevoking({ ...revoking, notes: e.target.value })} />
          </label>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className={secondaryButton} onClick={() => setRevoking(null)}>Cancel</button>
            <button type="button" className={primaryButton} onClick={async () => { await decide(revoking.item, 'revoke', revoking.roles, revoking.notes); setRevoking(null); }}>Record revocation</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
