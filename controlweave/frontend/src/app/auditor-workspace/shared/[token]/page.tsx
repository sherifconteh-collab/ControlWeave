'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { auditorWorkspacePublicAPI } from '@/lib/api';

interface AuditorWorkspaceSummary {
  controls_in_scope: number;
  controls_implemented: number;
  open_poam_items: number;
  open_vulnerabilities: number;
  evidence_count: number;
}

interface AuditorWorkspaceEngagement {
  id: string;
  name: string;
  engagement_type: string;
  scope: string | null;
  status: string;
  period_start: string | null;
  period_end: string | null;
}

interface AuditorWorkspaceFinding {
  id: string;
  title: string;
  severity: string;
  status: string;
  recommendation: string | null;
  due_date: string | null;
  created_at: string;
}

interface AuditorWorkspacePbcRequest {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
  created_at: string;
}

interface AuditorWorkspaceEvidenceItem {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

interface AuditorWorkspacePublicData {
  workspace: { name: string; read_only: boolean; expires_at: string };
  summary: AuditorWorkspaceSummary;
  engagement: AuditorWorkspaceEngagement | null;
  findings: AuditorWorkspaceFinding[];
  pbc_requests: AuditorWorkspacePbcRequest[];
  recent_evidence: AuditorWorkspaceEvidenceItem[];
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
};

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-yellow-100 text-yellow-800',
  submitted: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  closed: 'bg-gray-100 text-gray-700',
  remediating: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-green-100 text-green-800',
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
};

function badgeClass(styles: Record<string, string>, key: string): string {
  return styles[key] ?? 'bg-gray-100 text-gray-700';
}

function formatLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  // Use UTC getters (not toLocaleDateString) so server and client render the
  // same string regardless of the runtime's local timezone — avoids Next.js
  // hydration mismatches on this public, unauthenticated page.
  return `${MONTH_ABBREVIATIONS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function AuditorWorkspaceSharedPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<AuditorWorkspacePublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const response = await auditorWorkspacePublicAPI.getPublicWorkspace(token);
        if (cancelled) return;
        if (response?.success && response?.data) {
          setData(response.data);
        } else {
          setNotFound(true);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (token) {
      load();
    } else {
      setNotFound(true);
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <p className="text-sm text-gray-500">Loading auditor workspace...</p>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Not Found</h1>
          <p className="text-sm text-gray-600 mb-6">
            This auditor workspace link could not be found or has expired.
          </p>
          <Link href="/" className="text-purple-600 hover:underline text-sm font-medium">
            Back to ControlWeave
          </Link>
        </div>
      </div>
    );
  }

  const { workspace, summary, engagement, findings, pbc_requests: pbcRequests, recent_evidence: recentEvidence } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h1 className="text-3xl font-extrabold text-gray-900">{workspace.name}</h1>
            {workspace.read_only && (
              <span className="inline-block bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">
                Read-Only
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-8">
            Link expires {formatDate(workspace.expires_at)}
          </p>

          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <StatCard label="Controls in Scope" value={summary.controls_in_scope} />
              <StatCard label="Controls Implemented" value={summary.controls_implemented} />
              <StatCard label="Open POA&M Items" value={summary.open_poam_items} />
              <StatCard label="Open Vulnerabilities" value={summary.open_vulnerabilities} />
              <StatCard label="Evidence Items" value={summary.evidence_count} />
            </div>
          </section>

          {engagement && (
            <section className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Engagement</h2>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-gray-900">{engagement.name}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClass(STATUS_STYLES, engagement.status)}`}>
                    {formatLabel(engagement.status)}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{formatLabel(engagement.engagement_type)}</p>
                {engagement.scope && <p className="text-sm text-gray-600">{engagement.scope}</p>}
                <p className="text-xs text-gray-500">
                  Period: {formatDate(engagement.period_start)} – {formatDate(engagement.period_end)}
                </p>
              </div>
            </section>
          )}

          {findings.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Findings</h2>
              <ul role="list" className="space-y-3">
                {findings.map((finding) => (
                  <li role="listitem" key={finding.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <span className="font-medium text-gray-800 text-sm">{finding.title}</span>
                      <div className="flex gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClass(SEVERITY_STYLES, finding.severity)}`}>
                          {formatLabel(finding.severity)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClass(STATUS_STYLES, finding.status)}`}>
                          {formatLabel(finding.status)}
                        </span>
                      </div>
                    </div>
                    {finding.recommendation && (
                      <p className="text-sm text-gray-600 mb-1">{finding.recommendation}</p>
                    )}
                    <p className="text-xs text-gray-500">Due: {formatDate(finding.due_date)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {pbcRequests.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Prepared by Client Requests</h2>
              <ul role="list" className="space-y-3">
                {pbcRequests.map((pbc) => (
                  <li role="listitem" key={pbc.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <span className="font-medium text-gray-800 text-sm">{pbc.title}</span>
                      <div className="flex gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClass(PRIORITY_STYLES, pbc.priority)}`}>
                          {formatLabel(pbc.priority)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClass(STATUS_STYLES, pbc.status)}`}>
                          {formatLabel(pbc.status)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Due: {formatDate(pbc.due_date)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {recentEvidence.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Evidence</h2>
              <ul role="list" className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {recentEvidence.map((evidence) => (
                  <li
                    role="listitem"
                    key={evidence.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 bg-white text-sm"
                  >
                    <span className="font-medium text-gray-800 truncate">{evidence.file_name}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {evidence.mime_type} · {formatFileSize(evidence.file_size)} · {formatDate(evidence.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
