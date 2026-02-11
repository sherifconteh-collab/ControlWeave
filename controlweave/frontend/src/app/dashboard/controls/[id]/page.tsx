'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { controlsAPI, implementationsAPI, usersAPI, aiAPI, assessmentsAPI, evidenceAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/access';

interface Implementation {
  id: string;
  status: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  due_date: string | null;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  status_history: StatusHistoryEntry[];
  evidence: EvidenceItem[];
}

interface StatusHistoryEntry {
  id: string;
  old_status: string;
  new_status: string;
  notes: string | null;
  changed_at: string;
  changed_by_name: string;
}

interface EvidenceItem {
  id: string;
  file_name: string;
  description: string | null;
  mime_type: string;
  uploaded_at: string;
  link_notes: string | null;
  uploaded_by_name: string;
}

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

interface OrgUser {
  id: string;
  email: string;
  full_name: string;
}

const VALID_STATUSES = [
  { value: 'not_started', label: 'Not Started', color: 'bg-gray-100 text-gray-800' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'implemented', label: 'Implemented', color: 'bg-green-100 text-green-800' },
  { value: 'verified', label: 'Verified', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'not_applicable', label: 'Not Applicable', color: 'bg-purple-100 text-purple-800' },
];

const TEST_RESULT_STATUS_META: Record<string, { label: string; color: string }> = {
  not_assessed: { label: 'Not Tested', color: 'bg-gray-100 text-gray-700' },
  satisfied: { label: 'Compliant', color: 'bg-green-100 text-green-800' },
  other_than_satisfied: { label: 'Non-compliant', color: 'bg-red-100 text-red-800' },
  not_applicable: { label: 'N/A', color: 'bg-purple-100 text-purple-800' },
};

function getStatusInfo(status: string) {
  return VALID_STATUSES.find(s => s.value === status) || VALID_STATUSES[0];
}

function getTestResultInfo(status: string) {
  return TEST_RESULT_STATUS_META[status] || TEST_RESULT_STATUS_META.not_assessed;
}

