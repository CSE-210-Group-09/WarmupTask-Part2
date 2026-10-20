const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  MIN_SPAN, fullView, isFullView, zoomRange, panRange, viewPosition, viewRatio, zoomLevel
} = vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "../view.js"), "utf8") +
  "; ({ MIN_SPAN, fullView, isFullView, zoomRange, panRange, viewPosition, viewRatio, zoomLevel });"
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

test("zooming out never goes past the full range", () => {
  assert.deepEqual([...zoomRange([0, 1], 0.5, 2)], [0, 1]);
  // Zooming out near an edge shifts the range instead of leaving [0, 1].
  closeRange(zoomRange([0.8, 1], 0.9, 3), [0.4, 1]);
  closeRange(zoomRange([0, 0.2], 0.1, 3), [0, 0.6]);
});

test("zooming in stops at the minimum span (1000x)", () => {
  let range = [0, 1];
  for (let i = 0; i < 50; i++) range = zoomRange(range, 0.3, 0.5);
  close(range[1] - range[0], MIN_SPAN);
  assert.ok(range[0] >= 0 && range[1] <= 1);
});

test("panning moves by a fraction of the plot and stays inside the data", () => {
  // Dragging right by a quarter of the plot reveals values a quarter-span lower.
  closeRange(panRange([0.4, 0.6], 0.25), [0.35, 0.55]);
  closeRange(panRange([0.4, 0.6], -0.25), [0.45, 0.65]);
  // Clamped at the edges, with the span unchanged.
  closeRange(panRange([0.1, 0.3], 5), [0, 0.2]);
  closeRange(panRange([0.7, 0.9], -5), [0.8, 1]);
  // At full view there is nothing to pan to.
  assert.deepEqual([...panRange([0, 1], 0.3)], [0, 1]);
});

test("view positions and ratios are inverses", () => {
  const range = [0.2, 0.7];
  for (const ratio of [0.2, 0.45, 0.7]) close(viewRatio(viewPosition(ratio, range), range), ratio);
  close(viewPosition(0.2, range), 0);
  close(viewPosition(0.7, range), 1);
  assert.ok(viewPosition(0.1, range) < 0, "points left of the view fall outside 0..1");
});

test("zoom level reports the narrower axis", () => {
  close(zoomLevel({ x: [0, 0.5], y: [0, 0.25] }), 4);
  assert.ok(!isFullView({ x: [0, 0.5], y: [0, 1] }));
});
