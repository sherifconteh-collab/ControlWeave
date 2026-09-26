-- Migration 166: ERP access governance
--
-- Why: companies audited under SOX and agencies audited under FISCAM must show
-- that ERP users cannot perform incompatible business functions (enter a
-- vendor and pay it, post and approve a journal entry), that ERP access is
-- recertified, and that emergency (firefighter) access is reviewed. The
-- existing access governance module (migration 126) covers ControlWeave's own
-- users only. This migration adds an ERP entitlement model fed by imports:
--   * erp_systems, erp_users, erp_roles, erp_user_roles
--   * erp_role_functions (role -> business function) and, for ERPs where roles
--     are defined by transaction codes or menus, erp_role_permissions plus
--     erp_function_permissions (permission -> business function)
--   * erp_sod_rules: function-level conflicts; organization_id NULL rows are
--     the ControlWeave library, organizations add their own and can switch
--     library rules off in erp_sod_rule_settings
--   * erp_sod_conflicts: analysis results at user and role level
--   * erp_mitigating_controls: compensating controls for accepted conflicts
--   * erp_access_reviews / erp_access_review_items: recertification campaigns
--     over imported ERP users, with revocations verified by later imports
--   * erp_emergency_sessions: firefighter sessions with after-the-fact review
--   * erp_import_runs: history of every import
--   * erp.read / erp.manage permissions
-- Ships with the ERP audit readiness release.

CREATE TABLE IF NOT EXISTS erp_systems (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  erp_type        TEXT NOT NULL CHECK (erp_type IN ('oracle_ebs', 'oracle_cloud_erp', 'sap_ecc', 'sap_s4hana', 'workday', 'netsuite', 'dynamics_365', 'peoplesoft', 'other')),
  environment     TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'non_production')),
  description     TEXT,
  owner_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  last_import_at  TIMESTAMPTZ,
  last_analysis_at TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT erp_systems_org_name_unique UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS erp_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id       UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  username        TEXT NOT NULL,
  full_name       TEXT,
  email           TEXT,
  department      TEXT,
  manager         TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'locked')),
  last_login_at   TIMESTAMPTZ,
  end_date        DATE,
  attributes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_present      BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT erp_users_system_username_unique UNIQUE (system_id, username)
);

CREATE INDEX IF NOT EXISTS idx_erp_users_org_system ON erp_users (organization_id, system_id);

CREATE TABLE IF NOT EXISTS erp_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id       UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  role_name       TEXT NOT NULL,
  description     TEXT,
  is_privileged   BOOLEAN NOT NULL DEFAULT FALSE,
  is_present      BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT erp_roles_system_name_unique UNIQUE (system_id, role_name)
);

CREATE INDEX IF NOT EXISTS idx_erp_roles_org_system ON erp_roles (organization_id, system_id);

