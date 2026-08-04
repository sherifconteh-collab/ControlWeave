'use client';

import { useState } from 'react';
import { cmdbAPI } from '@/lib/api';

/**
 * Bulk asset import with a real dry run, plus inventory export.
 *
 * CMDB.md described this workflow — including a Dry Run button — for a long
 * time before any of it existed. The two-phase shape is kept because it is the
 * honest one: Analyze writes nothing and reports a verdict per row with the
 * source line number, so an operator can see what a file will do before
 * committing it. Commit is disabled until an analyze has run.
 */

const CATEGORIES = [
  { value: 'hardware', label: 'Hardware' },
  { value: 'software', label: 'Software' },
  { value: 'ai-agents', label: 'AI Agents' },
];

interface AnalyzedRow {
  line: number;
  name: string;
  valid: boolean;
  errors: string[];
}

interface AnalyzeSummary {
  total: number;
  valid: number;
  invalid: number;
  willImport: number;
}

interface AnalyzeResult {
  headers: string[];
  unknownHeaders?: string[];
  rows: AnalyzedRow[];
  summary: AnalyzeSummary | null;
}

function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  return fallback;
}

function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

interface AssetImportPanelProps {
  onImported?: () => void;
}

export default function AssetImportPanel({ onImported }: AssetImportPanelProps) {
  const [category, setCategory] = useState('hardware');
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [committed, setCommitted] = useState<{ imported: number; skipped: number } | null>(null);

  const readFile = async (file: File) => {
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    // A new file invalidates any previous verdict — never let a commit run
    // against an analysis of different content.
    setAnalysis(null);
    setCommitted(null);
    setError('');
  };

  const runAnalyze = async () => {
    setBusy(true); setError(''); setCommitted(null);
    try {
      const res = await cmdbAPI.bulk.analyze(csv);
      setAnalysis(res.data?.data ?? null);
    } catch (err) {
      setAnalysis(null);
      setError(errorMessage(err, 'Could not analyze the file.'));
    } finally {
      setBusy(false);
    }
  };

  const runCommit = async () => {
    setBusy(true); setError('');
    try {
      const res = await cmdbAPI.bulk.commit(csv, category);
      const data = res.data?.data;
      setCommitted({ imported: data?.imported ?? 0, skipped: data?.skipped ?? 0 });
      setAnalysis(null);
      setCsv('');
      setFileName('');
      onImported?.();
    } catch (err) {
      setError(errorMessage(err, 'Import failed. Nothing was written.'));
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await cmdbAPI.bulk.template();
      downloadBlob(res.data as Blob, 'controlweave-asset-import-template.csv');
    } catch { setError('Could not download the template.'); }
  };

  const downloadExport = async () => {
    try {
      const res = await cmdbAPI.bulk.exportCsv(category);
      downloadBlob(res.data as Blob, 'controlweave-asset-inventory.csv');
    } catch { setError('Could not export the inventory.'); }
  };

  const summary = analysis?.summary;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-lg text-gray-900">Bulk import &amp; export</h2>
          <p className="text-sm text-gray-500">
            Export the inventory, edit it, and load it back. The exported columns are
            exactly the ones the importer accepts.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadTemplate}
            className="border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm"
          >
            Download template
          </button>
          <button
            onClick={downloadExport}
            className="border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm"
          >
            Export inventory
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Import as</span>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setCommitted(null); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {CATEGORIES.map((entry) => (
              <option key={entry.value} value={entry.value}>{entry.label}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-gray-700 mb-1">CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) readFile(file); }}
            className="text-sm"
          />
        </label>

        <button
          onClick={runAnalyze}
          disabled={!csv || busy}
          className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Dry run'}
        </button>

        <button
          onClick={runCommit}
          disabled={!analysis || busy || (summary?.willImport ?? 0) === 0}
          title={!analysis ? 'Run a dry run first' : undefined}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Import {summary ? `${summary.willImport} row${summary.willImport === 1 ? '' : 's'}` : ''}
        </button>
      </div>

      {fileName && <p className="text-xs text-gray-500">Loaded: {fileName}</p>}

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
      )}

      {committed && (
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-2 rounded text-sm">
          Imported {committed.imported} asset{committed.imported === 1 ? '' : 's'}
          {committed.skipped > 0 && `, skipped ${committed.skipped} invalid row${committed.skipped === 1 ? '' : 's'}`}.
        </div>
      )}

      {analysis && summary && (
        <div className="space-y-3">
          <div className="flex gap-4 text-sm">
            <span className="text-gray-700">{summary.total} row{summary.total === 1 ? '' : 's'}</span>
            <span className="text-green-700">{summary.valid} valid</span>
            <span className={summary.invalid > 0 ? 'text-red-700' : 'text-gray-400'}>
              {summary.invalid} with errors
            </span>
            <span className="text-gray-500">Nothing has been written yet.</span>
          </div>

          {analysis.unknownHeaders && analysis.unknownHeaders.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 text-amber-800 px-4 py-2 rounded text-sm">
              Ignored unrecognized column{analysis.unknownHeaders.length === 1 ? '' : 's'}:{' '}
              {analysis.unknownHeaders.join(', ')}
            </div>
          )}

          {summary.invalid > 0 && (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Line</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Problem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {analysis.rows.filter((row) => !row.valid).map((row) => (
                    <tr key={row.line}>
                      <td className="px-4 py-2 text-gray-500">{row.line}</td>
                      <td className="px-4 py-2 text-gray-900">{row.name || <em className="text-gray-400">missing</em>}</td>
                      <td className="px-4 py-2 text-red-700">{row.errors.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
