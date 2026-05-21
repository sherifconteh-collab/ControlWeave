# 🎭 ControlWeave AI Agent Specialists

> **Specialized AI agents tailored for the ControlWeave GRC platform** — from backend architects who enforce multi-tenant SQL isolation to compliance specialists fluent in 15+ regulatory frameworks. Each agent encodes ControlWeave's actual conventions, patterns, and workflows.

Adapted from [The Agency](https://github.com/msitarzewski/agency-agents) by [@msitarzewski](https://github.com/msitarzewski) (MIT License). See [LICENSE](./LICENSE) for details.

---

## 🏛️ Architecture — Internal vs External Agents

ControlWeave runs two classes of agents on different platforms, each optimized for its workload:

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                        │
│  .openclaw/agents/          Agent persona definitions (*.md)    │
│  .openclaw/orchestrator/    Orchestrator + audit logging        │
│  .github/workflows/         CI/CD + orchestrator status check   │
├─────────────────────────┬───────────────────────────────────────┤
│   Railway (24/7 process)│   GitHub Actions (scheduled)          │
│                         │                                       │
│  EXTERNAL AGENTS        │   CI/CD WORKFLOWS                     │
│  ─────────────────      │   ──────────────                      │
│  GTM SOPs 1-12          │   CodeQL scanning                     │
│  Email polling (IMAP)   │   Security reports                    │
│  LinkedIn/Buffer        │   Wiki sync & health                  │
│  Outbound pipeline      │   CM branch naming                    │
│                         │   Release notes                       │
│  INTERNAL AGENTS        │                                       │
│  ─────────────────      │   ORCHESTRATOR STATUS                 │
│  Security Engineer  ⚡   │   ────────────────────                │
│  API Tester         ⚡   │   Daily health check of Railway       │
│  DevOps Engineer    ⚡   │   Audit summary dashboard             │
│  Accountant         ⚡   │   Agent file verification             │
│  Compliance         ⚡   │                                       │
│  Config Manager     ⚡   │                                       │
│  CISO               ⚡   │                                       │
│  Audit Readiness    ⚡   │                                       │
│  Evidence Collector ⚡   │                                       │
│  Project Shepherd   ⚡   │                                       │
│  Chief of Staff     ⚡   │                                       │
└─────────────────────────┴───────────────────────────────────────┘
```

### Why Railway for All Agents?

All automated agents (⚡) run on the **Railway orchestrator** rather than GitHub Actions because:

| Concern | Railway Orchestrator | GitHub Actions |
|---------|---------------------|----------------|
| **Tool access** | ✅ Full: Claude API, Slack, GitHub, MCP, Gmail, Sheets, Buffer | ⚠️ Limited: no persistent tool connections |
| **Audit logging** | ✅ AU-2 JSON Lines with session tracking | ⚠️ Would need separate implementation |
| **State** | ✅ Persistent process, in-memory caches | ❌ Stateless runners, cold start each run |
| **Cost** | ✅ Single Railway process for all agents | ⚠️ Per-minute billing, matrix jobs add up |
| **Coordination** | ✅ Agents share context, batch results | ❌ Isolated jobs, no shared state |
| **Scheduling** | ✅ Granular cron (every 30 min for Closer) | ⚠️ Minimum 5-min intervals, often delayed |

### GitHub Actions Bridge

A [status workflow](../../.github/workflows/agent-orchestrator-status.yml) runs daily on GitHub Actions to:
- ✅ Verify the Railway orchestrator is healthy
- ✅ Pull today's agent audit summary into GitHub
- ✅ Validate all agent persona files are present
- ✅ Post a status dashboard to the workflow run summary

To enable: set the `ORCHESTRATOR_URL` repository secret (e.g., `https://openclaw-orchestrator.up.railway.app`).

---

## 🚀 Quick Start

Each agent file is a standalone Markdown personality definition. Use them with Claude Code, Cursor, or any AI coding tool that supports agent/persona files:

```bash
# Copy all agent persona files (including subdirectories) to Claude Code agents directory
cp -r .openclaw/agents/*/ ~/.claude/agents/

# Or reference directly in a Claude session:
# "Use the ControlWeave Backend Architect agent to review this Express.js route"
```

### Automated Operation

Agents marked with ⚡ run automatically via the OpenClaw orchestrator on Railway. The orchestrator injects each agent persona into the user message (not the system prompt) when calling the underlying Claude API and executes scheduled maintenance tasks. All activity is tracked via AU-2 aligned audit logging.

```bash
# Start the orchestrator (runs all GTM SOPs + maintenance agents)
cd .openclaw/orchestrator && npm start

# Check audit summary (dev/local when AUDIT_SUMMARY_TOKEN is unset)
curl http://localhost:3000/audit/summary
```

See [Automated Agent Schedules](#-automated-agent-schedules) for the full schedule.

### Adding a New Scheduled Agent (Dynamic Discovery)

Agent schedules are **dynamically discovered** — no code changes needed. To add a new automated agent:

1. **Create the persona** `.md` file in the appropriate division folder:
   ```
   .openclaw/agents/<division>/<agent-name>.md
   ```

2. **Add a companion** `.tasks.json` file next to it:
   ```
   .openclaw/agents/<division>/<agent-name>.tasks.json
   ```

3. **Define one or more tasks** in the `.tasks.json`:
   ```json
   {
     "agentName": "ControlWeave <Your Agent>",
     "tasks": [
        {
          "taskType": "monitoring",
          "taskName": "your-task-name",
          "schedule": "0 9 * * 1-5",
          "instruction": "What the agent should do on each run...",
          "model": "claude-3-5-haiku-latest"
        }
      ]
    }
    ```

   `model` is optional. If omitted, the orchestrator uses `OPENCLAW_GOVERNANCE_MODEL` for Management division agents when set, otherwise `OPENCLAW_MAINTENANCE_MODEL`, otherwise the default `CLAUDE_MODEL`.

4. **Restart the orchestrator** — the task is auto-registered.

The dynamic loader (`dynamic-agent-loader.js`) scans all `.tasks.json` files at startup, validates that companion `.md` personas exist, and registers each task with the cron scheduler. Errors are logged but don't block other agents from loading.

---

## 🏗️ Agent Roster

### 💻 Engineering Division

| Agent | File | Specialty | Auto |
|-------|------|-----------|------|
| 🏗️ [Backend Architect](engineering/cw-backend-architect.md) | `cw-backend-architect.md` | Express.js, PostgreSQL (raw SQL), JWT auth, multi-tenant isolation | |
| 🎨 [Frontend Developer](engineering/cw-frontend-developer.md) | `cw-frontend-developer.md` | Next.js 16+, TypeScript, React, Tailwind CSS, tier-aware UI | |
| 🤖 [AI Engineer](engineering/cw-ai-engineer.md) | `cw-ai-engineer.md` | Multi-provider LLM integration, BYOK, AI copilot, compliance prompts | |
| 🔒 [Security Engineer](engineering/cw-security-engineer.md) | `cw-security-engineer.md` | JWT hardening, SQL injection prevention, TOTP/passkey 2FA, audit logging | ⚡ |
| 🚀 [DevOps Engineer](engineering/cw-devops-engineer.md) | `cw-devops-engineer.md` | Railway deployment, nixpacks, PostgreSQL migrations, CI/CD | ⚡ |
| 💳 [Stripe Billing](engineering/cw-stripe-billing.md) | `cw-stripe-billing.md` | Stripe checkout, webhooks, subscription lifecycle, tier-to-plan mapping | |

### 🎨 Design Division

| Agent | File | Specialty | Auto |
|-------|------|-----------|------|
| 🎯 [UI Designer](design/cw-ui-designer.md) | `cw-ui-designer.md` | Compliance dashboards, Tailwind components, data-dense GRC tables | |

### 🧪 Testing Division

| Agent | File | Specialty | Auto |
|-------|------|-----------|------|
| 🔌 [API Tester](testing/cw-api-tester.md) | `cw-api-tester.md` | REST API validation, multi-tenant isolation testing, tier limit verification | ⚡ |
| 📸 [Evidence Collector](testing/cw-evidence-collector.md) | `cw-evidence-collector.md` | Screenshot-based QA, compliance evidence, audit-ready documentation | ⚡ |

### ⚖️ Compliance Division

| Agent | File | Specialty | Auto |
|-------|------|-----------|------|
| 📋 [Compliance Specialist](compliance/cw-compliance-specialist.md) | `cw-compliance-specialist.md` | Multi-framework mapping, crosswalk intelligence, NIST/ISO/SOC 2/GDPR/HIPAA | ⚡ |
| 🗂️ [Configuration Manager](compliance/cw-configuration-manager.md) | `cw-configuration-manager.md` | CM baselines, change control (CCB), CMDB CI tracking, ANSI/EIA-649C/ISO 10007 | ⚡ |
| 🛡️ [CISO](compliance/cw-ciso.md) | `cw-ciso.md` | Security posture, risk scoring, executive reporting, incident response, vendor risk | ⚡ |
| 🔍 [Audit Readiness](compliance/cw-audit-readiness.md) | `cw-audit-readiness.md` | Artifact completeness, evidence sufficiency, PBC tracking, framework-specific checklists | ⚡ |

### 📊 Product Division

| Agent | File | Specialty | Auto |
|-------|------|-----------|------|
| 🎯 [Sprint Prioritizer](product/cw-sprint-prioritizer.md) | `cw-sprint-prioritizer.md` | Feature prioritization, compliance impact scoring, tier value analysis | |

### 📢 Marketing Division

| Agent | File | Specialty | Auto |
|-------|------|-----------|------|
| 📝 [Content Creator](marketing/cw-content-creator.md) | `cw-content-creator.md` | LinkedIn thought leadership, AI governance positioning, truth-standard-compliant | |

### 🎬 Project Management Division

| Agent | File | Specialty | Auto |
|-------|------|-----------|------|
| 🐑 [Project Shepherd](project-management/cw-project-shepherd.md) | `cw-project-shepherd.md` | CM-controlled branches, deploy ordering, cross-team coordination | ⚡ |

### 🏛️ Management Division

| Agent | File | Specialty | Auto |
|-------|------|-----------|------|
| 🧑‍✈️ [Chief of Staff](management/cw-chief-of-staff.md) | `cw-chief-of-staff.md` | Agent governance, guardrail enforcement, daily fleet KPI briefings via Slack | ⚡ |

### 🛟 Support Division

| Agent | File | Specialty | Auto |
|-------|------|-----------|------|
| 💬 [Support Responder](support/cw-support-responder.md) | `cw-support-responder.md` | Demo account support, tier guidance, compliance workflow help | |
| 💰 [Accountant](support/cw-accountant.md) | `cw-accountant.md` | Stripe revenue monitoring, subscriber tracking, churn detection, billing health | ⚡ |

### 🎯 GTM Operations

| Agent | File | Specialty | Auto |
|-------|------|-----------|------|
| 🎭 [OpenClaw Orchestrator](gtm/cw-openclaw-orchestrator.md) | `cw-openclaw-orchestrator.md` | 12-SOP coordination, truth standard enforcement, pipeline management | ⚡ |

---

## ⚡ Automated Agent Schedules

The following agents run automatically via the orchestrator's cron scheduler. Each run is tracked in AU-2 aligned audit logs at `.openclaw/orchestrator/logs/`.

| Agent | Task | Schedule | Type |
|-------|------|----------|------|
| 🔒 Security Engineer | Dependency & security audit | Weekdays 7 AM ET | Monitoring |
| 🔌 API Tester | API health check | Weekdays 8 AM, 12 PM, 5 PM ET | Monitoring |
| 💰 Accountant | Daily billing health | Weekdays 9 AM ET | Monitoring |
| 🔍 Audit Readiness | Artifact completeness check | Wednesdays 10 AM ET | Audit |
| 📋 Compliance Specialist | Framework integrity check | Mondays 10 AM ET | Monitoring |
| 🗂️ Configuration Manager | CM baseline audit | Tuesdays 2 PM ET | Audit |
| 🐑 Project Shepherd | CM discipline check | Wednesdays 11 AM ET | Monitoring |
| 🛡️ CISO | Security posture brief | Thursdays 3 PM ET | Audit |
| 📸 Evidence Collector | Weekly evidence collection | Fridays 11 AM ET | Audit |
| 🚀 DevOps Engineer | Infrastructure health check | Weekdays 7 AM & 1 PM ET | Monitoring |
| 💰 Accountant | Weekly revenue & subscriber report | Fridays 3 PM ET | Audit |
| 🧑‍✈️ Chief of Staff | Daily agent KPI briefing | Weekdays 5:30 PM ET | Monitoring |
| 🧑‍✈️ Chief of Staff | Weekly agent performance review | Fridays 4 PM ET | Audit |
| 🧑‍✈️ Chief of Staff | Approval batch review | Weekdays 12 PM & 5 PM ET | Monitoring |
| 🗂️ Approval Coordinator | Approval batch prep | Weekdays 11:45 AM & 4:45 PM ET | Monitoring |

---

## 📝 Audit Logging

All automated agent activities are logged via AU-2 aligned audit logging, mirroring ControlWeave's own audit patterns.

> Note: agent audit records are stored separately from the app's `audit_logs` table. They capture platform-level agent/task execution detail (`event_type`, agent identity, task context, outcome, error/details, findings, session ID) but do not currently mirror every org/user/IP/resource field used for tenant-scoped application audit events.

### Storage Layers

The audit system writes to **three storage layers simultaneously**:

| Layer | Where | When | Retention |
|-------|-------|------|-----------|
| **PostgreSQL** | `agent_audit_events` table | When `DATABASE_URL` is set | Persistent, queryable |
| **JSON Lines** | `.openclaw/orchestrator/logs/agent-audit-YYYY-MM-DD.jsonl` | Always | Local to Railway instance |
| **Console** | Railway log aggregation | Always | Per Railway log retention |

To enable PostgreSQL persistence, set `DATABASE_URL` in the orchestrator's environment and run migration `092_agent_audit_events.sql` on the ControlWeave database.

### Log Entry Schema
```json
{
  "id": "uuid",
  "timestamp": "2026-03-08T12:00:00.000Z",
  "source_system": "openclaw-orchestrator",
  "event_type": "agent.task.completed",
  "agent_name": "ControlWeave Security Engineer",
  "agent_file": "engineering/cw-security-engineer.md",
  "agent_division": "engineering",
  "task_type": "monitoring",
  "task_name": "security-dependency-audit",
  "session_id": "uuid",
  "duration_ms": 12345,
  "outcome": "success",
  "details": {},
  "findings": []
}
```

### Audit Endpoints
- `GET /health` — Orchestrator health check, including a tiny approval summary (`has_pending`, total pending, and pending counts by approval type) without exposing the full queue
- `GET /audit/summary` — Today's agent activity summary (task counts by agent, success/failure rates). Returns `source: "postgresql"` or `source: "jsonl"` to indicate which storage was queried. In production, this endpoint is disabled unless `AUDIT_SUMMARY_TOKEN` is set and sent as `Authorization: Bearer <token>`.
- `GET /connections/status` — Latest connector check results for Slack, Buffer, GitHub, and the ControlWeave API. Uses the same Bearer token guard as `/audit/summary` when configured.
- `GET /approvals/status` — Pending approval queue snapshot for LinkedIn and GitHub issue drafts, including counts, pending items, incomplete GitHub issue drafts, and the batched review windows. Uses the same Bearer token guard as `/audit/summary` when configured.

### Event Types
| Event | When |
|-------|------|
| `system.orchestrator.startup` | Orchestrator starts |
| `agent.task.started` | Agent task begins execution |
| `agent.task.completed` | Agent task finishes successfully |
| `agent.task.failed` | Agent task encounters an error |
| `system.agent_batch.completed` | Batch of agent tasks completes |

---

## 🎯 ControlWeave-Specific Use Cases

### Building a New Compliance Feature
**Your Team:**
1. 🎯 **Sprint Prioritizer** — Evaluate against compliance impact and tier value
2. 🐑 **Project Shepherd** — Plan branches, migrations, and deploy order
3. 🏗️ **Backend Architect** — Express.js routes with org-scoped SQL
4. 🎨 **Frontend Developer** — Next.js dashboard views with Tailwind
5. 📋 **Compliance Specialist** — Validate framework accuracy and crosswalk mappings
6. 🔌 **API Tester** — Verify multi-tenant isolation and tier limits
7. 📸 **Evidence Collector** — Document proof for audit readiness

### Adding a New AI Analysis Feature
**Your Team:**
1. 🤖 **AI Engineer** — LLM integration with BYOK and provider abstraction
2. 🏗️ **Backend Architect** — API endpoint with tier limit enforcement
3. 🔒 **Security Engineer** — API key handling, input validation
4. 🎨 **Frontend Developer** — Analysis results UI with AI disclaimer
5. 🎯 **UI Designer** — Data presentation and confidence indicators

### Running GTM Operations
**Your Team:**
1. 🎭 **OpenClaw Orchestrator** — Daily SOP execution and pipeline coordination
2. 📝 **Content Creator** — LinkedIn posts with truth standard compliance
3. 💬 **Support Responder** — Demo account provisioning and prospect support

### Stripe Billing Integration
**Your Team:**
1. 💳 **Stripe Billing** — Checkout, webhooks, subscription lifecycle
2. 💰 **Accountant** — Revenue monitoring, churn detection, trial conversion
3. 🏗️ **Backend Architect** — API routes with rate limiting and audit logging

### Continuous Monitoring & Maintenance
**Running 24/7 via orchestrator:**
1. 🔒 **Security Engineer** — Daily dependency and security audits
2. 🔌 **API Tester** — 3x daily API health checks
3. 💰 **Accountant** — Daily billing health + weekly revenue reports
4. 📋 **Compliance Specialist** — Weekly framework integrity checks
5. 🐑 **Project Shepherd** — Weekly CM discipline reviews
6. 📸 **Evidence Collector** — Weekly compliance evidence collection
7. 🚀 **DevOps Engineer** — 2x daily infrastructure health checks

---

## 📖 Design Philosophy

Each ControlWeave agent is designed with:

1. **🎯 Platform-Specific**: Encodes actual ControlWeave conventions, not generic templates
2. **🔒 Security-Aware**: Multi-tenant isolation, parameterized SQL, and JWT patterns built in
3. **⚖️ Compliance-Fluent**: GRC domain knowledge across 15+ regulatory frameworks
4. **📋 Deliverable-Focused**: Concrete templates matching ControlWeave's code style
5. **✅ Truth-Standard-Bound**: All outbound agents enforce `.openclaw/truth-standard.md`
6. **📝 Audit-Logged**: Automated agents tracked via AU-2 aligned logging (same standard as ControlWeave platform)
7. **⚡ Auto-Runnable**: Key agents run on schedules via the orchestrator for continuous maintenance
8. **🔌 Dynamically Discovered**: Add a `.tasks.json` companion file next to any agent persona — the orchestrator auto-registers it at startup with no code changes

---

## ⚖️ AI Governance Compliance Mapping

The agent automation infrastructure is designed to satisfy **NIST AI RMF 1.0** and **EU AI Act** requirements. ControlWeave uses its own platform to track these agents as AI assets — compliance that monitors compliance.

### NIST AI RMF 1.0 Alignment

| NIST AI RMF Function | Subcategory | How Agents Satisfy It |
|----------------------|-------------|----------------------|
| **GOVERN (GV)** | GV.OV — Oversight | Human escalation paths: all agents route critical findings to Sherif Conteh via Slack DM |
| | GV.RM — Risk Management | CISO agent translates compliance gaps → business risk with financial exposure estimates |
| | GV.AT — Accountability | AU-2 audit logs track every agent run with session ID, duration, outcome, and findings |
| **MAP (MP)** | MP.ID — Impact Assessment | Each agent persona declares its scope, data access, and decision boundaries |
| | MP.RS — Risk Classification | Agents classified by task type (monitoring vs. audit) with escalation severity levels |
| **MEASURE (MS)** | MS.MC — Monitoring | 11 automated agents perform continuous monitoring on defined schedules |
| | MS.EV — Evaluation | API Tester runs 3× daily health checks; Security Engineer audits dependencies daily |
| | MS.QA — Quality Assurance | Agent audit summary endpoint tracks success/failure rates per agent per day |
| **MANAGE (MG)** | MG.AI — Risk Responses | Findings posted to #cw-gtm-alerts Slack channel for immediate triage |
| | MG.RS — Remediation | Audit Readiness agent generates per-framework remediation checklists |

### EU AI Act Alignment

| EU AI Act Article | Requirement | How Agents Satisfy It |
|-------------------|-------------|----------------------|
| **Article 9** — Risk Management | Continuous risk identification and mitigation | CISO agent: weekly security posture briefs with risk scoring (Grade A-F) |
| **Article 11** — Technical Documentation | Document AI system capabilities and limitations | Agent personas in `.openclaw/agents/` define scope, rules, boundaries, and deliverables |
| **Article 12** — Record-Keeping | Automatic logging of AI system operations | AU-2 JSON Lines audit logs with UUID session tracking, timestamps, outcomes |
| **Article 13** — Transparency | Users informed about AI system operation | Agent names, files, and task types logged in every audit entry; GitHub status workflow provides visibility |
| **Article 14** — Human Oversight | Humans can intervene in AI decisions | All agents escalate critical findings to human operator; no autonomous actions on production data |
| **Article 17** — Quality Management | Systematic quality assurance processes | Compliance Specialist validates framework integrity; Audit Readiness verifies artifact completeness |
| **Article 26** — Obligations of Deployers | Monitor AI system performance | Orchestrator health endpoint + GitHub Actions bridge workflow monitor agent availability |

### Self-Tracking: Agents as AI Assets

The OpenClaw agents should be registered in ControlWeave's own CMDB as AI assets (category: `ai_agent`). This enables:

- **AI Risk Classification** — Each agent's risk level documented per NIST AI RMF and EU AI Act
- **Bias Testing Tracking** — Record that agent outputs are reviewed for accuracy
- **Human Oversight Flags** — `ai_human_oversight_required: true` for all automated agents
- **Version Tracking** — Agent persona file versions tracked via Git history
- **Data Source Documentation** — Each agent's `instruction` field documents what data it accesses

```
Asset Category: AI Agent
├── ControlWeave Security Engineer    (risk: limited, oversight: required)
├── ControlWeave API Tester           (risk: minimal, oversight: optional)
├── ControlWeave Accountant           (risk: limited, oversight: required)
├── ControlWeave CISO                 (risk: limited, oversight: required)
├── ControlWeave Compliance Specialist(risk: limited, oversight: required)
├── ControlWeave Config Manager       (risk: limited, oversight: required)
├── ControlWeave Audit Readiness      (risk: limited, oversight: required)
├── ControlWeave Evidence Collector   (risk: minimal, oversight: optional)
├── ControlWeave DevOps Engineer      (risk: minimal, oversight: optional)
├── ControlWeave Project Shepherd     (risk: minimal, oversight: optional)
└── OpenClaw Orchestrator             (risk: limited, oversight: required)
```

> **Note**: All agents are read-only and advisory — they produce reports and findings but never modify production data, infrastructure, or customer records. This classifies them as **limited risk** under the EU AI Act (not high-risk) since they support human decision-making rather than making autonomous decisions.

---

## 🙏 Attribution

These agents are adapted from [The Agency](https://github.com/msitarzewski/agency-agents) — a collection of 61+ specialized AI agent personalities by [@msitarzewski](https://github.com/msitarzewski). Licensed under MIT. See [LICENSE](./LICENSE).

The original generic agents were customized specifically for ControlWeave's:
- Express.js + PostgreSQL (raw SQL) backend
- Next.js + TypeScript + Tailwind CSS frontend
- Multi-tenant GRC architecture with 15+ compliance frameworks
- AI-powered compliance analysis with multi-provider LLM support
- Stripe billing with subscription lifecycle management
- OpenClaw GTM automation with truth standard enforcement
