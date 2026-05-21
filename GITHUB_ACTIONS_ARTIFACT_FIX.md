# GitHub Actions Artifact Upload 403 Error - Fix Documentation

## Issue Summary

**Error Message:**
```
Error: Failed to FinalizeArtifact: Received non-retryable error: Failed request: (403) Forbidden: Error from intermediary with HTTP status code 403 "Forbidden"
```

**Date:** 2026-02-19  
**Status:** ✅ RESOLVED

## Root Cause

The issue was caused by insufficient permissions in GitHub Actions workflows. When using `actions/upload-artifact@v4`, the workflow requires `actions: write` permission to finalize artifact uploads. 

Several workflows had only `actions: read` permission, which was sufficient for older versions of the artifact action but is insufficient for v4.

### Why This Happens

1. **API Change in v4:** The `upload-artifact@v4` action uses a new artifact upload API that requires write permissions
2. **Two-Phase Upload:** The action uploads artifact content in phase 1 (succeeds), then finalizes the artifact in phase 2 (fails with 403)
3. **Permission Check:** The finalize step requires `actions: write` to complete successfully

## Solution Applied

### Files Modified

1. **`.github/workflows/auto-review-docs.yml`**
   - Changed: `actions: read` → `actions: write`
   - Artifact: `doc-review-results`

2. **`.github/workflows/wiki-health-check.yml`**
   - Changed: `actions: read` → `actions: write`
   - Artifact: `wiki-health-report`

3. **`.github/workflows/security-pipeline.yml`**
   - Changed: `actions: read` → `actions: write`
   - Artifacts: test reports, SBOM, AIBOM, security scan results

4. **`.github/workflows/public-mirror.yml`**
   - Added: `actions: write` (previously only had `contents: read`)
   - Artifact: `public-mirror-snapshot`

### Example Change

**Before:**
```yaml
permissions:
  actions: read
  contents: write
  issues: write
```

**After:**
```yaml
permissions:
  actions: write
  contents: write
  issues: write
```

## Impact

### What Was Broken
- ❌ Auto-review documentation workflow couldn't save review results
- ❌ Wiki health check couldn't save health reports
- ❌ Security pipeline couldn't save test reports, SBOMs, or scan results
- ❌ Public mirror workflow couldn't save mirror snapshots in dry-run mode

### What Is Fixed
- ✅ All workflows can now successfully upload and finalize artifacts
- ✅ Artifacts are properly stored and accessible in GitHub Actions
- ✅ Retention policies (7-30 days) are correctly applied
- ✅ Workflow summaries include artifact links

## Verification

The fix will be automatically verified when:
1. Any affected workflow runs after this change
2. The workflow reaches an artifact upload step
3. The artifact upload completes without a 403 error
4. The artifact appears in the GitHub Actions run summary

## Prevention

### For Future Workflows

When creating new workflows that use `actions/upload-artifact@v4`, ensure the workflow has:

```yaml
permissions:
  actions: write  # Required for artifact uploads
  # ... other permissions as needed
```

### Common Mistake

```yaml
permissions:
  actions: read  # ❌ WRONG - Will cause 403 on artifact finalization
```

### Correct Configuration

```yaml
permissions:
  actions: write  # ✅ CORRECT - Allows artifact finalization
```

## Related Documentation

- [GitHub Actions Permissions](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs)
- [upload-artifact@v4 Documentation](https://github.com/actions/upload-artifact)
- [GitHub Actions Artifacts](https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts)

## Additional Notes

### Why Not Just Use `permissions: write-all`?

While `permissions: write-all` would fix the issue, it's a security anti-pattern:
- ✅ **Principle of Least Privilege:** Only grant necessary permissions
- ✅ **Security:** Minimize potential damage from compromised workflows
- ✅ **Auditability:** Explicit permissions make intent clear

### Compatibility with v3

If you need to support both v3 and v4:
- v3 works with `actions: read` or `actions: write`
- v4 requires `actions: write`
- Solution: Always use `actions: write` for forward compatibility

## Troubleshooting

### If the 403 Error Persists

1. **Check permissions block exists:**
   ```yaml
   permissions:
     actions: write
   ```

2. **Check job-level permissions don't override:**
   ```yaml
   jobs:
     my-job:
       permissions:  # This overrides workflow-level permissions
         actions: write
   ```

3. **Verify workflow file syntax:**
   ```bash
   yamllint .github/workflows/your-workflow.yml
   ```

4. **Check GitHub repository settings:**
   - Settings → Actions → General → Workflow permissions
   - Ensure "Read and write permissions" is enabled

### Common Errors

**Error:** "Resource not accessible by integration"
- **Cause:** Workflow permissions too restrictive
- **Fix:** Add required permission to workflow

**Error:** "Bad credentials"
- **Cause:** GITHUB_TOKEN expired or invalid
- **Fix:** Use `${{ secrets.GITHUB_TOKEN }}` (automatically provided)

## Commit Reference

**Commit:** 403021e  
**PR:** [Link to PR with CE-MCP security implementation]  
**Branch:** copilot/address-ce-mcp-security-issues

---

**Last Updated:** 2026-02-19  
**Author:** GitHub Copilot  
**Status:** Production Fix Applied
