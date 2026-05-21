# ControlWeave Agent Team

Specialized AI agents for the ControlWeave open source GRC platform. All agents encode ControlWeave's actual conventions, patterns, and workflows.

## Engineering Agents

| Agent | File | Role |
|-------|------|------|
| Full-Stack Developer | `agents/engineering/cw-fullstack-developer.md` | End-to-end feature development across all 13 production layers |
| Backend Architect | `agents/engineering/cw-backend-architect.md` | Express.js, PostgreSQL, multi-tenant API architecture |
| Frontend Developer | `agents/engineering/cw-frontend-developer.md` | Next.js, TypeScript, React, Tailwind dashboard UIs |
| AI Engineer | `agents/engineering/cw-ai-engineer.md` | LLM integration, BYOK, AI copilot, prompt engineering |
| Security Engineer | `agents/engineering/cw-security-engineer.md` | Auth hardening, SQL injection prevention, audit logging |
| DevOps Engineer | `agents/engineering/cw-devops-engineer.md` | Railway deployment, CI/CD, migrations, environment management |

## Compliance Agents

| Agent | File | Role |
|-------|------|------|
| Compliance Specialist | `agents/compliance/cw-compliance-specialist.md` | Multi-framework GRC mapping, crosswalk intelligence |
| CISO | `agents/compliance/cw-ciso.md` | Security strategy, risk scoring, executive reporting |
| Audit Readiness | `agents/compliance/cw-audit-readiness.md` | Pre-audit artifact verification across 10+ frameworks |
| Configuration Manager | `agents/compliance/cw-configuration-manager.md` | CM baseline, change control, configuration item tracking |

## Design & Testing Agents

| Agent | File | Role |
|-------|------|------|
| UI Designer | `agents/design/cw-ui-designer.md` | Compliance dashboard UX, Tailwind component systems |
| API Tester | `agents/testing/cw-api-tester.md` | REST API validation, auth flow testing, multi-tenant isolation |
| Evidence Collector | `agents/testing/cw-evidence-collector.md` | QA verification, compliance evidence documentation |

## Coordination Agents

| Agent | File | Role |
|-------|------|------|
| Project Shepherd | `agents/project-management/cw-project-shepherd.md` | Cross-functional coordination, CM discipline, deploy ordering |

## Collaboration Routing

Use this table to decide which agent to involve:

| Situation | Invoke |
|-----------|--------|
| New feature spanning frontend + backend | cw-fullstack-developer |
| API architecture or database schema | cw-backend-architect |
| React component or dashboard UI | cw-frontend-developer |
| LLM / AI feature | cw-ai-engineer |
| Auth, JWT, SQL security concern | cw-security-engineer |
| Deployment, CI failures, Railway config | cw-devops-engineer |
| Framework mapping, control gaps | cw-compliance-specialist |
| Risk scoring, CISO-level question | cw-ciso |
| Pre-audit artifact check | cw-audit-readiness |
| Multi-component feature planning | cw-project-shepherd |
| UX or design review | cw-ui-designer |
| API endpoint test coverage | cw-api-tester |
