-- Migration 154: QA / self-test runs
--
-- Customers' QA and acceptance testers need a way to confirm, inside their own
-- deployment, that the platform works end to end: that compliance numbers are
-- consistent across screens, crosswalk credits are sound, the audit trail is
-- intact and append-only, evidence files still match their recorded hashes,
-- AI provider keys work, and the core workflows round-trip through the real
-- API. The self-test suite (services/qa) does that; this table keeps the
-- history of runs so a passing run can be exported as acceptance-test
-- evidence (for example for SOC 2 CC8.1 change management).
--
-- qa.run gates running and viewing self-tests. It is granted to the admin
-- system role; organizations can add it to a custom role for dedicated QA
-- testers without giving them admin rights.
--
-- Ships in the production-readiness QA / audit integrity batch.

CREATE TABLE IF NOT EXISTS qa_test_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  started_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  suites          TEXT[] NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL,
  summary         JSONB NOT NULL DEFAULT '{}'::jsonb,
  results         JSONB NOT NULL DEFAULT '[]'::jsonb,
  app_version     TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_qa_test_runs_org_started
  ON qa_test_runs (organization_id, started_at DESC);

INSERT INTO permissions (name, resource, action, description)
VALUES ('qa.run', 'qa', 'run', 'Run and view platform QA self-tests')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN (SELECT id FROM permissions WHERE name = 'qa.run') p
WHERE r.is_system_role = true AND r.name = 'admin'
ON CONFLICT DO NOTHING;

SELECT 'Migration 154 completed.' AS result;
