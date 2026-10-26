# Change log

Record meaningful changes under Unreleased in each PR. When preparing a release, move entries into a dated version section. Describe outcomes, affected areas, and validation; use Git history for individual edits.

## Unreleased

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

### Minimap (issue #22)

- A minimap below the zoom buttons shows all the data and a box for the view, with a caption giving the visible ranges. Drag the box to pan, click elsewhere to center the view there, or use the arrow keys when it has focus.
- `view.js`: `overviewRange`, the minimap's frame (the data and the view together). `app.js`: `chartAxes`, shared by both charts and the minimap.
- Fixed: in Chromium, a second drag on a chart could stop after one step, because the first drag had selected tick labels and the browser started dragging the selection. The charts and minimap are no longer text-selectable.
- Validation: unit test written first, then the code. 32 unit, 10 integration and 80 browser tests (Chromium and Firefox) pass, and the zoom specs passed 5 repeated runs.

### Zoom out and pan past the data (issue #21)

- Zoom out now goes past the data, down to 0.1x, and dragging pans past the data's edges. Views stay inside a limit centered on the data. Reset zoom returns to the data's range and stays enabled whenever the view differs from it.
- `view.js`: `MAX_SPAN`, a limit for `placeRange`, `isFullView` only for the data's own range, and `zoomLevel` reports the axis furthest from 1x. `scale.js`: positions and ticks continue past the data, log ticks add decades, and ticks stop at the largest finite numbers.
- Validation: unit tests written first (6 new or changed), then the code. 31 unit tests pass, and the zoom-out end-to-end tests pass in Chromium and Firefox. The minimap tests fail until issue #22.

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
