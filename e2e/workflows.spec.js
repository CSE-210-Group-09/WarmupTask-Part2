// End-to-end: whole workflows that cross several user stories, driven like a
// user from import to export. Each story's own checks are in integration/.
const { test, expect } = require("@playwright/test");
const { importFile, csvWithPoints, markers } = require("./helpers.cjs");
const fs = require("node:fs");

async function exportSVG(page, chart) {
  await page.locator(`#${chart}-format`).selectOption("svg");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: `Export ${chart === "line" ? "line graph" : "scatter plot"} image` }).click();
  return fs.readFileSync(await (await download).path(), "utf8");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

// XML import, picking columns, appearance, zoom, hiding markers, export.
test("explore a multi-column XML file and export exactly what's on screen", async ({ page }) => {
  await importFile(page, "city-temperatures.xml", fs.readFileSync("test-data/city-temperatures.xml", "utf8"));
  await expect(page.locator("#status")).toHaveText(/^Imported city-temperatures\.xml\. Points: 14\./);
  await expect(page.locator("#line-chart polyline.line")).toHaveCount(2);

  await page.getByRole("checkbox", { name: "cityB_temp" }).uncheck();
  await page.getByLabel("Color for cityA_temp").fill("#1a7f37");
  await page.locator("#x-label").fill("Day");
  await page.locator("#y-label").fill("Temperature (°C)");
  await page.locator("#zoom-in").click();
  await expect(page.locator("#zoom-status")).toHaveText("Zoomed 2x.");
  await page.locator("#show-line-points").uncheck();

  const svg = await exportSVG(page, "line");
  expect((svg.match(/<polyline/g) ?? []).length).toBe(1);
  expect(svg).toMatch(/stroke="(#1a7f37|rgb\(26, 127, 55\))"/);
  expect(svg).toContain(">Day<");
  expect(svg).toContain(">Temperature (°C)<");
  expect(svg).not.toContain("<circle");
  expect(svg).toContain('clip-path="url(#line-chart-clip)"');
});

// 100+ points, log scale, appearance, zoom, a failed re-import, then a fixed one.
test("a bad edit to a large file keeps the chart, and the fixed file keeps the settings", async ({ page }) => {
  await importFile(page, "many.csv", csvWithPoints(150));
  await page.locator("#log-y").click();
  await page.getByLabel("Color for y").fill("#cc79a7");
  await page.locator("#y-label").fill("Height");
  await page.locator("#zoom-in").click();
  await expect(page.locator("#zoom-status")).toHaveText("Zoomed 2x.");
  const zoomedMarkers = await markers(page, "scatter").count();

  await importFile(page, "many.csv", `${csvWithPoints(150)}\n151,oops`);
  await expect(page.locator("#status")).toHaveClass(/error/);
  await expect(page.locator("#zoom-status")).toHaveText("Zoomed 2x.");
  await expect(markers(page, "scatter")).toHaveCount(zoomedMarkers);

  await importFile(page, "many.csv", csvWithPoints(160));
  await expect(page.locator("#zoom-status")).toHaveText("Showing all points.");
  await expect(markers(page, "scatter")).toHaveCount(160);
  await expect(page.locator("#log-y")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#line-chart polyline.line")).toHaveAttribute("stroke", "#cc79a7");
  await expect(page.locator("#line-chart text.axis-label").last()).toHaveText("Height (log)");
});
