# Dependency Tracker

**Platform Admin → Dependencies** shows the operations team everything ControlWeave runs on:

- the backend and frontend npm packages
- the Node.js runtime
- PostgreSQL
- the container base images

For each one it shows whether a newer version exists, whether a known vulnerability affects the installed version, and whether it is past or near end of life. The team records a decision per item, so the page works as a queue rather than a report.

Only the platform owner can open it: the platform administrator, or on self-hosted installs the account that runs the deployment. Tenants of a SaaS deployment never see it.

## What is checked

| Component | Source | Checked for |
|---|---|---|
| Backend packages | The running service's `package.json` and `package-lock.json` | Newer versions of direct dependencies; vulnerabilities in every resolved package, including transitive ones |
| Frontend packages | `dependency-manifest.json` (built from the frontend lockfile; CI keeps it current) | Same as backend |
| Node.js runtime | The running process | Newer patch or minor in the same major line, the latest LTS line, end of life |
| PostgreSQL | The connected database | End of life of its major version |
| Container base images | Both Dockerfiles (via the manifest) | End of life of the Node.js line, and the current LTS image |

Where the data comes from:

- Newer versions come from the npm registry.
- Vulnerabilities come from the npm advisory service. This is the GitHub Advisory Database, the same data `npm audit` uses, and each advisory links to it.
- Node.js releases come from nodejs.org.
- End-of-life dates for Node.js and PostgreSQL follow their published support policies.

If a source cannot be reached, the check is marked **partial** and says what is missing. This happens on air-gapped installs, or when a registry mirror is down.

## When checks run

- A check runs 5 minutes after startup and then every `DEPENDENCY_CHECK_INTERVAL_HOURS` (default 24).
- **Check now** runs one immediately. Only one check runs at a time, even with several backend instances.
- `DEPENDENCY_CHECK_ENABLED=false` turns the schedule off.
- `NPM_REGISTRY_URL` points checks at an internal registry mirror.

When a check finds a critical or high vulnerability that the previous check did not have, every platform administrator gets a notification.

## Working the list

- **Needs review** is the default view. It shows items with no decision yet that have a vulnerability, are past end of life, or have an update available. The other filters show vulnerabilities, end of life, updates available, or everything.
- **Plan upgrade** creates a POA&M item in your organization, titled with the upgrade and describing the vulnerabilities. The due date depends on severity:

  | Severity | Due in |
  |---|---|
  | Critical | 15 days |
  | High, or past end of life | 30 days |
  | Moderate | 90 days |
  | Other | 180 days |

  When a later check finds the new version installed and nothing left to fix, the item is marked **Done**. Close the POA&M item after verifying the deployment.
- **Accept risk** records why an item stays as it is (for example "Express 5 migration scheduled for Q1; 4.x still supported"). A justification is required, and it is written to the audit log.
- **Snooze 30 days** hides an item until the date passes.
- **Reopen** returns an item to Needs review.

Transitive vulnerabilities (packages you do not depend on directly) are fixed by upgrading the package that brings them in, or by pinning a fixed version with an npm `overrides` entry. Development dependencies are labeled; they are not part of the production image.

## Evidence

**Export CSV** gives the full inventory with versions, advisories, end-of-life dates and decisions. It can serve as the component inventory for NIST 800-53 CM-8 and as evidence for SI-2 (flaw remediation) and SA-22 (unsupported components). The QA self-test (Platform health) fails when a critical vulnerability has no decision, and warns when a high-severity or end-of-life item has none or when the last check is more than 48 hours old.

## Keeping the manifest current

After changing frontend dependencies or a Dockerfile, run `npm run deps:manifest` in `controlweave/backend` and commit `dependency-manifest.json`. CI fails if you forget.
