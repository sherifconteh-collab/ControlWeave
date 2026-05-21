# Security Review

Perform a comprehensive security review of the current changes.

## Steps

1. **Check for hardcoded secrets**
   - Search for API keys, passwords, tokens, JWT secrets in changed files
   - Verify `.env` files are gitignored

2. **Validate SQL safety**
   - Ensure all queries use parameterized arguments (`$1`, `$2`, etc.)
   - Check for string concatenation in SQL statements
   - Verify no raw user input reaches SQL queries

3. **Verify multi-tenant isolation**
   - Every query returning user-visible data must filter by `organization_id`
   - Check for missing `organization_id` in WHERE clauses

4. **Check authentication**
   - Verify all new routes use `authenticate` middleware
   - Check authorization logic (role checks, ownership verification)

5. **Review error handling**
   - Ensure errors don't leak sensitive information (stack traces, SQL errors)
   - Verify proper error logging with the project logger

6. **Check rate limiting**
   - New endpoints should have rate limiting configured
   - Sensitive endpoints (login, password reset) need aggressive limits

7. **Validate audit logging**
   - Significant user actions must be logged for AU-2 compliance
   - Check that audit log entries include: action, user, timestamp, organization

8. **Run automated checks**
   ```bash
   cd controlweave/backend && npm run check:syntax
   cd controlweave/backend && npm run audit:check
   cd controlweave/frontend && npm run typecheck
   ```

## Output

Provide a security report with:
- CRITICAL issues (must fix before merge)
- HIGH issues (should fix before merge)
- MEDIUM issues (consider fixing)
- Summary of checks passed
