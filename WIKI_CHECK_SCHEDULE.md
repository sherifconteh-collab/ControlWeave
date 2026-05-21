# 📅 Wiki Sync & Health Check Schedule

Complete guide to how often and when documentation is checked and synced to the GitHub Wiki.

## 🔄 Sync Frequency

### Automatic Sync
Documents are automatically synced to the wiki in these scenarios:

#### 1. **On Every Push to Main** 
**Trigger**: Code merged to `main` branch  
**Condition**: Changes to documentation files  
**Paths Monitored**:
- `controlweave/docs/wiki/**`
- `controlweave/docs/guides/**`
- `.github/workflows/sync-wiki.yml`

**Timing**: Immediate (within 1-2 minutes of merge)

**What Happens**:
1. Workflow detects documentation changes
2. Clones wiki repository
3. Copies all markdown files from `controlweave/docs/wiki/`
4. Commits and pushes to wiki
5. Wiki updates appear immediately

#### 2. **Manual Trigger**
**How**: 
```bash
gh workflow run sync-wiki.yml
```
Or via GitHub UI: Actions → Sync Documentation to Wiki → Run workflow

**When to Use**:
- Need immediate sync
- Automatic sync failed
- Testing sync process

## 🏥 Health Check Frequency

### Scheduled Health Checks
**Schedule**: **Daily at 9:00 AM UTC**  
**Cron Expression**: `0 9 * * *`  
**Workflow**: `.github/workflows/wiki-health-check.yml`

**What It Checks**:
1. ✅ All expected documents exist in wiki
2. ✅ Document content matches source
3. ✅ No missing files
4. ✅ Content hashes match (MD5)
5. ℹ️ Identifies extra files in wiki

**Actions Taken**:
- Generates health report
- Posts to GitHub Step Summary
- Creates/updates issue if problems found
- Closes issue if all healthy
- Optionally triggers auto-fix

### Manual Health Check
**How**:
```bash
# Check health only
gh workflow run wiki-health-check.yml

# Check and auto-fix if issues found
gh workflow run wiki-health-check.yml -f auto_fix=true
```

## 📊 Check Schedule Summary

| Check Type | Frequency | Trigger | Auto-Fix |
|------------|-----------|---------|----------|
| **Sync on Push** | On every push to main | Automatic | N/A - Performs sync |
| **Daily Health Check** | Once per day (9 AM UTC) | Scheduled | Optional |
| **Manual Sync** | On demand | User-initiated | N/A - Performs sync |
| **Manual Health Check** | On demand | User-initiated | Optional |

## 🔍 What Gets Checked

### Expected Documents (5 total)

```
1. Home.md                        (Landing page)
2. User-Guide.md                  (Main guide)
3. Getting-Started.md             (Onboarding)
4. Account-Setup.md               (Account config)
5. Vulnerability-Management.md    (Security)
```

### Health Checks Performed

#### 1. **File Existence**
- Verifies each expected document exists in wiki
- Status: `✅ Found` or `❌ Missing`

#### 2. **Content Sync**
- Compares MD5 hash of source vs. wiki
- Status: `✅ In Sync` or `🔄 Out of Sync`

#### 3. **Source Integrity**
- Ensures source files exist
- Status: `✅ Present` or `⚠️ Source Missing`

#### 4. **Extra Files**
- Lists files in wiki not in source
- Status: `ℹ️ Extra File` (informational)

## 📈 Health Report Example

```json
{
  "timestamp": "2026-02-18T09:00:00.000Z",
  "healthy": true,
  "expectedDocs": 5,
  "foundInWiki": 5,
  "missingDocs": [],
  "outOfSync": [],
  "extraDocs": []
}
```

## 🚨 When Issues Are Detected

### Automatic Actions

1. **Issue Creation**
   - Creates issue with label `wiki-health`
   - Title: "⚠️ Wiki Health Check Failed"
   - Contains detailed report

2. **Issue Updates**
   - Updates existing open issue if found
   - Adds comment with latest status
   - Timestamp of each check

3. **Auto-Fix (if enabled)**
   - Triggers wiki sync workflow
   - Re-syncs all documents
   - Updates issue after fix

4. **Issue Closure**
   - Closes issue when health check passes
   - Adds closure comment with confirmation

### Notification Timeline

```
9:00 AM UTC - Daily health check runs
    ↓
Issues found? → Create/Update issue → Team notified
    ↓
Auto-fix enabled? → Trigger sync → Re-check
    ↓
Next check: Tomorrow at 9:00 AM UTC
```

## ⚙️ Configuration

### Change Check Frequency

Edit `.github/workflows/wiki-health-check.yml`:

```yaml
on:
  schedule:
    # Current: Daily at 9 AM UTC
    - cron: '0 9 * * *'
    
    # Options:
    # - cron: '0 */6 * * *'    # Every 6 hours
    # - cron: '0 9,21 * * *'   # Twice daily (9 AM, 9 PM)
    # - cron: '0 9 * * 1'      # Weekly (Mondays)
    # - cron: '0 9 1 * *'      # Monthly (1st of month)
```

