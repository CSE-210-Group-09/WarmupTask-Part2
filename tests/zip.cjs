// Build zip archives and .xlsx workbooks in memory for tests (an .xlsx file is a
// zip of XML parts). Used by the unit, integration and browser tests.
const zlib = require("node:zlib");

// files: { name: text }. Entries are deflated, as Excel writes them, unless `store`.
function makeZip(files, { store = false } = {}) {
  const parts = [];
  const directory = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text);
    const data = store ? raw : zlib.deflateRawSync(raw);
    const fileName = Buffer.from(name);
    const fields = { method: store ? 0 : 8, crc: zlib.crc32(raw), size: data.length, rawSize: raw.length };
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(fields.method, 8);
    local.writeUInt32LE(fields.crc, 14);
    local.writeUInt32LE(fields.size, 18);
    local.writeUInt32LE(fields.rawSize, 22);
    local.writeUInt16LE(fileName.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(fields.method, 10);
    central.writeUInt32LE(fields.crc, 16);
    central.writeUInt32LE(fields.size, 20);
    central.writeUInt32LE(fields.rawSize, 24);
    central.writeUInt16LE(fileName.length, 28);
    central.writeUInt32LE(offset, 42);
    parts.push(local, fileName, data);
    directory.push(central, fileName);
    offset += local.length + fileName.length + data.length;
  }
  const centralDirectory = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(directory.length / 2, 8);
  end.writeUInt16LE(directory.length / 2, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralDirectory, end]);
}

// A one-sheet workbook laid out the way Excel saves it: relative part paths and,
// when given, a shared strings table. `rows` is the XML inside <sheetData>.
function makeWorkbook(rows, { sharedStrings = null, store = false } = {}) {
  const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const files = {
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${main}" xmlns:r="${rel}"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${main}"><sheetData>${rows}</sheetData></worksheet>`
  };
  if (sharedStrings) {
    files["xl/sharedStrings.xml"] = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="${main}">` +
      sharedStrings.map((text) => `<si><t>${text}</t></si>`).join("") + "</sst>";
  }
  return makeZip(files, { store });
}

module.exports = { makeZip, makeWorkbook };
