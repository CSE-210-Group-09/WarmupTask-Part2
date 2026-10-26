// Integration for the zoom navigation story (issue #20): view.js and scale.js
// together, from a zoomed or panned view to the values on screen and the
// minimap's frame. Written before the story's code; see docs/testing.md.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadScripts } = require("./load.cjs");

const {
  MAX_SPAN, fullView, isFullView, placeRange, zoomRange, panRange, overviewRange,
  viewPosition, viewRatio, zoomLevel, createAxis, formatTicks
} = loadScripts(["scale.js", "view.js"], [
  "MAX_SPAN", "fullView", "isFullView", "placeRange", "zoomRange", "panRange", "overviewRange",
  "viewPosition", "viewRatio", "zoomLevel", "createAxis", "formatTicks"
]);

const close = (actual, expected, digits = 9) =>
  assert.ok(Math.abs(actual - expected) < 10 ** -digits, `${actual} is not close to ${expected}`);
const axis = createAxis(1, 150);
const ticks = (range, on = axis) => formatTicks(on.tickRatios.map((ratio) => on.tick(viewRatio(ratio, range))));
const onScreen = (value, range, on = axis) => viewPosition(on.position(value), range);

test("zooming out from the full view shows values past both ends of the data", () => {
  const range = zoomRange([0, 1], 0.5, 2);
  assert.deepEqual([...ticks(range)], ["-73.5", "1", "75.5", "150", "225"]);
  close(onScreen(1, range), 0.25);
  close(onScreen(150, range), 0.75);
  const view = { x: range, y: range };
  assert.equal(isFullView(view), false, "a zoomed-out view is not the reset view");
  close(zoomLevel(view), 0.5);
});

test("zooming out stops at MAX_SPAN, with the data in the middle", () => {
  assert.equal(MAX_SPAN, 10);
  let range = [0, 1];
  for (let i = 0; i < 20; i++) range = zoomRange(range, 0.5, 2);
  close(range[0], -4.5);
  close(range[1], 5.5);
  close(onScreen(1, range), 0.45);
  close(onScreen(150, range), 0.55);
});

test("panning goes past the data and stops at the zoom-out limit", () => {
  const zoomed = [0.375, 0.625];
  // Two plot widths to the left: the last point sits mid-plot, empty space after it.
  const panned = panRange(zoomed, -2);
  close(panned[0], 0.875);
  close(panned[1], 1.125);
  close(onScreen(150, panned), 0.5);
  const farthest = panRange(zoomed, -1000);
  close(farthest[1], 5.5);
  close(viewRatio(1, farthest) * 149 + 1, 150 + 4.5 * 149);
  close(panRange(zoomed, 1000)[0], -4.5);
});

test("a zoomed-out log axis gains decades and stays positive", () => {
  const log = createAxis(1, 1000, true);
  const range = zoomRange([0, 1], 0.5, 2);
  const values = log.tickRatios.map((ratio) => log.tick(viewRatio(ratio, range)));
  close(Math.log10(values[0]), -1.5);
  close(Math.log10(values[4]), 4.5);
  for (const value of values) assert.ok(value > 0);
  close(onScreen(1, range, log), 0.25);
});

test("reset gives back exactly the data's ticks", () => {
  const before = ticks(fullView().x);
  const view = { x: panRange(zoomRange([0, 1], 0.3, 4), 0.5), y: [0, 1] };
  assert.equal(isFullView(view), false);
  assert.deepEqual([...ticks(fullView().x)], [...before]);
  assert.ok(isFullView(fullView()));
});

test("zoom level reads below 1 when zoomed out, ignoring a constant axis", () => {
  close(zoomLevel({ x: [-0.5, 1.5], y: [0, 1] }), 0.5);
  close(zoomLevel({ x: [0.25, 0.75], y: [0, 1] }), 2);
});

test("the minimap frame covers the data and the view, and centers on a click", () => {
  assert.deepEqual([...overviewRange([0.375, 0.625])], [0, 1]);
  assert.deepEqual([...overviewRange([-0.5, 1.5])], [-0.5, 1.5]);
  assert.deepEqual([...overviewRange([0.8, 1.3])], [0, 1.3]);
  // The view box and the data inside the frame, as fractions of the minimap.
  const frame = overviewRange([0.8, 1.3]);
  close(viewPosition(0.8, frame), 0.8 / 1.3);
  close(viewPosition(1, frame), 1 / 1.3);
  // Clicking at a frame position centers the view there, inside the limit.
  const span = 0.25;
  const center = viewRatio(0.9, [0, 1]);
  const centered = placeRange(center - span / 2, span);
  close(centered[0], 0.775);
  close(centered[1], 1.025);
  close(placeRange(5.4 - span / 2, span)[1], 5.5);
});
