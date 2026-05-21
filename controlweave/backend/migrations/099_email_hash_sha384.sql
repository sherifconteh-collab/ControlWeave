-- Migration 099: Widen email_hash for HMAC-SHA-384 (CNSA Suite 1.0 compliance)
--
-- Background:
--   Migration 098 added email_hash VARCHAR(64) using HMAC-SHA-256 (64 hex chars).
--   CNSA Suite policy "Transition to Stronger Public Key Algorithms" (CNSA Suite 1.0)
--   mandates SHA-384 or higher for all hashing operations.
--   HMAC-SHA-384 produces a 48-byte (96 hex-char) digest, so the column must be widened.
--
-- Strategy:
--   1. Widen email_hash to VARCHAR(96) to fit HMAC-SHA-384 output.
--   2. Drop the UNIQUE constraint, NULL out all existing SHA-256 hashes, then re-add
--      the constraint so the column is clean before lazy backfill repopulates it.
--   3. On next login, getUserByEmail() will not find a match on email_hash, will fall
--      back to the plain-email column, and will then backfill the correct SHA-384 hash.
--
-- This migration is safe to run on a live system: NULLing email_hash temporarily
-- means login falls back to plain-text email lookup (the existing pre-migration path)
-- until each user logs in and their hash is regenerated with SHA-384.

-- Step 1: Drop the existing UNIQUE constraint so we can widen the column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_email_hash_unique' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_email_hash_unique;
  END IF;
END$$;

-- Step 2: Widen the column (VARCHAR widening is always safe in PostgreSQL)
ALTER TABLE users ALTER COLUMN email_hash TYPE VARCHAR(96);

-- Step 3: NULL out all SHA-256 hashes (64 hex chars) so they are regenerated
--         with SHA-384 on the user's next login.
UPDATE users SET email_hash = NULL WHERE email_hash IS NOT NULL AND LENGTH(email_hash) = 64;

-- Step 4: Re-add the UNIQUE constraint (NULLs are excluded, so no conflicts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_email_hash_unique' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_hash_unique UNIQUE (email_hash);
  END IF;
END$$;
