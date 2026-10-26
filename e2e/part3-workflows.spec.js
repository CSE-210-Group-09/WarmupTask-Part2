// End-to-end workflows for the part 3 stories, written before the stories:
//   #20 zoom navigation, #26 appearance settings, #31 JSON and spreadsheet import.
// Each workflow needs two stories, so it is marked as expected to fail
// (test.fail) and main stays green. When the second of its stories reaches
// main, the workflow passes, Playwright reports that, and that story's PR
// removes the marker.
const { test, expect } = require("@playwright/test");
const { importFile } = require("./helpers.cjs");
const fs = require("node:fs");

const rectOf = (locator) => locator.evaluate((rect) =>
  Object.fromEntries(["x", "y", "width", "height"].map((name) => [name, Number(rect.getAttribute(name))]))
);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("open a spreadsheet, zoom out past it, and find the view on the minimap", async ({ page }) => {
  test.fail(true, "Needs #31 (file import) and #20 (zoom navigation) on main");
  await importFile(page, "city-temperatures.xlsx", fs.readFileSync("test-data/city-temperatures.xlsx"));
  await expect(page.locator("#status")).toHaveText(/^Imported city-temperatures\.xlsx\. Points: 14\./);
  await expect(page.locator("#zoom-out")).toBeEnabled();
  await page.locator("#zoom-out").click();
  await expect(page.locator("#zoom-status")).toHaveText("Zoomed 0.5x.");
  const data = await rectOf(page.locator("#minimap .minimap-data"));
  const view = await rectOf(page.locator("#minimap .minimap-view"));
  expect(view.width).toBeGreaterThan(data.width);
  await expect(page.locator("#minimap-caption")).toContainText("x -5.5 to 20.5");
});

test("import JSON, then title, size, place the legend and export the scatter plot", async ({ page }) => {
  test.fail(true, "Needs #31 (file import) and #26 (appearance) on main");
  await importFile(page, "city-temperatures.json", fs.readFileSync("test-data/city-temperatures.json", "utf8"));
  await expect(page.locator("#status")).toHaveText(/^Imported city-temperatures\.json\. Points: 14\./);
  await page.locator("#chart-title").fill("Spring temperatures");
  await page.locator("#point-size").fill("10");
  await page.locator("#legend-position").selectOption("bottom-right");
  const legendAt = await page.locator("#scatter-chart g.legend").getAttribute("transform");
  await page.locator("#scatter-format").selectOption("svg");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export scatter plot image" }).click();
  const svg = fs.readFileSync(await (await download).path(), "utf8");
  expect(svg).toContain(">Spring temperatures</title>");
  expect((svg.match(/<circle[^>]* r="10"/g) ?? []).length).toBe(28);
  expect(svg).toContain(`transform="${legendAt}"`);
});

test("zoomed out, the legend and hover follow the chart's settings", async ({ page }) => {
  test.fail(true, "Needs #20 (zoom navigation) and #26 (appearance) on main");
  await importFile(page, "city-temperatures.csv", fs.readFileSync("test-data/city-temperatures.csv", "utf8"));
  await expect(page.locator("#zoom-out")).toBeEnabled();
  await page.locator("#zoom-out").click();
  await expect(page.locator("#zoom-status")).toHaveText("Zoomed 0.5x.");
  // The data now fills the middle of the plot, so every corner is clear and
  // Auto keeps the legend top right.
  await expect(page.locator("#legend-position")).toHaveValue("auto");
  const transform = await page.locator("#line-chart g.legend").getAttribute("transform");
  const [x, y] = transform.match(/-?[\d.]+/g).map(Number);
  expect(x).toBeGreaterThan(267);
  expect(y).toBeLessThan(136);
  await page.getByLabel("Color for cityA_temp").fill("#1a7f37");
  const point = page.locator("#scatter-chart circle.point").first();
  await point.focus();
  expect(await point.evaluate((circle) => getComputedStyle(circle).fill)).toBe("rgb(26, 127, 55)");
});
