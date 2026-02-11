'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { reportsAPI } from '@/lib/api';

export default function ReportsPage() {
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState('');

  const downloadReport = async (format: 'pdf' | 'excel') => {
    setGenerating(format);
    setError('');
    try {
      const response = format === 'pdf'
        ? await reportsAPI.downloadPDF()
        : await reportsAPI.downloadExcel();

      const blob = new Blob([response.data], {
        type: format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `compliance-report-${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Report generation is available in ControlWeave Pro. Visit ' + (process.env.NEXT_PUBLIC_PRO_URL || 'https://app.controlweave.io') + ' to learn more.');
      } else {
        setError('Failed to generate report. Please try again.');
      }
      console.error('Report download error:', err);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-2">Generate and download compliance reports for auditors and stakeholders.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PDF Report Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                &#x1F4C4;
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">Compliance Report (PDF)</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Full compliance status report with executive summary, framework breakdown, and detailed control listing. Ideal for board presentations and auditor submissions.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Executive Summary</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Framework Breakdown</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Control Details</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Status Color-Coding</span>
                </div>
                <button
                  onClick={() => downloadReport('pdf')}
                  disabled={generating !== null}
                  className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {generating === 'pdf' ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                      Generating...
                    </span>
                  ) : (
                    'Download PDF Report'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Excel Report Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                &#x1F4CA;
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">Compliance Report (Excel)</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Multi-sheet spreadsheet with summary metrics, per-framework compliance, and all controls with filtering. Ideal for data analysis and custom reporting.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Summary Sheet</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Frameworks Sheet</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Controls Sheet</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Filterable</span>
                </div>
                <button
                  onClick={() => downloadReport('excel')}
                  disabled={generating !== null}
                  className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {generating === 'excel' ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                      Generating...
                    </span>
                  ) : (
                    'Download Excel Report'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tier info */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-800">
            <strong>Starter tier required.</strong> Report generation is available on Starter ($49/mo) and above. Free tier users can view compliance data on the dashboard.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
