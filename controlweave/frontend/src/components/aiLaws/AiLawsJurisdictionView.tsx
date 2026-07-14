// @tier: govcloud
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { stateAiLawsAPI, internationalAiLawsAPI } from '@/lib/api';

export type AiLawsVariant = 'state' | 'international';

interface JurisdictionMeta {
  code: string;
  name: string;
  law: string;
  effective?: string | null;
  fully_applicable?: string | null;
  status: string;
  region?: string;
  authority?: string;
  url?: string | null;
}

interface JurisdictionStats {
  total: number;
  implemented: number;
  in_progress: number;
  not_started: number;
}

interface JurisdictionSummaryEntry extends JurisdictionMeta {
  stats: JurisdictionStats;
}

interface SummaryResponse {
  total_controls: number;
  implemented: number;
  completion_percentage: number;
  jurisdictions_covered?: number;
  jurisdictions: JurisdictionSummaryEntry[];
}

interface LawControl {
  control_id: string;
  title: string;
  description: string;
  priority: string;
  control_type: string;
  jurisdiction: string;
  region?: string | null;
  law?: string | null;
}

interface CrosswalkMapping {
  mapped_control_id: string;
  mapped_title: string;
  mapped_framework: string;
  mapping_type: string;
  mapping_notes: string | null;
}

interface LawControlDetail extends LawControl {
  id: string;
  implementation_status: string | null;
  implementation_notes: string | null;
  implementation_updated_at: string | null;
  jurisdiction_meta?: JurisdictionMeta | null;
  crosswalk_mappings: CrosswalkMapping[];
}

interface Filters {
  jurisdiction: string;
  control_type: string;
  priority: string;
  search: string;
  region: string;
}

const EMPTY_FILTERS: Filters = { jurisdiction: '', control_type: '', priority: '', search: '', region: '' };

function errorMessage(err: unknown, fallback: string): string {
  const responseError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return responseError || fallback;
}

function completionPercentage(stats: JurisdictionStats): number {
  if (!stats.total) return 0;
  return Math.round((stats.implemented / stats.total) * 100);
}

function SummaryCard({ entry }: { entry: JurisdictionSummaryEntry }) {
  const pct = completionPercentage(entry.stats);
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{entry.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{entry.law}</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-700 capitalize">
          {entry.status.replace('_', ' ')}
        </span>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>{pct}% complete</span>
          <span>{entry.stats.total} controls</span>
        </div>
        <div
          className="w-full bg-gray-200 rounded-full h-2"
          role="progressbar"
          aria-label={`${entry.name} implementation ${pct} percent complete`}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
        <div>
          <span className="block text-gray-500">Implemented</span>
          <span className="font-semibold text-green-700">{entry.stats.implemented}</span>
        </div>
        <div>
          <span className="block text-gray-500">In Progress</span>
          <span className="font-semibold text-yellow-700">{entry.stats.in_progress}</span>
        </div>
        <div>
          <span className="block text-gray-500">Not Started</span>
          <span className="font-semibold text-gray-500">{entry.stats.not_started}</span>
        </div>
      </div>
    </div>
  );
}