CREATE TABLE IF NOT EXISTS erp_user_roles (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id       UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES erp_users(id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES erp_roles(id) ON DELETE CASCADE,
  granted_at      DATE,
  expires_at      DATE,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_erp_user_roles_system_role ON erp_user_roles (system_id, role_id);

CREATE TABLE IF NOT EXISTS erp_role_functions (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id       UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES erp_roles(id) ON DELETE CASCADE,
  function_code   TEXT NOT NULL,
  PRIMARY KEY (role_id, function_code)
);

CREATE INDEX IF NOT EXISTS idx_erp_role_functions_system ON erp_role_functions (system_id, function_code);

CREATE TABLE IF NOT EXISTS erp_role_permissions (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id       UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES erp_roles(id) ON DELETE CASCADE,
  permission      TEXT NOT NULL,
  PRIMARY KEY (role_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_erp_role_permissions_system ON erp_role_permissions (system_id, permission);

CREATE TABLE IF NOT EXISTS erp_function_permissions (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id       UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  permission      TEXT NOT NULL,
  function_code   TEXT NOT NULL,
  PRIMARY KEY (system_id, permission, function_code)
);

-- Business function catalog. organization_id NULL = ControlWeave library.
CREATE TABLE IF NOT EXISTS erp_functions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  code            TEXT NOT NULL CHECK (code ~ '^[A-Z][A-Z0-9_]{1,59}$'),
  name            TEXT NOT NULL,
  process         TEXT NOT NULL,
  description     TEXT,
  CONSTRAINT erp_functions_org_code_unique UNIQUE NULLS NOT DISTINCT (organization_id, code)
);

CREATE TABLE IF NOT EXISTS erp_sod_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  code             TEXT NOT NULL,
  name             TEXT NOT NULL,
  process          TEXT NOT NULL,
  function_a       TEXT NOT NULL,
  function_b       TEXT NOT NULL,
  risk_description TEXT NOT NULL,
  severity         TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  version          INTEGER NOT NULL DEFAULT 1,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT erp_sod_rules_distinct_functions CHECK (function_a <> function_b),
  CONSTRAINT erp_sod_rules_org_code_unique UNIQUE NULLS NOT DISTINCT (organization_id, code)
);

-- SECURITY: listings return organization_id = $org OR organization_id IS NULL;
-- mutations touch only the organization's own rows.
CREATE INDEX IF NOT EXISTS idx_erp_sod_rules_org ON erp_sod_rules (organization_id);

CREATE TABLE IF NOT EXISTS erp_sod_rule_settings (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id         UUID NOT NULL REFERENCES erp_sod_rules(id) ON DELETE CASCADE,
  is_active       BOOLEAN NOT NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, rule_id)
);

CREATE TABLE IF NOT EXISTS erp_mitigating_controls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  frequency       TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('annual', 'quarterly', 'monthly', 'weekly', 'daily', 'recurring', 'as_needed')),
  owner_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  rcm_entry_id    UUID REFERENCES rcm_entries(id) ON DELETE SET NULL,
  evidence_id     UUID REFERENCES evidence(id) ON DELETE SET NULL,
  last_performed_at TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT erp_mitigating_controls_org_name_unique UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS erp_sod_conflicts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id             UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  rule_id               UUID NOT NULL REFERENCES erp_sod_rules(id) ON DELETE CASCADE,
  level                 TEXT NOT NULL CHECK (level IN ('user', 'role')),
  user_id               UUID REFERENCES erp_users(id) ON DELETE CASCADE,
  role_id               UUID REFERENCES erp_roles(id) ON DELETE CASCADE,
  roles_a               TEXT[] NOT NULL DEFAULT '{}',
  roles_b               TEXT[] NOT NULL DEFAULT '{}',
  status                TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mitigated', 'accepted', 'resolved')),
  mitigating_control_id UUID REFERENCES erp_mitigating_controls(id) ON DELETE SET NULL,
  decision_notes        TEXT,
  decided_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at            TIMESTAMPTZ,
  accepted_until        DATE,
  first_detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_detected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at           TIMESTAMPTZ,
  CONSTRAINT erp_sod_conflicts_subject CHECK ((level = 'user' AND user_id IS NOT NULL) OR (level = 'role' AND role_id IS NOT NULL)),
  CONSTRAINT erp_sod_conflicts_unique UNIQUE NULLS NOT DISTINCT (system_id, rule_id, level, user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_erp_sod_conflicts_org_status ON erp_sod_conflicts (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_erp_sod_conflicts_system ON erp_sod_conflicts (system_id, level);
CREATE INDEX IF NOT EXISTS idx_erp_sod_conflicts_user ON erp_sod_conflicts (user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS erp_access_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id       UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  due_date        DATE,
  reviewer_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  evidence_id     UUID REFERENCES evidence(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_erp_access_reviews_org ON erp_access_reviews (organization_id, status);

CREATE TABLE IF NOT EXISTS erp_access_review_items (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  review_id              UUID NOT NULL REFERENCES erp_access_reviews(id) ON DELETE CASCADE,
  erp_user_id            UUID REFERENCES erp_users(id) ON DELETE SET NULL,
  username               TEXT NOT NULL,
  reviewer_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  snapshot               JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision               TEXT NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'certified', 'revoke')),
  roles_to_revoke        TEXT[] NOT NULL DEFAULT '{}',
  notes                  TEXT,
  decided_by             UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at             TIMESTAMPTZ,
  revocation_verified_at TIMESTAMPTZ,
  CONSTRAINT erp_access_review_items_unique UNIQUE (review_id, username)
);

CREATE INDEX IF NOT EXISTS idx_erp_access_review_items_review ON erp_access_review_items (review_id, decision);
CREATE INDEX IF NOT EXISTS idx_erp_access_review_items_org ON erp_access_review_items (organization_id);

CREATE TABLE IF NOT EXISTS erp_emergency_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id       UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  username        TEXT NOT NULL,
  emergency_id    TEXT NOT NULL,
  reason          TEXT,
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ,
  activity_count  INTEGER,
  activity_summary TEXT,
  review_status   TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'escalated')),
  reviewer_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  CONSTRAINT erp_emergency_sessions_unique UNIQUE (system_id, emergency_id, started_at)
);

