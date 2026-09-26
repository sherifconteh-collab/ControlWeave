-- Migration 158: HIPAA Security Risk Assessment (SRA)
--
-- 45 CFR 164.308(a)(1)(ii)(A) requires covered entities and business
-- associates to conduct an accurate and thorough risk analysis, and OCR asks
-- for it first in every investigation. Hospitals and clinics typically use the
-- ONC/OCR SRA Tool, a desktop questionnaire whose output lives outside their
-- compliance program. This adds an SRA workflow inside ControlWeave: one
-- assessment walks every HIPAA Security Rule standard and implementation
-- specification (migration 157), records how it is met, the threat and
-- vulnerability, likelihood and impact (1-5 each, same scale as the risk
-- register), and the decision on Addressable specifications, then promotes
-- the resulting risks to the risk register.

CREATE TABLE IF NOT EXISTS hipaa_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'archived')),
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hipaa_sra_org
  ON hipaa_risk_assessments (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS hipaa_risk_assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES hipaa_risk_assessments(id) ON DELETE CASCADE,
  control_id UUID NOT NULL REFERENCES framework_controls(id) ON DELETE CASCADE,
  answer TEXT CHECK (answer IN ('implemented', 'partially_implemented', 'not_implemented', 'not_applicable')),
  addressable_decision TEXT
    CHECK (addressable_decision IN ('implemented', 'alternative_measure', 'not_reasonable')),
  threat TEXT,
  vulnerability TEXT,
  likelihood SMALLINT CHECK (likelihood BETWEEN 1 AND 5),
  impact SMALLINT CHECK (impact BETWEEN 1 AND 5),
  risk_score SMALLINT GENERATED ALWAYS AS (likelihood * impact) STORED,
  notes TEXT,
  risk_id UUID REFERENCES risks(id) ON DELETE SET NULL,
  responded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hipaa_sra_response_unique UNIQUE (assessment_id, control_id)
);

CREATE INDEX IF NOT EXISTS idx_hipaa_sra_responses_assessment
  ON hipaa_risk_assessment_responses (assessment_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_sra_responses_org
  ON hipaa_risk_assessment_responses (organization_id);
