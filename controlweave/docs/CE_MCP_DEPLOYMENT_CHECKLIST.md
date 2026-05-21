# CE-MCP Deployment Checklist

## Pre-Deployment Requirements

### System Requirements

- [ ] **Docker installed and running**
  ```bash
  docker version
  # Required: Docker Engine 20.10+
  ```

- [ ] **Sufficient system resources**
  - Minimum: 2 CPU cores, 2GB RAM
  - Recommended: 4+ CPU cores, 4GB+ RAM
  - Disk space: 2GB for Docker images + 1GB per active sandbox

- [ ] **Node.js 18+ installed**
  ```bash
  node --version
  # Required: v18.0.0 or higher
  ```

### Security Prerequisites

- [ ] **Security review completed**
  - Code review passed
  - Security scan passed (CodeQL)
  - Penetration testing completed (if applicable)

- [ ] **Compliance review**
  - GDPR compliance verified
  - HIPAA compliance verified (if applicable)
  - SOC 2 controls reviewed

- [ ] **Incident response plan documented**
  - Security team contact information
  - Escalation procedures
  - Forensics procedures

## Installation Steps

### Step 1: Build Sandbox Container

```bash
cd controlweave/backend/docker/ce-mcp-sandbox
docker build -t controlweave/ce-mcp-sandbox:latest .

# Verify build
docker image inspect controlweave/ce-mcp-sandbox:latest
```

**Expected output:** Image details with size ~150MB

### Step 2: Test Sandbox Container

```bash
# Test Node.js
docker run --rm controlweave/ce-mcp-sandbox:latest node -e "console.log('Node.js works')"

# Test Python
docker run --rm controlweave/ce-mcp-sandbox:latest python3 -c "print('Python works')"

# Test with full security restrictions
docker run --rm \
  --read-only \
  --tmpfs /tmp:size=100m \
  --network none \
  --cpus=0.5 \
  --memory=256m \
  --pids-limit=1 \
  --security-opt=no-new-privileges \
  --cap-drop=ALL \
  controlweave/ce-mcp-sandbox:latest \
  node -e "console.log('Secure sandbox works')"
```

**Expected:** All commands execute successfully

### Step 3: Configure Environment Variables

Edit `.env` file:

```bash
# CE-MCP Feature Toggle
CEMCP_ENABLED=true

# Static Validation
CEMCP_STATIC_VALIDATION_ENABLED=true
CEMCP_MAX_CODE_SIZE=10240
CEMCP_MAX_NESTING_DEPTH=4
CEMCP_MAX_FUNCTION_CALLS=50

# Semantic Gating
CEMCP_SEMANTIC_GATING_ENABLED=true
CEMCP_INTENT_SIMILARITY_THRESHOLD=0.7

# Sandbox Configuration
CEMCP_SANDBOX_TYPE=docker
CEMCP_CONTAINER_IMAGE=controlweave/ce-mcp-sandbox:latest
CEMCP_CPU_LIMIT=0.5
CEMCP_MEMORY_LIMIT=256m
CEMCP_DISK_LIMIT=100m
CEMCP_TIME_LIMIT=30
CEMCP_NETWORK_ENABLED=false

# Security
CEMCP_ALLOW_SUBPROCESS=false
CEMCP_ALLOW_NETWORK=false
CEMCP_ALLOW_FILE_WRITE=true
CEMCP_WRITABLE_PATHS=/tmp

# Audit Logging
CEMCP_AUDIT_LOG_ENABLED=true
CEMCP_AUDIT_LOG_PATH=/var/log/controlweave/ce-mcp-audit.log

# Rate Limiting
CEMCP_RATE_LIMIT_PER_HOUR=10
CEMCP_RATE_LIMIT_PER_DAY=50

# Node environment
NODE_ENV=production
```

### Step 4: Set Up Audit Logging

