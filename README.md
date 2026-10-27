# Warm-Up-Graphing-Tool

A small, dependency-free plotting website for CSV, XML, JSON and Excel (.xlsx) files, with linked line and scatter plots of one or more columns.
Open `index.html` in a browser, or serve this folder with any static web server.

## Use

- Import a CSV with a header row of column names and one finite number per column on every row. Two columns named `x,y` work as before.
- Import an XML file whose root contains `<point>` elements. Each field of a point is a column, given either as an attribute or as a child element (see `sample.xml` and `test-data/city-temperatures.xml`); both forms may be mixed in one file:

  ```xml
  <points>
    <point x="1" y="3"/>
    <point><x>2</x><y>5</y></point>
  </points>
  ```

  The first point names the columns; every point must have exactly one number for each of them. A malformed file or invalid point is rejected and the current data is kept.
- Import a JSON file holding an array of objects, one per row, with a number for each column (see `sample.json`):

  ```json
  [{"x": 1, "y": 3}, {"x": 2, "y": 5}]
  ```

  The first object names the columns. Values must be JSON numbers, not strings. See [design §4.7](docs/design.md#47-json-import-issue-32).
- Import an Excel workbook (`.xlsx`, see `sample.xlsx`). Its first sheet is read like a CSV: column names in the first filled row, then a number in each column on every row. Formula cells use their saved results. Older `.xls` files and password-protected workbooks can't be read. See [design §4.8](docs/design.md#48-spreadsheet-import-issue-33).
- The imported file is the only source of data, points can't be added or deleted on the page. To change the data, edit the file and import it again.
- Hover or focus a point to see its original values.
- Move the pointer over either chart to show a crosshair on both charts at the same X and Y values, with those values read off each axis. Focusing a point with the keyboard puts the crosshair through it. The crosshair hides when the pointer leaves the plot, while dragging to pan, and when the page scrolls, and it is never part of exported images. See [design §6.7](docs/design.md#67-shared-crosshair-issue-24).
- Drag **Point size** above the scatter plot to resize its points (2 to 12); exported images keep the size.
- Uncheck **Show data points** above the line graph to see the line without markers. The scatter plot keeps its points, and exported images use the current visibility setting.
- With the line graph's points hidden, hovering it snaps to the data point nearest by X: a small dot in each line's color marks that X and the tooltip lists every line's value there. The crosshair snaps to the same point. With points shown, hovering works as before. See [design §6.8](docs/design.md#68-snapping-to-the-nearest-point-issue-25).
- Under **Columns to plot**, pick the **X-axis column** and check the columns to draw as lines. Each line has its own color picker; colors persist across imports and scale changes and apply to exports. With two or more lines, both charts show a legend; **Legend position** puts it in the corner covering the fewest points (Auto) or in a corner you choose. By default, a column named `x` (else the first column) is X and every other column is a line. See [design §6.5](docs/design.md#65-picking-columns-pr-6-issue-4).
- Switch X and Y independently between linear and base-10 logarithmic scales. Log scale spreads out values across orders of magnitude.
- An axis containing zero or negative values stays linear; the page explains why its log button is disabled. Importing such values resets that axis to linear without removing any points. The other axis keeps its selected scale.
- Zoom with **Ctrl + scroll** (**⌘ + scroll** on a Mac) or a trackpad pinch over either chart, or with the **Zoom in** and **Zoom out** buttons. Zoom out goes past the data, down to 0.1x. Drag a zoomed chart to pan, past the data if you like. **Reset zoom** returns to the data's range. Both charts share the view, exported images show it, and importing or switching an axis scale resets it. See [design §6.4](docs/design.md#64-zoom-pan-and-reset-pr-5-issue-2).
- The **minimap** below the zoom buttons shows all the data and a box for the part in view. Drag the box, click elsewhere to jump there, or focus it and use the arrow keys. See [design §6.6](docs/design.md#66-minimap-issue-22).
- Type a **Chart title** to show it above both charts and use it as the heading of exported images.
- Type X- and Y-axis labels to replace the defaults on both charts and in exported images. Blank labels fall back to the column names ("Y" when several lines share the Y axis).
- Choose PNG, JPEG, or SVG below either chart and click **Export image**. The download includes the chart title, current scales, labels, and points on a white background. PNG and JPEG are 960 by 664 pixels; SVG remains scalable.

All processing and image exports happen locally in the browser. Refreshing clears the data.
Scientific notation is accepted. Tick labels remain finite for very large values, and very small or constant datasets keep valid coordinates.

## Files

- `index.html`: page controls and chart containers.
- `style.css`: layout and chart appearance.
- `scale.js`: numeric scaling and tick formatting.
- `view.js`: zoom and pan state.
- `layout.js`: where the legend goes.
- `hover.js`: finding the point nearest the pointer.
- `data.js`: parsing files into a table of columns, column selection, and line colors.
- `xlsx.js`: reading `.xlsx` workbooks into the same table, without a library.
- `app.js`: file input and XML reading, chart interactions, and image export.
- `sample.csv`, `sample.xml`, `sample.json`, `sample.xlsx`: the same example dataset in each format.
- `test-data/`: a larger growth dataset and a three-column city temperature dataset, each in both formats.
- `docs/design.md`: every design decision in the project, with the reasons and the alternatives considered.
- `docs/testing.md`: how to run the tests.

## Tests

Unit tests need only Node.js: `node --test tests/*.test.cjs`. Browser tests use Playwright: `npm install`, `npx playwright install chromium`, then `npm run test:integration` (one spec per user story) and `npm run test:e2e` (workflows across stories). See [docs/testing.md](docs/testing.md).
No dependencies or build step are required to use the website.

## Project documentation

See the [documentation guide](docs/README.md) for design, testing, feature proposals and engineering practices. The [change log](CHANGELOG.md) records additions and validation.
