# Public Mirror Setup

Guide for maintaining the public open-source mirror of ControlWeave at [`sherifconteh-collab/ControlWeave`](https://github.com/sherifconteh-collab/ControlWeave).

## Overview

ControlWeaver is fully open source (see `.claude/rules/tier-system.md` — all tier gating was
removed in v4.0). The public mirror publishes this repository's contents to a separate public
GitHub repository under the AGPL v3 / commercial dual license, while keeping internal business
tooling (agent orchestration configs, marketing/GTM automation, secrets) out of the public copy.

## How It Works

### Automatic mirroring (on push to `main`)

The `.github/workflows/public-mirror.yml` workflow runs automatically on every push to `main`
(only when `github.repository == 'sherifconteh-collab/ControlWeaver-Pro'`):

1. **Documentation staleness scan** — `node .github/scripts/check-doc-staleness.js`, report
   uploaded as a workflow artifact.
2. **IP hygiene check** — `node controlweave/backend/scripts/ip-hygiene-check.js`.
3. **Secret/token safety scan** — blocks `.env`, `.pem`, `.p12`, `.pfx`, private keys, and known
   credential patterns (GitHub tokens, AWS keys, Slack tokens, PEM-format private keys) from
   ever entering the mirror pipeline. `.env.production` is only allowed through if every
   non-blank/non-comment line is a browser-exposed `NEXT_PUBLIC_*` variable.
4. **Mirror snapshot build** — `rsync -a` copies the full repository into `mirror-export/`,
   excluding `.git`, `node_modules`, secret files, and internal business-agent directories
   (`.openclaw/agents/gtm`, `.openclaw/agents/marketing`, `.openclaw/sops`,
   `.openclaw/orchestrator`, `.openclaw/adk`, `.openclaw/mcp-servers`, and a few other
   internal-only files). This is a near-complete mirror, not a curated allowlist copy — the
   repository does **not** get filtered down to only `controlweave/`, and file paths are not
   rewritten.
5. **Defensive re-scan** — a second credential-pattern check runs against the built snapshot
   before anything is pushed.
6. **Publish** — clones the existing public mirror branch (to preserve history so users can
   `git pull` instead of re-cloning), strips `.github/workflows/` (the mirror PAT lacks
   `workflow` scope), syncs the snapshot in with `rsync --delete`, and pushes as
   `github-actions[bot]` with commit message `Mirror from <repo>@<sha>`.

### Manual mirroring (`workflow_dispatch`)

1. Go to **Actions → Public Mirror** in GitHub.
2. Click **Run workflow**.
3. Options:
   - **dry_run**: `true` — builds and scans the snapshot but does not push. Publishes a
     `public-mirror-snapshot` artifact (7-day retention) you can download and inspect.
   - **target_branch**: branch name in the public repo (default `main`).

## What's Excluded

Since there are no more paid tiers, the exclude list is about keeping internal business
tooling and secrets out of the public repo, not gating product features:

- `.env`, `.env.local`, `.env.production` (unless every line is `NEXT_PUBLIC_*`), `*.pem`, `*.key`
- `.openclaw/agents/gtm`, `.openclaw/agents/marketing`, `.openclaw/sops`,
  `.openclaw/orchestrator`, `.openclaw/adk`, `.openclaw/mcp-servers`,
  `.openclaw/system-prompt.md`, `.openclaw/truth-standard.md`, `.openclaw/linkedin-oauth.js`
- `.github/workflows/` (stripped at publish time — PAT scope limitation, not a content decision)
- `node_modules`

## Tier-Classification Tooling (legacy, informational)

`controlweave/backend/scripts/sync-mirror-allowlist.js` scans the codebase and classifies files
as `community` or `paid` using `// @tier:` annotations (falling back to filename/`require()`
heuristics), writing results to `controlweave/.github/public-mirror-allowlist.txt`. This
predates the current full-mirror workflow and is **not** consumed by the `public-mirror.yml`
publish step above — the workflow mirrors everything except the exclude list, regardless of
`@tier` annotations. The script is kept for auditing which files were historically paid-tier
before v4.0's tier removal; `// @tier:` comments themselves are informational only (see
`.claude/rules/tier-system.md`). Run it manually if you need that audit:

```bash
node controlweave/backend/scripts/sync-mirror-allowlist.js [--dry-run]
```

## Configuration

### Required secrets

Set in repository settings → Secrets and variables → Actions:

- `PUBLIC_MIRROR_PAT` — Personal Access Token with `repo` scope for pushing to the public
  repository. If unset, the workflow still runs its checks and builds the snapshot but skips
  the publish step (logged as a warning, not a failure).

### Environment variables (in the workflow)

- `PUBLIC_REPO`: `sherifconteh-collab/ControlWeave`
- `ALLOWLIST_FILE`: `.github/public-mirror-allowlist.txt` (defined for reference; not read by
  the current publish step — see "Tier-Classification Tooling" above)

## Troubleshooting

### Workflow not running

- Check the workflow file is at `.github/workflows/public-mirror.yml` (repository root).
- Verify it's running on the `main` branch.
- Ensure the repository name matches `sherifconteh-collab/ControlWeaver-Pro` — the job has an
  explicit `if:` guard on this.

### Secret scanning failures

- Check for accidentally committed secrets in the flagged file(s).
- Review git history for removed-but-still-in-history secrets.
- A `.env.production` failure usually means a non-`NEXT_PUBLIC_*` line snuck in — move the
  value to a non-mirrored config path.

### Public repo not updated

- Verify `PUBLIC_MIRROR_PAT` is set and has `repo` scope.
- Confirm the target repository/branch exists.
- Review the workflow run logs in the **Actions** tab — the "Publish to public repository" step
  logs `publish=false` with a `reason` (`dry_run` or `missing_secret`) when it skips pushing.

## Monitoring

1. Go to the **Actions** tab in ControlWeaver-Pro.
2. Look for **Public Mirror** workflow runs — green check = successful run, red X = failure
   (click through for logs).
3. Visit https://github.com/sherifconteh-collab/ControlWeave and check recent commits for
   `Mirror from ControlWeaver-Pro@<sha>`.