```bash
# Create log directory
sudo mkdir -p /var/log/controlweave
sudo chown $(whoami):$(whoami) /var/log/controlweave
sudo chmod 755 /var/log/controlweave

# Configure log rotation
sudo cat > /etc/logrotate.d/controlweave-ce-mcp << 'EOF'
/var/log/controlweave/ce-mcp-audit.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 controlweave controlweave
    sharedscripts
}
EOF

# Test log writing
echo '{"test": "log entry"}' >> /var/log/controlweave/ce-mcp-audit.log
cat /var/log/controlweave/ce-mcp-audit.log
```

### Step 5: Run Security Test Suite

```bash
cd controlweave/backend
npm run test:ce-mcp-security
```

**Expected output:**
```
Tests Passed: 22
Tests Failed: 0

✓ All tests passed!

MAESTRO Attack Classes Coverage:
✓ #1-#16: All attack classes mitigated
```

### Step 6: Integration Testing

```bash
# Start backend server
npm run dev

# In another terminal, test CE-MCP execution
node -e "
const { CEMCPCoordinator } = require('./src/services/ce-mcp');

const coordinator = new CEMCPCoordinator({
  enabled: true,
  staticValidationEnabled: true,
  semanticGatingEnabled: true
});

(async () => {
  const result = await coordinator.executeCode({
    code: 'console.log(\"Hello from CE-MCP\")',
    language: 'javascript',
    statedIntent: 'test CE-MCP',
    userContext: {
      userId: 'test-user',
      organizationId: 'test-org',
      role: 'user'
    }
  });
  
  console.log('Result:', result);
})();
"
```

## Post-Deployment Verification

### Verify Core Functionality

- [ ] **Static validation working**
  ```bash
  # Should block this code
  npm run test:ce-mcp-security | grep "StaticValidator: Detects eval"
  ```

- [ ] **Semantic gating working**
  ```bash
  # Should detect intent mismatches
  npm run test:ce-mcp-security | grep "SemanticGate"
  ```

- [ ] **Sandbox isolation working**
  ```bash
  # Verify containers are properly isolated
  docker ps -a | grep sandbox
  ```

- [ ] **Audit logging working**
  ```bash
  tail -f /var/log/controlweave/ce-mcp-audit.log
  # Should see CEMCP AUDIT entries
  ```

- [ ] **Rate limiting working**
  ```bash
  # Test rate limit enforcement
  npm run test:ce-mcp-security | grep "Rate limiting"
  ```

### Security Verification

- [ ] **No network access from sandbox**
  ```bash
  # This should fail
  docker run --rm \
    --network none \
    controlweave/ce-mcp-sandbox:latest \
    node -e "require('http').get('http://google.com')"
  ```

- [ ] **No subprocess execution**
  ```bash
  # This should be blocked by static validator
  ```

- [ ] **File system is read-only**
  ```bash
  # This should fail (except in /tmp)
  docker run --rm \
    --read-only \
    controlweave/ce-mcp-sandbox:latest \
    node -e "require('fs').writeFileSync('/test.txt', 'data')"
  ```

- [ ] **Resource limits enforced**
  ```bash
  # Check Docker resource limits
  docker stats --no-stream
  ```

### Monitoring Setup

- [ ] **Set up log aggregation**
  - Configure ELK Stack / Splunk / CloudWatch
  - Index CE-MCP audit logs
  - Set up dashboards

- [ ] **Configure alerting rules**
  - Critical: 5+ static validation failures in 10 min
  - Critical: 3+ semantic gate rejections in 10 min
  - Critical: Any sandbox escape attempt
  - Warning: Execution time > 25s
  - Warning: Memory usage > 200MB

- [ ] **Set up monitoring dashboards**
  - Execution count over time
  - Failure rate
  - Average execution time
  - Resource usage
  - Security events

### Performance Testing

- [ ] **Load testing**
  ```bash
  # Test with concurrent executions
  # Verify system handles load gracefully
  ```

- [ ] **Latency testing**
  ```bash
  # Measure end-to-end execution time
  # Expected: ~780ms overhead + execution time
  ```

- [ ] **Resource utilization**
  ```bash
  # Monitor CPU, memory, disk during peak load
  htop
  docker stats
  ```

## Production Rollout

### Phase 1: Internal Testing (Week 1)

