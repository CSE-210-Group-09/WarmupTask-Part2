# Change log

Record meaningful changes under Unreleased in each PR. When preparing a release, move entries into a dated version section. Describe outcomes, affected areas, and validation; use Git history for individual edits.

## Unreleased

### Snapping to the nearest point (issue #25, story #23)

- With the line graph's markers hidden, hovering its plot area snaps to the data point nearest by X. A small dot in each line's color marks that X, and the tooltip lists every line's value there. The crosshair snaps to the same point on both charts.
- Only points in the zoomed view are snapped to; a value above or below the view is listed without a dot. Snapping clears when the pointer leaves the plot, while panning and on scroll, and the dots are left out of exports. With markers shown, hovering is unchanged.
- Affected areas: `hover.js` (new, `nearestIndex`), `app.js` (`snapAt`, `clearSnap`, the snap layer), `style.css`, `index.html` (loads `hover.js`), README and `docs/design.md` §6.8.
- Tests: 8 browser cases in `integration/compare-points.spec.js` (one #24 case updated: with markers hidden its crosshair now snaps) and 3 unit cases in `tests/hover.test.cjs`.
- Validation on 2026-10-26: `npm run test:unit` 31 passed; Chromium browser suite 48 passed, repeated three times with no flakes. Firefox and WebKit not run locally.

### Shared crosshair (issue #24, story #23)

- Hovering either chart's plot area shows a dashed crosshair on both charts at the same X and Y values, with the values read off each axis. Readouts follow log scales and gain digits as you zoom in. Focusing a marker with the keyboard puts the crosshair through it.
- The crosshair hides when the pointer leaves the plot, while dragging to pan, and when the page scrolls (except on a focused point). It ignores the pointer, so marker tooltips still work, and it is left out of exported images.
- Affected areas: `app.js` (crosshair layer and pointer handling, export), `scale.js` (`formatReadout`), `style.css`, the hint in `index.html`, README and `docs/design.md` §6.7.
- Tests: `integration/compare-points.spec.js` (11 browser cases) and two unit cases for `formatReadout` in `tests/scale.test.cjs`.
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

### Zoom out and pan past the data (issue #21)

- Zoom out now goes past the data, down to 0.1x, and dragging pans past the data's edges. Views stay inside a limit centered on the data. Reset zoom returns to the data's range and stays enabled whenever the view differs from it.
- `view.js`: `MAX_SPAN`, a limit for `placeRange`, `isFullView` only for the data's own range, and `zoomLevel` reports the axis furthest from 1x. `scale.js`: positions and ticks continue past the data, log ticks add decades, and ticks stop at the largest finite numbers.
- Validation: unit tests written first (6 new or changed), then the code. 31 unit tests pass, and the zoom-out end-to-end tests pass in Chromium and Firefox. The minimap tests fail until issue #22.

### Minimap (issue #22)

- A minimap below the zoom buttons shows all the data and a box for the view, with a caption giving the visible ranges. Drag the box to pan, click elsewhere to center the view there, or use the arrow keys when it has focus.
- `view.js`: `overviewRange`, the minimap's frame (the data and the view together). `app.js`: `chartAxes`, shared by both charts and the minimap.
- Fixed: in Chromium, a second drag on a chart could stop after one step, because the first drag had selected tick labels and the browser started dragging the selection. The charts and minimap are no longer text-selectable.
- Validation: unit test written first, then the code. 32 unit, 10 integration and 80 browser tests (Chromium and Firefox) pass, and the zoom specs passed 5 repeated runs.

### JSON import (issue #32)

- Import a `.json` file holding an array of objects with a number for each column. Errors name the item, and a failed import keeps the current chart. The import button now reads "Import data file", and the help text describes JSON.
- `data.js`: `parseJSONTable`. `app.js`: `.json` files, and unnamed files starting with `[` or `{`, go to it. Added `sample.json` and JSON versions of the test data.
- Validation: unit tests written first (5), then the code. 31 unit tests pass, and the JSON end-to-end tests pass in Chromium and Firefox.

### Spreadsheet import (issue #33)

- Import an Excel workbook (`.xlsx`). The first sheet is read like a CSV, and errors give the sheet's row numbers. Non-workbooks, including `.xls` and password-protected files, get a message saying so, and a failed import keeps the current chart.
- New `xlsx.js` with no dependencies: a zip reader using the browser's `DecompressionStream`, a small XML reader, and the CSV rules from `data.js`. `app.js` reads `.xlsx` files as bytes. Added `sample.xlsx` and `.xlsx` versions of the test data, written by openpyxl.
- Validation: unit tests written first (10 in `tests/xlsx.test.cjs`), then the code. 41 unit, 9 integration and 72 browser tests (Chromium and Firefox) pass, and the import specs passed 5 repeated runs.

### Legend position (issue #30)

- A **Legend position** menu: Auto (the corner covering the fewest points in view, the default) or one of the four corners, applied to both charts and to exports.
- New `layout.js`: `legendBox` and `emptiestCorner`. `app.js` passes each chart's point positions to `drawLegend`.
- Validation: unit tests written first (4 in `tests/layout.test.cjs`), then the code. 30 unit, 7 integration and 68 browser tests (Chromium and Firefox) pass, and the appearance specs passed 5 repeated runs.

### Chart title (issue #29)

- A **Chart title** field sets a title shown above both charts and used as the heading and `<title>` of exported images. Blank keeps the old "Line graph" and "Scatter plot" headings.
- Validation: no unit layer (markup and export wiring only). The story's end-to-end title test failed before and passes after, in Chromium and Firefox.

### Scatter point size (issue #28)

- A **Point size** slider above the scatter plot sets its point radius (2 to 12, default 6). Exports keep it, and it survives imports. The line graph's markers are unchanged.
- Validation: no unit layer (markup and drawing only). The story's end-to-end slider test failed before and passes after, in Chromium and Firefox.

### Hover keeps the line's color (issue #27)

- A hovered or focused point now keeps its line's color, with a dark ring, instead of turning orange-red. `style.css` only.
- Validation: no unit layer (no logic outside CSS). The story's end-to-end hover test failed before and passes after, in Chromium and Firefox.

### Three test layers (team meeting, Oct 23)

- **Unit** (`tests/*.test.cjs`, Node): internal logic. `tests/load.cjs` loads several scripts into one sandbox; `plot-pipeline.test.cjs` follows a CSV to chart positions and tick labels (3 new tests).
- **Integration** (`integration/*.spec.js`, Playwright): one spec per user story. The six story specs moved here from `e2e/`, unchanged apart from the helper path. Run with `npm run test:integration`.
- **End-to-end** (`e2e/*.spec.js`, Playwright): workflows across stories. `workflows.spec.js` has two for the features on `main`. `part3-workflows.spec.js` has three for the part 3 stories, marked as expected to fail until the stories they need merge.
- `docs/testing.md` and `docs/engineering-practices.md` describe the order (end-to-end first, integration per story, unit before each task) and the `story/<slug>` and `task/<slug>/<task>` branches. `playwright.config.js` runs both browser folders.
- Validation: 29 unit tests pass. In Chromium and Firefox, the 29 integration tests and 2 end-to-end workflows pass, and the 3 part 3 workflows fail as expected (68 browser results).

### Validation on 2026-10-25

- `npm ci` completed; Playwright Chromium, Firefox and WebKit installed.
- `npm test`: 26 unit tests passed; browser suite had 86 passes and one failure.
- All nine executions of the three new browser cases passed across the three engines.
- Existing WebKit test `Delete and Backspace on a focused point do not remove it` failed with zero markers instead of six. A targeted rerun reproduced it. Root cause remains unconfirmed; no runtime fix or test skip is included here.
- `git diff --check` passed.
