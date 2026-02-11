'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { aiAPI } from '@/lib/api';

interface AIStatus {
  providers: {
    claude: { available: boolean; models: string[]; hasOrgKey: boolean };
    openai: { available: boolean; models: string[]; hasOrgKey: boolean };
    gemini: { available: boolean; models: string[]; hasOrgKey: boolean };
    grok: { available: boolean; models: string[]; hasOrgKey: boolean };
  };
  usage: { used: number; limit: string | number; remaining: string | number };
  tier: string;
}

const AI_FEATURES = [
  // AI Governance (featured)
  { id: 'aiGovernance', name: 'AI Governance Check', icon: '🧠', description: 'Assess AI assets against NIST AI RMF, ISO/IEC 42001 & 42005, and the EU AI Act', category: 'AI Governance' },
  // Compliance Intelligence
  { id: 'gapAnalysis', name: 'Gap Analysis Report', icon: '🔍', description: 'Comprehensive compliance gap analysis across all adopted frameworks', category: 'Compliance Intelligence' },
  { id: 'crosswalkOptimizer', name: 'Crosswalk Optimizer', icon: '🔗', description: 'Optimal control implementation order for maximum cross-framework coverage', category: 'Compliance Intelligence' },
  { id: 'complianceForecast', name: 'Compliance Forecasting', icon: '📈', description: 'Predict when you will reach compliance targets based on velocity', category: 'Compliance Intelligence' },
  { id: 'regulatoryMonitor', name: 'Regulatory Change Monitor', icon: '📡', description: 'Monitor regulatory updates and assess impact on your frameworks', category: 'Compliance Intelligence' },
  // Document Generation
  { id: 'executiveReport', name: 'Executive Report', icon: '📊', description: 'Board-ready compliance summary with RAG status and recommendations', category: 'Document Generation' },
  { id: 'policyGenerator', name: 'Policy Generator', icon: '📋', description: 'Generate comprehensive compliance policies for your organization', category: 'Document Generation' },
  { id: 'incidentResponse', name: 'Incident Response Plan', icon: '🚨', description: 'Generate IR plans based on your actual asset inventory', category: 'Document Generation' },
  // Risk & Assessment
  { id: 'riskHeatmap', name: 'Risk Heatmap', icon: '🗺️', description: 'AI-powered risk scoring across assets and controls', category: 'Risk & Assessment' },
  { id: 'vendorRisk', name: 'Vendor Risk Assessment', icon: '🏢', description: 'Evaluate third-party vendor compliance posture', category: 'Risk & Assessment' },
  { id: 'auditReadiness', name: 'Audit Readiness Score', icon: '✅', description: 'Assess how audit-ready your organization is with a readiness score', category: 'Risk & Assessment' },
  { id: 'auditPbcDraft', name: 'Audit PBC Draft', icon: '📥', description: 'Draft auditor-quality PBC requests with acceptance criteria', category: 'Audit Operations' },
  { id: 'auditWorkpaperDraft', name: 'Workpaper Draft', icon: '🗂️', description: 'Generate workpaper narratives for testing and conclusions', category: 'Audit Operations' },
  { id: 'auditFindingDraft', name: 'Finding Draft', icon: '⚠️', description: 'Draft findings using observation/criteria/cause/effect format', category: 'Audit Operations' },
  // Asset Intelligence
  { id: 'assetControlMapping', name: 'Asset-Control Mapping', icon: '🗂️', description: 'Auto-map CMDB assets to applicable compliance controls', category: 'Asset Intelligence' },
  { id: 'shadowIT', name: 'Shadow IT Detection', icon: '👻', description: 'Identify gaps in asset inventory and potential shadow IT', category: 'Asset Intelligence' },
  // Operational
  { id: 'complianceQuery', name: 'Compliance Query', icon: '💬', description: 'Ask natural language questions about your compliance posture', category: 'Operational' },
  { id: 'trainingRecommendations', name: 'Training Recommendations', icon: '🎓', description: 'Security awareness training topics based on compliance gaps', category: 'Operational' },
];

const POLICY_TYPES = [
  'Information Security Policy',
  'Acceptable Use Policy',
  'Access Control Policy',
  'Data Classification Policy',
  'Incident Response Policy',
  'Business Continuity Policy',
  'Password Management Policy',
  'Remote Work Security Policy',
  'Vendor Management Policy',
  'AI/ML Governance Policy',
];

const INCIDENT_TYPES = [
  'Ransomware Attack',
  'Data Breach',
  'Insider Threat',
  'DDoS Attack',
  'Phishing Campaign',
  'Supply Chain Compromise',
  'Cloud Security Incident',
  'AI System Failure',
];

