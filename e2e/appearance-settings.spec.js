// Story: As a user, I want the chart to look the way I set it up, including on
//   hover and in exports (issue #26). Hover keeps each line's color, a slider
//   sizes scatter points, a title shows above the charts and in exports, and
//   the legend can be moved off the data.
const { test, expect } = require("@playwright/test");
const { PLOT, importFile } = require("./helpers.cjs");
const fs = require("node:fs");

const middle = { x: (PLOT.left + PLOT.right) / 2, y: (PLOT.top + PLOT.bottom) / 2 };
const radii = (page, chart) => page.locator(`#${chart}-chart circle.point`).evaluateAll((c) => c.map((e) => e.getAttribute("r")));

// Top-left corner of a chart's legend, from its transform, in chart coordinates.
async function legendAt(page, chart) {
  const transform = await page.locator(`#${chart}-chart g.legend`).getAttribute("transform");
  const [x, y] = transform.match(/-?[\d.]+/g).map(Number);
  return { x, y };
}

async function exportSVG(page, chart) {
  await page.locator(`#${chart}-format`).selectOption("svg");
  const download = page.waitForEvent("download");
  await page.locator(`.export-button[data-chart="${chart}"]`).click();
  return fs.readFileSync(await (await download).path(), "utf8");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Two lines that both rise from the bottom left to the top right.
  await importFile(page, "city-temperatures.csv", fs.readFileSync("test-data/city-temperatures.csv", "utf8"));
});

test("a hovered or focused point keeps its line's color and gets a dark ring", async ({ page }) => {
  await page.getByLabel("Color for cityA_temp").fill("#1a7f37");
  const style = (point) => point.evaluate((circle) => {
    const computed = getComputedStyle(circle);
    return { fill: computed.fill, stroke: computed.stroke };
  });
  const first = page.locator("#scatter-chart circle.point").first();
  await first.focus();
  const focused = await style(first);
  expect(focused.fill).toBe("rgb(26, 127, 55)");
  expect(focused.stroke).not.toBe("rgb(255, 255, 255)");
  expect(focused.stroke).not.toBe(focused.fill);

  // Hovering a point of the other line keeps that line's default color.
  const other = page.locator("#line-chart circle.point").last();
  await other.hover();
  const hovered = await style(other);
  expect(hovered.fill).toBe("rgb(230, 159, 0)");
  expect(hovered.stroke).toBe(focused.stroke);
});

test("the point size slider resizes scatter points only, and exports keep the size", async ({ page }) => {
  const slider = page.locator("#point-size");
  await expect(slider).toHaveValue("6");
  await expect(page.locator("#point-size-value")).toHaveText("6");
  await slider.fill("10");
  await expect(page.locator("#point-size-value")).toHaveText("10");
  expect(new Set(await radii(page, "scatter"))).toEqual(new Set(["10"]));
  expect(new Set(await radii(page, "line"))).toEqual(new Set(["6"]));

  // The keyboard works too, and the size survives importing again.
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#point-size-value")).toHaveText("9");
  await importFile(page, "city-temperatures.csv", fs.readFileSync("test-data/city-temperatures.csv", "utf8"));
  expect(new Set(await radii(page, "scatter"))).toEqual(new Set(["9"]));

  const svg = await exportSVG(page, "scatter");
  expect((svg.match(/<circle[^>]* r="9"/g) ?? []).length).toBe(28);
});

test("a chart title shows above the charts and names the exported images", async ({ page }) => {
  const shown = page.locator("#chart-title-text");
  await expect(shown).toBeHidden();
  await page.locator("#chart-title").fill("Spring temperatures");
  await expect(shown).toHaveText("Spring temperatures");
  for (const chart of ["line", "scatter"]) {
    const svg = await exportSVG(page, chart);
    expect(svg).toContain(">Spring temperatures</title>");
    expect(svg).toMatch(/<text[^>]*>Spring temperatures<\/text>/);
  }
  // A blank title hides it, and exports go back to the chart's own name.
  await page.locator("#chart-title").fill("  ");
  await expect(shown).toBeHidden();
  expect(await exportSVG(page, "line")).toContain(">Line graph</title>");
});

test("Auto puts the legend in the corner that covers the fewest points", async ({ page }) => {
  await expect(page.locator("#legend-position")).toHaveValue("auto");
  // Rising lines cross the top-right and bottom-left corners.
  for (const chart of ["line", "scatter"]) {
    const at = await legendAt(page, chart);
    expect(at.x).toBeLessThan(middle.x);
    expect(at.y).toBeLessThan(middle.y);
  }
  // Falling lines cross the top-left and bottom-right corners instead.
  await importFile(page, "falling.csv", "x,a,b\n1,10,9\n2,8,7\n3,6,5\n4,4,3\n5,2,1");
  const at = await legendAt(page, "line");
  expect(at.x).toBeGreaterThan(middle.x);
  expect(at.y).toBeLessThan(middle.y);
});

test("choosing a corner moves the legend on both charts and in exports", async ({ page }) => {
  await page.locator("#legend-position").selectOption("bottom-right");
  for (const chart of ["line", "scatter"]) {
    const at = await legendAt(page, chart);
    expect(at.x).toBeGreaterThan(middle.x);
    expect(at.y).toBeGreaterThan(middle.y);
  }
  const at = await legendAt(page, "line");
  const svg = await exportSVG(page, "line");
  expect(svg).toContain(`translate(${at.x} ${at.y})`);
  // The choice stays when the data changes.
  await importFile(page, "falling.csv", "x,a,b\n1,10,9\n2,8,7\n3,6,5\n4,4,3\n5,2,1");
  expect((await legendAt(page, "scatter")).y).toBeGreaterThan(middle.y);
});
