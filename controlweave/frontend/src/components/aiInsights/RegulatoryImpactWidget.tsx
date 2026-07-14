// @tier: enterprise
'use client';

import { useCallback, useEffect, useState } from 'react';
import { phase6API } from '@/lib/api';

interface ImpactAssessment {
  id: string;
  framework_code: string;
  change_type: string;
  change_title: string;
  change_description: string;
  impact_score: number | null;
  impact_level: 'low' | 'medium' | 'high' | 'critical' | null;
  business_impact: string | null;
  technical_requirements: string | null;
  gap_analysis: string | null;
  estimated_effort_hours: number | null;
  estimated_cost: number | null;
  regulation_effective_date: string | null;
  compliance_deadline: string | null;
  review_status: string | null;
  review_notes: string | null;
  created_at: string;
}

const CHANGE_TYPES = ['new_law', 'amendment', 'repeal', 'guidance', 'enforcement_action'] as const;

const IMPACT_BADGE_CLASSES: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-700',
};

function errorMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { error?: string; code?: string } } })?.response;
  if (response?.data?.code === 'NO_PROVIDER_CONFIGURED') {
    return 'Configure an AI provider in Settings to use this feature.';
  }
  return response?.data?.error || fallback;
}

export default function RegulatoryImpactWidget() {
  const [assessments, setAssessments] = useState<ImpactAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    frameworkCode: '',
    changeType: 'guidance' as (typeof CHANGE_TYPES)[number],
    changeDescription: '',
    effectiveDate: '',
  });

  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAssessments = useCallback(async (cancelledRef?: { current: boolean }) => {
    try {
      setLoading(true);
      setListError('');
      const response = await phase6API.getRegulatoryImpactAssessments();
      if (!cancelledRef?.current) {
        setAssessments(Array.isArray(response.data?.data) ? response.data.data : []);
      }
    } catch {
      if (!cancelledRef?.current) setListError('Failed to load regulatory impact assessments.');
    } finally {
      if (!cancelledRef?.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };
    loadAssessments(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadAssessments]);

  const submitAnalysis = async () => {
    if (!form.frameworkCode.trim() || !form.changeDescription.trim()) {
      setFormError('Framework code and change description are required.');
      return;
    }
    setAnalyzing(true);
    setFormError('');
    try {
      await phase6API.analyzeRegulatoryImpact({
        frameworkCode: form.frameworkCode.trim(),
        changeType: form.changeType,
        changeDescription: form.changeDescription.trim(),
        effectiveDate: form.effectiveDate || undefined,
      });
      setShowForm(false);
      setForm({ frameworkCode: '', changeType: 'guidance', changeDescription: '', effectiveDate: '' });
      await loadAssessments();
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to analyze regulatory impact. Configure an AI provider in Settings to use this feature.'));
    } finally {
      setAnalyzing(false);
    }
  };

  const review = async (id: string, status: 'approved' | 'rejected') => {
    setBusyId(id);
    try {
      await phase6API.reviewRegulatoryImpactAssessment(id, { status });
      await loadAssessments();
    } catch (err) {
      setListError(errorMessage(err, 'Failed to update assessment review status.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex flex-col md:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Regulatory Impact Analysis</h2>
          <p className="mt-1 text-xs text-gray-600">
            AI-assisted assessment of how a regulatory change affects your frameworks and controls.
            Requires a configured AI provider.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700"
        >
          {showForm ? 'Cancel' : 'Analyze Change'}
        </button>
      </div>

      {showForm && (
        <div className="mt-4 border border-purple-200 bg-purple-50 rounded-lg p-4 space-y-3">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">{formError}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Framework Code</span>
              <input
                type="text"
                value={form.frameworkCode}
                onChange={(e) => setForm((prev) => ({ ...prev, frameworkCode: e.target.value }))}
                placeholder="gdpr, iso_27001, nist_ai_rmf..."
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Change Type</span>
              <select
                value={form.changeType}
                onChange={(e) => setForm((prev) => ({ ...prev, changeType: e.target.value as (typeof CHANGE_TYPES)[number] }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {CHANGE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Effective Date</span>
              <input
                type="date"
                value={form.effectiveDate}
                onChange={(e) => setForm((prev) => ({ ...prev, effectiveDate: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-gray-700">Change Description</span>
              <textarea
                value={form.changeDescription}
                onChange={(e) => setForm((prev) => ({ ...prev, changeDescription: e.target.value }))}
                rows={3}
                placeholder="Describe the regulatory change and what it requires..."
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={submitAnalysis}
              disabled={analyzing}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {analyzing ? 'Analyzing…' : 'Run Analysis'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex-1 min-h-[80px]">
        {loading ? (
          <div className="text-xs text-gray-500">Loading…</div>
        ) : listError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{listError}</div>
        ) : assessments.length === 0 ? (
          <p className="text-xs text-gray-400">No data available. Run an analysis above to assess a regulatory change.</p>
        ) : (
          <ul className="space-y-3" role="list">
            {assessments.map((assessment) => (
              <li key={assessment.id} role="listitem" className="border border-gray-100 rounded-lg p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{assessment.change_title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {assessment.framework_code} &middot; {assessment.change_type.replace('_', ' ')}
                      {assessment.compliance_deadline ? ` &middot; deadline ${new Date(assessment.compliance_deadline).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  {assessment.impact_level && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${IMPACT_BADGE_CLASSES[assessment.impact_level] || 'bg-gray-100 text-gray-600'}`}
                      aria-label={`Impact level: ${assessment.impact_level}`}
                    >
                      {assessment.impact_level}
                    </span>
                  )}
                </div>
                {assessment.business_impact && (
                  <p className="text-xs text-gray-600 mt-2">{assessment.business_impact}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="text-xs text-gray-500">
                    Review: <span className="font-medium text-gray-700 capitalize">{assessment.review_status || 'pending'}</span>
                  </span>
                  {(!assessment.review_status || assessment.review_status === 'pending') && (
                    <>
                      <button
                        type="button"
                        onClick={() => review(assessment.id, 'approved')}
                        disabled={busyId === assessment.id}
                        className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => review(assessment.id, 'rejected')}
                        disabled={busyId === assessment.id}
                        className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