const AUDIT_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const AUDIT_SEVERITIES = ['low', 'medium', 'high', 'critical'];

export default function AIAnalysisPage() {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('claude');
  const [model, setModel] = useState('');

  // Feature-specific inputs
  const [queryText, setQueryText] = useState('');
  const [policyType, setPolicyType] = useState(POLICY_TYPES[0]);
  const [incidentType, setIncidentType] = useState(INCIDENT_TYPES[0]);
  const [vendorName, setVendorName] = useState('');
  const [vendorDescription, setVendorDescription] = useState('');
  const [auditFramework, setAuditFramework] = useState('');
  const [auditControlId, setAuditControlId] = useState('');
  const [auditPbcContext, setAuditPbcContext] = useState('');
  const [auditPbcPriority, setAuditPbcPriority] = useState('medium');
  const [auditPbcDueDate, setAuditPbcDueDate] = useState('');
  const [auditWorkpaperObjective, setAuditWorkpaperObjective] = useState('');
  const [auditWorkpaperProcedure, setAuditWorkpaperProcedure] = useState('');
  const [auditWorkpaperEvidence, setAuditWorkpaperEvidence] = useState('');
  const [auditWorkpaperOutcome, setAuditWorkpaperOutcome] = useState('');
  const [auditFindingIssue, setAuditFindingIssue] = useState('');
  const [auditFindingEvidence, setAuditFindingEvidence] = useState('');
  const [auditFindingSeverity, setAuditFindingSeverity] = useState('medium');
  const [auditFindingScope, setAuditFindingScope] = useState('');

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const res = await aiAPI.getStatus();
      setStatus(res.data.data);
      // Set default provider based on availability
      if (res.data.data.providers.claude.available) setProvider('claude');
      else if (res.data.data.providers.openai.available) setProvider('openai');
      else if (res.data.data.providers.gemini.available) setProvider('gemini');
      else if (res.data.data.providers.grok.available) setProvider('grok');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load AI status');
    } finally {
      setLoading(false);
    }
  };

  const runFeature = async (featureId: string) => {
    setProcessing(true);
    setResult(null);
    setError('');
    const params = { provider, model: model || undefined };

    try {
      let res;
      switch (featureId) {
        case 'gapAnalysis':
          res = await aiAPI.gapAnalysis(params);
          break;
        case 'crosswalkOptimizer':
          res = await aiAPI.crosswalkOptimizer(params);
          break;
        case 'complianceForecast':
          res = await aiAPI.complianceForecast(params);
          break;
        case 'regulatoryMonitor':
          res = await aiAPI.regulatoryMonitor(params);
          break;
        case 'executiveReport':
          res = await aiAPI.executiveReport(params);
          break;
        case 'policyGenerator':
          res = await aiAPI.generatePolicy({ policyType, ...params });
          break;
        case 'incidentResponse':
          res = await aiAPI.incidentResponse({ incidentType, ...params });
          break;
        case 'riskHeatmap':
          res = await aiAPI.riskHeatmap(params);
          break;
        case 'vendorRisk':
          res = await aiAPI.vendorRisk({
            vendorInfo: { name: vendorName, description: vendorDescription },
            ...params,
          });
          break;
        case 'auditReadiness':
          res = await aiAPI.auditReadiness({ framework: auditFramework || undefined, ...params });
          break;
        case 'auditPbcDraft':
          if (!auditPbcContext.trim()) { setError('Please enter audit request context'); setProcessing(false); return; }
          res = await aiAPI.auditPbcDraft({
            requestContext: auditPbcContext,
            controlId: auditControlId || undefined,
            dueDate: auditPbcDueDate || undefined,
            priority: auditPbcPriority,
            ...params,
          });
          break;
        case 'auditWorkpaperDraft':
          if (!auditWorkpaperObjective.trim()) { setError('Please enter a workpaper objective'); setProcessing(false); return; }
          res = await aiAPI.auditWorkpaperDraft({
            objective: auditWorkpaperObjective,
            controlId: auditControlId || undefined,
            procedurePerformed: auditWorkpaperProcedure || undefined,
            evidenceSummary: auditWorkpaperEvidence || undefined,
            testOutcome: auditWorkpaperOutcome || undefined,
            ...params,
          });
          break;
        case 'auditFindingDraft':
          if (!auditFindingIssue.trim()) { setError('Please enter issue summary'); setProcessing(false); return; }
          res = await aiAPI.auditFindingDraft({
            issueSummary: auditFindingIssue,
            controlId: auditControlId || undefined,
            evidenceSummary: auditFindingEvidence || undefined,
            severityHint: auditFindingSeverity || undefined,
            recommendationScope: auditFindingScope || undefined,
            ...params,
          });
          break;
        case 'assetControlMapping':
          res = await aiAPI.assetControlMapping(params);
          break;
        case 'shadowIT':
          res = await aiAPI.shadowIT(params);
          break;
        case 'aiGovernance':
          res = await aiAPI.aiGovernance(params);
          break;
        case 'complianceQuery':
          if (!queryText.trim()) { setError('Please enter a question'); setProcessing(false); return; }
          res = await aiAPI.complianceQuery({ question: queryText, ...params });
          break;
        case 'trainingRecommendations':
          res = await aiAPI.trainingRecommendations(params);
          break;
        default:
          throw new Error('Unknown feature');
      }
      setResult(res.data.data.result);
      loadStatus(); // Refresh usage count
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      setError(msg);
      if (err.response?.data?.upgradeRequired) {
        setError(`${msg} Upgrade your tier for more AI requests.`);
      }
    } finally {
      setProcessing(false);
    }
  };

  const renderFeatureInput = () => {
    if (!activeFeature) return null;

    switch (activeFeature) {
      case 'complianceQuery':
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ask a Question</label>
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="e.g., How compliant are we with HIPAA? What controls are overdue?"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              onKeyDown={(e) => e.key === 'Enter' && runFeature('complianceQuery')}
            />
          </div>
        );
      case 'policyGenerator':
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Policy Type</label>
            <select
              value={policyType}
              onChange={(e) => setPolicyType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            >
              {POLICY_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        );
      case 'incidentResponse':
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Incident Type</label>
            <select
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            >
              {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        );
      case 'vendorRisk':
        return (
          <div className="mb-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name</label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g., AWS, Salesforce, Acme Corp"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description / Services</label>
              <textarea
                value={vendorDescription}
                onChange={(e) => setVendorDescription(e.target.value)}
                placeholder="Describe what services this vendor provides and what data they access..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        );
      case 'auditReadiness':
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Framework (optional - leave blank for all)</label>
            <input
              type="text"
              value={auditFramework}
              onChange={(e) => setAuditFramework(e.target.value)}
              placeholder="e.g., nist_csf_2.0, iso_27001, soc2"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            />
          </div>
        );
      case 'auditPbcDraft':
        return (
          <div className="mb-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Control UUID (optional)</label>
              <input
                type="text"
                value={auditControlId}
                onChange={(e) => setAuditControlId(e.target.value)}
                placeholder="Framework control UUID"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Request Context</label>
              <textarea
                value={auditPbcContext}
                onChange={(e) => setAuditPbcContext(e.target.value)}
                placeholder="Describe what evidence you need and why..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={auditPbcPriority}
                  onChange={(e) => setAuditPbcPriority(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                >
                  {AUDIT_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (optional)</label>
                <input
                  type="date"
                  value={auditPbcDueDate}
                  onChange={(e) => setAuditPbcDueDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
        );
      case 'auditWorkpaperDraft':
        return (
          <div className="mb-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Control UUID (optional)</label>
              <input
                type="text"
                value={auditControlId}
                onChange={(e) => setAuditControlId(e.target.value)}
                placeholder="Framework control UUID"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Objective</label>
              <textarea
                value={auditWorkpaperObjective}
                onChange={(e) => setAuditWorkpaperObjective(e.target.value)}
                placeholder="State the audit objective for this test..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Performed</label>
              <textarea
                value={auditWorkpaperProcedure}
                onChange={(e) => setAuditWorkpaperProcedure(e.target.value)}
                placeholder="Describe how testing was performed..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Evidence Summary</label>
              <textarea
                value={auditWorkpaperEvidence}
                onChange={(e) => setAuditWorkpaperEvidence(e.target.value)}
                placeholder="Summarize evidence reviewed..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Outcome</label>
              <input
                type="text"
                value={auditWorkpaperOutcome}
                onChange={(e) => setAuditWorkpaperOutcome(e.target.value)}
                placeholder="Pass / exception / needs follow-up"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        );
      case 'auditFindingDraft':
        return (
          <div className="mb-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Control UUID (optional)</label>
              <input
                type="text"
                value={auditControlId}
                onChange={(e) => setAuditControlId(e.target.value)}
                placeholder="Framework control UUID"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issue Summary</label>
              <textarea
                value={auditFindingIssue}
                onChange={(e) => setAuditFindingIssue(e.target.value)}
                placeholder="Describe the issue observed..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Evidence Summary</label>
              <textarea
                value={auditFindingEvidence}
                onChange={(e) => setAuditFindingEvidence(e.target.value)}
                placeholder="Summarize supporting evidence..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <select
                  value={auditFindingSeverity}
                  onChange={(e) => setAuditFindingSeverity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                >
                  {AUDIT_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recommendation Scope</label>
                <input
                  type="text"
                  value={auditFindingScope}
                  onChange={(e) => setAuditFindingScope(e.target.value)}
                  placeholder="Policy, process, technical, training..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const categories = [...new Set(AI_FEATURES.map((f) => f.category))];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI Analysis</h1>
            <p className="text-gray-600 mt-1">AI-powered compliance intelligence, risk assessment, and document generation</p>
          </div>
          {status && (
            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                status.tier === 'free' ? 'bg-gray-100 text-gray-700' :
                status.tier === 'starter' ? 'bg-blue-100 text-blue-700' :
                status.tier === 'professional' ? 'bg-purple-100 text-purple-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {status.tier.charAt(0).toUpperCase() + status.tier.slice(1)} Tier
              </span>
              <p className="text-sm text-gray-500 mt-1">
                {status.usage.remaining === 'unlimited' ? 'Unlimited' : `${status.usage.remaining} remaining`} this month
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
            <button onClick={() => setError('')} className="float-right text-red-500 hover:text-red-700">x</button>
          </div>
        )}

        {/* Provider Selector */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">LLM Provider</label>
              <select
                value={provider}
                onChange={(e) => { setProvider(e.target.value); setModel(''); }}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
              >
                <option value="claude" disabled={!status?.providers.claude.available}>
                  Claude (Anthropic) {!status?.providers.claude.available ? '- No key' : ''}
                </option>
                <option value="openai" disabled={!status?.providers.openai.available}>
                  OpenAI {!status?.providers.openai.available ? '- No key' : ''}
                </option>
                <option value="gemini" disabled={!status?.providers.gemini.available}>
                  Gemini {!status?.providers.gemini.available ? '- No key' : ''}
                </option>
                <option value="grok" disabled={!status?.providers.grok.available}>
                  xAI Grok {!status?.providers.grok.available ? '- No key' : ''}
                </option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Default</option>
                {status?.providers[provider as 'claude' | 'openai' | 'gemini' | 'grok']?.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            {!status?.providers.claude.available && !status?.providers.openai.available && !status?.providers.gemini.available && !status?.providers.grok.available && (
              <div className="flex-1 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded">
                No LLM API key configured. Go to Settings to add your API key.
              </div>
            )}
          </div>
        </div>

        {/* Feature Grid + Results Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Feature Selection */}
          <div className="lg:col-span-1 space-y-4">
            {categories.map((cat) => (
              <div key={cat}>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{cat}</h3>
                <div className="space-y-1">
                  {AI_FEATURES.filter((f) => f.category === cat).map((feature) => (
                    <button
                      key={feature.id}
                      onClick={() => { setActiveFeature(feature.id); setResult(null); setError(''); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeFeature === feature.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
                      }`}
                    >
                      <span className="mr-2">{feature.icon}</span>
                      {feature.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Feature Detail + Results */}
          <div className="lg:col-span-2">
            {!activeFeature ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
                <p className="text-4xl mb-4">🤖</p>
                <p className="text-lg font-medium">Select an AI feature from the left</p>
                <p className="text-sm mt-2">Choose from 16 AI-powered compliance tools</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-6">
                {/* Feature Header */}
                {(() => {
                  const feature = AI_FEATURES.find((f) => f.id === activeFeature);
                  return feature ? (
                    <div className="mb-4">
                      <h2 className="text-xl font-bold text-gray-900">
                        <span className="mr-2">{feature.icon}</span>{feature.name}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">{feature.description}</p>
                    </div>
                  ) : null;
                })()}

                {/* Feature-specific inputs */}
                {renderFeatureInput()}

                {/* Run Button */}
                <button
                  onClick={() => activeFeature && runFeature(activeFeature)}
                  disabled={processing || (!status?.providers.claude.available && !status?.providers.openai.available && !status?.providers.gemini.available && !status?.providers.grok.available)}
                  className="w-full bg-purple-600 text-white px-6 py-3 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      Analyzing...
                    </span>
                  ) : (
                    'Run Analysis'
                  )}
                </button>

                {/* Results */}
                {result && (
                  <div className="mt-6 border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-gray-700 uppercase">Results</h3>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(result);
                        }}
                        className="text-xs text-purple-600 hover:text-purple-800"
                      >
                        Copy to Clipboard
                      </button>
                    </div>
                    <div className="prose prose-sm max-w-none bg-gray-50 rounded-lg p-4 overflow-auto max-h-[600px]">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">{result}</pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
