# Warm-Up-Graphing-Tool

A small, dependency-free CSV and XML plotting website with linked line and scatter plots.
Open `index.html` in a browser, or serve this folder with any static web server.

## Use

- Import a CSV with the header `x,y` and two finite numbers per row, or add points manually.
- Import an XML file whose root contains `<point>` elements. Each point gives `x` and `y` either as attributes or as child elements (see `sample.xml`); both forms may be mixed in one file:

  ```xml
  <points>
    <point x="1" y="3"/>
    <point><x>2</x><y>5</y></point>
  </points>
  ```

  Every point must have exactly one numeric `x` and `y`. A malformed file or invalid point is rejected and the current data is kept.
- Hover or focus a point to see its original values. Click it to review deletion; Cancel or Escape keeps the point.
- Switch X and Y independently between linear and base-10 logarithmic scales. Log scale spreads out values across orders of magnitude.
- An axis containing zero or negative values stays linear; the page explains why its log button is disabled. Adding or importing such values resets that axis to linear without removing any points. The other axis keeps its selected scale.
- Choose PNG, JPEG, or SVG below either chart and click **Export image**. The download includes the chart title, current scales, labels, and points on a white background. PNG and JPEG are 960 by 664 pixels; SVG remains scalable.

All processing and image exports happen locally in the browser. Refreshing clears the data.
Scientific notation is accepted. Tick labels remain finite for very large values, and very small or constant datasets keep valid coordinates.

## Files

- `index.html`: page controls and chart containers.
- `style.css`: layout and chart appearance.
- `scale.js`: numeric scaling and tick formatting.
- `app.js`: CSV and XML input, chart interactions, and image export.
- `sample.csv`, `sample.xml`: the same example dataset in each format.

## Numeric regression checks

With Node.js installed, run `node --test tests/scale.test.cjs`.
No dependencies or build step are required to use the website.
