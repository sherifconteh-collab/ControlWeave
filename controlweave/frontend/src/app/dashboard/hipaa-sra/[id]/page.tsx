'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import SraQuestionCard, { SraQuestion } from '@/components/hipaa/SraQuestionCard';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/access';
import { hipaaSraAPI } from '@/lib/api';
import { errorMessage, formatDate, primaryButton, secondaryButton } from '@/components/policies/policyShared';

interface Standard extends SraQuestion {
  answerable: boolean;
  specifications: SraQuestion[];
}

interface Safeguard {
  id: string;
  label: string;
  standards: Standard[];
}

interface Summary {
  total: number;
  answered: number;
  percent_complete: number;
  gaps: number;
  required_gaps: number;
  undecided_addressable: number;
  risk_bands: Record<'low' | 'medium' | 'high' | 'critical', number>;
  by_safeguard: { id: string; label: string; total: number; answered: number; implemented: number }[];
  risks_created?: number;
}

interface Assessment {
  id: string;
  name: string;
  status: 'in_progress' | 'completed' | 'archived';
  scope: { entity_type?: string | null; locations?: string | null; ephi_systems?: string | null; assessor?: string | null };
  created_at: string;
  completed_at: string | null;
  started_by_name: string | null;
}

interface Detail {
  assessment: Assessment;
  safeguards: Safeguard[];
  summary: Summary;
}

const BAND_STYLES: Record<string, string> = {
  low: 'text-green-700',
  medium: 'text-amber-700',
  high: 'text-orange-700',
  critical: 'text-red-700',
};

export default function HipaaSraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canWrite = hasPermission(user, 'risks.write');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [active, setActive] = useState('administrative');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await hipaaSraAPI.get(id);
      setDetail(res.data?.data as Detail);
      setError('');
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load the assessment'));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const complete = async () => {
    setBusy(true);
    setError('');
    try {
      await hipaaSraAPI.complete(id, true);
      await load();
      setVersion((v) => v + 1);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not complete the assessment'));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    try {
      const res = await hipaaSraAPI.exportCsv(id);
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hipaa-security-risk-assessment-${id}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Export failed'));
    }
  };

  if (!detail) {
    return (
      <DashboardLayout>
        <div className="p-6 text-sm">{error ? <span className="text-red-700">{error}</span> : <span className="text-gray-500">Loading…</span>}</div>
      </DashboardLayout>
    );
  }

  const { assessment, safeguards, summary } = detail;
  const readOnly = !canWrite || assessment.status !== 'in_progress';
  const current = safeguards.find((s) => s.id === active) || safeguards[0];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <Link href="/dashboard/hipaa-sra" className="text-sm text-blue-700 hover:underline">&larr; HIPAA risk assessments</Link>
        <div className="flex flex-wrap items-start justify-between gap-4 mt-2 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{assessment.name}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {assessment.status === 'completed' ? `Completed ${formatDate(assessment.completed_at)}` : 'In progress'}
              {assessment.started_by_name ? ` - started by ${assessment.started_by_name}` : ''}
              {assessment.scope?.assessor ? ` - assessor: ${assessment.scope.assessor}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className={secondaryButton} onClick={exportCsv}>Export CSV</button>
            {canWrite && assessment.status === 'in_progress' && (
              <button type="button" className={primaryButton} disabled={busy || summary.answered < summary.total} onClick={complete} title={summary.answered < summary.total ? 'Answer every requirement first' : undefined}>
                {busy ? 'Completing…' : 'Complete and add risks to register'}
              </button>
            )}
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-2xl font-bold text-gray-900">{summary.percent_complete}%</div>
            <div className="text-xs text-gray-600">{summary.answered} of {summary.total} answered</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className={`text-2xl font-bold ${summary.required_gaps ? 'text-red-600' : 'text-gray-900'}`}>{summary.required_gaps}</div>
            <div className="text-xs text-gray-600">Required gaps</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-2xl font-bold text-gray-900">{summary.gaps}</div>
            <div className="text-xs text-gray-600">All gaps</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className={`text-2xl font-bold ${summary.undecided_addressable ? 'text-amber-600' : 'text-gray-900'}`}>{summary.undecided_addressable}</div>
            <div className="text-xs text-gray-600">Addressable decisions missing</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs">
            {(['critical', 'high', 'medium', 'low'] as const).map((band) => (
              <div key={band} className="flex justify-between">
                <span className={`capitalize ${BAND_STYLES[band]}`}>{band}</span>
                <span className="font-semibold">{summary.risk_bands[band]}</span>
              </div>
            ))}
          </div>
        </div>
        {assessment.status === 'completed' && summary.risks_created !== undefined && (
          <p className="text-sm text-gray-700 mb-4">
            {summary.risks_created} risk{summary.risks_created === 1 ? ' was' : 's were'} added to the <Link href="/dashboard/risks" className="text-blue-700 hover:underline">risk register</Link>, tagged hipaa and sra.
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <nav className="space-y-1" aria-label="Safeguards">
            {summary.by_safeguard.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(s.id)}
                aria-current={active === s.id ? 'true' : undefined}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${active === s.id ? 'bg-blue-50 text-blue-800 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <div>{s.label}</div>
                <div className="text-xs text-gray-500">{s.answered}/{s.total} answered</div>
              </button>
            ))}
          </nav>
          <div className="lg:col-span-3 space-y-5">
            {current.standards.map((standard) => (
              <section key={`${standard.id}-${version}`} aria-label={standard.title}>
                {standard.answerable ? (
                  <SraQuestionCard assessmentId={id} question={standard} readOnly={readOnly} onSaved={load} />
                ) : (
                  <>
                    <h2 id={`std-${standard.id}`} className="text-sm font-semibold text-gray-900">
                      {standard.title} <span className="font-normal text-gray-500">({standard.control_id.replace(/^HIPAA-/, '')})</span>
                    </h2>
                    {standard.description && <p className="text-xs text-gray-600 mb-2">{standard.description}</p>}
                    <div className="space-y-3">
                      {standard.specifications.map((spec) => (
                        <SraQuestionCard key={spec.id} assessmentId={id} question={spec} readOnly={readOnly} onSaved={load} />
                      ))}
                    </div>
                  </>
                )}
              </section>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
