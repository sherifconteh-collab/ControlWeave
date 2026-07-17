-- Migration 120: Add missing updated_at column to control_implementations
--
-- Discovered by live end-to-end QA testing (not caught by Jest, which mocks
-- pg.Pool and never validates against a real schema): three route handlers
-- in src/routes/implementations.js -- PATCH /:id/test-result,
-- PUT /:id/narrative, and PUT /:id/review-status -- all SET and RETURN
-- updated_at on control_implementations, but the column never existed on
-- this table (only created_at does). Every call to these three routes threw
-- a 500 ("column \"updated_at\" does not exist"), meaning the "Control
-- Testing" verdict, implementation narrative, and review-status features
-- have never actually worked end-to-end despite passing unit tests.
--
-- Adding the column (rather than stripping updated_at from three route
-- handlers) restores the last-modified tracking these routes were clearly
-- designed to have.

ALTER TABLE control_implementations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

SELECT 'Migration 120 completed.' AS result;
