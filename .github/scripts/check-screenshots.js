#!/usr/bin/env node

/**
 * Screenshot integrity guard.
 *
 * Thirty-two images under controlweave/docs/screenshots/ were 200x40
 * placeholder stubs, not screenshots. They were referenced by the user guides
 * as though they showed real UI, and they survived in the repo for months
 * because nothing ever checked. They arrived via `git add -A` in the
 * sync-stale-content job (now narrowed), but narrowing that one job only closes
 * one door -- this check closes the room.
 *
 * Wired into ci.yml so it runs on every PR regardless of which job, script or
 * human put a file in the directory.
 *
 * Fails on:
 *   - PNGs below the absolute dimension floor (the stubs were 200x40)
 *   - files over MAX_BYTES, the cap this repo's own README sets
 *   - byte-identical duplicates, which mean a capture silently repeated a page
 *
 * Every check here is exact rather than heuristic, deliberately.
 *
 * A compression-density check was tried and removed: the idea was that a flat
 * placeholder compresses to nearly nothing, so bytes-per-pixel would betray it.
 * It does not survive contact with this app. dashboard-view-builder-01.png is a
 * complete, correct capture at 0.031 bytes/pixel, and
 * assessment-record-result-01.png is a modal on a dark backdrop at 0.020 --
 * both well under any threshold that would catch a blank page, because a flat
 * modern UI compresses about as well as an empty one. Three of the four files
 * that check flagged were real screenshots. A guard with a 75% false-positive
 * rate trains people to ignore it, which is how the stubs survived in the first
 * place, so it is not shipped.
 *
 * The consequence is honest and worth stating: this catches placeholder stubs
 * and duplicates, not a capture taken before the page finished rendering.
 * Those need eyes (controls-list-01.png was exactly that -- a loading spinner
 * on a blank page, referenced by CONTROLS.md as the controls list).
 *
 * Reads PNG dimensions straight from the IHDR chunk. No dependency: this must
 * run in any job, including ones that never install node_modules.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCREENSHOTS_DIR = path.join(
  process.env.GITHUB_WORKSPACE || path.resolve(__dirname, '../..'),
  'controlweave', 'docs', 'screenshots'
);

// Absolute floor. Below this an image cannot be showing anything legible even
// as a deliberate crop. The known stubs were 200x40, so 40px of height falls
// inside the rejected range, while the legitimate 310x130 crop in
// notifications-bell-badge-01.png (one bell and its unread count) does not.
const MIN_WIDTH = 200;
const MIN_HEIGHT = 100;

// controlweave/docs/screenshots/README.md sets this budget; keep the two in
// step.
//
// Raised from 500KB to 800KB once the capture job actually ran. The 500KB
// figure was set against the committed corpus, whose largest image is 452KB --
// but those were captured against an older, flatter UI. Re-capturing the same
// pages today produces 689-696KB: register-form-01 is 100KB committed and
// 689KB fresh, a 7x jump that the viewport change accounts for barely 1.3x of.
// The rest is the current UI's gradients and imagery, which compress far worse
// than what was there before.
//
// A cap that correctly-captured screenshots cannot meet is not a quality gate.
// It either blocks every capture or gets switched off, and a guard people
// switch off is how the original placeholder stubs survived for months. 800KB
// still catches what this check is for: the stubs were 8KB, and genuine
// runaway files are multiple megabytes.
const MAX_BYTES = 800 * 1024;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Read width/height from a PNG's IHDR chunk, which is always the first chunk
 * and always at a fixed offset. Returns null for anything that is not a PNG.
 */
function readPngDimensions(buffer) {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function main() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    console.log(`No screenshots directory at ${SCREENSHOTS_DIR} — nothing to check.`);
    return 0;
  }

  const entries = fs.readdirSync(SCREENSHOTS_DIR)
    .filter((name) => /\.(png|jpe?g|gif|webp)$/i.test(name))
    .sort();

  if (entries.length === 0) {
    console.log('No image files found — nothing to check.');
    return 0;
  }

  const failures = [];
  const byHash = new Map();

  for (const name of entries) {
    const filePath = path.join(SCREENSHOTS_DIR, name);
    const buffer = fs.readFileSync(filePath);

    if (buffer.length > MAX_BYTES) {
      failures.push(
        `${name}: ${(buffer.length / 1024).toFixed(0)}KB exceeds the ${MAX_BYTES / 1024}KB cap`
      );
    }

    const dimensions = readPngDimensions(buffer);
    if (dimensions && (dimensions.width < MIN_WIDTH || dimensions.height < MIN_HEIGHT)) {
      failures.push(
        `${name}: ${dimensions.width}x${dimensions.height} is below the ${MIN_WIDTH}x${MIN_HEIGHT} floor `
        + '— too small to show anything legible, even as a crop'
      );
    }

    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    if (byHash.has(hash)) {
      failures.push(`${name}: byte-for-byte identical to ${byHash.get(hash)}`);
    } else {
      byHash.set(hash, name);
    }
  }

  console.log(`Checked ${entries.length} image(s) in controlweave/docs/screenshots/`);

  if (failures.length > 0) {
    console.error('\nScreenshot check FAILED:\n');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
      if (process.env.GITHUB_ACTIONS) console.error(`::error::${failure}`);
    }
    console.error(
      '\nCapture real screenshots with the workflow_dispatch `capture-screenshots` job in '
      + 'docs-pipeline.yml, or delete images that depict UI which does not exist.\n'
    );
    return 1;
  }

  console.log('All screenshots pass: no stubs, none over cap, no duplicates.');
  return 0;
}

process.exit(main());
