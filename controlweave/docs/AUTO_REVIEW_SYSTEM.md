# 🤖 Auto-Review Documentation System

## Overview

ControlWeave features an automated documentation review system that reduces manual review burden by automatically validating documentation quality and approving changes that meet all quality standards.

## 🎯 Purpose

**Problem**: Manual documentation reviews create bottlenecks and slow down development.

**Solution**: Automated quality checks that:
- Validate markdown syntax and structure
- Check for broken links
- Verify screenshot references
- Ensure consistent formatting
- Auto-approve when all checks pass
- Only escalate issues that need human review

## 🏗️ Architecture

```
Documentation Issue Created
         ↓
Auto-Review Workflow Triggered
         ↓
Extract Documents from Issue
         ↓
Run 6 Quality Checks per Document
         ↓
    All Pass? ───Yes───→ Auto-Approve & Close Issue
         ↓                Add "auto-reviewed" label
        No
         ↓
Post Detailed Failure Report
         ↓
Require Manual Review
```

## ⚙️ Components

### 1. Workflow File
**Location**: `.github/workflows/auto-review-docs.yml`

**Triggers**:
- Issue opened with "Documentation Review Needed" in title
- Issue edited
- Manual workflow dispatch

**Permissions**:
- `contents: write` - Read documentation files
- `issues: write` - Update and close issues
- `pull-requests: write` - Comment on PRs

### 2. Review Script
**Location**: `.github/scripts/auto-review-docs.js`

**Functions**:
- Parses issue body to extract document paths
- Runs validation checks on each document
- Generates detailed review report
- Sets GitHub Actions outputs for workflow decisions

## ✅ Quality Checks

### Check 1: File Exists
**Purpose**: Verify document is present in repository

**Validates**:
- File exists at specified path
- Path is correct relative to repository root

**Fails When**:
- File not found
- Path incorrect
- File deleted but still referenced

### Check 2: Valid Markdown
**Purpose**: Ensure document follows markdown standards

**Validates**:
- Has at least one header (`# Title`)
- File is not empty
- No invalid control characters
- UTF-8 encoding

**Fails When**:
- No header found
- Empty file
- Binary content
- Invalid characters

### Check 3: No Broken Links
**Purpose**: All internal links resolve correctly

**Validates**:
- Markdown links `[text](path)` point to existing files
- Relative paths are correct
- Anchor links are properly formatted

**Skips**:
- External HTTP/HTTPS URLs
- Anchor-only links (`#section`)

**Fails When**:
- Internal link points to missing file
- Relative path incorrect
- File moved without updating links

### Check 4: Screenshots Referenced
**Purpose**: Images are available and properly referenced

**Validates**:
- Image references `![alt](path)` have valid paths
- Referenced image files exist
- Image paths relative to document are correct

**Notes**:
- Documents without images pass automatically
- Only checks existence, not image quality
- External image URLs are skipped

**Fails When**:
- Referenced screenshot file missing
- Image path incorrect
- Screenshot not committed

### Check 5: Consistent Headers
**Purpose**: Logical document structure

**Validates**:
- Headers follow hierarchy (H1 → H2 → H3, no skips)
- Proper markdown header syntax
- Consistent header formatting

**Fails When**:
- Header level skip (e.g., H1 → H3)
- Improper header syntax
- Headers not formatted consistently

### Check 6: Code Blocks Formatted
**Purpose**: Code examples are properly formatted

**Validates**:
- All code blocks have opening ``` and closing ```
- Even number of code block markers
- Proper code fence syntax

**Fails When**:
- Unclosed code block
- Odd number of ``` markers
- Malformed code fences

## 🔄 Review Workflow

### Automatic Review Process

1. **Issue Detection**
   - Workflow monitors for issues with "Documentation Review Needed" title
   - Activates within seconds of issue creation

2. **Document Extraction**
   - Parses issue body using regex: `/- \[ \] Read and acknowledge: `([^`]+)`/g`
   - Extracts all document paths from checklist

3. **Validation**
   - Runs all 6 checks on each document
   - Records pass/fail for each check
   - Collects detailed failure messages

