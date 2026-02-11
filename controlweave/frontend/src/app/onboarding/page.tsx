'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { organizationAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { requiresOrganizationOnboarding } from '@/lib/access';

type CiaLevel = 'low' | 'moderate' | 'high';
type RmfStage = 'prepare' | 'categorize' | 'select' | 'implement' | 'assess' | 'authorize' | 'monitor';
type DeploymentModel = 'on_prem' | 'single_cloud' | 'multi_cloud' | 'hybrid' | 'saas_only';
type ComplianceProfile = 'private' | 'federal' | 'hybrid';
type NistAdoptionMode = 'best_practice' | 'mandatory';

const ENVIRONMENT_OPTIONS = [
  { value: 'on_prem', label: 'On-Prem' },
  { value: 'cloud', label: 'Cloud' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'saas', label: 'SaaS' },
  { value: 'ot', label: 'OT / ICS' },
  { value: 'development', label: 'Development' },
  { value: 'test', label: 'Test' },
  { value: 'staging', label: 'Staging' },
  { value: 'production', label: 'Production' },
];

const DATA_SENSITIVITY_OPTIONS = [
  { value: 'pii', label: 'PII' },
  { value: 'phi', label: 'PHI' },
  { value: 'pci', label: 'PCI' },
  { value: 'cui', label: 'CUI' },
  { value: 'fci', label: 'FCI' },
  { value: 'financial', label: 'Financial' },
  { value: 'operational', label: 'Operational' },
  { value: 'ip', label: 'Intellectual Property' },
  { value: 'public', label: 'Public' },
  { value: 'internal', label: 'Internal' },
  { value: 'confidential', label: 'Confidential' },
  { value: 'restricted', label: 'Restricted' },
];
const RMF_FRAMEWORK_CODES = ['nist_800_53', 'nist_800_171'];

