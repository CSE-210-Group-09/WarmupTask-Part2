// The single data source: each object is a point, such as { x: 1, y: 3 }.
// Points only come from the imported CSV, the user can't add or delete them on the page.
let points = [];
const fileInput = document.querySelector("#csv-file");
const importButton = document.querySelector("#import-button");
const status = document.querySelector("#status");
const tooltip = document.querySelector("#point-tooltip");
const logButtons = { x: document.querySelector("#log-x"), y: document.querySelector("#log-y") };
const logScale = { x: false, y: false };
const axisLabelInputs = { x: document.querySelector("#x-label"), y: document.querySelector("#y-label") };
const scaleHelp = document.querySelector("#scale-help");
const exportStatus = document.querySelector("#export-status");
const exportButtons = document.querySelectorAll(".export-button");

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

// This example accepts two numeric columns, x and y, rather than arbitrary CSV.
function parseCSV(text) {
  const lines = text.trim().split(/\r\n|\n|\r/);
  const readCells = (line) => line.split(",").map((cell) =>
    cell.trim().replace(/^"([^"]*)"$/, "$1").trim()
  );
  if (readCells(lines[0]).join(",").toLowerCase() !== "x,y") {
    throw new Error("The CSV header must be x,y.");
  }

  const result = [];
  const numberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue; // Skip blank lines.
    const cells = readCells(lines[i]);
    if (cells.length !== 2 || cells.some((cell) =>
      !numberPattern.test(cell) || !Number.isFinite(Number(cell))
    )) {
      throw new Error(`Row ${i + 1} must contain exactly two valid numbers.`);
    }
    result.push({ x: Number(cells[0]), y: Number(cells[1]) });
  }
  if (result.length === 0) throw new Error("The CSV contains no data points.");
  return result;
}

importButton.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  importButton.disabled = true;
  try {
    const text = await file.text(); // Read the local file without uploading it.
    points = parseCSV(text); // Replace data only after every row is valid.
    render();
    showStatus(`Imported ${file.name}. Points: ${points.length}.`);
  } catch (error) {
    showStatus(error instanceof DOMException ? "Unable to read this file." : error.message, true);
  } finally {
    fileInput.value = ""; // Allow selecting the same file again.
    importButton.disabled = false;
  }
});

function hideTooltip() {
  tooltip.hidden = true;
}

function showTooltip(circle, point) {
  tooltip.textContent = `X: ${point.x}\nY: ${point.y}`;
  tooltip.hidden = false;
  const anchor = circle.getBoundingClientRect();
  const box = tooltip.getBoundingClientRect();
  // Prefer the right side of the point; flip left near the window edge.
  let left = anchor.right + 10;
  if (left + box.width > window.innerWidth - 8) left = anchor.left - box.width - 10;
  const top = anchor.top + (anchor.height - box.height) / 2;
  tooltip.style.left = `${Math.max(8, Math.min(left, window.innerWidth - box.width - 8))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(top, window.innerHeight - box.height - 8))}px`;
}

window.addEventListener("scroll", hideTooltip, true);
window.addEventListener("resize", hideTooltip);

// Create SVG elements in the SVG namespace.
function svgElement(tag, attributes, text = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.textContent = text;
  return element;
}

function dataRange(key) {
  let min = points[0][key];
  let max = min;
  for (const point of points) {
    min = Math.min(min, point[key]);
    max = Math.max(max, point[key]);
  }
  return [min, max];
}

// Use the typed label, or X/Y when blank; log axes keep their "(log)" note.
function axisLabel(key) {
  const text = axisLabelInputs[key].value.trim() || key.toUpperCase();
  return logScale[key] ? `${text} (log)` : text;
}

for (const key of ["x", "y"]) {
  axisLabelInputs[key].addEventListener("input", render);
}

for (const key of ["x", "y"]) {
  logButtons[key].addEventListener("click", () => {
    logScale[key] = !logScale[key];
    render();
  });
}

function updateScaleControls() {
  const descriptions = [];
  for (const key of ["x", "y"]) {
    const allowed = points.length > 0 && points.every((point) => point[key] > 0);
    const reset = logScale[key] && !allowed;
    if (!allowed) logScale[key] = false;
    const button = logButtons[key];
    button.disabled = !allowed;
    button.setAttribute("aria-pressed", String(logScale[key]));
    button.textContent = `${key.toUpperCase()}: Switch to ${logScale[key] ? "linear" : "log"} scale`;
    const reason = !allowed ? " (log scale requires all values on this axis to be positive)" : "";
    descriptions.push(`${key.toUpperCase()}: ${reset ? "reset to " : ""}${logScale[key] ? "logarithmic (base 10)" : "linear"}${reason}.`);
  }
  scaleHelp.textContent = points.length ? descriptions.join(" ") : "Import a CSV to change the axis scales.";
}