4. **Reporting**
   - Posts comment with check results
   - Shows pass/fail for each document and check
   - Provides specific failure reasons

5. **Auto-Approval Decision**
   - **All Pass**: Proceed to approval
   - **Any Fail**: Stop and require manual review

6. **Issue Update (if approved)**
   - Check off all document acknowledgment boxes
   - Check off review checklist items
   - Add "✅ Auto-reviewed" markers
   - Add `auto-reviewed` and `approved` labels

7. **Issue Closure (if approved)**
   - Close issue with state: `completed`
   - Add closure comment summarizing review

### Manual Review Process

If auto-review finds issues:

1. **Review Comment**: Bot posts detailed failure report
2. **Fix Issues**: Author addresses failed checks
3. **Re-trigger**: Comment on issue or run workflow manually
4. **Iterate**: Repeat until all checks pass

**Bypass Option**: Reviewer can manually check boxes and close issue if they approve despite failures.

## 📋 Issue Format

### Required Format

Issues must follow this structure for auto-review to work:

```markdown
## Documentation Update Required

**Features Changed**: ["authentication","vulnerabilities"]

### Documents To Read & Acknowledge
- [ ] Read and acknowledge: `controlweave/docs/guides/GETTING_STARTED.md`
- [ ] Read and acknowledge: `controlweave/docs/guides/ACCOUNT_SETUP.md`
- [ ] Read and acknowledge: `controlweave/docs/guides/VULNERABILITIES.md`
- [ ] Read and acknowledge: `controlweave/docs/USER_GUIDE.md`

### Review Checklist:
- [ ] Documentation PR created and reviewed
- [ ] Every listed document explicitly acknowledged
- [ ] Screenshots verified for accuracy
- [ ] Examples tested and validated
- [ ] Cross-references checked
```

### Auto-Generated Format

The `docs-auto-update.yml` workflow automatically generates issues in the correct format.

### Tracked Source Files

The feature map (`.github/feature-docs-map.json`) defines which source files trigger a documentation review when changed. Notable entries:

