// Story: As a user, I want to keep track of where I am when zoomed in, and zoom
//   out past the edges of my data (issue #20). Zooming out stops at 0.1x, where
//   the data fills the middle tenth of each axis; a minimap shows the view.
const { test, expect } = require("@playwright/test");
const { importFile, csvWithPoints, plotPoint, markers, xTickLabels } = require("./helpers.cjs");

const N = 150;
const zoomStatus = (page) => page.locator("#zoom-status");
const yTickLabels = (page) => page.locator('#line-chart text[text-anchor="end"]').allTextContents();

// Click a zoom button and wait for the redraw it schedules.
async function clickZoom(page, which) {
  const before = await zoomStatus(page).textContent();
  await page.locator(`#zoom-${which}`).click();
  await expect(zoomStatus(page)).not.toHaveText(before);
}

async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

// A rectangle's attributes in minimap coordinates.
const rectOf = (locator) => locator.evaluate((rect) =>
  Object.fromEntries(["x", "y", "width", "height"].map((name) => [name, Number(rect.getAttribute(name))]))
);

// Screen position of a point given in minimap coordinates.
async function minimapPoint(page, mx, my) {
  const minimap = page.locator("#minimap");
  await minimap.scrollIntoViewIfNeeded();
  const box = await minimap.boundingBox();
  const viewBox = await minimap.evaluate((svg) => svg.viewBox.baseVal);
  return { x: box.x + mx * box.width / viewBox.width, y: box.y + my * box.height / viewBox.height };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await importFile(page, "many.csv", csvWithPoints(N));
  await expect(markers(page, "line")).toHaveCount(N);
});

test.describe("zooming out past the data", () => {
  test("zoom out goes past both ends of the data, down to 0.1x", async ({ page }) => {
    await expect(page.locator("#zoom-out")).toBeEnabled();
    await clickZoom(page, "out");
    await expect(zoomStatus(page)).toHaveText("Zoomed 0.5x.");
    const ticks = (await xTickLabels(page, "line")).map(Number);
    expect(ticks[0]).toBeLessThan(1);
    expect(ticks[4]).toBeGreaterThan(N);
    await expect(markers(page, "line")).toHaveCount(N);
    await expect(markers(page, "scatter")).toHaveCount(N);

    for (let i = 0; i < 10 && await page.locator("#zoom-out").isEnabled(); i++) await clickZoom(page, "out");
    await expect(page.locator("#zoom-out")).toBeDisabled();
    await expect(zoomStatus(page)).toHaveText("Zoomed 0.1x.");
    // The data (1 to 150) fills the middle tenth: 4.5 data widths on each side.
    const widest = (await xTickLabels(page, "line")).map(Number);
    expect(widest[0]).toBeLessThan(1 - 4 * (N - 1));
    expect(widest[2]).toBeCloseTo(75.5);
    expect(widest[4]).toBeGreaterThan(N + 4 * (N - 1));
  });

  test("Ctrl + wheel zooms out around the pointer", async ({ page }) => {
    const target = await plotPoint(page, "line", 0.25, 0.5);
    await page.mouse.move(target.x, target.y);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, 400);
    await page.keyboard.up("Control");
    await expect(zoomStatus(page)).toContainText("Zoomed 0.");
    const ticks = (await xTickLabels(page, "line")).map(Number);
    expect(ticks[0]).toBeLessThan(1);
    expect(ticks[4]).toBeGreaterThan(N);
  });

  test("zoomed out, dragging pans, and Reset zoom returns to the data's range", async ({ page }) => {
    await clickZoom(page, "out");
    await expect(page.locator("#zoom-reset")).toBeEnabled();
    const before = (await xTickLabels(page, "line")).map(Number);
    // Drag left: the content moves left, revealing higher x values.
    await drag(page, await plotPoint(page, "scatter", 0.7, 0.5), await plotPoint(page, "scatter", 0.4, 0.5));
    await expect.poll(async () => Number((await xTickLabels(page, "line"))[0])).toBeGreaterThan(before[0]);

    await page.locator("#zoom-reset").click();
    await expect(zoomStatus(page)).toHaveText("Showing all points.");
    expect(await xTickLabels(page, "line")).toEqual(["1", "38.3", "75.5", "113", "150"]);
    await expect(page.locator("#zoom-reset")).toBeDisabled();
    await expect(page.locator("#zoom-out")).toBeEnabled();
  });

  test("zoomed in, panning can go past the last point", async ({ page }) => {
    await clickZoom(page, "in");
    await clickZoom(page, "in");
    for (let i = 0; i < 3; i++) {
      await drag(page, await plotPoint(page, "line", 0.9, 0.5), await plotPoint(page, "line", 0.1, 0.5));
    }
    await expect.poll(async () => Number((await xTickLabels(page, "line"))[4])).toBeGreaterThan(N);
  });

  test("a zoomed-out log axis shows more decades, never zero or negative", async ({ page }) => {
    await importFile(page, "decades.csv", "x,y\n1,1\n10,10\n100,100\n1000,1000");
    await page.locator("#log-x").click();
    for (let i = 0; i < 10 && await page.locator("#zoom-out").isEnabled(); i++) await clickZoom(page, "out");
    const ticks = (await xTickLabels(page, "line")).map(Number);
    for (const tick of ticks) expect(tick).toBeGreaterThan(0);
    expect(ticks[0]).toBeLessThan(1e-3);
    expect(ticks[4]).toBeGreaterThan(1e6);
  });
});

