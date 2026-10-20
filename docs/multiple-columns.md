# Design: plotting multiple columns (issue #4)

**Story:** As a user, I want to be able to pick which columns to plot.
**Tasks:** let the user plot multiple lines; pick a target variable (X) and multiple columns (Y).

Example from the issue: `day, cityA_temp, cityB_temp` plotted as two differently colored lines against `day` (`test-data/city-temperatures.csv` and `.xml`).

## What it does

- A CSV may have any number of numeric columns under a header row. An XML `<point>` may have any number of fields, as attributes or child elements.
- After import, a **Columns to plot** panel offers an **X-axis column** menu and a checkbox and color picker for every other column. By default, a column named `x` (else the first column) is X and every other column is a line, so existing `x,y` files look as before.
- Each line gets its own color. With two or more lines, both charts show a legend, which is included in exports.
- Axis labels default to the column names: X is the X column; Y is the single line's column, or "Y" when several lines share the axis. Typed labels still override.
- Tooltips and screen-reader labels name the columns: "day: 1, cityB_temp: 9.1".
- Zoom, log scales, hidden line points and exports work across all lines.

## Design decisions

### 1. A table model in a DOM-free `data.js`

The data became `{ columns, rows }` plus a selection `{ x, ys }`, from which `seriesFor` derives one `{ name, color, points }` per line. Parsing, validation, selection and color assignment moved from `app.js` to `data.js`, which never touches the DOM, so Node unit tests cover them (`tests/data.test.cjs`, 8 tests).

Node has no `DOMParser`. Rather than add a dependency, `app.js` keeps only the DOM step for XML (reading each `<point>`'s fields as `[name, text]` pairs) and hands those records to `tableFromRecords` in `data.js`. The DOM step is covered by the browser tests.

| Option | Why not chosen / chosen |
|---|---|
| **Table + selection, series derived** (chosen) | Re-picking columns needs no re-parse; the file stays the single source of truth |
| Parse straight into series | Changing the X column would mean re-reading the file |
| An XML library or jsdom for Node tests | Adds dependencies to a project that has none |

### 2. Strict validation, same rules for CSV and XML

Every cell must be a finite number, every row must have every column, column names must be non-empty and unique. A bad file is rejected with the row or point number, and the current chart is kept. That's the policy the project already had for `x,y`.

Considered and rejected:
- **Skipping non-numeric columns:** silently hides data, and a typo in one cell would drop a whole column.
- **Treating empty cells as gaps:** a reasonable future extension, but it changes line drawing and log-scale rules, and nobody asked for it.

Behavior change: XML fields other than `x` and `y` used to be ignored; now every field of a point is a column, so a non-numeric attribute such as `id="a"` is rejected. In XML, the first point defines the columns, so a first point with only one field is reported as "The XML needs at least two columns."

### 3. Column picker: one X menu plus checkboxes

A menu for X (exactly one) and checkboxes for Y (one or more) mirror the story: pick a target variable, then multiple columns. The last checked line can't be unchecked (its box is disabled with a tooltip), so the chart is never empty.

- Choosing a plotted column as X removes it from the lines and keeps the other lines. The old X column becomes available but isn't plotted until picked, so nothing appears that the user didn't choose.
- Re-importing a file with the same columns keeps the selection and colors, which supports the "edit the CSV and import again" workflow from issue #1.

Alternatives: a multi-select list (hard to use with a mouse, hard to tell what's selected); drag-and-drop column chips (more code, harder with a keyboard).

### 4. Per-line colors replace the single "Data color" picker

The README already noted that per-series color controls would be needed for multiple columns. Each line's color picker sits next to its checkbox. A column's default color is the palette color for its position: the original blue (#245bc5) first, then the Okabe-Ito palette, chosen because it stays distinguishable for the common forms of color blindness. Colors the user picks are remembered by column name across imports. Defaults don't avoid a color the user picked for another line; that keeps the rule to one line of code, and the user can pick again.

Alternatives:
- **Keep one global color and derive shades:** shades of one hue are hard to tell apart beyond two lines.
- **A palette menu:** less control, and still no way to emphasize one line.

### 5. Legend inside the SVG

The legend is drawn in the plot's top-right corner, with a white, slightly transparent background, only when there are two or more lines. Because it's part of the SVG, PNG, JPEG and SVG exports include it, with no change to the export code.

Alternatives:
- **HTML legend outside the SVG:** exports would lose it.
- **Grow the top margin for the legend:** shifts the plot geometry that zoom, pan and the tests rely on, for a gain only when the legend would cover data. Zooming or panning moves data out from under it.

### 6. Axis label defaults come from column names

With arbitrary columns, "X" and "Y" stop being informative. The defaults are now the column names, shown as the label inputs' placeholders so users can see what a blank label falls back to. With several lines on the Y axis, the label falls back to "Y" and the legend names the lines. Behavior change: for an `x,y` file, blank labels now read "x" and "y" instead of "X" and "Y".

## Testing

- **Unit (`tests/data.test.cjs`):** CSV tables (header order, quoting, scientific notation, the old `x,y` format) and every CSV error; XML records (field order, every validation error, messages listing the columns); default and carried-over selections; series sorted by X; color assignment (original blue first, user choices kept, palette by position, cycling past the palette).
- **Browser (`e2e/pick-columns.spec.js`):** the issue's three-column example plots two colored lines with a legend; tooltips name columns; unchecking removes a line and the last line is locked; changing X re-plots; per-line colors survive re-import; CSV and XML versions plot identically; zoom, log scale and SVG export with two lines; mismatched rows and missing XML fields are rejected and the chart is kept.
- **Updated:** `customize-appearance.spec.js` uses the per-line color picker and expects column-name label defaults.