### Cron Expression Guide

| Expression | Meaning | Frequency |
|------------|---------|-----------|
| `0 9 * * *` | 9 AM daily | Once per day |
| `0 */6 * * *` | Every 6 hours | 4 times per day |
| `0 9 * * 1-5` | 9 AM weekdays | 5 times per week |
| `*/30 * * * *` | Every 30 min | 48 times per day |

### Enable Auto-Fix by Default

Edit workflow to always enable auto-fix:

```yaml
- name: Auto-fix if enabled
  if: steps.health_check.outputs.healthy == 'false'  # Remove input check
  run: |
    echo "🔧 Auto-fixing..."
    gh workflow run sync-wiki.yml
```

## 📊 Monitoring Dashboard

### View Check History

```bash
# List recent health check runs
gh run list --workflow=wiki-health-check.yml

# View specific run details
gh run view <run-id>

# Download health report artifact
gh run download <run-id> -n wiki-health-report
```

### Check Current Wiki Status

```bash
# Run immediate health check
gh workflow run wiki-health-check.yml --ref main

# Wait for completion and view results
gh run watch

# Or check latest run
gh run view --log
```

## 🔔 Notification Settings

### GitHub Issues
- **Label**: `wiki-health`
- **Auto-created**: When problems detected
- **Auto-closed**: When health restored

### Email Notifications
Configure in GitHub Settings → Notifications:
- Watch the repository
- Enable "Actions" notifications
- Receive email on workflow failures

### Slack/Discord Integration
Add webhook in workflow:

```yaml
- name: Notify Slack
  if: steps.health_check.outputs.healthy == 'false'
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "⚠️ Wiki health check failed"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

## 📅 Check Schedule Calendar

```
Week View:
Monday    9:00 AM → Health Check
Tuesday   9:00 AM → Health Check
Wednesday 9:00 AM → Health Check
Thursday  9:00 AM → Health Check
Friday    9:00 AM → Health Check
Saturday  9:00 AM → Health Check
Sunday    9:00 AM → Health Check

Plus: Sync on every push to main
```

## 🎯 Best Practices

### For Document Authors
1. **Test locally** before pushing:
   ```bash
   node .github/scripts/check-wiki-health.js
   ```

2. **Verify sync** after merging:
   - Check wiki URL
   - Verify content matches

3. **Monitor issues** with label `wiki-health`

### For Repository Maintainers
1. **Review daily reports** in Actions tab
2. **Investigate failures** promptly
3. **Adjust frequency** based on update cadence
4. **Enable auto-fix** for hands-off operation

### For Teams
1. **Subscribe to wiki-health issues**
2. **Set up team notifications**
3. **Assign on-call for wiki health**
4. **Document escalation process**

## 🔧 Troubleshooting

### Health Check Not Running
**Symptoms**: No runs visible in Actions

**Causes**:
- Workflow disabled
- Cron syntax error
- Repository settings

**Solutions**:
1. Enable Actions in repository settings
2. Validate cron expression
3. Check workflow file syntax

### Always Reports Unhealthy
**Symptoms**: Daily failures despite manual verification

**Causes**:
- Hash mismatch (whitespace, line endings)
- Wiki repo not accessible
- Source files moved

**Solutions**:
1. Check file content carefully
2. Verify wiki repo permissions
3. Update expectedDocs list

### Auto-Fix Not Working
**Symptoms**: Issues reported but not fixed

**Causes**:
- Auto-fix not enabled
- Sync workflow failed
- Permissions issue

**Solutions**:
1. Enable auto-fix in workflow run
2. Check sync workflow logs
3. Verify GITHUB_TOKEN permissions

## 📝 Quick Reference

### Key Files
- **Health Check Workflow**: `.github/workflows/wiki-health-check.yml`
- **Sync Workflow**: `.github/workflows/sync-wiki.yml`
- **Health Script**: `.github/scripts/check-wiki-health.js`

### Key Commands
```bash
# Trigger health check
gh workflow run wiki-health-check.yml

# Trigger with auto-fix
gh workflow run wiki-health-check.yml -f auto_fix=true

# Trigger sync
gh workflow run sync-wiki.yml

# View latest health report
gh run view --log | grep "Health Check"

# List wiki-health issues
gh issue list --label wiki-health
```

### Key Times
- **Daily Check**: 9:00 AM UTC
- **Auto-Sync**: On push to main (immediate)
- **Manual**: Anytime on demand

---

**Last Updated**: February 2026  
**Check Frequency**: Daily at 9:00 AM UTC + On every push  
**Auto-Fix**: Available (opt-in)  
**Monitoring**: GitHub Issues + Actions Artifacts
