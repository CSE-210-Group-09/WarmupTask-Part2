// Shared helpers for the browser tests.

// Plot area inside the 480 x 300 chart viewBox (PLOT in app.js).
const PLOT = { left: 96, right: 438, top: 20, bottom: 252 };

// Import a file through the real file input, then wait for the status line to
// report success or an error. It is cleared first so an old message can't match.
async function importFile(page, name, text) {
  await page.locator("#status").evaluate((status) => {
    status.textContent = "";
    status.classList.remove("error");
  });
  await page.setInputFiles("#data-file", {
    name,
    mimeType: name.endsWith(".xml") ? "application/xml" : "text/csv",
    buffer: Buffer.from(text)
  });
  await page.waitForFunction((file) => {
    const status = document.querySelector("#status");
    return status.textContent.startsWith(`Imported ${file}.`) || status.classList.contains("error");
  }, name);
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

// Pan by dragging across the plot. Uses pointer events so WebKit sees the same
// input path as real users (page.mouse alone often skips pointermove on SVG).
async function panPlot(page, chart, fx0, fy0, fx1, fy1) {
  const from = await plotPoint(page, chart, fx0, fy0);
  const to = await plotPoint(page, chart, fx1, fy1);
  const svg = page.locator(`#${chart}-chart`);
  const pointer = (type, x, y, buttons) =>
    svg.dispatchEvent(type, {
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons,
      clientX: x,
      clientY: y
    });
  await pointer("pointerdown", from.x, from.y, 1);
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    await pointer("pointermove", x, y, 1);
  }
  await pointer("pointerup", to.x, to.y, 0);
}

module.exports = { PLOT, importFile, csvWithPoints, plotPoint, panPlot, markers, xTickLabels };
