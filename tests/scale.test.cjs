const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createAxis, formatTick, formatTicks } = vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "../scale.js"), "utf8") + "; ({ createAxis, formatTick, formatTicks });"
);

test("rounded labels never overflow to Infinity", () => {
  for (const value of [Number.MAX_VALUE, -Number.MAX_VALUE, 1.797e308, Number.MIN_VALUE, 0]) {
    assert.doesNotMatch(formatTick(value), /Infinity|NaN/);
  }
  assert.equal(formatTick(Number.MAX_VALUE), "1.8e+308");
  assert.equal(formatTick(1.2), "1.2");
  assert.equal(formatTick(100), "100");
});

test("linear axes handle extreme spans, subnormal values, and close values", () => {
  for (const [min, max] of [
    [-Number.MAX_VALUE, Number.MAX_VALUE],
    [0, Number.MIN_VALUE],
    [-Number.MIN_VALUE, Number.MIN_VALUE],
    [Number.MIN_VALUE, 2 * Number.MIN_VALUE],
    [1.7976931348623155e308, Number.MAX_VALUE],
    [-10, -2]
  ]) {
    const axis = createAxis(min, max);
    assert.equal(axis.position(min), 0);
    assert.equal(axis.position(max), 1);
    for (const ratio of axis.tickRatios) {
      const value = axis.tick(ratio);
      assert.ok(Number.isFinite(value));
      assert.ok(Number.isFinite(axis.position(value)));
      assert.ok(value >= min && value <= max);
      assert.doesNotMatch(formatTick(value), /Infinity|NaN/);
    }
  }
});

test("constant axes center points, including zero and floating-point limits", () => {
  for (const value of [0, Number.MIN_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE]) {
    const axis = createAxis(value, value);
    assert.equal(axis.position(value), 0.5);
    assert.equal(axis.tick(0.5), value);
    assert.equal(axis.tickRatios.length, 1);
    if (value > 0) assert.equal(createAxis(value, value, true).position(value), 0.5);
  }
});

test("log axes space orders of magnitude evenly and preserve raw tick values", () => {
  const axis = createAxis(1, 10000, true);
  [1, 10, 100, 1000, 10000].forEach((value, i) => {
    assert.equal(axis.position(value), i / 4);
    assert.equal(axis.tick(i / 4), value);
  });
});

test("log axes remain finite across the full positive numeric range", () => {
  for (const [min, max] of [
    [Number.MIN_VALUE, Number.MAX_VALUE],
    [1.7976931348623155e308, Number.MAX_VALUE],
    [Number.MIN_VALUE, 2 * Number.MIN_VALUE]
  ]) {
    const axis = createAxis(min, max, true);
    assert.equal(axis.position(min), 0);
    assert.equal(axis.position(max), 1);
    assert.equal(axis.tick(0), min);
    assert.equal(axis.tick(1), max);
    for (const ratio of axis.tickRatios) {
      assert.ok(Number.isFinite(axis.tick(ratio)));
      assert.ok(axis.tick(ratio) > 0);
      assert.ok(Number.isFinite(axis.position(axis.tick(ratio))));
    }
  }
});

test("invalid bounds and nonpositive logarithmic domains are rejected", () => {
  for (const bounds of [[-1, 1, true], [0, 1, true], [Infinity, Infinity], [NaN, 1], [2, 1]]) {
    assert.throws(() => createAxis(...bounds));
  }
});

test("zoomed tick labels gain digits until different values read differently", () => {
  // At full view, three significant digits are enough.
  assert.deepEqual(formatTicks([0, 25, 50, 75, 100]), ["0", "25", "50", "75", "100"]);
  // Zoomed in on 1000.0-1000.4, three digits would label every tick "1e+3".
  const labels = formatTicks([1000, 1000.1, 1000.2, 1000.3, 1000.4]);
  assert.equal(new Set(labels).size, 5);
  assert.deepEqual(labels, ["1000", "1000.1", "1000.2", "1000.3", "1000.4"]);
  // Equal values (a constant axis) keep one shared label.
  assert.deepEqual(formatTicks([7, 7]), ["7", "7"]);
  // Extremes still never overflow.
  for (const label of formatTicks([Number.MAX_VALUE * 0.999, Number.MAX_VALUE])) {
    assert.doesNotMatch(label, /Infinity|NaN/);
  }
});
