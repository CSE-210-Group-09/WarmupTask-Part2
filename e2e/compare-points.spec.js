// Story (#23): As a user, I want to compare data points across both charts.
//   #24: a crosshair follows the pointer on either chart and is drawn at the
//   same values on the other one, with those values read off both axes.
//   #25: with the line graph's markers hidden, hovering it snaps to the data
//   point nearest by X: a dot marks it and the tooltip shows its values.
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

test("with the line graph's markers hidden, its crosshair snaps and the scatter plot's doesn't", async ({ page }) => {
  await page.locator("#show-line-points").uncheck();
  await expect(markers(page, "line")).toHaveCount(0);
  // The line graph snaps to the nearest point by X (#25): (75, 150).
  await hover(page, "line", 0.72, 0.25);
  await expect(crosshair(page, "line")).toBeVisible();
  await expect(crosshair(page, "scatter")).toBeVisible();
  await expect(readout(page, "line", "x")).toHaveText("75");
  await expect(readout(page, "line", "y")).toHaveText("150");
  // The scatter plot keeps its markers, so its crosshair follows the pointer.
  await hover(page, "scatter", 0.72, 0.25);
  near(await readNumber(readout(page, "scatter", "x")), 72, 1);
  near(await readNumber(readout(page, "scatter", "y")), 50, 2);
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

// #25: snapping to the nearest point by X when the line graph hides its markers.
const tooltip = (page) => page.locator("#point-tooltip");
const snapDots = (page) => page.locator("#line-chart .snap-dot");

test.describe("with the line graph's markers hidden", () => {
  test.beforeEach(async ({ page }) => {
    await page.locator("#show-line-points").uncheck();
    await expect(markers(page, "line")).toHaveCount(0);
  });

  test("hovering snaps to the nearest point by X, with its tooltip and a dot in the line's color", async ({ page }) => {
    // Nearest by X is x = 50 (at 0.5), however far the pointer is from it vertically.
    await hover(page, "line", 0.45, 0.95);
    await expect(tooltip(page)).toBeVisible();
    await expect(tooltip(page)).toHaveText("x: 50\ny: 120");
    await expect(snapDots(page)).toHaveCount(1);
    const dot = snapDots(page).first();
    near(Number(await dot.getAttribute("cx")), svgX(0.5), 0.01);
    near(Number(await dot.getAttribute("cy")), svgY(0.6), 0.01);
    const color = await page.locator("#line-chart polyline.line").getAttribute("stroke");
    await expect(dot).toHaveAttribute("fill", color);
    // The crosshair snaps to the same point on both charts.
    for (const chart of ["line", "scatter"]) {
      near(await lineAttribute(page, chart, "vertical", "x1"), svgX(0.5), 0.01);
      near(await lineAttribute(page, chart, "horizontal", "y1"), svgY(0.6), 0.01);
      await expect(readout(page, chart, "x")).toHaveText("50");
    }
  });

  test("moving along the plot follows the nearest X, and leaving it clears the dot and tooltip", async ({ page }) => {
    await hover(page, "line", 0.45, 0.5);
    await expect(tooltip(page)).toHaveText("x: 50\ny: 120");
    await hover(page, "line", 0.3, 0.5);
    await expect(tooltip(page)).toHaveText("x: 25\ny: 40");
    near(Number(await snapDots(page).first().getAttribute("cx")), svgX(0.25), 0.01);
    await hover(page, "line", 0.95, 0.1);
    await expect(tooltip(page)).toHaveText("x: 100\ny: 200");

    await page.locator("#line-heading").hover();
    await expect(tooltip(page)).toBeHidden();
    await expect(snapDots(page)).toHaveCount(0);
  });

  test("with several lines, the tooltip lists each line's value at that X and each line gets a dot", async ({ page }) => {
    await importFile(page, "city-temperatures.csv", fs.readFileSync("test-data/city-temperatures.csv", "utf8"));
    await expect(page.locator("#line-chart polyline.line")).toHaveCount(2);
    // Days run 1 to 14; aim a little right of day 5.
    await hover(page, "line", (5.3 - 1) / 13, 0.5);
    await expect(tooltip(page)).toHaveText("day: 5\ncityA_temp: 17.4\ncityB_temp: 10.2");
    await expect(snapDots(page)).toHaveCount(2);
    const lineColors = await page.locator("#line-chart polyline.line").evaluateAll((lines) => lines.map((l) => l.getAttribute("stroke")));
    const dotColors = await snapDots(page).evaluateAll((dots) => dots.map((d) => d.getAttribute("fill")));
    expect(dotColors).toEqual(lineColors);
    const xs = await snapDots(page).evaluateAll((dots) => dots.map((d) => Number(d.getAttribute("cx"))));
    expect(xs[0]).toBe(xs[1]);
  });

  test("zoomed in, it only snaps to points in view", async ({ page }) => {
    // x = 36 is just left of the 4x view (x = 37.5 to 62.5) and closer to the
    // pointer than x = 50, the only point in view.
    await importFile(page, "edge.csv", "x,y\n0,0\n36,72\n50,100\n100,200");
    await page.locator("#zoom-in").click();
    await page.locator("#zoom-in").click();
    await expect(page.locator("#zoom-status")).toContainText("Zoomed 4x");
    await hover(page, "line", 0.05, 0.5);
    await expect(tooltip(page)).toHaveText("x: 50\ny: 100");
    near(Number(await snapDots(page).first().getAttribute("cx")), svgX(0.5), 0.01);
  });

  test("a value above or below the view is listed without a dot", async ({ page }) => {
    await page.locator("#zoom-in").click();
    await expect(page.locator("#zoom-status")).toContainText("Zoomed 2x");
    // The view spans x = 25 to 75 and y = 50 to 150, so (25, 40) is below it.
    await hover(page, "line", 0.1, 0.5);
    await expect(tooltip(page)).toHaveText("x: 25\ny: 40");
    await expect(snapDots(page)).toHaveCount(0);
    await hover(page, "line", 0.55, 0.5);
    await expect(tooltip(page)).toHaveText("x: 50\ny: 120");
    near(Number(await snapDots(page).first().getAttribute("cx")), svgX(0.5), 0.01);
  });

  test("dragging to pan clears the dot and tooltip until the pointer moves again", async ({ page }) => {
    await page.locator("#zoom-in").click();
    await expect(page.locator("#zoom-status")).toContainText("Zoomed 2x");
    await hover(page, "line", 0.5, 0.5);
    await expect(snapDots(page)).toHaveCount(1);
    await page.mouse.down();
    await expect(tooltip(page)).toBeHidden();
    await expect(snapDots(page)).toHaveCount(0);
    const to = await plotPoint(page, "line", 0.7, 0.5);
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await expect(snapDots(page)).toHaveCount(0);
    await page.mouse.up();
    await page.mouse.move(to.x + 5, to.y);
    await expect(snapDots(page)).toHaveCount(1);
    await expect(tooltip(page)).toBeVisible();
  });

  test("exported images leave out the snapped dot", async ({ page }) => {
    await page.locator("#line-format").selectOption("svg");
    await hover(page, "line", 0.5, 0.5);
    await expect(snapDots(page)).toHaveCount(1);
    // Export from the keyboard so the pointer stays on the chart.
    await page.locator('.export-button[data-chart="line"]').focus();
    const download = page.waitForEvent("download");
    await page.keyboard.press("Enter");
    const svg = fs.readFileSync(await (await download).path(), "utf8");
    expect(svg).not.toContain("<circle");
    await expect(snapDots(page)).toHaveCount(1);
  });
});

test("with markers shown, the line graph doesn't snap", async ({ page }) => {
  await hover(page, "line", 0.45, 0.95); // Away from every marker.
  await expect(tooltip(page)).toBeHidden();
  await expect(snapDots(page)).toHaveCount(0);
  near(await lineAttribute(page, "line", "vertical", "x1"), svgX(0.45), 2);
  // Hovering a marker still shows its own tooltip.
  await markers(page, "line").nth(2).hover();
  await expect(tooltip(page)).toHaveText("x: 50\ny: 120");
});
