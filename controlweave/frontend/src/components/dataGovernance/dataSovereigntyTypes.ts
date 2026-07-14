// @tier: enterprise
export interface SovereigntyConfig {
  primary_data_region: string | null;
  data_residency_requirements: Record<string, unknown> | null;
  cross_border_transfer_allowed: boolean | null;
  approved_transfer_regions: string[] | null;
  data_localization_policy: string | null;
  sovereignty_attestation_date: string | null;
}

export interface RegulatoryJurisdiction {
  id: string;
  jurisdiction_code: string;
  jurisdiction_name: string;
  jurisdiction_type: string;
  has_ai_regulations: boolean;
  has_data_residency: boolean;
  primary_ai_law: string | null;
  primary_privacy_law: string | null;
}

export interface RecommendedFramework {
  id: string;
  code: string;
  name: string;
  version: string | null;
  description: string | null;
  category: string | null;
}

export interface OrgJurisdiction {
  id: string;
  jurisdiction_id: string;
  presence_type: 'headquarters' | 'office' | 'data_center' | 'customers' | 'vendors';
  operational_since: string | null;
  compliance_required: boolean;
  compliance_status: string;
  last_assessment_date: string | null;
  next_assessment_date: string | null;
  applicable_frameworks: string[] | null;
  notes: string | null;
  jurisdiction_name: string;
  jurisdiction_type: string;
  has_ai_regulations: boolean;
  has_data_residency: boolean;
  primary_ai_law: string | null;
  primary_privacy_law: string | null;
}

export interface RegulatoryChange {
  id: string;
  jurisdiction_id: string;
  jurisdiction_name: string;
  jurisdiction_code: string;
  change_title: string;
  change_type: string;
  announced_date: string | null;
  effective_date: string | null;
  compliance_deadline: string | null;
  impact_level: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  summary: string;
  source_url: string | null;
  requires_action: boolean;
  status: 'monitoring' | 'assessing' | 'implementing' | 'compliant';
}

export interface GapAnalysisRow {
  id: string;
  jurisdiction_name: string;
  jurisdiction_code: string;
  primary_ai_law: string | null;
  primary_privacy_law: string | null;
  presence_type: string;
  compliance_status: string;
  compliance_required: boolean;
  last_assessment_date: string | null;
  next_assessment_date: string | null;
  pending_regulatory_changes: number | string;
  critical_changes: number | string;
}

export const PRESENCE_TYPES = ['headquarters', 'office', 'data_center', 'customers', 'vendors'] as const;
export const CHANGE_TYPES = ['new_law', 'amendment', 'repeal', 'guidance', 'enforcement_action'] as const;
export const CHANGE_STATUSES = ['monitoring', 'assessing', 'implementing', 'compliant'] as const;

export const IMPACT_BADGE_CLASSES: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-700',
  unknown: 'bg-gray-100 text-gray-600',
};

export function sovereigntyErrorMessage(err: unknown, fallback: string): string {
  const responseError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return responseError || fallback;
}

export type ShowToastFn = (message: string, type?: 'success' | 'error') => void;
