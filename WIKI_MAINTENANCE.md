# Wiki Maintenance

How ControlWeaver's docs get from `controlweave/docs/wiki/` into the GitHub
Wiki, how that sync is checked for health, and how documentation-review
issues get auto-reviewed.

## One workflow, not three

All of this used to be three separate workflow files (`sync-wiki.yml`,
`wiki-health-check.yml`, `auto-review-docs.yml`, plus a `docs-auto-update.yml`
for stale-content detection). They've since been consolidated into a single
workflow: **`.github/workflows/docs-pipeline.yml`**. If you're looking for
one of the old file names, it's a job inside `docs-pipeline.yml` now, not a
separate file — commands like `gh workflow run sync-wiki.yml` no longer
resolve to anything.

A `preflight` job always runs first and sets routing outputs
(`run_wiki_sync`, `run_wiki_health`, `run_content_sync`, `run_issue_review`,
`run_code_pipeline`) based on what triggered the run, so the other jobs stay
conditional on those outputs rather than each having their own trigger
config:

| Job | Runs on |
|---|---|
| `sync-stale-content` | weekly (Mon 09:00 UTC), push to `main`, or `workflow_dispatch` |
| `detect-changes` / `update-documentation` | `pull_request` (docs-pipeline detects whether the diff is doc-relevant) |
| `review-docs` | `workflow_dispatch`, `workflow_call`, or an `issues` event where the issue title contains "Documentation Review Needed" |
| `sync-wiki` | push to `main` (filtered further to only fire when wiki-relevant paths changed) or `workflow_dispatch` |
| `wiki-health-check` | daily (09:00 UTC) or `workflow_dispatch` |

A single manual `workflow_dispatch` run triggers wiki sync, wiki health
check, and content sync together (`run_wiki_sync`, `run_wiki_health`, and
`run_content_sync` are all forced true on `workflow_dispatch`), so
`gh workflow run docs-pipeline.yml` is the one command that covers "just
resync/recheck everything now."

```bash
# Trigger everything manually (sync + health check + content sync)
gh workflow run docs-pipeline.yml

# Auto-fix missing wiki docs as part of that run
gh workflow run docs-pipeline.yml -f auto_fix_wiki=true

# Dry run — report stale content without committing fixes
gh workflow run docs-pipeline.yml -f dry_run=true

# Re-run auto-review against a specific documentation-review issue
gh workflow run docs-pipeline.yml -f issue_number=123
```

## Wiki sync

**What it does**: on push to `main` (when `controlweave/docs/wiki/**` or
`controlweave/docs/guides/**` changed) or on manual dispatch, clones the
wiki repo, copies markdown from `controlweave/docs/wiki/`, commits, and
pushes. Sync is effectively immediate (within a minute or two of merge).

**Manual sync**:
```bash
./scripts/sync-wiki.sh
# or
gh workflow run docs-pipeline.yml
```

## Wiki health check

**Schedule**: daily at 09:00 UTC (`cron: '0 9 * * *'`), plus on any manual
dispatch. Script: `.github/scripts/check-wiki-health.js`.

**Checks**: for each of the 5 documents below, confirms it exists in the
wiki, and compares an MD5 hash of source vs. wiki copy to flag drift; also
reports (informationally) any files present in the wiki but not in this
expected list.

Current expected-document list (hardcoded in `check-wiki-health.js`):

```
controlweave/docs/wiki/Home.md                              -> Home.md
controlweave/docs/wiki/User-Guide.md                        -> User-Guide.md
controlweave/docs/wiki/getting-started/Getting-Started.md   -> Getting-Started.md
controlweave/docs/wiki/getting-started/Account-Setup.md     -> Account-Setup.md
controlweave/docs/wiki/security/Vulnerability-Management.md -> Vulnerability-Management.md
```

Note this list is narrower than the full contents of
`controlweave/docs/wiki/` (which also has `ai-features/`, `dashboards/`,
`deployment/`, `integrations/`, `operations/`, `reference/`, `security/`
subdirectories with their own README/content files today). Only the 5 files
above are hash-checked; everything else in the wiki tree syncs but isn't
individually health-checked. If you add a new canonical wiki doc that
should be drift-checked, add it to `expectedDocs` in
`check-wiki-health.js`.

