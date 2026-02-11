'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { evidenceAPI, implementationsAPI, integrationsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/access';

interface EvidenceFile {
  id: string;
  file_name: string;
  description: string | null;
  mime_type: string;
  file_size: number;
  tags: string[];
  uploaded_at: string;
  uploaded_by_name: string;
}

interface ControlForLink {
  id: string;
  control_id: string;
  control_code: string;
  control_title: string;
  framework_code: string;
  status: string;
}

export default function EvidencePage() {
  const { user } = useAuth();
  const canWriteEvidence = hasPermission(user, 'evidence.write');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Splunk import state
  const [splunkConfigured, setSplunkConfigured] = useState(false);
  const [splunkModalOpen, setSplunkModalOpen] = useState(false);
  const [splunkImporting, setSplunkImporting] = useState(false);
  const [splunkSearch, setSplunkSearch] = useState('index=main sourcetype=*');
  const [splunkEarliest, setSplunkEarliest] = useState('-24h@h');
  const [splunkLatest, setSplunkLatest] = useState('now');
  const [splunkMaxEvents, setSplunkMaxEvents] = useState(200);
  const [splunkTitle, setSplunkTitle] = useState('');
  const [splunkDescription, setSplunkDescription] = useState('');
  const [splunkTags, setSplunkTags] = useState('');

  // Link modal state
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkEvidenceId, setLinkEvidenceId] = useState('');
  const [controls, setControls] = useState<ControlForLink[]>([]);
  const [controlSearch, setControlSearch] = useState('');
  const [selectedControls, setSelectedControls] = useState<string[]>([]);
  const [controlsLoading, setControlsLoading] = useState(false);
  const [linkNotes, setLinkNotes] = useState('');

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadEvidence();
    loadSplunkConfig();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadEvidence = async () => {
    try {
      const response = await evidenceAPI.getAll({ limit: 100 });
      setEvidence(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load evidence');
    } finally {
      setLoading(false);
    }
  };

  const loadSplunkConfig = async () => {
    try {
      const response = await integrationsAPI.getSplunkConfig();
      setSplunkConfigured(Boolean(response.data?.data?.configured));
    } catch (err) {
      setSplunkConfigured(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    if (files.length) setSelectedFiles(files);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) setSelectedFiles(files);
  };

  const handleUpload = async () => {
    if (!canWriteEvidence) return;
    if (!selectedFiles.length) return;
    setUploading(true);
    setError('');
    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        if (uploadDescription) formData.append('description', uploadDescription);
        if (uploadTags) formData.append('tags', uploadTags);
        await evidenceAPI.upload(formData);
      }
      showToast(`${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} uploaded`);
      setSelectedFiles([]);
      setUploadDescription('');
      setUploadTags('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadEvidence();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSplunkImport = async () => {
    if (!canWriteEvidence) return;
    if (!splunkSearch.trim()) {
      setError('Splunk search query is required');
      return;
    }
    setSplunkImporting(true);
    setError('');
    try {
      const response = await integrationsAPI.importSplunkEvidence({
        search: splunkSearch,
        earliest_time: splunkEarliest || undefined,
        latest_time: splunkLatest || undefined,
        max_events: splunkMaxEvents,
        title: splunkTitle || undefined,
        description: splunkDescription || undefined,
        tags: splunkTags || undefined
      });
      const resultCount = response.data?.data?.result_count || 0;
      showToast(`Splunk import complete (${resultCount} events)`);
      setSplunkModalOpen(false);
      setSplunkTitle('');
      setSplunkDescription('');
      setSplunkTags('');
      await loadEvidence();
    } catch (err: any) {
      setError(err.response?.data?.details || err.response?.data?.error || 'Splunk import failed');
    } finally {
      setSplunkImporting(false);
    }
  };

  const handleDownload = async (evidenceId: string, fileName: string) => {
    try {
      const response = await evidenceAPI.download(evidenceId);
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download file');
    }
  };

  const handleDelete = async (id: string) => {
    if (!canWriteEvidence) return;
    try {
      await evidenceAPI.remove(id);
      showToast('Evidence file deleted');
      setDeleteId(null);
      loadEvidence();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete');
      setDeleteId(null);
    }
  };

  const openLinkModal = async (evidenceId: string) => {
    if (!canWriteEvidence) return;
    setLinkEvidenceId(evidenceId);
    setSelectedControls([]);
    setLinkNotes('');
    setControlSearch('');
    setControlsLoading(true);
    setLinkModalOpen(true);
    try {
      const response = await implementationsAPI.getAll();
      setControls(response.data.data);
    } catch (err) {
      setError('Failed to load controls');
    } finally {
      setControlsLoading(false);
    }
  };

  const handleLink = async () => {
    if (!canWriteEvidence) return;
    if (!selectedControls.length || !linkEvidenceId) return;
    try {
      await evidenceAPI.link(linkEvidenceId, {
        controlIds: selectedControls,
        notes: linkNotes || undefined
      });
      showToast(`Linked to ${selectedControls.length} control${selectedControls.length > 1 ? 's' : ''}`);
      setLinkModalOpen(false);
      loadEvidence();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to link');
    }
  };

  const toggleControlSelection = (controlId: string) => {
    setSelectedControls(prev =>
      prev.includes(controlId)
        ? prev.filter(id => id !== controlId)
        : [...prev, controlId]
    );
  };

  const filteredEvidence = evidence.filter(e =>
    e.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredControls = controls.filter(c =>
    (c.control_code || '').toLowerCase().includes(controlSearch.toLowerCase()) ||
    (c.control_title || '').toLowerCase().includes(controlSearch.toLowerCase())
  );

  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Toast */}
        {toast && (
          <div className="fixed top-6 right-6 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
            {toast}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
        )}

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Evidence</h1>
          <p className="text-gray-600 mt-2">Upload and manage evidence files, then link them to compliance controls</p>
        </div>

        {!canWriteEvidence && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded">
            You have read-only evidence access. Upload, link, import, and delete actions require
            <code className="mx-1">evidence.write</code>.
          </div>
        )}

        {/* Upload Area */}
        {canWriteEvidence && (
          <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="text-lg font-bold text-gray-900">Upload Evidence</h3>
            <button
              onClick={() => {
                if (!splunkConfigured) {
                  setError('Configure Splunk in Settings before importing evidence');
                  return;
                }
                setSplunkModalOpen(true);
              }}
              className="text-sm bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Import from Splunk
            </button>
          </div>

          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors cursor-pointer"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="text-4xl">📁</span>
            <p className="text-gray-600 mt-2">Drag &amp; drop files here, or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Supports PDF, images, Office docs, text (max 50 MB each)</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">Selected files:</p>
              {selectedFiles.map((file, i) => (
                <div key={i} className="flex items-center justify-between bg-purple-50 rounded p-2">
                  <span className="text-sm text-gray-900">{file.name}</span>
                  <span className="text-xs text-gray-500">{formatSize(file.size)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Describe this evidence..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <input
                type="text"
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder="Comma-separated tags..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFiles.length}
            className="mt-4 bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Uploading...' : `Upload ${selectedFiles.length || 0} File${selectedFiles.length !== 1 ? 's' : ''}`}
          </button>
          </div>
        )}

        {/* Evidence Library */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Evidence Library</h3>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search files..."
              className="w-64 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : filteredEvidence.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-purple-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">File</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Uploaded</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEvidence.map((ev) => (
                    <tr key={ev.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span>📄</span>
                          <span className="text-sm font-medium text-gray-900">{ev.file_name}</span>
                        </div>
                        {ev.tags && ev.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {ev.tags.map((tag, i) => (
                              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{tag}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{ev.description || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatSize(ev.file_size)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(ev.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleDownload(ev.id, ev.file_name)}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                          >
                            Download
                          </button>
                          {canWriteEvidence && (
                            <>
                              <button
                                onClick={() => openLinkModal(ev.id)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Link
                              </button>
                              <button
                                onClick={() => setDeleteId(ev.id)}
                                className="text-xs text-red-600 hover:text-red-800 font-medium"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>{searchTerm ? 'No files match your search.' : 'No evidence files uploaded yet.'}</p>
            </div>
          )}
        </div>

        {/* Link to Controls Modal */}
        {linkModalOpen && canWriteEvidence && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setLinkModalOpen(false)}></div>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 z-10">
              <div className="p-6 border-b">
                <h3 className="text-lg font-bold text-gray-900">Link Evidence to Controls</h3>
                <p className="text-sm text-gray-500 mt-1">Select controls to associate with this evidence</p>
              </div>
              <div className="p-6 max-h-80 overflow-y-auto">
                <input
                  type="text"
                  value={controlSearch}
                  onChange={(e) => setControlSearch(e.target.value)}
                  placeholder="Search controls..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md mb-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {controlsLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto"></div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredControls.slice(0, 40).map((ctrl) => (
                      <label key={ctrl.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedControls.includes(ctrl.control_id)}
                          onChange={() => toggleControlSelection(ctrl.control_id)}
                          className="rounded"
                        />
                        <div>
                          <span className="text-sm font-mono text-gray-900">{ctrl.control_code}</span>
                          <span className="text-sm text-gray-600 ml-2">{ctrl.control_title}</span>
                          <span className="text-xs text-gray-400 ml-2">({ctrl.framework_code})</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link Notes</label>
                  <input
                    type="text"
                    value={linkNotes}
                    onChange={(e) => setLinkNotes(e.target.value)}
                    placeholder="Notes about this link..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="p-6 border-t flex justify-between">
                <button onClick={() => setLinkModalOpen(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                  Cancel
                </button>
                <button
                  onClick={handleLink}
                  disabled={!selectedControls.length}
                  className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Link {selectedControls.length} Control{selectedControls.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Splunk Import Modal */}
        {splunkModalOpen && canWriteEvidence && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setSplunkModalOpen(false)}></div>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 z-10">
              <div className="p-6 border-b">
                <h3 className="text-lg font-bold text-gray-900">Import Evidence from Splunk</h3>
                <p className="text-sm text-gray-500 mt-1">Run a Splunk search and save the results as a JSON evidence artifact.</p>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search Query</label>
                  <textarea
                    value={splunkSearch}
                    onChange={(e) => setSplunkSearch(e.target.value)}
                    rows={4}
                    placeholder="index=main sourcetype=* | head 200"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Earliest Time</label>
                    <input
                      type="text"
                      value={splunkEarliest}
                      onChange={(e) => setSplunkEarliest(e.target.value)}
                      placeholder="-24h@h"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Latest Time</label>
                    <input
                      type="text"
                      value={splunkLatest}
                      onChange={(e) => setSplunkLatest(e.target.value)}
                      placeholder="now"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Events</label>
                    <input
                      type="number"
                      min={1}
                      max={2000}
                      value={splunkMaxEvents}
                      onChange={(e) => setSplunkMaxEvents(Number(e.target.value) || 200)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Evidence Title (optional)</label>
                    <input
                      type="text"
                      value={splunkTitle}
                      onChange={(e) => setSplunkTitle(e.target.value)}
                      placeholder="Weekly failed login events"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags (optional)</label>
                    <input
                      type="text"
                      value={splunkTags}
                      onChange={(e) => setSplunkTags(e.target.value)}
                      placeholder="splunk,auth,log-events"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={splunkDescription}
                    onChange={(e) => setSplunkDescription(e.target.value)}
                    placeholder="Context for auditors"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="p-6 border-t flex justify-between">
                <button onClick={() => setSplunkModalOpen(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                  Cancel
                </button>
                <button
                  onClick={handleSplunkImport}
                  disabled={splunkImporting || !splunkSearch.trim()}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {splunkImporting ? 'Importing...' : 'Import to Evidence'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteId && canWriteEvidence && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setDeleteId(null)}></div>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 z-10">
              <h3 className="text-lg font-bold text-gray-900">Delete Evidence?</h3>
              <p className="text-gray-600 mt-2">This will permanently delete this file and remove all links to controls.</p>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button onClick={() => handleDelete(deleteId)} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