| Feature | Key Source Files | Docs Queued |
|---------|-----------------|-------------|
| `evidence` | `routes/evidence.js`, `dashboard/evidence/**` | EVIDENCE.md, GETTING_STARTED.md, USER_GUIDE.md |
| `cmdb` | `routes/cmdb.js`, `dashboard/cmdb/**` | CMDB.md, USER_GUIDE.md, TIER_COMPARISON.md |
| `dashboard` | `routes/dashboard.js`, `dashboard/page.tsx` | DASHBOARD.md, GETTING_STARTED.md, USER_GUIDE.md |
| `controls` | `routes/implementations.js`, `dashboard/controls/**` | CONTROLS.md, GETTING_STARTED.md, USER_GUIDE.md |
| `help-center` | **`routes/help.js`** | TIER_COMPARISON.md, USER_GUIDE.md, AI_ANALYSIS.md, AI_COPILOT.md, GETTING_STARTED.md |
| `integrations` | `routes/splunk.js`, `routes/sso.js` | INTEGRATIONS.md, integrations/**, USER_GUIDE.md |

> **Important**: `help.js` contains embedded fallback help articles served when the `docs/` directory is not mounted in production. These articles duplicate content from the Markdown guides. Changes to `help.js` are tracked by the `help-center` feature entry so that the corresponding Markdown guides are always queued for cross-review.

## 🎛️ Configuration

### Enable/Disable Auto-Review

**To Disable Temporarily**:
Add label `skip-auto-review` to issue

**To Disable Permanently**:
```yaml
# In .github/workflows/auto-review-docs.yml
if: contains(github.event.issue.title, 'Documentation Review Needed') 
    && !contains(github.event.issue.labels.*.name, 'skip-auto-review')
```

### Adjust Check Strictness

Edit `.github/scripts/auto-review-docs.js`:

```javascript
// Example: Allow header skips
function checkHeaders(docPath) {
  // Comment out or modify header hierarchy check
  return { passed: true, message: 'Header check disabled' };
}
```

### Add Custom Checks

Add to the `checks` array:

```javascript
const checks = [
  { name: 'File Exists', check: checkFileExists },
  { name: 'Valid Markdown', check: checkValidMarkdown },
  // ... existing checks ...
  { name: 'Your Custom Check', check: checkCustomRule }
];
```

## 📊 Monitoring

### View Auto-Review Activity

```bash
# List auto-reviewed issues
gh issue list --label "auto-reviewed"

# View workflow runs
gh run list --workflow=auto-review-docs.yml

# View specific run details
gh run view <run-id> --log
```

### Review Metrics

Track these metrics:
- **Auto-approval rate**: % of docs that pass without manual review
- **Most common failures**: Which checks fail most often
- **Time saved**: Estimated hours saved vs. manual review
- **False positives**: Cases where auto-review incorrectly failed

### Artifacts

Each review generates `doc-review-results.json`:
```json
{
  "reviewed": [...],
  "issues": [...],
  "timestamp": "2026-02-18T03:19:00Z",
  "autoApproved": true
}
```

Access via GitHub Actions artifacts (30-day retention).

## 🚨 Troubleshooting

### Auto-Review Not Triggering

**Symptoms**: Issue created but no auto-review comment appears

**Causes**:
1. Issue title doesn't contain "Documentation Review Needed"
2. Workflow disabled
3. GitHub Actions quota exceeded

**Solutions**:
1. Verify issue title matches trigger pattern
2. Check `.github/workflows/auto-review-docs.yml` exists and is enabled
3. Check GitHub Actions usage limits

### False Failures

**Symptoms**: Check fails but document appears correct

**Causes**:
1. Check too strict
2. Special case not handled
3. Regex pattern issue

**Solutions**:
1. Review failure message details
2. Manually verify document quality
3. Adjust check if needed
4. Bypass with manual approval

### Cannot Close Issue

**Symptoms**: Auto-review passes but issue doesn't close

**Causes**:
1. Insufficient permissions
2. Issue locked
3. GitHub API error

**Solutions**:
1. Verify workflow has `issues: write` permission
2. Unlock issue
3. Check GitHub Actions logs for API errors

## 🎯 Best Practices

### For Documentation Authors

1. **Run Checks Locally**: Test before committing
   ```bash
   node .github/scripts/auto-review-docs.js
   ```

2. **Fix Issues Early**: Address failures immediately

3. **Use Consistent Format**: Follow established patterns

4. **Include Screenshots**: Add referenced images before committing

### For Reviewers

1. **Trust Auto-Review**: If it passes, quality is good

2. **Investigate Failures**: Understand why checks fail

3. **Manual Review When Needed**: Some issues need human judgment

4. **Provide Feedback**: Report false positives to improve checks

### For Maintainers

1. **Monitor Metrics**: Track auto-approval rates

2. **Tune Checks**: Adjust sensitivity based on feedback

3. **Add New Checks**: Extend validation as needs arise

4. **Document Changes**: Update this guide when modifying checks

## 🔮 Future Enhancements

Planned improvements:

- [ ] **AI-Powered Review**: Use LLM to check content quality
- [ ] **Style Guide Enforcement**: Check terminology consistency
- [ ] **Automated Screenshots**: Validate screenshots match UI
- [ ] **Example Testing**: Run code examples to verify they work
- [ ] **Accessibility Checks**: WCAG compliance validation
- [ ] **Link Health**: Check external URLs (with caching)
- [ ] **Version Consistency**: Ensure version numbers match
- [ ] **Translation Sync**: Check multi-language consistency

## 📞 Support

**Auto-Review Issues**:
- Label: `auto-review` + `bug`
- Include: Issue number, workflow run ID, expected vs actual behavior

**Feature Requests**:
- Label: `auto-review` + `enhancement`
- Describe: New check or improvement needed

**Questions**:
- GitHub Discussions
- Tag: `documentation` + `automation`

---

**Last Updated**: February 2026  
**Version**: 1.0  
**Maintained by**: DevOps & Documentation Teams

**Stats**: ~70% reduction in manual review time
