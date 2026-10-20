// Shared helpers for the browser tests.
const { expect } = require("@playwright/test");

// Plot area inside the 480 x 300 chart viewBox (PLOT in app.js).
const PLOT = { left: 96, right: 438, top: 20, bottom: 252 };

// Import a file through the real file input, then wait for the status line.
async function importFile(page, name, text) {
  await page.setInputFiles("#data-file", {
    name,
    mimeType: name.endsWith(".xml") ? "application/xml" : "text/csv",
    buffer: Buffer.from(text)
  });
  await expect(page.locator("#status")).toContainText(new RegExp(`Imported ${name}|must|not|no |header`));
}

// A deterministic CSV with n rows: x = 1..n, y wiggles around a rising trend and stays positive.
function csvWithPoints(n) {
  const rows = ["x,y"];
  for (let i = 1; i <= n; i++) rows.push(`${i},${(i + 25 + 20 * Math.sin(i / 3)).toFixed(3)}`);
  return rows.join("\n");
}

// Screen coordinates of a position in a chart's plot area (0..1 from left / from bottom).
// The charts sit below the fold, so scroll first: a pointer outside the window hits nothing.
async function plotPoint(page, chart, fx, fy) {
  await page.locator(`#${chart}-chart`).scrollIntoViewIfNeeded();
  const box = await page.locator(`#${chart}-chart`).boundingBox();
  const scale = box.width / 480;
  return {
    x: box.x + (PLOT.left + fx * (PLOT.right - PLOT.left)) * scale,
    y: box.y + (PLOT.bottom - fy * (PLOT.bottom - PLOT.top)) * scale
  };
}

const markers = (page, chart) => page.locator(`#${chart}-chart circle.point`);
const xTickLabels = (page, chart) =>
  page.locator(`#${chart}-chart text[text-anchor="middle"]:not(.axis-label)`).allTextContents();

module.exports = { PLOT, importFile, csvWithPoints, plotPoint, markers, xTickLabels };
