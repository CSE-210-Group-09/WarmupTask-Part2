const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  parseCSVTable, tableFromRecords, defaultSelection, reconcileSelection, seriesFor, assignColors, SERIES_COLORS
} = vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "../data.js"), "utf8") +
  "; ({ parseCSVTable, tableFromRecords, defaultSelection, reconcileSelection, seriesFor, assignColors, SERIES_COLORS });"
);
// Values from the vm sandbox have a different Array/Object prototype; normalize them.
const plain = (value) => JSON.parse(JSON.stringify(value));

const cities = "day,cityA_temp,cityB_temp\n3,15,10\n1,14,9\n2,16,11";

test("CSV tables keep every numeric column in header order", () => {
  assert.deepEqual(plain(parseCSVTable(cities)), {
    columns: ["day", "cityA_temp", "cityB_temp"],
    rows: [[3, 15, 10], [1, 14, 9], [2, 16, 11]]
  });
  // The original two-column format still works.
  assert.deepEqual(plain(parseCSVTable("x,y\n1,3\n\n2,5\n")), { columns: ["x", "y"], rows: [[1, 3], [2, 5]] });
  // Quoted names and scientific notation.
  assert.deepEqual(plain(parseCSVTable('"t","v"\n1e3,-2.5E-2')).rows, [[1000, -0.025]]);
});

test("CSV errors name the problem row or column", () => {
  assert.throws(() => parseCSVTable("x\n1"), /at least two columns/);
  assert.throws(() => parseCSVTable("a,,c\n1,2,3"), /needs a name/);
  assert.throws(() => parseCSVTable("a,b,a\n1,2,3"), /two columns named "a"/);
  assert.throws(() => parseCSVTable("a,b,c\n1,2,3\n4,5"), /Row 3 must contain exactly 3 valid numbers/);
  assert.throws(() => parseCSVTable("a,b\n1,Infinity"), /Row 2/);
  assert.throws(() => parseCSVTable("a,b\n1,"), /Row 2/);
  assert.throws(() => parseCSVTable("a,b\n"), /no data points/);
});

test("XML records become a table named by the first point's fields", () => {
  const table = tableFromRecords([
    [["day", "1"], ["cityA", " 14 "], ["cityB", "9"]],
    [["day", "2"], ["cityB", "11"], ["cityA", "16"]] // Field order may differ.
  ]);
  assert.deepEqual(plain(table), { columns: ["day", "cityA", "cityB"], rows: [[1, 14, 9], [2, 16, 11]] });
});

test("XML points must give every column exactly once, as a number", () => {
  const message = /Point 2 must contain exactly one valid number for x and for y/;
  assert.throws(() => tableFromRecords([[["x", "1"], ["y", "2"]], [["x", "1"]]]), message);
  assert.throws(() => tableFromRecords([[["x", "1"], ["y", "2"]], [["x", "1"], ["y", "2"], ["y", "3"]]]), message);
  assert.throws(() => tableFromRecords([[["x", "1"], ["y", "2"]], [["x", "1"], ["y", "abc"]]]), message);
  assert.throws(() => tableFromRecords([[["x", "1"], ["y", "2"]], [["x", "1"], ["y", "2"], ["z", "3"]]]), message);
  assert.throws(
    () => tableFromRecords([[["d", "1"], ["a", "2"], ["b", "x"]]]),
    /Point 1 must contain exactly one valid number for d, for a and for b/
  );
  assert.throws(() => tableFromRecords([]), /no <point> elements/);
  assert.throws(() => tableFromRecords([[["x", "1"]]]), /at least two columns/);
});

test("by default, x (or the first column) is X and every other column is a line", () => {
  assert.deepEqual(plain(defaultSelection(["x", "y"])), { x: "x", ys: ["y"] });
  assert.deepEqual(plain(defaultSelection(["day", "cityA", "cityB"])), { x: "day", ys: ["cityA", "cityB"] });
  assert.deepEqual(plain(defaultSelection(["a", "x", "b"])), { x: "x", ys: ["a", "b"] });
});

test("a selection survives re-imports and X changes where it still applies", () => {
  const columns = ["day", "cityA", "cityB", "cityC"];
  assert.deepEqual(plain(reconcileSelection(columns, null)), { x: "day", ys: ["cityA", "cityB", "cityC"] });
  assert.deepEqual(plain(reconcileSelection(columns, { x: "day", ys: ["cityB"] })), { x: "day", ys: ["cityB"] });
  // Choosing a plotted column as X removes it from the lines.
  assert.deepEqual(plain(reconcileSelection(columns, { x: "cityB", ys: ["cityA", "cityB"] })), { x: "cityB", ys: ["cityA"] });
  // If nothing is left, every remaining column is plotted.
  assert.deepEqual(plain(reconcileSelection(columns, { x: "cityA", ys: ["cityA"] })), { x: "cityA", ys: ["day", "cityB", "cityC"] });
  // A different file falls back to the defaults.
  assert.deepEqual(plain(reconcileSelection(["x", "y"], { x: "day", ys: ["cityB"] })), { x: "x", ys: ["y"] });
});

test("series hold one line per Y column, in ascending X order", () => {
  const table = parseCSVTable(cities);
  const series = plain(seriesFor(table, { x: "day", ys: ["cityB_temp", "cityA_temp"] }));
  assert.deepEqual(series.map((line) => line.name), ["cityB_temp", "cityA_temp"]);
  assert.deepEqual(series[0].points, [{ x: 1, y: 9 }, { x: 2, y: 11 }, { x: 3, y: 10 }]);
  assert.deepEqual(series[1].points.map((point) => point.x), [1, 2, 3]);
});

test("colors: chosen colors stick, others take distinct palette colors", () => {
  assert.equal(assignColors(["y"], {}).y, "#245bc5"); // A single line keeps the original blue.
  const colors = plain(assignColors(["a", "b", "c"], { b: "#245bc5" }));
  assert.equal(colors.b, "#245bc5");
  assert.equal(new Set(Object.values(colors)).size, 3);
  assert.ok(!["a", "c"].some((name) => colors[name] === "#245bc5"));
  // More lines than palette colors still get a color each.
  const many = Array.from({ length: SERIES_COLORS.length + 2 }, (_, i) => `c${i}`);
  assert.ok(Object.values(plain(assignColors(many, {}))).every((color) => /^#[0-9a-f]{6}$/.test(color)));
});
