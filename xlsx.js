// Reading .xlsx workbooks without a library. An .xlsx file is a zip archive of
// XML parts; the first worksheet becomes a table under the same rules as a CSV
// (checkColumns and isNumberText in data.js). No DOM access, so tests can run
// these functions in Node.

const NOT_A_WORKBOOK = "This file is not an .xlsx workbook. Older .xls files and password-protected " +
  "workbooks can't be read: save it from your spreadsheet program as an .xlsx workbook without a password.";

// The files in a zip archive, from its central directory: name → { method, data },
// with `data` still compressed. Throws if `bytes` isn't a zip archive.
function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (offset) => view.getUint16(offset, true);
  const u32 = (offset) => view.getUint32(offset, true);
  // The end record is the last 22 bytes, unless an archive comment (up to 64 KB) follows it.
  let end = bytes.length - 22;
  while (end >= 0 && end >= bytes.length - 22 - 0xffff && u32(end) !== 0x06054b50) end--;
  if (end < 0 || u32(end) !== 0x06054b50) throw new Error("Not a zip archive.");

  const entries = new Map();
  const decoder = new TextDecoder();
  let offset = u32(end + 16);
  try {
    for (let i = 0; i < u16(end + 10); i++) {
      if (u32(offset) !== 0x02014b50) throw new Error();
      const nameLength = u16(offset + 28);
      const local = u32(offset + 42);
      if (u32(local) !== 0x04034b50) throw new Error();
      // The data follows the local header, whose name and extra field can differ from these.
      const start = local + 30 + u16(local + 26) + u16(local + 28);
      entries.set(decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)), {
        method: u16(offset + 10), data: bytes.subarray(start, start + u32(offset + 20))
      });
      offset += 46 + nameLength + u16(offset + 30) + u16(offset + 32);
    }
  } catch {
    throw new Error("Not a zip archive."); // Includes reads past the end (RangeError).
  }
  return entries;
}

// An entry's contents as text. Spreadsheet programs deflate their parts (method 8);
// method 0 is stored as is.
async function unzipText({ method, data }) {
  if (method === 0) return new TextDecoder().decode(data);
  if (method !== 8) throw new Error("The workbook uses a compression method this browser can't read.");
  try {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(stream).text();
  } catch {
    throw new Error("The workbook is damaged and can't be read.");
  }
}

const decodeXML = (text) => text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, name) =>
  name[0] !== "#" ? { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[name.toLowerCase()]
    : String.fromCodePoint(name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1)))
);

