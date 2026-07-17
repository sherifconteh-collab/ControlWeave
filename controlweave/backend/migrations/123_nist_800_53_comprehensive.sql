-- Migration 123: Flip nist_800_53 coverage_status to comprehensive
--
-- Migration 118 flagged nist_800_53 as 'core_controls' (13/20 families,
-- base-only, vs the official ~322 base controls). scripts/seed-frameworks.js
-- now seeds the full 300 non-withdrawn base controls generated from the
-- official NIST OSCAL SP 800-53 Rev 5.2.0 catalog via
-- scripts/import-oscal-80053.js -- see
-- docs/FRAMEWORK_CATALOG_COMPLETION_PLAN.md Wave 1, first framework
-- completed. Control enhancements (e.g. AC-2.1) remain deferred, matching
-- the "base controls only" scope this coverage_status column tracks.
--
-- Ships in the same batch as the framework-catalog completion Wave 1 work.

UPDATE frameworks SET coverage_status = 'comprehensive'
WHERE code = 'nist_800_53';

SELECT 'Migration 123 completed.' AS result;