test.describe("minimap", () => {
  const dataRect = (page) => rectOf(page.locator("#minimap .minimap-data"));
  const viewRect = (page) => rectOf(page.locator("#minimap .minimap-view"));

  test("appears with data, and its box covers all the data at full view", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#minimap-panel")).toBeHidden();
    await importFile(page, "many.csv", csvWithPoints(N));
    await expect(page.locator("#minimap-panel")).toBeVisible();
    await expect(page.locator("#minimap polyline")).toHaveCount(1);
    expect(await viewRect(page)).toEqual(await dataRect(page));
    await expect(page.locator("#minimap-caption")).toContainText("x 1 to 150");
  });

  test("zoomed in, the box shrinks to the part in view", async ({ page }) => {
    await clickZoom(page, "in");
    await clickZoom(page, "in");
    const data = await dataRect(page);
    const box = await viewRect(page);
    expect(box.width).toBeCloseTo(data.width / 4);
    expect(box.height).toBeCloseTo(data.height / 4);
    expect(box.x).toBeGreaterThan(data.x);
    expect(box.x + box.width).toBeLessThan(data.x + data.width);
    await expect(page.locator("#minimap-caption")).toContainText("x 56.9 to 94.1");
  });

  test("zoomed out, the box is larger than the data and surrounds it", async ({ page }) => {
    await clickZoom(page, "out");
    const data = await dataRect(page);
    const box = await viewRect(page);
    expect(box.width).toBeCloseTo(data.width * 2);
    expect(box.x).toBeLessThan(data.x);
    expect(box.x + box.width).toBeGreaterThan(data.x + data.width);
  });

  test("dragging the box pans both charts", async ({ page }) => {
    await clickZoom(page, "in");
    await clickZoom(page, "in");
    const before = (await xTickLabels(page, "line")).map(Number);
    const box = await viewRect(page);
    const from = await minimapPoint(page, box.x + box.width / 2, box.y + box.height / 2);
    const to = await minimapPoint(page, box.x + box.width / 2 + 20, box.y + box.height / 2);
    await drag(page, from, to);
    await expect.poll(async () => Number((await xTickLabels(page, "line"))[0])).toBeGreaterThan(before[0]);
    expect(await xTickLabels(page, "scatter")).toEqual(await xTickLabels(page, "line"));
  });

  test("clicking outside the box centers the view there", async ({ page }) => {
    await clickZoom(page, "in");
    await clickZoom(page, "in");
    const data = await dataRect(page);
    const target = await minimapPoint(page, data.x + data.width * 0.9, data.y + data.height / 2);
    await page.mouse.click(target.x, target.y);
    // x = 1 + 0.9 * 149 = 135.1 is now the middle tick.
    await expect.poll(async () => Number((await xTickLabels(page, "line"))[2])).toBeCloseTo(135.1, 0);
  });

  test("arrow keys on the focused minimap pan the view", async ({ page }) => {
    await clickZoom(page, "in");
    const x = (await xTickLabels(page, "line")).map(Number);
    const y = (await yTickLabels(page)).map(Number);
    await page.locator("#minimap").focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => Number((await xTickLabels(page, "line"))[0])).toBeGreaterThan(x[0]);
    await page.keyboard.press("ArrowUp");
    // Y tick labels are listed bottom to top.
    await expect.poll(async () => Number((await yTickLabels(page))[0])).toBeGreaterThan(y[0]);
  });
});
