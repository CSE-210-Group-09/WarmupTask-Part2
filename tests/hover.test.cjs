const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { nearestIndex } = vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "../hover.js"), "utf8") + "; ({ nearestIndex });"
);

test("the nearest value wins, wherever it is in the list", () => {
  assert.equal(nearestIndex([96, 181.5, 267, 352.5, 438], 250), 2);
  assert.equal(nearestIndex([438, 96, 267], 100), 1);
  assert.equal(nearestIndex([10, 20, 30], -1000), 0);
  assert.equal(nearestIndex([10, 20, 30], 1000), 2);
});

test("values outside the view (null) and non-finite values are skipped", () => {
  assert.equal(nearestIndex([null, 200, null], 0), 1);
  assert.equal(nearestIndex([NaN, Infinity, 50], 1e9), 2);
  assert.equal(nearestIndex([null, null], 5), -1);
  assert.equal(nearestIndex([], 5), -1);
});

test("a tie goes to the first value", () => {
  assert.equal(nearestIndex([10, 20], 15), 0);
  assert.equal(nearestIndex([20, 10], 15), 0);
  assert.equal(nearestIndex([5, 5, 5], 5), 0);
});