export default function AiLawsJurisdictionView({ variant }: { variant: AiLawsVariant }) {
  const isInternational = variant === 'international';

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  const [controls, setControls] = useState<LawControl[]>([]);
  const [controlsLoading, setControlsLoading] = useState(true);
  const [controlsError, setControlsError] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LawControlDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const loadSummary = useCallback(async (cancelledRef?: { current: boolean }) => {
    try {
      setSummaryLoading(true);
      setSummaryError('');
      const response = isInternational
        ? await internationalAiLawsAPI.getSummary()
        : await stateAiLawsAPI.getSummary();
      if (!cancelledRef?.current) setSummary(response.data?.data || null);
    } catch {
      if (!cancelledRef?.current) setSummaryError('Failed to load jurisdiction summary.');
    } finally {
      if (!cancelledRef?.current) setSummaryLoading(false);
    }
  }, [isInternational]);

  const loadControls = useCallback(async (cancelledRef?: { current: boolean }) => {
    try {
      setControlsLoading(true);
      setControlsError('');
      const response = isInternational
        ? await internationalAiLawsAPI.getControls({
            jurisdiction: filters.jurisdiction || undefined,
            region: filters.region || undefined,
            control_type: filters.control_type || undefined,
            priority: filters.priority || undefined,
            search: filters.search || undefined,
          })
        : await stateAiLawsAPI.getControls({
            jurisdiction: filters.jurisdiction || undefined,
            control_type: filters.control_type || undefined,
            priority: filters.priority || undefined,
            search: filters.search || undefined,
          });
      if (!cancelledRef?.current) setControls(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch {
      if (!cancelledRef?.current) setControlsError('Failed to load controls.');
    } finally {
      if (!cancelledRef?.current) setControlsLoading(false);
    }
  }, [filters, isInternational]);

  useEffect(() => {
    const cancelledRef = { current: false };
    loadSummary(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadSummary]);

  useEffect(() => {
    const cancelledRef = { current: false };
    loadControls(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadControls]);

  const openDetail = useCallback(async (controlId: string) => {
    setSelectedControlId(controlId);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const response = isInternational
        ? await internationalAiLawsAPI.getControl(controlId)
        : await stateAiLawsAPI.getControl(controlId);
      setDetail(response.data?.data || null);
    } catch (err) {
      setDetailError(errorMessage(err, 'Failed to load control detail.'));
    } finally {
      setDetailLoading(false);
    }
  }, [isInternational]);

  const closeDetail = () => {
    setSelectedControlId(null);
    setDetail(null);
    setDetailError('');
  };

  const regionOptions = useMemo(() => {
    if (!isInternational || !summary) return [];
    const regions = summary.jurisdictions.map((j) => j.region).filter((r): r is string => Boolean(r));
    return Array.from(new Set(regions)).sort();
  }, [isInternational, summary]);

  return (
    <div className="space-y-6">
      <div>
        {summaryLoading ? (
          <div className="animate-pulse h-32 rounded bg-gray-100" />
        ) : summaryError ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{summaryError}</div>
        ) : !summary || summary.jurisdictions.length === 0 ? (
          <p className="text-sm text-gray-500">No data available for this jurisdiction pack yet.</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-600">
                {summary.implemented} of {summary.total_controls} controls implemented
                ({summary.completion_percentage}%)
                {typeof summary.jurisdictions_covered === 'number' ? ` across ${summary.jurisdictions_covered} jurisdictions` : ''}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {summary.jurisdictions.map((entry) => (
                <SummaryCard key={entry.code} entry={entry} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-gray-900">Controls</h3>
        <div className={`grid grid-cols-1 md:grid-cols-2 ${isInternational ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Jurisdiction</span>
            <select
              value={filters.jurisdiction}
              onChange={(e) => setFilters((prev) => ({ ...prev, jurisdiction: e.target.value }))}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">All jurisdictions</option>
              {(summary?.jurisdictions || []).map((j) => (
                <option key={j.code} value={j.code}>{j.name} ({j.code})</option>
              ))}
            </select>
          </label>
          {isInternational && (
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Region</span>
              <select
                value={filters.region}
                onChange={(e) => setFilters((prev) => ({ ...prev, region: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">All regions</option>
                {regionOptions.map((region) => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Control Type</span>
            <input
              type="text"
              value={filters.control_type}
              onChange={(e) => setFilters((prev) => ({ ...prev, control_type: e.target.value }))}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Priority</span>
            <input
              type="text"
              value={filters.priority}
              onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Search</span>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Title, description, control ID..."
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </label>
        </div>

        {controlsLoading ? (
          <div className="animate-pulse h-24 rounded bg-gray-100" />
        ) : controlsError ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{controlsError}</div>
        ) : controls.length === 0 ? (
          <p className="text-sm text-gray-500">No data available for this jurisdiction yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200" role="list">
              <thead className="bg-gray-50">
                <tr role="listitem">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Control</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jurisdiction</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {controls.map((control) => (
                  <tr
                    key={control.control_id}
                    role="listitem"
                    onClick={() => openDetail(control.control_id)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium text-gray-900">{control.control_id}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{control.title}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{control.jurisdiction}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{control.control_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{control.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedControlId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{selectedControlId}</h3>
              <button type="button" onClick={closeDetail} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl leading-none">
                &times;
              </button>
            </div>
            {detailLoading ? (
              <div className="animate-pulse h-32 rounded bg-gray-100" />
            ) : detailError ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{detailError}</div>
            ) : detail ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{detail.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{detail.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="block text-gray-500">Jurisdiction</span>
                    <span className="font-medium text-gray-800">{detail.jurisdiction}</span>
                  </div>
                  <div>
                    <span className="block text-gray-500">Priority</span>
                    <span className="font-medium text-gray-800">{detail.priority}</span>
                  </div>
                  <div>
                    <span className="block text-gray-500">Control Type</span>
                    <span className="font-medium text-gray-800">{detail.control_type}</span>
                  </div>
                  <div>
                    <span className="block text-gray-500">Implementation Status</span>
                    <span className="font-medium text-gray-800 capitalize">
                      {(detail.implementation_status || 'not_started').replace('_', ' ')}
                    </span>
                  </div>
                </div>
                {detail.implementation_notes && (
                  <div>
                    <span className="block text-xs text-gray-500">Implementation Notes</span>
                    <p className="text-sm text-gray-700 mt-1">{detail.implementation_notes}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">NIST Crosswalk Mappings</p>
                  {detail.crosswalk_mappings.length === 0 ? (
                    <p className="text-sm text-gray-500">No crosswalk mappings recorded for this control.</p>
                  ) : (
                    <ul className="space-y-2" role="list">
                      {detail.crosswalk_mappings.map((mapping, idx) => (
                        <li key={`${mapping.mapped_control_id}-${idx}`} role="listitem" className="border border-gray-100 rounded px-3 py-2 text-sm">
                          <span className="font-medium text-gray-900">{mapping.mapped_control_id}</span>
                          <span className="text-gray-500"> — {mapping.mapped_title}</span>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {mapping.mapped_framework} &middot; {mapping.mapping_type}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
