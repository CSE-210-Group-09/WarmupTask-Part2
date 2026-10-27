# Change log

Record meaningful changes under Unreleased in each PR. When preparing a release, move entries into a dated version section. Describe outcomes, affected areas, and validation; use Git history for individual edits.

## Unreleased

### Snapping to the nearest point (issue #25, story #23)

- With the line graph's markers hidden, hovering its plot area snaps to the data point nearest by X. A small dot in each line's color marks that X, and the tooltip lists every line's value there. The crosshair snaps to the same point on both charts.
- Only points in the zoomed view are snapped to; a value above or below the view is listed without a dot. Snapping clears when the pointer leaves the plot, while panning and on scroll, and the dots are left out of exports. With markers shown, hovering is unchanged.
- Affected areas: `hover.js` (new, `nearestIndex`), `app.js` (`snapAt`, `clearSnap`, the snap layer), `style.css`, `index.html` (loads `hover.js`), README and `docs/design.md` §6.7.
- Tests: 8 browser cases in `e2e/compare-points.spec.js` (one #24 case updated: with markers hidden its crosshair now snaps) and 3 unit cases in `tests/hover.test.cjs`.
- Validation on 2026-10-26: `npm run test:unit` 31 passed; Chromium browser suite 48 passed, repeated three times with no flakes. Firefox and WebKit not run locally.

### Shared crosshair (issue #24, story #23)

- Hovering either chart's plot area shows a dashed crosshair on both charts at the same X and Y values, with the values read off each axis. Readouts follow log scales and gain digits as you zoom in. Focusing a marker with the keyboard puts the crosshair through it.
- The crosshair hides when the pointer leaves the plot, while dragging to pan, and when the page scrolls (except on a focused point). It ignores the pointer, so marker tooltips still work, and it is left out of exported images.
- Affected areas: `app.js` (crosshair layer and pointer handling, export), `scale.js` (`formatReadout`), `style.css`, the hint in `index.html`, README and `docs/design.md` §6.6.
- Tests: `e2e/compare-points.spec.js` (11 browser cases) and two unit cases for `formatReadout` in `tests/scale.test.cjs`.
- Validation on 2026-10-26: `npm run test:unit` 28 passed; Chromium browser suite 40 passed, repeated three times with no flakes. Firefox and WebKit not run locally; CI covers them.

### Documentation additions

- Added `docs/feature-proposals.md` with six candidate stories, acceptance criteria, priorities and relative sizes: saved sessions, date axes, range statistics, line/marker styles, reference lines and import previews.
- Added `docs/engineering-practices.md` with a phased plan for documentation ownership, selective JSDoc, testing, review and future CI/linting adoption. This is a plan; runtime JSDoc and tooling migrations are not implemented in this PR.

### Documentation organization

- Added `docs/README.md` as the documentation map, linked from the project README.
- Kept architecture decisions in `docs/design.md` and test instructions in `docs/testing.md` rather than duplicating them.
- Updated the testing guide to include `data.js` and the import-recovery coverage.
- Added this change log to track additions and validation in future PRs.

### New tests

- Four unit cases cover rejected numeric coercions/overflow, valid signed decimals and line endings, duplicate XML fields/overflow, and source-data preservation with duplicate X values.
- Three browser cases cover CSV/XML import rejection preserving chart settings and corrected same-name file recovery. Playwright runs these cases in Chromium, Firefox and WebKit.
- Application runtime files are unchanged.

### Validation on 2026-10-25

- `npm ci` completed; Playwright Chromium, Firefox and WebKit installed.
- `npm test`: 26 unit tests passed; browser suite had 86 passes and one failure.
- All nine executions of the three new browser cases passed across the three engines.
- Existing WebKit test `Delete and Backspace on a focused point do not remove it` failed with zero markers instead of six. A targeted rerun reproduced it. Root cause remains unconfirmed; no runtime fix or test skip is included here.
- `git diff --check` passed.
