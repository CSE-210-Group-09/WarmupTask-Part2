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
| Part 3, issue #20 | Zooming out and panning past the data, minimap |
| Part 3, issue #26 | Hover color, point size, chart title, legend position |
| Part 3, issue #31 | JSON and spreadsheet import |
| Issue #24 | Shared crosshair on both charts |
| Issue #25 | Snapping to the nearest point when line markers are hidden |

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

A single web page that plots numeric data from a CSV, XML, JSON or Excel (.xlsx) file as two linked charts, a line graph and a scatter plot. Everything happens in the browser: files are read locally, nothing is uploaded, and refreshing clears the data. You can open `index.html` directly or serve the folder with any static server.

The user stories it serves:

| Story | Where it's delivered |
|---|---|
| I don't want to be able to modify the chart after creating it | PR #1 |
| I want to be able to properly view 100+ points | PR #3 (hide markers), PR #5 (zoom, pan, reset) |
| I want to be able to customize the appearance of the plot | PR #2 (labels), PR #3 and PR #6 (color) |
| I want to be able to pick which columns to plot | PR #6 |
| I want to create a plot from an XML file | PR #4, extended in PR #6 |
| I want to compare data points across both charts (#23) | Issue #24 (shared crosshair), issue #25 (snapping) |

## 2. How the code is organized

| File | Job |
|---|---|
| `index.html` | Page structure and controls |
| `style.css` | Layout and chart styling |
| `scale.js` | Maps values to positions on an axis and formats tick labels. No DOM access. |
| `view.js` | Zoom and pan state. No DOM access. |
| `layout.js` | Where the legend goes in the plot. No DOM access. |
| `hover.js` | Finds the point nearest the pointer. No DOM access. |
| `data.js` | Parses files into a table of columns, chooses columns, assigns colors. No DOM access. |
| `xlsx.js` | Reads `.xlsx` workbooks (unzipping and XML reading) into the same table. No DOM access. |
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

Logic that doesn't touch the page lives in classic scripts that `index.html` loads with `<script defer>` and that share the global scope: `scale.js` from Team 10, plus `view.js` (PR #5), `data.js` (PR #6) and `hover.js` (issue #25). Tests load each file into a Node `vm` sandbox and call its functions directly. `tests/scale.test.cjs` from Team 10 already did this.

- **Why:** this keeps the "open `index.html` directly" property. ES modules don't load from `file://` URLs in Chrome, so switching to `import`/`export` would force everyone to run a server.
- **Considered:** ES modules with a bundler, which would give proper imports but needs a build step.
- **Trade-off:** files must load in order (`scale.js`, `view.js`, `data.js`, `hover.js`, then `app.js`), and names share one global scope.

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

- **Which parser:** `.xml` files use the XML parser and `.csv` files use the CSV parser. For other extensions, content starting with `<` is read as XML (and, since 4.7, content starting with `[` or `{` as JSON).
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

### 4.7 JSON import (issue #32)

A `.json` file is an array of objects, one per row, with a JSON number for each column: `[{"x": 1, "y": 3}, {"x": 2, "y": 5}]`. The first object names the columns, in its key order, and every object must have exactly those keys. `parseJSONTable` in `data.js` produces the same `{ columns, rows }` table as the CSV and XML parsers, so everything after import is unchanged.

- **Strict like CSV (4.2):** values must be JSON numbers. Strings such as `"3"`, booleans, `null`, nested values, missing or extra keys, and numbers too large for JavaScript (`1e400`) reject the file with a message naming the item. Unlike CSV and XML, JSON has a number type, so a quoted `"3"` is the file saying it isn't a number.
- **Errors:** "The JSON is not valid." for a syntax error. For any other shape, the message shows an example of the expected one.
- **Considered:** an object of columns (`{"x": [1, 2], "y": [3, 4]}`), which is compact but makes rows of unequal length easy to write and harder to report. Accepting several shapes means more rules to explain for little gain, so we started with the shape most tools export (`df.to_json(orient="records")` in pandas, `JSON.stringify` of an array of records).

### 4.8 Spreadsheet import (issue #33)

An `.xlsx` file's first worksheet becomes a table under the same rules as a CSV: the first filled row names the columns, and every later filled row needs a number in each of them. Errors give the sheet's own row numbers, so "Row 7" is row 7 in Excel.

**How it's read, with no library.** An `.xlsx` file is a zip archive of XML parts. `xlsx.js`:
1. `readZip` lists the parts from the zip's central directory.
2. `unzipText` inflates each part with the browser's built-in `DecompressionStream("deflate-raw")`.
3. `parseXMLTree` reads the parts. It's a small reader for the plain XML that spreadsheet programs write: it drops namespace prefixes and decodes entities and CDATA.
4. `parseXLSX` follows the workbook's first sheet through its relationships file to the sheet's part, and reads shared strings, inline strings and numbers.
5. `tableFromCells` applies the CSV rules.

| Decision | Why | Considered |
|---|---|---|
| `.xlsx` without a library | Keeps the no-dependency design (3.1), and the format's parts are plain XML in a zip | SheetJS: least code, but the app's first runtime dependency, and a large one TSV and pasted cells: smallest change, but users still couldn't open an `.xlsx` |
| Our own XML reader instead of `DOMParser` | Node has no `DOMParser`, so this keeps the whole path unit-testable (the lesson of 4.5, where XML field reading could only be browser-tested). Workbook XML is machine-written and regular. | `DOMParser` in `app.js`, testable only in browsers |
| First worksheet, in the workbook's tab order | The common case, with nothing to choose | A sheet picker, which can come later if asked for |
| Formula cells use the result Excel saved | No formula engine needed, and it's the value the user sees | Rejecting formulas |
| Text that is a number counts, booleans and error cells don't | Same as CSV, where everything is text | Rejecting all text cells |
| Empty styled cells are ignored | Spreadsheet programs write formatting-only cells around data | Treating them as gaps |

- **Errors:**
  - Anything that isn't a zip with a workbook gets one message naming the likely causes: older `.xls` files and password-protected workbooks, which are a different container format.
  - A missing sheet: "The workbook has no worksheets."
  - Unknown compression or damaged data have their own messages.
- **Tested against:** workbooks written by openpyxl (inline strings, absolute part paths), and workbooks built in the tests in Excel's layout (shared strings, relative paths, rich text, formulas). We haven't tested a file saved by Excel or Google Sheets themselves.

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
- Zoom out goes past the data, down to 0.1x, where the data fills the middle tenth of each axis (issue #21).
- Dragging a zoomed-in or zoomed-out chart pans it, past the data if you like.
- Zoom in, Zoom out and Reset zoom buttons do the same from the keyboard.
- A status line reads "Showing all points." at the data's own range, otherwise "Zoomed 4x." or "Zoomed 0.5x."

**How the view is stored.** `view.js` keeps the visible part of each axis as fractions of the data's range, `[start, end]`, where `[0, 1]` is the data and `[-0.5, 1.5]` the data with half its width of space on each side. `createAxis` positions and ticks continue past 0 and 1 in a straight line (linear) or by decades (log). Drawing maps a value through its axis (5.1) and then through the view.

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
| 0.1x to 1000x; views stay inside a limit centered on the data, `[-4.5, 5.5]` (issue #21) | Zooming out shows the data in context and makes room to pan past its edges. The limit keeps the data findable, and the minimap shows where the view is. | Stopping at the data's range (part 2: you can't get lost, but can't see past the edges); unlimited zoom out, where the data shrinks to a dot |
| Only the data's own range counts as the full view | Reset zoom stays enabled and the status shows the level whenever the view differs, including when zoomed out or panned at 1x | Treating any view that contains all the data as full, which would disable Reset when zoomed out |
| Drag pans whenever the view isn't the full view | On touch screens a finger at the full view still scrolls the page, as in part 2 | Panning at the full view too |
| Zoom level is the axis furthest from 1x | A constant axis never zooms, so taking the narrower span (part 2) would report 1x when zoomed out | — |
| Ticks beyond the largest numbers stop at ±1.8e308 (log ticks at 5e-324) | Zooming out on data near the limits of JavaScript numbers would otherwise label ticks "Infinity" or 0 | A smaller zoom-out limit for such data |
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

### 6.6 Minimap (issue #22)

Below the zoom buttons, a small overview shows every line of the data and a box for the part in view, with a caption giving the visible ranges ("In view: x 56.9 to 94.1, y 12 to 48."). It appears once data is loaded and isn't part of exported images.

- **Frame:** `overviewRange` makes the minimap show the data and the view together. Zoomed in, the frame is the data and the box sits inside it. Zoomed out or panned away, the frame grows to include the view, so the box is never cut off and the data shows as a shaded rectangle inside it.
- **Moving the view:** drag the box to pan; press anywhere else to center the view there, then keep dragging. Arrow keys on the focused minimap pan by a tenth of the view, which is the first way to pan without a mouse. Like the charts, it does nothing at the data's own range.
- **Drag maths:** a drag keeps the frame from its start. The frame can change while the view moves past the data, and recomputing it mid-drag would change the scale under the pointer.
- **Text selection:** the charts and the minimap aren't text-selectable. A drag used to select tick labels, and in Chromium the next drag then moved that selection (the browser cancels the pointer to start drag-and-drop) instead of panning. The new test that drags three times in a row found this; it was already on main.

| Choice | Why | Considered |
|---|---|---|
| One minimap for both charts | They share one view (6.1) | One per chart, which repeats the same picture |
| Lines only, in the series colors | Cheap to draw for any number of points, and matches the line graph | Every point as a dot, which is slow for large files |
| An SVG in the zoom controls, drawn by `app.js` | Reuses the chart's axes (`chartAxes`) and view maths (`viewPosition`, `viewRatio`) | A corner of each chart, which covers data and would end up in exports |

### 6.7 Shared crosshair (issue #24)

Moving the pointer over either plot area draws a dashed vertical and horizontal line through it on **both** charts, with a dark readout on each axis giving the value there. Because the charts share their axes and view (6.1, 6.4), one position in plot fractions marks the same X and Y values on both, so the crosshair is stored once, as that position, and drawn on each chart.

- **When it shows:** inside the plot area only. It hides when the pointer leaves the plot, when a drag to pan starts (it returns on the next move), when a touch turns into a page scroll, and when the page scrolls, since the chart moves under a still pointer (the tooltip already hid on scroll for the same reason). A crosshair on a focused point stays on scroll, because it moves with its chart and tabbing to an off-screen point scrolls the page. Ctrl + wheel zoom keeps it, and the value under it, at the pointer.
- **Keyboard:** focusing a marker puts the crosshair through that point on both charts, so keyboard users can compare too.
- **Readouts:** the value at the crosshair is read through the zoomed view and the axis, so log axes and zoom work unchanged. `formatReadout` in `scale.js` shows enough digits to tell positions a pixel apart (at least 3, like ticks), so readouts gain digits as you zoom in. The X readout is kept inside the chart near its edges.
- **Drawing:** each chart gets a hidden crosshair layer when it is drawn. Pointer moves only update that layer's attributes rather than redrawing the chart (`setCrosshair`, `placeCrosshair` in `app.js`). The layer sits below the markers and ignores the pointer, so markers keep their tooltips. Screen readers skip it (`aria-hidden`): focused markers already announce their values.
- **Export:** the crosshair is removed from exported images, since it follows the pointer rather than being part of the chart.

| Choice | Why | Considered |
|---|---|---|
| Free crosshair that follows the pointer exactly | Matches the issue; lets you read any position, between points too | Snapping everywhere; issue #25 snaps only where there are no markers to hover (6.8) |
| One position shared by both charts | Same values on both by construction | Mapping data values per chart, which is the same thing here with more code |
| Update a layer instead of redrawing | Pointer moves fire many times a frame; a full redraw per move would be slow with many points | Calling `render()` on every move |
| Readouts on the axes | Show exact values without covering data | A floating label beside the pointer, which covers points and the tooltip |

### 6.8 Snapping to the nearest point (issue #25)

With "Show data points" off, the line graph has no markers, so there was nothing to hover and no way to read values. Now hovering anywhere in its plot area snaps to the data point nearest the pointer **by X**:

- A small dot in the line's color marks each line's point at that X, and the tooltip lists the X value and every line's value there ("day: 8", "cityA_temp: 19.2", "cityB_temp: 12.8"). With one line it reads like a marker's tooltip.
- The crosshair (6.7) snaps to the same point on both charts, through the dot nearest the pointer, so the readouts show that point's values.
- Only points in the zoomed view can be snapped to. A value above or below the view is still listed, without a dot.
- It clears when the pointer leaves the plot, when a drag to pan starts, and when the page scrolls. A redraw (Ctrl + wheel zoom, import, scale switch) snaps again where the pointer is.
- With markers shown, hovering works as before: markers show their own tooltips and nothing snaps. The scatter plot always has markers, so it never snaps.
- The dots are left out of exported images, like the crosshair.

**Code:** `nearestIndex` in `hover.js` picks the nearest X position, skipping points outside the view. `snapAt` and `clearSnap` in `app.js` draw the dots in a layer above the crosshair and show the tooltip.

| Choice | Why | Considered |
|---|---|---|
| Nearest by X, with no distance limit | Matches the issue; on a line graph X is what you move along, and any position reads a value | Nearest by straight-line distance within a radius, which leaves gaps where nothing shows |
| Every line's value at that X | All lines share the X column, so one X gives one value per line to compare | Only the line nearest the pointer |
| Only when markers are hidden | With markers shown, hovering a marker already works and the issue asks for no change | Snapping always, which would change existing behavior |

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
- **Hover and focus (issue #27):** a hovered or focused point keeps its line's color and gets a dark ring (`#202b3c`, 3 units wide). Team 10 turned every hovered point orange-red, which ignored the color you chose and could match another line. A dark ring shows against every palette color, including yellow. **Considered:** a bigger radius, which can't be set from CSS in every browser and shifts neighbouring points' hit areas, or a lighter shade of the line's color, which needs a color per line in the stylesheet.
- **Considered:** shades of one color, which are hard to tell apart beyond two lines, or a palette menu, which offers less control.

### 7.3 Legend inside the chart (PR #6)

With two or more lines, a legend in the plot's top-right corner names each color. With one line there's no legend, because the axis label names it.

- **Why inside the SVG:** exports include it with no extra code.
- **Considered:** an HTML legend beside the chart, which would be missing from exports, or a bigger top margin to hold it, which shifts the plot area that zoom, pan and the tests rely on. Zooming or panning moves data out from under the legend.

**Moving it off the data (issue #30).** A **Legend position** menu under the line pickers offers Auto (the default) or one of the four corners. The choice applies to both charts and to exports, and it stays when you import new data.
- **Auto** picks the corner whose legend box covers the fewest points in view (`emptiestCorner` in `layout.js`). A point within a marker's radius of the box counts as covered. Ties go top right, top left, bottom right, bottom left, so data that leaves every corner clear keeps the part 2 position.
- Both charts count the same points, every point in view whether or not its marker is drawn, so their legends always agree. Auto runs on every redraw, so zooming or panning can move the legend.
- **Considered:**
  - Dragging the legend: free placement, but a mouse-only control with more code, and it needs a position stored per chart.
  - Only fixed corners: simple, but the user has to find the empty corner themselves.
  - Counting line segments as well as points: more maths for a small gain, since lines run between points.
- **Limit:** Auto counts points, not line segments, so a steep line between two distant points can still pass under the legend. Pick a corner by hand then.

### 7.4 Scatter point size (issue #28)

A **Point size** slider above the scatter plot sets the radius of its points, from 2 to 12 (default 6, the old fixed size), and shows the current value. Exports use it, and it survives imports.

- **Scatter plot only:** there the points are the whole chart, so their size is a real choice: small for dense clouds, large for a few points on a slide. On the line graph the markers sit on the line, and they can be hidden (6.3).
- **Why a slider:** it's a native `input type="range"`, so it already works with the keyboard and screen readers, and its `<output>` shows the number.
- **Considered:** one size for both charts, which makes line markers cover the line at large sizes, or a number field, which is slower for trying sizes out.

### 7.5 Chart title (issue #29)

A **Chart title** field, beside the axis labels, sets one title for both charts. It shows above them and names exported images: it becomes the heading drawn at the top of the image and the SVG's `<title>`. A blank title hides it, and exports go back to "Line graph" or "Scatter plot", as before.

- **One title for both charts:** they are two views of one dataset (6.1), like the shared labels and colors.
- **Drawn by the existing export code:** export already drew a heading above the chart (8), so the title replaces that text and the plot area is unchanged.
- **Considered:** drawing the title inside each chart's SVG, which would take space from the plot area that zoom, pan and the tests rely on; or a title per chart, which is twice the typing for the usual case.

## 8. Image export (Team 10; output follows later features)

Each chart exports as PNG, JPEG or SVG. The download includes the chart title, current labels, scales, colors, hidden-marker setting, zoom and legend, on a white background.

- **How:** the chart's SVG is copied, and each element's computed styles (fill, stroke, fonts) are written onto it as attributes, so the file looks right on its own without the page's CSS. Interactive attributes such as `tabindex` and `class` are removed. PNG and JPEG are drawn from that SVG onto a canvas at 960 × 664, twice the on-screen size, so they're sharp.
- **Why:** what you see is what you export, and it all happens in the browser.
- **Considered:** server-side rendering, which goes against the no-upload design, or exporting only SVG, which many slide and document tools import badly.

## 9. Accessibility

- Status messages (import result, scale explanation, zoom status, export result) are live regions, so screen readers announce them.
- The log buttons report their state with `aria-pressed`, and disabled buttons explain why in nearby text.
- Every control has a label. Markers are focusable, with labels naming each value, and the tooltip also appears on focus (6.2). Focus also shows the shared crosshair through the point (6.7).
- Zoom works from buttons as well as the wheel, and the focused minimap pans with the arrow keys, so none of the features require a mouse. The minimap's caption states the visible ranges in text.
- **Gaps:** the charts haven't been tested with a real screen reader, and there's no text alternative listing all values, such as a data table. With the line graph's markers hidden, its points can't be reached from the keyboard (snapping needs a pointer); the scatter plot's markers still can.

## 10. Testing

**Unit tests** (`tests/*.test.cjs`, Node only) cover the pure logic:
- `scale.js`: Team 10's extreme-value tests, plus tick labels when zoomed.
- `view.js`: the zoom anchor stays put, clamping, limits, conversions.
- `layout.js`: legend boxes in each corner, the emptiest corner and its tie order.
- `hover.js`: the nearest value wins, values outside the view are skipped, ties go to the first.
- `data.js`: CSV, XML and JSON tables, every validation error, selections, colors.
- `xlsx.js`: the zip reader, the XML reader, cell types and references, the table rules, finding the first sheet.

`plot-pipeline.test.cjs` runs the scripts together, the way `app.js` wires them, from parsed file to chart positions.

**Integration tests** (`integration/*.spec.js`, Playwright) have one file per user story and drive the page like a user: importing through the real file input, Ctrl + wheel, dragging, clicking, exporting. They run in Chromium and Firefox. WebKit is configured but needs system libraries our Linux server lacks.

| File | Story |
|---|---|
| `read-only-chart.spec.js` | I don't want to be able to modify the chart after creating it |
| `view-many-points.spec.js` | I want to be able to properly view 100+ points |
| `customize-appearance.spec.js` | I want to be able to customize the appearance of the plot |
| `xml-import.spec.js` | I want to create a plot from an XML file |
| `pick-columns.spec.js` | I want to be able to pick which columns to plot |
| `zoom-navigation.spec.js` | I want to keep track of where I am when zoomed in, and zoom out past the data (issue #20) |
| `file-import.spec.js` | I want to create a plot from JSON or spreadsheet files (issue #31) |
| `appearance-settings.spec.js` | I want the chart to look the way I set it up (issue #26) |
| `compare-points.spec.js` | I want to compare data points across both charts (#23): shared crosshair (#24), snapping (#25) |

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
- Zoomed out on data near ±1.8e308, the outer ticks repeat the largest number (6.4).
- No pinch-to-zoom on phones (6.4).
- Untested with a real screen reader; no data-table alternative (9).
- Default line colors can repeat a color you picked (7.2).
- Spreadsheets: only `.xlsx` and only the first sheet; dates arrive as Excel's day numbers; no `.xls`, `.ods` or files over 4 GB (4.8).
