// Story: As a user, I want to be able to customize the appearance of the plot.
//   A color option and editable axis labels.
const { test, expect } = require("@playwright/test");
const { importFile } = require("./helpers.cjs");
const fs = require("node:fs");

const axisLabels = (page, chart) => page.locator(`#${chart}-chart text.axis-label`).allTextContents();

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await importFile(page, "sample.csv", fs.readFileSync("sample.csv", "utf8"));
});

test("a line's color recolors the line and its points in both charts", async ({ page }) => {
  await page.getByLabel("Color for y").fill("#d4492c");
  await expect(page.locator("#line-chart polyline.line")).toHaveAttribute("stroke", "#d4492c");
  for (const chart of ["line", "scatter"]) {
    const fills = await page.locator(`#${chart}-chart circle.point`).evaluateAll((c) => c.map((e) => e.getAttribute("fill")));
    expect(fills).toEqual(Array(6).fill("#d4492c"));
  }
  // The choice survives importing another file.
  await importFile(page, "two.csv", "x,y\n1,1\n2,2");
  await expect(page.locator("#line-chart polyline.line")).toHaveAttribute("stroke", "#d4492c");
});

test("typed axis labels appear on both charts and blank labels fall back to column names", async ({ page }) => {
  expect(await axisLabels(page, "line")).toEqual(["x", "y"]);
  await page.locator("#x-label").fill("Day");
  await page.locator("#y-label").fill("Height (cm)");
  expect(await axisLabels(page, "line")).toEqual(["Day", "Height (cm)"]);
  expect(await axisLabels(page, "scatter")).toEqual(["Day", "Height (cm)"]);
  await page.locator("#log-y").click();
  expect(await axisLabels(page, "line")).toEqual(["Day", "Height (cm) (log)"]);
  await page.locator("#x-label").fill("  ");
  expect(await axisLabels(page, "scatter")).toEqual(["x", "Height (cm) (log)"]);
});

test("exported images use the chosen color and labels", async ({ page }) => {
  await page.getByLabel("Color for y").fill("#1a7f37");
  await page.locator("#x-label").fill("Day");
  await page.locator("#scatter-format").selectOption("svg");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export scatter plot image" }).click();
  const svg = fs.readFileSync(await (await download).path(), "utf8");
  expect(svg).toContain(">Day<");
  expect(svg).toMatch(/fill="(#1a7f37|rgb\(26, 127, 55\))"/);
});
