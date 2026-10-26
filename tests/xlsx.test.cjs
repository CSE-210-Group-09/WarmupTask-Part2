const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadScripts } = require("./load.cjs");
const { makeZip, makeWorkbook } = require("./zip.cjs");

// xlsx.js uses data.js's number and column-name rules, and browser APIs that Node also has.
const {
  readZip, unzipText, parseXMLTree, descendants, textOf, sheetCells, tableFromCells, parseXLSX
} = loadScripts(["data.js", "xlsx.js"], [
  "readZip", "unzipText", "parseXMLTree", "descendants", "textOf", "sheetCells", "tableFromCells", "parseXLSX"
], { DecompressionStream, Blob, Response, TextDecoder });

const plain = (value) => JSON.parse(JSON.stringify(value));
const NOT_A_WORKBOOK = /^Error: This file is not an \.xlsx workbook/;
const cell = (row, column, text) => ({ row, column, text });

test("zip entries are listed by name and read back, deflated or stored", async () => {
  for (const store of [false, true]) {
    const entries = readZip(makeZip({ "a.xml": "<a>é</a>", "dir/b.txt": "two" }, { store }));
    assert.deepEqual([...entries.keys()], ["a.xml", "dir/b.txt"]);
    assert.equal(await unzipText(entries.get("a.xml")), "<a>é</a>");
    assert.equal(await unzipText(entries.get("dir/b.txt")), "two");
  }
});

test("anything that isn't a zip archive is refused", () => {
  for (const bytes of [Buffer.from("x,y\n1,2\n"), Buffer.alloc(0), makeZip({ "a.txt": "a" }).subarray(0, 40)]) {
    assert.throws(() => readZip(bytes), { message: "Not a zip archive." });
  }
  // Password-protected workbooks and old .xls files are compound documents, not zips.
  assert.throws(() => readZip(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...Array(600).fill(0)])),
    { message: "Not a zip archive." });
});

test("unknown compression methods and damaged data have clear errors", async () => {
  const zip = makeZip({ "a.txt": "hello hello hello" });
  const entry = readZip(zip).get("a.txt");
  await assert.rejects(unzipText({ ...entry, method: 12 }), { message: "The workbook uses a compression method this browser can't read." });
  await assert.rejects(unzipText({ ...entry, data: Uint8Array.from([0xff, 0xff, 0xff]) }), { message: "The workbook is damaged and can't be read." });
});

test("the XML reader drops namespace prefixes and decodes entities and CDATA", () => {
  const root = parseXMLTree('<?xml version="1.0"?><x:a xmlns:x="u" x:id="1"><x:b k=\'v &amp; w\'>1 &lt; 2 &#38; &#x41;</x:b><b/><!-- note --><c><![CDATA[<raw>]]></c></x:a>');
  const [a] = root.children;
  assert.equal(a.name, "a");
  assert.equal(a.attributes.id, "1");
  assert.deepEqual([...descendants(root, "b").map((b) => b.text)], ["1 < 2 & A", ""]);
  assert.equal(descendants(root, "b")[0].attributes.k, "v & w");
  assert.equal(descendants(root, "c")[0].text, "<raw>");
});

test("shared and inline strings join rich-text runs and skip phonetic guides", () => {
  const root = parseXMLTree('<si><r><t>Tem</t></r><r><t xml:space="preserve">p </t></r><rPh><t>てんぷ</t></rPh></si>');
  assert.equal(textOf(root.children[0]), "Temp ");
});

test("cells are read by reference, with each value type", () => {
  const sheet = parseXMLTree(
    '<sheetData><row r="2">' +
    '<c r="A2" t="s"><v>1</v></c><c r="C2" t="inlineStr"><is><t>inline</t></is></c>' +
    '<c r="AA2"><v>1.5E-3</v></c><c r="AB2" t="n"><f>A1*2</f><v>4</v></c><c r="AC2" t="str"><f>"7"</f><v>7</v></c>' +
    '<c r="AD2" t="b"><v>1</v></c><c r="AE2" t="e"><v>#DIV/0!</v></c><c r="AF2" s="3"/><c><v>9</v></c>' +
    '</row><row><c><v>10</v></c></row></sheetData>'
  );
  assert.deepEqual(plain(sheetCells(sheet, ["zero", "one"])), [
    cell(2, 0, "one"), cell(2, 2, "inline"), cell(2, 26, "1.5E-3"), cell(2, 27, "4"), cell(2, 28, "7"),
    // Booleans and errors can't be numbers or names; an empty styled cell is empty.
    cell(2, 29, null), cell(2, 30, null), cell(2, 31, ""),
    // Without a reference, a cell follows the previous one, and a row the previous row.
    cell(2, 32, "9"), cell(3, 0, "10")
  ]);
});

