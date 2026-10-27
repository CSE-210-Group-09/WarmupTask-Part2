// Story: As a user, I want to be able to properly view 100+ points.
//   Zooming + panning, a button to reset zoom, and an option to hide points
//   on the line graph (the points sometimes cover the line).
const { test, expect } = require("@playwright/test");
const { importFile, csvWithPoints, plotPoint, panPlot, markers, xTickLabels } = require("../e2e/helpers.cjs");
const fs = require("node:fs");

const N = 150;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await importFile(page, "many.csv", csvWithPoints(N));
  await expect(markers(page, "line")).toHaveCount(N);
});

test("all 150 points are drawn and the view starts unzoomed", async ({ page }) => {
  await expect(markers(page, "scatter")).toHaveCount(N);
  await expect(page.locator("#zoom-status")).toHaveText("Showing all points.");
  await expect(page.locator("#zoom-reset")).toBeDisabled();
  // Zooming out past the data is allowed (zoom-navigation.spec.js).
  await expect(page.locator("#zoom-out")).toBeEnabled();
  await expect(page.locator("#zoom-in")).toBeEnabled();
});

test("Ctrl + wheel zooms in around the pointer; a plain wheel does not", async ({ page }) => {
  let target = await plotPoint(page, "line", 0.25, 0.5);
  await page.mouse.move(target.x, target.y);
  await page.mouse.wheel(0, 200); // Scrolls the page instead.
  await expect(page.locator("#zoom-status")).toHaveText("Showing all points.");

  target = await plotPoint(page, "line", 0.25, 0.5); // Re-aim after the scroll.
  await page.mouse.move(target.x, target.y);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -400);
  await page.keyboard.up("Control");
  await expect(page.locator("#zoom-status")).toContainText("Zoomed");
  const visible = await markers(page, "line").count();
  expect(visible).toBeGreaterThan(0);
  expect(visible).toBeLessThan(N);
  // Anchored a quarter of the way along x, so the right end of the data
  // (x = 150) leaves the view.
  const ticks = (await xTickLabels(page, "line")).map(Number);
  expect(ticks[ticks.length - 1]).toBeLessThan(N);
  // The scatter plot shares the view.
  await expect(markers(page, "scatter")).toHaveCount(visible);
});

test("zoom buttons, panning by drag, and reset", async ({ page }) => {
  await page.locator("#zoom-in").click();
  await page.locator("#zoom-in").click();
  await expect(page.locator("#zoom-status")).toContainText("Zoomed 4x");
  const centered = await xTickLabels(page, "line");

  // Drag right: the content moves right, revealing lower x values.
  await panPlot(page, "scatter", 0.5, 0.5, 0.8, 0.5);
  await expect.poll(async () => Number((await xTickLabels(page, "line"))[0])).toBeLessThan(Number(centered[0]));

  await page.locator("#zoom-out").click();
  await expect(page.locator("#zoom-status")).toContainText("Zoomed 2x");

  await page.locator("#zoom-reset").click();
  await expect(page.locator("#zoom-status")).toHaveText("Showing all points.");
  await expect(markers(page, "line")).toHaveCount(N);
  await expect(page.locator("#zoom-reset")).toBeDisabled();
  expect(await xTickLabels(page, "line")).toEqual(["1", "38.3", "75.5", "113", "150"]);
});

test("dragging does nothing until zoomed in", async ({ page }) => {
  const before = await xTickLabels(page, "line");
  const from = await plotPoint(page, "line", 0.5, 0.5);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 120, from.y, { steps: 5 });
  await page.mouse.up();
  expect(await xTickLabels(page, "line")).toEqual(before);
});

test("tick labels stay distinct at maximum zoom", async ({ page }) => {
  // Each click halves the span; the button disables at the 1000x limit.
  const status = page.locator("#zoom-status");
  for (let i = 0; i < 20 && await page.locator("#zoom-in").isEnabled(); i++) {
    const before = await status.textContent();
    await page.locator("#zoom-in").click();
    await expect(status).not.toHaveText(before); // Wait for the redraw.
  }
  await expect(page.locator("#zoom-in")).toBeDisabled();
  await expect(page.locator("#zoom-status")).toContainText("Zoomed 1e+3x");
  const labels = await xTickLabels(page, "line");
  expect(new Set(labels).size).toBe(labels.length);
});

test("hiding line points keeps the line, and the scatter plot keeps its points", async ({ page }) => {
  await page.locator("#show-line-points").uncheck();
  await expect(markers(page, "line")).toHaveCount(0);
  await expect(page.locator("#line-chart polyline.line")).toHaveCount(1);
  await expect(markers(page, "scatter")).toHaveCount(N);
  // Still hidden after zooming.
  await page.locator("#zoom-in").click();
  await expect(markers(page, "line")).toHaveCount(0);
  await page.locator("#show-line-points").check();
  expect(await markers(page, "line").count()).toBeGreaterThan(0);
});

test("an exported image shows the zoomed view", async ({ page }) => {
  await page.locator("#zoom-in").click();
  await page.locator("#zoom-in").click();
  await expect(page.locator("#zoom-status")).toContainText("Zoomed 4x"); // Redraws wait for a frame.
  const visible = await markers(page, "line").count();
  await page.locator("#line-format").selectOption("svg");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export line graph image" }).click();
  const svg = fs.readFileSync(await (await download).path(), "utf8");
  expect((svg.match(/<circle/g) ?? []).length).toBe(visible);
  expect(svg).toContain('clip-path="url(#line-chart-clip)"');
});

test("importing new data or switching scale resets the zoom", async ({ page }) => {
  await page.locator("#zoom-in").click();
  await page.locator("#log-y").click();
  await expect(page.locator("#zoom-status")).toHaveText("Showing all points.");
  await page.locator("#zoom-in").click();
  await importFile(page, "again.csv", csvWithPoints(120));
  await expect(page.locator("#zoom-status")).toHaveText("Showing all points.");
  await expect(markers(page, "line")).toHaveCount(120);
});
