-- Migration 167: ERP transaction monitoring
--
-- Why: sampling tests a handful of transactions; auditors and fraud examiners
-- increasingly expect whole-population analytics over the payment, invoice,
-- journal and vendor master data in the ERP (duplicate payments, payments
-- shortly after a vendor bank change, self-approved or after-hours journal
-- entries, SoD conflicts that were actually exercised). This migration stores
-- imported transaction extracts and the exceptions the monitoring rules find:
--   * erp_transactions: payments, invoices, journal entries and vendor master
--     changes imported per system
--   * erp_ccm_rule_settings: per-organization switches, thresholds and the
--     risk-control matrix entry each rule evidences (the rules themselves are
--     defined in services/erp/ccmService.js)
--   * erp_ccm_runs / erp_ccm_exceptions: run history and deduplicated
--     exceptions with an investigation workflow
-- Ships with the ERP audit readiness release.

CREATE TABLE IF NOT EXISTS erp_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id       UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  txn_type        TEXT NOT NULL CHECK (txn_type IN ('payment', 'invoice', 'journal_entry', 'vendor_change')),
  external_id     TEXT NOT NULL,
  document_number TEXT,
  reference       TEXT,
  vendor_id       TEXT,
  vendor_name     TEXT,
  amount          NUMERIC(18,2),
  currency        TEXT,
  txn_date        DATE,
  posted_at       TIMESTAMPTZ,
  created_by      TEXT,
  approved_by     TEXT,
  change_field    TEXT,
  attributes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT erp_transactions_unique UNIQUE (system_id, txn_type, external_id)
);

-- SECURITY: multi-tenant isolation -- every query filters organization_id.
CREATE INDEX IF NOT EXISTS idx_erp_transactions_vendor ON erp_transactions (system_id, txn_type, vendor_id, txn_date);
CREATE INDEX IF NOT EXISTS idx_erp_transactions_posted ON erp_transactions (system_id, txn_type, posted_at);
CREATE INDEX IF NOT EXISTS idx_erp_transactions_org ON erp_transactions (organization_id);

CREATE TABLE IF NOT EXISTS erp_ccm_rule_settings (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_code       TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  parameters      JSONB NOT NULL DEFAULT '{}'::jsonb,
  rcm_entry_id    UUID REFERENCES rcm_entries(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, rule_code)
);

CREATE TABLE IF NOT EXISTS erp_ccm_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id       UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  started_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  results         JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_erp_ccm_runs_system ON erp_ccm_runs (system_id, started_at DESC);

CREATE TABLE IF NOT EXISTS erp_ccm_exceptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id         UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  rule_code         TEXT NOT NULL,
  fingerprint       TEXT NOT NULL,
  severity          TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title             TEXT NOT NULL,
  details           JSONB NOT NULL DEFAULT '{}'::jsonb,
  transaction_ids   UUID[] NOT NULL DEFAULT '{}',
  amount            NUMERIC(18,2),
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
  assigned_to       UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes  TEXT,
  resolved_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at       TIMESTAMPTZ,
  last_run_id       UUID REFERENCES erp_ccm_runs(id) ON DELETE SET NULL,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_detected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT erp_ccm_exceptions_unique UNIQUE (system_id, rule_code, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_erp_ccm_exceptions_org_status ON erp_ccm_exceptions (organization_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_erp_ccm_exceptions_system_rule ON erp_ccm_exceptions (system_id, rule_code);

SELECT 'Migration 167 completed.' AS result;