// The plain, machine-written XML of workbook parts as elements:
// { name, attributes, children, text }, with namespace prefixes dropped.
// (The page could use DOMParser, but Node has none, and this keeps xlsx.js testable.)
function parseXMLTree(xml) {
  const root = { name: "", attributes: {}, children: [], text: "" };
  const stack = [root];
  const token = /<(\/?)(?:[\w.-]+:)?([\w.-]+)((?:\s+[^\s=>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<!\[CDATA\[([\s\S]*?)\]\]>|<[?!][^>]*>|([^<]+)/g;
  for (const [, closing, name, attributeText, selfClosing, cdata, text] of xml.matchAll(token)) {
    const parent = stack[stack.length - 1];
    if (cdata !== undefined || text !== undefined) {
      parent.text += cdata ?? decodeXML(text);
    } else if (closing) {
      if (stack.length > 1) stack.pop();
    } else if (name) {
      const attributes = {};
      for (const [, key, double, single] of attributeText.matchAll(/(?:[\w.-]+:)?([\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        attributes[key] = decodeXML(double ?? single);
      }
      const element = { name, attributes, children: [], text: "" };
      parent.children.push(element);
      if (!selfClosing) stack.push(element);
    }
  }
  return root;
}

function descendants(element, name) {
  return element.children.flatMap((child) => [...(child.name === name ? [child] : []), ...descendants(child, name)]);
}

// The text of a string item (<si> or <is>): its <t> runs, without phonetic guides (<rPh>).
function textOf(element) {
  if (element.name === "rPh") return "";
  return element.name === "t" ? element.text : element.children.map(textOf).join("");
}

// A cell's value as text, or null for booleans and errors, which can't be numbers or names.
function cellText(cell, strings) {
  const type = cell.attributes.t ?? "n";
  if (type === "inlineStr") return textOf(cell.children.find((child) => child.name === "is") ?? cell);
  if (type === "b" || type === "e") return null;
  // A formula cell keeps its last result in <v>; the formula itself (<f>) is ignored.
  const value = cell.children.find((child) => child.name === "v")?.text ?? "";
  return type === "s" && value !== "" ? strings[Number(value)] ?? null : value;
}

// Column letters to a 0-based index: A → 0, Z → 25, AA → 26.
const columnIndex = (letters) => [...letters].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1;

// Every cell of a worksheet as { row (1-based, as the sheet numbers it), column (0-based), text }.
function sheetCells(sheet, strings) {
  const cells = [];
  let row = 0;
  for (const rowElement of descendants(sheet, "row")) {
    row = Number(rowElement.attributes.r) || row + 1;
    let column = -1;
    for (const cell of rowElement.children.filter((child) => child.name === "c")) {
      const reference = /^([A-Z]+)\d+$/.exec(cell.attributes.r ?? "");
      column = reference ? columnIndex(reference[1]) : column + 1;
      cells.push({ row, column, text: cellText(cell, strings) });
    }
  }
  return cells;
}

// The first filled row names the columns; every later filled row needs a number in
// each of them and nothing beside them. Errors use the sheet's own row numbers.
function tableFromCells(cells) {
  const filled = cells.filter((cell) => cell.text === null || cell.text.trim() !== "");
  if (filled.length === 0) throw new Error("The spreadsheet contains no data points.");
  const byRow = new Map();
  for (const cell of filled) byRow.set(cell.row, [...(byRow.get(cell.row) ?? []), cell]);
  const [[, header], ...dataRows] = [...byRow].sort(([a], [b]) => a - b);

  const first = header.reduce((low, cell) => Math.min(low, cell.column), Infinity);
  const last = header.reduce((high, cell) => Math.max(high, cell.column), -Infinity);
  const textAt = (rowCells, column) => rowCells.find((cell) => cell.column === column)?.text?.trim();
  const columns = Array.from({ length: last - first + 1 }, (_, i) => textAt(header, first + i) ?? "");
  checkColumns(columns, "spreadsheet");

  const rows = dataRows.map(([row, rowCells]) => {
    const values = columns.map((_, i) => textAt(rowCells, first + i));
    if (rowCells.length !== columns.length || !values.every((text) => text !== undefined && isNumberText(text))) {
      throw new Error(`Row ${row} must contain exactly ${columns.length} valid numbers.`);
    }
    return values.map(Number);
  });
  if (rows.length === 0) throw new Error("The spreadsheet contains no data points.");
  return { columns, rows };
}

// The first worksheet of an .xlsx file (a Uint8Array) as a table.
async function parseXLSX(bytes) {
  let parts;
  try {
    parts = readZip(bytes);
  } catch {
    throw new Error(NOT_A_WORKBOOK);
  }
  const read = async (name) => parts.has(name) ? parseXMLTree(await unzipText(parts.get(name))) : null;
  const workbook = await read("xl/workbook.xml");
  if (!workbook) throw new Error(NOT_A_WORKBOOK);

  // The workbook lists its sheets in tab order; its relationships say which part holds each.
  const id = descendants(workbook, "sheet")[0]?.attributes.id;
  const relationships = await read("xl/_rels/workbook.xml.rels");
  const target = relationships && descendants(relationships, "Relationship")
    .find((relationship) => relationship.attributes.Id === id)?.attributes.Target;
  // Targets are relative to xl/, or absolute from the archive's root.
  const sheet = target && await read(target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  if (!sheet) throw new Error("The workbook has no worksheets.");

  const sharedStrings = await read("xl/sharedStrings.xml");
  const strings = sharedStrings ? descendants(sharedStrings, "si").map(textOf) : [];
  return tableFromCells(sheetCells(sheet, strings));
}
