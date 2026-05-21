# Code Scan Failure Automation

## Overview

This repository includes automated issue creation for security code scan failures. When any security scan fails in the CI/CD pipeline, a GitHub issue is automatically created and assigned to @copilot for immediate attention.

## How It Works

### Monitored Scans

The automation monitors the following security scans in the CI/CD pipeline:

1. **CodeQL SAST Analysis** - Static application security testing
2. **Dependency Vulnerability Scan** - npm audit for vulnerable packages
3. **Secrets Detection** - TruffleHog and Gitleaks for exposed secrets
4. **Container Security** - Trivy for container vulnerabilities
5. **Vulnerability Analysis** - Comprehensive vulnerability assessment

### Trigger Conditions

The automation triggers when:
- Any of the monitored scans fail
- The workflow runs on push or pull request events
- The security pipeline completes (success or failure)

### Automatic Issue Creation

When a scan fails, the automation:

1. **Detects** which specific scans failed
2. **Creates** a GitHub issue with:
   - Descriptive title including commit SHA and branch
   - Detailed body with failure information
   - Links to workflow runs and commits
   - Specific remediation guidance for each failed scan
3. **Assigns** the issue to @copilot
4. **Labels** the issue: `security`, `automated`, `code-scan-failure`, `needs-triage`
5. **Comments** on PRs (if applicable) with a link to the created issue

## Issue Format

### Title
```
🔴 Code Scan Failure - {commit-sha} on {branch-name}
```

### Body Structure

```markdown
## 🔴 Code Scan Failures Detected

One or more security scans have failed in the CI/CD pipeline.

### Failed Scans
- ❌ {Scan Name}
- ❌ {Scan Name}

### Context
**Workflow Run:** [View Details](link)
**Commit:** `abc1234`
**Branch:** `feature-branch`
**Triggered By:** @username
**Pull Request:** #123 (if applicable)

### {Failed Scan Name}
Description of what failed and why...

**What to check:**
- Specific guidance for this scan type
- Where to find more details
- How to fix the issue

### Next Steps
1. Review the workflow run
2. Check the Security tab
3. Fix identified issues
4. Re-run the workflow

### Resources
- Security Pipeline Documentation
- NIST 800-160 Compliance Guide
- Security Best Practices
```

## Remediation Guidance by Scan Type

### CodeQL SAST Analysis
When CodeQL fails:
- Review CodeQL alerts in the Security tab
- Check for security vulnerabilities, code quality issues, or bugs
- Review the workflow logs for specific failure details
- Fix identified issues in the codebase

### Dependency Vulnerability Scan
When dependency scan fails:
- Review npm audit results in workflow artifacts
- Update vulnerable dependencies to secure versions
- Check for available security patches
- Run `npm audit fix` locally

### Secrets Detection
When secrets scan fails:
- Review TruffleHog and Gitleaks scan results
- Remove or rotate any exposed secrets immediately
- Use environment variables or secure secret management
- Audit commit history for exposed credentials

### Container Security
When Trivy scan fails:
- Review Trivy SARIF results in workflow artifacts
- Update base images or dependencies
- Check for OS-level vulnerabilities
- Consider using smaller or more secure base images

### Vulnerability Analysis
When vulnerability analysis fails:
- Review the workflow logs for specific errors
- Check if dependency data was available
- Verify SBOM generation succeeded
- Ensure all required jobs completed

## Configuration

### Workflow File
The automation is configured in `.github/workflows/security-pipeline.yml` as job `create-scan-failure-issue`.

### Key Configuration Points

```yaml
create-scan-failure-issue:
  name: Create Issue for Code Scan Failures
  runs-on: ubuntu-latest
  needs: [codeql-analysis, dependency-scan, secrets-scan, container-security, vulnerability-analysis]
  if: |
    always() && (
      needs.codeql-analysis.result == 'failure' ||
      needs.dependency-scan.result == 'failure' ||
      needs.secrets-scan.result == 'failure' ||
      needs.container-security.result == 'failure' ||
      needs.vulnerability-analysis.result == 'failure'
    )
  permissions:
    issues: write
    contents: read
```

### Customization

To modify the automation:

1. **Change assignee**: Edit the `assignees` array in the issue creation step
2. **Add/remove labels**: Modify the `labels` array
3. **Customize issue body**: Edit the issue body template in the GitHub Script step
4. **Monitor additional scans**: Add to the `needs` array and `if` condition

## Benefits

### For Development Teams
- ✅ **No Manual Tracking** - Issues created automatically
- ✅ **Immediate Notification** - @copilot assigned instantly
- ✅ **Contextual Information** - All relevant links and details
- ✅ **Actionable Guidance** - Specific remediation steps

### For Security
- ✅ **Audit Trail** - Permanent record of all scan failures
- ✅ **Categorization** - Easy filtering with labels
- ✅ **Visibility** - Security issues never go unnoticed
- ✅ **Compliance** - Demonstrates security monitoring

### For Operations
- ✅ **Non-Blocking** - Doesn't prevent other workflow jobs
- ✅ **Parallel Execution** - Runs alongside other checks
- ✅ **Resource Efficient** - Only creates issues when needed

## Viewing Issues

### Find All Automated Issues
Use GitHub's issue filters:
```
is:issue is:open label:automated label:code-scan-failure
```

### Find Issues Assigned to Copilot
```
is:issue is:open assignee:copilot label:code-scan-failure
```

### Find Issues by Scan Type
Add specific scan details to the search:
```
is:issue is:open label:code-scan-failure "CodeQL" in:body
```

## Workflow Integration

### Pull Request Flow
1. Developer creates/updates PR
2. Security pipeline runs automatically
3. If scans fail:
   - Issue created and assigned to @copilot
   - Comment posted on PR with issue link
   - PR shows failed checks
4. Developer/Copilot fixes issues
5. Pipeline re-runs automatically
6. All checks pass, PR can be merged

### Main Branch Flow
1. Code pushed to main/develop
2. Security pipeline runs
3. If scans fail:
   - Issue created and assigned to @copilot
   - No PR comment (direct push)
4. Team addresses issue
5. Follow-up commit fixes issues

## Troubleshooting

### Issue Not Created
**Possible causes:**
- All scans passed (expected behavior)
- Workflow permissions insufficient
- Job condition not met

**Check:**
- Workflow run logs
- Job execution conditions
- GitHub Actions permissions

### Incorrect Assignment
**Possible causes:**
- @copilot user doesn't exist in repository
- Assignee name misspelled

**Fix:**
- Verify copilot user exists
- Check assignee configuration in workflow

### Missing Information
**Possible causes:**
- Environment variables not available
- Context information missing

**Fix:**
- Review workflow context
- Check GitHub Actions documentation

## Best Practices

1. **Review Issues Promptly** - Address scan failures quickly
2. **Fix Root Causes** - Don't just close issues, fix the underlying problems
3. **Monitor Trends** - Track recurring scan failures
4. **Update Dependencies** - Keep packages up to date to prevent vulnerabilities
5. **Test Locally** - Run scans locally before pushing

## Related Documentation

- [Security Pipeline](.github/workflows/security-pipeline.yml)
- [NIST 800-160 Compliance](docs/)
- [Security Best Practices](SECURITY.md)
- [Contributing Guidelines](CONTRIBUTING.md)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-18 | Initial implementation of automated issue creation |

---

**Maintained by:** Development Team  
**Last Updated:** 2026-02-18  
**Status:** Active
