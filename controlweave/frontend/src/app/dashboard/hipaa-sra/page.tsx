'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/access';
import { hipaaSraAPI } from '@/lib/api';
import { errorMessage, formatDate, inputClass, Modal, primaryButton, secondaryButton } from '@/components/policies/policyShared';

interface AssessmentRow {
  id: string;
  name: string;
  status: 'in_progress' | 'completed' | 'archived';
  created_at: string;
  completed_at: string | null;
  started_by_name: string | null;
  answered: number;
  summary: { total?: number; gaps?: number; required_gaps?: number; risks_created?: number } | null;
}

interface NewAssessmentForm {
  name: string;
  entity_type: string;
  locations: string;
  ephi_systems: string;
  assessor: string;
}

export default function HipaaSraListPage() {
  const { user } = useAuth();
  const router = useRouter();
  const canWrite = hasPermission(user, 'risks.write');
  const [rows, setRows] = useState<AssessmentRow[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<NewAssessmentForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await hipaaSraAPI.list();
      setRows((res.data?.data?.assessments || []) as AssessmentRow[]);
      setAvailable(res.data?.data?.hipaa_available !== false);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load assessments'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form) return;
    setSaving(true);
    setError('');
    try {
      const res = await hipaaSraAPI.create({
        name: form.name.trim(),
        scope: { entity_type: form.entity_type, locations: form.locations, ephi_systems: form.ephi_systems, assessor: form.assessor },
      });
      router.push(`/dashboard/hipaa-sra/${(res.data?.data as { id: string }).id}`);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not start the assessment'));
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">HIPAA Security Risk Assessment</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-3xl">
              The risk analysis required by 45 CFR 164.308(a)(1)(ii)(A). Work through every Security Rule standard and
              implementation specification, record how each is met, score the risk of each gap, document decisions on
              Addressable specifications, and send the resulting risks to your risk register.
            </p>
          </div>
          {canWrite && available && (
            <button
              type="button"
              className={primaryButton}
              onClick={() => setForm({ name: `${new Date().getFullYear()} HIPAA Security Risk Assessment`, entity_type: 'covered_entity', locations: '', ephi_systems: '', assessor: '' })}
            >
              New assessment
            </button>
          )}
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">{error}</div>}
        {!available && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            The HIPAA Security Rule framework is not installed on this deployment. Run the database migrations to add it.
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase">
              <tr>
                <th className="px-4 py-2">Assessment</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Progress</th>
                <th className="px-4 py-2">Gaps</th>
                <th className="px-4 py-2">Started</th>
                <th className="px-4 py-2">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No assessments yet. HIPAA expects the risk analysis to be reviewed at least annually and after significant changes.</td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/hipaa-sra/${row.id}`} className="font-medium text-blue-700 hover:underline">{row.name}</Link>
                    {row.started_by_name && <div className="text-xs text-gray-500">{row.started_by_name}</div>}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${row.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {row.status === 'completed' ? 'Completed' : 'In progress'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-700">{row.answered}{row.summary?.total ? `/${row.summary.total}` : ''} answered</td>
                  <td className="px-4 py-2 text-gray-700">{row.summary ? `${row.summary.gaps ?? 0} (${row.summary.required_gaps ?? 0} required)` : '-'}</td>
                  <td className="px-4 py-2 text-gray-700">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-2 text-gray-700">{formatDate(row.completed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {form && (
          <Modal title="New HIPAA security risk assessment" onClose={() => setForm(null)}>
            <div className="space-y-3">
              <div>
                <label htmlFor="sra-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input id="sra-name" className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label htmlFor="sra-entity" className="block text-sm font-medium text-gray-700 mb-1">Your organization is a</label>
                <select id="sra-entity" className={inputClass} value={form.entity_type} onChange={(e) => setForm({ ...form, entity_type: e.target.value })}>
                  <option value="covered_entity">Covered entity (provider, health plan, clearinghouse)</option>
                  <option value="business_associate">Business associate</option>
                  <option value="hybrid">Hybrid entity</option>
                </select>
              </div>
              <div>
                <label htmlFor="sra-locations" className="block text-sm font-medium text-gray-700 mb-1">Locations in scope</label>
                <input id="sra-locations" className={inputClass} value={form.locations} onChange={(e) => setForm({ ...form, locations: e.target.value })} placeholder="Main clinic, satellite office, remote staff" />
              </div>
              <div>
                <label htmlFor="sra-systems" className="block text-sm font-medium text-gray-700 mb-1">Systems that create, receive, maintain or transmit ePHI</label>
                <textarea id="sra-systems" rows={3} className={inputClass} value={form.ephi_systems} onChange={(e) => setForm({ ...form, ephi_systems: e.target.value })} placeholder="EHR, practice management, email, backups, medical devices" />
              </div>
              <div>
                <label htmlFor="sra-assessor" className="block text-sm font-medium text-gray-700 mb-1">Assessor</label>
                <input id="sra-assessor" className={inputClass} value={form.assessor} onChange={(e) => setForm({ ...form, assessor: e.target.value })} placeholder="Security official or external assessor" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className={secondaryButton} onClick={() => setForm(null)}>Cancel</button>
                <button type="button" className={primaryButton} disabled={saving || form.name.trim().length < 3} onClick={create}>
                  {saving ? 'Starting…' : 'Start assessment'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
}
