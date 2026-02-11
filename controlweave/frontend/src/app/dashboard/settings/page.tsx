'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { integrationsAPI, rolesAPI, settingsAPI, usersAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, hasTierAtLeast } from '@/lib/access';
import { APP_POSITIONING_SHORT } from '@/lib/branding';

interface Permission {
  id: string;
  name: string;
  description: string;
}

interface PermissionGroup {
  [resource: string]: Permission[];
}

interface Role {
  id: string;
  name: string;
  description: string;
  is_system_role: boolean;
  permission_count: number;
  user_count: number;
  permissions: string[];
}

interface TeamUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: 'admin' | 'auditor' | 'user';
  is_active: boolean;
  created_at: string;
}

interface LLMSettings {
  hasAnthropicKey: boolean;
  hasOpenAIKey: boolean;
  hasGeminiKey: boolean;
  hasGrokKey: boolean;
  hasGroqKey: boolean;
  hasOllamaUrl: boolean;
  defaultProvider: string;
  defaultModel: string | null;
  settings: Record<string, any>;
}

interface SplunkSettings {
  configured: boolean;
  base_url: string | null;
  default_index: string | null;
  token_masked: string | null;
}

interface ContentPack {
  id: string;
  framework_code: string;
  pack_name: string;
  pack_version: string | null;
  license_reference: string;
  source_vendor: string | null;
  imported_at: string;
  imported_by_name: string | null;
  control_overrides: string;
  procedure_overrides: string;
  is_active: boolean;
}

interface ContentPackDraft {
  id: string;
  framework_code: string;
  pack_name: string;
  pack_version: string | null;
  source_vendor: string | null;
  license_reference: string | null;
  report_file_name: string;
  review_required: boolean;
  review_status: 'not_required' | 'pending' | 'approved' | 'rejected';
  attestation_confirmed: boolean;
  parse_summary?: {
    ai_assisted?: boolean;
    ai_error?: string | null;
    warnings?: string[];
    ai_summary?: {
      matched_controls?: number;
      unmatched_controls?: number;
      matched_procedures?: number;
      unmatched_procedures?: number;
    };
  };
  draft_control_count?: number;
  draft_procedure_count?: number;
  imported_pack_id?: string | null;
  imported_at?: string | null;
  created_at: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const canManageRoles = hasPermission(user, 'roles.manage');
  const canReadUsers = hasPermission(user, 'users.read') || hasPermission(user, 'users.manage');
  const canManageUsers = hasPermission(user, 'users.manage');
  const canManageSettings = hasPermission(user, 'settings.manage');
  const canUseSplunk = canManageSettings && hasTierAtLeast(user, 'starter');
  const defaultTab: 'roles' | 'llm' = canManageRoles ? 'roles' : 'llm';
  const [activeTab, setActiveTab] = useState<'roles' | 'llm'>('roles');

