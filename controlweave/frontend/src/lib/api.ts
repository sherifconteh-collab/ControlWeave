import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken } = response.data.data;
        localStorage.setItem('accessToken', accessToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout user
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  register: (data: {
    email: string;
    password: string;
    fullName: string;
    organizationName?: string;
    initialRole?: 'admin' | 'auditor' | 'user';
    frameworkCodes?: string[];
    informationTypes?: string[];
  }) => {
    const organizationName = String(data.organizationName || '').trim();
    const frameworkCodes = Array.isArray(data.frameworkCodes)
      ? data.frameworkCodes.map((entry) => String(entry || '').trim().toLowerCase()).filter((entry) => entry.length > 0)
      : [];
    const informationTypes = Array.isArray(data.informationTypes)
      ? data.informationTypes.map((entry) => String(entry || '').trim().toLowerCase()).filter((entry) => entry.length > 0)
      : [];
    return (
    api.post('/auth/register', {
      email: data.email,
      password: data.password,
      full_name: data.fullName,
      ...(organizationName ? { organization_name: organizationName } : {}),
      initial_role: data.initialRole || 'admin',
      ...(frameworkCodes.length > 0 ? { framework_codes: frameworkCodes } : {}),
      ...(informationTypes.length > 0 ? { information_types: informationTypes } : {}),
    })
  );
  },

  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  logout: () => api.post('/auth/logout'),

  getCurrentUser: () => api.get('/auth/me'),

  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
};

// Framework APIs
export const frameworkAPI = {
  getAll: () => api.get('/frameworks'),

  getNistPublications: (params?: {
    search?: string;
    publication_family?: string;
    publication_type?: string;
    private_only?: boolean;
    federal_only?: boolean;
    include_mappings?: boolean;
  }) => api.get('/frameworks/nist-publications', { params }),

  getNistPublicationById: (id: string, params?: {
    include_mappings?: boolean;
  }) => api.get(`/frameworks/nist-publications/${id}`, { params }),

  getNistPublicationCoverage: (params?: {
    search?: string;
    publication_family?: string;
    publication_type?: string;
    private_only?: boolean;
    federal_only?: boolean;
  }) => api.get('/frameworks/nist-publications/coverage', { params }),

  searchNistControlCatalog: (params?: {
    search?: string;
    framework_code?: string;
    limit?: number;
  }) => api.get('/frameworks/nist-publications/catalog-controls', { params }),

  saveNistPublicationMappings: (
    publicationId: string,
    data: {
      mappings: Array<{
        framework_code: string;
        control_id: string;
        mapping_strength?: 'primary' | 'supporting' | 'informative';
        mapping_note?: string | null;
        sort_order?: number;
      }>;
      replace_existing?: boolean;
    }
  ) => api.put(`/frameworks/nist-publications/${publicationId}/mappings`, data),
};

// Dashboard APIs
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),

  getPriorityActions: () => api.get('/dashboard/priority-actions'),

  getRecentActivity: () => api.get('/dashboard/recent-activity'),

  getComplianceTrend: (params: { period: string }) =>
    api.get('/dashboard/compliance-trend', { params }),

  getCrosswalkImpact: () => api.get('/dashboard/crosswalk-impact'),

  getMaturityScore: () => api.get('/dashboard/maturity-score'),
};

