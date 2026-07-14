// @tier: enterprise
'use client';

import { useCallback, useEffect, useState } from 'react';
import { phase6API } from '@/lib/api';

interface RemediationPlan {
  id: string;
  plan_name: string;
  plan_type: string;
  control_id: string | null;
  vulnerability_id: string | null;
  impact_assessment_id: string | null;
  priority_score: number | null;
  priority_level: 'low' | 'medium' | 'high' | 'critical' | null;
  risk_reduction: number | null;
  estimated_hours: number | null;
  estimated_cost: number | null;
  current_state: string | null;
  target_state: string | null;
  success_criteria: string | null;
  status: string;
  completion_percentage: number | null;
  created_at: string;
}

const STATUSES = ['draft', 'approved', 'in_progress', 'completed', 'cancelled'] as const;

const PRIORITY_BADGE_CLASSES: Record<string, string> = {
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

export default function RemediationPlansWidget() {
  const [plans, setPlans] = useState<RemediationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ controlId: '', vulnerabilityId: '', impactAssessmentId: '' });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, { status: string; completionPercentage: number }>>({});

  const loadPlans = useCallback(async (cancelledRef?: { current: boolean }) => {
    try {
      setLoading(true);
      setListError('');
      const response = await phase6API.getRemediationPlans();
      const data: RemediationPlan[] = Array.isArray(response.data?.data) ? response.data.data : [];
      if (!cancelledRef?.current) {
        setPlans(data);
        setStatusDrafts(
          data.reduce((acc, plan) => {
            acc[plan.id] = { status: plan.status, completionPercentage: plan.completion_percentage || 0 };
            return acc;
          }, {} as Record<string, { status: string; completionPercentage: number }>)
        );
      }
    } catch {
      if (!cancelledRef?.current) setListError('Failed to load remediation plans.');
    } finally {
      if (!cancelledRef?.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };
    loadPlans(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadPlans]);

  const submitGenerate = async () => {
    if (!form.controlId.trim() && !form.vulnerabilityId.trim() && !form.impactAssessmentId.trim()) {
      setFormError('Provide at least one of Control ID, Vulnerability ID, or Impact Assessment ID.');
      return;
    }
    setGenerating(true);
    setFormError('');
    try {
      await phase6API.generateRemediationPlan({
        controlId: form.controlId.trim() || undefined,
        vulnerabilityId: form.vulnerabilityId.trim() || undefined,
        impactAssessmentId: form.impactAssessmentId.trim() || undefined,
      });
      setShowForm(false);
      setForm({ controlId: '', vulnerabilityId: '', impactAssessmentId: '' });
      await loadPlans();
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to generate remediation plan. Configure an AI provider in Settings to use this feature.'));
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (id: string) => {
    const draft = statusDrafts[id];
    if (!draft) return;
    setBusyId(id);
    try {
      await phase6API.updateRemediationPlanStatus(id, {
        status: draft.status,
        completionPercentage: draft.completionPercentage,
      });
      await loadPlans();
    } catch (err) {
      setListError(errorMessage(err, 'Failed to update remediation plan status.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex flex-col md:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Smart Remediation Plans</h2>
          <p className="mt-1 text-xs text-gray-600">
            AI-generated remediation plans for control gaps, vulnerabilities, or regulatory impact
            assessments. Requires a configured AI provider.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700"
        >
          {showForm ? 'Cancel' : 'Generate Plan'}
        </button>
      </div>

      {showForm && (
        <div className="mt-4 border border-purple-200 bg-purple-50 rounded-lg p-4 space-y-3">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">{formError}</div>
          )}
          <p className="text-xs text-gray-600">Provide at least one identifier to generate a plan.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Control ID</span>
              <input
                type="text"
                value={form.controlId}
                onChange={(e) => setForm((prev) => ({ ...prev, controlId: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Vulnerability ID</span>
              <input
                type="text"
                value={form.vulnerabilityId}
                onChange={(e) => setForm((prev) => ({ ...prev, vulnerabilityId: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Impact Assessment ID</span>
              <input
                type="text"
                value={form.impactAssessmentId}
                onChange={(e) => setForm((prev) => ({ ...prev, impactAssessmentId: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={submitGenerate}
              disabled={generating}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {generating ? 'Generating…' : 'Generate Plan'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex-1 min-h-[80px]">
        {loading ? (
          <div className="text-xs text-gray-500">Loading…</div>
        ) : listError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{listError}</div>
        ) : plans.length === 0 ? (
          <p className="text-xs text-gray-400">No data available. Generate a plan above to get started.</p>
        ) : (
          <ul className="space-y-3" role="list">
            {plans.map((plan) => {
              const draft = statusDrafts[plan.id] || { status: plan.status, completionPercentage: plan.completion_percentage || 0 };
              return (
                <li key={plan.id} role="listitem" className="border border-gray-100 rounded-lg p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{plan.plan_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 capitalize">{plan.plan_type.replace('_', ' ')}</p>
                    </div>
                    {plan.priority_level && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PRIORITY_BADGE_CLASSES[plan.priority_level] || 'bg-gray-100 text-gray-600'}`}
                        aria-label={`Priority: ${plan.priority_level}`}
                      >
                        {plan.priority_level}
                      </span>
                    )}
                  </div>
                  {plan.target_state && (
                    <p className="text-xs text-gray-600 mt-2"><span className="font-medium">Target state:</span> {plan.target_state}</p>
                  )}
                  <div
                    className="w-full bg-gray-200 rounded-full h-2 mt-3"
                    role="progressbar"
                    aria-label={`${plan.plan_name} completion ${draft.completionPercentage} percent`}
                    aria-valuenow={draft.completionPercentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, draft.completionPercentage))}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <select
                      value={draft.status}
                      onChange={(e) =>
                        setStatusDrafts((prev) => ({ ...prev, [plan.id]: { ...draft, status: e.target.value } }))
                      }
                      className="text-xs px-2 py-1 border border-gray-300 rounded-md"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.completionPercentage}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setStatusDrafts((prev) => ({
                          ...prev,
                          [plan.id]: { ...draft, completionPercentage: isNaN(val) ? 0 : Math.min(100, Math.max(0, val)) },
                        }));
                      }}
                      aria-label={`Completion percentage for ${plan.plan_name}`}
                      className="w-16 text-xs px-2 py-1 border border-gray-300 rounded-md"
                    />
                    <span className="text-xs text-gray-500">%</span>
                    <button
                      type="button"
                      onClick={() => updateStatus(plan.id)}
                      disabled={busyId === plan.id}
                      className="px-2 py-1 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                      Update
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
