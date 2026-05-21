# MCP Secure Deployment Checklist

Quick reference for deploying the secure MCP server in production.

## Pre-Deployment

### Configuration

- [ ] **Environment Variables Set**
  - [ ] `GRC_API_BASE_URL` - HTTPS backend URL
  - [ ] `GRC_API_TOKEN` - Valid JWT token
  - [ ] `NODE_ENV=production` - Production mode
  - [ ] `MCP_RATE_LIMIT` - Appropriate rate limit
  - [ ] `MCP_REQUEST_TIMEOUT_MS` - Request timeout
  - [ ] `MCP_ENABLE_AUDIT_LOG=true` - Enable logging

- [ ] **Token Security**
  - [ ] Token stored in secure credential store (not in code)
  - [ ] Token has appropriate expiration (≤15 minutes recommended)
  - [ ] Token rotation mechanism in place
  - [ ] Different tokens for dev/staging/production

- [ ] **Network Security**
  - [ ] Backend uses HTTPS (not HTTP)
  - [ ] TLS 1.2 or higher configured
  - [ ] Valid SSL certificate installed
  - [ ] Firewall rules configured

### File Permissions

- [ ] MCP server script: `chmod 750 mcp-server-secure.js`
- [ ] Configuration file: `chmod 600 .env`
- [ ] Log directory: `chmod 750 /var/log/controlweave/`
- [ ] Service account has minimal permissions

### Infrastructure

- [ ] Dedicated service account created for MCP server
- [ ] Log directory created: `/var/log/controlweave/`
- [ ] Log rotation configured (logrotate)
- [ ] Monitoring/alerting system configured
- [ ] Backup strategy in place

## Deployment

### Installation

```bash
# 1. Copy secure server
cd /opt/controlweave/backend/scripts
cp mcp-server-secure.js mcp-server.js

# 2. Set permissions
chmod 750 mcp-server.js
chown controlweave:controlweave mcp-server.js

# 3. Create log directory
mkdir -p /var/log/controlweave
chmod 750 /var/log/controlweave
chown controlweave:controlweave /var/log/controlweave

# 4. Configure log rotation
sudo tee /etc/logrotate.d/controlweave-mcp << EOF
/var/log/controlweave/mcp-audit.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 controlweave controlweave
    sharedscripts
}
EOF
```

### Testing

- [ ] **Smoke Test**
  ```bash
  # Test server starts
  npm run mcp:secure
  # Should see: [INFO] Secure AI GRC MCP server running on stdio
  ```

- [ ] **Authentication Test**
  ```bash
  # Test with invalid token
  GRC_API_TOKEN=invalid npm run mcp:secure
  # Should log authentication failures
  ```

- [ ] **Rate Limit Test**
  - [ ] Invoke same tool 35+ times rapidly
  - [ ] Verify rate limit error after 30 requests

- [ ] **Timeout Test**
  - [ ] Configure very short timeout (5s)
  - [ ] Verify timeout error on slow operations

## Post-Deployment

### Verification

- [ ] **Server Health**
  - [ ] Server starts without errors
  - [ ] Health check tool works: `grc_health`
  - [ ] Authentication works: `grc_whoami`
  - [ ] Tools return expected data

- [ ] **Audit Logging**
  - [ ] Audit log file created
  - [ ] Log entries being written
  - [ ] Log format is JSON
  - [ ] Sensitive data redacted in logs

- [ ] **Security Controls**
  - [ ] Rate limiting enforced
  - [ ] Authentication required for protected tools
  - [ ] Invalid tokens rejected
  - [ ] Input validation working

### Monitoring Setup

- [ ] **Metrics Collection**
  - [ ] Tool invocation counts tracked
  - [ ] Authentication failure rate monitored
  - [ ] Rate limit violations tracked
  - [ ] API error rates monitored

- [ ] **Alerting Rules**
  - [ ] Alert on 5+ auth failures in 5 minutes
  - [ ] Alert on 10+ rate limit violations per hour
  - [ ] Alert on API error rate > 10%
  - [ ] Alert on no activity for 6+ hours (if expected)

