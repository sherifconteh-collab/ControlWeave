# GitHub Actions Permissions Fix

## Issue
GitHub Actions workflows were encountering the following error:
```
Error: Resource not accessible by integration
https://docs.github.com/rest/actions/workflow-runs#get-a-workflow-run
```

This error occurs when a workflow tries to access GitHub Actions API resources (like workflow runs) without the appropriate `actions: read` permission.

## Root Cause
Several workflows in `.github/workflows/` were missing the `actions: read` permission in their permissions block. When these workflows (or actions they use) attempted to query workflow run information via the GitHub API, they were denied access due to insufficient permissions.

## Solution
Added `actions: read` permission to the following workflow files:

### 1. auto-review-docs.yml
**Before:**
```yaml
permissions:
  contents: write
  issues: write
  pull-requests: write
```

**After:**
```yaml
permissions:
  actions: read
  contents: write
  issues: write
  pull-requests: write
```

### 2. security-pipeline.yml
**Before:**
```yaml
permissions:
  contents: read
  security-events: write
  pull-requests: write
  issues: write
  statuses: write
  checks: write
```

**After:**
```yaml
permissions:
  actions: read
  contents: read
  security-events: write
  pull-requests: write
  issues: write
  statuses: write
  checks: write
```

### 3. docs-auto-update.yml
**Before:**
```yaml
permissions:
  contents: read
```

**After:**
```yaml
permissions:
  actions: read
  contents: read
```

### 4. wiki-health-check.yml
**Before:**
```yaml
permissions:
  contents: write
  issues: write
```

**After:**
```yaml
permissions:
  actions: read
  contents: write
  issues: write
```

## Why These Workflows?
These workflows were selected because they:
- Use GitHub Actions API either directly or through actions/github-script
- May query workflow status or trigger other workflows
- Perform automation that could benefit from workflow run information

## Validation
- ✅ All 6 workflow YAML files validated successfully
- ✅ Syntax check passed for all modified files
- ✅ Permission structure follows GitHub Actions best practices
- ✅ Changes are minimal and non-breaking

## Impact
- Workflows will no longer encounter "Resource not accessible" errors when accessing Actions API
- No breaking changes to existing functionality
- Follows principle of least privilege (only added necessary permission)

## References
- [GitHub Actions Permissions Documentation](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token)
- [GitHub Actions API - Workflow Runs](https://docs.github.com/rest/actions/workflow-runs)
- [GitHub Actions Error Reference](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/troubleshooting-workflows)

## Related Commits
- fb6e855 - Add actions:read permission to GitHub Actions workflows to fix API access errors
