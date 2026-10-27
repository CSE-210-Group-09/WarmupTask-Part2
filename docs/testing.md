# Testing

The website itself has no dependencies or build step. npm is only needed for the browser tests.

```sh
npm install                       # once: installs @playwright/test (dev only)
npx playwright install chromium   # once: add firefox webkit to test all three engines
npm run test:unit                 # node --test tests/*.test.cjs (no install needed)
npm run test:integration          # Playwright, integration/: one spec per user story
npm run test:e2e                  # Playwright, e2e/: workflows across stories
npm test                          # all three
```

## Three layers, written test first

The layers and their order were agreed at the team meeting on Oct 23, 2026.

| Layer | Where | What it covers | Written |
|---|---|---|---|
| End-to-end | `e2e/*.spec.js` (Playwright) | Complete user workflows that cross several stories, from import to export | First, for `main`, before the stories they need |
| Integration | `integration/*.spec.js` (Playwright) | One user story in the browser: the features it combines, driven like a user | First on each story branch, one file per story |
| Unit | `tests/*.test.cjs` (Node) | Internal logic of the plain scripts, such as parsing, scales, zoom and layout, including edge cases like empty or text-filled files | At the start of each task, before the task's code |

Each story has a staging branch, `story/<slug>`, and each task a scratch branch off it, `task/<slug>/<task>` (the names are in the issues).

1. **End-to-end first, for main.** Write the workflows the iteration should support. A workflow that needs stories not yet on `main` is marked `test.fail(true, "Needs #... on main")`, which means it is expected to fail, so `main` stays green. When the last story it needs merges, the workflow passes, Playwright reports the marked test as failing, and that story's PR deletes the marker.
2. **Integration per story.** On the story branch, commit the story's integration spec before any code. It fails until every task has merged.
3. **Unit before each task.** On each task branch, commit the unit tests for the functions the task adds or changes, then the code that makes them pass. Tasks with no logic outside the page (CSS, markup) have no unit tests; the story's integration spec is their failing test.
4. A task PR targets the story branch. The story PR into `main` goes green when every task has merged.

## Unit tests (`tests/`)

Pure logic lives in plain scripts (`data.js`, `scale.js`, `view.js`) that the page loads with `<script>` tags. The tests load them into a Node `vm` sandbox, so no module system or bundler is needed. `tests/load.cjs` loads several scripts into one sandbox, the way the page's `<script>` tags share one global scope, and returns the functions a test names. A name or script that doesn't exist yet comes back `undefined`, so a test written before its code fails on its own rather than breaking the whole file. Arrays returned from the sandbox have a different `Array` prototype; spread them (`[...value]`) before `assert.deepEqual`.

`plot-pipeline.test.cjs` follows a CSV through parsing, column selection, axes and the zoomed view to chart positions and tick labels.

`zoom-navigation.test.cjs` covers zooming out and panning past the data and the minimap's frame.

## Integration tests (`integration/`)

One Playwright file per user story, each test named after the behaviour it checks:

| File | Story |
|---|---|
| `read-only-chart.spec.js` | I don't want to be able to modify the chart after creating it |
| `view-many-points.spec.js` | I want to be able to properly view 100+ points |
| `customize-appearance.spec.js` | I want to be able to customize the appearance of the plot |
| `import-recovery.spec.js` | Failed imports preserve configured plots; corrected files can be re-imported |
| `xml-import.spec.js` | I want to create a plot from an XML file |
| `pick-columns.spec.js` | I want to be able to pick which columns to plot |
| `zoom-navigation.spec.js` | I want to keep track of where I am when zoomed in, and zoom out past the data |

## End-to-end tests (`e2e/`)

| File | Workflows |
|---|---|
| `workflows.spec.js` | Explore a multi-column XML file and export what's on screen (XML import, columns, appearance, zoom, markers, export). Survive a bad edit to a large file and keep the settings (100+ points, log scale, appearance, zoom, import recovery). |
| `part3-workflows.spec.js` | Part 3, expected to fail until their stories merge: open a spreadsheet and find the zoomed-out view on the minimap (#31, #20); import JSON, then title, size, place the legend and export (#31, #26); zoomed out, the legend and hover follow the settings (#20, #26). |

`e2e/helpers.cjs` and `e2e/server.cjs` (the static server Playwright starts) serve both browser layers.

Browser tests drive the page like a user: importing through the real file input, the mouse wheel with Ctrl held, dragging, and clicking. They assert what the user sees (markers, tick labels, the status line) and exported files.

Gotchas:
- The charts are below the fold of the default 1280 × 720 window. Scroll a chart into view before aiming the mouse at it (`plotPoint` does this); a pointer outside the window hits nothing.
- Redraws wait for the next animation frame. After a zoom, wait for `#zoom-status` to change before counting markers.
