// @tier: pro
'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { organizationAPI, complianceGateAPI } from '@/lib/api';
import ConnectorsPanel from '@/components/integrations/ConnectorsPanel';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/access';

interface OrgFramework {
  id: string;
  name: string;
}

function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  if (err instanceof Error) return err.message;
  return 'Failed to generate export snippet.';
}

type ExportFormat = 'curl' | 'github_actions' | 'gitlab_ci';

const DEFAULT_SNIPPET = `curl --fail -H "Authorization: Bearer $SERVICE_ACCOUNT_TOKEN" \\
  "https://your-instance/api/v1/compliance/gate?framework_id=<id>&min_pct=80"`;

function ComplianceAsCodeCard({ organizationId }: { organizationId: string }) {
  const [frameworks, setFrameworks] = useState<OrgFramework[]>([]);
  const [frameworkId, setFrameworkId] = useState('');
  const [minPct, setMinPct] = useState(80);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('curl');
  const [snippet, setSnippet] = useState(DEFAULT_SNIPPET);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    organizationAPI.getFrameworks(organizationId)
      .then(res => setFrameworks(res.data?.data || res.data || []))
      .catch(() => { /* framework dropdown is optional; card still works without it */ });
  }, [organizationId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setExportError(null);
    setCopied(false);
    try {
      const res = await complianceGateAPI.exportSnippet({
        framework_id: frameworkId || undefined,
        min_pct: minPct,
        format: exportFormat
      });
      setSnippet(res.data?.data?.snippet || DEFAULT_SNIPPET);
    } catch (err) {
      setExportError(getErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setExportError('Could not copy to clipboard.');
    }
  };

  return (
    <div className="mb-6 bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="font-semibold text-gray-900">Compliance as Code</h2>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200">
          CI/CD
        </span>
      </div>
      <p className="text-sm text-gray-500">
        Gate your CI/CD pipeline on live compliance status. Call{' '}
        <code className="text-xs bg-gray-100 text-gray-800 px-1 py-0.5 rounded">
          GET /api/v1/compliance/gate?framework_id=&lt;id&gt;&amp;min_pct=&lt;threshold&gt;
        </code>{' '}
        with a service-account token — it returns HTTP 200 when every evaluated framework meets the threshold, or HTTP
        412 otherwise, so <code className="text-xs bg-gray-100 text-gray-800 px-1 py-0.5 rounded">curl --fail</code>{' '}
        breaks the build automatically.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="cac-framework" className="block text-xs font-medium text-gray-600 mb-1">Framework</label>
          <select
            id="cac-framework"
            value={frameworkId}
            onChange={e => setFrameworkId(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5 min-w-[10rem]"
          >
            <option value="">All selected frameworks</option>
            {frameworks.map(fw => (
              <option key={fw.id} value={fw.id}>{fw.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cac-min-pct" className="block text-xs font-medium text-gray-600 mb-1">Threshold (%)</label>
          <input
            id="cac-min-pct"
            type="number"
            min={0}
            max={100}
            value={minPct}
            onChange={e => setMinPct(Number(e.target.value))}
            className="text-sm border border-gray-300 rounded px-2 py-1.5 w-24"
          />
        </div>
        <div>
          <label htmlFor="cac-format" className="block text-xs font-medium text-gray-600 mb-1">Format</label>
          <select
            id="cac-format"
            value={exportFormat}
            onChange={e => setExportFormat(e.target.value as ExportFormat)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5"
          >
            <option value="curl">curl</option>
            <option value="github_actions">GitHub Actions</option>
            <option value="gitlab_ci">GitLab CI</option>
          </select>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {generating ? 'Generating…' : 'Generate snippet'}
        </button>
      </div>
      {exportError && <p className="text-xs text-red-600 mt-2">{exportError}</p>}

      <div className="mt-3 bg-gray-900 rounded-lg p-4 overflow-x-auto relative">
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <pre className="text-xs text-green-400 font-mono leading-relaxed whitespace-pre-wrap">
          <code>{snippet}</code>
        </pre>
      </div>
      <p className="text-xs text-gray-400 mt-2">See docs/COMPLIANCE_AS_CODE.md for the full integration guide.</p>
    </div>
  );
}

export default function IntegrationsPage() {
  const { user } = useAuth();
  const canManage = hasPermission(user, 'settings.manage');

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Integrations Hub</h1>
          <p className="text-sm text-gray-500 mt-1">
            Connect identity providers, ticketing and security tools. Each sync records what the external system
            returned and saves a snapshot as evidence linked to the controls it supports.
          </p>
        </div>

        <ComplianceAsCodeCard organizationId={user?.organizationId || ''} />

        <ConnectorsPanel canManage={canManage} />
      </div>
    </DashboardLayout>
  );
}
