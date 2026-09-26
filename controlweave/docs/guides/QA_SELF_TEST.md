# QA & Self-Test

The **QA & Self-Test** page (sidebar: Organization → Preferences → QA & Self-Test) lets your QA and acceptance testers verify a ControlWeave deployment end to end, from inside the product, in a few seconds. Each run is saved and can be exported as acceptance-test evidence (for example for SOC 2 CC8.1 change management after an upgrade).

## Who can use it

Running and viewing self-tests requires the `qa.run` permission. Administrators have it by default. To give a dedicated tester access without admin rights, create a custom role under **Settings → Roles** (for example "QA Tester") and grant it `qa.run`, plus read permissions for the areas they should inspect.

## What it checks

| Suite | What is verified |
|---|---|
| **Platform health** | Database latency and version, all migrations applied, secrets and encryption keys configured, evidence storage writable and durable (object storage or a persistent volume), SMTP configured, Redis for multi-instance deployments |
| **Frameworks & compliance data** | Selected frameworks have controls; compliance percentages recomputed from raw data match the dashboard, compliance summary and compliance gate; every crosswalk-satisfied control is backed by an implemented source; the 25 most recent evidence files still match their SHA-256 hashes |
| **Audit trail** | An audit event is written and read back; the SHA-384 hash chain verifies; the database refuses edits and deletes of audit records; CSV export works; recent activity coverage |
| **Core workflows** | Risk, evidence, audit engagement and vendor workflows round-trip through the live API with your own session; PDF and Excel reports generate |
| **Access control** | Built-in auditor and user roles match the least-privilege matrix; administrators have MFA enrolled |
| **AI providers** | Every configured bring-your-own-key provider accepts its key (validated by listing models, so no tokens are spent) and exposes the default model; AI requests fail fast when no provider is configured |
| **Performance** | Response times of the API behind the most-used pages |

## Is it safe to run in production?

Yes. The self-test never changes your controls, compliance status or settings. Workflow checks create their own records named `[QA self-test] …` and delete them before finishing (audit engagements, which cannot be deleted, are archived). Those actions appear in your audit log like any other activity, which is itself part of what is being tested.

## Reading results

- **Pass** — working as expected.
- **Warn** — works, but something needs attention (for example SMTP not configured, or an administrator without MFA). Each warning includes a "How to fix".
- **Fail** — a defect or misconfiguration that affects users or compliance data. Export the run and send it to support.
- **Skip** — not applicable to this organization yet (for example no evidence uploaded).

A run is **Passed**, **Passed with warnings**, or **Failed** (any failed check).

## Exporting a run

Open a run and choose **Export CSV** or **Export JSON**. The export includes every check, its outcome, detail, remediation and timing, plus the ControlWeave version tested. Exports are recorded in the audit log.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/qa/checks` | List suites and checks |
| POST | `/api/v1/qa/runs` | Run all suites, or `{ "suites": ["audit", "functional"] }` |
| GET | `/api/v1/qa/runs` | Run history |
| GET | `/api/v1/qa/runs/:id` | One run with results |
| GET | `/api/v1/qa/runs/:id/export?format=csv\|json` | Download a run |

Runs are limited to 6 per minute per organization. Because the endpoint returns a complete result, it can also be called from a CI/CD pipeline after each deployment.
