# MCP Security Guide

## Overview

This document outlines the security measures implemented in ControlWeave's Model Context Protocol (MCP) server, based on [OWASP's Practical Guide for Secure MCP Server Development](https://genai.owasp.org/resource/a-practical-guide-for-secure-mcp-server-development/).

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Threat Model](#threat-model)
3. [Security Controls](#security-controls)
4. [Configuration](#configuration)
5. [Best Practices](#best-practices)
6. [Monitoring & Auditing](#monitoring--auditing)
7. [Incident Response](#incident-response)

---

## Security Architecture

### Defense-in-Depth Layers

ControlWeave's MCP server implements multiple security layers:

1. **Authentication Layer** - JWT token validation
2. **Authorization Layer** - Role-based access control (RBAC)
3. **Input Validation Layer** - Schema validation and sanitization
4. **Rate Limiting Layer** - Request throttling per tool
5. **Audit Logging Layer** - Comprehensive activity tracking
6. **Output Sanitization Layer** - Data minimization and PII protection

### Secure-by-Default Design

- All tools require authentication by default (except health check)
- Rate limiting enabled on all authenticated tools
- Verbose error messages disabled in production
- Audit logging enabled by default
- Request timeouts prevent resource exhaustion

---

## Threat Model

### Identified Threats & Mitigations

| Threat | Risk Level | Mitigation |
|--------|-----------|------------|
| **Prompt Injection** | High | Input sanitization, length limits, control character filtering |
| **Command Injection** | Critical | Parameterized queries, input validation, no shell execution |
| **Authentication Bypass** | Critical | JWT verification, token expiration checks, secure token storage |
| **Authorization Bypass** | High | Permission checks on every tool invocation, org-scoped data access |
| **Rate Limit Abuse** | Medium | Per-tool rate limiting (30 req/min default) |
| **Data Exfiltration** | High | Data minimization, sensitive field filtering, audit logging |
| **Resource Exhaustion** | Medium | Request timeouts, result pagination limits, max input lengths |
| **Information Disclosure** | Medium | Sanitized error messages, verbose mode only in dev |
| **Session Hijacking** | High | Short-lived tokens, secure token transmission |
| **Cross-Tool Contamination** | Medium | Input sanitization, isolated tool contexts |

---

## Security Controls

### 1. Authentication & Authorization

**JWT Token Validation:**
- Every authenticated tool validates the JWT token before execution
- Tokens must be provided via `GRC_API_TOKEN` environment variable
- Token expiration is enforced by the backend API
- Invalid or expired tokens result in authentication failure

**User Context Resolution:**
- User identity and organization ID retrieved from `/auth/me` endpoint
- All data access is scoped to the authenticated user's organization
- Audit logs include user ID and organization ID for every action

**Permission Enforcement:**
- Tools respect backend RBAC permissions
- Users can only access data within their organization
- Administrative operations require admin role

### 2. Input Validation & Sanitization

**Schema Validation:**
- All tool inputs validated using Zod schemas
- Type checking enforced for all parameters
- UUID format validation for ID parameters
- URL validation for URL parameters

**Input Sanitization:**
```javascript
// Remove control characters and null bytes
input.replace(/[\x00-\x1F\x7F]/g, '')

// UUID format validation
/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Query parameter sanitization (prevent injection)
value.replace(/[^\w\s\-@.]/g, '')
```

**Length Limits:**
- Default maximum input length: 10,000 characters
- Text fields: Configurable per field
- URLs: 2,000 characters maximum
- Framework/control codes: 50 characters maximum
- Search terms: 200 characters maximum

### 3. Rate Limiting

**Per-Tool Limits:**
- Default: 30 requests per minute per tool
- Configurable via `MCP_RATE_LIMIT` environment variable
- Rolling time window (1 minute)
- Rate limit state tracked per tool name

**Rate Limit Response:**
```
Rate limit exceeded. Try again after 2026-02-18T13:05:00.000Z
```

**Configuration:**
```bash
# Set custom rate limit (requests per minute)
export MCP_RATE_LIMIT=50
```

### 4. Request Timeouts

**Timeout Protection:**
- Default timeout: 30 seconds
- Configurable via `MCP_REQUEST_TIMEOUT_MS`
- Prevents resource exhaustion from hanging requests
- Uses AbortController for proper cleanup

**Configuration:**
```bash
# Set custom timeout (milliseconds)
export MCP_REQUEST_TIMEOUT_MS=60000  # 60 seconds
```

### 5. Audit Logging

**Logged Events:**
- `server_start` - Server initialization with client metadata
- `server_shutdown` - Graceful shutdown with client metadata
- `identity_verified` - User identity verification at startup
- `tool_invocation` - Every tool call with sanitized arguments and client info
- `tool_success` - Successful tool execution with duration
- `tool_error` - Failed tool execution with error message
- `authentication` - Authentication attempts
- `rate_limit_exceeded` - Rate limit violations
- `error_response` - Error responses sent to clients

**Log Format:**
```json
{
  "timestamp": "2026-02-18T12:54:23.414Z",
  "event": "tool_invocation",
  "tool": "grc_list_controls",
  "args": {"organization_id": "***REDACTED***"},
  "user_id": "uuid-here",
  "organization_id": "uuid-here",
  "client": {
    "platform": "darwin",
    "node_version": "v20.11.0",
    "client_name": "Claude Desktop",
    "client_version": "0.5.0"
  }
}
```

**Identity Verification at Startup:**
On server startup, the MCP server verifies the authenticated user's identity and displays:
- Full name and email
- Organization name
- Role and permissions count
- User ID and Organization ID

This information is logged to stderr and the audit log for security tracking.

**Client Metadata Tracking:**
The server automatically detects and tracks LLM client information:
- Client name (Claude Desktop, Cursor, etc.) - from `MCP_CLIENT_NAME` env var
- Client version - from `MCP_CLIENT_VERSION` env var
- Platform and Node.js version
- Process identifiers

This metadata is included in all audit log entries for comprehensive tracking.

**Sensitive Data Handling:**
- Passwords, tokens, secrets, API keys automatically redacted
- Logs written to stderr (stdout reserved for MCP protocol)
- Can be disabled via `MCP_ENABLE_AUDIT_LOG=false`

### 6. Output Sanitization

**Data Minimization:**
- Sensitive fields automatically filtered from responses
- Fields removed: `password_hash`, `jwt_secret`, `api_key`, `secret`
- Recursive sanitization for nested objects and arrays

**Error Message Security:**
- Verbose errors only in development (`NODE_ENV !== 'production'`)
- Production errors show generic message: "An error occurred"
- Detailed errors logged to audit log for debugging

### 7. Resource Protection

**Result Limits:**
- Maximum results per query: 200 (configurable)
- Pagination required for large datasets
- Prevents memory exhaustion from large responses

**Configuration:**
```bash
# Set custom result limit
export MCP_MAX_RESULT_LIMIT=500
```

---

## Configuration

### Required Environment Variables

```bash
# Backend API configuration
GRC_API_BASE_URL=https://your-backend.com/api/v1
GRC_API_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: Health check endpoint
GRC_HEALTH_URL=https://your-backend.com/health
```

### Optional Security Configuration

```bash
# Rate limiting (requests per minute per tool)
MCP_RATE_LIMIT=30

# Request timeout (milliseconds)
MCP_REQUEST_TIMEOUT_MS=30000

# Maximum input length (characters)
MCP_MAX_INPUT_LENGTH=10000

# Enable/disable audit logging
MCP_ENABLE_AUDIT_LOG=true

# Maximum results returned per query
MCP_MAX_RESULT_LIMIT=200

# Environment (affects error verbosity)
NODE_ENV=production

# Client identification (optional, for enhanced audit trails)
MCP_CLIENT_NAME="Claude Desktop"
MCP_CLIENT_VERSION="0.5.0"
```

### Secure Configuration Checklist

- [ ] Use HTTPS for `GRC_API_BASE_URL` in production
- [ ] Store `GRC_API_TOKEN` securely (never commit to version control)
- [ ] Use short-lived tokens (15 minutes recommended)
- [ ] Rotate tokens regularly
- [ ] Set `NODE_ENV=production` in production environments
- [ ] Enable audit logging (`MCP_ENABLE_AUDIT_LOG=true`)
- [ ] Configure appropriate rate limits for your use case
- [ ] Use environment-specific configuration files
- [ ] Restrict file permissions on configuration files (600)
- [ ] Use secrets management service (e.g., HashiCorp Vault, AWS Secrets Manager)

---

## Best Practices

### Deployment Security

**1. Network Isolation**
- Run MCP server in isolated network segment
- Use firewall rules to restrict access
- Only allow connections from trusted LLM clients
- Consider using VPN or private networks

**2. Principle of Least Privilege**
- Create dedicated service account for MCP server
- Grant minimum required permissions
- Use role-based access control
- Regularly review and audit permissions

**3. Token Management**
- Use short-lived JWT tokens (≤15 minutes)
- Implement token rotation mechanism
- Store tokens in secure credential stores
- Never log or print tokens
- Use different tokens for different environments

**4. Monitoring & Alerting**
- Monitor audit logs for suspicious activity
- Alert on authentication failures
- Alert on rate limit violations
- Track tool usage patterns
- Monitor API error rates

**5. Regular Security Reviews**
- Review audit logs weekly
- Update dependencies monthly
- Review access permissions quarterly
- Conduct penetration testing annually
- Stay updated on OWASP guidelines

### Development Security

**1. Secure Coding Practices**
- Validate all inputs at tool boundaries
- Sanitize data before API calls
- Use parameterized queries (no string concatenation)
- Implement comprehensive error handling
- Never expose internal system details in errors

**2. Testing**
- Test with malicious inputs (fuzzing)
- Test authentication failures
- Test rate limiting enforcement
- Test timeout handling
- Test with expired tokens

**3. Code Review**
- Review all changes for security implications
- Check for hardcoded secrets
- Verify input validation
- Ensure audit logging is present
- Check error message verbosity

### Client Configuration Security

**Claude Desktop Example:**
```json
{
  "mcpServers": {
    "controlweave": {
      "command": "node",
      "args": ["/path/to/mcp-server-secure.js"],
      "env": {
        "GRC_API_BASE_URL": "https://your-backend.com/api/v1",
        "GRC_API_TOKEN": "${CONTROLWEAVE_TOKEN}",
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Security Notes:**
- Use environment variable references (e.g., `${CONTROLWEAVE_TOKEN}`)
- Never hardcode tokens in client configuration
- Restrict file permissions on client config files
- Use full paths to prevent path hijacking

---

## Monitoring & Auditing

### Audit Log Analysis

**Key Metrics to Monitor:**

1. **Authentication Metrics**
   - Total authentication attempts
   - Failed authentication rate
   - Unique users per day
   - Token expiration events

2. **Tool Usage Metrics**
   - Tool invocations per hour
   - Most-used tools
   - Average tool execution time
   - Tool error rates

3. **Security Metrics**
   - Rate limit violations per hour
   - Authentication failures per hour
   - Suspicious input patterns
   - Unusual tool access patterns

4. **Performance Metrics**
   - Request timeout occurrences
   - API response times
   - Tool execution duration trends

### Log Aggregation

**Recommended Setup:**

```bash
# Redirect audit logs to file
node mcp-server-secure.js 2>> /var/log/controlweave/mcp-audit.log

# Rotate logs with logrotate
cat > /etc/logrotate.d/controlweave-mcp << EOF
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

**SIEM Integration:**

Send logs to Security Information and Event Management (SIEM) systems:
- Splunk
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Azure Sentinel
- AWS CloudWatch

### Alerting Rules

**Critical Alerts:**
- 5+ authentication failures from same user in 5 minutes
- 10+ rate limit violations in 1 hour
- Unusual tool access patterns (e.g., admin tools from non-admin user)
- API errors > 10% of requests

**Warning Alerts:**
- Rate limit violations > 5 in 1 hour
- Tool execution time > 20 seconds
- Authentication failures > 10 in 1 day

---

## Incident Response

### Security Incident Procedures

**1. Detection**
- Monitor audit logs for anomalies
- Review security alerts
- Investigate user reports
- Analyze error patterns

**2. Containment**
- Revoke compromised tokens immediately
- Disable affected user accounts
- Block suspicious IP addresses
- Isolate affected systems

**3. Investigation**
- Review audit logs for timeline
- Identify compromised data
- Determine attack vector
- Assess impact scope

**4. Remediation**
- Patch vulnerabilities
- Update security controls
- Rotate credentials
- Restore from clean backups if needed

**5. Recovery**
- Verify system integrity
- Re-enable services incrementally
- Monitor for continued attack
- Conduct post-incident review

**6. Lessons Learned**
- Document incident timeline
- Update security procedures
- Improve detection capabilities
- Train team on findings

### Common Incident Scenarios

**Scenario 1: Token Compromise**
- **Detection:** Unusual tool access from unfamiliar location
- **Response:** Revoke token, force user re-authentication, audit recent activity
- **Prevention:** Implement geo-fencing, require MFA for token generation

**Scenario 2: Rate Limit Abuse**
- **Detection:** Rapid rate limit violations
- **Response:** Temporarily block user, investigate intent, adjust rate limits
- **Prevention:** Implement adaptive rate limiting, CAPTCHA for suspicious activity

**Scenario 3: Prompt Injection Attack**
- **Detection:** Unusual input patterns in audit logs
- **Response:** Block malicious inputs, review tool responses, patch validation
- **Prevention:** Enhanced input sanitization, context-aware validation

---

## Compliance & Standards

### OWASP Alignment

This implementation addresses the following OWASP MCP security guidelines:

✅ **Authentication & Authorization** - JWT validation, RBAC enforcement  
✅ **Input Validation** - Schema validation, sanitization, length limits  
✅ **Output Sanitization** - Data minimization, sensitive field filtering  
✅ **Rate Limiting** - Per-tool request throttling  
✅ **Audit Logging** - Comprehensive activity tracking  
✅ **Error Handling** - Secure error messages, no information leakage  
✅ **Configuration Security** - Environment variables, secure defaults  
✅ **Defense in Depth** - Multiple security layers  

### Regulatory Compliance

**GDPR Considerations:**
- Data minimization in tool responses
- Audit logs for data access tracking
- PII filtering in logs
- Right to access audit trails

**HIPAA Considerations:**
- Access control and authentication
- Audit logging (covered entity requirement)
- Data encryption in transit (HTTPS)
- Minimum necessary access principle

**SOC 2 Considerations:**
- CC6.1: Logical access controls (authentication, authorization)
- CC7.2: System monitoring (audit logging)
- CC7.3: Threat detection and response (alerting)

---

## Migration Guide

### Upgrading from Standard MCP Server

**Step 1: Install Secure Version**
```bash
cd backend/scripts
cp mcp-server.js mcp-server.legacy.js  # Backup
cp mcp-server-secure.js mcp-server.js  # Replace
```

**Step 2: Update Configuration**
```bash
# Add security configuration to .env
cat >> .env << EOF
MCP_RATE_LIMIT=30
MCP_REQUEST_TIMEOUT_MS=30000
MCP_ENABLE_AUDIT_LOG=true
MCP_MAX_RESULT_LIMIT=200
EOF
```

**Step 3: Test Configuration**
```bash
# Verify server starts successfully
GRC_API_BASE_URL=http://localhost:3001/api/v1 \
GRC_API_TOKEN=your-token \
node mcp-server.js
```

**Step 4: Update Client Configuration**
Update MCP client config (e.g., Claude Desktop) to use new server.

**Step 5: Monitor Audit Logs**
```bash
# Watch audit logs for issues
node mcp-server.js 2>&1 | grep AUDIT
```

### Backward Compatibility

The secure MCP server maintains API compatibility with the standard version:
- ✅ All tool names unchanged
- ✅ All tool signatures unchanged
- ✅ Response formats unchanged
- ⚠️ New error responses for rate limiting
- ⚠️ More strict input validation

---

## Security Checklist

### Pre-Deployment Checklist

- [ ] Review and understand threat model
- [ ] Configure all environment variables
- [ ] Set `NODE_ENV=production`
- [ ] Enable audit logging
- [ ] Configure appropriate rate limits
- [ ] Use HTTPS for API endpoints
- [ ] Store tokens in secure credential store
- [ ] Restrict file permissions on scripts and configs
- [ ] Set up log rotation
- [ ] Configure monitoring and alerting
- [ ] Document incident response procedures
- [ ] Train team on security procedures

### Post-Deployment Checklist

- [ ] Verify audit logging is working
- [ ] Test rate limiting enforcement
- [ ] Verify authentication failures are handled correctly
- [ ] Monitor initial usage patterns
- [ ] Review first week of audit logs
- [ ] Confirm alerting is working
- [ ] Conduct security review after 30 days

### Maintenance Checklist (Monthly)

- [ ] Review audit logs for anomalies
- [ ] Check for dependency updates
- [ ] Review and rotate credentials
- [ ] Verify monitoring is functioning
- [ ] Update security documentation
- [ ] Review and adjust rate limits if needed

---

## Additional Resources

- [OWASP Practical Guide for Secure MCP Server Development](https://genai.owasp.org/resource/a-practical-guide-for-secure-mcp-server-development/)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

## Support & Contact

For security concerns or questions:
- Review documentation: `/docs/MCP_SECURITY_GUIDE.md`
- Check audit logs: `grep AUDIT /var/log/controlweave/mcp-audit.log`
- Report security issues: Follow responsible disclosure process
- Contact: Your organization's security team

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-18  
**Next Review:** 2026-05-18
