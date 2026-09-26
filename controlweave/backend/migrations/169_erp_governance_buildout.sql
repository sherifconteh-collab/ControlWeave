-- Migration 169: ERP Governance add-on build-out
--
-- Why: the first ERP release (migrations 166-167) loaded entitlements and
-- transactions from CSV files only, left every organization to write its own
-- permission-to-function map, sent every review item to one reviewer, stopped
-- at "revoke" without telling anyone to do it, and monitored payables and the
-- ledger but not purchasing or configuration. This migration adds:
--   * direct connectors on erp_systems (Workday RaaS, SCIM 2.0 for Oracle
--     Fusion Cloud and SAP Cloud Identity Services, Oracle E-Business Suite
--     database) with encrypted credentials, scheduled syncs and a run history
--     (erp_sync_runs)
--   * erp_permission_library: ControlWeave's starter maps from SAP
--     transaction codes and Oracle E-Business Suite form functions to business
--     functions, used by SoD analysis unless a system switches them off
--   * manager routing for access reviews and revocation tickets (Jira or
--     the ITSM connector) on revoked items
--   * purchase orders and goods receipts in erp_transactions, for three-way
--     match monitoring
--   * configuration monitoring: erp_config_items (current settings),
--     erp_config_changes (every change seen between extracts),
--     erp_config_baselines (approved values) and a baseline library
-- Ships with the ERP Governance add-on release.

-- ---------------------------------------------------------------------------
-- Connectors, schedules and library switch on erp_systems
-- ---------------------------------------------------------------------------

