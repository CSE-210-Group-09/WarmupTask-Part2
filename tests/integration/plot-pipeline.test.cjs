// Integration: the path from an imported file to chart positions, through
// data.js, scale.js and view.js together, as app.js wires them (no browser).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadScripts } = require("../load.cjs");

const {
  parseCSVTable, reconcileSelection, seriesFor, createAxis, formatTicks,
  fullView, zoomRange, viewPosition, viewRatio
} = loadScripts(["data.js", "scale.js", "view.js"], [
  "parseCSVTable", "reconcileSelection", "seriesFor", "createAxis", "formatTicks",
  "fullView", "zoomRange", "viewPosition", "viewRatio"
]);

const csv = "day,cityA,cityB\n1,14.2,9.1\n2,15,9.8\n3,13.8,10.4\n4,16.1,11";

// What drawChart does: one axis per direction across every plotted line, then the view.
function plot(text, view) {
  const table = parseCSVTable(text);
  const series = seriesFor(table, reconcileSelection(table.columns, null));
  const points = series.flatMap((line) => line.points);
  const range = (key) => [Math.min(...points.map((p) => p[key])), Math.max(...points.map((p) => p[key]))];
  const axes = { x: createAxis(...range("x")), y: createAxis(...range("y")) };
  const place = (point) => ({
    x: viewPosition(axes.x.position(point.x), view.x),
    y: viewPosition(axes.y.position(point.y), view.y)
  });
  const ticks = (key) => formatTicks(axes[key].tickRatios.map((ratio) => axes[key].tick(viewRatio(ratio, view[key]))));
  return { series, axes, place, ticks };
}

test("at full view every point lands in the plot and the extremes touch its edges", () => {
  const { series, place } = plot(csv, fullView());
  assert.deepEqual([...series.map((line) => line.name)], ["cityA", "cityB"]);
  const placed = series.flatMap((line) => line.points.map(place));
  for (const p of placed) assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
  assert.equal(Math.min(...placed.map((p) => p.x)), 0);
  assert.equal(Math.max(...placed.map((p) => p.y)), 1);
});

test("ticks at full view span every plotted column", () => {
  const { ticks } = plot(csv, fullView());
  assert.deepEqual([...ticks("x")], ["1", "1.75", "2.5", "3.25", "4"]);
  assert.deepEqual([...ticks("y")], ["9.1", "10.8", "12.6", "14.4", "16.1"]);
});

test("zooming in keeps the anchored value in place and moves other points out of view", () => {
  const view = { x: zoomRange([0, 1], 0.5, 0.5), y: [0, 1] };
  const { place, ticks } = plot(csv, view);
  assert.deepEqual([...ticks("x")], ["1.75", "2.13", "2.5", "2.88", "3.25"]);
  assert.equal(place({ x: 2.5, y: 9.1 }).x, 0.5);
  assert.ok(place({ x: 1, y: 9.1 }).x < 0 && place({ x: 4, y: 9.1 }).x > 1);
});
