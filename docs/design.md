# Design

This is the single record of the design decisions in this repository, from Team 10's original site to the features Team TBD (CSE 210 Group 09) added. For each decision it says what we chose, why, what else we considered, and where it lives in the code. How to run the tests is in [testing.md](testing.md).

Who decided what:

| Source | Work |
|---|---|
| Team 10 (`upstream/main`) | The original site: CSV import, linked line and scatter charts, the scaling code, log axes, tooltips, image export |
| PR #1 | Removed adding and deleting points |
| PR #2 | Editable axis labels |
| PR #3 | Hiding line markers, data color |
| PR #4 | XML import |
| PR #5 | Zoom, pan and reset zoom; browser tests for every user story |
| PR #6 | Plotting multiple columns |

## Contents

1. [What the site is](#1-what-the-site-is)
2. [How the code is organized](#2-how-the-code-is-organized)
3. [Platform and structure](#3-platform-and-structure)
4. [Data](#4-data)
5. [Scales and axes](#5-scales-and-axes)
6. [Viewing and interaction](#6-viewing-and-interaction)
7. [Appearance](#7-appearance)
8. [Image export](#8-image-export)
9. [Accessibility](#9-accessibility)
10. [Testing](#10-testing)
11. [Known limitations](#11-known-limitations)

## 1. What the site is

A single web page that plots numeric data from a CSV or XML file as two linked charts, a line graph and a scatter plot. Everything happens in the browser: files are read locally, nothing is uploaded, and refreshing clears the data. You can open `index.html` directly or serve the folder with any static server.

The user stories it serves:

| Story | Where it's delivered |
|---|---|
| I don't want to be able to modify the chart after creating it | PR #1 |
| I want to be able to properly view 100+ points | PR #3 (hide markers), PR #5 (zoom, pan, reset) |
| I want to be able to customize the appearance of the plot | PR #2 (labels), PR #3 and PR #6 (color) |
| I want to be able to pick which columns to plot | PR #6 |
| I want to create a plot from an XML file | PR #4, extended in PR #6 |

## 2. How the code is organized

| File | Job |
|---|---|
| `index.html` | Page structure and controls |
| `style.css` | Layout and chart styling |
| `scale.js` | Maps values to positions on an axis and formats tick labels. No DOM access. |
| `view.js` | Zoom and pan state. No DOM access. |
| `data.js` | Parses files into a table of columns, chooses columns, assigns colors. No DOM access. |
| `app.js` | Everything that touches the page: file input, XML reading, drawing, interaction, export |

A file goes through these steps:

1. `app.js` reads the file and `data.js` parses it into a table: `{ columns, rows }`.
2. A selection (`{ x, ys }`, one X column and one or more Y columns) turns the table into series, one line per Y column.
3. `drawChart` maps each value through its axis (`scale.js`) and then through the zoomed view (`view.js`) to SVG coordinates.
4. The same SVG is used for export.

Any change to the data, selection, scale, zoom, labels or colors redraws both charts from scratch.

## 3. Platform and structure

### 3.1 Plain HTML, CSS and JavaScript, with no dependencies (Team 10; kept)

The site has no framework, no build step and no runtime libraries. We kept that when extending it.

- **Why:** anyone can open the file and it works; there's nothing to install or keep up to date, and the code is small enough to read in one sitting.
- **Considered:** a framework such as React with a build tool, or a charting library such as Chart.js or D3. Either would add dependencies and a build step for features that took a few hundred lines by hand.
- **Exception:** `package.json` lists one development dependency, Playwright, used only to run browser tests (section 10). The site itself doesn't need npm.

### 3.2 Logic in plain scripts, tested in Node (Team 10; extended in PRs #5 and #6)

Logic that doesn't touch the page lives in classic scripts that `index.html` loads with `<script defer>` and that share the global scope: `scale.js` from Team 10, plus `view.js` (PR #5) and `data.js` (PR #6). Tests load each file into a Node `vm` sandbox and call its functions directly. `tests/scale.test.cjs` from Team 10 already did this.

- **Why:** this keeps the "open `index.html` directly" property. ES modules don't load from `file://` URLs in Chrome, so switching to `import`/`export` would force everyone to run a server.
- **Considered:** ES modules with a bundler, which would give proper imports but needs a build step.
- **Trade-off:** files must load in order (`scale.js`, `view.js`, `data.js`, then `app.js`), and names share one global scope.

### 3.3 SVG charts with a fixed coordinate system (Team 10; kept)

Each chart is an `<svg>` with `viewBox="0 0 480 300"`, scaled by CSS to fit its column. The plot area is fixed in those units (`PLOT` in `app.js`: left 96, right 438, top 20, bottom 252); the left margin leaves room for long tick labels such as `-1.23e+300` and the rotated Y label.

- **Why SVG:** it stays sharp at any size, every point is a real element (so hover, keyboard focus and screen-reader labels come almost free), and SVG export is a copy of what's on screen.
- **Considered:** Canvas. In our own part 1 project, Canvas drew 100,000+ scatter points faster than SVG, but this site targets hundreds of points, where SVG is fast enough. With Canvas we'd also have to write hit testing and accessibility ourselves.
- **Why a fixed viewBox:** layout maths happens once in fixed units, and the browser handles resizing.

## 4. Data

### 4.1 The imported file is the only source of data (PR #1, issue #1)

Team 10's site let you add points with a form and delete them by clicking (with a confirmation dialog). PR #1 removed both, so the chart always matches the file. To change the data, you edit the file and import it again.

- **Why:** an edited chart no longer matches any file, so it can't be reproduced or shared, and a stray click could delete a point.
- **Considered:** keeping editing and adding "export data". That's more UI for a workflow nobody asked for.
- **Consequence:** points are still focusable for the tooltip, but their role changed from "button" to "img", because there's nothing to activate.

### 4.2 Strict numbers, and a bad file changes nothing (Team 10; kept)

A value must be a plain decimal or scientific-notation number (`12`, `-0.5`, `1e3`). Blanks, hex, `Infinity` and units such as `12ms` are rejected. Any invalid row or point rejects the whole file with a message naming the row or point, and the current chart stays as it was.

- **Why:** a plot that silently drops or misreads values is worse than an error. Parsing `""` as 0, which JavaScript's `Number()` does, would invent data.
- **Considered:** skipping bad rows, which hides problems, or treating blank cells as gaps, which is a possible future extension but changes how lines and log scales behave.

### 4.3 Simple CSV reading (Team 10; generalized in PR #6)

Lines are split on newlines and cells on commas; quotes around a whole cell are removed; blank lines are skipped. Team 10 required the header to be exactly `x,y`. PR #6 accepts any header of two or more non-empty, unique column names, with one number per column on every row.

- **Why:** the data is numeric, so the edge cases a full CSV parser handles (commas or line breaks inside quoted text) don't come up.
- **Considered:** a full RFC 4180 parser, which is more code for cases numeric data doesn't have.
- **Limitation:** a quoted column name containing a comma isn't supported.

### 4.4 XML import (PR #4; generalized in PR #6)

The file can have any root element. Each `<point>` is one row; its fields can be attributes (`<point x="1" y="3"/>`), child elements (`<point><x>1</x><y>3</y></point>`), or a mix of both. Names are matched by local name, so namespaced files such as `<d:point d:x="1">` work.

- **Which parser:** `.xml` files use the XML parser and `.csv` files use the CSV parser. For other extensions, content starting with `<` is read as XML.
- **Detecting malformed XML:** browsers report it by inserting a `<parsererror>` element in a browser-specific namespace. The code learns that namespace once by parsing a known-bad string, so a valid file that happens to contain its own `<parsererror>` element isn't rejected. This, and reading namespaced attributes, were fixed while merging PR #4.
- **Columns (PR #6):** the first point's fields name the columns, and every point must give each of them exactly once. Extra fields are rejected rather than ignored, the same strictness as CSV.
- **Considered:** a fixed schema with only `x` and `y`, which is too narrow once multiple columns exist, or JSON, which wasn't requested.

### 4.5 A table plus a selection, with series derived from it (PR #6)

The data is a table, `{ columns, rows }`, plus a selection, `{ x, ys }`. `seriesFor` derives one line per Y column. Parsing, validation, selection and color logic are in `data.js` so they can be unit-tested. Only the step that reads fields out of the XML document stays in `app.js`, because Node has no `DOMParser`.

- **Why:** changing which columns are plotted doesn't re-read the file, and the file stays the single source of truth.
- **Considered:** parsing straight into series, which means re-reading the file whenever the X column changes. Using an XML library or jsdom so XML parsing could be tested in Node would add dependencies; the XML reading is covered by browser tests instead.

### 4.6 Lines connect points in ascending X order (Team 10; kept)

Each line is drawn through its points sorted by X, not in file order.

- **Why:** for the intended data (measurements against a variable) this gives a clean line even if the file isn't sorted.
- **Considered:** file order, which supports loops and paths but zigzags when rows are unsorted.
- **Limitation:** a path that doubles back can't be drawn as a line.

## 5. Scales and axes

### 5.1 Axes as positions from 0 to 1, safe at extreme values (Team 10)

`createAxis(min, max, log)` returns `position(value)`, a fraction from 0 to 1, and `tick(ratio)`, the value at a fraction. It's written to stay finite across the whole range of JavaScript numbers. For example, it interpolates with weighted endpoints when `max - min` would overflow (as with ±1.8e308), and it halves values only when the span is not finite, because halving subnormal numbers can erase the range. `tests/scale.test.cjs` checks extremes, subnormals and constant data.

### 5.2 Log scale per axis, only for positive data (Team 10)

Each axis can switch between linear and base-10 log on its own. Log is available only when every value on that axis is positive; otherwise the button is disabled and the page says why. Importing data with zero or negative values resets that axis to linear without removing points.

- **Considered:** symlog or log(1 + x) to allow zeros. That's more to explain, and nobody asked for it.

### 5.3 Ticks: five even positions, digits as needed (Team 10; extended in PR #5)

Ticks sit at 0, ¼, ½, ¾ and 1 of the visible range; a constant axis gets one centered tick. Team 10 labeled ticks with three significant digits. When zoomed in, that makes every tick read the same (1000.0 to 1000.4 all become "1e+3"), so `formatTicks` raises the precision until different values get different labels. Full-view labels are unchanged.

- **Considered:** "nice" round tick values, which would mean rewriting Team 10's tested tick logic. Even positions keep the grid stable while zooming.

## 6. Viewing and interaction

### 6.1 Two linked views of one dataset (Team 10)

The line graph and scatter plot always show the same data, scales, labels, colors and zoom. The scatter plot shows every point; the line graph shows the trend.

### 6.2 Tooltips on hover and on keyboard focus (Team 10)

Every marker can receive keyboard focus. Hovering or focusing shows a tooltip with its values, placed to the right of the point, or to the left near the window edge. Its screen-reader label carries the same text. Since PR #6, the tooltip names the columns ("day: 1, cityB_temp: 9.1"), so values from different lines can be told apart. Scrolling or resizing hides the tooltip so it never floats away from its point.

### 6.3 Hiding line markers (PR #3, issue #3)

A "Show data points" checkbox, on by default, hides the markers on the line graph only, because with many points they cover the line. The scatter plot keeps its points, since they're its whole purpose. The setting survives imports and scale changes, and exports follow it.

### 6.4 Zoom, pan and reset (PR #5, issue #2)

**What the user can do:**
- Ctrl + scroll (⌘ + scroll on a Mac), or a trackpad pinch, zooms around the pointer.
- Dragging a zoomed chart pans it.
- Zoom in, Zoom out and Reset zoom buttons do the same from the keyboard.
- A status line reads "Showing all points." or "Zoomed 4x."

**How the view is stored.** `view.js` keeps the visible part of each axis as fractions of the whole, `[start, end]`, where `[0, 1]` means everything. Drawing maps a value through its axis (5.1) and then through the view.

| Option | Verdict |
|---|---|
| **Fractions of the transformed axis** (chosen) | Linear and log axes zoom with the same code, and `scale.js` and its overflow guards stay untouched |
| Data-value bounds | Needs separate linear and log maths, and differences of extreme values overflow |
| SVG `viewBox` zoom | Simplest, but scales text, line widths and markers with the data, and tick labels don't update |

**Other choices:**

| Choice | Why | Considered |
|---|---|---|
| Ctrl/⌘ + scroll to zoom; a plain scroll still scrolls the page | The page is long and both charts are on it, so a plain-scroll zoom would trap anyone scrolling past. A trackpad pinch sends Ctrl + wheel, so pinch works without extra code. | Plain-scroll zoom; a zoom-mode toggle; drag-a-box zoom, which conflicts with drag-to-pan |
| One shared view for both charts | Keeps the two linked views showing the same points | A separate view per chart, which needs two reset buttons and lets the charts disagree |
| Both axes zoom together | Keeps dense scatter clusters readable | X-only zoom |
| An axis with a single value stays at full range | There's nothing to zoom into; its point stays centered | — |
| 1x to 1000x, and panning stays inside the data | The user can't get lost off-screen | Unlimited zoom |
| Points outside the view aren't drawn; the line is clipped to the plot | Fewer markers when zoomed, a shorter tab order, and exports that match the screen. The line still uses every point, so its slope at the edges is right. | Drawing everything |
| Drag pans from the view at the start of the drag | Rounding can't build up over a long drag | Adding up each move |
| Redraws are grouped to one per animation frame | Wheel and drag fire many events per frame | Redrawing on every event |
| Importing or switching linear/log resets the view | The same fractions mean different values after either change | Trying to keep the visible values |

**Limits:** there's no two-finger zoom on phones (the buttons work there). While zoomed, a finger on a chart pans it instead of scrolling the page.

### 6.5 Picking columns (PR #6, issue #4)

After import, a "Columns to plot" panel shows a menu for the X column and a checkbox per remaining column. By default, a column named `x` (otherwise the first column) is X and every other column is a line, so an `x,y` file looks the same as before.

- The last checked line can't be unchecked, so the chart is never empty.
- Choosing a plotted column as X removes it from the lines and keeps the other lines. The old X column becomes available but isn't plotted until you check it.
- Re-importing a file with the same columns keeps the selection and colors, which suits the "edit the file and import again" workflow from 4.1.
- Changing the columns resets the zoom, because the ranges change.
- **Considered:** a multi-select list, which is hard to use with a mouse and hard to read, or drag-and-drop column chips, which is more code and weaker for keyboard users.

## 7. Appearance

### 7.1 Editable axis labels (PR #2, issue #7; defaults changed in PR #6)

Two text fields rename the X and Y axes on both charts and in exports, up to 40 characters each.

- A log axis keeps its "(log)" suffix after a custom label.
- The Y label is rotated and placed just clear of the widest tick label, replacing Team 10's small "Y" in the corner.
- A blank field falls back to a default. In PR #2 the defaults were "X" and "Y". Since PR #6 they are the column names: the X column, and the Y column when there is one line, or "Y" when several lines share the axis and the legend names them. The defaults show as the fields' placeholder text.
- **Considered:** always using column names with no override, which can't express units; or required labels, which add friction.

### 7.2 Colors (PR #3, issue #6; replaced in PR #6)

PR #3 added one "Data color" picker for the single series; its own description noted that multiple columns would need per-series pickers. PR #6 replaced it with a color picker next to each line's checkbox.

- **Default colors:** the original blue (`#245bc5`) first, then the Okabe-Ito palette, which stays distinguishable for the common types of color blindness. The rule is simply "the color you chose, otherwise the palette color for the column's position". It can repeat a color you picked for another line; we accepted that to keep the rule simple.
- **Persistence:** chosen colors are remembered by column name across imports, and exports use them.
- **Considered:** shades of one color, which are hard to tell apart beyond two lines, or a palette menu, which offers less control.

### 7.3 Legend inside the chart (PR #6)

With two or more lines, a legend in the plot's top-right corner names each color. With one line there's no legend, because the axis label names it.

- **Why inside the SVG:** exports include it with no extra code.
- **Considered:** an HTML legend beside the chart, which would be missing from exports, or a bigger top margin to hold it, which shifts the plot area that zoom, pan and the tests rely on. Zooming or panning moves data out from under the legend.

## 8. Image export (Team 10; output follows later features)

Each chart exports as PNG, JPEG or SVG. The download includes the chart title, current labels, scales, colors, hidden-marker setting, zoom and legend, on a white background.

- **How:** the chart's SVG is copied, and each element's computed styles (fill, stroke, fonts) are written onto it as attributes, so the file looks right on its own without the page's CSS. Interactive attributes such as `tabindex` and `class` are removed. PNG and JPEG are drawn from that SVG onto a canvas at 960 × 664, twice the on-screen size, so they're sharp.
- **Why:** what you see is what you export, and it all happens in the browser.
- **Considered:** server-side rendering, which goes against the no-upload design, or exporting only SVG, which many slide and document tools import badly.

## 9. Accessibility

- Status messages (import result, scale explanation, zoom status, export result) are live regions, so screen readers announce them.
- The log buttons report their state with `aria-pressed`, and disabled buttons explain why in nearby text.
- Every control has a label. Markers are focusable, with labels naming each value, and the tooltip also appears on focus (6.2).
- Zoom works from buttons as well as the wheel, and none of the features require a mouse.
- **Gaps:** the charts haven't been tested with a real screen reader, and there's no text alternative listing all values, such as a data table.

## 10. Testing

**Unit tests** (`tests/*.test.cjs`, Node only) cover the pure logic:
- `scale.js`: Team 10's extreme-value tests, plus tick labels when zoomed.
- `view.js`: the zoom anchor stays put, clamping, limits, conversions.
- `data.js`: CSV and XML tables, every validation error, selections, colors.

`plot-pipeline.test.cjs` runs the scripts together, the way `app.js` wires them, from parsed file to chart positions.

**Integration tests** (`integration/*.spec.js`, Playwright) have one file per user story and drive the page like a user: importing through the real file input, Ctrl + wheel, dragging, clicking, exporting. They run in Chromium and Firefox. WebKit is configured but needs system libraries our Linux server lacks.

| File | Story |
|---|---|
| `read-only-chart.spec.js` | I don't want to be able to modify the chart after creating it |
| `view-many-points.spec.js` | I want to be able to properly view 100+ points |
| `customize-appearance.spec.js` | I want to be able to customize the appearance of the plot |
| `xml-import.spec.js` | I want to create a plot from an XML file |
| `pick-columns.spec.js` | I want to be able to pick which columns to plot |

**End-to-end tests** (`e2e/*.spec.js`, Playwright) follow whole workflows across several stories, from import to export. Part 3's workflows were written before its stories and are marked as expected to fail until the stories they need reach `main`.

**Order:** end-to-end tests first for `main`, an integration spec first on each story branch, and unit tests before each task's code. The team agreed this on Oct 23, 2026; [testing.md](testing.md#three-layers-written-test-first) has the steps.

**Choices:**
- **Playwright** is the one dev dependency, chosen because it drives Chromium, Firefox and WebKit through a single API.
- **`e2e/server.cjs`** is a 31-line static server, so tests need nothing besides Node.
- **Considered:** testing only by hand, which is what Team 10 and PRs #1–#4 did. Writing the stories down as tests let us check that our changes didn't break the features already merged.
- **Considered for the middle layer:** Node tests of several scripts together. They can't see the page, so story-level checks would miss the DOM; those tests are unit tests here.

Totals when PR #6 was opened: 22 unit tests, and 26 browser tests on each of two browsers. See [testing.md](testing.md) for commands and gotchas.

## 11. Known limitations

- CSV: no commas or line breaks inside quoted fields (4.3).
- No gaps: every row needs every value (4.2).
- Lines are sorted by X, so paths that double back can't be drawn (4.6).
- No pinch-to-zoom on phones (6.4).
- Untested with a real screen reader; no data-table alternative (9).
- Default line colors can repeat a color you picked (7.2).
