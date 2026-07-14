# ControlWeaver-Pro — Database Architecture

## Overview

ControlWeaver-Pro uses **PostgreSQL 14+** with direct parameterized SQL queries (no ORM). The schema is organized into logical domains, each reflecting a major product area. All migrations are numbered sequentially in `controlweave/backend/migrations/`.

> **Minimum version**: PostgreSQL 14 (as used in CI via `pgvector/pgvector:pg14`). PostgreSQL 15+ is recommended for production workloads.

---

## Schema Visualization (Core Domain)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         ORGANIZATIONS                                │
│  id | name | industry | tier | trial_ends_at | billing_status | ... │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ 1:N (all data is org-isolated)
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
   ┌─────────┐          ┌──────────┐          ┌────────────────┐
   │  USERS  │          │FRAMEWORKS│          │  AI / LLM KEYS │
   │ (RBAC)  │          │(40 total)│          │  (BYOK, org-   │
   └────┬────┘          └────┬─────┘          │   scoped)      │
        │                   │                 └────────────────┘
        │                   │ has many
        │                   ▼
        │          ┌─────────────────────┐
        │          │  FRAMEWORK_CONTROLS │
        │          │    (675+ controls)  │
        │          └──────┬──────────────┘
        │                 │
        │                 │ mapped via
        │                 ▼
        │          ┌──────────────────────┐
        │          │   CONTROL_MAPPINGS   │
        │          │   (97 crosswalks)    │
        │          └──────────────────────┘
        │                 │
        │                 │ implemented by orgs
        │                 ▼
        │    ┌────────────────────────────┐
        └───►│  CONTROL_IMPLEMENTATIONS  │
             │  (per-org, per-control)    │
             └────────────┬───────────────┘
                          │
          ┌───────────────┼──────────────┐
          ▼               ▼              ▼
   ┌────────────┐  ┌────────────┐  ┌──────────┐
   │  EVIDENCE  │  │ASSESSMENTS │  │  AUDIT   │
   │   ITEMS    │  │ & RESULTS  │  │  EVENTS  │
   └────────────┘  └────────────┘  └──────────┘
