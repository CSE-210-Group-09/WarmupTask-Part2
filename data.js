// Turning imported files into a table of numeric columns, and choosing which
// columns to plot. No DOM access, so tests can run these functions in Node.
// A table looks like { columns: ["day", "cityA", "cityB"], rows: [[1, 20, 18], ...] }.

// Plain decimal or scientific notation; rejects blanks, hex, and words like "Infinity".
const numberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const isNumberText = (text) => numberPattern.test(text) && Number.isFinite(Number(text));

// Header names must be usable as labels and must identify one column each.
function checkColumns(columns, source) {
  if (columns.length < 2) throw new Error(`The ${source} needs at least two columns.`);
  if (columns.some((name) => name === "")) throw new Error(`Every ${source} column needs a name.`);
  const duplicate = columns.find((name, i) => columns.indexOf(name) !== i);
  if (duplicate !== undefined) throw new Error(`The ${source} has two columns named "${duplicate}".`);
}

// A header row of column names, then one number per column on every row.
function parseCSVTable(text) {
  const lines = text.trim().split(/\r\n|\n|\r/);
  const readCells = (line) => line.split(",").map((cell) =>
    cell.trim().replace(/^"([^"]*)"$/, "$1").trim()
  );
  const columns = readCells(lines[0]);
  checkColumns(columns, "CSV");

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue; // Skip blank lines.
    const cells = readCells(lines[i]);
    if (cells.length !== columns.length || !cells.every(isNumberText)) {
      throw new Error(`Row ${i + 1} must contain exactly ${columns.length} valid numbers.`);
    }
    rows.push(cells.map(Number));
  }
  if (rows.length === 0) throw new Error("The CSV contains no data points.");
  return { columns, rows };
}

// "for x and for y", "for day, for cityA and for cityB".
function forEach(names) {
  const parts = names.map((name) => `for ${name}`);
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

// XML points arrive as records: one array of [name, text] fields per <point>,
// in document order (app.js reads them from the DOM). The first point names
// the columns; every point must give each of them exactly once, as a number.
function tableFromRecords(records) {
  if (records.length === 0) throw new Error("The XML contains no <point> elements.");
  const columns = [...new Set(records[0].map(([name]) => name))];
  checkColumns(columns, "XML");
  const rows = records.map((fields, index) => {
    const row = columns.map((column) => {
      const values = fields.filter(([name]) => name === column).map(([, text]) => text.trim());
      return values.length === 1 && isNumberText(values[0]) ? Number(values[0]) : null;
    });
    const extra = fields.some(([name]) => !columns.includes(name));
    if (row.includes(null) || extra) {
      throw new Error(`Point ${index + 1} must contain exactly one valid number ${forEach(columns)}.`);
    }
    return row;
  });
  return { columns, rows };
}

// Start with a column named x (else the first column) on the X axis and every
// other column as a series, so a two-column x,y file plots as before.
function defaultSelection(columns) {
  const x = columns.includes("x") ? "x" : columns[0];
  return { x, ys: columns.filter((column) => column !== x) };
}

// Keep what still applies after a new import or a new X column: the X column if
// it still exists, and the Y columns still available. Fall back to the defaults.
function reconcileSelection(columns, previous) {
  const fallback = defaultSelection(columns);
  const x = previous && columns.includes(previous.x) ? previous.x : fallback.x;
  const available = columns.filter((column) => column !== x);
  const ys = previous ? previous.ys.filter((column) => available.includes(column)) : [];
  return { x, ys: ys.length ? ys : available };
}

// One series per Y column, with points in ascending X order for the line.
function seriesFor(table, selection) {
  const xIndex = table.columns.indexOf(selection.x);
  return selection.ys.map((name) => {
    const yIndex = table.columns.indexOf(name);
    const points = table.rows.map((row) => ({ x: row[xIndex], y: row[yIndex] }));
    points.sort((a, b) => a.x - b.x);
    return { name, points };
  });
}

// Default series colors: the original blue first, then the Okabe-Ito palette,
// which stays distinguishable for the common forms of color blindness.
const SERIES_COLORS = ["#245bc5", "#e69f00", "#009e73", "#cc79a7", "#56b4e9", "#d55e00", "#0072b2", "#f0e442"];

// A color for each column: one the user chose earlier, otherwise the first
// palette color not already in use (cycling once the palette runs out).
function assignColors(names, chosen) {
  const colors = {};
  const used = new Set();
  for (const name of names) {
    if (chosen[name]) {
      colors[name] = chosen[name];
      used.add(chosen[name]);
    }
  }
  let next = 0;
  for (const name of names) {
    if (colors[name]) continue;
    const free = SERIES_COLORS.find((color) => !used.has(color));
    colors[name] = free ?? SERIES_COLORS[next++ % SERIES_COLORS.length];
    used.add(colors[name]);
  }
  return colors;
}
