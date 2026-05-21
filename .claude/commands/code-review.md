# Code Review

Perform a thorough code review of the current changes.

## Steps

1. **Understand the changes**
   - Run `git diff` to see all modifications
   - Identify the purpose and scope of the change

2. **Security review**
   - Check for hardcoded secrets
   - Verify parameterized SQL queries (no string concatenation)
   - Confirm `organization_id` filtering on all data queries
   - Verify `authenticate` middleware on all new routes
   - Check error responses don't leak sensitive details

3. **Code quality review**
   - Functions under 50 lines
   - Files under 800 lines
   - No deep nesting (>4 levels)
   - Proper error handling with try-catch
   - No `any` types in TypeScript code
   - Immutable patterns (spread, not mutation)
   - Consistent naming (camelCase vars and source files, kebab-case for scripts only, PascalCase components)

4. **Database review** (if SQL changes)
   - Parameterized queries only
   - Indexes on filtered/joined columns
   - Pagination on list queries
   - Transactions for multi-step operations

5. **API review** (if route changes)
   - Correct HTTP status codes
   - Consistent response format (`{ success: true, data }` or `{ error }`)
   - Route registered in `server.js`
   - Input validation before processing

6. **Run verification**
   ```bash
   cd controlweave/backend && npm run check:syntax
   cd controlweave/frontend && npm run typecheck
   ```

## Output

Report findings by severity:
- **CRITICAL**: Security vulnerabilities, data leaks — block merge
- **HIGH**: Bugs, missing auth — block merge
- **MEDIUM**: Performance, maintainability — warn
- **LOW**: Style, minor suggestions — note
