'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { assessmentsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessAuditorWorkspace, hasPermission } from '@/lib/access';
import { groupByControlFamily, sameControlRef } from '@/lib/controlFamilies';

type WorkspaceTab = 'summary' | 'procedures' | 'pbc' | 'workpapers' | 'findings' | 'signoffs';

const engagementStatuses = ['planning', 'fieldwork', 'reporting', 'completed', 'archived'];
const pbcStatuses = ['open', 'in_progress', 'submitted', 'accepted', 'rejected', 'closed'];
const workpaperStatuses = ['draft', 'in_review', 'finalized'];
const findingStatuses = ['open', 'accepted', 'remediating', 'verified', 'closed'];
const signoffTypes = [
  'customer_acknowledgment',
  'auditor',
  'company_leadership',
  'auditor_firm_recommendation'
];
const templateArtifactTypes = ['pbc', 'workpaper', 'finding', 'signoff', 'engagement_report'];

function labelize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function asList(payload: any, key?: string) {
  if (Array.isArray(payload)) return payload;
  if (key && Array.isArray(payload?.[key])) return payload[key];
  return [];
}

function parseCsv(value: string) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeControlRef(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
}

export default function AuditorWorkspacePage() {
  const { user } = useAuth();
  const canViewWorkspace = canAccessAuditorWorkspace(user);
  const canWrite = canViewWorkspace && hasPermission(user, 'assessments.write');

  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [engagements, setEngagements] = useState<any[]>([]);
  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<WorkspaceTab>('summary');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [engagement, setEngagement] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [pbc, setPbc] = useState<any[]>([]);
  const [workpapers, setWorkpapers] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [signoffs, setSignoffs] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [signoffReadiness, setSignoffReadiness] = useState<any>(null);

  const [selectedPbcId, setSelectedPbcId] = useState<string | null>(null);
  const [selectedWorkpaperId, setSelectedWorkpaperId] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [selectedProcedureIds, setSelectedProcedureIds] = useState<string[]>([]);
  const [expandedProcedureFamilies, setExpandedProcedureFamilies] = useState<Record<string, boolean>>({});
  const [expandedProcedureControls, setExpandedProcedureControls] = useState<Record<string, boolean>>({});

  const [newEngagementName, setNewEngagementName] = useState('');
  const [newEngagementType, setNewEngagementType] = useState('internal_audit');
  const [newEngagementScope, setNewEngagementScope] = useState('');
  const [newEngagementFrameworkCodes, setNewEngagementFrameworkCodes] = useState('nist_800_53');
  const [newEngagementPeriodStart, setNewEngagementPeriodStart] = useState('');
  const [newEngagementPeriodEnd, setNewEngagementPeriodEnd] = useState('');

  const [newPbcTitle, setNewPbcTitle] = useState('');
  const [newPbcDetails, setNewPbcDetails] = useState('');
  const [newPbcPriority, setNewPbcPriority] = useState('medium');
  const [newPbcDueDate, setNewPbcDueDate] = useState('');
  const [autoPbcContext, setAutoPbcContext] = useState('');

  const [newWorkpaperTitle, setNewWorkpaperTitle] = useState('');
  const [newWorkpaperObjective, setNewWorkpaperObjective] = useState('');
  const [newWorkpaperProcedure, setNewWorkpaperProcedure] = useState('');
  const [newWorkpaperConclusion, setNewWorkpaperConclusion] = useState('');

  const [newFindingTitle, setNewFindingTitle] = useState('');
  const [newFindingDescription, setNewFindingDescription] = useState('');
  const [newFindingSeverity, setNewFindingSeverity] = useState('medium');
  const [newFindingRecommendation, setNewFindingRecommendation] = useState('');
  const [newFindingDueDate, setNewFindingDueDate] = useState('');

  const [newSignoffType, setNewSignoffType] = useState('auditor');
  const [newSignoffStatus, setNewSignoffStatus] = useState('approved');
  const [newSignoffComments, setNewSignoffComments] = useState('');
  const [templateArtifactType, setTemplateArtifactType] = useState('pbc');
  const [templateName, setTemplateName] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [templateSetDefault, setTemplateSetDefault] = useState(true);
  const [templateUploadFile, setTemplateUploadFile] = useState<File | null>(null);

  const [engagementStatusDraft, setEngagementStatusDraft] = useState('planning');
  const [pbcStatusDraft, setPbcStatusDraft] = useState('open');
  const [workpaperStatusDraft, setWorkpaperStatusDraft] = useState('draft');
  const [findingStatusDraft, setFindingStatusDraft] = useState('open');

  const selectedPbc = pbc.find((item) => item.id === selectedPbcId) || null;
  const selectedWorkpaper = workpapers.find((item) => item.id === selectedWorkpaperId) || null;
  const selectedFinding = findings.find((item) => item.id === selectedFindingId) || null;
  const primarySelectedProcedureId = selectedProcedureIds[0] || null;
  const primarySelectedProcedure = procedures.find((item) => item.id === primarySelectedProcedureId) || null;

  const filteredEngagements = useMemo(() => {
    return engagements.filter((row) => {
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      const query = search.trim().toLowerCase();
      const matchesSearch = !query ||
        String(row.name || '').toLowerCase().includes(query) ||
        String(row.scope || '').toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [engagements, search, statusFilter]);

  const procedureFamilies = useMemo(
    () => groupByControlFamily(procedures, (row) => row.control_id),
    [procedures]
  );

  const procedureControlKeyById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of procedures) {
      const controlKey = normalizeControlRef(row.control_id);
      if (!row.id || !controlKey) continue;
      map.set(String(row.id), controlKey);
    }
    return map;
  }, [procedures]);

  const pbcByControlKey = useMemo(() => {
    const grouped = new Map<string, any[]>();
    const pbcById = new Map<string, any>();
    const add = (controlKey: string, row: any) => {
      if (!controlKey) return;
      if (!grouped.has(controlKey)) grouped.set(controlKey, []);
      const list = grouped.get(controlKey)!;
      if (!list.some((entry: any) => entry.id === row.id)) {
        list.push(row);
      }
    };

    for (const row of pbc) {
      if (row.id) pbcById.set(String(row.id), row);
      const directControlKey = normalizeControlRef(row.assessment_control_id);
      add(directControlKey, row);

      const procedureControlKey = row.assessment_procedure_id
        ? procedureControlKeyById.get(String(row.assessment_procedure_id)) || ''
        : '';
      add(procedureControlKey, row);
    }

    return { grouped, pbcById };
  }, [pbc, procedureControlKeyById]);

  const findingsByControlKey = useMemo(() => {
    const grouped = new Map<string, any[]>();
    const add = (controlKey: string, row: any) => {
      if (!controlKey) return;
      if (!grouped.has(controlKey)) grouped.set(controlKey, []);
      const list = grouped.get(controlKey)!;
      if (!list.some((entry: any) => entry.id === row.id)) {
        list.push(row);
      }
    };

    for (const row of findings) {
      add(normalizeControlRef(row.control_ref), row);

      if (row.related_pbc_request_id) {
        const linkedPbc = pbcByControlKey.pbcById.get(String(row.related_pbc_request_id));
        if (linkedPbc) {
          add(normalizeControlRef(linkedPbc.assessment_control_id), row);
          const pbcProcedureControlKey = linkedPbc.assessment_procedure_id
            ? procedureControlKeyById.get(String(linkedPbc.assessment_procedure_id)) || ''
            : '';
          add(pbcProcedureControlKey, row);
        }
      }
    }

    return grouped;
  }, [findings, pbcByControlKey.pbcById, procedureControlKeyById]);

  useEffect(() => {
    if (procedureFamilies.length === 0) {
      setExpandedProcedureFamilies({});
      setExpandedProcedureControls({});
      return;
    }

    setExpandedProcedureFamilies((prev) => {
      const next: Record<string, boolean> = {};
      procedureFamilies.forEach((family, index) => {
        const key = family.family;
        next[key] = prev[key] ?? index === 0;
      });
      return next;
    });

    setExpandedProcedureControls((prev) => {
      const next: Record<string, boolean> = {};
      let firstControlKey: string | null = null;
      for (const family of procedureFamilies) {
        for (const control of family.controls) {
          const key = `${family.family}::${control.controlId}`;
          if (!firstControlKey) firstControlKey = key;
          next[key] = prev[key] ?? key === firstControlKey;
        }
      }
      return next;
    });
  }, [procedureFamilies]);

  useEffect(() => {
    if (!canViewWorkspace) {
      setLoading(false);
      return;
    }
    loadInitial();
  }, [canViewWorkspace]);

  useEffect(() => {
    if (!canViewWorkspace || !selectedEngagementId) return;
    loadWorkspace(selectedEngagementId);
  }, [canViewWorkspace, selectedEngagementId]);

  useEffect(() => {
    if (engagement?.status) setEngagementStatusDraft(engagement.status);
  }, [engagement]);

  useEffect(() => {
    if (selectedPbc?.status) setPbcStatusDraft(selectedPbc.status);
  }, [selectedPbc]);

  useEffect(() => {
    if (selectedWorkpaper?.status) setWorkpaperStatusDraft(selectedWorkpaper.status);
  }, [selectedWorkpaper]);

  useEffect(() => {
    if (selectedFinding?.status) setFindingStatusDraft(selectedFinding.status);
  }, [selectedFinding]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  async function refreshEngagements() {
    const response = await assessmentsAPI.getEngagements({ limit: 100, offset: 0 });
    const rows = asList(response.data?.data, 'engagements');
    setEngagements(rows);
    return rows;
  }

  async function loadInitial() {
    try {
      setLoading(true);
      setError('');
      await refreshEngagements();
    } catch (loadError: any) {
      setError(loadError.response?.data?.error || 'Failed to load auditor workspace');
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkspace(engagementId: string) {
    try {
      setWorkspaceLoading(true);
      const [detailRes, pbcRes, wpRes, findingRes, signoffRes, procedureRes, readinessRes, templatesRes] = await Promise.all([
        assessmentsAPI.getEngagementById(engagementId),
        assessmentsAPI.getEngagementPbc(engagementId, { limit: 200, offset: 0 }),
        assessmentsAPI.getEngagementWorkpapers(engagementId, { limit: 200, offset: 0 }),
        assessmentsAPI.getEngagementFindings(engagementId, { limit: 200, offset: 0 }),
        assessmentsAPI.getEngagementSignoffs(engagementId),
        assessmentsAPI.getEngagementProcedures(engagementId, { limit: 300, offset: 0 }),
        assessmentsAPI.getEngagementSignoffReadiness(engagementId),
        assessmentsAPI.getAuditTemplates({ include_inactive: false })
      ]);

      const detailPayload = detailRes.data?.data || {};
      const nextEngagement = detailPayload.engagement || detailPayload;
      setEngagement(nextEngagement);
      setSummary(detailPayload.summary || null);

      const pbcRows = asList(pbcRes.data?.data);
      const wpRows = asList(wpRes.data?.data);
      const findingRows = asList(findingRes.data?.data);
      const signoffRows = asList(signoffRes.data?.data);
      const procedureRows = asList(procedureRes.data?.data, 'procedures');
      const templateRows = asList(templatesRes.data?.data);

      setPbc(pbcRows);
      setWorkpapers(wpRows);
      setFindings(findingRows);
      setSignoffs(signoffRows);
      setProcedures(procedureRows);
      setTemplates(templateRows);
      setSignoffReadiness(readinessRes.data?.data || null);
      setSelectedProcedureIds((prev) => prev.filter((id) => procedureRows.some((row: any) => row.id === id)));

      setSelectedPbcId((prev) => (pbcRows.some((x: any) => x.id === prev) ? prev : (pbcRows[0]?.id || null)));
      setSelectedWorkpaperId((prev) => (wpRows.some((x: any) => x.id === prev) ? prev : (wpRows[0]?.id || null)));
      setSelectedFindingId((prev) => (findingRows.some((x: any) => x.id === prev) ? prev : (findingRows[0]?.id || null)));
    } catch (loadError: any) {
      setError(loadError.response?.data?.error || 'Failed to load selected engagement');
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function createEngagement() {
    if (!canWrite || !newEngagementName.trim()) return;
    try {
      setSaving(true);
      setError('');
      const response = await assessmentsAPI.createEngagement({
        name: newEngagementName.trim(),
        engagement_type: newEngagementType as any,
        scope: newEngagementScope || undefined,
        framework_codes: parseCsv(newEngagementFrameworkCodes),
        period_start: newEngagementPeriodStart || undefined,
        period_end: newEngagementPeriodEnd || undefined
      });
      const createdId = response.data?.data?.id;
      setNewEngagementName('');
      setNewEngagementScope('');
      setNewEngagementPeriodStart('');
      setNewEngagementPeriodEnd('');
      const rows = await refreshEngagements();
      if (createdId) {
        setSelectedEngagementId(createdId);
      } else if (rows[0]?.id) {
        setSelectedEngagementId(rows[0].id);
      }
      showToast('Engagement created');
    } catch (saveError: any) {
      setError(saveError.response?.data?.error || 'Failed to create engagement');
    } finally {
      setSaving(false);
    }
  }

  async function updateEngagementStatus() {
    if (!canWrite || !selectedEngagementId) return;
    await runSave(async () => {
      await assessmentsAPI.updateEngagement(selectedEngagementId, { status: engagementStatusDraft as any });
      await loadWorkspace(selectedEngagementId);
      await refreshEngagements();
      showToast('Engagement updated');
    }, 'Failed to update engagement');
  }

  async function createPbc() {
    if (!canWrite || !selectedEngagementId || !newPbcTitle.trim() || !newPbcDetails.trim()) return;
    await runSave(async () => {
      await assessmentsAPI.createEngagementPbc(selectedEngagementId, {
        title: newPbcTitle.trim(),
        request_details: newPbcDetails.trim(),
        priority: newPbcPriority as any,
        due_date: newPbcDueDate || null
      });
      setNewPbcTitle('');
      setNewPbcDetails('');
      setNewPbcDueDate('');
      await loadWorkspace(selectedEngagementId);
      await refreshEngagements();
      showToast('PBC created');
    }, 'Failed to create PBC');
  }

  async function createWorkpaper() {
    if (!canWrite || !selectedEngagementId || !newWorkpaperTitle.trim()) return;
    await runSave(async () => {
      await assessmentsAPI.createEngagementWorkpaper(selectedEngagementId, {
        title: newWorkpaperTitle.trim(),
        objective: newWorkpaperObjective || null,
        procedure_performed: newWorkpaperProcedure || null,
        conclusion: newWorkpaperConclusion || null,
        status: 'draft'
      });
      setNewWorkpaperTitle('');
      setNewWorkpaperObjective('');
      setNewWorkpaperProcedure('');
      setNewWorkpaperConclusion('');
      await loadWorkspace(selectedEngagementId);
      await refreshEngagements();
      showToast('Workpaper created');
    }, 'Failed to create workpaper');
  }

  async function createFinding() {
    if (!canWrite || !selectedEngagementId || !newFindingTitle.trim() || !newFindingDescription.trim()) return;
    await runSave(async () => {
      await assessmentsAPI.createEngagementFinding(selectedEngagementId, {
        title: newFindingTitle.trim(),
        description: newFindingDescription.trim(),
        severity: newFindingSeverity as any,
        recommendation: newFindingRecommendation || null,
        due_date: newFindingDueDate || null
      });
      setNewFindingTitle('');
      setNewFindingDescription('');
      setNewFindingRecommendation('');
      setNewFindingDueDate('');
      await loadWorkspace(selectedEngagementId);
      await refreshEngagements();
      showToast('Finding created');
    }, 'Failed to create finding');
  }

  function toggleProcedureSelection(procedureId: string, checked: boolean) {
    setSelectedProcedureIds((prev) => {
      if (checked) {
        return prev.includes(procedureId) ? prev : [...prev, procedureId];
      }
      return prev.filter((id) => id !== procedureId);
    });
  }

  function toggleProcedureFamily(family: string) {
    setExpandedProcedureFamilies((prev) => ({
      ...prev,
      [family]: !prev[family]
    }));
  }

  function toggleProcedureControl(family: string, controlId: string) {
    const key = `${family}::${controlId}`;
    setExpandedProcedureControls((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  }

  async function autoCreatePbcFromProcedures() {
    if (!canWrite || !selectedEngagementId || selectedProcedureIds.length === 0) return;
    await runSave(async () => {
      const response = await assessmentsAPI.autoCreateEngagementPbc(selectedEngagementId, {
        procedure_ids: selectedProcedureIds,
        due_date: newPbcDueDate || null,
        priority: newPbcPriority as any,
        request_context: autoPbcContext || null
      });
      const createdCount = response.data?.data?.summary?.created ?? 0;
      const skippedCount = response.data?.data?.summary?.skipped ?? 0;
      await loadWorkspace(selectedEngagementId);
      await refreshEngagements();
      showToast(`PBC automation complete (${createdCount} created, ${skippedCount} skipped)`);
    }, 'Failed to auto-create PBC from procedures');
  }

  async function generateAiWorkpaperFromProcedure() {
    if (!canWrite || !selectedEngagementId || !primarySelectedProcedureId) return;
    await runSave(async () => {
      await assessmentsAPI.generateEngagementWorkpaperDraftAi(selectedEngagementId, {
        assessment_procedure_id: primarySelectedProcedureId,
        objective: newWorkpaperObjective || primarySelectedProcedure?.title || undefined,
        procedure_performed: newWorkpaperProcedure || undefined,
        test_outcome: newWorkpaperConclusion || undefined,
        persist_draft: true
      });
      await loadWorkspace(selectedEngagementId);
      await refreshEngagements();
      showToast('AI workpaper draft generated');
    }, 'Failed to generate AI workpaper draft');
  }

  async function generateAiFindingFromProcedure() {
    if (!canWrite || !selectedEngagementId || !primarySelectedProcedureId) return;
    await runSave(async () => {
      await assessmentsAPI.generateEngagementFindingDraftAi(selectedEngagementId, {
        assessment_procedure_id: primarySelectedProcedureId,
        issue_summary: newFindingDescription || primarySelectedProcedure?.description || primarySelectedProcedure?.title || undefined,
        evidence_summary: selectedPbc?.response_notes || undefined,
        severity_hint: newFindingSeverity as any,
        recommendation_scope: newFindingRecommendation || undefined,
        persist_draft: true
      });
      await loadWorkspace(selectedEngagementId);
      await refreshEngagements();
      showToast('AI finding draft generated');
    }, 'Failed to generate AI finding draft');
  }

  async function downloadValidationPackagePdf() {
    if (!selectedEngagementId) return;
    await runSave(async () => {
      const response = await assessmentsAPI.downloadEngagementValidationPackagePdf(selectedEngagementId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const fileName = `${String(engagement?.name || 'validation-package').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-validation-package.pdf`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('Validation package PDF downloaded');
    }, 'Failed to download validation package PDF');
  }

  async function createTemplateFromText() {
    if (!canWrite || !templateName.trim() || !templateContent.trim()) return;
    await runSave(async () => {
      await assessmentsAPI.createAuditTemplate({
        artifact_type: templateArtifactType as any,
        template_name: templateName.trim(),
        template_content: templateContent.trim(),
        set_default: templateSetDefault
      });
      setTemplateName('');
      setTemplateContent('');
      if (selectedEngagementId) {
        await loadWorkspace(selectedEngagementId);
      }
      showToast('Template saved');
    }, 'Failed to save template');
  }

  async function uploadTemplateFile() {
    if (!canWrite || !templateUploadFile) return;
    await runSave(async () => {
      const formData = new FormData();
      formData.append('file', templateUploadFile);
      formData.append('artifact_type', templateArtifactType);
      if (templateName.trim()) formData.append('template_name', templateName.trim());
      formData.append('set_default', String(templateSetDefault));
      await assessmentsAPI.uploadAuditTemplate(formData);
      setTemplateUploadFile(null);
      if (selectedEngagementId) {
        await loadWorkspace(selectedEngagementId);
      }
      showToast('Template uploaded');
    }, 'Failed to upload template');
  }

  async function createSignoff() {
    if (!canWrite || !selectedEngagementId) return;
    if (newSignoffType === 'auditor_firm_recommendation' && !newSignoffComments.trim()) {
      setError('Final recommendation sign-off requires comments');
      return;
    }
    await runSave(async () => {
      await assessmentsAPI.createEngagementSignoff(selectedEngagementId, {
        signoff_type: newSignoffType as any,
        status: newSignoffStatus as any,
        comments: newSignoffComments || null
      });
      setNewSignoffComments('');
      await loadWorkspace(selectedEngagementId);
      await refreshEngagements();
      showToast('Sign-off created');
    }, 'Failed to create sign-off');
  }

  async function updateArtifactStatus(kind: 'pbc' | 'workpaper' | 'finding') {
    if (!canWrite || !selectedEngagementId) return;
    await runSave(async () => {
      if (kind === 'pbc' && selectedPbc) {
        await assessmentsAPI.updateEngagementPbc(selectedEngagementId, selectedPbc.id, { status: pbcStatusDraft as any });
      }
      if (kind === 'workpaper' && selectedWorkpaper) {
        await assessmentsAPI.updateEngagementWorkpaper(selectedEngagementId, selectedWorkpaper.id, { status: workpaperStatusDraft as any });
      }
      if (kind === 'finding' && selectedFinding) {
        await assessmentsAPI.updateEngagementFinding(selectedEngagementId, selectedFinding.id, { status: findingStatusDraft as any });
      }
      await loadWorkspace(selectedEngagementId);
      await refreshEngagements();
      showToast(`${labelize(kind)} updated`);
    }, `Failed to update ${kind}`);
  }

  async function runSave(action: () => Promise<void>, fallbackMessage: string) {
    try {
      setSaving(true);
      setError('');
      await action();
    } catch (saveError: any) {
      setError(saveError.response?.data?.error || fallbackMessage);
    } finally {
      setSaving(false);
    }
  }

  if (!canViewWorkspace) {
    return (
      <DashboardLayout>
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg">
          Auditor Workspace is only available to auditor roles.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {toast && <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow">{toast}</div>}

        <h1 className="text-3xl font-bold text-gray-900">Auditor Workspace</h1>
        <p className="text-gray-600">Procedure-driven engagements with AI-assisted PBC/workpaper/finding drafting, sign-off checklisting, and validation package export.</p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

        {canWrite && (
          <div className="bg-white rounded-lg shadow-md p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Create Engagement</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={newEngagementName} onChange={(e) => setNewEngagementName(e.target.value)} placeholder="Engagement name *" className="px-3 py-2 border border-gray-300 rounded-lg" />
              <select value={newEngagementType} onChange={(e) => setNewEngagementType(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
                <option value="internal_audit">Internal Audit</option>
                <option value="external_audit">External Audit</option>
                <option value="readiness">Readiness</option>
                <option value="assessment">Assessment</option>
              </select>
              <input value={newEngagementScope} onChange={(e) => setNewEngagementScope(e.target.value)} placeholder="Scope" className="px-3 py-2 border border-gray-300 rounded-lg" />
              <input value={newEngagementFrameworkCodes} onChange={(e) => setNewEngagementFrameworkCodes(e.target.value)} placeholder="Framework codes (comma-separated)" className="px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="date" value={newEngagementPeriodStart} onChange={(e) => setNewEngagementPeriodStart(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="date" value={newEngagementPeriodEnd} onChange={(e) => setNewEngagementPeriodEnd(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div className="flex justify-end">
              <button onClick={createEngagement} disabled={saving || !newEngagementName.trim()} className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                Add Engagement
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <aside className="xl:col-span-4 bg-white rounded-lg shadow-md p-4 h-fit">
            <div className="space-y-2">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search engagements" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="all">All statuses</option>
                {engagementStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
              </select>
            </div>
            <div className="mt-4 space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-sm text-gray-500 py-8 text-center">Loading engagements...</div>
              ) : filteredEngagements.length === 0 ? (
                <div className="text-sm text-gray-500 py-8 text-center">No engagements found.</div>
              ) : (
                filteredEngagements.map((row) => (
                  <button key={row.id} onClick={() => setSelectedEngagementId(row.id)} className={`w-full text-left border rounded-lg px-3 py-3 ${selectedEngagementId === row.id ? 'bg-purple-50 border-purple-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900 truncate">{row.name}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-gray-100 rounded-full">{labelize(row.status)}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{labelize(row.engagement_type)}</div>
                    <div className="text-xs text-gray-500 mt-1">PBC {row.pbc_count ?? 0} · WP {row.workpaper_count ?? 0} · Findings {row.finding_count ?? 0}</div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="xl:col-span-8 space-y-4">
            {workspaceLoading ? (
              <div className="bg-white rounded-lg shadow-md p-10 text-center text-gray-500">Loading engagement workspace...</div>
            ) : !engagement ? (
              <div className="bg-white rounded-lg shadow-md p-10 text-center text-gray-500">Select an engagement.</div>
            ) : (
              <>
                <div className="bg-white rounded-lg shadow-md p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{engagement.name}</h2>
                      <p className="text-sm text-gray-600 mt-1">{engagement.scope || 'No scope provided.'}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">{labelize(engagement.status)}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    <Metric label="Open PBC" value={String(summary?.open_pbc_count ?? 0)} />
                    <Metric label="Finalized WP" value={String(summary?.finalized_workpaper_count ?? 0)} />
                    <Metric label="Open Findings" value={String(summary?.open_finding_count ?? 0)} />
                    <Metric label="Sign-offs" value={String(summary?.signoff_count ?? 0)} />
                  </div>
                  {canWrite && (
                    <div className="mt-4 flex gap-2">
                      <select value={engagementStatusDraft} onChange={(e) => setEngagementStatusDraft(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        {engagementStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
                      </select>
                      <button onClick={updateEngagementStatus} disabled={saving || engagementStatusDraft === engagement.status} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">Update Status</button>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg shadow-md p-2">
                  <div className="flex flex-wrap gap-2">
                    {['summary', 'procedures', 'pbc', 'workpapers', 'findings', 'signoffs'].map((tab) => (
                      <button key={tab} onClick={() => setSelectedTab(tab as WorkspaceTab)} className={`px-3 py-2 rounded-md text-sm font-medium ${selectedTab === tab ? 'bg-purple-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
                        {tab === 'procedures'
                          ? 'Procedures & AI'
                          : tab === 'pbc'
                            ? 'PBC Requests'
                            : tab === 'workpapers'
                              ? 'Workpapers'
                              : tab === 'findings'
                                ? 'Findings'
                                : tab === 'signoffs'
                                  ? 'Sign-offs'
                                  : 'Summary'}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedTab === 'summary' && (
                  <div className="bg-white rounded-lg shadow-md p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Info label="Type" value={labelize(engagement.engagement_type)} />
                    <Info label="Status" value={labelize(engagement.status)} />
                    <Info label="Period Start" value={formatDate(engagement.period_start)} />
                    <Info label="Period End" value={formatDate(engagement.period_end)} />
                    <Info label="Created" value={formatDateTime(engagement.created_at)} />
                    <Info label="Updated" value={formatDateTime(engagement.updated_at)} />
                    <Info label="Framework Scope" value={Array.isArray(engagement.framework_codes) && engagement.framework_codes.length > 0 ? engagement.framework_codes.map((code: string) => String(code).toUpperCase()).join(', ') : 'Organization defaults'} />
                    <Info label="Template Library" value={`${templates.length} active template${templates.length === 1 ? '' : 's'}`} />
                  </div>
                )}

                {selectedTab === 'procedures' && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-lg shadow-md p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-bold text-gray-900">Assessment Procedures in Scope</h3>
                        <div className="text-xs text-gray-600">
                          Selected {selectedProcedureIds.length} of {procedures.length}
                        </div>
                      </div>
                      {procedureFamilies.length === 0 ? (
                        <div className="border rounded-lg p-8 text-center text-gray-500">
                          No assessment procedures found in engagement scope.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {procedureFamilies.map((family) => {
                            const familyOpen = Boolean(expandedProcedureFamilies[family.family]);
                            return (
                              <div key={family.family} className="border border-gray-200 rounded-lg overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => toggleProcedureFamily(family.family)}
                                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
                                >
                                  <div>
                                    <div className="text-sm font-semibold text-gray-900">Control Family {family.family}</div>
                                    <div className="text-xs text-gray-600">
                                      {family.controls.length} controls · {family.totalItems} procedures
                                    </div>
                                  </div>
                                  <span className="text-sm text-gray-700">{familyOpen ? 'Hide' : 'Show'}</span>
                                </button>

                                {familyOpen && (
                                  <div className="p-3 space-y-3">
                                    {family.controls.map((control) => {
                                      const controlKey = `${family.family}::${control.controlId}`;
                                      const controlOpen = Boolean(expandedProcedureControls[controlKey]);
                                      const normalizedControl = normalizeControlRef(control.controlId);
                                      const relatedPbcRows = pbcByControlKey.grouped.get(normalizedControl) || [];
                                      const relatedPbcIdSet = new Set(relatedPbcRows.map((row: any) => String(row.id)));
                                      const relatedFindingRows = (findingsByControlKey.get(normalizedControl) || []).filter((findingRow: any) => {
                                        if (sameControlRef(findingRow.control_ref, control.controlId)) return true;
                                        return Boolean(findingRow.related_pbc_request_id && relatedPbcIdSet.has(String(findingRow.related_pbc_request_id)));
                                      });

                                      return (
                                        <div key={controlKey} className="border border-gray-200 rounded-lg overflow-hidden">
                                          <button
                                            type="button"
                                            onClick={() => toggleProcedureControl(family.family, control.controlId)}
                                            className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-gray-50 text-left"
                                          >
                                            <div>
                                              <div className="text-sm font-semibold text-gray-900">{control.controlId}</div>
                                              <div className="text-xs text-gray-600">
                                                {control.items.length} procedures · PBC {relatedPbcRows.length} · Findings {relatedFindingRows.length}
                                              </div>
                                            </div>
                                            <span className="text-xs text-gray-700">{controlOpen ? 'Collapse' : 'Expand'}</span>
                                          </button>

                                          {controlOpen && (
                                            <div className="border-t border-gray-200 p-3 space-y-3">
                                              <div className="border rounded-lg overflow-hidden">
                                                <table className="min-w-full text-sm">
                                                  <thead className="bg-gray-50">
                                                    <tr>
                                                      <th className="px-3 py-2 text-left w-10">#</th>
                                                      <th className="px-3 py-2 text-left">Procedure</th>
                                                      <th className="px-3 py-2 text-left">Type</th>
                                                      <th className="px-3 py-2 text-left">Status</th>
                                                      <th className="px-3 py-2 text-left">Linked</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {control.items.map((row: any) => {
                                                      const checked = selectedProcedureIds.includes(row.id);
                                                      return (
                                                        <tr key={row.id} className={`border-t border-gray-200 ${checked ? 'bg-purple-50' : ''}`}>
                                                          <td className="px-3 py-2">
                                                            <input
                                                              type="checkbox"
                                                              checked={checked}
                                                              onChange={(e) => toggleProcedureSelection(row.id, e.target.checked)}
                                                              className="h-4 w-4"
                                                            />
                                                          </td>
                                                          <td className="px-3 py-2">
                                                            <div className="font-medium text-gray-900">{row.procedure_id || row.id}</div>
                                                            <div className="text-xs text-gray-600">{row.title}</div>
                                                          </td>
                                                          <td className="px-3 py-2">{labelize(row.procedure_type || 'unknown')}</td>
                                                          <td className="px-3 py-2">{labelize(row.result_status || 'not_assessed')}</td>
                                                          <td className="px-3 py-2 text-xs text-gray-600">PBC {row.linked_pbc_count || 0} · WP {row.linked_workpaper_count || 0}</td>
                                                        </tr>
                                                      );
                                                    })}
                                                  </tbody>
                                                </table>
                                              </div>

                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                                                  <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-semibold text-gray-900">Related PBC Requests</h4>
                                                    <button
                                                      type="button"
                                                      onClick={() => setSelectedTab('pbc')}
                                                      className="text-xs text-purple-700 hover:text-purple-800"
                                                    >
                                                      Open full list
                                                    </button>
                                                  </div>
                                                  {relatedPbcRows.length === 0 ? (
                                                    <p className="text-xs text-gray-500">No related PBC requests for this control.</p>
                                                  ) : (
                                                    relatedPbcRows.slice(0, 6).map((row: any) => (
                                                      <button
                                                        type="button"
                                                        key={row.id}
                                                        onClick={() => {
                                                          setSelectedPbcId(row.id);
                                                          setSelectedTab('pbc');
                                                        }}
                                                        className="w-full text-left px-2 py-2 border border-gray-200 rounded hover:bg-gray-50"
                                                      >
                                                        <div className="text-xs font-medium text-gray-900">{row.title}</div>
                                                        <div className="text-[11px] text-gray-600">
                                                          {labelize(row.status || 'open')} · Due {formatDate(row.due_date)}
                                                        </div>
                                                      </button>
                                                    ))
                                                  )}
                                                </div>

                                                <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                                                  <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-semibold text-gray-900">Related Findings</h4>
                                                    <button
                                                      type="button"
                                                      onClick={() => setSelectedTab('findings')}
                                                      className="text-xs text-purple-700 hover:text-purple-800"
                                                    >
                                                      Open full list
                                                    </button>
                                                  </div>
                                                  {relatedFindingRows.length === 0 ? (
                                                    <p className="text-xs text-gray-500">No related findings for this control.</p>
                                                  ) : (
                                                    relatedFindingRows.slice(0, 6).map((row: any) => (
                                                      <button
                                                        type="button"
                                                        key={row.id}
                                                        onClick={() => {
                                                          setSelectedFindingId(row.id);
                                                          setSelectedTab('findings');
                                                        }}
                                                        className="w-full text-left px-2 py-2 border border-gray-200 rounded hover:bg-gray-50"
                                                      >
                                                        <div className="text-xs font-medium text-gray-900">{row.title}</div>
                                                        <div className="text-[11px] text-gray-600">
                                                          {labelize(row.severity || 'medium')} · {labelize(row.status || 'open')}
                                                        </div>
                                                      </button>
                                                    ))
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {canWrite && (
                      <div className="bg-white rounded-lg shadow-md p-5 space-y-4">
                        <h3 className="text-lg font-bold text-gray-900">Procedure Automation</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <select value={newPbcPriority} onChange={(e) => setNewPbcPriority(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
                            <option value="low">Low Priority</option>
                            <option value="medium">Medium Priority</option>
                            <option value="high">High Priority</option>
                            <option value="critical">Critical Priority</option>
                          </select>
                          <input type="date" value={newPbcDueDate} onChange={(e) => setNewPbcDueDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                        </div>
                        <textarea
                          value={autoPbcContext}
                          onChange={(e) => setAutoPbcContext(e.target.value)}
                          rows={3}
                          placeholder="Optional shared context for auto-generated PBC requests"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={autoCreatePbcFromProcedures}
                            disabled={saving || selectedProcedureIds.length === 0}
                            className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
                          >
                            Auto-Create PBC from Selected
                          </button>
                          <button
                            onClick={generateAiWorkpaperFromProcedure}
                            disabled={saving || !primarySelectedProcedureId}
                            className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                          >
                            AI Draft Workpaper (1st Selected)
                          </button>
                          <button
                            onClick={generateAiFindingFromProcedure}
                            disabled={saving || !primarySelectedProcedureId}
                            className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50"
                          >
                            AI Draft Finding (1st Selected)
                          </button>
                        </div>
                      </div>
                    )}

                    {canWrite && (
                      <div className="bg-white rounded-lg shadow-md p-5 space-y-4">
                        <h3 className="text-lg font-bold text-gray-900">Auditor Company Templates</h3>
                        <p className="text-sm text-gray-600">Upload your firm-standard templates for PBC, workpapers, findings, sign-offs, and final report output. Defaults are used by automation and AI drafting, and are scoped to your auditor profile only.</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <select value={templateArtifactType} onChange={(e) => setTemplateArtifactType(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
                            {templateArtifactTypes.map((type) => (
                              <option key={type} value={type}>{labelize(type)}</option>
                            ))}
                          </select>
                          <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name" className="px-3 py-2 border border-gray-300 rounded-lg md:col-span-2" />
                        </div>
                        <textarea value={templateContent} onChange={(e) => setTemplateContent(e.target.value)} rows={4} placeholder="Template content (supports placeholders like {{control_id}}, {{procedure_id}}, {{objective}})" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" checked={templateSetDefault} onChange={(e) => setTemplateSetDefault(e.target.checked)} />
                          Set as default for this artifact type
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={createTemplateFromText} disabled={saving || !templateName.trim() || !templateContent.trim()} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
                            Save Text Template
                          </button>
                          <input
                            type="file"
                            accept=".txt,.md,.docx,.pdf,.csv,.json,.xml,.log"
                            onChange={(e) => setTemplateUploadFile(e.target.files?.[0] || null)}
                            className="text-sm"
                          />
                          <button onClick={uploadTemplateFile} disabled={saving || !templateUploadFile} className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-black disabled:opacity-50">
                            Upload File Template
                          </button>
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left">Type</th>
                                <th className="px-3 py-2 text-left">Template</th>
                                <th className="px-3 py-2 text-left">Default</th>
                                <th className="px-3 py-2 text-left">Updated</th>
                              </tr>
                            </thead>
                            <tbody>
                              {templates.length === 0 ? (
                                <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>No templates uploaded yet.</td></tr>
                              ) : (
                                templates.map((row) => (
                                  <tr key={row.id} className="border-t border-gray-200">
                                    <td className="px-3 py-2">{labelize(row.artifact_type || 'unknown')}</td>
                                    <td className="px-3 py-2">
                                      <div className="font-medium text-gray-900">{row.template_name}</div>
                                      <div className="text-xs text-gray-600">{row.source_filename || 'inline text template'}</div>
                                    </td>
                                    <td className="px-3 py-2">{row.is_default ? 'Yes' : 'No'}</td>
                                    <td className="px-3 py-2">{formatDateTime(row.updated_at)}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedTab === 'pbc' && (
                  <ArtifactPanel
                    title="PBC Requests"
                    rows={pbc}
                    selectedId={selectedPbcId}
                    onSelect={setSelectedPbcId}
                    columns={[
                      { label: 'Title', value: (row: any) => row.title },
                      { label: 'Priority', value: (row: any) => labelize(row.priority) },
                      { label: 'Status', value: (row: any) => labelize(row.status) },
                      { label: 'Due', value: (row: any) => formatDate(row.due_date) }
                    ]}
                    emptyMessage="No PBC requests yet."
                    detail={
                      <div className="space-y-4">
                        {canWrite && (
                          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                            <h4 className="text-sm font-semibold text-gray-900">Create PBC Request</h4>
                            <input value={newPbcTitle} onChange={(e) => setNewPbcTitle(e.target.value)} placeholder="Title *" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                            <textarea value={newPbcDetails} onChange={(e) => setNewPbcDetails(e.target.value)} rows={3} placeholder="Request details *" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <select value={newPbcPriority} onChange={(e) => setNewPbcPriority(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                              </select>
                              <input type="date" value={newPbcDueDate} onChange={(e) => setNewPbcDueDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                            </div>
                            <div className="flex justify-end">
                              <button onClick={createPbc} disabled={saving || !newPbcTitle.trim() || !newPbcDetails.trim()} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
                                Add PBC
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedPbc && (
                          <div className="space-y-2">
                            <Info label="Request Details" value={selectedPbc.request_details || '—'} />
                            <Info label="Response Notes" value={selectedPbc.response_notes || '—'} />
                            {canWrite && (
                              <div className="flex gap-2">
                                <select value={pbcStatusDraft} onChange={(e) => setPbcStatusDraft(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                                  {pbcStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
                                </select>
                                <button onClick={() => updateArtifactStatus('pbc')} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50" disabled={saving}>Update</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    }
                  />
                )}

                {selectedTab === 'workpapers' && (
                  <ArtifactPanel
                    title="Workpapers"
                    rows={workpapers}
                    selectedId={selectedWorkpaperId}
                    onSelect={setSelectedWorkpaperId}
                    columns={[
                      { label: 'Title', value: (row: any) => row.title },
                      { label: 'Status', value: (row: any) => labelize(row.status) },
                      { label: 'Prepared By', value: (row: any) => row.prepared_by_name || '—' },
                      { label: 'Updated', value: (row: any) => formatDateTime(row.updated_at) }
                    ]}
                    emptyMessage="No workpapers yet."
                    detail={
                      <div className="space-y-4">
                        {canWrite && (
                          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                            <h4 className="text-sm font-semibold text-gray-900">Create Workpaper</h4>
                            <input value={newWorkpaperTitle} onChange={(e) => setNewWorkpaperTitle(e.target.value)} placeholder="Title *" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                            <input value={newWorkpaperObjective} onChange={(e) => setNewWorkpaperObjective(e.target.value)} placeholder="Objective" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                            <textarea value={newWorkpaperProcedure} onChange={(e) => setNewWorkpaperProcedure(e.target.value)} rows={3} placeholder="Procedure performed" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                            <textarea value={newWorkpaperConclusion} onChange={(e) => setNewWorkpaperConclusion(e.target.value)} rows={2} placeholder="Conclusion" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                            <div className="flex justify-end">
                              <button onClick={createWorkpaper} disabled={saving || !newWorkpaperTitle.trim()} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
                                Add Workpaper
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedWorkpaper && (
                          <div className="space-y-2">
                            <Info label="Objective" value={selectedWorkpaper.objective || '—'} />
                            <Info label="Procedure Performed" value={selectedWorkpaper.procedure_performed || '—'} />
                            <Info label="Conclusion" value={selectedWorkpaper.conclusion || '—'} />
                            <Info label="Reviewer Notes" value={selectedWorkpaper.reviewer_notes || '—'} />
                            {canWrite && (
                              <div className="flex gap-2">
                                <select value={workpaperStatusDraft} onChange={(e) => setWorkpaperStatusDraft(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                                  {workpaperStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
                                </select>
                                <button onClick={() => updateArtifactStatus('workpaper')} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50" disabled={saving}>Update</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    }
                  />
                )}

                {selectedTab === 'findings' && (
                  <ArtifactPanel
                    title="Findings"
                    rows={findings}
                    selectedId={selectedFindingId}
                    onSelect={setSelectedFindingId}
                    columns={[
                      { label: 'Title', value: (row: any) => row.title },
                      { label: 'Severity', value: (row: any) => labelize(row.severity) },
                      { label: 'Status', value: (row: any) => labelize(row.status) },
                      { label: 'Due', value: (row: any) => formatDate(row.due_date) }
                    ]}
                    emptyMessage="No findings yet."
                    detail={
                      <div className="space-y-4">
                        {canWrite && (
                          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                            <h4 className="text-sm font-semibold text-gray-900">Create Finding</h4>
                            <input value={newFindingTitle} onChange={(e) => setNewFindingTitle(e.target.value)} placeholder="Title *" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                            <textarea value={newFindingDescription} onChange={(e) => setNewFindingDescription(e.target.value)} rows={3} placeholder="Description *" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <select value={newFindingSeverity} onChange={(e) => setNewFindingSeverity(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                              </select>
                              <input type="date" value={newFindingDueDate} onChange={(e) => setNewFindingDueDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                            </div>
                            <textarea value={newFindingRecommendation} onChange={(e) => setNewFindingRecommendation(e.target.value)} rows={2} placeholder="Recommendation" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                            <div className="flex justify-end">
                              <button onClick={createFinding} disabled={saving || !newFindingTitle.trim() || !newFindingDescription.trim()} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
                                Add Finding
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedFinding && (
                          <div className="space-y-2">
                            <Info label="Description" value={selectedFinding.description || '—'} />
                            <Info label="Recommendation" value={selectedFinding.recommendation || '—'} />
                            <Info label="Management Response" value={selectedFinding.management_response || '—'} />
                            {canWrite && (
                              <div className="flex gap-2">
                                <select value={findingStatusDraft} onChange={(e) => setFindingStatusDraft(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                                  {findingStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
                                </select>
                                <button onClick={() => updateArtifactStatus('finding')} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50" disabled={saving}>Update</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    }
                  />
                )}

                {selectedTab === 'signoffs' && (
                  <div className="bg-white rounded-lg shadow-md p-5 space-y-4">
                    {signoffReadiness?.checklist && (
                      <div className="border border-gray-200 rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-900">Validation Checklist</h4>
                          <span className={`text-xs px-2 py-1 rounded-full ${signoffReadiness?.readiness?.ready_for_validation_package ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {signoffReadiness?.readiness?.ready_for_validation_package ? 'Ready for Customer Validation' : 'Pending Approvals or Open Findings'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {asList(signoffReadiness.checklist).map((item: any) => (
                            <div key={item.key} className="border border-gray-200 rounded px-3 py-2 text-sm">
                              <div className="font-medium text-gray-900">{item.label}</div>
                              <div className={item.approved ? 'text-green-700' : 'text-amber-700'}>
                                {item.approved ? 'Approved' : 'Pending'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {canWrite && (
                      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                        <h4 className="text-sm font-semibold text-gray-900">Record Sign-off</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <select value={newSignoffType} onChange={(e) => setNewSignoffType(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
                            {signoffTypes.map((type) => (
                              <option key={type} value={type}>{labelize(type)}</option>
                            ))}
                          </select>
                          <select value={newSignoffStatus} onChange={(e) => setNewSignoffStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </div>
                        <textarea value={newSignoffComments} onChange={(e) => setNewSignoffComments(e.target.value)} rows={2} placeholder={newSignoffType === 'auditor_firm_recommendation' ? 'Final recommendation comments (required)' : 'Comments'} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                        <div className="flex justify-between gap-2">
                          <button onClick={downloadValidationPackagePdf} disabled={saving} className="px-3 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-black disabled:opacity-50">
                            Download Validation PDF
                          </button>
                          <button onClick={createSignoff} disabled={saving} className="px-3 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50">
                            Add Sign-off
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-900">Sign-offs</h3>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Signed By</th>
                            <th className="px-3 py-2 text-left">Signed At</th>
                            <th className="px-3 py-2 text-left">Comments</th>
                          </tr>
                        </thead>
                        <tbody>
                          {signoffs.length === 0 ? (
                            <tr><td className="px-3 py-8 text-center text-gray-500" colSpan={5}>No sign-offs yet.</td></tr>
                          ) : (
                            signoffs.map((row) => (
                              <tr key={row.id} className="border-t border-gray-200">
                                <td className="px-3 py-2">{labelize(row.signoff_type)}</td>
                                <td className="px-3 py-2">{labelize(row.status)}</td>
                                <td className="px-3 py-2">{row.signed_by_name || '—'}</td>
                                <td className="px-3 py-2">{formatDateTime(row.signed_at)}</td>
                                <td className="px-3 py-2">{row.comments || '—'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{value}</div>
    </div>
  );
}

function ArtifactPanel({
  title,
  rows,
  selectedId,
  onSelect,
  columns,
  emptyMessage,
  actionLabel,
  action,
  detail
}: {
  title: string;
  rows: any[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  columns: Array<{ label: string; value: (row: any) => string }>;
  emptyMessage: string;
  actionLabel?: string;
  action?: () => void;
  detail?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-md p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {actionLabel && action && (
          <button onClick={action} className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700">
            {actionLabel}
          </button>
        )}
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th key={column.label} className="px-3 py-2 text-left">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-gray-500">{emptyMessage}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} onClick={() => onSelect(row.id)} className={`border-t border-gray-200 cursor-pointer ${selectedId === row.id ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
                  {columns.map((column) => (
                    <td key={column.label} className="px-3 py-2">{column.value(row)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {detail}
    </div>
  );
}