  // Roles state
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionGroup>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePerms, setNewRolePerms] = useState<string[]>([]);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [userRoleSelections, setUserRoleSelections] = useState<Record<string, string[]>>({});
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingUserRoles, setSavingUserRoles] = useState<string | null>(null);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [creatingAuditorSubroles, setCreatingAuditorSubroles] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserPrimaryRole, setNewUserPrimaryRole] = useState<'admin' | 'auditor' | 'user'>('user');

  // LLM state
  const [llmSettings, setLlmSettings] = useState<LLMSettings | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [grokKey, setGrokKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [defaultProvider, setDefaultProvider] = useState('claude');
  const [defaultModel, setDefaultModel] = useState('');
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  // Splunk integration state
  const [splunkSettings, setSplunkSettings] = useState<SplunkSettings | null>(null);
  const [splunkBaseUrl, setSplunkBaseUrl] = useState('');
  const [splunkApiToken, setSplunkApiToken] = useState('');
  const [splunkDefaultIndex, setSplunkDefaultIndex] = useState('');
  const [splunkTesting, setSplunkTesting] = useState(false);
  const [splunkSaving, setSplunkSaving] = useState(false);
  const [contentPacks, setContentPacks] = useState<ContentPack[]>([]);
  const [contentPackDrafts, setContentPackDrafts] = useState<ContentPackDraft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [selectedDraftJson, setSelectedDraftJson] = useState('');
  const [selectedDraftReviewRequired, setSelectedDraftReviewRequired] = useState(false);
  const [draftLoadingId, setDraftLoadingId] = useState<string | null>(null);
  const [draftUploading, setDraftUploading] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftActionId, setDraftActionId] = useState<string | null>(null);
  const [draftReportFile, setDraftReportFile] = useState<File | null>(null);
  const [draftFrameworkCode, setDraftFrameworkCode] = useState('');
  const [draftPackName, setDraftPackName] = useState('');
  const [draftPackVersion, setDraftPackVersion] = useState('');
  const [draftSourceVendor, setDraftSourceVendor] = useState('');
  const [draftLicenseReference, setDraftLicenseReference] = useState('');
  const [draftReviewRequired, setDraftReviewRequired] = useState(true);
  const [draftAiAssist, setDraftAiAssist] = useState(true);
  const [draftProvider, setDraftProvider] = useState('');
  const [draftModel, setDraftModel] = useState('');
  const [contentPackJson, setContentPackJson] = useState('');
  const [contentPackImporting, setContentPackImporting] = useState(false);

  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam === 'llm') {
      setActiveTab('llm');
    } else {
      setActiveTab(defaultTab);
    }
    if (canManageRoles) {
      loadRoles();
    } else {
      setLoading(false);
    }

    if (canManageSettings) {
      loadLLMSettings();
      loadContentPacks();
      loadContentPackDrafts();
      if (canUseSplunk) {
        loadSplunkSettings();
      } else {
        setSplunkSettings(null);
      }
    } else {
      setLlmLoading(false);
    }
  }, [defaultTab, canManageRoles, canManageSettings, canUseSplunk]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ===== ROLES =====
  const loadTeamUsers = async () => {
    if (!canReadUsers) {
      setTeamUsers([]);
      setUserRoleSelections({});
      return;
    }

    const usersRes = await usersAPI.getOrgUsers();
    const users: TeamUser[] = usersRes.data?.data || [];
    setTeamUsers(users);

    const roleEntries = await Promise.all(
      users.map(async (teamUser) => {
        try {
          const userRolesRes = await rolesAPI.getUserRoles(teamUser.id);
          const roleIds = Array.isArray(userRolesRes.data?.data)
            ? userRolesRes.data.data.map((role: Role) => role.id)
            : [];
          return [teamUser.id, roleIds] as const;
        } catch (error) {
          return [teamUser.id, []] as const;
        }
      })
    );

    const selectionMap: Record<string, string[]> = {};
    for (const [userId, roleIds] of roleEntries) {
      selectionMap[userId] = roleIds;
    }
    setUserRoleSelections(selectionMap);
  };

  const loadRoles = async () => {
    if (!canManageRoles) {
      setLoading(false);
      return;
    }
    try {
      const [rolesRes, permsRes] = await Promise.all([
        rolesAPI.getAll(),
        rolesAPI.getAllPermissions()
      ]);
      setRoles(rolesRes.data.data || []);
      setAllPermissions(permsRes.data.data);
      await loadTeamUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load roles and team users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!canManageRoles) return;
    if (!newRoleName.trim()) return;
    try {
      await rolesAPI.create({ name: newRoleName.trim(), description: newRoleDesc.trim(), permissions: newRolePerms });
      showToast(`Role "${newRoleName}" created`);
      setCreateModalOpen(false);
      setNewRoleName(''); setNewRoleDesc(''); setNewRolePerms([]);
      await loadRoles();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create role');
    }
  };

  const handleEdit = async () => {
    if (!canManageRoles) return;
    if (!editRole) return;
    try {
      await rolesAPI.update(editRole.id, { name: editRole.name, description: editRole.description, permissions: editPerms });
      showToast('Role updated');
      setEditRole(null);
      await loadRoles();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManageRoles) return;
    try {
      await rolesAPI.remove(id);
      showToast('Role deleted');
      setDeleteRoleId(null);
      await loadRoles();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete role');
      setDeleteRoleId(null);
    }
  };

  const createUser = async () => {
    if (!canManageUsers) {
      setError('You need users.manage permission to create team members');
      return;
    }
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword) {
      setError('Name, email, and password are required to create a user');
      return;
    }

    try {
      setCreatingUser(true);
      await usersAPI.create({
        full_name: newUserName.trim(),
        email: newUserEmail.trim().toLowerCase(),
        password: newUserPassword,
        primary_role: newUserPrimaryRole,
        auto_generate_auditor_subroles: true
      });
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserPrimaryRole('user');
      showToast('Team member created');
      await loadRoles();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const saveUserRoles = async (userId: string) => {
    const selectedRoleIds = userRoleSelections[userId] || [];
    if (selectedRoleIds.length === 0) {
      setError('Select at least one role for the user');
      return;
    }

    try {
      setSavingUserRoles(userId);
      await rolesAPI.assignRole({
        userId,
        roleIds: selectedRoleIds
      });
      showToast('User roles updated');
      await loadTeamUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user roles');
    } finally {
      setSavingUserRoles(null);
    }
  };

  const toggleUserActive = async (teamUser: TeamUser) => {
    if (!canManageUsers) {
      setError('You need users.manage permission to activate or deactivate users');
      return;
    }
    try {
      setUpdatingUser(teamUser.id);
      await usersAPI.update(teamUser.id, {
        is_active: !teamUser.is_active
      });
      showToast(teamUser.is_active ? 'User deactivated' : 'User activated');
      await loadTeamUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user status');
    } finally {
      setUpdatingUser(null);
    }
  };

  const bootstrapAuditorSubroles = async () => {
    try {
      setCreatingAuditorSubroles(true);
      await rolesAPI.bootstrapAuditorSubroles();
      showToast('Auditor sub-roles are ready');
      await loadRoles();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate auditor sub-roles');
    } finally {
      setCreatingAuditorSubroles(false);
    }
  };

  const togglePerm = (perms: string[], setPerms: (p: string[]) => void, perm: string) => {
    setPerms(perms.includes(perm) ? perms.filter(p => p !== perm) : [...perms, perm]);
  };

  // ===== LLM Settings =====
  const loadLLMSettings = async () => {
    if (!canManageSettings) {
      setLlmLoading(false);
      return;
    }
    try {
      setLlmLoading(true);
      const res = await settingsAPI.getLLMConfig();
      setLlmSettings(res.data.data);
      setDefaultProvider(res.data.data.defaultProvider || 'claude');
      setDefaultModel(res.data.data.defaultModel || '');
    } catch (err: any) {
      // OK if settings don't exist yet
    } finally {
      setLlmLoading(false);
    }
  };

  const saveLLMSettings = async () => {
    if (!canManageSettings) return;
    try {
      const data: any = { default_provider: defaultProvider };
      if (defaultModel) data.default_model = defaultModel;
      if (anthropicKey) data.anthropic_api_key = anthropicKey;
      if (openaiKey) data.openai_api_key = openaiKey;
      if (geminiKey) data.gemini_api_key = geminiKey;
      if (grokKey) data.xai_api_key = grokKey;
      if (groqKey) data.groq_api_key = groqKey;
      if (ollamaUrl) data.ollama_base_url = ollamaUrl;
      await settingsAPI.updateLLMConfig(data);
      showToast('LLM settings saved');
      setAnthropicKey('');
      setOpenaiKey('');
      setGeminiKey('');
      setGrokKey('');
      setGroqKey('');
      setOllamaUrl('');
      loadLLMSettings();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save LLM settings');
    }
  };

  const testKey = async (provider: string, key: string) => {
    if (!canManageSettings) return;
    const hasExisting =
      (provider === 'claude' && llmSettings?.hasAnthropicKey) ||
      (provider === 'openai' && llmSettings?.hasOpenAIKey) ||
      (provider === 'gemini' && llmSettings?.hasGeminiKey) ||
      (provider === 'grok' && llmSettings?.hasGrokKey) ||
      (provider === 'groq' && llmSettings?.hasGroqKey) ||
      (provider === 'ollama' && llmSettings?.hasOllamaUrl);

    if (!key && !hasExisting) {
      setError('Enter an API key first');
      return;
    }
    setTestingProvider(provider);
    try {
      if (!key) {
        showToast('Key already configured - save new key to test it');
        return;
      }
      await settingsAPI.testLLMKey({ provider, apiKey: key });
      showToast(`${provider} key verified!`);
    } catch (err: any) {
      setError(err.response?.data?.details || err.response?.data?.error || 'Key validation failed');
    } finally {
      setTestingProvider(null);
    }
  };

  const removeKey = async (provider: string) => {
    if (!canManageSettings) return;
    try {
      await settingsAPI.removeLLMKey(provider);
      showToast(`${provider} key removed`);
      loadLLMSettings();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove key');
    }
  };

  const loadContentPacks = async () => {
    if (!canManageSettings) return;
    try {
      const res = await settingsAPI.getContentPacks();
      setContentPacks(res.data.data || []);
    } catch (err: any) {
      // Ignore for older deployments lacking migration.
    }
  };

  const loadContentPackDrafts = async () => {
    if (!canManageSettings) return;
    try {
      const res = await settingsAPI.getContentPackDrafts();
      const drafts: ContentPackDraft[] = res.data.data || [];
      setContentPackDrafts(drafts);
      if (selectedDraftId && !drafts.find((draft) => draft.id === selectedDraftId)) {
        setSelectedDraftId(null);
        setSelectedDraftJson('');
      }
    } catch (err: any) {
      // Ignore for older deployments lacking migration.
    }
  };

  const loadDraftDetail = async (draftId: string) => {
    if (!canManageSettings) return;
    setDraftLoadingId(draftId);
    try {
      const res = await settingsAPI.getContentPackDraft(draftId);
      const draft = res.data?.data;
      setSelectedDraftId(draftId);
      setSelectedDraftReviewRequired(Boolean(draft?.review_required));
      setSelectedDraftJson(JSON.stringify(draft?.draft_pack || {}, null, 2));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load draft details');
    } finally {
      setDraftLoadingId(null);
    }
  };

  const uploadContentPackDraft = async () => {
    if (!canManageSettings) return;
    if (!draftReportFile) {
      setError('Select a report file to upload.');
      return;
    }
    if (!draftFrameworkCode.trim()) {
      setError('Framework code is required (example: iso_27001).');
      return;
    }

    setDraftUploading(true);
    try {
      const formData = new FormData();
      formData.append('report', draftReportFile);
      formData.append('framework_code', draftFrameworkCode.trim());
      if (draftPackName.trim()) formData.append('pack_name', draftPackName.trim());
      if (draftPackVersion.trim()) formData.append('pack_version', draftPackVersion.trim());
      if (draftSourceVendor.trim()) formData.append('source_vendor', draftSourceVendor.trim());
      if (draftLicenseReference.trim()) formData.append('license_reference', draftLicenseReference.trim());
      formData.append('review_required', String(draftReviewRequired));
      formData.append('ai_assist', String(draftAiAssist));
      if (draftProvider.trim()) formData.append('provider', draftProvider.trim());
      if (draftModel.trim()) formData.append('model', draftModel.trim());

      const res = await settingsAPI.uploadContentPackDraft(formData);
      showToast('Draft created from report upload');
      await loadContentPackDrafts();
      const draftId = res.data?.data?.id;
      if (draftId) {
        await loadDraftDetail(draftId);
      }
      setDraftReportFile(null);
      setDraftPackName('');
      setDraftPackVersion('');
      setDraftSourceVendor('');
      setDraftLicenseReference('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload and draft content pack');
    } finally {
      setDraftUploading(false);
    }
  };

  const saveSelectedDraft = async () => {
    if (!canManageSettings || !selectedDraftId) return;
    setDraftSaving(true);
    try {
      const parsedPack = JSON.parse(selectedDraftJson);
      await settingsAPI.updateContentPackDraft(selectedDraftId, {
        pack: parsedPack,
        review_required: selectedDraftReviewRequired
      });
      showToast('Draft updated');
      await loadContentPackDrafts();
      await loadDraftDetail(selectedDraftId);
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setError('Draft JSON is invalid.');
      } else {
        setError(err.response?.data?.error || 'Failed to save draft');
      }
    } finally {
      setDraftSaving(false);
    }
  };

  const attestDraft = async (draftId: string) => {
    if (!canManageSettings) return;
    setDraftActionId(draftId);
    try {
      await settingsAPI.attestContentPackDraft(draftId, { confirm: true });
      showToast('Licensing attestation recorded');
      await loadContentPackDrafts();
      if (selectedDraftId === draftId) {
        await loadDraftDetail(draftId);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to attest draft');
    } finally {
      setDraftActionId(null);
    }
  };

  const reviewDraft = async (draftId: string, action: 'approve' | 'reject') => {
    if (!canManageSettings) return;
    setDraftActionId(draftId);
    try {
      await settingsAPI.reviewContentPackDraft(draftId, { action });
      showToast(action === 'approve' ? 'Draft approved' : 'Draft rejected');
      await loadContentPackDrafts();
      if (selectedDraftId === draftId) {
        await loadDraftDetail(draftId);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update review status');
    } finally {
      setDraftActionId(null);
    }
  };

  const importDraft = async (draftId: string) => {
    if (!canManageSettings) return;
    setDraftActionId(draftId);
    try {
      const res = await settingsAPI.importContentPackDraft(draftId);
      const summary = res.data?.data?.import?.summary;
      showToast(
        summary
          ? `Draft imported (${summary.controls_applied} control overrides, ${summary.procedures_applied} procedure overrides)`
          : 'Draft imported'
      );
      await Promise.all([loadContentPackDrafts(), loadContentPacks()]);
      if (selectedDraftId === draftId) {
        await loadDraftDetail(draftId);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to import draft');
    } finally {
      setDraftActionId(null);
    }
  };

  const importContentPack = async () => {
    if (!canManageSettings) return;
    if (!contentPackJson.trim()) {
      setError('Paste a content pack JSON payload first.');
      return;
    }
    setContentPackImporting(true);
    try {
      const parsed = JSON.parse(contentPackJson);
      const payload = parsed?.pack ? parsed : { pack: parsed };
      const res = await settingsAPI.importContentPack(payload);
      const summary = res.data?.data?.summary;
      showToast(
        summary
          ? `Pack imported (${summary.controls_applied} control overrides, ${summary.procedures_applied} procedure overrides)`
          : 'Content pack imported'
      );
      setContentPackJson('');
      await loadContentPacks();
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON format for content pack.');
      } else {
        setError(err.response?.data?.error || 'Failed to import content pack');
      }
    } finally {
      setContentPackImporting(false);
    }
  };

  const removeContentPack = async (id: string) => {
    if (!canManageSettings) return;
    try {
      await settingsAPI.deleteContentPack(id);
      showToast('Content pack removed');
      await loadContentPacks();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove content pack');
    }
  };

  const loadSplunkSettings = async () => {
    if (!canUseSplunk) {
      setSplunkSettings(null);
      return;
    }
    try {
      const res = await integrationsAPI.getSplunkConfig();
      const data = res.data.data;
      setSplunkSettings(data);
      setSplunkBaseUrl(data?.base_url || '');
      setSplunkDefaultIndex(data?.default_index || '');
    } catch (err: any) {
      // Silent fallback in case endpoint is unavailable in older deployments.
    }
  };

  const saveSplunkSettings = async () => {
    if (!canUseSplunk) return;
    try {
      setSplunkSaving(true);
      const payload: { base_url?: string | null; api_token?: string | null; default_index?: string | null } = {
        base_url: splunkBaseUrl || null,
        default_index: splunkDefaultIndex || null
      };
      if (splunkApiToken) payload.api_token = splunkApiToken;

      await integrationsAPI.updateSplunkConfig(payload);
      setSplunkApiToken('');
      showToast('Splunk settings saved');
      await loadSplunkSettings();
    } catch (err: any) {
      setError(err.response?.data?.details || err.response?.data?.error || 'Failed to save Splunk settings');
    } finally {
      setSplunkSaving(false);
    }
  };

  const testSplunkSettings = async () => {
    if (!canUseSplunk) return;
    try {
      setSplunkTesting(true);
      await integrationsAPI.testSplunkConfig({
        base_url: splunkBaseUrl || undefined,
        api_token: splunkApiToken || undefined,
        default_index: splunkDefaultIndex || undefined
      });
      showToast('Splunk connection verified');
    } catch (err: any) {
      setError(err.response?.data?.details || err.response?.data?.error || 'Splunk connection test failed');
    } finally {
      setSplunkTesting(false);
    }
  };

  const removeSplunkSettings = async () => {
    if (!canUseSplunk) return;
    try {
      await integrationsAPI.removeSplunkConfig();
      setSplunkApiToken('');
      setSplunkBaseUrl('');
      setSplunkDefaultIndex('');
      showToast('Splunk settings removed');
      await loadSplunkSettings();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove Splunk settings');
    }
  };

  const PermissionCheckboxes = ({ selected, onToggle }: { selected: string[]; onToggle: (perm: string) => void }) => (
    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
      {Object.entries(allPermissions).map(([resource, perms]) => (
        <div key={resource}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{resource}</p>
          <div className="grid grid-cols-2 gap-1">
            {perms.map((p) => (
              <label key={p.name} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={selected.includes(p.name)} onChange={() => onToggle(p.name)} className="rounded" />
                <span className="text-gray-700">{p.name}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const organizationTier = 'free';
  const PRO_URL = process.env.NEXT_PUBLIC_PRO_URL || 'https://app.controlweave.io';

  if (!canManageRoles && !canManageSettings) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600 mt-2">{APP_POSITIONING_SHORT}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
            You do not currently have access to organization settings. Ask an administrator to grant
            <code className="mx-1">roles.manage</code>
            or
            <code className="mx-1">settings.manage</code>
            permissions.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Toast */}
        {toast && (
          <div className="fixed top-6 right-6 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">{toast}</div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
            <button onClick={() => setError('')} className="float-right text-red-500 hover:text-red-700">x</button>
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">{APP_POSITIONING_SHORT}</p>
        </div>

        {/* Plan — Community Edition */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Plan</h2>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
              Community Edition · Free Tier
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Community Edition (Free)</h3>
              <ul className="text-gray-600 space-y-1">
                <li>Up to 2 compliance frameworks</li>
                <li>3 AI requests per month</li>
                <li>Core dashboard, controls, and assessments</li>
                <li>AI Copilot chat</li>
                <li>Open source — self-host for free</li>
              </ul>
            </div>
            <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
              <h3 className="font-semibold text-purple-900 mb-2">ControlWeave Pro</h3>
              <ul className="text-purple-800 space-y-1 mb-3">
                <li>All frameworks + unlimited AI</li>
                <li>CMDB, vulnerabilities, SBOM/AIBOM</li>
                <li>Evidence management and reports</li>
                <li>Auditor Workspace, webhooks, integrations</li>
              </ul>
              <a
                href={PRO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full text-center bg-purple-600 text-white text-xs px-4 py-2 rounded hover:bg-purple-700 font-medium"
              >
                Get ControlWeave Pro →
              </a>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {canManageRoles && (
              <button
                onClick={() => setActiveTab('roles')}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'roles' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Roles & Permissions
              </button>
            )}
            {canManageSettings && (
              <button
                onClick={() => setActiveTab('llm')}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'llm' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                LLM Configuration
              </button>
            )}
          </nav>
        </div>

        {/* ===== LLM TAB ===== */}
        {activeTab === 'llm' && canManageSettings && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">LLM API Keys (BYOK)</h2>
              <p className="text-sm text-gray-500 mb-2">Bring your own API keys to power AI features. Keys are stored encrypted.</p>
              <div className="flex flex-wrap gap-2 mb-5 text-xs">
                <span className="bg-green-50 border border-green-200 text-green-700 px-2 py-1 rounded">✅ Gemini — Free tier (aistudio.google.com)</span>
                <span className="bg-green-50 border border-green-200 text-green-700 px-2 py-1 rounded">✅ Groq — Free tier (console.groq.com)</span>
                <span className="bg-green-50 border border-green-200 text-green-700 px-2 py-1 rounded">✅ Ollama — Self-hosted, always free</span>
                <span className="bg-gray-50 border border-gray-200 text-gray-500 px-2 py-1 rounded">💳 Claude, OpenAI, xAI Grok — Paid API only</span>
              </div>

              {/* Anthropic */}
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🟣</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">Anthropic (Claude)</h3>
                      <p className="text-xs text-gray-500">claude-sonnet-4-5, claude-haiku-4-5</p>
                    </div>
                  </div>
                  {llmSettings?.hasAnthropicKey ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Configured</span>
                      <span className="text-xs text-gray-400">{llmSettings.settings?.anthropic_api_key?.masked}</span>
                      <button onClick={() => removeKey('claude')} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Not configured</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-api03-..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => testKey('claude', anthropicKey)}
                    disabled={!anthropicKey || testingProvider === 'claude'}
                    className="px-4 py-2 text-sm border border-purple-600 text-purple-600 rounded-md hover:bg-purple-50 disabled:opacity-50"
                  >
                    {testingProvider === 'claude' ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>

              {/* OpenAI */}
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🟢</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">OpenAI</h3>
                      <p className="text-xs text-gray-500">GPT-4o, GPT-4o-mini</p>
                    </div>
                  </div>
                  {llmSettings?.hasOpenAIKey ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Configured</span>
                      <span className="text-xs text-gray-400">{llmSettings.settings?.openai_api_key?.masked}</span>
                      <button onClick={() => removeKey('openai')} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Not configured</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => testKey('openai', openaiKey)}
                    disabled={!openaiKey || testingProvider === 'openai'}
                    className="px-4 py-2 text-sm border border-purple-600 text-purple-600 rounded-md hover:bg-purple-50 disabled:opacity-50"
                  >
                    {testingProvider === 'openai' ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>

              {/* Gemini */}
              <div className="border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔵</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">Google Gemini</h3>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Free Tier Available</span>
                      </div>
                      <p className="text-xs text-gray-500">gemini-2.0-flash (free), gemini-2.5-pro · Get a free key at aistudio.google.com</p>
                    </div>
                  </div>
                  {llmSettings?.hasGeminiKey ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Configured</span>
                      <span className="text-xs text-gray-400">{llmSettings.settings?.gemini_api_key?.masked}</span>
                      <button onClick={() => removeKey('gemini')} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Not configured</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIza..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => testKey('gemini', geminiKey)}
                    disabled={!geminiKey || testingProvider === 'gemini'}
                    className="px-4 py-2 text-sm border border-purple-600 text-purple-600 rounded-md hover:bg-purple-50 disabled:opacity-50"
                  >
                    {testingProvider === 'gemini' ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>

              {/* Grok */}
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚫</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">xAI Grok</h3>
                      <p className="text-xs text-gray-500">grok-3-latest, grok-4-latest</p>
                    </div>
                  </div>
                  {llmSettings?.hasGrokKey ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Configured</span>
                      <span className="text-xs text-gray-400">{llmSettings.settings?.xai_api_key?.masked}</span>
                      <button onClick={() => removeKey('grok')} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Not configured</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={grokKey}
                    onChange={(e) => setGrokKey(e.target.value)}
                    placeholder="xai-..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => testKey('grok', grokKey)}
                    disabled={!grokKey || testingProvider === 'grok'}
                    className="px-4 py-2 text-sm border border-purple-600 text-purple-600 rounded-md hover:bg-purple-50 disabled:opacity-50"
                  >
                    {testingProvider === 'grok' ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>

              {/* Groq (Free Tier) */}
              <div className="border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">Groq</h3>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Free Tier Available</span>
                      </div>
                      <p className="text-xs text-gray-500">llama-3.3-70b-versatile, llama-3.1-8b-instant · Get a free key at console.groq.com</p>
                    </div>
                  </div>
                  {llmSettings?.hasGroqKey ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Configured</span>
                      <span className="text-xs text-gray-400">{llmSettings.settings?.groq_api_key?.masked}</span>
                      <button onClick={() => removeKey('groq')} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Not configured</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder="gsk_..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => testKey('groq', groqKey)}
                    disabled={!groqKey || testingProvider === 'groq'}
                    className="px-4 py-2 text-sm border border-purple-600 text-purple-600 rounded-md hover:bg-purple-50 disabled:opacity-50"
                  >
                    {testingProvider === 'groq' ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>

              {/* Ollama (Self-Hosted) */}
              <div className="border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🏠</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">Ollama</h3>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Self-Hosted / Free</span>
                      </div>
                      <p className="text-xs text-gray-500">llama3.2, mistral, phi3 · Run locally with: ollama serve</p>
                    </div>
                  </div>
                  {llmSettings?.hasOllamaUrl ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Configured</span>
                      <span className="text-xs text-gray-400">{llmSettings.settings?.ollama_base_url?.value}</span>
                      <button onClick={() => removeKey('ollama')} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Not configured</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="http://localhost:11434/v1"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => testKey('ollama', ollamaUrl)}
                    disabled={!ollamaUrl || testingProvider === 'ollama'}
                    className="px-4 py-2 text-sm border border-purple-600 text-purple-600 rounded-md hover:bg-purple-50 disabled:opacity-50"
                  >
                    {testingProvider === 'ollama' ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>

              {/* Default Provider + Model */}
              <div className="border border-gray-200 rounded-lg p-4 mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Default Provider</label>
                  <select
                    value={defaultProvider}
                    onChange={(e) => setDefaultProvider(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="claude">Claude (Anthropic)</option>
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="grok">xAI Grok</option>
                    <option value="groq">Groq (Free Tier)</option>
                    <option value="ollama">Ollama (Self-Hosted)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Model <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    placeholder={
                      defaultProvider === 'claude' ? 'e.g. claude-sonnet-4-5-20250929' :
                      defaultProvider === 'openai' ? 'e.g. gpt-4o' :
                      defaultProvider === 'gemini' ? 'e.g. gemini-2.0-flash' :
                      defaultProvider === 'grok' ? 'e.g. grok-3-latest' :
                      defaultProvider === 'groq' ? 'e.g. llama-3.3-70b-versatile' :
                      defaultProvider === 'ollama' ? 'e.g. llama3.2' :
                      'Model name'
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Leave blank to use the provider default. Override per request where needed.</p>
                </div>
              </div>

              <button
                onClick={saveLLMSettings}
                className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700 transition-colors font-medium"
              >
                Save LLM Settings
              </button>

              <div className="border-t border-gray-200 mt-8 pt-8">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Splunk Evidence Connector</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Connect Splunk to import search results directly as Evidence JSON artifacts.
                </p>

                {canUseSplunk ? (
                  <div className="border border-gray-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">Connection</h3>
                        <p className="text-xs text-gray-500">Uses Splunk management API (`/services/...`) with bearer token</p>
                      </div>
                      {splunkSettings?.configured ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Configured</span>
                          {splunkSettings?.token_masked && (
                            <span className="text-xs text-gray-400">{splunkSettings.token_masked}</span>
                          )}
                          <button onClick={removeSplunkSettings} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                        </div>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Not configured</span>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Splunk Base URL</label>
                        <input
                          type="text"
                          value={splunkBaseUrl}
                          onChange={(e) => setSplunkBaseUrl(e.target.value)}
                          placeholder="https://your-splunk-host:8089"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">API Token</label>
                        <input
                          type="password"
                          value={splunkApiToken}
                          onChange={(e) => setSplunkApiToken(e.target.value)}
                          placeholder="Splunk bearer token"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Default Index (optional)</label>
                        <input
                          type="text"
                          value={splunkDefaultIndex}
                          onChange={(e) => setSplunkDefaultIndex(e.target.value)}
                          placeholder="main"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={testSplunkSettings}
                          disabled={splunkTesting || (!splunkBaseUrl && !splunkSettings?.base_url)}
                          className="px-4 py-2 text-sm border border-purple-600 text-purple-600 rounded-md hover:bg-purple-50 disabled:opacity-50"
                        >
                          {splunkTesting ? 'Testing...' : 'Test Connection'}
                        </button>
                        <button
                          onClick={saveSplunkSettings}
                          disabled={splunkSaving}
                          className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                        >
                          {splunkSaving ? 'Saving...' : 'Save Splunk Settings'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
                    Splunk integration is available on Starter tier and above.
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 mt-8 pt-8">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Licensed Content Packs</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Upload a licensed report, draft a content pack with AI assistance, confirm licensing rights, optionally require approval, and then import.
                </p>

                <div className="border border-gray-200 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">1. Upload Report and Draft Pack</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Report File</label>
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.txt,.csv,.json,.md,.xml,.log"
                        onChange={(e) => setDraftReportFile(e.target.files?.[0] || null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Framework Code</label>
                      <input
                        type="text"
                        value={draftFrameworkCode}
                        onChange={(e) => setDraftFrameworkCode(e.target.value)}
                        placeholder="iso_27001"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Pack Name (optional)</label>
                      <input
                        type="text"
                        value={draftPackName}
                        onChange={(e) => setDraftPackName(e.target.value)}
                        placeholder="ISO Licensed Pack"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Pack Version (optional)</label>
                      <input
                        type="text"
                        value={draftPackVersion}
                        onChange={(e) => setDraftPackVersion(e.target.value)}
                        placeholder="2026-Q1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Source Vendor (optional)</label>
                      <input
                        type="text"
                        value={draftSourceVendor}
                        onChange={(e) => setDraftSourceVendor(e.target.value)}
                        placeholder="Customer Vendor"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">License Reference</label>
                      <input
                        type="text"
                        value={draftLicenseReference}
                        onChange={(e) => setDraftLicenseReference(e.target.value)}
                        placeholder="Contract-123"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">AI Provider (optional)</label>
                      <select
                        value={draftProvider}
                        onChange={(e) => setDraftProvider(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Use org default</option>
                        <option value="claude">Claude</option>
                        <option value="openai">OpenAI</option>
                        <option value="gemini">Gemini</option>
                        <option value="grok">Grok</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">AI Model (optional)</label>
                      <input
                        type="text"
                        value={draftModel}
                        onChange={(e) => setDraftModel(e.target.value)}
                        placeholder="Leave blank for default"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={draftAiAssist}
                        onChange={(e) => setDraftAiAssist(e.target.checked)}
                        className="rounded"
                      />
                      AI-assisted draft
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={draftReviewRequired}
                        onChange={(e) => setDraftReviewRequired(e.target.checked)}
                        className="rounded"
                      />
                      Require review approval before import
                    </label>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={uploadContentPackDraft}
                      disabled={draftUploading}
                      className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                    >
                      {draftUploading ? 'Uploading...' : 'Upload and Draft'}
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900">2. Draft Queue</h3>
                  </div>
                  {contentPackDrafts.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-gray-500">No draft packs created yet.</div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {contentPackDrafts.map((draft) => (
                        <div key={draft.id} className="px-4 py-3 flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900">{draft.pack_name || 'Untitled Draft'}</span>
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{draft.framework_code}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                draft.attestation_confirmed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {draft.attestation_confirmed ? 'attested' : 'not attested'}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                draft.review_status === 'approved'
                                  ? 'bg-green-100 text-green-700'
                                  : draft.review_status === 'rejected'
                                    ? 'bg-red-100 text-red-700'
                                    : draft.review_status === 'pending'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-gray-100 text-gray-600'
                              }`}>
                                review: {draft.review_status}
                              </span>
                              {draft.imported_pack_id && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">imported</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              File: {draft.report_file_name} | Draft entries: {draft.draft_control_count || 0} controls, {draft.draft_procedure_count || 0} procedures
                            </p>
                            {!!draft.parse_summary?.warnings?.length && (
                              <p className="text-xs text-amber-700 mt-1">Warnings: {draft.parse_summary.warnings[0]}</p>
                            )}
                            {draft.parse_summary?.ai_error && (
                              <p className="text-xs text-red-700 mt-1">AI draft issue: {draft.parse_summary.ai_error}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 justify-end">
                            <button
                              onClick={() => loadDraftDetail(draft.id)}
                              disabled={draftLoadingId === draft.id}
                              className="text-xs border border-gray-300 px-2 py-1 rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                              {draftLoadingId === draft.id ? 'Loading...' : 'Open'}
                            </button>
                            {!draft.attestation_confirmed && !draft.imported_pack_id && (
                              <button
                                onClick={() => attestDraft(draft.id)}
                                disabled={draftActionId === draft.id}
                                className="text-xs border border-green-600 text-green-700 px-2 py-1 rounded hover:bg-green-50 disabled:opacity-50"
                              >
                                Attest
                              </button>
                            )}
                            {draft.review_required && !draft.imported_pack_id && (
                              <>
                                <button
                                  onClick={() => reviewDraft(draft.id, 'approve')}
                                  disabled={draftActionId === draft.id}
                                  className="text-xs border border-blue-600 text-blue-700 px-2 py-1 rounded hover:bg-blue-50 disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => reviewDraft(draft.id, 'reject')}
                                  disabled={draftActionId === draft.id}
                                  className="text-xs border border-red-600 text-red-700 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {!draft.imported_pack_id && (
                              <button
                                onClick={() => importDraft(draft.id)}
                                disabled={draftActionId === draft.id}
                                className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 disabled:opacity-50"
                              >
                                Import
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedDraftId && (
                  <div className="border border-gray-200 rounded-lg p-4 mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">3. Review/Edit Selected Draft</h3>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 mb-3">
                      <input
                        type="checkbox"
                        checked={selectedDraftReviewRequired}
                        onChange={(e) => setSelectedDraftReviewRequired(e.target.checked)}
                        className="rounded"
                      />
                      Require approval before import
                    </label>
                    <textarea
                      value={selectedDraftJson}
                      onChange={(e) => setSelectedDraftJson(e.target.value)}
                      rows={12}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-purple-500"
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={saveSelectedDraft}
                        disabled={draftSaving}
                        className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                      >
                        {draftSaving ? 'Saving...' : 'Save Draft'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="border border-gray-200 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Fallback: Direct JSON Import</h3>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pack JSON</label>
                  <textarea
                    value={contentPackJson}
                    onChange={(e) => setContentPackJson(e.target.value)}
                    rows={8}
                    placeholder='{"pack":{"pack_name":"ISO Licensed Pack","framework_code":"iso_27001","license_reference":"Contract-123","controls":[{"control_id":"A.5.12","description":"..."}]}}'
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={importContentPack}
                      disabled={contentPackImporting}
                      className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                    >
                      {contentPackImporting ? 'Importing...' : 'Import Content Pack'}
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900">4. Imported Packs</h3>
                  </div>
                  {contentPacks.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-gray-500">
                      No licensed content packs imported yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {contentPacks.map((pack) => (
                        <div key={pack.id} className="px-4 py-3 flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900">{pack.pack_name}</span>
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{pack.framework_code}</span>
                              {pack.pack_version && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{pack.pack_version}</span>
                              )}
                              {!pack.is_active && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">inactive</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              License: {pack.license_reference}
                              {pack.source_vendor ? ` | Vendor: ${pack.source_vendor}` : ''}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Overrides: {pack.control_overrides} controls, {pack.procedure_overrides} procedures
                            </p>
                          </div>
                          {pack.is_active && (
                            <button
                              onClick={() => removeContentPack(pack.id)}
                              className="text-xs text-red-600 hover:text-red-800 font-medium"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== ROLES TAB ===== */}
        {activeTab === 'roles' && canManageRoles && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-600">
                One organization can hold many users. Admins can create team members and assign role stacks.
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={bootstrapAuditorSubroles}
                  disabled={creatingAuditorSubroles}
                  className="border border-purple-600 text-purple-700 px-4 py-2 rounded-md hover:bg-purple-50 transition-colors disabled:opacity-50"
                >
                  {creatingAuditorSubroles ? 'Generating...' : 'Generate Auditor Sub-Roles'}
                </button>
                <button
                  onClick={() => { setCreateModalOpen(true); setNewRolePerms([]); }}
                  className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700 transition-colors"
                >
                  + Create Role
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-purple-600">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Permissions</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Users</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {roles.map((role) => (
                        <tr key={role.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{role.name}</span>
                              {role.is_system_role && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">System</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{role.description}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{role.permission_count || 0}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{role.user_count || 0}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <button onClick={() => { setEditRole(role); setEditPerms(role.permissions || []); }} className="text-xs text-purple-600 hover:text-purple-800 font-medium">Edit</button>
                              {!role.is_system_role && (
                                <button onClick={() => setDeleteRoleId(role.id)} className="text-xs text-red-600 hover:text-red-800 font-medium">Delete</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                  <h3 className="text-lg font-semibold text-gray-900">Team Provisioning</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Create users under this organization, then assign role sets (including auditor sub-roles).
                  </p>
                  {!canReadUsers && (
                    <p className="text-xs text-amber-700 mt-2">
                      Grant users.read or users.manage to view team members in this workspace.
                    </p>
                  )}
                  {!canManageUsers && (
                    <p className="text-xs text-amber-700 mt-1">
                      Grant users.manage to create, activate, or deactivate team members.
                    </p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
                    <input
                      type="text"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Full name"
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="Email"
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Temporary password"
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                    />
                    <select
                      value={newUserPrimaryRole}
                      onChange={(e) => setNewUserPrimaryRole(e.target.value as 'admin' | 'auditor' | 'user')}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="user">User</option>
                      <option value="auditor">Auditor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={createUser}
                      disabled={creatingUser || !canManageUsers}
                      className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50"
                    >
                      {creatingUser ? 'Creating...' : 'Add Team Member'}
                    </button>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Primary</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Assigned Roles</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {teamUsers.map((teamUser) => (
                          <tr key={teamUser.id}>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-gray-900">{teamUser.full_name || teamUser.email}</p>
                              <p className="text-xs text-gray-500">{teamUser.email}</p>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">{teamUser.role}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-1 rounded ${
                                teamUser.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {teamUser.is_active ? 'active' : 'inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                multiple
                                value={userRoleSelections[teamUser.id] || []}
                                onChange={(event) => {
                                  const selectedIds = Array.from(event.target.selectedOptions).map((option) => option.value);
                                  setUserRoleSelections((prev) => ({
                                    ...prev,
                                    [teamUser.id]: selectedIds
                                  }));
                                }}
                                className="w-full min-w-[220px] px-2 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                              >
                                {roles.map((role) => (
                                  <option key={role.id} value={role.id}>
                                    {role.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => saveUserRoles(teamUser.id)}
                                  disabled={savingUserRoles === teamUser.id}
                                  className="text-xs border border-purple-600 text-purple-700 px-3 py-1 rounded hover:bg-purple-50 disabled:opacity-50"
                                >
                                  {savingUserRoles === teamUser.id ? 'Saving...' : 'Save Roles'}
                                </button>
                                <button
                                  onClick={() => toggleUserActive(teamUser)}
                                  disabled={updatingUser === teamUser.id || !canManageUsers}
                                  className="text-xs border border-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-50 disabled:opacity-50"
                                >
                                  {updatingUser === teamUser.id ? 'Updating...' : (teamUser.is_active ? 'Deactivate' : 'Activate')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {teamUsers.length === 0 && (
                      <p className="text-sm text-gray-500 py-4">No users in this organization yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Create Role Modal */}
        {createModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setCreateModalOpen(false)}></div>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 z-10">
              <div className="p-6 border-b"><h3 className="text-lg font-bold text-gray-900">Create New Role</h3></div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                  <input type="text" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g. Security Analyst" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input type="text" value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} placeholder="Describe what this role can do..." className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                  <PermissionCheckboxes selected={newRolePerms} onToggle={(p) => togglePerm(newRolePerms, setNewRolePerms, p)} />
                </div>
              </div>
              <div className="p-6 border-t flex justify-between">
                <button onClick={() => setCreateModalOpen(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button onClick={handleCreate} disabled={!newRoleName.trim()} className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50">Create Role</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Role Modal */}
        {editRole && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setEditRole(null)}></div>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 z-10">
              <div className="p-6 border-b"><h3 className="text-lg font-bold text-gray-900">Edit Role: {editRole.name}</h3></div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input type="text" value={editRole.description} onChange={(e) => setEditRole({ ...editRole, description: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                  <PermissionCheckboxes selected={editPerms} onToggle={(p) => togglePerm(editPerms, setEditPerms, p)} />
                </div>
              </div>
              <div className="p-6 border-t flex justify-between">
                <button onClick={() => setEditRole(null)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button onClick={handleEdit} className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteRoleId && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setDeleteRoleId(null)}></div>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 z-10">
              <h3 className="text-lg font-bold text-gray-900">Delete Role?</h3>
              <p className="text-gray-600 mt-2">This role will be permanently deleted.</p>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setDeleteRoleId(null)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button onClick={() => handleDelete(deleteRoleId)} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
