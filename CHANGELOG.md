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

### Chart title (issue #29)

- A **Chart title** field sets a title shown above both charts and used as the heading and `<title>` of exported images. Blank keeps the old "Line graph" and "Scatter plot" headings.
- Validation: no unit layer (markup and export wiring only). The story's end-to-end title test failed before and passes after, in Chromium and Firefox.

### Scatter point size (issue #28)

- A **Point size** slider above the scatter plot sets its point radius (2 to 12, default 6). Exports keep it, and it survives imports. The line graph's markers are unchanged.
- Validation: no unit layer (markup and drawing only). The story's end-to-end slider test failed before and passes after, in Chromium and Firefox.

### Hover keeps the line's color (issue #27)

- A hovered or focused point now keeps its line's color, with a dark ring, instead of turning orange-red. `style.css` only.
- Validation: no unit layer (no logic outside CSS). The story's end-to-end hover test failed before and passes after, in Chromium and Firefox.

### Integration test layer

- Added `npm run test:integration` and `tests/integration/`, for tests that run several pure scripts together in Node. `tests/load.cjs` loads them into one sandbox. The first file, `plot-pipeline.test.cjs`, follows a CSV to chart positions and tick labels (3 tests).
- `docs/testing.md` and `docs/engineering-practices.md` describe the test-first workflow: end-to-end and integration tests when a story starts, unit tests before each task, with `story/<slug>` and `task/<slug>/<task>` branches.
- Validation: 26 unit and 3 integration tests pass; the browser suite (58 tests in Chromium and Firefox) is unchanged.

### Validation on 2026-10-25

- `npm ci` completed; Playwright Chromium, Firefox and WebKit installed.
- `npm test`: 26 unit tests passed; browser suite had 86 passes and one failure.
- All nine executions of the three new browser cases passed across the three engines.
- Existing WebKit test `Delete and Backspace on a focused point do not remove it` failed with zero markers instead of six. A targeted rerun reproduced it. Root cause remains unconfirmed; no runtime fix or test skip is included here.
- `git diff --check` passed.