test("the first filled row names the columns, and later rows need a number in each", () => {
  const cells = [
    cell(2, 1, " time "), cell(2, 2, "speed"), cell(2, 5, ""),
    cell(3, 1, "1"), cell(3, 2, "2.5"),
    cell(5, 1, "2"), cell(5, 2, "-3e2"), cell(5, 4, " "),
    cell(6, 3, "")
  ];
  assert.deepEqual(plain(tableFromCells(cells)), { columns: ["time", "speed"], rows: [[1, 2.5], [2, -300]] });
});

test("spreadsheet rows break the same rules as CSV rows, with the sheet's row numbers", () => {
  const header = [cell(1, 0, "x"), cell(1, 1, "y")];
  for (const row of [
    [cell(4, 0, "1")],
    [cell(4, 0, "1"), cell(4, 1, "n/a")],
    [cell(4, 0, "1"), cell(4, 1, null)],
    [cell(4, 0, "1"), cell(4, 1, "2"), cell(4, 2, "3")]
  ]) {
    assert.throws(() => tableFromCells([...header, ...row]), { message: "Row 4 must contain exactly 2 valid numbers." });
  }
  assert.throws(() => tableFromCells([cell(1, 0, "x"), cell(1, 2, "y"), cell(2, 0, "1")]), { message: "Every spreadsheet column needs a name." });
  assert.throws(() => tableFromCells([cell(1, 0, "x"), cell(2, 0, "1")]), { message: "The spreadsheet needs at least two columns." });
  assert.throws(() => tableFromCells(header), { message: "The spreadsheet contains no data points." });
  assert.throws(() => tableFromCells([cell(1, 0, "")]), { message: "The spreadsheet contains no data points." });
});

test("a workbook's first sheet is found through relative or absolute part paths", async () => {
  const rows = '<row r="1"><c r="A1" t="inlineStr"><is><t>x</t></is></c><c r="B1" t="inlineStr"><is><t>y</t></is></c></row>' +
    '<row r="2"><c r="A2"><v>1</v></c><c r="B2"><v>3</v></c></row>';
  assert.deepEqual(plain(await parseXLSX(makeWorkbook(rows))), { columns: ["x", "y"], rows: [[1, 3]] });
  assert.deepEqual(plain(await parseXLSX(makeWorkbook(rows, { store: true }))), { columns: ["x", "y"], rows: [[1, 3]] });

  const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const absolute = makeZip({
    "xl/workbook.xml": `<workbook xmlns="${main}" xmlns:r="r"><sheets><sheet name="B" r:id="rId7"/><sheet name="A" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="/xl/worksheets/sheet1.xml"/><Relationship Id="rId7" Target="/xl/worksheets/data.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="${main}"><sheetData></sheetData></worksheet>`,
    "xl/worksheets/data.xml": `<worksheet xmlns="${main}"><sheetData>${rows}</sheetData></worksheet>`
  });
  // The first sheet in the workbook's order, not the first file name.
  assert.deepEqual(plain(await parseXLSX(absolute)), { columns: ["x", "y"], rows: [[1, 3]] });
});

test("files that aren't workbooks, or have no worksheet, are rejected", async () => {
  await assert.rejects(parseXLSX(Buffer.from("x,y\n1,2\n")), NOT_A_WORKBOOK);
  await assert.rejects(parseXLSX(makeZip({ "word/document.xml": "<document/>" })), NOT_A_WORKBOOK);
  await assert.rejects(parseXLSX(makeZip({ "xl/workbook.xml": "<workbook><sheets/></workbook>" })),
    { message: "The workbook has no worksheets." });
});
