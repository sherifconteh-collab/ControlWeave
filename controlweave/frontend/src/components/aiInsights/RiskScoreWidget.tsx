// @tier: enterprise
'use client';

import { useCallback, useEffect, useState } from 'react';
import { phase6API } from '@/lib/api';

interface RiskScore {
  overall_risk_score: number;
  risk_grade: string;
  control_implementation_score: number;
  vulnerability_score: number;
  evidence_freshness_score: number;
  assessment_coverage_score: number;
  critical_gaps_count: number;
  high_priority_gaps_count: number;
  unpatched_critical_vulns: number;
  overdue_assessments: number;
  trend_direction: 'improving' | 'declining' | 'stable';
  previous_score: number | null;
  score_change: number | null;
  predicted_score_30d: number;
  predicted_score_60d: number;
  predicted_score_90d: number;
  calculated_at?: string;
}

interface RiskScoreHistoryEntry {
  overall_risk_score: number;
  risk_grade: string;
  calculated_at: string;
  trend_direction: string;
  score_change: number | null;
}

function errorMessage(err: unknown, fallback: string): string {
  const responseError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return responseError || fallback;
}

function safeFixed(value: number | null | undefined, digits = 0): string {
  return typeof value === 'number' && !isNaN(value) ? value.toFixed(digits) : '—';
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const safeScore = typeof score === 'number' && !isNaN(score) ? score : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span>{safeScore.toFixed(0)}</span>
      </div>
      <div
        className="w-full bg-gray-200 rounded-full h-2"
        role="progressbar"
        aria-label={`${label}: ${safeScore.toFixed(0)} out of 100`}
        aria-valuenow={safeScore}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="bg-purple-600 h-2 rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, safeScore))}%` }}
        />
      </div>
    </div>
  );
}

export default function RiskScoreWidget() {
  const [score, setScore] = useState<RiskScore | null>(null);
  const [history, setHistory] = useState<RiskScoreHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const loadLatest = useCallback(async (cancelledRef?: { current: boolean }) => {
    try {
      setLoading(true);
      setError('');
      const [latestRes, historyRes] = await Promise.all([
        phase6API.getLatestRiskScore(),
        phase6API.getRiskScoreHistory({ limit: 10 }),
      ]);
      if (!cancelledRef?.current) {
        setScore(latestRes.data?.data || null);
        setHistory(Array.isArray(historyRes.data?.data) ? historyRes.data.data : []);
      }
    } catch {
      if (!cancelledRef?.current) setError('Failed to load risk score.');
    } finally {
      if (!cancelledRef?.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };
    loadLatest(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadLatest]);

  const calculate = async () => {
    setCalculating(true);
    setError('');
    try {
      await phase6API.calculateRiskScore();
      await loadLatest();
    } catch (err) {
      setError(errorMessage(err, 'Failed to calculate risk score.'));
    } finally {
      setCalculating(false);
    }
  };

  return (
    <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Predictive Risk Score</h2>
          <p className="mt-1 text-xs text-gray-600">
            Deterministic 0-100 risk score from control implementation, vulnerabilities, evidence
            freshness, and assessment coverage. No AI provider required.
          </p>
        </div>
        <button
          type="button"
          onClick={calculate}
          disabled={calculating}
          className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {calculating ? 'Calculating…' : score ? 'Recalculate' : 'Calculate'}
        </button>
      </div>

      <div className="mt-4 flex-1 min-h-[120px]">
        {loading ? (
          <div className="text-xs text-gray-500">Loading…</div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        ) : !score ? (
          <p className="text-xs text-gray-400">No risk score calculated yet. Click Calculate to generate one.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold text-gray-900">{safeFixed(score.overall_risk_score)}</div>
              <div>
                <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                  Grade {score.risk_grade}
                </span>
                <p className="text-xs text-gray-500 mt-1 capitalize">
                  Trend: {score.trend_direction}
                  {score.score_change !== null ? ` (${score.score_change > 0 ? '+' : ''}${score.score_change})` : ''}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ScoreBar label="Control Implementation" score={score.control_implementation_score} />
              <ScoreBar label="Vulnerability Management" score={score.vulnerability_score} />
              <ScoreBar label="Evidence Freshness" score={score.evidence_freshness_score} />
              <ScoreBar label="Assessment Coverage" score={score.assessment_coverage_score} />
            </div>

            <ul className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs" role="list">
              <li role="listitem" className="border border-gray-100 rounded px-2 py-1.5">
                <span className="block text-gray-500">Critical Gaps</span>
                <span className="font-semibold text-gray-900">{score.critical_gaps_count}</span>
              </li>
              <li role="listitem" className="border border-gray-100 rounded px-2 py-1.5">
                <span className="block text-gray-500">High Priority Gaps</span>
                <span className="font-semibold text-gray-900">{score.high_priority_gaps_count}</span>
              </li>
              <li role="listitem" className="border border-gray-100 rounded px-2 py-1.5">
                <span className="block text-gray-500">Unpatched Critical Vulns</span>
                <span className="font-semibold text-gray-900">{score.unpatched_critical_vulns}</span>
              </li>
              <li role="listitem" className="border border-gray-100 rounded px-2 py-1.5">
                <span className="block text-gray-500">Overdue Assessments</span>
                <span className="font-semibold text-gray-900">{score.overdue_assessments}</span>
              </li>
            </ul>

            <p className="text-xs text-gray-500">
              Predicted: 30d {safeFixed(score.predicted_score_30d)} &middot; 60d {safeFixed(score.predicted_score_60d)} &middot; 90d {safeFixed(score.predicted_score_90d)}
            </p>

            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              className="text-xs font-medium text-purple-700 hover:text-purple-900"
            >
              {showHistory ? 'Hide history' : 'Show history'}
            </button>

            {showHistory && (
              history.length === 0 ? (
                <p className="text-xs text-gray-400">No history available yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs" role="list">
                    <thead>
                      <tr role="listitem">
                        <th className="px-2 py-1 text-left font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-500 uppercase">Score</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-500 uppercase">Grade</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-500 uppercase">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {history.map((entry, idx) => (
                        <tr key={`${entry.calculated_at}-${idx}`} role="listitem">
                          <td className="px-2 py-1 text-gray-600">{new Date(entry.calculated_at).toLocaleDateString()}</td>
                          <td className="px-2 py-1 text-gray-900 font-medium">{safeFixed(entry.overall_risk_score)}</td>
                          <td className="px-2 py-1 text-gray-600">{entry.risk_grade}</td>
                          <td className="px-2 py-1 text-gray-600 capitalize">{entry.trend_direction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </section>
  );
}