function drawChart(svg, connectPoints) {
  svg.replaceChildren();
  if (points.length === 0) {
    svg.append(svgElement("text", { x: 240, y: 150, "text-anchor": "middle" }, "Import a CSV to see the chart"));
    return;
  }

  // Use fixed SVG coordinates; CSS scales the chart to fit its container.
  // The left margin fits the widest tick label (such as -1.23e+300) beside the rotated Y label.
  const left = 96, right = 438, top = 20, bottom = 252;
  const [xMin, xMax] = dataRange("x");
  const [yMin, yMax] = dataRange("y");
  const xAxis = createAxis(xMin, xMax, logScale.x);
  const yAxis = createAxis(yMin, yMax, logScale.y);
  const scaleX = (x) => left + xAxis.position(x) * (right - left);
  const scaleY = (y) => bottom - yAxis.position(y) * (bottom - top);

  // Draw the grid separately so a constant axis needs just one centered label.
  for (let i = 0; i <= 4; i++) {
    const y = bottom - i / 4 * (bottom - top);
    svg.append(svgElement("line", { x1: left, y1: y, x2: right, y2: y, class: "grid" }));
  }
  for (const ratio of xAxis.tickRatios) {
    const x = left + ratio * (right - left);
    svg.append(svgElement("text", { x, y: bottom + 22, "text-anchor": "middle" }, formatTick(xAxis.tick(ratio))));
  }
  let widestYTick = 0;
  for (const ratio of yAxis.tickRatios) {
    const y = bottom - ratio * (bottom - top);
    const tick = svgElement("text", { x: left - 10, y: y + 4, "text-anchor": "end" }, formatTick(yAxis.tick(ratio)));
    svg.append(tick);
    widestYTick = Math.max(widestYTick, tick.getBBox().width);
  }
  // Run the Y label up the left side, just clear of the widest tick value.
  const yLabelX = Math.max(14, left - 10 - widestYTick - 6);
  const middleY = (top + bottom) / 2;
  svg.append(
    svgElement("path", { d: `M ${left} ${top} V ${bottom} H ${right}`, class: "axis" }),
    svgElement("text", { x: (left + right) / 2, y: 296, "text-anchor": "middle", class: "axis-label" }, axisLabel("x")),
    svgElement("text", {
      x: yLabelX, y: middleY, "text-anchor": "middle", class: "axis-label",
      transform: `rotate(-90 ${yLabelX} ${middleY})`
    }, axisLabel("y"))
  );

  // The line chart adds a polyline; both chart types share the remaining code.
  if (connectPoints) {
    const coordinates = points.map((point) => `${scaleX(point.x)},${scaleY(point.y)}`).join(" ");
    svg.append(svgElement("polyline", { points: coordinates, class: "line" }));
  }

  points.forEach((point) => {
    const label = `X: ${point.x}, Y: ${point.y}`;
    const circle = svgElement("circle", {
      cx: scaleX(point.x), cy: scaleY(point.y), r: 6, class: "point",
      tabindex: 0, role: "img", "aria-label": label
    });
    // Still focusable so keyboard users can read the values.
    circle.addEventListener("pointerenter", () => showTooltip(circle, point));
    circle.addEventListener("pointerleave", hideTooltip);
    circle.addEventListener("focus", () => showTooltip(circle, point));
    circle.addEventListener("blur", hideTooltip);
    svg.append(circle);
  });
}

function render() {
  hideTooltip();
  updateScaleControls();
  exportStatus.textContent = "";
  exportButtons.forEach((button) => { button.disabled = points.length === 0; });
  points.sort((a, b) => a.x - b.x);
  drawChart(document.querySelector("#line-chart"), true);
  drawChart(document.querySelector("#scatter-chart"), false);
}

// Make the SVG self-contained so downloaded images keep their colors and fonts.
function chartImage(svg, title) {
  const copy = svg.cloneNode(true);
  const originals = svg.querySelectorAll("*");
  const clones = copy.querySelectorAll("*");
  originals.forEach((element, index) => {
    const style = getComputedStyle(element);
    for (const property of ["fill", "stroke", "stroke-width", "font-family", "font-size", "font-weight"]) {
      clones[index].setAttribute(property, style.getPropertyValue(property));
    }
    for (const attribute of ["tabindex", "role", "aria-label", "class"]) {
      clones[index].removeAttribute(attribute);
    }
  });
  const image = svgElement("svg", {
    viewBox: "0 0 480 332", width: 960, height: 664, role: "img",
    "aria-labelledby": "image-title"
  });
  image.append(
    svgElement("title", { id: "image-title" }, title),
    svgElement("rect", { width: 480, height: 332, fill: "white" }),
    svgElement("text", {
      x: 240, y: 23, "text-anchor": "middle", fill: "#202b3c",
      "font-family": "system-ui, sans-serif", "font-size": 16, "font-weight": 600
    }, title)
  );
  const drawing = svgElement("g", { transform: "translate(0 32)" });
  drawing.append(...copy.childNodes);
  image.append(drawing);
  return new Blob([new XMLSerializer().serializeToString(image)], { type: "image/svg+xml;charset=utf-8" });
}

async function rasterImage(svgBlob, format) {
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Unable to render the image."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 664;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image export is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob && blob.type === `image/${format}`) resolve(blob);
        else reject(new Error("This image format is unavailable in your browser."));
      }, `image/${format}`, 0.95);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

exportButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    if (points.length === 0) return;
    const chart = button.dataset.chart;
    const format = document.querySelector(`#${chart}-format`).value;
    button.disabled = true;
    exportStatus.classList.remove("error");
    exportStatus.textContent = "Preparing image...";
    try {
      const title = document.querySelector(`#${chart}-heading`).textContent;
      const svgBlob = chartImage(document.querySelector(`#${chart}-chart`), title);
      const blob = format === "svg" ? svgBlob : await rasterImage(svgBlob, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${chart}-chart.${format === "jpeg" ? "jpg" : format}`;
      document.body.append(link);
      link.click();
      link.remove();
      // Give the browser time to start the download before releasing the URL.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      exportStatus.textContent = `Exported ${title.toLowerCase()} as ${format.toUpperCase()}.`;
    } catch (error) {
      exportStatus.classList.add("error");
      exportStatus.textContent = `Export failed: ${error.message}`;
    } finally {
      button.disabled = points.length === 0;
    }
  });
});

render();
showStatus("No data yet. Import a CSV to get started.");
