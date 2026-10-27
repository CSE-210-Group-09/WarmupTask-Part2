# Testing

The website itself has no dependencies or build step. npm is only needed for the browser tests.

```sh
npm install                       # once: installs @playwright/test (dev only)
npx playwright install chromium   # once: add firefox webkit to test all three engines
npm run test:unit                 # node --test tests/*.test.cjs (no install needed)
npm run test:e2e                  # Playwright, serves the site with e2e/server.cjs
```

## Unit tests (`tests/`)

Pure logic lives in plain scripts (`data.js`, `scale.js`, `view.js`, `hover.js`) that the page loads with `<script>` tags. The tests load each file into a Node `vm` sandbox, as `tests/scale.test.cjs` already did, so no module system or bundler is needed. Arrays returned from the sandbox have a different `Array` prototype; spread them (`[...value]`) before `assert.deepEqual`.

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
| `compare-points.spec.js` | I want to compare data points across both charts (#23); shared crosshair (#24), snapping (#25) |

Tests drive the page like a user: importing through the real file input, the mouse wheel with Ctrl held, dragging, and clicking. They assert what the user sees (markers, tick labels, the status line) and exported files.

Gotchas:
- The charts are below the fold of the default 1280 × 720 window. Scroll a chart into view before aiming the mouse at it (`plotPoint` does this); a pointer outside the window hits nothing.
- Redraws wait for the next animation frame. After a zoom, wait for `#zoom-status` to change before counting markers.
- A page scroll hides the crosshair. Scroll the charts into view and wait a frame before hovering, as `compare-points.spec.js` does in `beforeEach`.
