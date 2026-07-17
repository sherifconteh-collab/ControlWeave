-- Migration 122: Flip cmmc_2.0 coverage_status to comprehensive
--
-- Migration 118 defaulted cmmc_2.0 to 'core_controls' (54/110 practices,
-- hand-picked). scripts/seed-frameworks.js now seeds all 110 CMMC 2.0 Level
-- 2 practices, generated from a NIST SP 800-171 Rev 2 OSCAL catalog via
-- scripts/import-oscal-cmmc-l2.js -- see
-- docs/FRAMEWORK_CATALOG_COMPLETION_PLAN.md Wave 1. CMMC 2.0 Level 2's 110
-- practices map 1:1 to the 110 SP 800-171 Rev 2 requirements (CMMC 2.0
-- dropped the CMMC-1.0-only "delta" practices in its 2021 simplification),
-- so this is a complete, verified catalog, not a partial one.
--
-- Ships in the same batch as the framework-catalog completion Wave 1 work.

UPDATE frameworks SET coverage_status = 'comprehensive'
WHERE code = 'cmmc_2.0';

SELECT 'Migration 122 completed.' AS result;
