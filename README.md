# Warm-Up-Graphing-Tool

A small, dependency-free CSV and XML plotting website with linked line and scatter plots of one or more columns.
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
- The imported file is the only source of data, points can't be added or deleted on the page. To change the data, edit the file and import it again.
- Hover or focus a point to see its original values.
- Uncheck **Show data points** above the line graph to see the line without markers. The scatter plot keeps its points, and exported images use the current visibility setting.
- Under **Columns to plot**, pick the **X-axis column** and check the columns to draw as lines. Each line has its own color picker; colors persist across imports and scale changes and apply to exports. With two or more lines, both charts show a legend. By default, a column named `x` (else the first column) is X and every other column is a line. See [design §6.5](docs/design.md#65-picking-columns-pr-6-issue-4).
- Switch X and Y independently between linear and base-10 logarithmic scales. Log scale spreads out values across orders of magnitude.
- An axis containing zero or negative values stays linear; the page explains why its log button is disabled. Importing such values resets that axis to linear without removing any points. The other axis keeps its selected scale.
- Zoom with **Ctrl + scroll** (**⌘ + scroll** on a Mac) or a trackpad pinch over either chart, or with the **Zoom in** and **Zoom out** buttons. Drag a zoomed chart to pan. **Reset zoom** shows all points again. Both charts share the view, exported images show it, and importing or switching an axis scale resets it. See [design §6.4](docs/design.md#64-zoom-pan-and-reset-pr-5-issue-2).
- Type X- and Y-axis labels to replace the defaults on both charts and in exported images. Blank labels fall back to the column names ("Y" when several lines share the Y axis).
- Choose PNG, JPEG, or SVG below either chart and click **Export image**. The download includes the chart title, current scales, labels, and points on a white background. PNG and JPEG are 960 by 664 pixels; SVG remains scalable.

All processing and image exports happen locally in the browser. Refreshing clears the data.
Scientific notation is accepted. Tick labels remain finite for very large values, and very small or constant datasets keep valid coordinates.

## Files

- `index.html`: page controls and chart containers.
- `style.css`: layout and chart appearance.
- `scale.js`: numeric scaling and tick formatting.
- `view.js`: zoom and pan state.
- `data.js`: parsing files into a table of columns, column selection, and line colors.
- `app.js`: CSV and XML input, chart interactions, and image export.
- `sample.csv`, `sample.xml`: the same example dataset in each format.
- `test-data/`: a larger growth dataset and a three-column city temperature dataset, each in both formats.
- `docs/design.md`: every design decision in the project, with the reasons and the alternatives considered.
- `docs/testing.md`: how to run the tests.

## Tests

Unit tests need only Node.js: `node --test tests/*.test.cjs`. Browser tests use Playwright: `npm install`, `npx playwright install chromium`, then `npm run test:e2e`. See [docs/testing.md](docs/testing.md).
No dependencies or build step are required to use the website.
