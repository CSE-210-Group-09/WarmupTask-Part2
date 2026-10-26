# Testing

The website itself has no dependencies or build step. npm is only needed for the browser tests.

```sh
npm install                       # once: installs @playwright/test (dev only)
npx playwright install chromium   # once: add firefox webkit to test all three engines
npm run test:unit                 # node --test tests/*.test.cjs (no install needed)
npm run test:integration          # node --test tests/integration/*.test.cjs (no install needed)
npm run test:e2e                  # Playwright, serves the site with e2e/server.cjs
```

## Three layers, written test first

| Layer | Where | What it covers | Written |
|---|---|---|---|
| End-to-end | `e2e/*.spec.js` | The page in real browsers, driven like a user | First, when a story starts |
| Integration | `tests/integration/*.test.cjs` | Several pure scripts together (`data.js`, `scale.js`, `view.js`, ...), the way `app.js` wires them, in Node | With the end-to-end tests, one file per story |
| Unit | `tests/*.test.cjs` | One pure script's functions | At the start of each task, before the code |

Each story has a staging branch, `story/<slug>`, and each task a scratch branch off it, `task/<slug>/<task>` (the names are in the issues).

1. On the story branch, commit the story's end-to-end and integration tests first. They fail until the story is done.
2. On each task branch, commit the unit tests for the functions the task adds or changes, then the code that makes them pass. Tasks with no pure logic (CSS, markup) have no unit layer; the story's end-to-end tests are their failing tests.
3. A task PR targets the story branch. The story PR into `main` goes green when every task has merged.

## Unit tests (`tests/`)

Pure logic lives in plain scripts (`data.js`, `scale.js`, `view.js`) that the page loads with `<script>` tags. The tests load each file into a Node `vm` sandbox, as `tests/scale.test.cjs` already did, so no module system or bundler is needed. Arrays returned from the sandbox have a different `Array` prototype; spread them (`[...value]`) before `assert.deepEqual`.

## Integration tests (`tests/integration/`)

`tests/load.cjs` loads several scripts into one sandbox, the way the page's `<script>` tags share one global scope, and returns the functions a test names. A name that doesn't exist yet comes back `undefined`, so a test written before its feature fails on its own rather than breaking the whole file. `plot-pipeline.test.cjs` follows a CSV through parsing, column selection, axes and the zoomed view to chart positions and tick labels. `file-import.test.cjs` checks that the JSON and `.xlsx` fixtures give the same tables and lines as their CSV files. `tests/zip.cjs` builds `.xlsx` workbooks in memory for tests.

## Browser tests (`e2e/`)

One file per user story, each test named after the behaviour it checks:

| File | Story |
|---|---|
| `read-only-chart.spec.js` | I don't want to be able to modify the chart after creating it |
| `view-many-points.spec.js` | I want to be able to properly view 100+ points |
| `customize-appearance.spec.js` | I want to be able to customize the appearance of the plot |
| `import-recovery.spec.js` | Failed imports preserve configured plots; corrected files can be re-imported |
| `xml-import.spec.js` | I want to create a plot from an XML file |
| `pick-columns.spec.js` | I want to be able to pick which columns to plot |
| `file-import.spec.js` | I want to create a plot from JSON or spreadsheet files |

Tests drive the page like a user: importing through the real file input, the mouse wheel with Ctrl held, dragging, and clicking. They assert what the user sees (markers, tick labels, the status line) and exported files.

Gotchas:
- The charts are below the fold of the default 1280 × 720 window. Scroll a chart into view before aiming the mouse at it (`plotPoint` does this); a pointer outside the window hits nothing.
- Redraws wait for the next animation frame. After a zoom, wait for `#zoom-status` to change before counting markers.