CREATE INDEX IF NOT EXISTS idx_erp_emergency_sessions_org ON erp_emergency_sessions (organization_id, review_status);

CREATE TABLE IF NOT EXISTS erp_import_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system_id       UUID NOT NULL REFERENCES erp_systems(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  mode            TEXT NOT NULL DEFAULT 'merge' CHECK (mode IN ('merge', 'replace')),
  row_count       INTEGER NOT NULL DEFAULT 0,
  error_count     INTEGER NOT NULL DEFAULT 0,
  errors          JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erp_import_runs_system ON erp_import_runs (system_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- ControlWeave business function library
-- ---------------------------------------------------------------------------
INSERT INTO erp_functions (organization_id, code, name, process, description)
VALUES
  (NULL, 'REQUISITION_CREATE', 'Create purchase requisitions', 'procure_to_pay', 'Request goods or services.'),
  (NULL, 'VENDOR_MAINT', 'Maintain vendor master', 'procure_to_pay', 'Create or change vendors, addresses and terms.'),
  (NULL, 'VENDOR_BANK_MAINT', 'Maintain vendor bank details', 'procure_to_pay', 'Create or change vendor remittance bank accounts.'),
  (NULL, 'PO_CREATE', 'Create purchase orders', 'procure_to_pay', 'Create or change purchase orders.'),
  (NULL, 'PO_APPROVE', 'Approve purchase orders', 'procure_to_pay', 'Approve or release purchase orders.'),
  (NULL, 'GOODS_RECEIPT', 'Record goods receipts', 'procure_to_pay', 'Record receipt of goods or services.'),
  (NULL, 'AP_INVOICE_ENTRY', 'Enter supplier invoices', 'procure_to_pay', 'Enter or change accounts payable invoices.'),
  (NULL, 'AP_INVOICE_APPROVE', 'Approve supplier invoices', 'procure_to_pay', 'Approve invoices for payment.'),
  (NULL, 'AP_PAYMENT_RUN', 'Prepare payment runs', 'procure_to_pay', 'Select invoices and build payment batches.'),
  (NULL, 'AP_PAYMENT_RELEASE', 'Release payments', 'procure_to_pay', 'Approve, release or transmit payments.'),
  (NULL, 'CUSTOMER_MAINT', 'Maintain customer master', 'order_to_cash', 'Create or change customers.'),
  (NULL, 'CREDIT_LIMIT_MAINT', 'Maintain credit limits', 'order_to_cash', 'Set or change customer credit limits.'),
  (NULL, 'PRICING_MAINT', 'Maintain pricing', 'order_to_cash', 'Create or change price lists and discounts.'),
  (NULL, 'SALES_ORDER_ENTRY', 'Enter sales orders', 'order_to_cash', 'Create or change sales orders.'),
  (NULL, 'BILLING', 'Create customer invoices', 'order_to_cash', 'Generate or change customer billing.'),
  (NULL, 'AR_CASH_APPLY', 'Apply cash receipts', 'order_to_cash', 'Record and apply customer payments.'),
  (NULL, 'AR_CREDIT_MEMO', 'Issue credit memos', 'order_to_cash', 'Create customer credit memos or adjustments.'),
  (NULL, 'AR_WRITE_OFF', 'Write off receivables', 'order_to_cash', 'Write off customer balances.'),
  (NULL, 'GL_ACCOUNT_MAINT', 'Maintain chart of accounts', 'record_to_report', 'Create or change general ledger accounts.'),
  (NULL, 'GL_JE_ENTRY', 'Enter journal entries', 'record_to_report', 'Create or change manual journal entries.'),
  (NULL, 'GL_JE_APPROVE', 'Approve journal entries', 'record_to_report', 'Approve manual journal entries.'),
  (NULL, 'GL_PERIOD_CONTROL', 'Open and close periods', 'record_to_report', 'Open, close or reopen accounting periods.'),
  (NULL, 'FX_RATE_MAINT', 'Maintain exchange rates', 'record_to_report', 'Enter or change currency rates.'),
  (NULL, 'BANK_RECON', 'Reconcile bank accounts', 'record_to_report', 'Perform or approve bank reconciliations.'),
  (NULL, 'ASSET_MAINT', 'Maintain fixed assets', 'fixed_assets', 'Create or change asset records.'),
  (NULL, 'ASSET_DISPOSE', 'Dispose of fixed assets', 'fixed_assets', 'Retire or transfer assets.'),
  (NULL, 'EMPLOYEE_MAINT', 'Maintain employee records', 'hire_to_retire', 'Hire, change or terminate employees.'),
  (NULL, 'PAY_RATE_MAINT', 'Maintain pay rates', 'hire_to_retire', 'Change salary, rates or deductions.'),
  (NULL, 'EMPLOYEE_BANK_MAINT', 'Maintain employee bank details', 'hire_to_retire', 'Change direct deposit accounts.'),
  (NULL, 'TIME_ENTRY_APPROVE', 'Approve time', 'hire_to_retire', 'Approve timesheets.'),
  (NULL, 'PAYROLL_RUN', 'Run payroll', 'hire_to_retire', 'Process and release payroll.'),
  (NULL, 'BANK_ACCOUNT_MAINT', 'Maintain company bank accounts', 'treasury', 'Create or change the organization''s bank accounts.'),
  (NULL, 'TREASURY_PAYMENT', 'Initiate treasury payments', 'treasury', 'Initiate wires and manual payments.'),
  (NULL, 'INVESTMENT_TRADE', 'Execute investment trades', 'treasury', 'Enter investment or borrowing transactions.'),
  (NULL, 'MATERIAL_MAINT', 'Maintain item master', 'inventory', 'Create or change items and costs.'),
  (NULL, 'INVENTORY_ADJUST', 'Adjust inventory', 'inventory', 'Post inventory quantity or value adjustments.'),
  (NULL, 'INVENTORY_COUNT', 'Record inventory counts', 'inventory', 'Enter physical count results.'),
  (NULL, 'SECURITY_ADMIN', 'Administer users and roles', 'it_general', 'Create users and assign roles in the ERP.'),
  (NULL, 'CONFIG_MAINT', 'Maintain system configuration', 'it_general', 'Change approval limits, tolerances and posting rules.')
ON CONFLICT ON CONSTRAINT erp_functions_org_code_unique DO NOTHING;

-- ---------------------------------------------------------------------------
-- ControlWeave SoD rule library (function level, ERP independent)
-- ---------------------------------------------------------------------------
INSERT INTO erp_sod_rules (organization_id, code, name, process, function_a, function_b, risk_description, severity)
VALUES
  (NULL, 'SOD-P2P-01', 'Maintain vendors and enter invoices', 'procure_to_pay', 'VENDOR_MAINT', 'AP_INVOICE_ENTRY', 'A user could create a fictitious vendor and invoice it.', 'critical'),
  (NULL, 'SOD-P2P-02', 'Maintain vendors and release payments', 'procure_to_pay', 'VENDOR_MAINT', 'AP_PAYMENT_RELEASE', 'A user could create a vendor and pay it without independent review.', 'critical'),
  (NULL, 'SOD-P2P-03', 'Change vendor bank details and release payments', 'procure_to_pay', 'VENDOR_BANK_MAINT', 'AP_PAYMENT_RELEASE', 'A user could redirect a vendor payment to their own account and release it.', 'critical'),
  (NULL, 'SOD-P2P-04', 'Change vendor bank details and enter invoices', 'procure_to_pay', 'VENDOR_BANK_MAINT', 'AP_INVOICE_ENTRY', 'A user could redirect remittance and enter an invoice to be paid to it.', 'high'),
  (NULL, 'SOD-P2P-05', 'Maintain vendors and create purchase orders', 'procure_to_pay', 'VENDOR_MAINT', 'PO_CREATE', 'A user could create a vendor and order from it without oversight.', 'high'),
  (NULL, 'SOD-P2P-06', 'Create and approve purchase orders', 'procure_to_pay', 'PO_CREATE', 'PO_APPROVE', 'A user could commit funds without independent approval.', 'high'),
  (NULL, 'SOD-P2P-07', 'Create purchase orders and receive goods', 'procure_to_pay', 'PO_CREATE', 'GOODS_RECEIPT', 'A user could order and confirm receipt of goods never delivered.', 'high'),
  (NULL, 'SOD-P2P-08', 'Create purchase orders and enter invoices', 'procure_to_pay', 'PO_CREATE', 'AP_INVOICE_ENTRY', 'A user could create both sides of the match used to approve payment.', 'medium'),
  (NULL, 'SOD-P2P-09', 'Receive goods and enter invoices', 'procure_to_pay', 'GOODS_RECEIPT', 'AP_INVOICE_ENTRY', 'A user could record a receipt that supports their own invoice entry.', 'medium'),
  (NULL, 'SOD-P2P-10', 'Enter and approve invoices', 'procure_to_pay', 'AP_INVOICE_ENTRY', 'AP_INVOICE_APPROVE', 'A user could enter and approve an improper invoice.', 'high'),
  (NULL, 'SOD-P2P-11', 'Enter invoices and release payments', 'procure_to_pay', 'AP_INVOICE_ENTRY', 'AP_PAYMENT_RELEASE', 'A user could enter an invoice and pay it.', 'critical'),
  (NULL, 'SOD-P2P-12', 'Prepare and release payment runs', 'procure_to_pay', 'AP_PAYMENT_RUN', 'AP_PAYMENT_RELEASE', 'A user could add payments to a batch and release it without review.', 'high'),
  (NULL, 'SOD-P2P-13', 'Request and approve purchases', 'procure_to_pay', 'REQUISITION_CREATE', 'PO_APPROVE', 'A user could approve their own purchase requests.', 'medium'),
  (NULL, 'SOD-P2P-14', 'Create purchase orders and release payments', 'procure_to_pay', 'PO_CREATE', 'AP_PAYMENT_RELEASE', 'A user could initiate a purchase and pay for it.', 'high'),
  (NULL, 'SOD-O2C-01', 'Maintain customers and apply cash', 'order_to_cash', 'CUSTOMER_MAINT', 'AR_CASH_APPLY', 'A user could create a customer to conceal misapplied receipts.', 'high'),
  (NULL, 'SOD-O2C-02', 'Maintain customers and issue credit memos', 'order_to_cash', 'CUSTOMER_MAINT', 'AR_CREDIT_MEMO', 'A user could create a customer and issue it improper credits.', 'high'),
  (NULL, 'SOD-O2C-03', 'Set credit limits and enter sales orders', 'order_to_cash', 'CREDIT_LIMIT_MAINT', 'SALES_ORDER_ENTRY', 'A user could raise a credit limit to push through their own order.', 'high'),
  (NULL, 'SOD-O2C-04', 'Maintain pricing and enter sales orders', 'order_to_cash', 'PRICING_MAINT', 'SALES_ORDER_ENTRY', 'A user could set unauthorized prices on orders they enter.', 'medium'),
  (NULL, 'SOD-O2C-05', 'Maintain pricing and bill customers', 'order_to_cash', 'PRICING_MAINT', 'BILLING', 'A user could change prices and bill at them.', 'medium'),
  (NULL, 'SOD-O2C-06', 'Bill customers and apply cash', 'order_to_cash', 'BILLING', 'AR_CASH_APPLY', 'A user could conceal diverted receipts by adjusting invoices.', 'high'),
  (NULL, 'SOD-O2C-07', 'Apply cash and issue credit memos', 'order_to_cash', 'AR_CASH_APPLY', 'AR_CREDIT_MEMO', 'A user could divert receipts and cover them with credits.', 'high'),
  (NULL, 'SOD-O2C-08', 'Apply cash and write off receivables', 'order_to_cash', 'AR_CASH_APPLY', 'AR_WRITE_OFF', 'A user could divert receipts and write off the balance.', 'high'),
  (NULL, 'SOD-O2C-09', 'Enter sales orders and issue credit memos', 'order_to_cash', 'SALES_ORDER_ENTRY', 'AR_CREDIT_MEMO', 'A user could inflate sales and reverse them later.', 'medium'),
  (NULL, 'SOD-R2R-01', 'Enter and approve journal entries', 'record_to_report', 'GL_JE_ENTRY', 'GL_JE_APPROVE', 'A user could record and approve an improper journal entry.', 'critical'),
  (NULL, 'SOD-R2R-02', 'Enter journal entries and maintain accounts', 'record_to_report', 'GL_JE_ENTRY', 'GL_ACCOUNT_MAINT', 'A user could create an account to hide entries.', 'high'),
  (NULL, 'SOD-R2R-03', 'Enter journal entries and control periods', 'record_to_report', 'GL_JE_ENTRY', 'GL_PERIOD_CONTROL', 'A user could reopen a closed period and post to it.', 'high'),
  (NULL, 'SOD-R2R-04', 'Enter journal entries and reconcile bank accounts', 'record_to_report', 'GL_JE_ENTRY', 'BANK_RECON', 'A user could conceal cash differences with entries.', 'high'),
  (NULL, 'SOD-R2R-05', 'Maintain exchange rates and enter journal entries', 'record_to_report', 'FX_RATE_MAINT', 'GL_JE_ENTRY', 'A user could manipulate revaluation results.', 'medium'),
  (NULL, 'SOD-FA-01', 'Maintain and dispose of fixed assets', 'fixed_assets', 'ASSET_MAINT', 'ASSET_DISPOSE', 'A user could create and dispose of assets to hide misappropriation.', 'medium'),
  (NULL, 'SOD-FA-02', 'Dispose of assets and enter journal entries', 'fixed_assets', 'ASSET_DISPOSE', 'GL_JE_ENTRY', 'A user could remove an asset and adjust the ledger.', 'medium'),
  (NULL, 'SOD-H2R-01', 'Maintain employees and run payroll', 'hire_to_retire', 'EMPLOYEE_MAINT', 'PAYROLL_RUN', 'A user could add a fictitious employee and pay them.', 'critical'),
  (NULL, 'SOD-H2R-02', 'Maintain employees and pay rates', 'hire_to_retire', 'EMPLOYEE_MAINT', 'PAY_RATE_MAINT', 'A user could hire someone and set their pay without review.', 'high'),
  (NULL, 'SOD-H2R-03', 'Maintain pay rates and run payroll', 'hire_to_retire', 'PAY_RATE_MAINT', 'PAYROLL_RUN', 'A user could raise pay and process it.', 'high'),
  (NULL, 'SOD-H2R-04', 'Change employee bank details and run payroll', 'hire_to_retire', 'EMPLOYEE_BANK_MAINT', 'PAYROLL_RUN', 'A user could redirect pay and release payroll.', 'critical'),
  (NULL, 'SOD-H2R-05', 'Approve time and run payroll', 'hire_to_retire', 'TIME_ENTRY_APPROVE', 'PAYROLL_RUN', 'A user could approve unworked hours and pay them.', 'medium'),
  (NULL, 'SOD-TR-01', 'Maintain bank accounts and initiate payments', 'treasury', 'BANK_ACCOUNT_MAINT', 'TREASURY_PAYMENT', 'A user could add a bank account and send funds from it.', 'critical'),
  (NULL, 'SOD-TR-02', 'Initiate payments and reconcile bank accounts', 'treasury', 'TREASURY_PAYMENT', 'BANK_RECON', 'A user could send funds and conceal them in the reconciliation.', 'critical'),
  (NULL, 'SOD-TR-03', 'Release supplier payments and reconcile bank accounts', 'treasury', 'AP_PAYMENT_RELEASE', 'BANK_RECON', 'A user could release improper payments and hide them in reconciliation.', 'high'),
  (NULL, 'SOD-TR-04', 'Execute trades and reconcile bank accounts', 'treasury', 'INVESTMENT_TRADE', 'BANK_RECON', 'A user could enter unauthorized trades and conceal the cash impact.', 'high'),
  (NULL, 'SOD-INV-01', 'Adjust inventory and record counts', 'inventory', 'INVENTORY_ADJUST', 'INVENTORY_COUNT', 'A user could conceal shrinkage by adjusting counts.', 'high'),
  (NULL, 'SOD-INV-02', 'Receive goods and adjust inventory', 'inventory', 'GOODS_RECEIPT', 'INVENTORY_ADJUST', 'A user could divert received goods and adjust them away.', 'medium'),
  (NULL, 'SOD-INV-03', 'Maintain items and adjust inventory', 'inventory', 'MATERIAL_MAINT', 'INVENTORY_ADJUST', 'A user could change item costs and post adjustments at them.', 'medium'),
  (NULL, 'SOD-IT-01', 'Administer security and release payments', 'it_general', 'SECURITY_ADMIN', 'AP_PAYMENT_RELEASE', 'A user could grant themselves any payment access and use it.', 'critical'),
  (NULL, 'SOD-IT-02', 'Administer security and enter journal entries', 'it_general', 'SECURITY_ADMIN', 'GL_JE_ENTRY', 'A user could grant themselves posting access and use it.', 'critical'),
  (NULL, 'SOD-IT-03', 'Administer security and run payroll', 'it_general', 'SECURITY_ADMIN', 'PAYROLL_RUN', 'A user could grant themselves payroll access and use it.', 'critical'),
  (NULL, 'SOD-IT-04', 'Maintain configuration and enter journal entries', 'it_general', 'CONFIG_MAINT', 'GL_JE_ENTRY', 'A user could change posting rules or limits and exploit them.', 'high'),
  (NULL, 'SOD-IT-05', 'Maintain configuration and release payments', 'it_general', 'CONFIG_MAINT', 'AP_PAYMENT_RELEASE', 'A user could change approval limits and release payments under them.', 'high')
ON CONFLICT ON CONSTRAINT erp_sod_rules_org_code_unique DO NOTHING;

INSERT INTO permissions (name, resource, action, description)
VALUES
  ('erp.read', 'erp', 'read', 'View ERP systems, entitlements, SoD conflicts, access reviews and transaction monitoring'),
  ('erp.manage', 'erp', 'manage', 'Import ERP data, manage SoD rules and conflicts, run analyses and access reviews')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  JOIN permissions p ON (p.name = 'erp.read' AND r.name IN ('admin', 'auditor', 'user'))
                     OR (p.name = 'erp.manage' AND r.name = 'admin')
 WHERE r.is_system_role = true
ON CONFLICT DO NOTHING;

SELECT 'Migration 166 completed.' AS result;
