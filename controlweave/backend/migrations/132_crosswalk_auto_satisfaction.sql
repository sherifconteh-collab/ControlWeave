-- Migration 132: Crosswalk auto-satisfaction credit ledger
--
-- README.md and docs/HOW_CROSSWALKS_WORK.md have described an auto-crosswalk
-- engine since early releases: mark a control implemented in one framework and
-- mapped controls at >=90% similarity are automatically credited as satisfied.
-- The `satisfied_via_crosswalk` status exists, dashboards count it, reminders
-- and scheduled reports read it, and demo seeds write it directly — but no code
-- ever set it as a result of an implementation. The behavior was documented and
-- unbuilt. This migration is the storage half of building it.
--
-- Why a ledger rather than just flipping the status:
--
--   1. A target control can be justified by more than one source. If NIST AC-2
--      and CMMC AC.L2-3.1.1 both map to ISO A.5.15 at >=90%, un-implementing
--      one must not withdraw credit the other still supports. Reversal has to
--      be per-source, which requires knowing which sources are in play.
--   2. An assessor will ask why a control is marked satisfied without its own
--      evidence. "Credited from NIST 800-53 AC-2 at 95% equivalence on
--      2026-07-29" is a defensible answer; a bare status is not.
--   3. It makes the credit reversible without guessing. Only rows this ledger
--      knows about are ever withdrawn, so manual work is never touched.
--
-- Ships alongside migrations 126-131.

CREATE TABLE IF NOT EXISTS control_crosswalk_credits (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  -- The control receiving credit.
  target_control_id    uuid NOT NULL REFERENCES framework_controls (id) ON DELETE CASCADE,
  -- The implemented control the credit derives from.
  source_control_id    uuid NOT NULL REFERENCES framework_controls (id) ON DELETE CASCADE,
  similarity_score     int  NOT NULL,
  mapping_type         text,
  -- Status the target held before credit was applied, so withdrawal restores
  -- exactly what was there rather than assuming 'not_started'.
  previous_status      text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid REFERENCES users (id) ON DELETE SET NULL,

  -- SECURITY: one credit per (org, target, source). The organization_id is part
  -- of the key so a mapping in one tenant can never satisfy a control in
  -- another.
  CONSTRAINT control_crosswalk_credits_unique
    UNIQUE (organization_id, target_control_id, source_control_id)
);

CREATE INDEX IF NOT EXISTS idx_crosswalk_credits_org_target
  ON control_crosswalk_credits (organization_id, target_control_id);

CREATE INDEX IF NOT EXISTS idx_crosswalk_credits_org_source
  ON control_crosswalk_credits (organization_id, source_control_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'control_crosswalk_credits'::regclass
      AND conname = 'control_crosswalk_credits_no_self'
  ) THEN
    ALTER TABLE control_crosswalk_credits
      ADD CONSTRAINT control_crosswalk_credits_no_self
      CHECK (target_control_id <> source_control_id);
  END IF;
END $$;

SELECT 'Migration 132 completed.' AS result;
