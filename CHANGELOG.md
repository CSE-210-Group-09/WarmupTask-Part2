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

### Spreadsheet import (issue #33)

- Import an Excel workbook (`.xlsx`). The first sheet is read like a CSV, and errors give the sheet's row numbers. Non-workbooks, including `.xls` and password-protected files, get a message saying so, and a failed import keeps the current chart.
- New `xlsx.js` with no dependencies: a zip reader using the browser's `DecompressionStream`, a small XML reader, and the CSV rules from `data.js`. `app.js` reads `.xlsx` files as bytes. Added `sample.xlsx` and `.xlsx` versions of the test data, written by openpyxl.
- Validation: unit tests written first (10 in `tests/xlsx.test.cjs`), then the code. 41 unit, 9 integration and 72 browser tests (Chromium and Firefox) pass, and the import specs passed 5 repeated runs.

### JSON import (issue #32)

- Import a `.json` file holding an array of objects with a number for each column. Errors name the item, and a failed import keeps the current chart. The import button now reads "Import data file", and the help text describes JSON.
- `data.js`: `parseJSONTable`. `app.js`: `.json` files, and unnamed files starting with `[` or `{`, go to it. Added `sample.json` and JSON versions of the test data.
- Validation: unit tests written first (5), then the code. 31 unit tests pass, and the JSON end-to-end tests pass in Chromium and Firefox. The `.xlsx` tests fail until issue #33.

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