// Organization APIs
export const organizationAPI = {
  getFrameworks: (orgId: string) => api.get(`/organizations/${orgId}/frameworks`),

  addFrameworks: (orgId: string, data: { frameworkIds: string[] }) =>
    api.post(`/organizations/${orgId}/frameworks`, data),

  removeFramework: (orgId: string, frameworkId: string) =>
    api.delete(`/organizations/${orgId}/frameworks/${frameworkId}`),

  getControls: (orgId: string, params?: { frameworkId?: string; status?: string }) =>
    api.get(`/organizations/${orgId}/controls`, { params }),

  exportControlAnswers: (
    orgId: string,
    params?: { format?: 'xlsx' | 'csv'; frameworkId?: string; status?: string }
  ) => api.get(`/organizations/${orgId}/controls/export`, { params, responseType: 'blob' }),

  importControlAnswers: (
    orgId: string,
    formData: FormData,
    params?: { mode?: 'merge' | 'replace'; ai?: '0' | '1'; provider?: string; model?: string }
  ) => api.post(`/organizations/${orgId}/controls/import`, formData, {
    params,
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

  getMyProfile: () => api.get('/organizations/me/profile'),

  updateMyProfile: (data: {
    company_legal_name?: string | null;
    company_description?: string | null;
    industry?: string | null;
    website?: string | null;
    headquarters_location?: string | null;
    employee_count_range?: string | null;
    system_name?: string | null;
    system_description?: string | null;
    authorization_boundary?: string | null;
    operating_environment_summary?: string | null;
    confidentiality_impact?: 'low' | 'moderate' | 'high' | null;
    integrity_impact?: 'low' | 'moderate' | 'high' | null;
    availability_impact?: 'low' | 'moderate' | 'high' | null;
    impact_rationale?: string | null;
    environment_types?: string[];
    deployment_model?: 'on_prem' | 'single_cloud' | 'multi_cloud' | 'hybrid' | 'saas_only' | null;
    cloud_providers?: string[];
    data_sensitivity_types?: string[];
    rmf_stage?: 'prepare' | 'categorize' | 'select' | 'implement' | 'assess' | 'authorize' | 'monitor' | null;
    rmf_notes?: string | null;
    compliance_profile?: 'private' | 'federal' | 'hybrid' | null;
    nist_adoption_mode?: 'best_practice' | 'mandatory' | null;
    nist_notes?: string | null;
    onboarding_completed?: boolean;
  }) => api.put('/organizations/me/profile', data),
};

// Controls APIs
export const controlsAPI = {
  getControl: (controlId: string) => api.get(`/controls/${controlId}`),

  updateImplementation: (
    controlId: string,
    data: {
      status: string;
      implementationDetails?: string;
      evidenceUrl?: string;
      assignedTo?: string;
      notes?: string;
    }
  ) => api.put(`/controls/${controlId}/implementation`, data),

  getMappings: (controlId: string) => api.get(`/controls/${controlId}/mappings`),

  getHistory: (controlId: string) => api.get(`/controls/${controlId}/history`),
};

// Audit APIs
export const auditAPI = {
  getLogs: (params: {
    userId?: string;
    eventType?: string;
    resourceType?: string;
    resourceId?: string;
    findingKey?: string;
    vulnerabilityId?: string;
    source?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/audit/logs', { params }),

  getStats: (params: { startDate?: string; endDate?: string }) =>
    api.get('/audit/stats', { params }),

  getEventTypes: () => api.get('/audit/event-types'),

  getUserLogs: (userId: string) => api.get(`/audit/user/${userId}`),

  getSplunkLive: (params?: {
    search?: string;
    earliestTime?: string;
    latestTime?: string;
    maxEvents?: number;
  }) => api.get('/audit/splunk/live', { params }),
};

// Vulnerabilities APIs
export const vulnerabilitiesAPI = {
  getAll: (params?: {
    source?: string | string[];
    standard?: string | string[];
    severity?: string | string[];
    status?: string | string[];
    assetId?: string;
    minCvss?: number;
    maxCvss?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/vulnerabilities', { params }),

  getSources: () => api.get('/vulnerabilities/sources'),

  getById: (id: string) => api.get(`/vulnerabilities/${id}`),

  analyzeVulnerability: (id: string) => api.post(`/vulnerabilities/${id}/analyze`),

  getWorkflow: (id: string) => api.get(`/vulnerabilities/${id}/workflow`),

  updateWorkflowItem: (
    vulnerabilityId: string,
    workItemId: string,
    data: {
      actionType?: 'poam' | 'close_control_gap' | 'risk_acceptance' | 'false_positive_review';
      actionStatus?: 'open' | 'in_progress' | 'resolved' | 'accepted' | 'closed';
      controlEffect?: 'non_compliant' | 'partial' | 'compliant';
      responseSummary?: string;
      responseDetails?: string;
      dueDate?: string;
      ownerId?: string | null;
    }
  ) => api.patch(`/vulnerabilities/${vulnerabilityId}/workflow/${workItemId}`, data),
};

// SBOM APIs
export const sbomAPI = {
  getAssets: (params?: { search?: string; limit?: number }) =>
    api.get('/sbom/assets', { params }),

  getAll: (params?: { limit?: number; offset?: number }) =>
    api.get('/sbom', { params }),

  getById: (id: string) =>
    api.get(`/sbom/${id}`),

  upload: (formData: FormData) =>
    api.post('/sbom/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// Implementations APIs
export const implementationsAPI = {
  getAll: (params?: { frameworkId?: string; status?: string; assignedTo?: string; priority?: string; controlId?: string }) =>
    api.get('/implementations', { params }),

  ensureForControl: (controlId: string) =>
    api.post(`/implementations/by-control/${controlId}/ensure`),

  getById: (id: string) => api.get(`/implementations/${id}`),

  updateStatus: (id: string, data: { status: string; notes?: string }) =>
    api.patch(`/implementations/${id}/status`, data),

  assign: (id: string, data: { assignedTo?: string | null; dueDate?: string | null; notes?: string }) =>
    api.patch(`/implementations/${id}/assign`, data),

  review: (id: string, data: { notes?: string; stillApplicable?: boolean; evidenceUpdated?: boolean }) =>
    api.post(`/implementations/${id}/review`, data),

  getActivityFeed: (params?: { limit?: number; offset?: number }) =>
    api.get('/implementations/activity/feed', { params }),

  getDueControls: (params?: { days?: number }) =>
    api.get('/implementations/due/upcoming', { params }),
};

// Evidence APIs
export const evidenceAPI = {
  getAll: (params?: { search?: string; tags?: string; limit?: number; offset?: number }) =>
    api.get('/evidence', { params }),

  upload: (formData: FormData) =>
    api.post('/evidence/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  getById: (id: string) => api.get(`/evidence/${id}`),

  download: (id: string) => api.get(`/evidence/${id}/download`, { responseType: 'blob' }),

  update: (id: string, data: { description?: string; tags?: string[] }) =>
    api.put(`/evidence/${id}`, data),

  remove: (id: string) => api.delete(`/evidence/${id}`),

  link: (id: string, data: { controlIds: string[]; notes?: string }) =>
    api.post(`/evidence/${id}/link`, data),

  unlink: (evidenceId: string, controlId: string) =>
    api.delete(`/evidence/${evidenceId}/unlink/${controlId}`),
};

// Roles APIs
export const rolesAPI = {
  getAll: () => api.get('/roles'),

  create: (data: { name: string; description: string; permissions: string[] }) =>
    api.post('/roles', data),

  update: (roleId: string, data: { name?: string; description?: string; permissions?: string[] }) =>
    api.put(`/roles/${roleId}`, data),

  remove: (roleId: string) => api.delete(`/roles/${roleId}`),

  getAllPermissions: () => api.get('/roles/permissions/all'),

  assignRole: (data: { userId: string; roleIds: string[] }) =>
    api.post('/roles/assign', data),

  getUserRoles: (userId: string) => api.get(`/roles/user/${userId}`),

  bootstrapAuditorSubroles: () => api.post('/roles/bootstrap-auditor-subroles'),
};

// Users APIs
export const usersAPI = {
  getOrgUsers: () => api.get('/users'),

  create: (data: {
    email: string;
    password: string;
    full_name: string;
    primary_role?: 'admin' | 'auditor' | 'user';
    role_ids?: string[];
    auto_generate_auditor_subroles?: boolean;
  }) => api.post('/users', data),

  update: (userId: string, data: {
    full_name?: string;
    primary_role?: 'admin' | 'auditor' | 'user';
    is_active?: boolean;
    role_ids?: string[];
    auto_generate_auditor_subroles?: boolean;
  }) => api.patch(`/users/${userId}`, data),
};


// ---------------------------------------------------------------------------
// CMDB -- Configuration Management Database
// Tracks: Hardware, Software, AI Agents, Service Accounts, Environments,
//         Password Vaults.  Every record carries an owner field.
// ---------------------------------------------------------------------------
function cmdbResource(routePath: string) {
  return {
    getAll:  (params?: Record<string, string>) => api.get(`/cmdb/${routePath}`, { params }),
    getById: (id: string)                      => api.get(`/cmdb/${routePath}/${id}`),
    create:  (data: Record<string, unknown>)   => api.post(`/cmdb/${routePath}`, data),
    update:  (id: string, data: Record<string, unknown>) => api.put(`/cmdb/${routePath}/${id}`, data),
    remove:  (id: string)                      => api.delete(`/cmdb/${routePath}/${id}`),
  };
}

export const cmdbAPI = {
  hardware:        cmdbResource("hardware"),
  software:        cmdbResource("software"),
  aiAgents:        cmdbResource("ai-agents"),
  serviceAccounts: cmdbResource("service-accounts"),
  environments:    cmdbResource("environments"),
  passwordVaults:  cmdbResource("password-vaults"),
};

// AI Analysis APIs
export const aiAPI = {
  getStatus: () => api.get('/ai/status'),
  chat: (data: { messages: { role: string; content: string }[]; systemPrompt?: string; provider?: string; model?: string }) =>
    api.post('/ai/chat', data),
  gapAnalysis: (data?: { provider?: string; model?: string }) =>
    api.post('/ai/gap-analysis', data || {}),
  crosswalkOptimizer: (data?: { provider?: string; model?: string }) =>
    api.post('/ai/crosswalk-optimizer', data || {}),
  complianceForecast: (data?: { provider?: string; model?: string }) =>
    api.post('/ai/compliance-forecast', data || {}),
  regulatoryMonitor: (data?: { provider?: string; model?: string }) =>
    api.post('/ai/regulatory-monitor', data || {}),
  remediationPlaybook: (controlId: string, data?: { provider?: string; model?: string }) =>
    api.post(`/ai/remediation/${controlId}`, data || {}),
  incidentResponse: (data: { incidentType?: string; provider?: string; model?: string }) =>
    api.post('/ai/incident-response', data),
  executiveReport: (data?: { provider?: string; model?: string }) =>
    api.post('/ai/executive-report', data || {}),
  riskHeatmap: (data?: { provider?: string; model?: string }) =>
    api.post('/ai/risk-heatmap', data || {}),
  vendorRisk: (data: { vendorInfo: Record<string, unknown>; provider?: string; model?: string }) =>
    api.post('/ai/vendor-risk', data),
  auditReadiness: (data?: { framework?: string; provider?: string; model?: string }) =>
    api.post('/ai/audit-readiness', data || {}),
  auditPbcDraft: (data: {
    requestContext: string;
    controlId?: string;
    frameworkCode?: string;
    dueDate?: string;
    priority?: string;
    provider?: string;
    model?: string;
  }) => api.post('/ai/audit/pbc-draft', data),
  auditWorkpaperDraft: (data: {
    objective: string;
    controlId?: string;
    procedurePerformed?: string;
    evidenceSummary?: string;
    testOutcome?: string;
    provider?: string;
    model?: string;
  }) => api.post('/ai/audit/workpaper-draft', data),
  auditFindingDraft: (data: {
    issueSummary: string;
    controlId?: string;
    evidenceSummary?: string;
    severityHint?: string;
    recommendationScope?: string;
    provider?: string;
    model?: string;
  }) => api.post('/ai/audit/finding-draft', data),
  assetControlMapping: (data?: { provider?: string; model?: string }) =>
    api.post('/ai/asset-control-mapping', data || {}),
  shadowIT: (data?: { provider?: string; model?: string }) =>
    api.post('/ai/shadow-it', data || {}),
  aiGovernance: (data?: { provider?: string; model?: string }) =>
    api.post('/ai/ai-governance', data || {}),
  complianceQuery: (data: { question: string; provider?: string; model?: string }) =>
    api.post('/ai/query', data),
  trainingRecommendations: (data?: { provider?: string; model?: string }) =>
    api.post('/ai/training-recommendations', data || {}),
  evidenceSuggest: (controlId: string, data?: { provider?: string; model?: string }) =>
    api.post(`/ai/evidence-suggest/${controlId}`, data || {}),
  analyzeControl: (controlId: string, data?: { provider?: string; model?: string }) =>
    api.post(`/ai/analyze/control/${controlId}`, data || {}),
  testProcedures: (controlId: string, data?: { provider?: string; model?: string }) =>
    api.post(`/ai/test-procedures/${controlId}`, data || {}),
  analyzeAsset: (assetId: string, data?: { provider?: string; model?: string }) =>
    api.post(`/ai/analyze/asset/${assetId}`, data || {}),
  generatePolicy: (data: { policyType: string; provider?: string; model?: string }) =>
    api.post('/ai/generate-policy', data),
};

// Assessment Procedures APIs (NIST 800-53A, ISO 27001, SOC 2, etc.)
export const assessmentsAPI = {
  getProcedures: (params?: {
    framework_code?: string;
    control_id?: string;
    procedure_type?: string;
    depth?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/assessments/procedures', { params }),

  getProceduresByControl: (controlId: string) =>
    api.get(`/assessments/procedures/by-control/${controlId}`),

  getProcedure: (id: string) =>
    api.get(`/assessments/procedures/${id}`),

  recordResult: (data: {
    procedure_id: string;
    status: string;
    finding?: string;
    evidence_collected?: string;
    risk_level?: string;
    remediation_required?: boolean;
    remediation_deadline?: string;
  }) => api.post('/assessments/results', data),

  getStats: () => api.get('/assessments/stats'),

  getFrameworks: () => api.get('/assessments/frameworks'),

  createPlan: (data: {
    name: string;
    description?: string;
    framework_id?: string;
    assessment_type?: string;
    depth?: string;
    start_date?: string;
    end_date?: string;
  }) => api.post('/assessments/plans', data),

  getPlans: () => api.get('/assessments/plans'),

  getEngagements: (params?: {
    status?: string;
    engagement_type?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/assessments/engagements', { params }),

  createEngagement: (data: {
    name: string;
    engagement_type?: 'internal_audit' | 'external_audit' | 'readiness' | 'assessment';
    scope?: string;
    framework_codes?: string[];
    status?: 'planning' | 'fieldwork' | 'reporting' | 'completed' | 'archived';
    period_start?: string;
    period_end?: string;
    lead_auditor_id?: string | null;
    engagement_owner_id?: string | null;
  }) => api.post('/assessments/engagements', data),

  getEngagementById: (id: string) => api.get(`/assessments/engagements/${id}`),

  handoffEngagement: (id: string, data: {
    lead_auditor_id: string;
    engagement_owner_id?: string | null;
  }) => api.post(`/assessments/engagements/${id}/handoff`, data),

  updateEngagement: (id: string, data: {
    name?: string;
    engagement_type?: 'internal_audit' | 'external_audit' | 'readiness' | 'assessment';
    scope?: string;
    framework_codes?: string[];
    status?: 'planning' | 'fieldwork' | 'reporting' | 'completed' | 'archived';
    period_start?: string | null;
    period_end?: string | null;
    lead_auditor_id?: string | null;
    engagement_owner_id?: string | null;
  }) => api.patch(`/assessments/engagements/${id}`, data),

  getEngagementProcedures: (engagementId: string, params?: {
    search?: string;
    procedure_type?: string;
    depth?: string;
    result_status?: 'not_assessed' | 'satisfied' | 'other_than_satisfied' | 'not_applicable';
    limit?: number;
    offset?: number;
  }) => api.get(`/assessments/engagements/${engagementId}/procedures`, { params }),

  getEngagementPbc: (engagementId: string, params?: {
    status?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    limit?: number;
    offset?: number;
  }) => api.get(`/assessments/engagements/${engagementId}/pbc`, { params }),

  createEngagementPbc: (engagementId: string, data: {
    title: string;
    request_details: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'open' | 'in_progress' | 'submitted' | 'accepted' | 'rejected' | 'closed';
    due_date?: string | null;
    assigned_to?: string | null;
    response_notes?: string | null;
    assessment_procedure_id?: string | null;
  }) => api.post(`/assessments/engagements/${engagementId}/pbc`, data),

  autoCreateEngagementPbc: (engagementId: string, data: {
    procedure_ids: string[];
    due_date?: string | null;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'open' | 'in_progress' | 'submitted' | 'accepted' | 'rejected' | 'closed';
    request_context?: string | null;
  }) => api.post(`/assessments/engagements/${engagementId}/pbc/auto-create`, data),

  generateEngagementPbcDraftAi: (engagementId: string, data: {
    assessment_procedure_id?: string | null;
    request_context?: string | null;
    due_date?: string | null;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    provider?: string;
    model?: string;
    persist_draft?: boolean;
  }) => api.post(`/assessments/engagements/${engagementId}/pbc/ai-draft`, data),

  updateEngagementPbc: (engagementId: string, pbcId: string, data: {
    title?: string;
    request_details?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'open' | 'in_progress' | 'submitted' | 'accepted' | 'rejected' | 'closed';
    due_date?: string | null;
    assigned_to?: string | null;
    response_notes?: string | null;
    assessment_procedure_id?: string | null;
  }) => api.patch(`/assessments/engagements/${engagementId}/pbc/${pbcId}`, data),

  getEngagementWorkpapers: (engagementId: string, params?: {
    status?: 'draft' | 'in_review' | 'finalized';
    limit?: number;
    offset?: number;
  }) => api.get(`/assessments/engagements/${engagementId}/workpapers`, { params }),

  createEngagementWorkpaper: (engagementId: string, data: {
    control_id?: string | null;
    assessment_procedure_id?: string | null;
    title: string;
    objective?: string | null;
    procedure_performed?: string | null;
    conclusion?: string | null;
    status?: 'draft' | 'in_review' | 'finalized';
    prepared_by?: string | null;
    reviewed_by?: string | null;
    reviewer_notes?: string | null;
  }) => api.post(`/assessments/engagements/${engagementId}/workpapers`, data),

  updateEngagementWorkpaper: (engagementId: string, workpaperId: string, data: {
    control_id?: string | null;
    assessment_procedure_id?: string | null;
    title?: string;
    objective?: string | null;
    procedure_performed?: string | null;
    conclusion?: string | null;
    status?: 'draft' | 'in_review' | 'finalized';
    prepared_by?: string | null;
    reviewed_by?: string | null;
    reviewer_notes?: string | null;
  }) => api.patch(`/assessments/engagements/${engagementId}/workpapers/${workpaperId}`, data),

  generateEngagementWorkpaperDraftAi: (engagementId: string, data: {
    assessment_procedure_id?: string | null;
    control_id?: string | null;
    objective?: string | null;
    procedure_performed?: string | null;
    evidence_summary?: string | null;
    test_outcome?: string | null;
    provider?: string;
    model?: string;
    persist_draft?: boolean;
  }) => api.post(`/assessments/engagements/${engagementId}/workpapers/ai-draft`, data),

  getEngagementFindings: (engagementId: string, params?: {
    status?: 'open' | 'accepted' | 'remediating' | 'verified' | 'closed';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    limit?: number;
    offset?: number;
  }) => api.get(`/assessments/engagements/${engagementId}/findings`, { params }),

  createEngagementFinding: (engagementId: string, data: {
    related_pbc_request_id?: string | null;
    related_workpaper_id?: string | null;
    control_id?: string | null;
    title: string;
    description: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'open' | 'accepted' | 'remediating' | 'verified' | 'closed';
    recommendation?: string | null;
    management_response?: string | null;
    owner_user_id?: string | null;
    due_date?: string | null;
  }) => api.post(`/assessments/engagements/${engagementId}/findings`, data),

  updateEngagementFinding: (engagementId: string, findingId: string, data: {
    related_pbc_request_id?: string | null;
    related_workpaper_id?: string | null;
    control_id?: string | null;
    title?: string;
    description?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'open' | 'accepted' | 'remediating' | 'verified' | 'closed';
    recommendation?: string | null;
    management_response?: string | null;
    owner_user_id?: string | null;
    due_date?: string | null;
  }) => api.patch(`/assessments/engagements/${engagementId}/findings/${findingId}`, data),

  generateEngagementFindingDraftAi: (engagementId: string, data: {
    assessment_procedure_id?: string | null;
    related_pbc_request_id?: string | null;
    related_workpaper_id?: string | null;
    issue_summary?: string | null;
    evidence_summary?: string | null;
    severity_hint?: 'low' | 'medium' | 'high' | 'critical' | null;
    recommendation_scope?: string | null;
    provider?: string;
    model?: string;
    persist_draft?: boolean;
  }) => api.post(`/assessments/engagements/${engagementId}/findings/ai-draft`, data),

  getEngagementSignoffs: (engagementId: string) => api.get(`/assessments/engagements/${engagementId}/signoffs`),

  getEngagementSignoffReadiness: (engagementId: string) =>
    api.get(`/assessments/engagements/${engagementId}/signoff-readiness`),

  createEngagementSignoff: (engagementId: string, data: {
    signoff_type:
      | 'auditor'
      | 'management'
      | 'executive'
      | 'customer_acknowledgment'
      | 'company_leadership'
      | 'auditor_firm_recommendation';
    status?: 'approved' | 'rejected';
    comments?: string | null;
    signed_by?: string | null;
  }) => api.post(`/assessments/engagements/${engagementId}/signoffs`, data),

  getEngagementValidationPackage: (engagementId: string) =>
    api.get(`/assessments/engagements/${engagementId}/validation-package`),

  downloadEngagementValidationPackagePdf: (engagementId: string) =>
    api.get(`/assessments/engagements/${engagementId}/validation-package/pdf`, { responseType: 'blob' }),

  getAuditTemplates: (params?: {
    artifact_type?: 'pbc' | 'workpaper' | 'finding' | 'signoff' | 'engagement_report';
    include_inactive?: boolean;
    include_content?: boolean;
  }) => api.get('/assessments/templates', { params }),

  createAuditTemplate: (data: {
    artifact_type: 'pbc' | 'workpaper' | 'finding' | 'signoff' | 'engagement_report';
    template_name: string;
    template_content: string;
    template_format?: string;
    set_default?: boolean;
  }) => api.post('/assessments/templates', data),

  uploadAuditTemplate: (formData: FormData) =>
    api.post('/assessments/templates/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  updateAuditTemplate: (templateId: string, data: {
    template_name?: string;
    template_content?: string;
    is_default?: boolean;
    is_active?: boolean;
  }) => api.patch(`/assessments/templates/${templateId}`, data),

  deleteAuditTemplate: (templateId: string) =>
    api.delete(`/assessments/templates/${templateId}`),
};

// Organization Settings APIs (BYOK / LLM Config)
export const settingsAPI = {
  getLLMConfig: () => api.get('/settings/llm'),
  updateLLMConfig: (data: {
    anthropic_api_key?: string | null;
    openai_api_key?: string | null;
    gemini_api_key?: string | null;
    xai_api_key?: string | null;
    default_provider?: string;
    default_model?: string;
  }) => api.put('/settings/llm', data),
  testLLMKey: (data: { provider: string; apiKey: string }) =>
    api.post('/settings/llm/test', data),
  removeLLMKey: (provider: string) =>
    api.delete(`/settings/llm/${provider}`),
  getContentPacks: () => api.get('/settings/content-packs'),
  getContentPackDrafts: () => api.get('/settings/content-packs/drafts'),
  getContentPackDraft: (id: string) => api.get(`/settings/content-packs/drafts/${id}`),
  uploadContentPackDraft: (formData: FormData) =>
    api.post('/settings/content-packs/drafts/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateContentPackDraft: (id: string, data: { pack: Record<string, unknown>; review_required?: boolean }) =>
    api.put(`/settings/content-packs/drafts/${id}`, data),
  attestContentPackDraft: (id: string, data?: { confirm?: boolean; statement?: string }) =>
    api.post(`/settings/content-packs/drafts/${id}/attest`, { confirm: true, ...(data || {}) }),
  reviewContentPackDraft: (id: string, data: { action: 'approve' | 'reject'; notes?: string }) =>
    api.post(`/settings/content-packs/drafts/${id}/review`, data),
  importContentPackDraft: (id: string) =>
    api.post(`/settings/content-packs/drafts/${id}/import`, {}),
  getContentPackTemplate: () => api.get('/settings/content-packs/template'),
  importContentPack: (data: { pack: Record<string, unknown> }) =>
    api.post('/settings/content-packs/import', data),
  deleteContentPack: (id: string) =>
    api.delete(`/settings/content-packs/${id}`),
};

// Integrations APIs (Splunk evidence connector)
export const integrationsAPI = {
  getSplunkConfig: () => api.get('/integrations/splunk'),
  updateSplunkConfig: (data: { base_url?: string | null; api_token?: string | null; default_index?: string | null }) =>
    api.put('/integrations/splunk', data),
  removeSplunkConfig: () =>
    api.delete('/integrations/splunk'),
  testSplunkConfig: (data?: { base_url?: string; api_token?: string; default_index?: string }) =>
    api.post('/integrations/splunk/test', data || {}),
  importSplunkEvidence: (data: {
    search: string;
    earliest_time?: string;
    latest_time?: string;
    max_events?: number;
    title?: string;
    description?: string;
    tags?: string[] | string;
    control_ids?: string[];
    retention_until?: string;
  }) => api.post('/integrations/splunk/import-evidence', data),
};

// Reports APIs
export const reportsAPI = {
  getTypes: () => api.get('/reports/types'),

  downloadPDF: () =>
    api.get('/reports/compliance/pdf', { responseType: 'blob' }),

  downloadExcel: () =>
    api.get('/reports/compliance/excel', { responseType: 'blob' }),
};

// Notifications APIs
export const notificationsAPI = {
  getAll: (params?: { limit?: number; unread?: string }) =>
    api.get('/notifications', { params }),

  markRead: (id: string) =>
    api.patch(`/notifications/${id}/read`),

  markAllRead: () =>
    api.post('/notifications/read-all'),
};

// Operations APIs (admin/operator workspace)
export const opsAPI = {
  getOverview: () => api.get('/ops/overview'),
  getJobs: (params?: { status?: string; limit?: number }) => api.get('/ops/jobs', { params }),
  enqueueJob: (data: { job_type: string; payload?: Record<string, unknown>; run_after?: string | null }) =>
    api.post('/ops/jobs', data),
  processJobs: (data?: { limit?: number }) => api.post('/ops/jobs/process', data || {}),
  runRetention: () => api.post('/ops/retention/run', {}),
  processWebhooks: (data?: { limit?: number }) => api.post('/ops/webhooks/process', data || {})
};

export default api;