```

---

## Domain 1 — Identity & Access

### `organizations`
Multi-tenant root. Every row in every other table that contains org-specific data has an `organization_id` foreign key.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `name` | VARCHAR | Organization display name |
| `tier` | VARCHAR | `free`, `starter`, `professional`, `enterprise`, `utilities` |
| `billing_status` | VARCHAR | `free`, `trial`, `active_paid`, `past_due`, `canceling`, `canceled`, `comped` |
| `trial_status` | VARCHAR | `none`, `active`, `expired`, `converted` |
| `trial_source_tier` | VARCHAR | Tier granted during trial |
| `trial_started_at` | TIMESTAMPTZ | — |
| `trial_ends_at` | TIMESTAMPTZ | Auto-downgrades to free on expiry |
| `paid_tier` | VARCHAR | Last paid tier (retained after cancellation) |
| `stripe_customer_id` | VARCHAR | Stripe customer reference |
| `stripe_subscription_id` | VARCHAR | Stripe subscription reference |
| `feature_overrides` | JSONB | Admin-controlled per-org feature flags |
| `created_at` | TIMESTAMPTZ | — |

> **Data sensitivity** is stored in the separate `organization_profiles` table (`data_sensitivity_types TEXT[]`), not on `organizations` directly.

### `users`
Platform users. All PII fields (email, name) are field-level encrypted.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK → organizations |
| `email` | VARCHAR | Encrypted at rest |
| `password_hash` | VARCHAR | bcryptjs, 12 rounds |
| `role` | VARCHAR | `admin`, `auditor`, `viewer`, or custom role ID |
| `totp_secret` | VARCHAR | Encrypted TOTP secret for 2FA |
| `failed_login_attempts` | INTEGER | Account lockout counter |
| `locked_until` | TIMESTAMPTZ | Lockout expiry (NULL = not locked) |
| `oauth_provider` | VARCHAR | `google`, `microsoft`, `github`, `apple` |
| `sso_subject` | VARCHAR | OIDC subject identifier |
| `last_active_at` | TIMESTAMPTZ | Used by inactivity logout (30 min default) |

### `roles` + `role_permissions`
Custom RBAC beyond the built-in Admin/Auditor/Viewer roles. Permissions are granular strings (e.g., `controls.write`, `assessments.read`, `settings.write`).

### `refresh_tokens`
Hashed JWT refresh tokens (7-day expiry). Rotation on every use; revoked on logout.

---

## Domain 2 — Compliance Frameworks

### `frameworks`
40 frameworks and standards. Read-only at the platform level; orgs activate from this catalog.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `code` | VARCHAR UNIQUE | `nist_csf_2.0`, `iso_27001`, `soc2`, etc. |
| `name` | VARCHAR | Display name |
| `version` | VARCHAR | Standard version string |
| `issuing_body` | VARCHAR | NIST, ISO, AICPA, etc. |
| `tier_required` | VARCHAR | Minimum org tier needed to activate |
| `ai_specific` | BOOLEAN | True for AI RMF, ISO 42001, MAESTRO, etc. |

### `organization_frameworks`
Which frameworks an org has activated. Framework-gated UI features key off this table.

### `framework_controls`
675+ individual control requirements. The core of the compliance engine.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `framework_id` | UUID | FK → frameworks |
| `control_id` | VARCHAR | Standard control identifier (`PR.AA-06`, `3.5.3`, `A.5.17`) |
| `title` | VARCHAR | Control title |
| `description` | TEXT | Full control requirement text |
| `priority` | VARCHAR | `critical`, `high`, `medium`, `low` |
| `family` | VARCHAR | Control family (AC, AT, AU, etc.) |
| `ai_relevance` | BOOLEAN | Flagged for AI-specific controls |
| `automation_potential` | VARCHAR | `high`, `medium`, `low` (for agentic assessment) |

### `control_mappings`
97 cross-framework mappings powering the auto-crosswalk engine.

| Column | Type | Notes |
|--------|------|-------|
| `source_control_id` | UUID | FK → framework_controls |
| `target_control_id` | UUID | FK → framework_controls |
| `mapping_type` | VARCHAR | `equivalent`, `subset`, `related`, `complementary` |
| `similarity_score` | INTEGER | 0–100; ≥90 triggers auto-satisfaction |
| `notes` | TEXT | Rationale for the mapping |
| `verified_by` | VARCHAR | `nist_official`, `aicpa`, `iso`, `community` |

### `control_implementations`
Per-org implementation status for each control. The operational heart of the platform.

| Column | Type | Notes |
|--------|------|-------|
| `organization_id` | UUID | FK → organizations |
| `control_id` | UUID | FK → framework_controls |
| `status` | VARCHAR | `not_started`, `in_progress`, `implemented` |
| `compliance_status` | VARCHAR | `compliant`, `non_compliant`, `not_applicable` |
| `auto_satisfied` | BOOLEAN | True if credited via crosswalk |
| `source_implementation_id` | UUID | FK → self (which direct implementation triggered this) |
| `assigned_to` | UUID | FK → users |
| `due_date` | DATE | — |
| `implemented_at` | TIMESTAMPTZ | — |
| `maturity_level` | INTEGER | 1–5 maturity model score |

### `control_exceptions`
Approved deviations from control implementation. Each exception records the risk acceptance rationale and expiry date.

### `control_health_scores`
Materialized per-control health computed from: evidence age, assessment outcomes, and implementation status. Powers the dashboard health indicators.

### `nist_publications`
62 seeded NIST publication references (SPs, IRs, FIPSes). Linked to controls as optional best-practice guidance or mandatory baselines depending on org profile.

---

## Domain 3 — Evidence Management

### `evidence_items`
Versioned evidence artifacts. Files are stored in Railway volumes or S3; the DB records metadata.

| Column | Type | Notes |
|--------|------|-------|
| `organization_id` | UUID | — |
| `file_name` | VARCHAR | Original filename |
| `file_path` | VARCHAR | Storage path |
| `file_size` | INTEGER | Bytes |
| `mime_type` | VARCHAR | — |
| `sha256_hash` | VARCHAR | Integrity verification |
| `pii_classified` | BOOLEAN | Has PII been assessed? |
| `pii_types` | VARCHAR[] | `['PII', 'PHI', 'PCI', 'CUI']` |
| `retention_expires_at` | DATE | Configurable retention (default 365 days) |
| `version` | INTEGER | Auto-incremented on update |
| `uploaded_by` | UUID | FK → users |

### `control_evidence`
Many-to-many join between evidence items and the controls they support.

---

## Domain 4 — Assessment & Audit

### `assessments`
Assessment campaigns. An assessment groups multiple procedures being conducted at a point in time.

### `assessment_procedures`
2,000+ individual test procedures based on NIST SP 800-53A, ISO 19011, AICPA SOC 2 Type II, HHS HIPAA Audit Protocol, GDPR/EDPB guidelines, and ISO/IEC AI standards (verified against seed data in `controlweave/README.md`). Read-only; platform-provided.

### `assessment_results`
Org-recorded outcomes for each procedure: `satisfied`, `other_than_satisfied`, `not_applicable` (NIST-standard terminology).

### `audit_events`
**Immutable** AU-2 compliant audit log. Rows are INSERT-only; no UPDATE or DELETE is permitted. All significant user actions are logged with: `actor_id`, `action`, `resource_type`, `resource_id`, `ip_address`, `timestamp`, `change_delta` (JSONB).

---

## Domain 5 — Auditor Workspace

### `auditor_engagements`
External auditor engagements. Each engagement has a scope, timeline, and linked auditor user.

### `pbc_requests`
Provided-By-Client (PBC) requests from the auditor to the organization. Tracks request status and linked evidence.

### `workpapers`
Auditor workpaper narratives. AI-drafted from assessment data, editable by the auditor.

### `audit_findings`
Formal audit findings with risk ratings (`critical`, `high`, `medium`, `low`), recommendations, and management responses.

### `auditor_sign_offs`
Timestamped sign-off records per engagement section. Creates the chain of custody for the audit file.

---

## Domain 6 — CMDB (Configuration Management Database)

### `cmdb_assets`
Unified asset table with `asset_type` discriminator. Types: `hardware`, `software`, `ai_agents`, `service_accounts`, `environments`, `password_vaults`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | — |
| `asset_type` | VARCHAR | Discriminator |
| `name` | VARCHAR | Asset name |
| `owner_id` | UUID | FK → users |
| `risk_score` | NUMERIC | Composite risk score |
| `criticality` | VARCHAR | `critical`, `high`, `medium`, `low` |
| `custom_fields` | JSONB | Custom metadata |
| `last_seen_at` | TIMESTAMPTZ | For stale asset detection |

### `cmdb_relationships`
Cross-asset dependencies. Relationship types: `uses`, `requires`, `hosted_on`, `communicates_with`. Bidirectional view in the UI.

### `asset_change_history`
90-day audit trail of field-level changes per asset (Pro tier). Records who changed what, when, with full before/after values.

### `sbom_entries` + `aibom_entries`
Software Bill of Materials and AI Bill of Materials per asset. SBOM entries store CycloneDX JSON with component metadata; AIBOM entries add AI-specific fields: model architecture, training data provenance, bias assessment status, governance classification.

### `sbom_vulnerabilities`
Cross-reference between SBOM components and CVE vulnerability findings.

---

## Domain 7 — Vulnerability Management

### `vulnerabilities`
Security vulnerability findings linked to CMDB assets.

| Column | Type | Notes |
|--------|------|-------|
| `cvss_score` | NUMERIC | CVSS v3.x base score |
| `severity` | VARCHAR | `critical`, `high`, `medium`, `low` |
| `status` | VARCHAR | `open`, `in_progress`, `remediated`, `accepted` |
| `asset_id` | UUID | FK → cmdb_assets |
| `cve_id` | VARCHAR | CVE identifier if applicable |
| `remediation_plan` | TEXT | AI-generated or manual fix guidance |

### `vulnerability_risk_acceptances`
Formal risk acceptance records for vulnerabilities that won't be remediated. Tracks acceptor, rationale, and review date.

---

## Domain 8 — Plan of Action & Milestones (POA&M)

### `poam_items`
Open compliance findings tracked to closure. Each item has milestones, an owner, a target completion date, and links to the control(s) it addresses. Designed for federal and NIST 800-53 reporting requirements.

---

## Domain 9 — RMF Lifecycle (NIST SP 800-37)

### `rmf_packages`
RMF packages linked to organization systems. Each package tracks a system through the full NIST SP 800-37 Rev 2 seven-step lifecycle.

| Column | Type | Notes |
|--------|------|-------|
| `current_step` | VARCHAR | `prepare`, `categorize`, `select`, `implement`, `assess`, `authorize`, `monitor` |
| `system_name` | VARCHAR | Name of the information system |
| `cia_confidentiality` | VARCHAR | `low`, `moderate`, `high` |
| `cia_integrity` | VARCHAR | `low`, `moderate`, `high` |
| `cia_availability` | VARCHAR | `low`, `moderate`, `high` |
| `overall_impact` | VARCHAR | System categorization result |

### `rmf_step_history`
Immutable step transition audit trail. Records user, timestamp, notes, and artifacts for every step change.

### `rmf_authorization_decisions`
ATO (Authority to Operate), DATO (Denial of ATO), IATT (Interim ATO), or Denial records. Inserting a new decision automatically deactivates the prior active decision.

---

## Domain 10 — AI & LLM

### `ai_settings`
Per-org BYOK API key storage (encrypted). Provider, model selection, and per-framework guardrails.

### `ai_usage_log`
Per-call AI usage tracking: org, user, feature, provider, model, tokens in/out, duration, success/failure, IP. Used for tier limit enforcement.

### `ai_decision_log`
Governance log for AI outputs. Records: SHA-256 hash of inputs and outputs, model version, correlation ID, session ID, regulatory framework mapping, bias flags. Supports EU AI Act Article 12 logging requirements.

### `ai_bias_reviews`
Human review records for AI decisions flagged by heuristic bias detection. Admins approve/reject/flag via Settings → AI Decisions.

### `ai_reasoning_memory`
Persistent semantic memory per organization. Each analysis builds on past findings for increasingly accurate, context-aware compliance guidance. Capped to prevent unbounded growth.

### `rag_documents`
Vector-indexed documents for Organization RAG. Policies, evidence, procedures indexed via pgvector for semantic search. Powers grounded AI responses from actual org artifacts.

---

## Domain 11 — Agent Audit (OpenClaw)

### `agent_audit_events` (Migration 092)
Audit log for all automated OpenClaw agent actions. Persisted to PostgreSQL when `DATABASE_URL` is set (Railway production). Also written to JSONL files at `.openclaw/orchestrator/logs/` and console.

| Column | Type | Notes |
|--------|------|-------|
| `agent_name` | VARCHAR | Which OpenClaw agent ran |
| `action` | VARCHAR | Action taken |
| `result` | VARCHAR | `success`, `failure`, `skipped` |
| `details` | JSONB | Full action details |
| `executed_at` | TIMESTAMPTZ | — |

Maps to: NIST AI RMF GOVERN function, EU AI Act Articles 12 and 13 (logging and transparency).

---

## Domain 12 — Platform Operations

### `jobs`
Async job queue for long-running tasks: PDF/Excel report generation, AI analysis caching, retention cleanup. Status: `pending`, `running`, `completed`, `failed`.

### `webhooks`
Outbound webhook subscriptions. Each webhook has a target URL, event type filter, and HMAC signing secret.

### `webhook_deliveries`
Delivery history per webhook event. Includes request/response bodies, HTTP status, retry count. Used for debugging integrations.

### `notifications`
In-app notification inbox per user. Event types: control verified, POA&M created, control due, assessment needed, crosswalk update.

### `notification_preferences`
Per-user opt-in/opt-out for each notification type across in-app and email channels.

### `dynamic_config`
Runtime feature flags and platform configuration. Allows behavior changes without redeployment.

---

## Migration Convention

All migrations live in `controlweave/backend/migrations/` as numbered SQL files:

```
001_initial_schema.sql
002_add_crosswalks.sql
...
085_rmf_lifecycle.sql
086_state_ai_laws_enhancement.sql
087_international_ai_laws_enhancement.sql
...
092_agent_audit_events.sql
093_backfill_intl_ai_gov_org_frameworks.sql  ← latest
```

Run migrations:
```bash
cd controlweave/backend
npm run migrate        # Run all pending migrations
npm run migrate:one    # Run a single migration by number
```

Each migration file is idempotent where possible using `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, etc.

---

## Security Notes

- **No ORM** — All queries use the `pg` library with parameterized statements (`$1`, `$2`, ...). Zero SQL injection surface.
- **Field-level encryption** — User PII (email, name) encrypted via AES-256-GCM using `encrypt.js` utilities before storage.
- **Audit immutability** — `audit_events` table has a `BEFORE UPDATE OR DELETE` trigger that raises an exception, enforcing INSERT-only semantics.
- **Multi-tenancy isolation** — All application queries include `WHERE organization_id = $1` with the authenticated org's ID from the JWT. No cross-tenant data leakage.
- **pgvector** — Required extension for RAG document indexing (`vector` column type on `rag_documents`). Enabled via `CREATE EXTENSION IF NOT EXISTS vector;` in migration `084_org_rag_documents.sql`.

---

## Quick Reference

```bash
# Check DB capacity
cd controlweave/backend && npm run db:capacity

# Backup database
npm run db:backup

# Run migrations
npm run migrate

# Seed demo data
npm run seed:demo-full
```

---

*For the full API built on top of this schema, see [controlweave/README.md](../controlweave/README.md).*
