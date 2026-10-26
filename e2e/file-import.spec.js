// Story: As a user, I want to create a plot from JSON or spreadsheet files, not
//   only CSV and XML (issue #31). JSON is an array of objects; spreadsheets are
//   .xlsx workbooks, whose first sheet is read like a CSV.
const { test, expect } = require("@playwright/test");
const { importFile, markers, xTickLabels } = require("./helpers.cjs");
const { makeWorkbook } = require("../tests/zip.cjs");
const fs = require("node:fs");

const status = (page) => page.locator("#status");
const fixture = (name) => fs.readFileSync(`test-data/${name}`);

// What the user sees of a plot: markers, ticks, legend and status.
async function plotted(page) {
  return {
    markers: await markers(page, "scatter").count(),
    xTicks: await xTickLabels(page, "line"),
    yTicks: await page.locator('#line-chart text[text-anchor="end"]').allTextContents(),
    legend: await page.locator("#line-chart .legend text").allTextContents(),
    status: (await status(page).textContent()).replace(/^Imported \S+\./, "")
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("the file picker offers JSON and Excel files alongside CSV and XML", async ({ page }) => {
  const accept = await page.locator("#data-file").getAttribute("accept");
  for (const type of [".csv", ".xml", ".json", ".xlsx"]) expect(accept).toContain(type);
  await expect(page.locator("#import-help")).toContainText("JSON");
  await expect(page.locator("#import-help")).toContainText(".xlsx");
});

for (const format of ["json", "xlsx"]) {
  test(`.${format} files plot the same chart as the CSV`, async ({ page }) => {
    for (const stem of ["city-temperatures", "growth-data"]) {
      await importFile(page, `${stem}.csv`, fixture(`${stem}.csv`));
      const fromCSV = await plotted(page);
      await importFile(page, `${stem}.${format}`, fixture(`${stem}.${format}`));
      await expect(status(page)).toHaveText(new RegExp(`^Imported ${stem}\\.${format}\\.`));
      await expect(status(page)).not.toHaveClass(/error/);
      expect(await plotted(page)).toEqual(fromCSV);
    }
  });
}

test("the sample files plot the same points in every format", async ({ page }) => {
  for (const name of ["sample.csv", "sample.xml", "sample.json", "sample.xlsx"]) {
    await importFile(page, name, fs.readFileSync(name));
    await expect(status(page)).toHaveText(`Imported ${name}. Points: 6.`);
    await expect(markers(page, "line")).toHaveCount(6);
  }
});

test("invalid JSON files are rejected and the chart is kept", async ({ page }) => {
  await importFile(page, "sample.json", fs.readFileSync("sample.json"));
  for (const [text, message] of [
    ['[{"x": 1, "y": 2},', "The JSON is not valid."],
    ['{"x": [1, 2], "y": [3, 4]}', "The JSON must be an array of objects"],
    ["[]", "The JSON contains no data points."],
    ['[{"x": 1, "y": 2}, {"x": 2, "y": "3"}]', "Item 2 must contain exactly one number for each of: x, y."],
    ['[{"x": 1, "y": 2}, {"x": 2}]', "Item 2 must contain exactly one number for each of: x, y."]
  ]) {
    await importFile(page, "bad.json", text);
    await expect(status(page)).toHaveClass(/error/);
    await expect(status(page)).toContainText(message);
    await expect(markers(page, "line")).toHaveCount(6);
  }
});

test("a file named .xlsx that isn't a workbook is rejected and the chart is kept", async ({ page }) => {
  await importFile(page, "sample.xlsx", fs.readFileSync("sample.xlsx"));
  await importFile(page, "renamed.xlsx", "x,y\n1,2\n");
  await expect(status(page)).toHaveClass(/error/);
  await expect(status(page)).toContainText("not an .xlsx workbook");
  await expect(markers(page, "line")).toHaveCount(6);
});

test("a workbook with text in a data cell names the row and keeps the chart", async ({ page }) => {
  await importFile(page, "sample.xlsx", fs.readFileSync("sample.xlsx"));
  const workbook = makeWorkbook(
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
    '<row r="2"><c r="A2"><v>1</v></c><c r="B2"><v>3</v></c></row>' +
    '<row r="3"><c r="A3"><v>2</v></c><c r="B3" t="s"><v>2</v></c></row>',
    { sharedStrings: ["x", "y", "n/a"] }
  );
  await importFile(page, "gaps.xlsx", workbook);
  await expect(status(page)).toHaveClass(/error/);
  await expect(status(page)).toContainText("Row 3 must contain exactly 2 valid numbers.");
  await expect(markers(page, "line")).toHaveCount(6);
});
