// Story: As a user, I want to be able to pick which columns to plot.
//   Let the user plot multiple lines; pick a target variable and multiple columns.
const { test, expect } = require("@playwright/test");
const { importFile, markers } = require("../e2e/helpers.cjs");
const fs = require("node:fs");

const cities = fs.readFileSync("test-data/city-temperatures.csv", "utf8"); // day, cityA_temp, cityB_temp; 14 rows
const lines = (page) => page.locator("#line-chart polyline.line");
const legend = (page, chart = "line") => page.locator(`#${chart}-chart .legend text`).allTextContents();
const lineBox = (page, name) => page.getByRole("checkbox", { name, exact: true });
const axisLabels = (page, chart) => page.locator(`#${chart}-chart text.axis-label`).allTextContents();

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await importFile(page, "city-temperatures.csv", cities);
});

test("a three-column file plots two differently colored lines against day", async ({ page }) => {
  await expect(page.locator("#status")).toHaveText(
    "Imported city-temperatures.csv. Points: 14. Columns: day, cityA_temp, cityB_temp."
  );
  await expect(page.locator("#x-column")).toHaveValue("day");
  await expect(lineBox(page, "cityA_temp")).toBeChecked();
  await expect(lineBox(page, "cityB_temp")).toBeChecked();
  await expect(lines(page)).toHaveCount(2);
  const strokes = await lines(page).evaluateAll((all) => all.map((line) => line.getAttribute("stroke")));
  expect(new Set(strokes).size).toBe(2);
  await expect(markers(page, "line")).toHaveCount(28);
  await expect(markers(page, "scatter")).toHaveCount(28);
  expect(await legend(page)).toEqual(["cityA_temp", "cityB_temp"]);
  expect(await legend(page, "scatter")).toEqual(["cityA_temp", "cityB_temp"]);
  expect(await axisLabels(page, "line")).toEqual(["day", "Y"]);
});

test("tooltips and point labels name the column of each value", async ({ page }) => {
  const labels = await markers(page, "line").evaluateAll((all) => all.map((c) => c.getAttribute("aria-label")));
  expect(labels).toContain("day: 1, cityA_temp: 14.2");
  expect(labels).toContain("day: 1, cityB_temp: 9.1");
  const point = page.locator('#line-chart circle[aria-label="day: 1, cityB_temp: 9.1"]');
  await point.focus();
  await expect(point).toBeFocused();
});

test("unchecking a column removes its line, and the last line can't be removed", async ({ page }) => {
  await lineBox(page, "cityB_temp").uncheck();
  await expect(lines(page)).toHaveCount(1);
  await expect(markers(page, "scatter")).toHaveCount(14);
  expect(await legend(page)).toEqual([]); // One line needs no legend.
  expect(await axisLabels(page, "line")).toEqual(["day", "cityA_temp"]);
  await expect(lineBox(page, "cityA_temp")).toBeDisabled();
  await lineBox(page, "cityB_temp").check();
  await expect(lines(page)).toHaveCount(2);
  await expect(lineBox(page, "cityA_temp")).toBeEnabled();
});

test("choosing another column as the target variable re-plots against it", async ({ page }) => {
  await page.locator("#x-column").selectOption("cityA_temp");
  // The X column is no longer offered as a line; the other chosen line stays,
  // and the old X column becomes available but isn't plotted until picked.
  await expect(lineBox(page, "cityA_temp")).toHaveCount(0);
  await expect(lineBox(page, "cityB_temp")).toBeChecked();
  await expect(lineBox(page, "day")).not.toBeChecked();
  expect(await axisLabels(page, "scatter")).toEqual(["cityA_temp", "cityB_temp"]);
  await lineBox(page, "day").check();
  expect(await legend(page)).toEqual(["day", "cityB_temp"]);
  expect(await axisLabels(page, "scatter")).toEqual(["cityA_temp", "Y"]);
  // Lines connect points in ascending X order: the first marker has the smallest cityA_temp.
  const first = await markers(page, "line").first().getAttribute("aria-label");
  expect(first).toMatch(/^cityA_temp: 13.8, /);
});

test("each line has its own color picker, and chosen colors survive re-import", async ({ page }) => {
  await page.getByLabel("Color for cityB_temp").fill("#d55e00");
  await expect(lines(page).nth(1)).toHaveAttribute("stroke", "#d55e00");
  const fills = await page.locator('#scatter-chart circle[aria-label*="cityB_temp"]').evaluateAll((all) => all.map((c) => c.getAttribute("fill")));
  expect(new Set(fills)).toEqual(new Set(["#d55e00"]));
  await importFile(page, "again.csv", cities);
  await expect(lines(page).nth(1)).toHaveAttribute("stroke", "#d55e00");
});

test("the same table from XML plots identically", async ({ page }) => {
  const fromCsv = await markers(page, "line").evaluateAll((all) => all.map((c) => c.getAttribute("aria-label")));
  await importFile(page, "city-temperatures.xml", fs.readFileSync("test-data/city-temperatures.xml", "utf8"));
  const fromXml = await markers(page, "line").evaluateAll((all) => all.map((c) => c.getAttribute("aria-label")));
  expect(fromXml).toEqual(fromCsv);
});

test("zoom, log scale and exports work with several lines", async ({ page }) => {
  await page.locator("#log-y").click();
  await expect(page.locator("#log-y")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#zoom-in").click();
  await expect(page.locator("#zoom-status")).toContainText("Zoomed 2x");
  await expect(lines(page)).toHaveCount(2);
  await page.locator("#line-format").selectOption("svg");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export line graph image" }).click();
  const svg = fs.readFileSync(await (await download).path(), "utf8");
  expect((svg.match(/<polyline/g) ?? []).length).toBe(2);
  expect(svg).toContain(">cityA_temp<");
  expect(svg).toContain(">cityB_temp<");
});

test("files with mismatched rows or missing fields are rejected and the chart is kept", async ({ page }) => {
  await importFile(page, "short.csv", "day,a,b\n1,2,3\n2,4");
  await expect(page.locator("#status")).toHaveText("Row 3 must contain exactly 3 valid numbers.");
  await importFile(page, "gap.xml", '<p><point day="1" a="2" b="3"/><point day="2" a="4"/></p>');
  await expect(page.locator("#status")).toHaveText("Point 2 must contain exactly one valid number for each of: day, a, b.");
  await expect(lines(page)).toHaveCount(2);
});