function getPriorityLabel(priority: string | number) {
  const p = Number(priority);
  if (p >= 3) return { label: 'Critical', color: 'bg-red-100 text-red-800' };
  if (p === 2) return { label: 'High', color: 'bg-orange-100 text-orange-800' };
  if (p === 1) return { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' };
  return { label: 'Low', color: 'bg-blue-100 text-blue-800' };
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDatetime(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ControlDetailPage() {
  const { user } = useAuth();
  const canUpdateImplementation = hasPermission(user, 'implementations.write');
  const canWriteEvidence = hasPermission(user, 'evidence.write');
  const canUseAI = hasPermission(user, 'ai.use');
  const canWriteAssessments = hasPermission(user, 'assessments.write');
  const params = useParams();
  const id = params.id as string;

  const [controlData, setControlData] = useState<any>(null);
  const [implementation, setImplementation] = useState<Implementation | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const [assignedUserId, setAssignedUserId] = useState<string>('');
  const [dueDate, setDueDate] = useState('');

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null); // tracks which AI feature is loading

  // Assessment procedures state
  const [assessmentProcedures, setAssessmentProcedures] = useState<any[]>([]);
  const [procedureEditors, setProcedureEditors] = useState<Record<string, boolean>>({});
  const [procedureDrafts, setProcedureDrafts] = useState<Record<string, any>>({});
  const [procedureSavingId, setProcedureSavingId] = useState<string | null>(null);
  const [rollupSaving, setRollupSaving] = useState<string | null>(null);

  // Evidence linking
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [evidenceLibrary, setEvidenceLibrary] = useState<EvidenceFile[]>([]);
  const [evidenceSearch, setEvidenceSearch] = useState('');
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceAction, setEvidenceAction] = useState<string | null>(null);
  const [evidenceLinkNotes, setEvidenceLinkNotes] = useState('');
  const [evidenceUploadFile, setEvidenceUploadFile] = useState<File | null>(null);
  const [evidenceUploadDescription, setEvidenceUploadDescription] = useState('');
  const [evidenceUploadTags, setEvidenceUploadTags] = useState('');

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadData = async () => {
    try {
      const [controlRes, implListRes, usersRes] = await Promise.all([
        controlsAPI.getControl(id),
        implementationsAPI.getAll({ controlId: id }),
        usersAPI.getOrgUsers()
      ]);

      setControlData(controlRes.data.data);
      setOrgUsers(usersRes.data.data);

      const implList = implListRes.data.data;
      if (implList && implList.length > 0) {
        const implDetailRes = await implementationsAPI.getById(implList[0].id);
        const impl = implDetailRes.data.data;
        setImplementation(impl);
        setSelectedStatus(impl.status);
        setAssignedUserId(impl.assigned_to || '');
        setDueDate(impl.due_date ? impl.due_date.split('T')[0] : '');
      } else if (canUpdateImplementation) {
        // Create a baseline implementation record so assignment/status/evidence linking works.
        const ensured = await implementationsAPI.ensureForControl(id);
        const implDetailRes = await implementationsAPI.getById(ensured.data.data.id);
        const impl = implDetailRes.data.data;
        setImplementation(impl);
        setSelectedStatus(impl.status || 'not_started');
        setAssignedUserId(impl.assigned_to || '');
        setDueDate(impl.due_date ? impl.due_date.split('T')[0] : '');
      } else {
        setImplementation(null);
        setSelectedStatus('not_started');
        setAssignedUserId('');
        setDueDate('');
      }

      // Load assessment procedures for this control
      try {
        const procRes = await assessmentsAPI.getProceduresByControl(id);
        setAssessmentProcedures(procRes.data.data.procedures || []);
      } catch {
        // Assessment procedures may not exist for all controls - that's OK
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load control');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refreshProcedures = async () => {
    const procRes = await assessmentsAPI.getProceduresByControl(id);
    setAssessmentProcedures(procRes.data.data.procedures || []);
  };

  const testResultCounts = useMemo(() => {
    const counts: Record<string, number> = {
      not_assessed: 0,
      satisfied: 0,
      other_than_satisfied: 0,
      not_applicable: 0,
    };

    assessmentProcedures.forEach((proc) => {
      const status = String(proc?.result_status || 'not_assessed');
      if (Object.prototype.hasOwnProperty.call(counts, status)) {
        counts[status] += 1;
      } else {
        counts.not_assessed += 1;
      }
    });

    return counts;
  }, [assessmentProcedures]);

  const rollupTestStatus = useMemo(() => {
    const total = assessmentProcedures.length;
    if (total === 0) return { status: 'not_assessed', incomplete: false };

    if (testResultCounts.other_than_satisfied > 0) return { status: 'other_than_satisfied', incomplete: testResultCounts.not_assessed > 0 };
    if (testResultCounts.not_applicable === total) return { status: 'not_applicable', incomplete: false };
    if (testResultCounts.satisfied > 0) return { status: 'satisfied', incomplete: testResultCounts.not_assessed > 0 };
    return { status: 'not_assessed', incomplete: false };
  }, [assessmentProcedures.length, testResultCounts]);

  const applyRollupTestStatus = async (nextStatus: 'satisfied' | 'other_than_satisfied' | 'not_applicable') => {
    if (!canWriteAssessments) return;
    if (assessmentProcedures.length === 0) return;

    setRollupSaving(nextStatus);
    setError('');
    try {
      await Promise.all(
        assessmentProcedures.map((proc) =>
          assessmentsAPI.recordResult({
            procedure_id: String(proc.id),
            status: nextStatus
          })
        )
      );
      showToast('Test results updated');
      await refreshProcedures();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update test results');
    } finally {
      setRollupSaving(null);
    }
  };

  const toggleProcedureEditor = (proc: any) => {
    const procId = String(proc.id);
    setProcedureEditors((prev) => ({ ...prev, [procId]: !prev[procId] }));
    setProcedureDrafts((prev) => {
      if (prev[procId]) return prev;
      return {
        ...prev,
        [procId]: {
          status: proc.result_status || 'not_assessed',
          risk_level: proc.risk_level || '',
          finding: proc.finding || '',
          evidence_collected: proc.evidence_collected || '',
          remediation_required: false,
          remediation_deadline: ''
        }
      };
    });
  };

  const updateProcedureDraft = (procId: string, patch: Record<string, any>) => {
    setProcedureDrafts((prev) => ({
      ...prev,
      [procId]: {
        ...(prev[procId] || {}),
        ...patch
      }
    }));
  };

  const saveProcedureResult = async (procId: string) => {
    if (!canWriteAssessments) return;
    const draft = procedureDrafts[procId];
    if (!draft) return;

    setProcedureSavingId(procId);
    setError('');
    try {
      await assessmentsAPI.recordResult({
        procedure_id: procId,
        status: draft.status,
        finding: draft.finding || undefined,
        evidence_collected: draft.evidence_collected || undefined,
        risk_level: draft.risk_level || undefined,
        remediation_required: Boolean(draft.remediation_required),
        remediation_deadline: draft.remediation_deadline || undefined
      });
      showToast('Test result saved');
      await refreshProcedures();
      setProcedureEditors((prev) => ({ ...prev, [procId]: false }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save test result');
    } finally {
      setProcedureSavingId(null);
    }
  };

  const loadEvidenceLibrary = async (search?: string) => {
    setEvidenceLoading(true);
    setError('');
    try {
      const response = await evidenceAPI.getAll({
        search: (search ?? evidenceSearch).trim() || undefined,
        limit: 80
      });
      setEvidenceLibrary(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load evidence library');
    } finally {
      setEvidenceLoading(false);
    }
  };

  const openEvidenceModal = async () => {
    setEvidenceModalOpen(true);
    await loadEvidenceLibrary('');
  };

  const linkEvidence = async (evidenceId: string) => {
    if (!canWriteEvidence) return;
    setEvidenceAction(`link:${evidenceId}`);
    setError('');
    try {
      await evidenceAPI.link(evidenceId, { controlIds: [id], notes: evidenceLinkNotes || undefined });
      showToast('Evidence linked');
      setEvidenceLinkNotes('');
      await loadData();
      await loadEvidenceLibrary();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to link evidence');
    } finally {
      setEvidenceAction(null);
    }
  };

  const unlinkEvidence = async (evidenceId: string) => {
    if (!canWriteEvidence) return;
    setEvidenceAction(`unlink:${evidenceId}`);
    setError('');
    try {
      await evidenceAPI.unlink(evidenceId, id);
      showToast('Evidence unlinked');
      await loadData();
      await loadEvidenceLibrary();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to unlink evidence');
    } finally {
      setEvidenceAction(null);
    }
  };

  const uploadAndLinkEvidence = async () => {
    if (!canWriteEvidence) return;
    if (!evidenceUploadFile) return;

    setEvidenceAction('upload');
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', evidenceUploadFile);
      if (evidenceUploadDescription.trim()) formData.append('description', evidenceUploadDescription.trim());
      if (evidenceUploadTags.trim()) formData.append('tags', evidenceUploadTags.trim());

      const uploadRes = await evidenceAPI.upload(formData);
      const newEvidenceId = uploadRes.data.data.id;

      await evidenceAPI.link(newEvidenceId, { controlIds: [id], notes: evidenceLinkNotes || undefined });
      showToast('Evidence uploaded and linked');
      setEvidenceUploadFile(null);
      setEvidenceUploadDescription('');
      setEvidenceUploadTags('');
      setEvidenceLinkNotes('');
      await loadData();
      await loadEvidenceLibrary();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload/link evidence');
    } finally {
      setEvidenceAction(null);
    }
  };

  const handleStatusUpdate = async () => {
    if (!canUpdateImplementation) return;
    if (!implementation || selectedStatus === implementation.status) return;
    setUpdating(true);
    setError('');
    try {
      await implementationsAPI.updateStatus(implementation.id, {
        status: selectedStatus,
        notes: statusNotes || undefined
      });
      showToast(`Status updated to "${getStatusInfo(selectedStatus).label}"`);
      setStatusNotes('');
      setUpdating(false);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update status');
      setUpdating(false);
    }
  };

  const handleAssignment = async () => {
    if (!canUpdateImplementation) return;
    if (!implementation) return;
    setUpdating(true);
    setError('');
    try {
      await implementationsAPI.assign(implementation.id, {
        assignedTo: assignedUserId || null,
        dueDate: dueDate || null
      });
      showToast('Assignment updated');
      setUpdating(false);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update assignment');
      setUpdating(false);
    }
  };

  const handleReview = async () => {
    if (!canUpdateImplementation) return;
    if (!implementation) return;
    setUpdating(true);
    try {
      await implementationsAPI.review(implementation.id, {
        notes: statusNotes || undefined,
        stillApplicable: true,
        evidenceUpdated: (implementation.evidence || []).length > 0
      });
      showToast('Review recorded');
      setStatusNotes('');
      setUpdating(false);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to record review');
      setUpdating(false);
    }
  };

  const runAI = async (feature: string) => {
    if (!canUseAI) return;
    setAiLoading(feature);
    setAiAnalysis(null);
    try {
      let res;
      if (feature === 'analyze') res = await aiAPI.analyzeControl(id);
      else if (feature === 'test') res = await aiAPI.testProcedures(id);
      else if (feature === 'remediation') res = await aiAPI.remediationPlaybook(id);
      else if (feature === 'evidence') res = await aiAPI.evidenceSuggest(id);
      else return;
      setAiAnalysis(res.data.data.result);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'AI analysis failed');
    } finally {
      setAiLoading(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error && !controlData) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      </DashboardLayout>
    );
  }

  const statusInfo = implementation ? getStatusInfo(implementation.status) : getStatusInfo('not_started');
  const priorityInfo = controlData ? getPriorityLabel(controlData.priority) : getPriorityLabel(0);
  const linkedEvidenceIds = new Set((implementation?.evidence || []).map((ev) => ev.id));

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

        {/* Breadcrumb */}
        <div className="flex items-center text-sm text-gray-600">
          <Link href="/dashboard/controls" className="hover:text-purple-600">Controls</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900 font-medium">
            {controlData?.control_id || controlData?.controlId || id}
          </span>
        </div>

        {/* Control Header */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">
                  {controlData?.control_id || controlData?.controlId}
                </h1>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${priorityInfo.color}`}>
                  {priorityInfo.label} Priority
                </span>
              </div>
              <h2 className="text-lg font-semibold text-gray-700 mt-2">
                {controlData?.title}
              </h2>
              <p className="text-gray-600 mt-1">
                {controlData?.description}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block bg-purple-50 text-purple-700 px-3 py-1 rounded text-sm font-medium">
                {controlData?.framework_code || controlData?.frameworkCode}
              </span>
              <p className="text-xs text-gray-500 mt-1">
                {controlData?.framework_name || controlData?.frameworkName}
              </p>
            </div>
          </div>
        </div>

        {/* AI Analysis Buttons */}
        {canUseAI && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-bold text-gray-700">AI Tools:</span>
              {[
                { id: 'analyze', label: 'Gap Analysis', icon: '🔍' },
                { id: 'test', label: 'Test Procedures', icon: '🧪' },
                { id: 'remediation', label: 'Remediation Playbook', icon: '🔧' },
                { id: 'evidence', label: 'Evidence Suggestions', icon: '📎' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => runAI(btn.id)}
                  disabled={!!aiLoading}
                  className="px-3 py-1.5 text-sm bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100 disabled:opacity-50 transition-colors"
                >
                  {aiLoading === btn.id ? (
                    <span className="flex items-center gap-1">
                      <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></span>
                      Analyzing...
                    </span>
                  ) : (
                    <>{btn.icon} {btn.label}</>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI Results */}
        {aiAnalysis && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-900">AI Analysis Results</h3>
              <div className="flex gap-2">
                <button onClick={() => navigator.clipboard.writeText(aiAnalysis)} className="text-xs text-purple-600 hover:text-purple-800">Copy</button>
                <button onClick={() => setAiAnalysis(null)} className="text-xs text-gray-500 hover:text-gray-700">Dismiss</button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-[500px]">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">{aiAnalysis}</pre>
            </div>
          </div>
        )}

        {/* Test Results (Control-level Rollup) */}
        {assessmentProcedures.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Test Results</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Flip the control result to <span className="font-semibold">Compliant</span>, <span className="font-semibold">Non-compliant</span>, or <span className="font-semibold">N/A</span>.
                  This applies to all assessment procedures under this control.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-1 rounded ${getTestResultInfo(rollupTestStatus.status).color}`}>
                  {getTestResultInfo(rollupTestStatus.status).label}
                </span>
                {rollupTestStatus.incomplete && (
                  <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                    Some procedures not tested yet
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => applyRollupTestStatus('satisfied')}
                disabled={!canWriteAssessments || !!rollupSaving}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {rollupSaving === 'satisfied' ? 'Updating...' : 'Compliant'}
              </button>
              <button
                onClick={() => applyRollupTestStatus('other_than_satisfied')}
                disabled={!canWriteAssessments || !!rollupSaving}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {rollupSaving === 'other_than_satisfied' ? 'Updating...' : 'Non-compliant'}
              </button>
              <button
                onClick={() => applyRollupTestStatus('not_applicable')}
                disabled={!canWriteAssessments || !!rollupSaving}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {rollupSaving === 'not_applicable' ? 'Updating...' : 'N/A'}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-700">
              <div className="bg-gray-50 border border-gray-200 rounded p-2">
                <div className="font-semibold">Not Tested</div>
                <div>{testResultCounts.not_assessed}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded p-2">
                <div className="font-semibold">Compliant</div>
                <div>{testResultCounts.satisfied}</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded p-2">
                <div className="font-semibold">Non-compliant</div>
                <div>{testResultCounts.other_than_satisfied}</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded p-2">
                <div className="font-semibold">N/A</div>
                <div>{testResultCounts.not_applicable}</div>
              </div>
            </div>

            {!canWriteAssessments && (
              <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded text-xs">
                Read-only mode. Updating test results requires <code className="mx-1">assessments.write</code>.
              </div>
            )}
          </div>
        )}

        {/* Assessment Procedures (NIST 800-53A / SCA Testing) */}
        {assessmentProcedures.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Assessment Procedures</h3>
              <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">
                {assessmentProcedures[0]?.source_document || 'NIST SP 800-53A'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Testing procedures for Security Control Assessors (SCAs) to evaluate this control.
            </p>
            <div className="space-y-3">
              {assessmentProcedures.map((proc: any) => (
                <div key={proc.id} className="bg-gray-50 rounded-lg p-4 border-l-4 border-purple-400">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-lg">
                      {proc.procedure_type === 'examine' ? '📄' :
                       proc.procedure_type === 'interview' ? '🎤' :
                       proc.procedure_type === 'test' ? '🧪' :
                       proc.procedure_type === 'audit_step' ? '📋' :
                       proc.procedure_type === 'observation' ? '👁️' :
                       proc.procedure_type === 'inspection' ? '🔍' : '📌'}
                    </span>
                    <span className="text-xs font-mono bg-white text-gray-700 px-2 py-0.5 rounded border">{proc.procedure_id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      proc.procedure_type === 'examine' ? 'bg-blue-50 text-blue-700' :
                      proc.procedure_type === 'interview' ? 'bg-green-50 text-green-700' :
                      proc.procedure_type === 'test' ? 'bg-orange-50 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {proc.procedure_type.charAt(0).toUpperCase() + proc.procedure_type.slice(1).replace('_', ' ')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      proc.depth === 'basic' ? 'bg-blue-50 text-blue-600' :
                      proc.depth === 'focused' ? 'bg-purple-50 text-purple-600' :
                      'bg-orange-50 text-orange-600'
                    }`}>
                      {proc.depth}
                    </span>
                    {(() => {
                      const status = String(proc.result_status || 'not_assessed');
                      const info = getTestResultInfo(status);
                      return (
                        <span className={`text-xs px-2 py-0.5 rounded ${info.color}`}>
                          {info.label}
                        </span>
                      );
                    })()}
                    {proc.assessed_at && (
                      <span className="text-xs text-gray-500 ml-auto">
                        Last assessed {formatDatetime(proc.assessed_at)}{proc.assessor_name ? ` · ${proc.assessor_name}` : ''}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">{proc.title}</h4>
                  <p className="text-sm text-gray-600 mb-2">{proc.description}</p>
                  {proc.expected_evidence && (
                    <div className="mt-2">
                      <span className="text-xs font-semibold text-gray-700">Expected Evidence: </span>
                      <span className="text-xs text-gray-600 whitespace-pre-wrap">{proc.expected_evidence}</span>
                    </div>
                  )}
                  {proc.assessor_notes && (
                    <div className="mt-1 bg-yellow-50 rounded p-2">
                      <span className="text-xs font-semibold text-yellow-700">Assessor Notes: </span>
                      <span className="text-xs text-yellow-700 whitespace-pre-wrap">{proc.assessor_notes}</span>
                    </div>
                  )}

                  {canWriteAssessments && (
                    <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                      <button
                        onClick={() => toggleProcedureEditor(proc)}
                        className="text-xs bg-white border border-gray-200 hover:border-purple-300 text-gray-800 px-3 py-1.5 rounded-md transition-colors"
                      >
                        {procedureEditors[String(proc.id)] ? 'Close Result Editor' : (proc.result_status ? 'Edit Result' : 'Record Result')}
                      </button>
                      <span className="text-xs text-gray-500">
                        Saved results roll up into Assessments and reporting.
                      </span>
                    </div>
                  )}

                  {canWriteAssessments && procedureEditors[String(proc.id)] && (
                    <div className="mt-3 bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Result Status</label>
                        <select
                          value={procedureDrafts[String(proc.id)]?.status || 'not_assessed'}
                          onChange={(e) => updateProcedureDraft(String(proc.id), { status: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="not_assessed">Not Tested</option>
                          <option value="satisfied">Compliant</option>
                          <option value="other_than_satisfied">Non-compliant</option>
                          <option value="not_applicable">N/A</option>
                        </select>
                      </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Risk Level</label>
                          <select
                            value={procedureDrafts[String(proc.id)]?.risk_level || ''}
                            onChange={(e) => updateProcedureDraft(String(proc.id), { risk_level: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="">(Optional)</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Remediation Deadline</label>
                          <input
                            type="date"
                            value={procedureDrafts[String(proc.id)]?.remediation_deadline || ''}
                            onChange={(e) => updateProcedureDraft(String(proc.id), { remediation_deadline: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Evidence Collected</label>
                          <textarea
                            rows={3}
                            value={procedureDrafts[String(proc.id)]?.evidence_collected || ''}
                            onChange={(e) => updateProcedureDraft(String(proc.id), { evidence_collected: e.target.value })}
                            placeholder="What did you examine/interview/test?"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Finding / Notes</label>
                          <textarea
                            rows={3}
                            value={procedureDrafts[String(proc.id)]?.finding || ''}
                            onChange={(e) => updateProcedureDraft(String(proc.id), { finding: e.target.value })}
                            placeholder="What did you find?"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <label className="flex items-center gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={Boolean(procedureDrafts[String(proc.id)]?.remediation_required)}
                            onChange={(e) => updateProcedureDraft(String(proc.id), { remediation_required: e.target.checked })}
                          />
                          Remediation required
                        </label>

                        <button
                          onClick={() => saveProcedureResult(String(proc.id))}
                          disabled={procedureSavingId === String(proc.id)}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
                        >
                          {procedureSavingId === String(proc.id) ? 'Saving...' : 'Save Result'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status & Assignment Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Workflow Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Status Workflow</h3>

            {!canUpdateImplementation && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded text-xs mb-4">
                Read-only mode. Status updates require
                <code className="mx-1">implementations.write</code>.
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Change Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                disabled={!canUpdateImplementation}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {VALID_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                disabled={!canUpdateImplementation}
                rows={3}
                placeholder="Add notes about this status change..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleStatusUpdate}
                disabled={updating || !implementation || !canUpdateImplementation || (selectedStatus === implementation.status && !statusNotes.trim())}
                className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updating ? 'Updating...' : 'Update Status'}
              </button>
              <button
                onClick={handleReview}
                disabled={updating || !implementation || !canUpdateImplementation}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Review
              </button>
            </div>
          </div>

          {/* Assignment Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Assignment</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                disabled={!canUpdateImplementation}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Unassigned</option>
                {orgUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={!canUpdateImplementation}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleAssignment}
              disabled={updating || !implementation || !canUpdateImplementation}
              className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updating ? 'Updating...' : 'Update Assignment'}
            </button>

            {implementation?.assigned_to_name && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">Currently assigned to</p>
                <p className="text-sm font-medium text-gray-900">{implementation.assigned_to_name}</p>
                <p className="text-xs text-gray-500">{implementation.assigned_to_email}</p>
                {implementation.due_date && (
                  <p className="text-xs text-gray-500 mt-1">Due: {formatDate(implementation.due_date)}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Linked Evidence */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Linked Evidence</h3>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {implementation?.evidence?.length || 0} file{implementation?.evidence?.length !== 1 ? 's' : ''}
              </span>
              {canWriteEvidence && (
                <button
                  onClick={openEvidenceModal}
                  className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-md transition-colors"
                >
                  Link Evidence
                </button>
              )}
            </div>
          </div>

          {implementation?.evidence && implementation.evidence.length > 0 ? (
            <div className="space-y-3">
              {implementation.evidence.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📄</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{ev.file_name}</p>
                      <p className="text-xs text-gray-500">
                        {ev.description || 'No description'} · Uploaded by {ev.uploaded_by_name} · {formatDate(ev.uploaded_at)}
                      </p>
                      {ev.link_notes && <p className="text-xs text-purple-600 italic">{ev.link_notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Linked</span>
                    {canWriteEvidence && (
                      <button
                        onClick={() => unlinkEvidence(ev.id)}
                        disabled={evidenceAction === `unlink:${ev.id}`}
                        className="text-xs text-red-700 hover:text-red-900 disabled:opacity-50"
                      >
                        {evidenceAction === `unlink:${ev.id}` ? 'Unlinking...' : 'Unlink'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <p className="text-sm">No evidence linked to this control yet.</p>
              <p className="text-xs mt-1">
                {canWriteEvidence ? 'Use "Link Evidence" to attach files to this control.' : 'You do not have permission to link evidence.'}
              </p>
            </div>
          )}
        </div>

        {/* Evidence Modal */}
        {evidenceModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Link Evidence to This Control</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Upload new evidence or link existing evidence from your library.
                  </p>
                </div>
                <button
                  onClick={() => setEvidenceModalOpen(false)}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Close
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto max-h-[75vh]">
                {/* Upload & link */}
                {canWriteEvidence && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="text-sm font-semibold text-gray-900">Upload and Link</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      <div className="md:col-span-1">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">File</label>
                        <input
                          type="file"
                          onChange={(e) => setEvidenceUploadFile(e.target.files?.[0] || null)}
                          className="w-full text-sm"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                        <input
                          type="text"
                          value={evidenceUploadDescription}
                          onChange={(e) => setEvidenceUploadDescription(e.target.value)}
                          placeholder="Short description"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Tags (comma separated)</label>
                        <input
                          type="text"
                          value={evidenceUploadTags}
                          onChange={(e) => setEvidenceUploadTags(e.target.value)}
                          placeholder="e.g. policy, screenshot"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Link Notes (optional)</label>
                        <input
                          type="text"
                          value={evidenceLinkNotes}
                          onChange={(e) => setEvidenceLinkNotes(e.target.value)}
                          placeholder="Why is this evidence relevant?"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={uploadAndLinkEvidence}
                          disabled={evidenceAction === 'upload' || !evidenceUploadFile}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
                        >
                          {evidenceAction === 'upload' ? 'Uploading...' : 'Upload + Link'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Search */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Search Evidence Library</label>
                    <input
                      value={evidenceSearch}
                      onChange={(e) => setEvidenceSearch(e.target.value)}
                      placeholder="Search by filename or description..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={() => loadEvidenceLibrary()}
                    disabled={evidenceLoading}
                    className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    {evidenceLoading ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {/* Evidence list */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-900">Evidence Library</div>
                    <div className="text-xs text-gray-500">{evidenceLibrary.length} items</div>
                  </div>
                  <div className="divide-y max-h-[340px] overflow-y-auto">
                    {evidenceLibrary.map((ev) => {
                      const isLinked = linkedEvidenceIds.has(ev.id);
                      return (
                        <div key={ev.id} className="p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{ev.file_name}</div>
                            <div className="text-xs text-gray-500 truncate">{ev.description || 'No description'}</div>
                            <div className="text-[11px] text-gray-400 mt-0.5">
                              Uploaded by {ev.uploaded_by_name} · {formatDate(ev.uploaded_at)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isLinked ? (
                              <>
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Linked</span>
                                {canWriteEvidence && (
                                  <button
                                    onClick={() => unlinkEvidence(ev.id)}
                                    disabled={evidenceAction === `unlink:${ev.id}`}
                                    className="text-xs text-red-700 hover:text-red-900 disabled:opacity-50"
                                  >
                                    {evidenceAction === `unlink:${ev.id}` ? 'Unlinking...' : 'Unlink'}
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                onClick={() => linkEvidence(ev.id)}
                                disabled={!canWriteEvidence || evidenceAction === `link:${ev.id}`}
                                className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-md disabled:opacity-50 transition-colors"
                              >
                                {evidenceAction === `link:${ev.id}` ? 'Linking...' : 'Link'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {!evidenceLoading && evidenceLibrary.length === 0 && (
                      <div className="p-6 text-center text-sm text-gray-500">
                        No evidence found.
                      </div>
                    )}

                    {evidenceLoading && (
                      <div className="p-6 text-center text-sm text-gray-500">
                        Loading...
                      </div>
                    )}
                  </div>
                </div>

                {!canWriteEvidence && (
                  <div className="text-xs text-gray-600">
                    You can view evidence, but you do not have permission to link/unlink evidence.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status History Timeline */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Status History</h3>
          {implementation?.status_history && implementation.status_history.length > 0 ? (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              <div className="space-y-4">
                {implementation.status_history.map((entry) => (
                  <div key={entry.id} className="relative flex items-start gap-4 pl-10">
                    <div className="absolute left-2.5 top-2 w-3 h-3 rounded-full bg-purple-600 border-2 border-white shadow"></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${getStatusInfo(entry.old_status).color}`}>
                          {getStatusInfo(entry.old_status).label}
                        </span>
                        <span className="text-gray-400 text-xs">→</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${getStatusInfo(entry.new_status).color}`}>
                          {getStatusInfo(entry.new_status).label}
                        </span>
                        <span className="text-xs text-gray-500 ml-auto">{formatDatetime(entry.changed_at)}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        by {entry.changed_by_name || 'Unknown'}
                        {entry.notes && <span className="ml-2 italic">— {entry.notes}</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No history yet.</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
