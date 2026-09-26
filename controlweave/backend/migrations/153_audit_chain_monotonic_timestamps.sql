-- Migration 153: Monotonic timestamps for the audit hash chain
--
-- Migration 147 chains each audit row to the organization's current head,
-- where "head" is the latest row by (created_at, id). created_at was taken
-- from the caller -- usually NOW(), which is fixed for a whole transaction.
-- When one transaction wrote several audit rows for the same organization
-- (for example a compliance transition that records its POA&M and approval
-- request together), those rows shared a created_at, the head lookup fell back
-- to ordering by random UUID, and the chain forked. Verification (which walks
-- rows in the same (created_at, id) order) then reported broken links: false
-- evidence of tampering in the one table whose job is to prove there was none.
--
-- The trigger now stamps created_at itself, after taking the per-organization
-- advisory lock: the wall-clock time of the insert, forced strictly after the
-- current head. Rows are therefore totally ordered by created_at within an
-- organization, and the head is always the row inserted last. created_at is
-- part of the hashed payload, so it is set before the digest is computed.
--
-- Rows already written are unchanged; scripts/verify-audit-chain.js and the
-- QA self-test report any historical forks.
--
-- Ships in the production-readiness QA / audit integrity batch.

CREATE OR REPLACE FUNCTION audit_log_chain_append()
RETURNS TRIGGER AS $$
DECLARE
  head TEXT;
  head_ts TIMESTAMPTZ;
BEGIN
  -- Serialize appends per organization. Transaction-scoped, so it is released
  -- on COMMIT or ROLLBACK without an explicit unlock.
  PERFORM pg_advisory_xact_lock(
    hashtext('audit_logs_chain:' || COALESCE(NEW.organization_id::text, 'platform'))
  );

  SELECT record_hash, created_at INTO head, head_ts
    FROM audit_logs
   WHERE organization_id IS NOT DISTINCT FROM NEW.organization_id
     AND record_hash IS NOT NULL
   ORDER BY created_at DESC, id DESC
   LIMIT 1;

  NEW.created_at := clock_timestamp();
  IF head_ts IS NOT NULL AND NEW.created_at <= head_ts THEN
    NEW.created_at := head_ts + INTERVAL '1 microsecond';
  END IF;

  NEW.prev_hash := head;
  NEW.record_hash := encode(
    digest(audit_log_canonical_payload(NEW) || '|' || COALESCE(head, 'GENESIS'), 'sha384'),
    'hex'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
