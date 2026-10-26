// Story (#23): As a user, I want to compare data points across both charts.
//   #24: a crosshair follows the pointer on either chart and is drawn at the
//   same values on the other one, with those values read off both axes.
const { test, expect } = require("@playwright/test");
const { PLOT, importFile, plotPoint, markers } = require("./helpers.cjs");
const fs = require("node:fs");

// x runs 0..100 and y 0..200, so plot fractions convert to values by hand.
const CSV = "x,y\n0,0\n25,40\n50,120\n75,150\n100,200";

const crosshair = (page, chart) => page.locator(`#${chart}-chart .crosshair`);
const readout = (page, chart, axis) => page.locator(`#${chart}-chart .crosshair-${axis} text`);
const readNumber = async (locator) => Number(await locator.textContent());
const lineAttribute = async (page, chart, which, name) =>
  Number(await page.locator(`#${chart}-chart .crosshair-${which}`).getAttribute(name));
const svgX = (fx) => PLOT.left + fx * (PLOT.right - PLOT.left);
const svgY = (fy) => PLOT.bottom - fy * (PLOT.bottom - PLOT.top);
const near = (actual, expected, tolerance) =>
  expect(Math.abs(actual - expected), `${actual} is not within ${tolerance} of ${expected}`).toBeLessThanOrEqual(tolerance);

async function hover(page, chart, fx, fy) {
  const target = await plotPoint(page, chart, fx, fy);
  await page.mouse.move(target.x, target.y);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await importFile(page, "compare.csv", CSV);
  // A scroll hides the crosshair (as it does the tooltip), so bring the
  // charts into view first and let the scroll event pass.
  await page.locator("#line-chart").scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
});

test("hovering either chart draws the crosshair at the same place on both", async ({ page }) => {
  await expect(crosshair(page, "line")).toBeHidden();
  await expect(crosshair(page, "scatter")).toBeHidden();

  await hover(page, "line", 0.25, 0.5);
  for (const chart of ["line", "scatter"]) {
    await expect(crosshair(page, chart)).toBeVisible();
    near(await lineAttribute(page, chart, "vertical", "x1"), svgX(0.25), 2);
    near(await lineAttribute(page, chart, "horizontal", "y1"), svgY(0.5), 2);
  }

  await hover(page, "scatter", 0.8, 0.2);
  for (const chart of ["line", "scatter"]) {
    await expect(crosshair(page, chart)).toBeVisible();
    near(await lineAttribute(page, chart, "vertical", "x1"), svgX(0.8), 2);
    near(await lineAttribute(page, chart, "horizontal", "y1"), svgY(0.2), 2);
  }
});

test("both charts read the values under the crosshair off their axes", async ({ page }) => {
  await hover(page, "line", 0.25, 0.5);
  for (const chart of ["line", "scatter"]) {
    near(await readNumber(readout(page, chart, "x")), 25, 1);
    near(await readNumber(readout(page, chart, "y")), 100, 2);
  }
  expect(await readout(page, "scatter", "x").textContent()).toBe(await readout(page, "line", "x").textContent());
  expect(await readout(page, "scatter", "y").textContent()).toBe(await readout(page, "line", "y").textContent());
});

test("leaving the plot area hides the crosshair on both charts", async ({ page }) => {
  await hover(page, "line", 0.5, 0.5);
  await expect(crosshair(page, "scatter")).toBeVisible();

  await hover(page, "line", 0.5, -0.1); // Below the plot, over the tick labels.
  await expect(crosshair(page, "line")).toBeHidden();
  await expect(crosshair(page, "scatter")).toBeHidden();

  await hover(page, "scatter", 0.5, 0.5);
  await expect(crosshair(page, "line")).toBeVisible();
  await page.locator("#line-heading").hover();
  await expect(crosshair(page, "line")).toBeHidden();
  await expect(crosshair(page, "scatter")).toBeHidden();
});

test("scrolling the page hides the crosshair that follows the pointer", async ({ page }) => {
  await hover(page, "line", 0.5, 0.5);
  await expect(crosshair(page, "line")).toBeVisible();
  // Up: the charts are at the bottom of the page, which is scrolled to the end.
  await page.evaluate(() => window.scrollBy(0, -40));
  await expect(crosshair(page, "line")).toBeHidden();
  await expect(crosshair(page, "scatter")).toBeHidden();
});

test("points under the crosshair still show their tooltip", async ({ page }) => {
  await markers(page, "line").nth(2).hover();
  await expect(page.locator("#point-tooltip")).toBeVisible();
  await expect(page.locator("#point-tooltip")).toHaveText("x: 50\ny: 120");
  await expect(crosshair(page, "scatter")).toBeVisible();
});

