-- Migration 155: Indexes for audit-event lookups by resource
--
-- The vulnerabilities list shows, per finding, how many audit events reference
-- it -- matched by resource id or by the finding_key / vulnerability_id carried
-- in the event details. None of those predicates had an index, so every
-- finding scanned the organization's entire audit history. At scale-test size
-- (20,000 findings, 100,000 audit events) the list took 8.5 seconds.
--
-- These indexes let the planner resolve each branch of that lookup (and any
-- other "audit events for this record" query) with an index scan. The route
-- change that ships with this migration also counts only for the page being
-- displayed instead of for every finding.
--
-- Plain CREATE INDEX because the migration runner wraps each file in a
-- transaction; on very large existing audit tables, create these CONCURRENTLY
-- by hand ahead of the deploy and this file becomes a no-op.
--
-- Ships in the production-readiness performance batch.

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_resource_id
  ON audit_logs (organization_id, resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_details_finding_key
  ON audit_logs ((details->>'finding_key'));

CREATE INDEX IF NOT EXISTS idx_audit_logs_details_vulnerability_id
  ON audit_logs ((details->>'vulnerability_id'));
