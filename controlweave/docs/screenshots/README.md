# Screenshots Guide

Screenshots referenced by the user guides under `../guides/`.

## Rule zero: capture only UI that exists

A screenshot is evidence that a feature is real. Thirty-two images in this
directory were once 200x40 placeholder stubs referenced by the guides as though
they showed working screens, and several depicted UI that had never been built
at all. If a page does not exist, the guide should say so in words rather than
carry a picture of nothing.

## Naming Convention

```
<feature>-<action>-<sequence>.png
```

Examples:
- `dashboard-overview-01.png`
- `evidence-version-history-01.png`
- `poam-detail-milestones-01.png`

## Quality Standards

- **Format**: PNG
- **Viewport**: 1600x1000 — the size the existing set was captured at. A handful
  of older captures are 1280x720, 1440x900 or 3200x2000 (retina); new captures
  should use 1600x1000 so the set stays visually consistent.
- **Max file size**: 800KB per image, enforced in CI by
  `.github/scripts/check-screenshots.js`. This was 500KB, set against a corpus
  whose largest image is 452KB — but those were captured against an older,
  flatter UI. Re-capturing the same pages today lands at 689–696KB, because the
  current design's gradients and imagery compress far worse. A cap that a
  correct capture cannot meet just gets switched off.
- **Deliberate crops are fine.** `notifications-bell-badge-01.png` is 310x130
  because it shows one bell and its unread count. Crop to what the reader needs.

## How to capture

Run the `capture-screenshots` job in `.github/workflows/docs-pipeline.yml` via
**workflow_dispatch**. It stands up Postgres, runs the migrations and the demo
seed, starts the backend and frontend, and captures against `localhost` — no
secrets and no hosted demo required. The result is uploaded as an artifact to
review and commit deliberately; nothing is auto-committed.

Locally, with the stack already running:

```bash
DEMO_USERNAME=admin@technology.com DEMO_PASSWORD='ControlWeave!2026' \
  node .github/scripts/capture-screenshots.js --all
```

The backend must be up before the frontend starts and must stay up for the whole
run; `ERR_CONNECTION_REFUSED` on the API port means it exited.

## What CI enforces

`.github/scripts/check-screenshots.js` runs on every PR and fails when an image
is below 200x100 (a placeholder stub), exceeds the 800KB cap, or is
byte-for-byte identical to another file here.

It cannot tell a good capture from one taken before the page finished
rendering. `controls-list-01.png` was a blank page with a loading spinner and
passed every automated check until someone looked at it. Look at your captures.

## Referencing screenshots

```markdown
![Alt text describing what the reader should see](../screenshots/filename.png)
*Figure N: Short caption*
```

Write alt text that describes what is actually in the image. The blank capture
above was labeled "Controls list showing control ID, title, framework, status,
and owner" in three separate guides.
