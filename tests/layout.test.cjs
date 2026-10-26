const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadScripts } = require("./load.cjs");

const { legendBox, emptiestCorner } = loadScripts(["layout.js"], ["legendBox", "emptiestCorner"]);

const PLOT = { left: 96, right: 438, top: 20, bottom: 252 };
const [W, H] = [100, 40];
// One point well inside each corner's legend box.
const inside = {
  "top-right": { x: 380, y: 40 }, "top-left": { x: 150, y: 40 },
  "bottom-right": { x: 380, y: 230 }, "bottom-left": { x: 150, y: 230 }
};
const many = (corner, n) => Array(n).fill(inside[corner]);
const corner = (points) => emptiestCorner(points, PLOT, W, H);

test("legend boxes sit 6 units in from each corner of the plot", () => {
  assert.deepEqual({ ...legendBox("top-right", PLOT, W, H) }, { x: 332, y: 26 });
  assert.deepEqual({ ...legendBox("top-left", PLOT, W, H) }, { x: 102, y: 26 });
  assert.deepEqual({ ...legendBox("bottom-right", PLOT, W, H) }, { x: 332, y: 206 });
  assert.deepEqual({ ...legendBox("bottom-left", PLOT, W, H) }, { x: 102, y: 206 });
});

test("the corner covering the fewest points wins", () => {
  assert.equal(corner([...many("top-right", 3), ...many("top-left", 2), ...many("bottom-right", 5), ...many("bottom-left", 1)]), "bottom-left");
  assert.equal(corner([...many("top-right", 1), ...many("top-left", 4), ...many("bottom-right", 2), ...many("bottom-left", 3)]), "top-right");
});

test("ties go top right, then top left, bottom right, bottom left", () => {
  assert.equal(corner([]), "top-right");
  assert.equal(corner(many("top-right", 1)), "top-left");
  assert.equal(corner([...many("top-right", 1), ...many("top-left", 1)]), "bottom-right");
  assert.equal(corner([...many("top-right", 1), ...many("top-left", 1), ...many("bottom-right", 1)]), "bottom-left");
  assert.equal(corner([...many("top-right", 2), ...many("top-left", 1), ...many("bottom-right", 1), ...many("bottom-left", 1)]), "top-left");
});

test("a point within a marker's radius (6) of the box counts as covered", () => {
  // The top-right box starts at x = 332; a marker centered 6 units left still touches it.
  assert.equal(corner([{ x: 326, y: 40 }]), "top-left");
  assert.equal(corner([{ x: 325.9, y: 40 }]), "top-right");
  assert.equal(corner([{ x: 380, y: 26 + H + 6 }]), "top-left");
  // Points outside the plot, such as those panned out of view, are never covered.
  assert.equal(corner([{ x: 500, y: 40 }, { x: 380, y: -100 }]), "top-right");
});
