-- Migration 121: Enforce audit_logs immutability at the database level
--
-- README claims "AU-2 compliant immutable audit logging," but the only
-- enforcement was that routes/audit.js never exposes an UPDATE or DELETE
-- route. That's convention, not immutability -- any other code path
-- (a future route, a script, a manual psql session using the same
-- application DB role) could freely rewrite or erase history. AU-2 requires
-- audit records to be tamper-evident; "no route happens to touch it" is not
-- a control.
--
-- This adds a trigger that unconditionally rejects DELETE and TRUNCATE on
-- audit_logs, and rejects UPDATE unless the only column changing is
-- siem_forwarded -- the one legitimate post-insert write, set by
-- services/auditService.js#forwardToSiem() once an event is confirmed
-- delivered to the configured SIEM. A trigger is used instead of REVOKE
-- because this repo's hosted Postgres setups typically run the whole app
-- under one owning role, and REVOKE has no effect on the object owner's own
-- default privileges; a raised exception inside the trigger fires
-- unconditionally for any writer regardless of role.
--
-- seed-*.js demo/reset scripts that DELETE FROM audit_logs (tagged demo
-- rows only) must wrap that call in
-- `ALTER TABLE audit_logs DISABLE/ENABLE TRIGGER audit_logs_no_update`
-- -- updated in the same batch as this migration.
--
-- Ships in the post-#544 feature-audit follow-up batch.

CREATE OR REPLACE FUNCTION reject_audit_log_mutation()
RETURNS TRIGGER AS $$
DECLARE
  old_with_new_flag audit_logs;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_logs is append-only (AU-2): DELETE is not permitted'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'audit_logs is append-only (AU-2): TRUNCATE is not permitted'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- TG_OP = 'UPDATE': only the siem_forwarded metadata flag may change
  -- post-insert. Any change to a forensic field is rejected.
  old_with_new_flag := OLD;
  old_with_new_flag.siem_forwarded := NEW.siem_forwarded;

  IF old_with_new_flag IS DISTINCT FROM NEW THEN
    RAISE EXCEPTION 'audit_logs is append-only (AU-2): only siem_forwarded may be updated post-insert'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION reject_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_logs_no_truncate ON audit_logs;
CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION reject_audit_log_mutation();

COMMENT ON FUNCTION reject_audit_log_mutation() IS
  'AU-2: blocks DELETE/TRUNCATE on audit_logs and restricts UPDATE to the siem_forwarded flag only, so the table is append-only regardless of caller privileges.';

SELECT 'Migration 121 completed.' AS result;
