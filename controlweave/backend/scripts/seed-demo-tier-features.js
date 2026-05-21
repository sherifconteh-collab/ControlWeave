// @tier: exclude
/**
 * seed-demo-tier-features.js
 *
 * Populates demo data for feature tabs that were added in recent migrations
 * but are not covered by the per-tier comprehensive seed scripts:
 *
 *   - organization_contacts            (pro+)        — migration 078
 *   - evidence_collection_rules        (pro+)        — migration 088
 *   - pending_evidence                 (pro+)        — migration 089
 *   - ai_monitoring_rules              (pro+)        — migrations 057 + 100
 *     (covers all six NIST AI 800-4 compliance-layer categories)
 *   - tprm_vendors / questionnaires /
 *     tprm_documents                   (enterprise+) — migrations 075 + 074
 *   - rmf_packages / rmf_step_history /
 *     rmf_authorization_decisions      (enterprise+) — migration 085
 *   - control_implementations test metadata
 *     (test_method, test_performed_by/at,
 *      reviewed_by/at, review_status)   (all tiers, depth varies) — migration 102
 *   - assessment_result_evidence_links  (all tiers) — migration 102
 *
 * The goal is to give every demo tier (community / pro / enterprise / govcloud)
 * realistic, CISO-quality coverage on every visible tab so the UX matches a
 * real organization at the corresponding maturity level.
 *
 * Idempotent — uses upsert / "delete-by-seed-tag-then-insert" semantics so it
 * is safe to re-run after additional migrations or template changes.
 *
 * Run:
 *   npm run seed:demo:tier-features
 */
require('dotenv').config();
const pool = require('../src/config/database');
const { findUserByEmail } = require('./lib/userSeedHelpers');

const SEED_TAG = 'tier_features_demo';

const DEMO_ACCOUNTS = Object.freeze([
  { email: 'admin@community.com', expectedTier: 'enterprise' },
  { email: 'admin@pro.com',       expectedTier: 'enterprise' },
  { email: 'admin@enterprise.com', expectedTier: 'enterprise' },
  { email: 'admin@govcloud.com',   expectedTier: 'enterprise' }
]);