function toggleArrayValue(current: string[], value: string) {
  if (current.includes(value)) {
    return current.filter((item) => item !== value);
  }
  return [...current, value];
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading, isAuthenticated, refreshUser } = useAuth();

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [companyLegalName, setCompanyLegalName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [headquartersLocation, setHeadquartersLocation] = useState('');
  const [employeeCountRange, setEmployeeCountRange] = useState('');

  const [systemName, setSystemName] = useState('');
  const [systemDescription, setSystemDescription] = useState('');
  const [authorizationBoundary, setAuthorizationBoundary] = useState('');
  const [operatingEnvironmentSummary, setOperatingEnvironmentSummary] = useState('');

  const [confidentialityImpact, setConfidentialityImpact] = useState<CiaLevel | ''>('');
  const [integrityImpact, setIntegrityImpact] = useState<CiaLevel | ''>('');
  const [availabilityImpact, setAvailabilityImpact] = useState<CiaLevel | ''>('');
  const [impactRationale, setImpactRationale] = useState('');

  const [environmentTypes, setEnvironmentTypes] = useState<string[]>([]);
  const [deploymentModel, setDeploymentModel] = useState<DeploymentModel | ''>('');
  const [cloudProvidersInput, setCloudProvidersInput] = useState('');
  const [dataSensitivityTypes, setDataSensitivityTypes] = useState<string[]>([]);

  const [rmfStage, setRmfStage] = useState<RmfStage | ''>('');
  const [rmfNotes, setRmfNotes] = useState('');
  const [complianceProfile, setComplianceProfile] = useState<ComplianceProfile | ''>('private');
  const [nistAdoptionMode, setNistAdoptionMode] = useState<NistAdoptionMode | ''>('best_practice');
  const [nistNotes, setNistNotes] = useState('');
  const [selectedFrameworkCodes, setSelectedFrameworkCodes] = useState<string[]>([]);
  const hasRmfRelevantFramework = selectedFrameworkCodes.some((code) => RMF_FRAMEWORK_CODES.includes(String(code || '').toLowerCase()));
  const requiresNist80053InformationTypes = selectedFrameworkCodes.includes('nist_800_53');
  const rmfRequired = hasRmfRelevantFramework && (nistAdoptionMode === 'mandatory' || complianceProfile !== 'private');

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (!requiresOrganizationOnboarding(user)) {
      if (String(user?.role || '').toLowerCase() === 'auditor') {
        router.push('/dashboard/auditor-workspace');
      } else {
        router.push('/dashboard');
      }
      return;
    }

    if (user?.onboardingCompleted) {
      router.push('/dashboard');
      return;
    }

    const loadProfile = async () => {
      try {
        setPageLoading(true);
        const response = await organizationAPI.getMyProfile();
        const profile = response.data?.data?.profile || {};
        const frameworkCodes = Array.isArray(response.data?.data?.selected_framework_codes)
          ? response.data.data.selected_framework_codes.map((entry: any) => String(entry || '').toLowerCase())
          : [];
        setSelectedFrameworkCodes(frameworkCodes);

        setCompanyLegalName(profile.company_legal_name || '');
        setCompanyDescription(profile.company_description || '');
        setIndustry(profile.industry || '');
        setWebsite(profile.website || '');
        setHeadquartersLocation(profile.headquarters_location || '');
        setEmployeeCountRange(profile.employee_count_range || '');

        setSystemName(profile.system_name || '');
        setSystemDescription(profile.system_description || '');
        setAuthorizationBoundary(profile.authorization_boundary || '');
        setOperatingEnvironmentSummary(profile.operating_environment_summary || '');

        setConfidentialityImpact(profile.confidentiality_impact || '');
        setIntegrityImpact(profile.integrity_impact || '');
        setAvailabilityImpact(profile.availability_impact || '');
        setImpactRationale(profile.impact_rationale || '');

        setEnvironmentTypes(Array.isArray(profile.environment_types) ? profile.environment_types : []);
        setDeploymentModel(profile.deployment_model || '');
        setCloudProvidersInput(Array.isArray(profile.cloud_providers) ? profile.cloud_providers.join(', ') : '');
        setDataSensitivityTypes(Array.isArray(profile.data_sensitivity_types) ? profile.data_sensitivity_types : []);

        setRmfStage(profile.rmf_stage || '');
        setRmfNotes(profile.rmf_notes || '');
        setComplianceProfile(profile.compliance_profile || 'private');
        setNistAdoptionMode(profile.nist_adoption_mode || 'best_practice');
        setNistNotes(profile.nist_notes || '');
      } catch (loadError: any) {
        setError(loadError.response?.data?.error || 'Failed to load onboarding profile');
      } finally {
        setPageLoading(false);
      }
    };

    loadProfile();
  }, [user, loading, isAuthenticated, router]);

  const buildPayload = (markCompleted: boolean) => ({
    company_legal_name: companyLegalName,
    company_description: companyDescription,
    industry: industry || null,
    website: website || null,
    headquarters_location: headquartersLocation || null,
    employee_count_range: employeeCountRange || null,
    system_name: systemName,
    system_description: systemDescription,
    authorization_boundary: authorizationBoundary || null,
    operating_environment_summary: operatingEnvironmentSummary || null,
    confidentiality_impact: confidentialityImpact || null,
    integrity_impact: integrityImpact || null,
    availability_impact: availabilityImpact || null,
    impact_rationale: impactRationale || null,
    environment_types: environmentTypes,
    deployment_model: deploymentModel || null,
    cloud_providers: cloudProvidersInput
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0),
    data_sensitivity_types: dataSensitivityTypes,
    rmf_stage: hasRmfRelevantFramework ? (rmfStage || null) : null,
    rmf_notes: hasRmfRelevantFramework ? (rmfNotes || null) : null,
    compliance_profile: hasRmfRelevantFramework ? (complianceProfile || 'private') : 'private',
    nist_adoption_mode: hasRmfRelevantFramework ? (nistAdoptionMode || 'best_practice') : 'best_practice',
    nist_notes: hasRmfRelevantFramework ? (nistNotes || null) : null,
    onboarding_completed: markCompleted,
  });

  const handleSave = async (markCompleted: boolean) => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await organizationAPI.updateMyProfile(buildPayload(markCompleted));

      if (markCompleted) {
        await refreshUser();
        router.push('/dashboard');
        return;
      }

      setSuccess('Progress saved. Complete setup when ready.');
    } catch (saveError: any) {
      const details = saveError.response?.data;
      if (Array.isArray(details?.missing_fields)) {
        setError(`Complete required fields: ${details.missing_fields.join(', ')}`);
      } else {
        setError(details?.error || 'Failed to save onboarding profile');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-800 py-10 px-4">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-900 text-white px-8 py-6">
          <h1 className="text-2xl font-bold">Organization Onboarding</h1>
          <p className="text-slate-200 mt-2 text-sm">
            Private-sector baseline intake for company context, system scope, CIA baseline, and operating environment.
            Additional NIST/RMF fields are enabled only when your selected frameworks require them.
          </p>
          <p className="text-slate-300 mt-2 text-xs">
            Active frameworks: {selectedFrameworkCodes.length > 0 ? selectedFrameworkCodes.join(', ') : 'None selected yet'}
          </p>
        </div>

        <div className="px-8 py-8 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Company Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Legal Company Name *" value={companyLegalName} onChange={setCompanyLegalName} />
              <Input label="Industry" value={industry} onChange={setIndustry} />
              <Input label="Website" value={website} onChange={setWebsite} placeholder="https://example.com" />
              <Input label="Headquarters Location" value={headquartersLocation} onChange={setHeadquartersLocation} />
              <Select
                label="Employee Count Range"
                value={employeeCountRange}
                onChange={setEmployeeCountRange}
                options={[
                  { value: '', label: 'Select range' },
                  { value: '1-10', label: '1-10' },
                  { value: '11-50', label: '11-50' },
                  { value: '51-200', label: '51-200' },
                  { value: '201-500', label: '201-500' },
                  { value: '501-1000', label: '501-1000' },
                  { value: '1000+', label: '1000+' },
                ]}
              />
            </div>
            <TextArea
              label="Company Description *"
              value={companyDescription}
              onChange={setCompanyDescription}
              rows={3}
              placeholder="Describe mission, business operations, and regulatory footprint."
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">System Context</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="System Name *" value={systemName} onChange={setSystemName} />
            </div>
            <TextArea
              label="System Description *"
              value={systemDescription}
              onChange={setSystemDescription}
              rows={3}
              placeholder="Describe purpose, major capabilities, and information processed."
            />
            <TextArea
              label="Authorization Boundary"
              value={authorizationBoundary}
              onChange={setAuthorizationBoundary}
              rows={3}
              placeholder="Define logical/physical boundaries, interfaces, and external dependencies."
            />
            <TextArea
              label="Operating Environment Summary"
              value={operatingEnvironmentSummary}
              onChange={setOperatingEnvironmentSummary}
              rows={3}
              placeholder="Summarize production/development/test and hosting context."
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">CIA Impact Baseline</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Confidentiality *"
                value={confidentialityImpact}
                onChange={(value) => setConfidentialityImpact(value as CiaLevel | '')}
                options={[
                  { value: '', label: 'Select' },
                  { value: 'low', label: 'Low' },
                  { value: 'moderate', label: 'Moderate' },
                  { value: 'high', label: 'High' },
                ]}
              />
              <Select
                label="Integrity *"
                value={integrityImpact}
                onChange={(value) => setIntegrityImpact(value as CiaLevel | '')}
                options={[
                  { value: '', label: 'Select' },
                  { value: 'low', label: 'Low' },
                  { value: 'moderate', label: 'Moderate' },
                  { value: 'high', label: 'High' },
                ]}
              />
              <Select
                label="Availability *"
                value={availabilityImpact}
                onChange={(value) => setAvailabilityImpact(value as CiaLevel | '')}
                options={[
                  { value: '', label: 'Select' },
                  { value: 'low', label: 'Low' },
                  { value: 'moderate', label: 'Moderate' },
                  { value: 'high', label: 'High' },
                ]}
              />
            </div>
            <TextArea
              label="Impact Rationale"
              value={impactRationale}
              onChange={setImpactRationale}
              rows={3}
              placeholder="Why these impact levels were selected."
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Environment and Data Exposure</h2>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Environment Types *</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {ENVIRONMENT_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={environmentTypes.includes(option.value)}
                      onChange={() => setEnvironmentTypes((current) => toggleArrayValue(current, option.value))}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Deployment Model"
                value={deploymentModel}
                onChange={(value) => setDeploymentModel(value as DeploymentModel | '')}
                options={[
                  { value: '', label: 'Select model' },
                  { value: 'on_prem', label: 'On-Prem' },
                  { value: 'single_cloud', label: 'Single Cloud' },
                  { value: 'multi_cloud', label: 'Multi-Cloud' },
                  { value: 'hybrid', label: 'Hybrid' },
                  { value: 'saas_only', label: 'SaaS Only' },
                ]}
              />
              <Input
                label="Cloud Providers"
                value={cloudProvidersInput}
                onChange={setCloudProvidersInput}
                placeholder="aws, azure, gcp"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">
                {requiresNist80053InformationTypes
                  ? 'Information Types (NIST SP 800-60) *'
                  : 'Data Sensitivity Types'}
              </p>
              {requiresNist80053InformationTypes && (
                <p className="text-xs text-slate-600 mb-2">
                  Required when NIST 800-53 is selected. Choose the data/information types your system processes.
                </p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {DATA_SENSITIVITY_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={dataSensitivityTypes.includes(option.value)}
                      onChange={() => setDataSensitivityTypes((current) => toggleArrayValue(current, option.value))}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </section>

          {hasRmfRelevantFramework ? (
            <>
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">NIST/RMF Operating Mode</h2>
                <p className="text-sm text-slate-600">
                  Because NIST 800-53 or 800-171 is selected, you can track RMF posture here.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Organization Compliance Profile"
                    value={complianceProfile}
                    onChange={(value) => setComplianceProfile(value as ComplianceProfile | '')}
                    options={[
                      { value: 'private', label: 'Private Sector' },
                      { value: 'federal', label: 'Federal / Government' },
                      { value: 'hybrid', label: 'Hybrid (Commercial + Federal)' },
                    ]}
                  />
                  <Select
                    label="NIST Adoption Mode"
                    value={nistAdoptionMode}
                    onChange={(value) => setNistAdoptionMode(value as NistAdoptionMode | '')}
                    options={[
                      { value: 'best_practice', label: 'Best-Practice (Optional)' },
                      { value: 'mandatory', label: 'Mandatory Baseline' },
                    ]}
                  />
                </div>
                <TextArea
                  label="NIST Adoption Notes"
                  value={nistNotes}
                  onChange={setNistNotes}
                  rows={2}
                  placeholder="Capture why NIST is optional or mandatory for your business context."
                />
              </section>

              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">RMF Posture</h2>
                <p className="text-sm text-slate-600">
                  {rmfRequired
                    ? 'RMF stage is required for this selected operating mode.'
                    : 'RMF stage is optional for private-sector best-practice mode.'}
                </p>
                <Select
                  label={`Current RMF Stage${rmfRequired ? ' *' : ''}`}
                  value={rmfStage}
                  onChange={(value) => setRmfStage(value as RmfStage | '')}
                  options={[
                    { value: '', label: 'Select RMF stage' },
                    { value: 'prepare', label: 'Prepare' },
                    { value: 'categorize', label: 'Categorize' },
                    { value: 'select', label: 'Select' },
                    { value: 'implement', label: 'Implement' },
                    { value: 'assess', label: 'Assess' },
                    { value: 'authorize', label: 'Authorize' },
                    { value: 'monitor', label: 'Monitor' },
                  ]}
                />
                <TextArea
                  label="RMF Notes"
                  value={rmfNotes}
                  onChange={setRmfNotes}
                  rows={3}
                  placeholder="Capture current execution posture, approvals, and immediate priorities."
                />
              </section>
            </>
          ) : (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Framework Guidance</h2>
              <p className="text-sm text-slate-600">
                RMF fields are hidden because your selected frameworks do not require NIST RMF tracking.
                If you add NIST 800-53 or 800-171 later, this section will appear automatically.
              </p>
            </section>
          )}

          <div className="pt-4 border-t flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Save Progress
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Complete Setup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
    </label>
  );
}