test("the crosshair still works with the line graph's markers hidden", async ({ page }) => {
  await page.locator("#show-line-points").uncheck();
  await expect(markers(page, "line")).toHaveCount(0);
  await hover(page, "line", 0.75, 0.25);
  await expect(crosshair(page, "line")).toBeVisible();
  await expect(crosshair(page, "scatter")).toBeVisible();
  near(await readNumber(readout(page, "line", "x")), 75, 1);
  near(await readNumber(readout(page, "line", "y")), 50, 2);
});

test("zooming with the wheel keeps the crosshair, and the values under it, at the pointer", async ({ page }) => {
  await hover(page, "line", 0.25, 0.5);
  const before = await readNumber(readout(page, "line", "x"));
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -400);
  await page.keyboard.up("Control");
  await expect(page.locator("#zoom-status")).toContainText("Zoomed");
  for (const chart of ["line", "scatter"]) {
    await expect(crosshair(page, chart)).toBeVisible();
    near(await lineAttribute(page, chart, "vertical", "x1"), svgX(0.25), 2);
    near(await readNumber(readout(page, chart, "x")), before, 1);
  }
});

test("on a log axis the readout follows the log scale", async ({ page }) => {
  await importFile(page, "log.csv", "x,y\n1,1\n10,10\n100,100\n1000,1000\n10000,10000");
  await page.locator("#log-x").click();
  await expect(page.locator("#log-x")).toHaveAttribute("aria-pressed", "true");
  await hover(page, "scatter", 0.5, 0.5);
  // Halfway along a log axis from 1 to 10000 is 100; the linear Y axis is at 5000.5.
  near(await readNumber(readout(page, "scatter", "x")), 100, 5);
  near(await readNumber(readout(page, "scatter", "y")), 5000, 60);
});

test("focusing a point with the keyboard puts the crosshair through it on both charts", async ({ page }) => {
  const point = markers(page, "scatter").nth(2); // (50, 120)
  await point.focus();
  const cx = Number(await point.getAttribute("cx"));
  const cy = Number(await point.getAttribute("cy"));
  for (const chart of ["line", "scatter"]) {
    await expect(crosshair(page, chart)).toBeVisible();
    near(await lineAttribute(page, chart, "vertical", "x1"), cx, 0.01);
    near(await lineAttribute(page, chart, "horizontal", "y1"), cy, 0.01);
    await expect(readout(page, chart, "x")).toHaveText("50");
    await expect(readout(page, chart, "y")).toHaveText("120");
  }
  // Tabbing to a point can scroll the page; its crosshair scrolls with the chart.
  await page.evaluate(() => window.scrollBy(0, -40));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(crosshair(page, "scatter")).toBeVisible();

  await page.locator("#line-format").focus();
  await expect(crosshair(page, "line")).toBeHidden();
  await expect(crosshair(page, "scatter")).toBeHidden();
});

test("dragging to pan hides the crosshair until the pointer moves again", async ({ page }) => {
  await page.locator("#zoom-in").click();
  await expect(page.locator("#zoom-status")).toContainText("Zoomed 2x");
  await hover(page, "scatter", 0.5, 0.5);
  await expect(crosshair(page, "scatter")).toBeVisible();

  await page.mouse.down();
  await expect(crosshair(page, "scatter")).toBeHidden();
  const to = await plotPoint(page, "scatter", 0.7, 0.5);
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await expect(crosshair(page, "line")).toBeHidden();
  await expect(crosshair(page, "scatter")).toBeHidden();
  await page.mouse.up();

  await page.mouse.move(to.x + 5, to.y);
  await expect(crosshair(page, "line")).toBeVisible();
  await expect(crosshair(page, "scatter")).toBeVisible();
});

test("exported images leave out the crosshair", async ({ page }) => {
  await page.locator("#line-format").selectOption("svg");
  // Keyboard focus keeps the crosshair on screen while the export runs.
  await markers(page, "line").nth(1).focus();
  await expect(crosshair(page, "line")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.locator('.export-button[data-chart="line"]').evaluate((button) => button.click());
  const svg = fs.readFileSync(await (await download).path(), "utf8");
  // One line, so no legend: only the five grid lines, and only the white
  // background and the line's clipping rectangle, remain.
  expect((svg.match(/<line/g) ?? []).length).toBe(5);
  expect((svg.match(/<rect/g) ?? []).length).toBe(2);
  await expect(crosshair(page, "line")).toBeVisible(); // The page keeps it.
});
