# Database Migration

Create and validate a new database migration for ControlWeaver.

## Input

$ARGUMENTS — Description of the schema change needed

## Steps

1. **Determine next migration number**
   - Check `controlweave/backend/migrations/` for the highest numbered migration
   - Use the next sequential number (e.g., if latest is `100_*.sql`, create `101_*.sql`)

2. **Create the migration file**
   - Location: `controlweave/backend/migrations/<number>_<description>.sql`
   - Naming: Snake case description (e.g., `101_add_user_avatar_url.sql`)
   - Include a header comment explaining the change

3. **Write safe SQL**
   - New columns should be nullable or have a DEFAULT (never add NOT NULL without default on existing tables)
   - Use `CREATE INDEX CONCURRENTLY` for indexes on large tables
   - Use `IF NOT EXISTS` / `IF EXISTS` for safety
   - Add a comment block at the top with the migration description

4. **Migration template**
   ```sql
   -- Migration: <number>_<description>.sql
   -- Description: <what this migration does>
   -- Date: <today>

   -- Add changes here
   ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <column> <type>;
   ```

5. **Validate**
   - Check SQL syntax is valid
   - Verify the migration does not break existing data
   - Run `npm run check:syntax` from `controlweave/backend/`

6. **Test the migration**
   - If a local database is available, run `npm run migrate` from `controlweave/backend/`

## Safety Checklist

- [ ] No destructive changes without a rollback plan
- [ ] New columns are nullable or have defaults
- [ ] Indexes created concurrently where appropriate
- [ ] No mixed DDL and DML in the same migration
- [ ] Migration number is sequential and not duplicated