// All features are available to all users — no tier gating.
// tierAtLeast is kept for compatibility but always returns true.
function tierAtLeast() {
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-tier templates
// ─────────────────────────────────────────────────────────────────────────────

const ORG_CONTACT_TEMPLATES = Object.freeze({
  community: [
    { full_name: 'Jordan Reyes',  email: 'jordan.reyes@partners.example.com', title: 'IT Generalist (MSP)',     team: 'External MSP' },
    { full_name: 'Priya Khanna',  email: 'priya.khanna@accounting.example.com', title: 'Outsourced Accountant', team: 'Finance Vendor' }
  ],
  pro: [
    { full_name: 'Daniel Okafor', email: 'daniel.okafor@partners.example.com', title: 'Privacy Counsel (Outside)', team: 'Legal' },
    { full_name: 'Sara Lin',      email: 'sara.lin@msp.example.com',           title: 'MSP Engineer',              team: 'External MSP' },
    { full_name: 'Marcus Webb',   email: 'marcus.webb@auditor.example.com',    title: 'External Auditor (SOC 2)',  team: 'Audit Firm' }
  ],
  enterprise: [
    { full_name: 'Alicia Hernandez', email: 'alicia.hernandez@bigfour.example.com', title: 'Lead Auditor (SOC 2 + ISO 27001)', team: 'Big Four' }, // ip-hygiene:ignore -- demo contact title only references framework names
    { full_name: 'Robert Chen',      email: 'robert.chen@privacycounsel.example.com', title: 'External Privacy Counsel',         team: 'Legal' },
    { full_name: 'Nadia Sasaki',     email: 'nadia.sasaki@redteam.example.com',       title: 'Red Team Lead',                    team: 'Pen Test Vendor' },
    { full_name: 'Tomás Álvarez',    email: 'tomas.alvarez@msp.example.com',          title: 'Managed SOC Director',             team: 'MSSP' },
    { full_name: 'Hannah Liu',       email: 'hannah.liu@incidentresponse.example.com', title: 'IR Retainer Lead',                team: 'IR Retainer' }
  ],
  govcloud: [
    { full_name: 'Col. James Whitfield (Ret.)', email: 'jwhitfield@advisory.example.gov', title: 'NERC CIP Advisor', team: 'Industry Advisor' },
    { full_name: 'Deborah Park',                email: 'dpark@3pao.example.gov',         title: 'FedRAMP 3PAO Lead',  team: '3PAO' },
    { full_name: 'Marcus Donnelly',             email: 'mdonnelly@dcsa.example.gov',     title: 'DCSA Industrial Security Rep', team: 'Government Sponsor' },
    { full_name: 'Yuki Tanaka',                 email: 'ytanaka@cert.example.gov',       title: 'ICS-CERT Liaison',   team: 'Government Sponsor' }
  ]
});

const EVIDENCE_RULE_TEMPLATES = Object.freeze({
  pro: [
    {
      name: 'Splunk: Failed admin logins (daily)',
      description: 'Pulls failed administrator login attempts daily for AC-7 / IA-5 evidence.',
      source_type: 'splunk',
      source_config: { search: 'index=auth EventCode=4625 user_role=admin', max_events: 500, time_range: '24h' },
      schedule: 'daily',
      tags: ['authentication', 'failed_login', 'admin']
    },
    {
      name: 'Splunk: Privileged role changes (weekly)',
      description: 'Captures changes to privileged groups for AC-2 / AC-6 evidence.',
      source_type: 'splunk',
      source_config: { search: 'index=audit EventCode=4728 OR EventCode=4732', max_events: 200, time_range: '7d' },
      schedule: 'weekly',
      tags: ['privileged_access', 'audit']
    },
    {
      name: 'Connector: GitHub branch protection snapshot (weekly)',
      description: 'Snapshots branch protection rules across all repos to evidence SDLC controls.',
      source_type: 'connector',
      source_config: { connector: 'github', resource: 'branch_protection_rules' },
      schedule: 'weekly',
      tags: ['sdlc', 'github', 'change_management']
    }
  ],
  enterprise: [
    {
      name: 'Splunk: SOC 2 CC6.1 access reviews (monthly)',
      description: 'Monthly user access review evidence for SOC 2 CC6.1 / ISO 27001 A.5.18.',
      source_type: 'splunk',
      source_config: { search: 'index=iam sourcetype=access_review', max_events: 1000, time_range: '30d' },
      schedule: 'monthly',
      tags: ['soc2', 'iso27001', 'access_review']
    },
    {
      name: 'Splunk: Encryption at rest verification (daily)',
      description: 'Daily check that production data stores enforce encryption at rest (SC-28).',
      source_type: 'splunk',
      source_config: { search: 'index=infra encryption_status=enabled', max_events: 250, time_range: '24h' },
      schedule: 'daily',
      tags: ['encryption', 'at_rest', 'sc-28']
    },
    {
      name: 'Connector: AWS CloudTrail root account use (daily)',
      description: 'Detect any root account activity for AC-2 / AC-6 evidence.',
      source_type: 'connector',
      source_config: { connector: 'aws_cloudtrail', resource: 'root_account_events' },
      schedule: 'daily',
      tags: ['aws', 'root_account', 'least_privilege']
    },
    {
      name: 'Connector: PagerDuty IR drill records (monthly)',
      description: 'Monthly export of incident response drill execution for IR-3 evidence.',
      source_type: 'connector',
      source_config: { connector: 'pagerduty', resource: 'incident_drills' },
      schedule: 'monthly',
      tags: ['incident_response', 'ir-3']
    }
  ],
  govcloud: [
    {
      name: 'Splunk: NERC CIP-007 R4 patching status (weekly)',
      description: 'Weekly patch compliance evidence for high-impact BES Cyber Systems.',
      source_type: 'splunk',
      source_config: { search: 'index=ics sourcetype=patch_status impact=high', max_events: 500, time_range: '7d' },
      schedule: 'weekly',
      tags: ['nerc_cip', 'cip-007', 'patching']
    },
    {
      name: 'Splunk: CIP-005 ESP boundary traffic (daily)',
      description: 'Daily Electronic Security Perimeter ingress/egress logs for CIP-005 R1.',
      source_type: 'splunk',
      source_config: { search: 'index=ics sourcetype=esp_firewall action=allow OR action=deny', max_events: 1000, time_range: '24h' },
      schedule: 'daily',
      tags: ['nerc_cip', 'cip-005', 'esp']
    },
    {
      name: 'Connector: CMMC L2 audit log review (weekly)',
      description: 'Weekly CMMC AU.L2-3.3.5 audit log review attestations.',
      source_type: 'connector',
      source_config: { connector: 'splunk_es', resource: 'audit_log_review' },
      schedule: 'weekly',
      tags: ['cmmc', 'au.l2-3.3.5']
    }
  ]
});

const PENDING_EVIDENCE_TEMPLATES = Object.freeze({
  pro: [
    {
      source_type: 'splunk',
      source_summary: '142 failed admin login attempts blocked over the last 24h.',
      ai_title: 'Failed admin login attempts blocked – 24h window',
      ai_description: 'Splunk detected 142 unsuccessful authentication attempts against admin accounts; all blocked by lockout policy. Recommend attaching to AC-7 (Unsuccessful Logon Attempts).',
      ai_confidence: 0.86,
      suggested_tags: ['ac-7', 'failed_login', 'auto_collected']
    },
    {
      source_type: 'connector',
      source_summary: '6 GitHub repos detected with new branch protection enforcement.',
      ai_title: 'GitHub branch protection enabled on 6 repos',
      ai_description: 'Branch protection rules now enforce required reviews + status checks on production-tier repos. Maps to CM-3 (Configuration Change Control) and SA-15 (Development Process).',
      ai_confidence: 0.78,
      suggested_tags: ['cm-3', 'sdlc', 'github']
    }
  ],
  enterprise: [
    {
      source_type: 'splunk',
      source_summary: 'Monthly access review export for 412 users completed by IAM team.',
      ai_title: 'Monthly user access review – 412 users certified',
      ai_description: 'IAM team certified 412 user accounts in the monthly access review. 9 accounts disabled, 3 entitlements revoked. Maps to SOC 2 CC6.1 and AC-2(j).', // ip-hygiene:ignore -- paraphrased demo narrative referencing control IDs only
      ai_confidence: 0.92,
      suggested_tags: ['soc2', 'cc6.1', 'access_review']
    },
    {
      source_type: 'connector',
      source_summary: 'AWS CloudTrail confirms zero root account activity for 30 consecutive days.',
      ai_title: 'AWS root account dormancy – 30 day attestation',
      ai_description: 'CloudTrail shows no root account API calls or console logins in the last 30 days. Recommend attaching to AC-6(2) (Non-Privileged Access for Non-Security Functions).',
      ai_confidence: 0.95,
      suggested_tags: ['aws', 'root_account', 'ac-6']
    },
    {
      source_type: 'connector',
      source_summary: 'PagerDuty logged 1 quarterly tabletop IR drill on schedule.',
      ai_title: 'Q1 incident response tabletop completed',
      ai_description: 'IR-3 quarterly drill executed with full SOC participation. After-action report uploaded. Maps to IR-3 / IR-4(1) and SOC 2 CC7.4.', // ip-hygiene:ignore -- paraphrased demo narrative referencing control IDs only
      ai_confidence: 0.88,
      suggested_tags: ['ir-3', 'tabletop', 'soc2']
    }
  ],
  govcloud: [
    {
      source_type: 'splunk',
      source_summary: 'CIP-007 R4: 0 missing patches across 28 high-impact BCS hosts.',
      ai_title: 'NERC CIP-007 R4 patch compliance – 0 gaps detected',
      ai_description: 'All 28 high-impact BES Cyber System hosts are current within the 35-day patching SLA. Recommend attaching to CIP-007 R4 evidence package.',
      ai_confidence: 0.93,
      suggested_tags: ['nerc_cip', 'cip-007-r4']
    },
    {
      source_type: 'splunk',
      source_summary: 'ESP firewall denies: 4,217 inbound attempts blocked at substation perimeter.',
      ai_title: 'CIP-005 R1: ESP firewall blocking inbound traffic',
      ai_description: 'Electronic Security Perimeter firewall denied 4,217 unauthorized inbound connection attempts in the last 24 hours. Maps to CIP-005 R1.',
      ai_confidence: 0.9,
      suggested_tags: ['nerc_cip', 'cip-005-r1', 'esp']
    },
    {
      source_type: 'connector',
      source_summary: 'CMMC AU log review – 12 anomalies investigated, 0 confirmed incidents.',
      ai_title: 'CMMC AU.L2-3.3.5 weekly audit log review',
      ai_description: 'SOC analyst reviewed audit logs and triaged 12 anomalies (all benign). Attestation captured. Maps to CMMC AU.L2-3.3.5.',
      ai_confidence: 0.84,
      suggested_tags: ['cmmc', 'au.l2-3.3.5', 'log_review']
    }
  ]
});

// AI compliance-layer monitoring rules — covers all six NIST AI 800-4 categories
// plus operational baselines. Rules without an ai_agent_id apply org-wide.
const AI_MONITORING_RULES = Object.freeze({
  pro: [
    { rule_name: 'Latency SLO – AI assistant',           rule_type: 'threshold', monitoring_category: 'operational',          metric_name: 'processing_time_ms', threshold_operator: 'gt', threshold_value: 2500, alert_severity: 'medium', description: 'Alert when AI assistant response time exceeds 2.5s.' },
    { rule_name: 'Bias score guardrail',                  rule_type: 'threshold', monitoring_category: 'bias_detection',       metric_name: 'bias_score',         threshold_operator: 'gt', threshold_value: 0.35, alert_severity: 'high',   description: 'Flag outputs whose bias score exceeds 0.35 for human review.' },
    { rule_name: 'Confidence floor – customer responses', rule_type: 'threshold', monitoring_category: 'human_factors',        metric_name: 'confidence_score',   threshold_operator: 'lt', threshold_value: 0.65, alert_severity: 'medium', description: 'Require human review when confidence drops below 65%.' }
  ],
  enterprise: [
    { rule_name: 'Latency SLO – production agents',       rule_type: 'threshold', monitoring_category: 'operational',          metric_name: 'processing_time_ms', threshold_operator: 'gt', threshold_value: 1500, alert_severity: 'medium', description: 'Production agents must respond within 1.5s p95.' },
    { rule_name: 'Demographic parity gap',                rule_type: 'threshold', monitoring_category: 'fairness',             metric_name: 'parity_gap',         threshold_operator: 'gt', threshold_value: 0.10, alert_severity: 'high',   description: 'Alert when demographic outcome parity gap exceeds 10%.' },
    { rule_name: 'Toxicity / bias – customer-facing AI',  rule_type: 'threshold', monitoring_category: 'bias_detection',       metric_name: 'bias_score',         threshold_operator: 'gt', threshold_value: 0.25, alert_severity: 'critical', description: 'Block and require review for customer-facing outputs above 0.25 bias.', block_on_violation: true, require_human_review: true },
    { rule_name: 'Value-alignment policy – LLM outputs',  rule_type: 'pattern',   monitoring_category: 'ethical_ai',           pattern_regex: '(self-harm|illegal|hate)', alert_severity: 'critical', description: 'Pattern-based block on policy-violating language.', block_on_violation: true },
    { rule_name: 'Human-in-the-loop coverage',            rule_type: 'threshold', monitoring_category: 'human_factors',        metric_name: 'hitl_coverage_pct',  threshold_operator: 'lt', threshold_value: 95,   alert_severity: 'medium', description: 'Critical workflows must maintain ≥95% human review coverage.' },
    { rule_name: 'Disparate impact – credit decisioning', rule_type: 'anomaly',   monitoring_category: 'societal_impact',      metric_name: 'disparate_impact',   threshold_operator: 'gt', threshold_value: 0.20, alert_severity: 'high',   description: 'Flag downstream disparate-impact signals on lending models.' },
    { rule_name: 'Model card freshness – EU AI Act',      rule_type: 'policy_violation', monitoring_category: 'regulatory_adherence', metric_name: 'model_card_age_days', threshold_operator: 'gt', threshold_value: 90, alert_severity: 'high', description: 'Model cards must be reviewed at least every 90 days for EU AI Act + NIST AI RMF.' }
  ],
  govcloud: [
    { rule_name: 'Latency SLO – mission systems',         rule_type: 'threshold', monitoring_category: 'operational',          metric_name: 'processing_time_ms', threshold_operator: 'gt', threshold_value: 1000, alert_severity: 'high',   description: 'Mission AI systems p95 latency budget.' },
    { rule_name: 'Equitable triage – defense use cases',  rule_type: 'threshold', monitoring_category: 'fairness',             metric_name: 'parity_gap',         threshold_operator: 'gt', threshold_value: 0.05, alert_severity: 'critical', description: 'Stricter parity gap for defense / public-impact AI.' },
    { rule_name: 'Bias detection – analyst recommendations', rule_type: 'threshold', monitoring_category: 'bias_detection',    metric_name: 'bias_score',         threshold_operator: 'gt', threshold_value: 0.20, alert_severity: 'critical', description: 'Block analyst recommendations exceeding bias threshold.', block_on_violation: true, require_human_review: true },
    { rule_name: 'Lethality / dual-use safeguard',        rule_type: 'pattern',   monitoring_category: 'ethical_ai',           pattern_regex: '(weaponiz|targeting|kill[-_ ]chain)', alert_severity: 'critical', description: 'Block + escalate any output touching lethal autonomy keywords.', block_on_violation: true, require_human_review: true },
    { rule_name: 'Human override coverage – OT systems',  rule_type: 'threshold', monitoring_category: 'human_factors',        metric_name: 'hitl_coverage_pct',  threshold_operator: 'lt', threshold_value: 100,  alert_severity: 'critical', description: 'OT/ICS AI must keep 100% human override coverage.' },
    { rule_name: 'Critical-infrastructure impact watch',  rule_type: 'anomaly',   monitoring_category: 'societal_impact',      metric_name: 'impact_score',       threshold_operator: 'gt', threshold_value: 0.15, alert_severity: 'critical', description: 'Detect anomalies that could cascade into BES Cyber System impact.' },
    { rule_name: 'EO 14110 / NIST AI 800-4 attestation',  rule_type: 'policy_violation', monitoring_category: 'regulatory_adherence', metric_name: 'attestation_age_days', threshold_operator: 'gt', threshold_value: 30, alert_severity: 'high', description: 'Federal AI use cases require monthly attestation.' }
  ]
});

const TPRM_VENDORS = Object.freeze({
  enterprise: [
    { vendor_name: 'Datadog Inc.',           vendor_website: 'https://www.datadoghq.com', vendor_type: 'cloud',         risk_tier: 'high',     review_status: 'approved',       data_access_level: 'limited', services_provided: 'Observability, APM, log management for production fleet.', ai_risk_score: 28 },
    { vendor_name: 'Stripe',                 vendor_website: 'https://stripe.com',        vendor_type: 'data_processor', risk_tier: 'critical', review_status: 'approved',       data_access_level: 'full',    services_provided: 'Payment processing for US/EU customers.',                  ai_risk_score: 22 },
    { vendor_name: 'Snowflake',              vendor_website: 'https://www.snowflake.com', vendor_type: 'cloud',         risk_tier: 'critical', review_status: 'approved',       data_access_level: 'full',    services_provided: 'Cloud data warehouse hosting customer datasets.',          ai_risk_score: 31 },
    { vendor_name: 'Twilio',                 vendor_website: 'https://www.twilio.com',    vendor_type: 'services',      risk_tier: 'medium',   review_status: 'in_review',      data_access_level: 'metadata', services_provided: 'Transactional SMS and email delivery.',                    ai_risk_score: 44 },
    { vendor_name: 'OpenAI',                 vendor_website: 'https://openai.com',        vendor_type: 'services',      risk_tier: 'high',     review_status: 'conditional',    data_access_level: 'metadata', services_provided: 'LLM inference for AI Copilot. Zero-data-retention enabled.', ai_risk_score: 52 },
    { vendor_name: 'BoutiqueLogistics LLC',  vendor_website: 'https://example.com',       vendor_type: 'services',      risk_tier: 'low',      review_status: 'pending_review', data_access_level: 'none',     services_provided: 'Office moving services.',                                  ai_risk_score: 18 }
  ],
  govcloud: [
    { vendor_name: 'AWS GovCloud (US)',          vendor_website: 'https://aws.amazon.com/govcloud-us/', vendor_type: 'cloud', risk_tier: 'critical', review_status: 'approved', data_access_level: 'full',    services_provided: 'FedRAMP High IaaS hosting all CUI workloads.', ai_risk_score: 25 },
    { vendor_name: 'Microsoft Azure Government', vendor_website: 'https://azure.microsoft.com/government', vendor_type: 'cloud', risk_tier: 'critical', review_status: 'approved', data_access_level: 'full', services_provided: 'Secondary FedRAMP High region for DR.',         ai_risk_score: 27 },
    { vendor_name: 'CrowdStrike Falcon GovCloud', vendor_website: 'https://www.crowdstrike.com',         vendor_type: 'software', risk_tier: 'high', review_status: 'approved', data_access_level: 'limited', services_provided: 'EDR across IT and corporate endpoints.',         ai_risk_score: 33 },
    { vendor_name: 'Dragos OT Watch',            vendor_website: 'https://www.dragos.com',                vendor_type: 'managed_service', risk_tier: 'critical', review_status: 'approved', data_access_level: 'limited', services_provided: 'OT/ICS threat intel and managed detection for substations.', ai_risk_score: 30 },
    { vendor_name: 'Iron Mountain Government',   vendor_website: 'https://www.ironmountain.com/government', vendor_type: 'services',  risk_tier: 'medium',   review_status: 'approved',    data_access_level: 'metadata', services_provided: 'Off-site secure media destruction.',          ai_risk_score: 19 },
    { vendor_name: 'Regional Substation Vendor X', vendor_website: 'https://example.gov',                  vendor_type: 'hardware',  risk_tier: 'high',     review_status: 'in_review',   data_access_level: 'none',     services_provided: 'OT relays + protective equipment.',           ai_risk_score: 47 }
  ]
});

const TPRM_QUESTIONNAIRE_TEMPLATES = Object.freeze([
  {
    title: 'SIG Lite – Annual Refresh',
    description: 'Standard Information Gathering (Lite) refresh.',
    status: 'completed', overall_score: 86, ai_generated: false,
    daysSentAgo: 60, daysCompletedAgo: 14
  },
  {
    title: 'SOC 2 Bridge Letter Review',
    description: 'Bridge letter covering the gap between SOC 2 reports.',
    status: 'in_progress', overall_score: null, ai_generated: false,
    daysSentAgo: 18, daysCompletedAgo: null
  },
  {
    title: 'AI Subprocessor Disclosure (NIST AI RMF)',
    description: 'AI-generated questionnaire for AI subprocessor risk.',
    status: 'sent', overall_score: null, ai_generated: true,
    daysSentAgo: 5, daysCompletedAgo: null
  }
]);

const TPRM_DOCUMENT_TEMPLATES = Object.freeze([
  { document_type: 'soc2_report',   document_name: 'SOC 2 Type II – FY24', request_status: 'accepted', daysReceivedAgo: 90, expiresInDays: 275 },
  { document_type: 'iso27001_cert', document_name: 'ISO 27001:2022 Certificate', request_status: 'accepted', daysReceivedAgo: 120, expiresInDays: 610 },
  { document_type: 'pen_test_report', document_name: 'External Pen Test Q4', request_status: 'under_review', daysReceivedAgo: 12, expiresInDays: 350 },
  { document_type: 'dpa',           document_name: 'Data Processing Addendum (GDPR)', request_status: 'accepted', daysReceivedAgo: 200, expiresInDays: null }
]);

const RMF_PACKAGE_TEMPLATES = Object.freeze({
  enterprise: [
    {
      system_name: 'Customer Data Lake (Snowflake)',
      system_description: 'Multi-tenant analytics platform processing PII and financial transactions.',
      current_step: 'monitor', overall_status: 'authorized',
      confidentiality_impact: 'high', integrity_impact: 'moderate', availability_impact: 'moderate',
      categorization_level: 'high', selected_baseline: 'high',
      authorization_type: 'initial', continuous_monitoring_enabled: true,
      lastAssessmentDaysAgo: 60, nextAssessmentInDays: 305,
      auth: { decision_type: 'ato', risk_level: 'moderate', authorizing_official: 'Maya Patel', authorizing_official_title: 'CISO', expiresInDays: 305 }
    },
    {
      system_name: 'Loan Origination Platform',
      system_description: 'Production loan origination system; subject to FFIEC and SOX.',
      current_step: 'authorize', overall_status: 'assessment_complete',
      confidentiality_impact: 'moderate', integrity_impact: 'high', availability_impact: 'high',
      categorization_level: 'high', selected_baseline: 'high',
      authorization_type: 'reauthorization', continuous_monitoring_enabled: true,
      lastAssessmentDaysAgo: 21, nextAssessmentInDays: 365,
      auth: null
    },
    {
      system_name: 'Internal HR Workspace',
      system_description: 'Employee self-service portal; PII at rest.',
      current_step: 'assess', overall_status: 'in_progress',
      confidentiality_impact: 'moderate', integrity_impact: 'moderate', availability_impact: 'low',
      categorization_level: 'moderate', selected_baseline: 'moderate',
      authorization_type: 'initial', continuous_monitoring_enabled: false,
      lastAssessmentDaysAgo: null, nextAssessmentInDays: 90,
      auth: null
    }
  ],
  govcloud: [
    {
      system_name: 'BES SCADA – Eastern Region',
      system_description: 'Bulk Electric System SCADA spanning 14 substations.',
      current_step: 'monitor', overall_status: 'authorized',
      confidentiality_impact: 'high', integrity_impact: 'high', availability_impact: 'high',
      categorization_level: 'high', selected_baseline: 'high',
      authorization_type: 'reauthorization', continuous_monitoring_enabled: true,
      lastAssessmentDaysAgo: 30, nextAssessmentInDays: 335,
      auth: { decision_type: 'ato', risk_level: 'moderate', authorizing_official: 'Brig. Gen. R. Taylor (Ret.)', authorizing_official_title: 'AO', expiresInDays: 335 }
    },
    {
      system_name: 'CUI Engineering Workstation Enclave',
      system_description: 'CMMC L2 enclave for CUI handling by engineering.',
      current_step: 'authorize', overall_status: 'assessment_complete',
      confidentiality_impact: 'high', integrity_impact: 'moderate', availability_impact: 'moderate',
      categorization_level: 'high', selected_baseline: 'high',
      authorization_type: 'initial', continuous_monitoring_enabled: true,
      lastAssessmentDaysAgo: 14, nextAssessmentInDays: 365,
      auth: null
    },
    {
      system_name: 'Plant Outage Management System',
      system_description: 'Operational outage scheduling and dispatch.',
      current_step: 'implement', overall_status: 'in_progress',
      confidentiality_impact: 'moderate', integrity_impact: 'high', availability_impact: 'high',
      categorization_level: 'high', selected_baseline: 'moderate',
      authorization_type: 'initial', continuous_monitoring_enabled: false,
      lastAssessmentDaysAgo: null, nextAssessmentInDays: 180,
      auth: null
    },
    {
      system_name: 'Substation Camera & Physical Access',
      system_description: 'Physical security feeds and badge readers feeding SOC.',
      current_step: 'assess', overall_status: 'in_progress',
      confidentiality_impact: 'moderate', integrity_impact: 'moderate', availability_impact: 'moderate',
      categorization_level: 'moderate', selected_baseline: 'moderate',
      authorization_type: 'initial', continuous_monitoring_enabled: false,
      lastAssessmentDaysAgo: null, nextAssessmentInDays: 120,
      auth: null
    }
  ]
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getDemoAccountContext(client, email) {
  // Use findUserByEmail so we work with either plaintext-email rows or
  // PII-encrypted (email_hash lookup) rows seeded by the per-tier scripts.
  const user = await findUserByEmail(client, email, { select: 'id, organization_id' });
  if (!user) return null;
  const orgRes = await client.query(
    `SELECT id, name, tier FROM organizations WHERE id = $1 LIMIT 1`,
    [user.organization_id]
  );
  if (orgRes.rowCount === 0) return null;
  const org = orgRes.rows[0];
  return {
    user_id: user.id,
    email,
    organization_id: org.id,
    organization_name: org.name,
    tier: org.tier
  };
}

// Discover platform-admin accounts (set up via setup-platform-admin.js using
// PLATFORM_ADMIN_EMAIL).  Their org's actual tier (typically enterprise) drives
// the seed depth.  Returns a list of contexts shaped like getDemoAccountContext,
// with a synthetic email label for logging since the real email is encrypted.
async function getPlatformAdminContexts(client) {
  const res = await client.query(
    `SELECT u.id AS user_id,
            o.id AS organization_id,
            o.name AS organization_name,
            o.tier
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
      WHERE u.is_platform_admin = TRUE
        AND u.is_active = TRUE
      ORDER BY u.created_at ASC`
  );
  return res.rows.map((row) => ({
    user_id: row.user_id,
    email: `platform-admin@${row.organization_name}`,
    organization_id: row.organization_id,
    organization_name: row.organization_name,
    tier: row.tier || 'enterprise'
  }));
}

function daysAgo(n) {
  if (n === null || n === undefined) return null;
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n) {
  if (n === null || n === undefined) return null;
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function tableExists(client, table) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return r.rowCount > 0;
}

// Pull a small set of framework_controls for the org (used to anchor evidence rules
// and pending evidence to real control IDs).
async function loadOrgControlIds(client, organizationId, limit = 8) {
  const r = await client.query(
    `SELECT fc.id
       FROM framework_controls fc
       JOIN organization_frameworks of_ ON of_.framework_id = fc.framework_id
       WHERE of_.organization_id = $1
       ORDER BY fc.control_id
       LIMIT $2`,
    [organizationId, limit]
  );
  return r.rows.map((row) => row.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-feature seeders (idempotent)
// ─────────────────────────────────────────────────────────────────────────────

// Tier-aware coverage targets for control test results (Phase 5 / migration 102).
// Each tier's level of testing maturity matches its overall posture so the UI
// reflects what an org at that maturity actually looks like.
const CONTROL_TEST_COVERAGE = Object.freeze({
  community:  { coveragePct: 0.20, reviewedFraction: 0.50 },
  pro:        { coveragePct: 0.40, reviewedFraction: 0.65 },
  enterprise: { coveragePct: 0.80, reviewedFraction: 0.85 },
  govcloud:   { coveragePct: 0.90, reviewedFraction: 0.95 }
});

const TEST_METHOD_DISTRIBUTION = Object.freeze([
  'examine', 'interview', 'test', 'automated', 'document_review',
  'examine', 'test', 'automated' // weight examine/test/automated higher
]);

const TEST_NARRATIVES = Object.freeze({
  examine: 'Examined supporting documentation and configuration baselines; sampled 10 records and validated against control objective.',
  interview: 'Interviewed control owner and operator; corroborated procedure execution against process documentation.',
  test: 'Performed walkthrough and reperformance test on 25 events from the population; observed no exceptions.',
  automated: 'Automated test executed by continuous controls monitoring; daily evidence collected and trend reviewed.',
  document_review: 'Reviewed policy, procedure, and prior assessment workpapers; confirmed approval and currency within review cycle.'
});

const REVIEW_COMMENT_TEMPLATES = Object.freeze([
  'Approved – evidence sufficient and aligns to control objective.',
  'Approved with note: re-test scheduled at next quarterly cycle.',
  'Approved – assessor judgment confirmed by reviewer; no further action.',
  'Approved – control operating effectively per sample tested.'
]);

// Seed Phase-5 control test metadata onto an existing slice of
// control_implementations.  This is what powers the "Test Results" UI surface
// alongside controls/evidence.  Idempotent: only ever fills NULL fields and
// uses the same admin/auditor users so re-runs are stable.
async function seedControlTestResults(client, ctx, tier) {
  const cov = CONTROL_TEST_COVERAGE[tier] || CONTROL_TEST_COVERAGE.community;

  // Locate an auditor user in the same org if one exists; fall back to admin.
  const auditorRes = await client.query(
    `SELECT id FROM users
      WHERE organization_id = $1 AND role IN ('auditor','assessor')
      ORDER BY created_at ASC
      LIMIT 1`,
    [ctx.organization_id]
  );
  const reviewerId = auditorRes.rows[0]?.id || ctx.user_id;

  // Pull all implementations that are at least in some level of progress so we
  // don't attach test results to "not_started" rows.  Selecting by stable id
  // ordering means re-runs target the same rows — combined with COALESCE-only
  // updates this is idempotent.
  const implRes = await client.query(
    `SELECT id FROM control_implementations
      WHERE organization_id = $1
        AND status IN ('verified','implemented','satisfied_via_crosswalk','in_progress','needs_review')
      ORDER BY id`,
    [ctx.organization_id]
  );
  const candidates = implRes.rows;
  if (candidates.length === 0) return { tested: 0, reviewed: 0 };

  const targetTested = Math.max(0, Math.floor(candidates.length * cov.coveragePct));
  const targetReviewed = Math.max(0, Math.floor(targetTested * cov.reviewedFraction));

  let tested = 0;
  let reviewed = 0;
  for (let i = 0; i < targetTested; i += 1) {
    const implId = candidates[i].id;
    const method = TEST_METHOD_DISTRIBUTION[i % TEST_METHOD_DISTRIBUTION.length];
    const narrative = TEST_NARRATIVES[method];
    const performedAt = daysAgo(7 + (i % 60));

    const shouldReview = i < targetReviewed;
    const reviewedAt = shouldReview ? daysAgo(1 + (i % 30)) : null;
    const reviewComments = shouldReview
      ? REVIEW_COMMENT_TEMPLATES[i % REVIEW_COMMENT_TEMPLATES.length]
      : null;
    const reviewStatus = shouldReview ? 'approved' : 'pending';

    await client.query(
      `UPDATE control_implementations
          SET implementation_narrative = COALESCE(implementation_narrative, $1),
              test_method              = COALESCE(test_method, $2),
              test_performed_by        = COALESCE(test_performed_by, $3),
              test_performed_at        = COALESCE(test_performed_at, $4),
              reviewed_by              = COALESCE(reviewed_by, $5),
              reviewed_at              = COALESCE(reviewed_at, $6),
              review_comments          = COALESCE(review_comments, $7),
              review_status            = COALESCE(review_status, $8)
        WHERE id = $9 AND organization_id = $10`,
      [
        narrative, method, ctx.user_id, performedAt,
        shouldReview ? reviewerId : null, reviewedAt, reviewComments, reviewStatus,
        implId, ctx.organization_id
      ]
    );
    tested += 1;
    if (shouldReview) reviewed += 1;
  }

  return { tested, reviewed };
}

// Seed assessment_result_evidence_links so each procedure result with a
// satisfied/other_than_satisfied verdict is wired up to a piece of evidence
// the org already owns.  This is what drives the "evidence per procedure
// result" view added in migration 102.  Idempotent via the table's UNIQUE
// (assessment_result_id, evidence_id) constraint.
async function seedAssessmentResultEvidenceLinks(client, ctx /* , tier */) {
  if (!(await tableExists(client, 'assessment_result_evidence_links'))) {
    return 0;
  }

  const evRes = await client.query(
    `SELECT id FROM evidence WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 12`,
    [ctx.organization_id]
  );
  const evidenceIds = evRes.rows.map((r) => r.id);
  if (evidenceIds.length === 0) return 0;

  const arRes = await client.query(
    `SELECT id FROM assessment_results
      WHERE organization_id = $1
        AND status IN ('satisfied','other_than_satisfied')
      ORDER BY assessed_at DESC NULLS LAST
      LIMIT 60`,
    [ctx.organization_id]
  );

  let linked = 0;
  for (let i = 0; i < arRes.rows.length; i += 1) {
    const arId = arRes.rows[i].id;
    const evId = evidenceIds[i % evidenceIds.length];
    const r = await client.query(
      `INSERT INTO assessment_result_evidence_links
         (assessment_result_id, evidence_id, organization_id, link_notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (assessment_result_id, evidence_id) DO NOTHING`,
      [arId, evId, ctx.organization_id, `Demo seed (${SEED_TAG}) – evidence sample for procedure result.`, ctx.user_id]
    );
    if (r.rowCount > 0) linked += 1;
  }
  return linked;
}

async function seedOrgContacts(client, ctx, tier) {
  if (!(await tableExists(client, 'organization_contacts'))) return 0;
  const templates = ORG_CONTACT_TEMPLATES[tier] || [];
  if (templates.length === 0) return 0;

  let count = 0;
  for (const t of templates) {
    const existing = await client.query(
      `SELECT id FROM organization_contacts
       WHERE organization_id = $1 AND full_name = $2 LIMIT 1`,
      [ctx.organization_id, t.full_name]
    );
    if (existing.rowCount > 0) {
      await client.query(
        `UPDATE organization_contacts
            SET email = $1, title = $2, team = $3, is_active = true,
                notes = $4, updated_at = NOW()
          WHERE id = $5`,
        [t.email, t.title, t.team, `Demo seed (${SEED_TAG}) – ${tier} tier`, existing.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO organization_contacts
           (organization_id, full_name, email, title, team, notes, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7)`,
        [ctx.organization_id, t.full_name, t.email, t.title, t.team,
         `Demo seed (${SEED_TAG}) – ${tier} tier`, ctx.user_id]
      );
    }
    count += 1;
  }
  return count;
}

async function seedEvidenceCollectionRules(client, ctx, tier) {
  if (!(await tableExists(client, 'evidence_collection_rules'))) return 0;

  // Aggregate all templates — all features are available to all users.
  const templates = [
    ...(EVIDENCE_RULE_TEMPLATES.pro || []),
    ...(EVIDENCE_RULE_TEMPLATES.enterprise || []),
    ...(EVIDENCE_RULE_TEMPLATES.govcloud || [])
  ];
  if (templates.length === 0) return 0;

  const controlIds = await loadOrgControlIds(client, ctx.organization_id, 6);

  let count = 0;
  for (const t of templates) {
    const existing = await client.query(
      `SELECT id FROM evidence_collection_rules
        WHERE organization_id = $1 AND name = $2 LIMIT 1`,
      [ctx.organization_id, t.name]
    );
    const lastRunAt = t.schedule === 'manual' ? null : daysAgo(2);
    const nextRunAt = t.schedule === 'manual' ? null : daysFromNow(t.schedule === 'daily' ? 1 : t.schedule === 'weekly' ? 7 : 30);

    if (existing.rowCount > 0) {
      await client.query(
        `UPDATE evidence_collection_rules
            SET description = $1, source_type = $2, source_config = $3::jsonb,
                schedule = $4, control_ids = $5::uuid[], tags = $6::text[],
                enabled = true, last_run_at = $7, last_run_status = 'success',
                next_run_at = $8, updated_at = NOW()
          WHERE id = $9`,
        [t.description, t.source_type, JSON.stringify(t.source_config || {}),
         t.schedule, controlIds, t.tags || [], lastRunAt, nextRunAt, existing.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO evidence_collection_rules
           (organization_id, name, description, source_type, source_config, schedule,
            control_ids, tags, enabled, last_run_at, last_run_status, next_run_at, created_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::uuid[], $8::text[], true, $9, 'success', $10, $11)`,
        [ctx.organization_id, t.name, t.description, t.source_type,
         JSON.stringify(t.source_config || {}), t.schedule, controlIds, t.tags || [],
         lastRunAt, nextRunAt, ctx.user_id]
      );
    }
    count += 1;
  }
  return count;
}

async function seedPendingEvidence(client, ctx, tier) {
  if (!(await tableExists(client, 'pending_evidence'))) return 0;

  // Aggregate all templates — all features are available to all users.
  const templates = [
    ...(PENDING_EVIDENCE_TEMPLATES.pro || []),
    ...(PENDING_EVIDENCE_TEMPLATES.enterprise || []),
    ...(PENDING_EVIDENCE_TEMPLATES.govcloud || [])
  ];
  if (templates.length === 0) return 0;

  const controlIds = await loadOrgControlIds(client, ctx.organization_id, 4);

  // Refresh — drop only our seed-tagged rows so user-approved items survive.
  await client.query(
    `DELETE FROM pending_evidence
      WHERE organization_id = $1
        AND status = 'pending'
        AND raw_payload ->> 'seed_tag' = $2`,
    [ctx.organization_id, SEED_TAG]
  );

  let count = 0;
  for (const t of templates) {
    const payload = JSON.stringify({ seed_tag: SEED_TAG, source: t.source_type });
    await client.query(
      `INSERT INTO pending_evidence
         (organization_id, source_type, source_summary, ai_title, ai_description,
          ai_confidence, suggested_controls, suggested_tags, raw_payload, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::uuid[], $8::text[], $9::jsonb, 'pending')`,
      [ctx.organization_id, t.source_type, t.source_summary, t.ai_title,
       t.ai_description, t.ai_confidence, controlIds, t.suggested_tags || [], payload]
    );
    count += 1;
  }
  return count;
}

async function seedAiMonitoringRules(client, ctx, tier) {
  if (!(await tableExists(client, 'ai_monitoring_rules'))) return 0;

  // Use the most comprehensive ruleset — all features available to all users.
  const templates = AI_MONITORING_RULES.govcloud;
  if (!templates || templates.length === 0) return 0;

  let count = 0;
  for (const t of templates) {
    const existing = await client.query(
      `SELECT id FROM ai_monitoring_rules
        WHERE organization_id = $1 AND rule_name = $2 LIMIT 1`,
      [ctx.organization_id, t.rule_name]
    );
    const params = [
      ctx.organization_id, t.rule_name, t.rule_type, t.description || null,
      t.metric_name || null,
      t.threshold_value !== undefined ? t.threshold_value : null,
      t.threshold_operator || null,
      t.pattern_regex || null,
      t.alert_severity || 'medium',
      !!t.block_on_violation,
      !!t.require_human_review,
      t.monitoring_category || 'operational',
      ctx.user_id
    ];
    if (existing.rowCount > 0) {
      await client.query(
        `UPDATE ai_monitoring_rules
            SET rule_type = $3, description = $4, metric_name = $5,
                threshold_value = $6, threshold_operator = $7, pattern_regex = $8,
                alert_severity = $9, block_on_violation = $10,
                require_human_review = $11, monitoring_category = $12,
                is_enabled = true, updated_at = NOW()
          WHERE organization_id = $1 AND rule_name = $2`,
        params.slice(0, 12)
      );
    } else {
      await client.query(
        `INSERT INTO ai_monitoring_rules
           (organization_id, rule_name, rule_type, description, metric_name,
            threshold_value, threshold_operator, pattern_regex, alert_severity,
            block_on_violation, require_human_review, monitoring_category,
            created_by, is_enabled)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true)`,
        params
      );
    }
    count += 1;
  }
  return count;
}

async function seedTprm(client, ctx, tier) {
  if (!(await tableExists(client, 'tprm_vendors'))) return { vendors: 0, questionnaires: 0, documents: 0 };

  const vendors = TPRM_VENDORS[tier] || TPRM_VENDORS.enterprise;
  if (!vendors || vendors.length === 0) return { vendors: 0, questionnaires: 0, documents: 0 };

  const hasQuestionnaires = await tableExists(client, 'tprm_questionnaires');
  const hasDocuments = await tableExists(client, 'tprm_documents');

  let vendorCount = 0;
  let qCount = 0;
  let docCount = 0;

  for (const v of vendors) {
    const existing = await client.query(
      `SELECT id FROM tprm_vendors
        WHERE organization_id = $1 AND vendor_name = $2 LIMIT 1`,
      [ctx.organization_id, v.vendor_name]
    );
    let vendorId;
    const baseFields = [
      v.vendor_website || null,
      v.vendor_type || 'other',
      v.risk_tier || 'medium',
      v.review_status || 'pending_review',
      v.data_access_level || 'none',
      v.services_provided || null,
      v.ai_risk_score ?? null,
      v.ai_risk_score != null ? `Demo AI risk summary for ${v.vendor_name}.` : null
    ];
    if (existing.rowCount > 0) {
      vendorId = existing.rows[0].id;
      await client.query(
        `UPDATE tprm_vendors
            SET vendor_website = $1, vendor_type = $2, risk_tier = $3,
                review_status = $4, data_access_level = $5, services_provided = $6,
                ai_risk_score = $7::int, ai_risk_summary = $8,
                ai_assessed_at = CASE WHEN $7::int IS NULL THEN NULL ELSE NOW() END,
                last_review_date = CURRENT_DATE - INTERVAL '30 days',
                next_review_date = CURRENT_DATE + INTERVAL '335 days',
                notes = $9, updated_at = NOW()
          WHERE id = $10`,
        [...baseFields, `Demo seed (${SEED_TAG})`, vendorId]
      );
    } else {
      const r = await client.query(
        `INSERT INTO tprm_vendors
           (organization_id, vendor_name, vendor_website, vendor_type, risk_tier,
            review_status, data_access_level, services_provided, ai_risk_score,
            ai_risk_summary, ai_assessed_at, last_review_date, next_review_date,
            notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::int, $10,
                 CASE WHEN $9::int IS NULL THEN NULL ELSE NOW() END,
                 CURRENT_DATE - INTERVAL '30 days',
                 CURRENT_DATE + INTERVAL '335 days',
                 $11, $12)
         RETURNING id`,
        [ctx.organization_id, v.vendor_name, ...baseFields,
         `Demo seed (${SEED_TAG})`, ctx.user_id]
      );
      vendorId = r.rows[0].id;
    }
    vendorCount += 1;

    // One questionnaire per template per vendor (idempotent on title+vendor).
    if (hasQuestionnaires) {
      for (const q of TPRM_QUESTIONNAIRE_TEMPLATES) {
        const exists = await client.query(
          `SELECT id FROM tprm_questionnaires
            WHERE organization_id = $1 AND vendor_id = $2 AND title = $3 LIMIT 1`,
          [ctx.organization_id, vendorId, q.title]
        );
        if (exists.rowCount > 0) continue;
        await client.query(
          `INSERT INTO tprm_questionnaires
             (organization_id, vendor_id, title, description, status, due_date,
              sent_at, completed_at, questions, responses, ai_generated,
              overall_score, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13)`,
          [
            ctx.organization_id, vendorId, q.title, q.description, q.status,
            daysFromNow(30), daysAgo(q.daysSentAgo), daysAgo(q.daysCompletedAgo),
            JSON.stringify([
              { id: 'q1', text: 'Describe your encryption-at-rest controls.' },
              { id: 'q2', text: 'How are subprocessors managed and disclosed?' },
              { id: 'q3', text: 'Provide a copy of your most recent SOC 2 / ISO 27001 report.' }
            ]),
            JSON.stringify(q.status === 'completed' ? { q1: 'AES-256-GCM with managed keys.', q2: 'Tracked in TPRM platform.', q3: 'Attached.' } : {}),
            !!q.ai_generated,
            q.overall_score,
            ctx.user_id
          ]
        );
        qCount += 1;
      }
    }

    if (hasDocuments) {
      for (const d of TPRM_DOCUMENT_TEMPLATES) {
        const exists = await client.query(
          `SELECT id FROM tprm_documents
            WHERE organization_id = $1 AND vendor_id = $2 AND document_name = $3 LIMIT 1`,
          [ctx.organization_id, vendorId, d.document_name]
        );
        if (exists.rowCount > 0) continue;
        await client.query(
          `INSERT INTO tprm_documents
             (organization_id, vendor_id, document_type, document_name,
              request_status, requested_at, received_at, expires_at, notes, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            ctx.organization_id, vendorId, d.document_type, d.document_name,
            d.request_status,
            daysAgo((d.daysReceivedAgo || 0) + 7),
            d.daysReceivedAgo ? daysAgo(d.daysReceivedAgo) : null,
            d.expiresInDays ? daysFromNow(d.expiresInDays) : null,
            `Demo seed (${SEED_TAG})`,
            ctx.user_id
          ]
        );
        docCount += 1;
      }
    }
  }

  return { vendors: vendorCount, questionnaires: qCount, documents: docCount };
}

async function seedRmf(client, ctx, tier) {
  if (!(await tableExists(client, 'rmf_packages'))) return { packages: 0, history: 0, decisions: 0 };

  const hasHistory = await tableExists(client, 'rmf_step_history');
  const hasDecisions = await tableExists(client, 'rmf_authorization_decisions');

  const templates = RMF_PACKAGE_TEMPLATES[tier] || RMF_PACKAGE_TEMPLATES.enterprise;
  if (!templates || templates.length === 0) return { packages: 0, history: 0, decisions: 0 };

  const RMF_STEPS = ['prepare', 'categorize', 'select', 'implement', 'assess', 'authorize', 'monitor'];
  let pkgCount = 0;
  let histCount = 0;
  let decisionCount = 0;

  for (const t of templates) {
    let pkgId;
    const existing = await client.query(
      `SELECT id FROM rmf_packages
        WHERE organization_id = $1 AND system_name = $2 LIMIT 1`,
      [ctx.organization_id, t.system_name]
    );

    const lastAssessmentDate = t.lastAssessmentDaysAgo != null ? daysAgo(t.lastAssessmentDaysAgo) : null;
    const nextAssessmentDue = t.nextAssessmentInDays != null ? daysFromNow(t.nextAssessmentInDays) : null;

    if (existing.rowCount > 0) {
      pkgId = existing.rows[0].id;
      await client.query(
        `UPDATE rmf_packages
            SET system_description = $1, current_step = $2, overall_status = $3,
                confidentiality_impact = $4, integrity_impact = $5, availability_impact = $6,
                categorization_level = $7, categorization_rationale = $8,
                selected_baseline = $9, tailoring_notes = $10,
                authorization_type = $11, authorization_boundary = $12,
                continuous_monitoring_enabled = $13,
                last_assessment_date = $14, next_assessment_due = $15,
                updated_by = $16, updated_at = NOW()
          WHERE id = $17`,
        [
          t.system_description, t.current_step, t.overall_status,
          t.confidentiality_impact, t.integrity_impact, t.availability_impact,
          t.categorization_level, `FIPS 199 categorization for ${t.system_name}.`,
          t.selected_baseline, `Tailored ${t.selected_baseline} baseline; demo seed (${SEED_TAG}).`,
          t.authorization_type, `Authorization boundary scoped to ${t.system_name} and immediate dependencies.`,
          !!t.continuous_monitoring_enabled,
          lastAssessmentDate, nextAssessmentDue, ctx.user_id, pkgId
        ]
      );
    } else {
      const r = await client.query(
        `INSERT INTO rmf_packages
           (organization_id, system_name, system_description, current_step, overall_status,
            confidentiality_impact, integrity_impact, availability_impact,
            categorization_level, categorization_rationale,
            selected_baseline, tailoring_notes,
            authorization_type, authorization_boundary,
            continuous_monitoring_enabled, last_assessment_date, next_assessment_due,
            created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18)
         RETURNING id`,
        [
          ctx.organization_id, t.system_name, t.system_description,
          t.current_step, t.overall_status,
          t.confidentiality_impact, t.integrity_impact, t.availability_impact,
          t.categorization_level, `FIPS 199 categorization for ${t.system_name}.`,
          t.selected_baseline, `Tailored ${t.selected_baseline} baseline; demo seed (${SEED_TAG}).`,
          t.authorization_type, `Authorization boundary scoped to ${t.system_name} and immediate dependencies.`,
          !!t.continuous_monitoring_enabled,
          lastAssessmentDate, nextAssessmentDue, ctx.user_id
        ]
      );
      pkgId = r.rows[0].id;
    }
    pkgCount += 1;

    if (hasHistory) {
      // Wipe and replay our seed-tagged history so it stays consistent with the
      // template's current_step.  Only deletes rows we created.
      await client.query(
        `DELETE FROM rmf_step_history
          WHERE rmf_package_id = $1
            AND artifacts ->> 'seed_tag' = $2`,
        [pkgId, SEED_TAG]
      );

      const targetIdx = RMF_STEPS.indexOf(t.current_step);
      let prev = null;
      for (let i = 0; i <= targetIdx; i += 1) {
        const step = RMF_STEPS[i];
        await client.query(
          `INSERT INTO rmf_step_history
             (rmf_package_id, organization_id, from_step, to_step, action, notes, artifacts, performed_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
          [
            pkgId, ctx.organization_id, prev, step,
            i === 0 ? 'reset' : 'advance',
            `Demo: advanced to ${step} step.`,
            JSON.stringify({ seed_tag: SEED_TAG, step }),
            ctx.user_id
          ]
        );
        histCount += 1;
        prev = step;
      }
    }

    if (hasDecisions && t.auth) {
      const exists = await client.query(
        `SELECT id FROM rmf_authorization_decisions
          WHERE rmf_package_id = $1 AND is_active = true LIMIT 1`,
        [pkgId]
      );
      if (exists.rowCount === 0) {
        await client.query(
          `INSERT INTO rmf_authorization_decisions
             (rmf_package_id, organization_id, decision_type, decision_date,
              expiration_date, conditions, risk_level, residual_risk_statement,
              authorizing_official, authorizing_official_title, is_active, created_by)
           VALUES ($1,$2,$3,CURRENT_DATE - INTERVAL '30 days',$4,$5,$6,$7,$8,$9,true,$10)`,
          [
            pkgId, ctx.organization_id, t.auth.decision_type,
            t.auth.expiresInDays ? daysFromNow(t.auth.expiresInDays) : null,
            'Continuous monitoring required; quarterly POA&M review.',
            t.auth.risk_level || 'moderate',
            `Residual risk accepted at ${t.auth.risk_level || 'moderate'} level with documented compensating controls.`,
            t.auth.authorizing_official, t.auth.authorizing_official_title, ctx.user_id
          ]
        );
        decisionCount += 1;
      }
    }
  }

  return { packages: pkgCount, history: histCount, decisions: decisionCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

async function seedFeaturesForAccount(client, ctx, expectedTier) {
  // All orgs have full access — use enterprise-level seeding regardless of stored tier.
  const tier = 'enterprise';

  const contacts = await seedOrgContacts(client, ctx, tier);
  const evidenceRules = await seedEvidenceCollectionRules(client, ctx, tier);
  const pendingEvidence = await seedPendingEvidence(client, ctx, tier);
  const aiMonRules = await seedAiMonitoringRules(client, ctx, tier);
  const tprm = await seedTprm(client, ctx, tier);
  const rmf = await seedRmf(client, ctx, tier);
  const controlTests = await seedControlTestResults(client, ctx, tier);
  const evidenceLinks = await seedAssessmentResultEvidenceLinks(client, ctx, tier);

  await client.query(
    `INSERT INTO audit_logs (organization_id, user_id, event_type, resource_type, details, success)
     VALUES ($1, $2, 'demo_tier_features_seeded', 'organization', $3::jsonb, true)`,
    [
      ctx.organization_id, ctx.user_id,
      JSON.stringify({
        seed_tag: SEED_TAG, tier,
        contacts, evidence_rules: evidenceRules, pending_evidence: pendingEvidence,
        ai_monitoring_rules: aiMonRules, tprm, rmf,
        control_tests: controlTests, evidence_links: evidenceLinks
      })
    ]
  );

  return {
    tier, organizationName: ctx.organization_name,
    contacts, evidenceRules, pendingEvidence, aiMonRules,
    tprmVendors: tprm.vendors, tprmQuestionnaires: tprm.questionnaires, tprmDocuments: tprm.documents,
    rmfPackages: rmf.packages, rmfHistory: rmf.history, rmfDecisions: rmf.decisions,
    controlsTested: controlTests.tested, controlsReviewed: controlTests.reviewed,
    evidenceLinks
  };
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('\nSeeding feature data for demo accounts (all features, all orgs)…\n');
    const results = [];
    const seenOrgIds = new Set();

    const accountQueue = [
      ...DEMO_ACCOUNTS.map((a) => ({ ...a, source: 'demo' })),
      ...(await getPlatformAdminContexts(client)).map((ctx) => ({
        email: ctx.email,
        expectedTier: ctx.tier,
        source: 'platform_admin',
        preloadedCtx: ctx
      }))
    ];

    for (const account of accountQueue) {
      const ctx = account.preloadedCtx
        ? account.preloadedCtx
        : await getDemoAccountContext(client, account.email);
      if (!ctx) {
        console.log(`  - Skipped ${account.email}: account not found`);
        continue;
      }
      if (seenOrgIds.has(ctx.organization_id)) {
        // Avoid double-seeding when a platform admin shares an org with a
        // demo account (e.g. someone set PLATFORM_ADMIN_EMAIL=admin@enterprise.com).
        console.log(`  - Skipped ${account.email}: org already seeded this run`);
        continue;
      }
      seenOrgIds.add(ctx.organization_id);

      await client.query('BEGIN');
      try {
        const summary = await seedFeaturesForAccount(client, ctx, account.expectedTier);
        await client.query('COMMIT');
        results.push(summary);
        const label = account.source === 'platform_admin' ? 'platform-admin' : summary.tier;
        console.log(
          `  ✓ ${label.padEnd(14)} ${summary.organizationName} -> ` +
          `contacts=${summary.contacts}, evRules=${summary.evidenceRules}, ` +
          `pendingEv=${summary.pendingEvidence}, aiMonRules=${summary.aiMonRules}, ` +
          `tprm(v/q/d)=${summary.tprmVendors}/${summary.tprmQuestionnaires}/${summary.tprmDocuments}, ` +
          `rmf(pkg/hist/auth)=${summary.rmfPackages}/${summary.rmfHistory}/${summary.rmfDecisions}, ` +
          `controlTests(tested/reviewed)=${summary.controlsTested}/${summary.controlsReviewed}, ` +
          `arEvidenceLinks=${summary.evidenceLinks}`
        );
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`  ✗ Failed for ${account.email}: ${error.message}`);
      }
    }

    console.log('\n✅ Feature seed complete.\n');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error('\n❌ Feature seed failed:', error.message);
  process.exit(1);
});
