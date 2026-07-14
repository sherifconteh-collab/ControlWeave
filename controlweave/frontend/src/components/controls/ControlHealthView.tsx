// @tier: community
'use client';

import { Fragment, useEffect, useState } from 'react';
import { controlHealthAPI } from '@/lib/api';

type HealthRating = 'strong' | 'good' | 'watch' | 'weak';

interface HealthFactor {
  key: string;
  impact: number;
  detail: string;
}

interface HealthInfo {
  score: number;
  rating: HealthRating;
  factors: HealthFactor[];
}

interface ControlHealthRow {
  id: string;
  control_id: string;
  title: string;
  framework_code: string;
  implementation_status: string;
  health: HealthInfo;
}

interface HealthSummary {
  total: number;
  strong: number;
  good: number;
  watch: number;
  weak: number;
  avg_score: number;
}

const RATING_BADGE_CLASSES: Record<HealthRating, string> = {
  strong: 'bg-green-100 text-green-800',
  good: 'bg-blue-100 text-blue-800',
  watch: 'bg-yellow-100 text-yellow-800',
  weak: 'bg-red-100 text-red-800',
};

const RATING_BAR_CLASSES: Record<HealthRating, string> = {
  strong: 'bg-green-500',
  good: 'bg-blue-500',
  watch: 'bg-yellow-500',
  weak: 'bg-red-500',
};

const RATING_LABELS: Record<HealthRating, string> = {
  strong: 'Strong',
  good: 'Good',
  watch: 'Watch',
  weak: 'Weak',
};

function SummaryTile({ label, value, valueClassName }: { label: string; value: string | number; valueClassName: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClassName}`}>{value}</p>
    </div>
  );
}

export default function ControlHealthView() {
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [controls, setControls] = useState<ControlHealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const response = await controlHealthAPI.getAll();
        const payload = response.data?.data;
        if (!cancelled) {
          setSummary(payload?.summary || null);
          setControls(Array.isArray(payload?.controls) ? payload.controls : []);
        }
      } catch {
        if (!cancelled) setError('Failed to load control health data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse h-20 rounded-lg bg-gray-100" />
          ))}
        </div>
        <div className="animate-pulse h-64 rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <SummaryTile label="Total" value={summary.total} valueClassName="text-gray-900" />
          <SummaryTile label="Strong" value={summary.strong} valueClassName="text-green-600" />
          <SummaryTile label="Good" value={summary.good} valueClassName="text-blue-600" />
          <SummaryTile label="Watch" value={summary.watch} valueClassName="text-yellow-600" />
          <SummaryTile label="Weak" value={summary.weak} valueClassName="text-red-600" />
          <SummaryTile label="Avg Score" value={summary.avg_score} valueClassName="text-purple-600" />
        </div>
      )}

      {controls.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-500">No control health data available yet. Select frameworks and record implementations to compute health.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-purple-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Control</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Framework</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Health</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Score</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {controls.map((control) => {
                  const isExpanded = expandedId === control.id;
                  return (
                    <Fragment key={control.id}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : control.id)}
                      >
                        <td className="px-6 py-4">
                          <div className="text-sm font-mono font-semibold text-gray-900">{control.control_id}</div>
                          <div className="text-xs text-gray-500 truncate max-w-md" title={control.title}>{control.title}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-gray-600">
                          {control.framework_code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">
                          {control.implementation_status.replace(/_/g, ' ')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${RATING_BADGE_CLASSES[control.health.rating]}`}
                            aria-label={`Health rating: ${RATING_LABELS[control.health.rating]}`}
                          >
                            {RATING_LABELS[control.health.rating]}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-24 bg-gray-200 rounded-full h-2"
                              role="progressbar"
                              aria-label={`Control health score ${control.health.score} out of 100`}
                              aria-valuenow={control.health.score}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className={`h-2 rounded-full ${RATING_BAR_CLASSES[control.health.rating]}`}
                                style={{ width: `${Math.min(100, Math.max(0, control.health.score))}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-gray-700">{control.health.score}</span>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 bg-purple-50/40 border-l-4 border-purple-400" onClick={(e) => e.stopPropagation()}>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Scoring Factors</div>
                            {control.health.factors.length === 0 ? (
                              <p className="text-sm text-gray-500">No scoring factors recorded.</p>
                            ) : (
                              <ul role="list" className="space-y-1">
                                {control.health.factors.map((factor) => (
                                  <li key={factor.key} role="listitem" className="flex items-center justify-between text-sm bg-white rounded-md border border-gray-200 px-3 py-2">
                                    <span className="text-gray-700 capitalize">{factor.key.replace(/_/g, ' ')}</span>
                                    <span className="text-gray-600">{factor.detail}</span>
                                    <span className={`font-semibold ${factor.impact > 0 ? 'text-green-600' : factor.impact < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                      {factor.impact > 0 ? `+${factor.impact}` : factor.impact}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