- [ ] **Log Aggregation**
  - [ ] Logs forwarded to SIEM (if applicable)
  - [ ] Log retention policy configured
  - [ ] Log search/analysis capability verified

### Documentation

- [ ] Security guide reviewed: `docs/MCP_SECURITY_GUIDE.md`
- [ ] Team trained on security procedures
- [ ] Incident response plan documented
- [ ] Runbook created for common issues
- [ ] Emergency contacts documented

## Client Configuration

### Claude Desktop Example

```json
{
  "mcpServers": {
    "controlweave": {
      "command": "node",
      "args": ["/opt/controlweave/backend/scripts/mcp-server.js"],
      "env": {
        "GRC_API_BASE_URL": "https://your-backend.com/api/v1",
        "GRC_API_TOKEN": "${CONTROLWEAVE_TOKEN}",
        "NODE_ENV": "production",
        "MCP_RATE_LIMIT": "30",
        "MCP_ENABLE_AUDIT_LOG": "true"
      }
    }
  }
}
```

- [ ] Client configuration file permissions: `chmod 600`
- [ ] No hardcoded tokens in configuration
- [ ] Environment variables used for secrets
- [ ] Full paths used (no relative paths)

### Windows Enterprise — Managed Settings (MDM/Intune)

> **⚠️ Windows Path Migration (Required by March 12, 2026)**
>
> Claude Code on Windows is migrating the managed settings file path.
> - **New path (required):** `C:\Program Files\ClaudeCode\managed-settings.json`
> - **Legacy path (deprecated):** `C:\ProgramData\ClaudeCode\` — stops being read after March 12, 2026.
>
> Update your MDM or endpoint management configuration (e.g., Microsoft Intune) to deploy `managed-settings.json` to the **new path** before that date.

For enterprise Windows deployments, use `managed-settings.json` to push the ControlWeave MCP server configuration to all endpoints via MDM. A ready-to-use template is provided at `docs/templates/managed-settings.json`.

**Deploy path:** `C:\Program Files\ClaudeCode\managed-settings.json`

Key settings in the template:
- Allows all ControlWeave MCP tools while denying access to shell and secrets
- Sets `disableBypassPermissionsMode: "disable"` — the string `"disable"` is the only valid value per the [Claude Code permissions docs](https://code.claude.com/docs/en/permissions); it blocks users from entering bypass-permissions ("YOLO") mode system-wide
- Configures the ControlWeave MCP server with production environment variables
- Disables nonessential Claude Code network traffic

**Steps:**

1. Copy and customize `docs/templates/managed-settings.json`:
   - Replace `https://your-controlweave-backend.example.com/api/v1` with your actual ControlWeave backend URL. **This must be updated — the placeholder will cause connection failures.**
   - Use your MDM solution to inject `CONTROLWEAVE_TOKEN` as a managed environment variable or substitute a valid token.

2. Deploy via MDM (e.g., Microsoft Intune) to:
   ```
   C:\Program Files\ClaudeCode\managed-settings.json
   ```

3. Set file ACL so only administrators can modify it:
   ```powershell
   icacls "C:\Program Files\ClaudeCode\managed-settings.json" /inheritance:r /grant "BUILTIN\Administrators:(F)" /grant "SYSTEM:(F)"
   ```

