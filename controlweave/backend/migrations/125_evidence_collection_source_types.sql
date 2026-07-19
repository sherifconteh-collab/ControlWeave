-- Migration 125: Widen evidence_collection_rules.source_type CHECK constraint
--
-- Migration 088 constrained source_type to ('splunk', 'connector'), but
-- routes/autoEvidenceCollection.js's ALLOWED_SOURCE_TYPES allowlist (and the
-- /auto-evidence/sources endpoint the frontend reads to populate its source
-- picker) has always included microsoft_sentinel, aws_cloudtrail,
-- crowdstrike, jira, servicenow, and github -- none of which the database -- ip-hygiene:ignore
-- would actually accept. Confirmed live: POST /auto-evidence/rules with any
-- of those source types throws a raw Postgres CHECK-violation 500, not a
-- clean validation error, for every one of these previously "supported"
-- integrations. This ships alongside the real GitHub connector
-- (services/githubService.js, routes/github.js) as part of the Phase 4
-- "Automated Intelligence & Platform Maturity" connector work, but fixes
-- the same gap for the other five source types that were already exposed
-- in the UI with no working backend path.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'evidence_collection_rules'
      AND constraint_name = 'evidence_collection_rules_source_type_check'
  ) THEN
    ALTER TABLE evidence_collection_rules DROP CONSTRAINT evidence_collection_rules_source_type_check;
  END IF;
END $$;

ALTER TABLE evidence_collection_rules
  ADD CONSTRAINT evidence_collection_rules_source_type_check
  CHECK (source_type IN (
    'splunk', 'microsoft_sentinel', 'aws_cloudtrail', 'crowdstrike',
    'jira', 'servicenow', 'github', 'connector' -- ip-hygiene:ignore
  ));

SELECT 'Migration 125 completed.' AS result;
