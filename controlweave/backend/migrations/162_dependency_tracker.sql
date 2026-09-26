-- Migration 162: dependency tracker
--
-- Operations teams need to see, inside ControlWeave, when the software it
-- depends on has updates or known vulnerabilities: npm packages of the
-- backend and frontend, the Node.js runtime, PostgreSQL and the container
-- base images. A scheduled check (services/dependencyScheduler.js) records
-- each run's findings; decisions (planned, accepted risk, snoozed) persist
-- across runs so the team works a queue rather than a report. Supports
-- NIST 800-53 SI-2 (flaw remediation), CM-8 (component inventory) and
-- SA-22 (unsupported components).

CREATE TABLE IF NOT EXISTS dependency_check_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger TEXT NOT NULL CHECK (trigger IN ('scheduled', 'manual')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'partial', 'failed')),
  started_by UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_dependency_check_runs_started ON dependency_check_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS dependency_findings (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES dependency_check_runs(id) ON DELETE CASCADE,
  component TEXT NOT NULL,
  ecosystem TEXT NOT NULL,
  name TEXT NOT NULL,
  direct BOOLEAN NOT NULL DEFAULT true,
  installed TEXT,
  wanted TEXT,
  latest TEXT,
  update_type TEXT CHECK (update_type IN ('major', 'minor', 'patch', 'none', 'unknown')),
  advisories JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_severity TEXT CHECK (max_severity IN ('critical', 'high', 'moderate', 'low')),
  eol_date DATE,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_dependency_findings_run ON dependency_findings (run_id);

CREATE TABLE IF NOT EXISTS dependency_decisions (
  component TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'planned', 'accepted', 'snoozed', 'done')),
  note TEXT,
  target_version TEXT,
  snooze_until DATE,
  poam_item_id UUID REFERENCES poam_items(id) ON DELETE SET NULL,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (component, name)
);
