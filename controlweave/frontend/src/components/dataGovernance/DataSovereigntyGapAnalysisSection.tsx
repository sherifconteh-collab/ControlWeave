// @tier: enterprise
'use client';

import { useEffect, useState } from 'react';
import { dataSovereigntyAPI } from '@/lib/api';
import { GapAnalysisRow } from './dataSovereigntyTypes';

export default function DataSovereigntyGapAnalysisSection() {
  const [rows, setRows] = useState<GapAnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const response = await dataSovereigntyAPI.getComplianceGapAnalysis();
        if (!cancelled) setRows(Array.isArray(response.data?.data) ? response.data.data : []);
      } catch {
        if (!cancelled) setError('Failed to load compliance gap analysis.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="animate-pulse h-40 rounded bg-gray-100" />;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900">Compliance Gap Analysis</h3>
        <p className="text-xs text-gray-500 mt-1">
          Read-only report of compliance posture across all jurisdictions where your organization operates.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No data available yet. Add jurisdictions to your organization to generate this report.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200" role="list">
            <thead className="bg-gray-50">
              <tr role="listitem">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jurisdiction</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Presence</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Changes</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Critical Changes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((row) => (
                <tr key={row.id} role="listitem">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.jurisdiction_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">{row.presence_type.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">{row.compliance_status.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.pending_regulatory_changes}</td>
                  <td className="px-4 py-3 text-sm">
                    {Number(row.critical_changes) > 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-800">
                        {row.critical_changes}
                      </span>
                    ) : (
                      row.critical_changes
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
