// Integration for the file import story (issue #31): data.js and xlsx.js
// together, from JSON and .xlsx files to the same table and lines a CSV gives.
// Written before the story's code; see docs/testing.md.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadScripts } = require("../load.cjs");
const { makeZip, makeWorkbook } = require("../zip.cjs");

const { parseCSVTable, parseJSONTable, parseXLSX, reconcileSelection, seriesFor } = loadScripts(
  ["data.js", "xlsx.js"],
  ["parseCSVTable", "parseJSONTable", "parseXLSX", "reconcileSelection", "seriesFor"],
  // Browser APIs xlsx.js uses to unzip, which Node also provides.
  { DecompressionStream, Blob, Response, TextDecoder }
);

const read = (name) => fs.readFileSync(path.join(__dirname, "../..", name));
// Values from the sandbox have other prototypes; compare them as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value));
const lines = (table) => plain(seriesFor(table, reconcileSelection(table.columns, null)));

for (const stem of ["test-data/city-temperatures", "test-data/growth-data", "sample"]) {
  test(`${path.basename(stem)}: JSON and .xlsx give the same table and lines as the CSV`, async () => {
    const csv = parseCSVTable(read(`${stem}.csv`).toString());
    const json = parseJSONTable(read(`${stem}.json`).toString());
    const xlsx = await parseXLSX(read(`${stem}.xlsx`));
    for (const table of [json, xlsx]) {
      assert.deepEqual(plain(table), plain(csv));
      assert.deepEqual(lines(table), lines(csv));
    }
  });
}

test("a workbook laid out as Excel saves it reads like the equivalent CSV", async () => {
  // Shared-string headers, a skipped empty row, a formula with its saved result,
  // and a number in Excel's exponent notation.
  const workbook = makeWorkbook(
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
    '<row r="2"><c r="A2"><v>1</v></c><c r="B2"><v>2.5</v></c></row>' +
    '<row r="4"><c r="A4"><v>3</v></c><c r="B4"><f>B2*2</f><v>5</v></c></row>' +
    '<row r="5"><c r="A5"><v>4</v></c><c r="B5"><v>1.5E-3</v></c></row>',
    { sharedStrings: ["time", "speed"] }
  );
  const table = await parseXLSX(workbook);
  assert.deepEqual(plain(table), plain(parseCSVTable("time,speed\n1,2.5\n\n3,5\n4,1.5E-3")));
});

test("bad workbooks fail with the same wording as bad CSV files", async () => {
  const rows = '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
    '<row r="2"><c r="A2"><v>1</v></c><c r="B2"><v>3</v></c></row>' +
    '<row r="3"><c r="A3"><v>2</v></c><c r="B3" t="s"><v>2</v></c></row>';
  await assert.rejects(parseXLSX(makeWorkbook(rows, { sharedStrings: ["x", "y", "n/a"] })),
    { message: "Row 3 must contain exactly 2 valid numbers." });
  assert.throws(() => parseCSVTable("x,y\n1,3\n2,n/a"), { message: "Row 3 must contain exactly 2 valid numbers." });
  await assert.rejects(parseXLSX(makeWorkbook(rows, { sharedStrings: ["x", "x", "1"] })),
    { message: 'The spreadsheet has two columns named "x".' });
});

test("files that aren't .xlsx workbooks are rejected", async () => {
  await assert.rejects(parseXLSX(Buffer.from("x,y\n1,2\n")), /not an \.xlsx workbook/);
  await assert.rejects(parseXLSX(makeZip({ "notes.txt": "hello" })), /not an \.xlsx workbook/);
});