ALTER TABLE erp_systems ADD COLUMN IF NOT EXISTS connector_type TEXT;
ALTER TABLE erp_systems ADD COLUMN IF NOT EXISTS connector_config JSONB NOT NULL DEFAULT '{}'::jsonb;
-- SECURITY: values are encrypted per key with utils/encrypt and never returned by the API.
ALTER TABLE erp_systems ADD COLUMN IF NOT EXISTS connector_auth JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE erp_systems ADD COLUMN IF NOT EXISTS sync_schedule TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE erp_systems ADD COLUMN IF NOT EXISTS sync_hour_utc INTEGER NOT NULL DEFAULT 2;
ALTER TABLE erp_systems ADD COLUMN IF NOT EXISTS next_sync_at TIMESTAMPTZ;
ALTER TABLE erp_systems ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE erp_systems ADD COLUMN IF NOT EXISTS last_sync_status TEXT;
ALTER TABLE erp_systems ADD COLUMN IF NOT EXISTS last_sync_error TEXT;
ALTER TABLE erp_systems ADD COLUMN IF NOT EXISTS auto_analyze BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE erp_systems ADD COLUMN IF NOT EXISTS auto_monitor BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE erp_systems ADD COLUMN IF NOT EXISTS use_library_map BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE erp_systems ADD COLUMN IF NOT EXISTS ticket_connector_id UUID REFERENCES integration_connectors(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_systems_connector_type_check') THEN
    ALTER TABLE erp_systems ADD CONSTRAINT erp_systems_connector_type_check
      CHECK (connector_type IS NULL OR connector_type IN ('workday_raas', 'scim', 'oracle_ebs_db'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_systems_sync_schedule_check') THEN
    ALTER TABLE erp_systems ADD CONSTRAINT erp_systems_sync_schedule_check CHECK (sync_schedule IN ('manual', 'daily', 'weekly'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_systems_sync_hour_check') THEN
    ALTER TABLE erp_systems ADD CONSTRAINT erp_systems_sync_hour_check CHECK (sync_hour_utc BETWEEN 0 AND 23);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_systems_last_sync_status_check') THEN
    ALTER TABLE erp_systems ADD CONSTRAINT erp_systems_last_sync_status_check CHECK (last_sync_status IS NULL OR last_sync_status IN ('success', 'failed'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_erp_systems_next_sync ON erp_systems (next_sync_at) WHERE sync_schedule <> 'manual';

CREATE TABLE IF NOT EXISTS erp_sync_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id       UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  trigger         TEXT NOT NULL CHECK (trigger IN ('manual', 'scheduled')),
  status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  summary         JSONB NOT NULL DEFAULT '{}'::jsonb,
  error           TEXT,
  started_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_erp_sync_runs_system ON erp_sync_runs (system_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_erp_sync_runs_org ON erp_sync_runs (organization_id);

-- ---------------------------------------------------------------------------
-- Permission-to-function starter maps (library; no organization data)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS erp_permission_library (
  platform      TEXT NOT NULL CHECK (platform IN ('sap', 'oracle_ebs')),
  permission    TEXT NOT NULL,
  function_code TEXT NOT NULL,
  PRIMARY KEY (platform, permission, function_code)
);

-- SAP: S_TCODE transaction codes. A transaction code shows what a role can
-- start, not every authorization object value behind it, so this map is
-- deliberately conservative (it can over-report, never under-report).
INSERT INTO erp_permission_library (platform, permission, function_code)
VALUES
  ('sap', 'ME51N', 'REQUISITION_CREATE'), ('sap', 'ME52N', 'REQUISITION_CREATE'), ('sap', 'ME51', 'REQUISITION_CREATE'), ('sap', 'ME52', 'REQUISITION_CREATE'),
  ('sap', 'XK01', 'VENDOR_MAINT'), ('sap', 'XK02', 'VENDOR_MAINT'), ('sap', 'FK01', 'VENDOR_MAINT'), ('sap', 'FK02', 'VENDOR_MAINT'),
  ('sap', 'MK01', 'VENDOR_MAINT'), ('sap', 'MK02', 'VENDOR_MAINT'), ('sap', 'BP', 'VENDOR_MAINT'),
  ('sap', 'XK02', 'VENDOR_BANK_MAINT'), ('sap', 'FK02', 'VENDOR_BANK_MAINT'), ('sap', 'BP', 'VENDOR_BANK_MAINT'),
  ('sap', 'ME21N', 'PO_CREATE'), ('sap', 'ME22N', 'PO_CREATE'), ('sap', 'ME21', 'PO_CREATE'), ('sap', 'ME22', 'PO_CREATE'), ('sap', 'ME25', 'PO_CREATE'),
  ('sap', 'ME28', 'PO_APPROVE'), ('sap', 'ME29N', 'PO_APPROVE'),
  ('sap', 'MIGO', 'GOODS_RECEIPT'), ('sap', 'MIGO_GR', 'GOODS_RECEIPT'), ('sap', 'MB01', 'GOODS_RECEIPT'),
  ('sap', 'MIRO', 'AP_INVOICE_ENTRY'), ('sap', 'MIR7', 'AP_INVOICE_ENTRY'), ('sap', 'FB60', 'AP_INVOICE_ENTRY'), ('sap', 'FB65', 'AP_INVOICE_ENTRY'), ('sap', 'F-43', 'AP_INVOICE_ENTRY'),
  ('sap', 'MRBR', 'AP_INVOICE_APPROVE'), ('sap', 'FBV0', 'AP_INVOICE_APPROVE'),
  ('sap', 'F110', 'AP_PAYMENT_RUN'), ('sap', 'F-53', 'AP_PAYMENT_RUN'), ('sap', 'F-58', 'AP_PAYMENT_RUN'), ('sap', 'F-48', 'AP_PAYMENT_RUN'),
  ('sap', 'BNK_APP', 'AP_PAYMENT_RELEASE'),
  ('sap', 'XD01', 'CUSTOMER_MAINT'), ('sap', 'XD02', 'CUSTOMER_MAINT'), ('sap', 'FD01', 'CUSTOMER_MAINT'), ('sap', 'FD02', 'CUSTOMER_MAINT'),
  ('sap', 'VD01', 'CUSTOMER_MAINT'), ('sap', 'VD02', 'CUSTOMER_MAINT'), ('sap', 'BP', 'CUSTOMER_MAINT'),
  ('sap', 'FD32', 'CREDIT_LIMIT_MAINT'), ('sap', 'UKM_BP', 'CREDIT_LIMIT_MAINT'),
  ('sap', 'VK11', 'PRICING_MAINT'), ('sap', 'VK12', 'PRICING_MAINT'),
  ('sap', 'VA01', 'SALES_ORDER_ENTRY'), ('sap', 'VA02', 'SALES_ORDER_ENTRY'),
  ('sap', 'VF01', 'BILLING'), ('sap', 'VF02', 'BILLING'), ('sap', 'VF04', 'BILLING'),
  ('sap', 'F-28', 'AR_CASH_APPLY'), ('sap', 'F-32', 'AR_CASH_APPLY'),
  ('sap', 'FB75', 'AR_CREDIT_MEMO'),
  ('sap', 'FS00', 'GL_ACCOUNT_MAINT'), ('sap', 'FSS0', 'GL_ACCOUNT_MAINT'), ('sap', 'FSP0', 'GL_ACCOUNT_MAINT'),
  ('sap', 'FB50', 'GL_JE_ENTRY'), ('sap', 'FB50L', 'GL_JE_ENTRY'), ('sap', 'F-02', 'GL_JE_ENTRY'), ('sap', 'FB01', 'GL_JE_ENTRY'), ('sap', 'FV50', 'GL_JE_ENTRY'),
  ('sap', 'FBV0', 'GL_JE_APPROVE'),
  ('sap', 'OB52', 'GL_PERIOD_CONTROL'),
  ('sap', 'OB08', 'FX_RATE_MAINT'),
  ('sap', 'FF67', 'BANK_RECON'), ('sap', 'FEBAN', 'BANK_RECON'),
  ('sap', 'AS01', 'ASSET_MAINT'), ('sap', 'AS02', 'ASSET_MAINT'),
  ('sap', 'ABAVN', 'ASSET_DISPOSE'), ('sap', 'ABT1N', 'ASSET_DISPOSE'), ('sap', 'ABUMN', 'ASSET_DISPOSE'),
  ('sap', 'PA40', 'EMPLOYEE_MAINT'), ('sap', 'PA30', 'EMPLOYEE_MAINT'),
  ('sap', 'PA30', 'PAY_RATE_MAINT'),
  ('sap', 'PA30', 'EMPLOYEE_BANK_MAINT'),
  ('sap', 'CATS_APPR_LITE', 'TIME_ENTRY_APPROVE'),
  ('sap', 'PC00_M10_CALC', 'PAYROLL_RUN'), ('sap', 'PC00_M99_CALC', 'PAYROLL_RUN'), ('sap', 'PA03', 'PAYROLL_RUN'),
  ('sap', 'FI12', 'BANK_ACCOUNT_MAINT'), ('sap', 'FI12_HBANK', 'BANK_ACCOUNT_MAINT'),
  ('sap', 'FRFT_B', 'TREASURY_PAYMENT'),
  ('sap', 'FTR_CREATE', 'INVESTMENT_TRADE'),
  ('sap', 'MM01', 'MATERIAL_MAINT'), ('sap', 'MM02', 'MATERIAL_MAINT'),
  ('sap', 'MI07', 'INVENTORY_ADJUST'),
  ('sap', 'MI04', 'INVENTORY_COUNT'),
  ('sap', 'SU01', 'SECURITY_ADMIN'), ('sap', 'SU10', 'SECURITY_ADMIN'), ('sap', 'PFCG', 'SECURITY_ADMIN'),
  ('sap', 'SPRO', 'CONFIG_MAINT'), ('sap', 'SM30', 'CONFIG_MAINT'), ('sap', 'SCC4', 'CONFIG_MAINT'), ('sap', 'RZ10', 'CONFIG_MAINT'), ('sap', 'OMR6', 'CONFIG_MAINT')
ON CONFLICT DO NOTHING;

-- Oracle E-Business Suite: form function names (FND_FORM_FUNCTIONS).
INSERT INTO erp_permission_library (platform, permission, function_code)
VALUES
  ('oracle_ebs', 'PO_POXRQERQ', 'REQUISITION_CREATE'),
  ('oracle_ebs', 'AP_APXVDMVD', 'VENDOR_MAINT'),
  ('oracle_ebs', 'PO_POXPOEPO', 'PO_CREATE'),
  ('oracle_ebs', 'RCV_RCVRCERC', 'GOODS_RECEIPT'),
  ('oracle_ebs', 'AP_APXINWKB', 'AP_INVOICE_ENTRY'),
  ('oracle_ebs', 'AP_APXPAWKB', 'AP_PAYMENT_RUN'),
  ('oracle_ebs', 'AR_ARXTWMAI', 'BILLING'),
  ('oracle_ebs', 'AR_ARXRWMAI', 'AR_CASH_APPLY'),
  ('oracle_ebs', 'GL_GLXJEENT', 'GL_JE_ENTRY'),
  ('oracle_ebs', 'FND_FNDSCAUS', 'SECURITY_ADMIN'),
  ('oracle_ebs', 'FND_FNDSCRSP', 'SECURITY_ADMIN')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Access reviews: manager routing and revocation tickets
-- ---------------------------------------------------------------------------

ALTER TABLE erp_access_reviews ADD COLUMN IF NOT EXISTS routing TEXT NOT NULL DEFAULT 'reviewer';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_access_reviews_routing_check') THEN
    ALTER TABLE erp_access_reviews ADD CONSTRAINT erp_access_reviews_routing_check CHECK (routing IN ('reviewer', 'manager'));
  END IF;
END$$;

ALTER TABLE erp_access_review_items ADD COLUMN IF NOT EXISTS routed_by TEXT;
ALTER TABLE erp_access_review_items ADD COLUMN IF NOT EXISTS ticket_connector_id UUID REFERENCES integration_connectors(id) ON DELETE SET NULL;
ALTER TABLE erp_access_review_items ADD COLUMN IF NOT EXISTS ticket_key TEXT;
ALTER TABLE erp_access_review_items ADD COLUMN IF NOT EXISTS ticket_url TEXT;
ALTER TABLE erp_access_review_items ADD COLUMN IF NOT EXISTS ticket_status TEXT;
ALTER TABLE erp_access_review_items ADD COLUMN IF NOT EXISTS ticket_created_at TIMESTAMPTZ;
ALTER TABLE erp_access_review_items ADD COLUMN IF NOT EXISTS ticket_synced_at TIMESTAMPTZ;
ALTER TABLE erp_access_review_items ADD COLUMN IF NOT EXISTS ticket_error TEXT;

CREATE INDEX IF NOT EXISTS idx_erp_access_review_items_reviewer ON erp_access_review_items (reviewer_id, decision) WHERE reviewer_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Purchasing documents for three-way match
-- ---------------------------------------------------------------------------

ALTER TABLE erp_transactions ADD COLUMN IF NOT EXISTS quantity NUMERIC(18,4);
ALTER TABLE erp_transactions DROP CONSTRAINT IF EXISTS erp_transactions_txn_type_check;
ALTER TABLE erp_transactions ADD CONSTRAINT erp_transactions_txn_type_check
  CHECK (txn_type IN ('payment', 'invoice', 'journal_entry', 'vendor_change', 'purchase_order', 'goods_receipt'));

CREATE INDEX IF NOT EXISTS idx_erp_transactions_reference ON erp_transactions (system_id, txn_type, reference);
CREATE INDEX IF NOT EXISTS idx_erp_transactions_document ON erp_transactions (system_id, txn_type, document_number);

-- ---------------------------------------------------------------------------
-- Configuration monitoring
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS erp_config_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id        UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  config_key       TEXT NOT NULL,
  category         TEXT,
  value            TEXT,
  description      TEXT,
  last_changed_at  TIMESTAMPTZ,
  last_changed_by  TEXT,
  is_present       BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT erp_config_items_unique UNIQUE (system_id, config_key)
);

CREATE INDEX IF NOT EXISTS idx_erp_config_items_org ON erp_config_items (organization_id, system_id);

CREATE TABLE IF NOT EXISTS erp_config_changes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id        UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  config_key       TEXT NOT NULL,
  old_value        TEXT,
  new_value        TEXT,
  changed_at       TIMESTAMPTZ,
  changed_by       TEXT,
  detected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erp_config_changes_system ON erp_config_changes (system_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_erp_config_changes_org ON erp_config_changes (organization_id);

CREATE TABLE IF NOT EXISTS erp_config_baselines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id        UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  config_key       TEXT NOT NULL,
  comparison       TEXT NOT NULL CHECK (comparison IN ('equals', 'not_equals', 'min', 'max', 'range', 'in')),
  expected_value   TEXT NOT NULL,
  severity         TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  rationale        TEXT,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT erp_config_baselines_unique UNIQUE (system_id, config_key)
);

CREATE INDEX IF NOT EXISTS idx_erp_config_baselines_org ON erp_config_baselines (organization_id);

-- Recommended settings an organization can adopt for a system and then edit.
CREATE TABLE IF NOT EXISTS erp_config_baseline_library (
  platform         TEXT NOT NULL CHECK (platform IN ('sap', 'oracle_ebs')),
  config_key       TEXT NOT NULL,
  comparison       TEXT NOT NULL CHECK (comparison IN ('equals', 'not_equals', 'min', 'max', 'range', 'in')),
  expected_value   TEXT NOT NULL,
  severity         TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  rationale        TEXT NOT NULL,
  PRIMARY KEY (platform, config_key)
);

INSERT INTO erp_config_baseline_library (platform, config_key, comparison, expected_value, severity, rationale)
VALUES
  ('sap', 'login/min_password_lng', 'min', '8', 'high', 'Minimum password length (NIST SP 800-63B, IA-5). Raise to 15 where DoD STIG applies.'),
  ('sap', 'login/fails_to_user_lock', 'range', '1..5', 'high', 'Lock accounts after a small number of failed logons (AC-7).'),
  ('sap', 'rdisp/gui_auto_logout', 'range', '60..900', 'medium', 'End idle SAP GUI sessions within 15 minutes; 0 disables the timeout (AC-11, AC-12).'),
  ('sap', 'login/no_automatic_user_sapstar', 'equals', '1', 'critical', 'Prevent logon as SAP* with the built-in password when the user master record is deleted.'),
  ('sap', 'login/password_downwards_compatibility', 'equals', '0', 'high', 'Do not keep weak legacy password hashes.'),
  ('sap', 'rsau/enable', 'equals', '1', 'high', 'Security audit log switched on (AU-2, AU-12).'),
  ('sap', 'auth/rfc_authority_check', 'min', '1', 'high', 'Check S_RFC authorization on remote function calls.'),
  ('oracle_ebs', 'SIGNON_PASSWORD_LENGTH', 'min', '8', 'high', 'Minimum password length (IA-5).'),
  ('oracle_ebs', 'SIGNON_PASSWORD_FAILURE_LIMIT', 'range', '1..5', 'high', 'Lock accounts after a small number of failed logons; blank means unlimited (AC-7).'),
  ('oracle_ebs', 'SIGNON_PASSWORD_HARD_TO_GUESS', 'equals', 'Y', 'medium', 'Reject easily guessed passwords (IA-5).'),
  ('oracle_ebs', 'ICX_SESSION_TIMEOUT', 'range', '1..30', 'medium', 'End idle sessions within 30 minutes (AC-11, AC-12).'),
  ('oracle_ebs', 'SIGNON_AUDIT_LEVEL', 'in', 'RESP,FORM', 'medium', 'Record sign-ons at responsibility or form level (AU-2).'),
  ('oracle_ebs', 'AUDITTRAIL:ACTIVATE', 'equals', 'Y', 'high', 'Audit trail switched on for audited tables (AU-12).')
ON CONFLICT DO NOTHING;

SELECT 'Migration 169 completed.' AS result;
