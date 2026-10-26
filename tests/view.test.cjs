const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  MIN_SPAN, MAX_SPAN, fullView, isFullView, placeRange, zoomRange, panRange,
  viewPosition, viewRatio, zoomLevel
} = vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "../view.js"), "utf8") +
  "; ({ MIN_SPAN, MAX_SPAN, fullView, isFullView, placeRange, zoomRange, panRange," +
  " viewPosition, viewRatio, zoomLevel });"
);

const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} is not close to ${expected}`);
const closeRange = (actual, expected) => {
  close(actual[0], expected[0]);
  close(actual[1], expected[1]);
};

test("the full view shows everything", () => {
  const view = fullView();
  assert.deepEqual([...view.x], [0, 1]);
  assert.deepEqual([...view.y], [0, 1]);
  assert.ok(isFullView(view));
  assert.equal(zoomLevel(view), 1);
});

test("zooming keeps the value under the pointer in place", () => {
  for (const anchor of [0, 0.2, 0.5, 0.9, 1]) {
    const before = [0.1, 0.6];
    const after = zoomRange(before, anchor, 0.5);
    closeRange([after[1] - after[0], 0], [0.25, 0]);
    // The same full-range fraction sits at the same screen position.
    close(viewRatio(anchor, after), viewRatio(anchor, before));
  }
});

test("zooming out goes past the data, up to MAX_SPAN times its range", () => {
  assert.equal(MAX_SPAN, 10);
  closeRange(zoomRange([0, 1], 0.5, 2), [-0.5, 1.5]);
  // Anchored near the right edge, most of the new space opens on the left.
  closeRange(zoomRange([0.8, 1], 0.9, 3), [0.44, 1.04]);
  let range = [0, 1];
  for (let i = 0; i < 20; i++) range = zoomRange(range, 0.2, 2);
  closeRange(range, [-4.5, 5.5]);
});

test("ranges stay inside the zoom-out limit, centered on the data", () => {
  closeRange(placeRange(-100, 0.5), [-4.5, -4]);
  closeRange(placeRange(100, 0.5), [5, 5.5]);
  closeRange(placeRange(0, 50), [-4.5, 5.5]);
  closeRange(placeRange(0.3, 0.0001), [0.3, 0.3 + MIN_SPAN]);
});

test("zooming in stops at the minimum span (1000x)", () => {
  let range = [0, 1];
  for (let i = 0; i < 50; i++) range = zoomRange(range, 0.3, 0.5);
  close(range[1] - range[0], MIN_SPAN);
  assert.ok(range[0] >= 0 && range[1] <= 1);
});

test("panning moves by a fraction of the plot, past the data up to the limit", () => {
  // Dragging right by a quarter of the plot reveals values a quarter-span lower.
  closeRange(panRange([0.4, 0.6], 0.25), [0.35, 0.55]);
  closeRange(panRange([0.4, 0.6], -0.25), [0.45, 0.65]);
  // Past the data edges, with the span unchanged, until the limit.
  closeRange(panRange([0.1, 0.3], 5), [-0.9, -0.7]);
  closeRange(panRange([0.1, 0.3], 50), [-4.5, -4.3]);
  closeRange(panRange([0.7, 0.9], -50), [5.3, 5.5]);
  // At the widest zoom the whole limit is in view, so there is nothing to pan to.
  closeRange(panRange([-4.5, 5.5], 0.3), [-4.5, 5.5]);
});

test("view positions and ratios are inverses", () => {
  const range = [0.2, 0.7];
  for (const ratio of [0.2, 0.45, 0.7]) close(viewRatio(viewPosition(ratio, range), range), ratio);
  close(viewPosition(0.2, range), 0);
  close(viewPosition(0.7, range), 1);
  assert.ok(viewPosition(0.1, range) < 0, "points left of the view fall outside 0..1");
});

test("zoom level reports the axis furthest from 1x, in or out", () => {
  close(zoomLevel({ x: [0, 0.5], y: [0, 0.25] }), 4);
  close(zoomLevel({ x: [-0.5, 1.5], y: [-0.5, 1.5] }), 0.5);
  // A constant axis never zooms, so it doesn't mask the other one.
  close(zoomLevel({ x: [-0.5, 1.5], y: [0, 1] }), 0.5);
  close(zoomLevel({ x: [0, 1], y: [0.25, 0.75] }), 2);
});

test("only the data's own range counts as the full view", () => {
  assert.ok(isFullView(fullView()));
  assert.ok(isFullView({ x: [0, 1 + 1e-15], y: [-1e-15, 1] }), "rounding from zooming back in");
  assert.ok(!isFullView({ x: [0, 0.5], y: [0, 1] }));
  assert.ok(!isFullView({ x: [-0.5, 1.5], y: [-0.5, 1.5] }), "zoomed out");
  assert.ok(!isFullView({ x: [0.2, 1.2], y: [0, 1] }), "panned at 1x");
});