**On failure**: creates or updates a GitHub issue labeled `wiki-health`
with the report; closes it automatically once a subsequent check passes.
Optionally re-triggers sync as an auto-fix when
`auto_fix_wiki=true` is passed to the dispatch.

**Manual check**:
```bash
gh workflow run docs-pipeline.yml
gh workflow run docs-pipeline.yml -f auto_fix_wiki=true   # check + auto-fix
```

## Auto-review for documentation-review issues

**Trigger**: an `issues` event where the issue title contains "Documentation
Review Needed", or manual dispatch with `issue_number` set. Script:
`.github/scripts/auto-review-docs.js`.

**The 6 checks it runs** (`checks` array in the script):
1. File Exists
2. Valid Markdown
3. No Broken Links
4. Screenshots Referenced
5. Consistent Headers (no header-level skipping, e.g. H1 → H3)
6. Code Blocks Formatted (properly closed fences)

**Outcome**: posts a comment with pass/fail per check. If every check
passes, the issue is labeled `auto-reviewed` + `approved` and closed
automatically. If anything fails, it's labeled `auto-reviewed` +
`needs-fix` and stays open with failure details for a human to act on.
There is no label-based bypass (`skip-auto-review` is not implemented in
the current workflow) — if you need to override, close the issue manually
after review.

**Test locally**:
```bash
export DOCS_TO_REVIEW='["controlweave/docs/guides/GETTING_STARTED.md"]'
node .github/scripts/auto-review-docs.js
```

## Common tasks

### Add new documentation

```bash
# 1. Write it in guides
vim controlweave/docs/guides/NEW_FEATURE.md

# 2. Copy into the wiki tree with wiki naming (PascalCase-Hyphenated)
cp controlweave/docs/guides/NEW_FEATURE.md \
   controlweave/docs/wiki/operations/New-Feature.md

# 3. Link it from Home.md (or the relevant category README) so it's
#    discoverable
vim controlweave/docs/wiki/Home.md

# 4. Commit — sync-wiki picks it up on push to main
git add . && git commit -m "docs: add NEW_FEATURE guide" && git push
```

### Update existing documentation

Edit the source in `controlweave/docs/guides/`, copy the change into its
`controlweave/docs/wiki/...` counterpart, commit both together. The wiki
copy is not auto-generated from the guide — keep them in sync by hand.

### Add a screenshot

```bash
mv screenshot.png controlweave/docs/screenshots/new-feature-01.png
echo "![Description](../screenshots/new-feature-01.png)" >> doc.md
git add controlweave/docs/screenshots/new-feature-01.png doc.md
git commit -m "docs: add screenshot for new feature"
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "File Not Found" from auto-review | Path in issue doesn't match repo | Verify path is relative to repo root |
| Broken links detected | Referenced file doesn't exist | Fix the link or add the missing file |
| Screenshot reference fails | Image file missing | Add it under `controlweave/docs/screenshots/` |
| Wiki not updating after push | Path filter didn't match, or sync job didn't fire | `gh workflow run docs-pipeline.yml` |
| Auto-review not running on an issue | Issue title doesn't contain "Documentation Review Needed" | Rename the issue title, or dispatch manually with `issue_number` |
| Health check always reports unhealthy | Hash mismatch from whitespace/line-ending differences, or source file moved without updating `check-wiki-health.js` | Diff the two files byte-for-byte; update `expectedDocs` if the source path changed |
| No runs showing in Actions at all | Actions disabled for the repo, or a cron/YAML syntax error in `docs-pipeline.yml` | Check repo Settings → Actions, and validate the workflow YAML |

**View activity**:
```bash
gh run list --workflow=docs-pipeline.yml
gh issue list --label wiki-health
gh issue list --label auto-reviewed
```

## Further reading

- `controlweave/docs/AUTO_REVIEW_SYSTEM.md` — auto-review internals
- `controlweave/docs/DOCUMENTATION_SYSTEM.md` — overall documentation system
- `controlweave/docs/wiki/README.md` — wiki structure and manual-sync notes
- `.claude/rules/doc-review.md` — the *other* doc review process (live PR
  review by whichever Claude session is watching a PR); distinct from the
  automated `docs-pipeline.yml` checks described here
