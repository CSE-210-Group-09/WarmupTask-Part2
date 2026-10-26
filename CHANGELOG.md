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
