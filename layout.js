// Where the legend goes inside a chart's plot area, in SVG units. No DOM access,
// so tests can run these functions in Node.

// The corners a legend can take, in the order ties are broken: top right first,
// where part 2 always put it.
const LEGEND_CORNERS = ["top-right", "top-left", "bottom-right", "bottom-left"];
const LEGEND_MARGIN = 6;

// Top-left of a width × height legend box in a corner of the plot.
function legendBox(corner, plot, width, height) {
  return {
    x: corner.endsWith("left") ? plot.left + LEGEND_MARGIN : plot.right - LEGEND_MARGIN - width,
    y: corner.startsWith("top") ? plot.top + LEGEND_MARGIN : plot.bottom - LEGEND_MARGIN - height
  };
}

// The corner whose legend box covers the fewest of `points` ({ x, y } in SVG
// units). A point within `reach` (a marker's radius) of the box counts as covered.
function emptiestCorner(points, plot, width, height, reach = 6) {
  const counts = LEGEND_CORNERS.map((corner) => {
    const box = legendBox(corner, plot, width, height);
    return points.filter((point) =>
      point.x >= box.x - reach && point.x <= box.x + width + reach &&
      point.y >= box.y - reach && point.y <= box.y + height + reach
    ).length;
  });
  return LEGEND_CORNERS[counts.indexOf(Math.min(...counts))];
}
