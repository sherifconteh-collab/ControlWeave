# Code Execution MCP (CE-MCP) Guide

Reference for ControlWeave's Code Execution MCP (CE-MCP) — the MAESTRO
attack-class threat model it defends against, the four-layer security
architecture, configuration, deployment, and operations.

## What is CE-MCP?

Traditional MCP tool-calling has an AI agent make incremental API calls, one
discrete tool invocation at a time, with a security boundary at each call.
**Code Execution MCP (CE-MCP)** is a different mode: the agent generates a
complete program and it executes autonomously, with a single security
boundary at program start rather than per-call.

**Performance benefit** (per MCP-Bench framework testing): 50–70% reduction
in token usage, 40–60% reduction in execution latency, 60–80% reduction in
interaction turns.

**Security trade-off:** the attack surface is an entire program instead of
individual calls — this includes exception-based attacks, authorization
state corruption, and unconstrained resource use that don't exist in
tool-calling mode. ControlWeave addresses this via the **MAESTRO**
(Multi-Agent Execution Security Testing and Research Observatory) framework,
which identifies 16 attack classes specific to code-execution agents.
Reference paper: https://lnkd.in/d5FCiNRG.

CE-MCP is **disabled by default**. Enabling it requires building and
deploying the sandbox container described under [Deployment](#deployment).

---

## The 16 MAESTRO Attack Classes

### Category 1 — Injection attacks

**#1 Exception-Mediated Code Injection** (Critical) — adversarial exception
text induces unauthorized code execution through error-handling paths.
```python
try:
    validate_user(user_id)
except Exception as e:
    # attacker crafts the exception message itself as an injection payload
    log_error(f"Validation failed: {e}")
```
Mitigation: exception message sanitization, structured logging, never
`eval()` on exception text.

**#2 Dynamic Import Injection** (Critical) — malicious code executes via
attacker-controlled dynamic imports.
```python
module_name = user_input  # e.g. "__import__('os').system('rm -rf /')"
imported = __import__(module_name)
```
Mitigation: import whitelist, static analysis, import restrictions.

**#3 String Template Injection** (High) — code executes via template string
manipulation.
```python
template = f"Hello {user_input}"  # e.g. "{__import__('os').system('malicious')}"
```
Mitigation: safe template engines, input sanitization, no `eval()` in
templates.

**#4 Serialization Injection** (Critical) — code executes via deserializing
untrusted data.
```python
import pickle
data = pickle.loads(user_input)  # malicious pickle payload
```
Mitigation: never deserialize untrusted data, use JSON not pickle, signature
verification.

### Category 2 — Authorization attacks

**#5 Authorization State Corruption** (Critical) — authorization context is
manipulated to escalate privileges without a sandbox escape.
```python
try:
    check_permission()
except:
    user_role = "admin"  # state corruption via exception handling
```
Mitigation: immutable authorization context, state integrity checks,
principle of least privilege.

**#6 Context Privilege Escalation** (High) — privileges escalate within the
execution context.
```python
if user.role == "user":
    user.role = "admin"  # attacker finds a way to mutate this
```
Mitigation: immutable user context, read-only credentials, periodic context
verification.

**#7 Token Manipulation** (High) — authentication tokens are tampered with
inside the execution context.
```python
token_parts = token.split('.')
payload = base64_decode(token_parts[1])
payload['role'] = 'admin'
```
Mitigation: token verification at each critical operation, cryptographic
signing, no client-side token modification.

### Category 3 — Resource attacks

**#8 Computational Resource Exhaustion** (High) — excessive CPU consumption.
Mitigation: execution time limits, CPU quotas, complexity analysis.

**#9 Memory Exhaustion** (High) — excessive memory allocation.
Mitigation: memory limits, object size limits, heap monitoring.

**#10 Storage Exhaustion** (Medium) — disk space exhaustion via excessive
writes. Mitigation: disk quotas, temporary file limits, write monitoring.

### Category 4 — Data exfiltration attacks

**#11 Covert Channel Exfiltration** (Medium) — data leaks through timing or
error side channels.
Mitigation: timing normalization, output monitoring, network isolation.

**#12 Logging-Based Exfiltration** (Medium) — sensitive data leaks through
log messages, e.g. `logger.info(f"Processing user: {sensitive_data}")`.
Mitigation: log sanitization, sensitive-data detection, log access controls.

**#13 Return Value Exfiltration** (Low) — sensitive data leaks through
function return values that should have been filtered.
Mitigation: output sanitization, data minimization, allowlist filtering.

### Category 5 — Sandbox escape attacks

**#14 Subprocess Escape** (Critical) — breaks isolation via subprocess
execution (`subprocess.call(['bash', '-c', 'malicious command'])`).
Mitigation: disable subprocess execution, syscall restrictions, seccomp
filters.

**#15 File System Escape** (High) — breaks isolation via filesystem access
outside the sandbox (e.g. reading `/etc/passwd`).
Mitigation: chroot/container isolation, filesystem restrictions, path
validation.

**#16 Network Escape** (High) — breaks isolation via network access to
exfiltrate data or establish command-and-control.
Mitigation: network isolation, egress filtering, URL allowlisting.

### Compliance mapping

| MAESTRO classes | NIST 800-53 | ISO 27001 | OWASP Agentic AI |
|---|---|---|---|
| #1–4 (Injection) | SI-10 | A.14.2.9 | AGENT04, AGENT08 |
| #5–7 (Authorization) | AC-6, IA-5 | A.9.2.3 | AGENT01 |
| #8–10 (Resource) | SC-5 | A.12.1.3 | AGENT10 |
| #11–13 (Exfiltration) | SC-4, AU-9 | A.13.1.3 | AGENT09 |
| #14–16 (Sandbox) | SC-7 | A.13.1.3 | AGENT02 |

---

## Security Architecture

Four layers, applied in order on every code-execution request:

```
AI Agent Request
      │
      ▼
Layer 1: Static Validation & Semantic Gating
  • AST analysis · pattern detection · intent verification · permission checking
      │ approved
      ▼
Layer 2: Containerized Sandbox
  • isolated container · read-only FS · no network · seccomp restrictions
      │
      ▼
Layer 3: Runtime Monitoring
  • resource limits enforced · syscall monitoring · behavior analysis · exception tracking
      │
      ▼
Layer 4: Output Sanitization
  • sensitive-data filtering · PII redaction · result validation · size limits
      │
      ▼
Sanitized Result
```

| Layer | Time | Covers attack classes |
|---|---|---|
| 1. Static validation | ~50ms | #1–4, #14–16 |
| 1. Semantic gating | ~200ms | #5–7, #11–13 |
| 2. Sandbox execution | ~500ms | #8–10, #14–16 |
| 3. Runtime monitoring | ~10ms | (cross-cutting) |
| 4. Output sanitization | ~20ms | #1, #11–13 |
| **Total overhead** | **~780ms** | 16/16 |

### Layer 1a: Static Code Validator

`src/services/ce-mcp/static-validator.js` — parses generated code into an
AST (JavaScript) or uses pattern-based analysis (Python), enforces
complexity limits, and generates a security report before anything runs.

**Blocked patterns:** `subprocess`, `os.system`, `exec`, `eval`,
`__import__`/dynamic imports, `pickle`/`marshal`, `socket`/`http` (network
access), `open()` with paths outside `/tmp`.

**Complexity limits:** max nesting depth 4, max loop iterations 1000
(static analysis), max function calls 50, max code size 10KB.

### Layer 1b: Semantic Gating Engine

`src/services/ce-mcp/semantic-gate.js` — validates code against its stated
intent and permission boundaries before execution.

**Gate rules:**
1. Intent alignment — code must match the stated purpose (keyword-based
   similarity)
2. Permission boundary — code can only touch authorized resources
3. Data pattern — data access must follow expected patterns (flags bulk
   extraction)
4. Resource estimate — estimated resource use must be within configured
   limits

### Layer 2: Sandbox Manager

`src/services/ce-mcp/sandbox-manager.js` — creates a Docker container per
execution, enforces resource limits, manages the container lifecycle.

Container base: `node:20-alpine` (~150MB image), non-root user (UID 10000),
Node.js 20 + Python 3.11+.

```dockerfile
FROM python:3.11-alpine
RUN adduser -D -u 10000 sandbox
USER sandbox
WORKDIR /sandbox
VOLUME ["/tmp"]          # only writable path
CMD ["python", "-u", "script.py"]
```

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
  controlweave/ce-mcp-sandbox:latest
```

### Layer 3 & 4: Exception Sanitizer + Audit Logger

`src/services/ce-mcp/exception-sanitizer.js` — removes SQL/code snippets and
file paths from exception text, strips stack traces in production, and
detects authorization-corruption patterns before an exception message ever
reaches a log or a response. <10ms per exception.

`src/services/ce-mcp/audit-logger.js` — logs `code_execution_requested`
(with a code hash, not the code itself), `static_validation_passed/failed`,
`semantic_gate_passed/failed`, `sandbox_created`, `execution_started`,
`execution_completed` (duration, exit code), `resource_limit_exceeded`,
`suspicious_behavior_detected`, `output_sanitized`. ~3ms per entry. Maps to
NIST 800-53 AU-2, AU-3, AU-12.

### Coordinator

`src/services/ce-mcp/coordinator.js` orchestrates the four layers in
sequence (static → semantic → sandbox → output) and owns rate limiting
(10/hour, 50/day by default).

```javascript
const { CEMCPCoordinator } = require('./src/services/ce-mcp');

const coordinator = new CEMCPCoordinator({
  enabled: true,
  staticValidationEnabled: true,
  semanticGatingEnabled: true,
  sandboxType: 'docker',
  rateLimitPerHour: 10,
  rateLimitPerDay: 50
});

const result = await coordinator.executeCode({
  code: 'console.log("Hello, World!");',
  language: 'javascript',
  statedIntent: 'Print a greeting message',
  userContext: { userId: 'user-123', organizationId: 'org-456', role: 'user' }
});

if (result.success) {
  console.log('Output:', result.output);
} else if (result.blocked) {
  console.log('Blocked:', result.reason, result.findings);
} else {
  console.error('Error:', result.error);
}
```

---

## Configuration

```bash
# Feature toggle
CEMCP_ENABLED=true

# Static validation
CEMCP_STATIC_VALIDATION_ENABLED=true
CEMCP_MAX_CODE_SIZE=10240
CEMCP_MAX_NESTING_DEPTH=4
CEMCP_MAX_FUNCTION_CALLS=50

# Semantic gating
CEMCP_SEMANTIC_GATING_ENABLED=true
CEMCP_INTENT_SIMILARITY_THRESHOLD=0.7

# Sandbox
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

# Audit logging
CEMCP_AUDIT_LOG_ENABLED=true
CEMCP_AUDIT_LOG_PATH=/var/log/controlweave/ce-mcp-audit.log

# Rate limiting (stricter than plain tool calls, by design)
CEMCP_RATE_LIMIT_PER_HOUR=10
CEMCP_RATE_LIMIT_PER_DAY=50

NODE_ENV=production
```

**Development (relaxed) overrides**, for local iteration only:
```bash
CEMCP_RATE_LIMIT_PER_HOUR=50
CEMCP_VERBOSE_ERRORS=true
CEMCP_CPU_LIMIT=1.0
CEMCP_MEMORY_LIMIT=512m
CEMCP_TIME_LIMIT=60
```

---

## Deployment

### Pre-deployment requirements

- [ ] Docker Engine 20.10+ (`docker version`)
- [ ] Node.js 18+ (`node --version`)
- [ ] System resources: 2 CPU / 2GB RAM minimum, 4+ CPU / 4GB+ RAM
      recommended, 2GB disk for images + 1GB per active sandbox
- [ ] Security review completed (code review, CodeQL scan, penetration test
      if applicable)
- [ ] Compliance review (GDPR/HIPAA/SOC 2 as applicable to your deployment)
- [ ] Incident response plan documented (contacts, escalation, forensics)

### Installation

**1. Build and verify the sandbox container:**
```bash
cd controlweave/backend/docker/ce-mcp-sandbox
docker build -t controlweave/ce-mcp-sandbox:latest .
docker image inspect controlweave/ce-mcp-sandbox:latest   # expect ~150MB

docker run --rm controlweave/ce-mcp-sandbox:latest node -e "console.log('Node.js works')"
docker run --rm controlweave/ce-mcp-sandbox:latest python3 -c "print('Python works')"
docker run --rm \
  --read-only --tmpfs /tmp:size=100m --network none \
  --cpus=0.5 --memory=256m --pids-limit=1 \
  --security-opt=no-new-privileges --cap-drop=ALL \
  controlweave/ce-mcp-sandbox:latest \
  node -e "console.log('Secure sandbox works')"
```

**2. Configure environment variables** — see [Configuration](#configuration)
above, added to `.env`.

**3. Set up audit logging:**
```bash
sudo mkdir -p /var/log/controlweave
sudo chown $(whoami):$(whoami) /var/log/controlweave
sudo chmod 755 /var/log/controlweave

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
```

**4. Run the security test suite:**
```bash
cd controlweave/backend
npm run test:ce-mcp-security
# Expect: Tests Passed: 22, Tests Failed: 0, all 16 MAESTRO attack classes covered
```

**5. Integration test** against a running backend (`npm run dev` in one
terminal, then exercise `CEMCPCoordinator.executeCode(...)` from another —
see the Coordinator example above).

### Post-deployment verification

- [ ] Static validation blocks known-bad patterns (`eval`, subprocess,
      network access) — confirm via `npm run test:ce-mcp-security`
- [ ] Semantic gating detects intent mismatches
- [ ] Sandbox isolation holds: `docker ps -a | grep sandbox` shows properly
      scoped containers; a sandboxed network call fails
      (`--network none ... require('http').get(...)` should error); a
      sandboxed filesystem write outside `/tmp` fails under `--read-only`
- [ ] Audit log is being written (`tail -f /var/log/controlweave/ce-mcp-audit.log`)
- [ ] Rate limiting enforces the configured thresholds
- [ ] `docker stats --no-stream` confirms resource limits are actually
      applied, not just configured

### Monitoring setup

- Aggregate CE-MCP audit logs into your SIEM/log stack (ELK, Splunk,
  CloudWatch) and build dashboards for execution count, failure rate,
  average execution time, resource usage, security events
- Alerting: critical on 5+ static validation failures / 10 min, 3+ semantic
  gate rejections / 10 min, any sandbox escape attempt, 10+ resource-limit
  violations / hour; warning on execution time > 25s or memory > 200MB
  (approaching the 30s/256MB limits)

### Rollout

Roll out in phases rather than flipping the flag globally:

1. **Internal testing** — enable for internal test accounts only, monitor
   audit logs daily, tune rate limits from real usage
2. **Beta** — enable opt-in for a limited user cohort, monitor security
   events and performance metrics, adjust resource limits
3. **General availability** — enable broadly per your own rollout policy;
   note that ControlWeave itself no longer has paid tiers (see
   `.claude/rules/tier-system.md`) — any tier-gated rollout language from
   earlier drafts of this feature (e.g. "Pro tier opt-in", "Enterprise
   default-on") predates that change and no longer applies. Gate rollout by
   whatever cohort mechanism you actually have (org allowlist, feature
   flag), not by tier.
4. **Ongoing** — weekly audit log review, monthly security metrics review,
   quarterly penetration testing, continuous tuning based on findings

### Rollback

```bash
# 1. Disable immediately
echo "CEMCP_ENABLED=false" # set in .env

# 2. Restart
pm2 restart backend   # or your process manager

# 3. Verify
curl http://localhost:3001/api/v1/cemcp/status   # expect {"enabled": false}
```
Then investigate (audit logs, error logs, metrics, root cause) and
communicate with security/stakeholders before re-enabling.

### Load and latency testing

- Load test with concurrent executions to confirm the system degrades
  gracefully under load
- Latency: expect ~780ms security overhead plus actual execution time
- Watch CPU/memory/disk during peak load (`htop`, `docker stats`)

### Ongoing maintenance

- **Daily:** audit log anomaly check, active sandbox count, security alerts
- **Weekly:** audit log statistics, rate-limit violations, Docker disk usage
- **Monthly:** update the base Docker image, review/tune configuration,
  check dependency updates, review security metrics
- **Quarterly:** formal security review, documentation refresh, incident
  procedure review, load testing

---

## Incident Response

**Sandbox escape detected**
1. Immediate: disable CE-MCP globally, kill all active containers, preserve
   audit logs, alert the security team
2. Investigate: analyze audit logs, review the code that escaped, identify
   the vulnerability, assess impact
3. Remediate: patch the vulnerability, update security controls, rebuild the
   sandbox image, re-test thoroughly
4. Recover: deploy the patched version, re-enable CE-MCP, monitor closely
   for 48 hours, conduct a post-mortem

**Authorization state corruption detected**
1. Immediate: revoke affected user tokens, disable CE-MCP for the affected
   organization, audit all actions by the affected user, alert security
2. Investigate: analyze exception logs, review the authorization flow,
   identify the corruption vector, assess data exposure
3. Remediate: fix authorization state management, add integrity checks,
   update semantic gating rules, deploy the fix
4. Recover: force re-authentication, re-enable CE-MCP, monitor 24 hours,
   document the incident

**Resource exhaustion attack**
1. Immediate: terminate running containers, reduce rate limits
2. Investigate: identify the source, review code patterns
3. Remediate: tune resource limits, update validation
4. Recover: restore normal rate limits gradually

**Data exfiltration detected**
1. Immediate: disable CE-MCP, preserve logs
2. Investigate: identify exfiltrated data, assess impact
3. Remediate: notify affected parties per your incident policy, enhance
   output filtering
4. Recover: conduct a security review before re-enabling

---

## Compliance & Best Practices

**GDPR** — data minimization in code execution, purpose limitation via
semantic gating, comprehensive audit logs, user consent for code execution.

**HIPAA** — access controls (authorization checks), audit controls (CE-MCP
logging), integrity controls (output sanitization), PHI protection (PII
detection).

**SOC 2** — CC6.1 (logical access controls), CC6.6 (authorization
enforcement), CC7.2 (system monitoring), CC7.3 (threat detection/response),
CC8.1 (change management via code review).

**Principles applied throughout:**
- Least privilege — no root, minimal filesystem access, no network by
  default
- Defense in depth — multiple independent layers, fail-safe defaults,
  redundant controls
- Secure by default — CE-MCP ships disabled; all security features are on
  when it's enabled; conservative resource limits and strict validation are
  the starting point, not an opt-in
- Continuous improvement — track new attack patterns, update validation
  rules and semantic gates, tune resource limits over time

---

## Performance

| Security layer | Time added |
|---|---|
| Static validation | ~50ms |
| Semantic gating | ~200ms |
| Container creation | ~500ms |
| Runtime monitoring | ~10ms |
| Output sanitization | ~20ms |
| **Total overhead** | **~780ms** |

| Metric | Traditional MCP | CE-MCP (secured) | Change |
|---|---|---|---|
| Token usage | 100% | 35% | -65% |
| Latency | 100% | 60% | -40% |
| Interaction turns | 100% | 25% | -75% |
| Security overhead | ~50ms/call | ~780ms/execution | +1460% in absolute terms |

Net effect: even with full security overhead, CE-MCP is still 40–60% faster
end-to-end than traditional tool-calling MCP for complex, multi-step tasks —
the per-execution security cost is more than offset by eliminating the
per-call round trips traditional MCP requires.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Docker not available | `docker version` to check; install via `curl -fsSL https://get.docker.com \| sh` |
| Sandbox image missing | `cd controlweave/backend/docker/ce-mcp-sandbox && docker build -t controlweave/ce-mcp-sandbox:latest .` then `docker image inspect ...` to verify |
| Rate limit exceeded | Check actual usage first; if legitimate, raise `CEMCP_RATE_LIMIT_PER_HOUR` / `CEMCP_RATE_LIMIT_PER_DAY` |
| Static validation failing on legitimate code | Inspect `result.findings`; common causes are `eval()` usage (remove or use a safer alternative), subprocess calls (not permitted in CE-MCP), or network access (use local operations only) |

---

## Testing

```bash
cd controlweave/backend
npm run test:ce-mcp-security
```
22 test cases across static validation, semantic gating, exception
sanitization, audit logging, sandbox management, and coordinator/rate-limit
behavior, covering all 16 MAESTRO attack classes end to end.

## References

- MAESTRO Framework Paper: https://lnkd.in/d5FCiNRG
- MCP-Bench Framework: https://github.com/mcp-bench/mcp-bench
- OWASP Container Security: https://owasp.org/www-project-container-security/
- Docker Security Best Practices: https://docs.docker.com/engine/security/
- Seccomp Profiles: https://docs.docker.com/engine/security/seccomp/

## Support

- Security issues: review this guide, check
  `/var/log/controlweave/ce-mcp-audit.log`, run
  `npm run test:ce-mcp-security`, then follow your organization's
  responsible-disclosure process
- General issues: review the Troubleshooting section above, check CE-MCP
  audit logs, then contact your support/platform team