- [ ] Enable CE-MCP for internal test accounts only
- [ ] Monitor audit logs daily
- [ ] Collect feedback from internal users
- [ ] Tune rate limits based on usage

### Phase 2: Beta Release (Week 2-3)

- [ ] Enable for Pro tier users (opt-in)
- [ ] Monitor security events
- [ ] Track performance metrics
- [ ] Adjust resource limits if needed

### Phase 3: General Availability (Week 4)

- [ ] Enable for all Enterprise tier users
- [ ] Enable for Pro tier (default on)
- [ ] Keep disabled for Free/Starter tiers
- [ ] Announce feature to users

### Phase 4: Monitoring & Optimization (Ongoing)

- [ ] Weekly audit log review
- [ ] Monthly security metrics review
- [ ] Quarterly penetration testing
- [ ] Continuous improvement based on findings

## Rollback Procedure

If issues are encountered:

1. **Immediate:** Disable CE-MCP
   ```bash
   # In .env
   CEMCP_ENABLED=false
   ```

2. **Restart backend**
   ```bash
   pm2 restart backend  # or your process manager
   ```

3. **Verify rollback**
   ```bash
   # Check that CE-MCP is disabled
   curl http://localhost:3001/api/v1/cemcp/status
   # Should return: {"enabled": false}
   ```

4. **Investigate issue**
   - Review audit logs
   - Check error logs
   - Analyze metrics
   - Identify root cause

5. **Communicate with stakeholders**
   - Notify security team
   - Update incident tracker
   - Document lessons learned

## Security Incident Procedures

### Sandbox Escape Detected

1. **Immediate action:**
   - Disable CE-MCP globally
   - Kill all active containers
   - Preserve audit logs
   - Alert security team

2. **Investigation:**
   - Analyze audit logs
   - Review code that escaped
   - Identify vulnerability
   - Assess impact

3. **Remediation:**
   - Patch vulnerability
   - Update security controls
   - Rebuild sandbox image
   - Re-test thoroughly

4. **Recovery:**
   - Deploy patched version
   - Re-enable CE-MCP
   - Monitor closely for 48 hours
   - Conduct post-mortem

### Authorization Corruption Detected

1. **Immediate action:**
   - Revoke affected user tokens
   - Disable CE-MCP for affected organization
   - Audit all actions by affected user
   - Alert security team

2. **Investigation:**
   - Analyze exception logs
   - Review authorization flow
   - Identify corruption vector
   - Assess data exposure

3. **Remediation:**
   - Fix authorization state management
   - Add integrity checks
   - Update semantic gating rules
   - Deploy fix

4. **Recovery:**
   - Force re-authentication
   - Re-enable CE-MCP
   - Monitor for 24 hours
   - Document incident

## Maintenance Tasks

### Daily
- [ ] Check audit logs for anomalies
- [ ] Monitor active sandbox count
- [ ] Review security alerts

### Weekly
- [ ] Review audit log statistics
- [ ] Check rate limit violations
- [ ] Verify Docker disk usage

### Monthly
- [ ] Update base Docker image
- [ ] Review and tune configuration
- [ ] Check for dependency updates
- [ ] Review security metrics

### Quarterly
- [ ] Conduct security review
- [ ] Update documentation
- [ ] Review incident procedures
- [ ] Perform load testing

## Support Contacts

**Security Team:**
- Email: security@yourcompany.com
- Slack: #security-incidents
- On-call: (555) 123-4567

**DevOps Team:**
- Email: devops@yourcompany.com
- Slack: #devops
- On-call: (555) 123-4568

**Product Team:**
- Email: product@yourcompany.com
- Slack: #product

## Additional Resources

- **Full Documentation:** `/controlweave/docs/CE_MCP_SECURITY_GUIDE.md`
- **Quick Reference:** `/controlweave/docs/CE_MCP_SECURITY_QUICKREF.md`
- **Test Suite:** `npm run test:ce-mcp-security`
- **MAESTRO Paper:** https://lnkd.in/d5FCiNRG

---

**Deployment Checklist Version:** 1.0  
**Last Updated:** 2026-02-19  
**Next Review:** 2026-03-19