- [ ] `managed-settings.json` deployed to `C:\Program Files\ClaudeCode\managed-settings.json` (new path)
- [ ] Legacy `C:\ProgramData\ClaudeCode\` path removed from MDM configuration
- [ ] File ACL restricts modification to administrators only
- [ ] `GRC_API_BASE_URL` set to production ControlWeave backend
- [ ] Token injected via MDM or secure credential mechanism (not hardcoded)
- [ ] Deployment verified on a test endpoint before broad rollout

## Ongoing Maintenance

### Daily

- [ ] Review audit logs for anomalies
- [ ] Check monitoring dashboards
- [ ] Verify no critical alerts

### Weekly

- [ ] Review authentication failures
- [ ] Analyze tool usage patterns
- [ ] Check for unusual activity
- [ ] Review rate limit violations

### Monthly

- [ ] Rotate JWT tokens
- [ ] Review and update rate limits if needed
- [ ] Update dependencies: `npm audit && npm update`
- [ ] Review and update security documentation
- [ ] Conduct security review of audit logs

### Quarterly

- [ ] Review and update access permissions
- [ ] Conduct security training refresh
- [ ] Review incident response procedures
- [ ] Test backup and restore procedures

## Rollback Plan

If issues occur after deployment:

```bash
# 1. Revert to standard MCP server
cd /opt/controlweave/backend/scripts
cp mcp-server.legacy.js mcp-server.js

# 2. Restart service
systemctl restart controlweave-mcp

# 3. Monitor for stability
tail -f /var/log/controlweave/mcp-audit.log

# 4. Document issue for investigation
# Create incident report with:
# - Error messages
# - Relevant log entries
# - Steps to reproduce
# - Impact assessment
```

## Troubleshooting

### Server Won't Start

**Symptom:** Server exits immediately
```bash
# Check logs
node scripts/mcp-server.js 2>&1 | grep ERROR

# Common causes:
# - Missing GRC_API_BASE_URL
# - Invalid node version (requires >=20.16.0)
# - Missing dependencies (run npm install)
```

### Authentication Failures

**Symptom:** All tools return "Authentication failed"
```bash
# Verify token is valid
curl -H "Authorization: Bearer $GRC_API_TOKEN" \
     https://your-backend.com/api/v1/auth/me

# Common causes:
# - Token expired (tokens last 15 minutes by default)
# - Wrong token format (must be JWT)
# - Backend URL incorrect
```

### Rate Limit Too Restrictive

**Symptom:** Frequent rate limit errors
```bash
# Increase rate limit
export MCP_RATE_LIMIT=60  # 60 requests per minute

# Or disable temporarily for debugging
export MCP_RATE_LIMIT=9999
```

### Slow Performance

**Symptom:** Requests timing out
```bash
# Increase timeout
export MCP_REQUEST_TIMEOUT_MS=60000  # 60 seconds

# Check backend performance
curl -w "@curl-format.txt" -H "Authorization: Bearer $TOKEN" \
     https://your-backend.com/api/v1/dashboard/stats
```

## Security Incidents

### Suspected Token Compromise

1. **Immediate Actions:**
   - Revoke compromised token in backend
   - Force user to re-authenticate
   - Review audit logs for unauthorized access

2. **Investigation:**
   ```bash
   # Search audit logs for suspicious activity
   grep "tool_invocation" /var/log/controlweave/mcp-audit.log | \
       jq '. | select(.user_id=="<user-id>")'
   ```

3. **Remediation:**
   - Generate new token
   - Update MCP client configuration
   - Monitor for 24 hours

### Unusual Tool Access

1. **Immediate Actions:**
   - Temporarily disable affected user account
   - Review recent tool invocations

2. **Investigation:**
   ```bash
   # Find unusual patterns
   grep "tool_invocation" /var/log/controlweave/mcp-audit.log | \
       jq '. | select(.tool=="grc_update_control_implementation")' | \
       jq -s 'group_by(.user_id) | map({user: .[0].user_id, count: length})'
   ```

3. **Remediation:**
   - Confirm legitimate activity with user
   - If malicious: revoke access, reset credentials
   - Update detection rules

## Contact Information

- **Security Team:** security@yourcompany.com
- **On-Call:** +1-XXX-XXX-XXXX
- **Documentation:** `/docs/MCP_SECURITY_GUIDE.md`
- **Issue Tracker:** https://github.com/yourorg/controlweave/issues

---

**Checklist Version:** 1.0  
**Last Updated:** 2026-02-18  
**Owner:** Platform Security Team
