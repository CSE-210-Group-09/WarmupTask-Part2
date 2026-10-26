// Integration for the appearance story (issue #26): where the legend goes, from
// data through scale.js and view.js to positions on the plot, then layout.js.
// The story's other settings (hover color, point size, title) have no logic
// outside the page and are covered by e2e/appearance-settings.spec.js.
// Written before the story's code; see docs/testing.md.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadScripts } = require("../load.cjs");

const { createAxis, fullView, viewPosition, legendBox, emptiestCorner } = loadScripts(
  ["scale.js", "view.js", "layout.js"],
  ["createAxis", "fullView", "viewPosition", "legendBox", "emptiestCorner"]
);

// The plot area of both charts (PLOT in app.js), and a two-line legend's box.
const PLOT = { left: 96, right: 438, top: 20, bottom: 252 };
const SIZE = { width: 110, height: 40 };

// What drawChart does: each point through its axis and the view to the plot.
function onPlot(points, view = fullView()) {
  const range = (key) => [Math.min(...points.map((p) => p[key])), Math.max(...points.map((p) => p[key]))];
  const axes = { x: createAxis(...range("x")), y: createAxis(...range("y")) };
  return points.map((p) => ({
    x: PLOT.left + viewPosition(axes.x.position(p.x), view.x) * (PLOT.right - PLOT.left),
    y: PLOT.bottom - viewPosition(axes.y.position(p.y), view.y) * (PLOT.bottom - PLOT.top)
  }));
}
const auto = (points, view) => emptiestCorner(onPlot(points, view), PLOT, SIZE.width, SIZE.height);
const line = (f) => Array.from({ length: 21 }, (_, i) => ({ x: i, y: f(i) }));

test("rising data puts the legend top left, falling data top right", () => {
  assert.equal(auto(line((x) => x)), "top-left");
  assert.equal(auto(line((x) => 20 - x)), "top-right");
});

test("with every corner clear, the legend stays top right, where it was in part 2", () => {
  assert.equal(auto(line(() => 5)), "top-right");
  // Ties go top right, top left, bottom right, bottom left: here only bottom right is clear.
  assert.equal(auto(line((x) => (x === 0 ? 0 : 10))), "bottom-right");
});

test("only points in view count, so zooming can move the legend", () => {
  const rising = line((x) => x);
  assert.equal(auto(rising), "top-left");
  // The first fifth of x at full height: the visible points hug the bottom edge.
  assert.equal(auto(rising, { x: [0, 0.2], y: [0, 1] }), "top-right");
});

test("every corner's box sits inside the plot, clear of the axes", () => {
  for (const corner of ["top-right", "top-left", "bottom-right", "bottom-left"]) {
    const box = legendBox(corner, PLOT, SIZE.width, SIZE.height);
    assert.ok(box.x > PLOT.left && box.x + SIZE.width < PLOT.right, corner);
    assert.ok(box.y > PLOT.top && box.y + SIZE.height < PLOT.bottom, corner);
  }
  // The part 2 position: 6 units in from the top-right corner.
  assert.deepEqual({ ...legendBox("top-right", PLOT, SIZE.width, SIZE.height) }, { x: PLOT.right - 6 - SIZE.width, y: PLOT.top + 6 });
});
