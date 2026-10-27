// The single data source: a table of numeric columns from the imported CSV or
// XML file (see data.js). The user can't add or delete points on the page.
let table = null;
// Which columns are plotted: one X column and one or more Y columns.
let selection = null;
// Derived from the table and selection: one { name, color, points } per Y column.
let series = [];
// Colors the user picked, by column name, so they survive re-imports, and the
// resulting color of every column that can be a line.
const chosenColors = {};
let lineColors = {};
const hasData = () => series.length > 0;
const allPoints = () => series.flatMap((line) => line.points);
const fileInput = document.querySelector("#data-file");
const importButton = document.querySelector("#import-button");
const status = document.querySelector("#status");
const tooltip = document.querySelector("#point-tooltip");
const logButtons = { x: document.querySelector("#log-x"), y: document.querySelector("#log-y") };
const logScale = { x: false, y: false };
const axisLabelInputs = { x: document.querySelector("#x-label"), y: document.querySelector("#y-label") };
const scaleHelp = document.querySelector("#scale-help");
const exportStatus = document.querySelector("#export-status");
const exportButtons = document.querySelectorAll(".export-button");
const columnControls = document.querySelector("#column-controls");
const xColumnSelect = document.querySelector("#x-column");
const yColumnList = document.querySelector("#y-columns");
const zoomButtons = {
  in: document.querySelector("#zoom-in"),
  out: document.querySelector("#zoom-out"),
  reset: document.querySelector("#zoom-reset")
};
const zoomStatus = document.querySelector("#zoom-status");
// Both charts share one view, so they always show the same part of the data.
let view = fullView();
// The crosshair's position as fractions of the plot area (0 at the left or
// bottom edge, 1 at the right or top), or null while it is hidden. The charts
// share their axes and view, so one position marks the same values on both.
// `fromPointer` tells a crosshair following the pointer from one on a focused point.
let crosshair = null;
// The axes of the charts as last drawn, for reading values under the crosshair.
let axes = null;
const charts = () => document.querySelectorAll(".charts svg");

const showLinePoints = document.querySelector("#show-line-points");

showLinePoints.addEventListener("change", () => {
  hideTooltip();
  drawChart(document.querySelector("#line-chart"), true);
  exportStatus.textContent = "";
});

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

// Browsers report XML syntax errors by inserting a <parsererror> element in a
// browser-specific namespace. Learn that namespace from a known-bad document,
// so a valid file that happens to contain its own <parsererror> is not rejected.
const parserErrorNamespace = new DOMParser()
  .parseFromString("<", "application/xml")
  .getElementsByTagName("parsererror")[0]?.namespaceURI ?? null;

// Accept any root element containing <point> elements. Each field of a point is
// a column, given as an attribute, <point day="1" temp="3"/>, or as a child
// element, <point><day>1</day><temp>3</temp></point>. data.js validates them.
function parseXML(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagNameNS(parserErrorNamespace, "parsererror").length > 0) {
    throw new Error("The XML is not well-formed.");
  }

  // Use local names so namespaced files such as <d:point d:x="1"> also work.
  const records = [...doc.getElementsByTagNameNS("*", "point")].map((element) => [
    ...[...element.attributes]
      .filter((attribute) => attribute.namespaceURI !== "http://www.w3.org/2000/xmlns/")
      .map((attribute) => [attribute.localName, attribute.value]),
    ...[...element.children].map((child) => [child.localName, child.textContent])
  ]);
  return tableFromRecords(records);
}

// Choose a parser by file extension, falling back to content for unnamed types.
function parseFile(name, text) {
  const extension = name.toLowerCase().split(".").pop();
  if (extension === "xml") return parseXML(text);
  if (extension === "csv") return parseCSVTable(text);
  return text.trimStart().startsWith("<") ? parseXML(text) : parseCSVTable(text);
}

// Rebuild the plotted series after the data, the selection or a color changes.
function updateSeries() {
  lineColors = assignColors(table.columns.filter((column) => column !== selection.x), chosenColors);
  series = seriesFor(table, selection).map((line) => ({ ...line, color: lineColors[line.name] }));
}

// The column picker: an X column and a checkbox and color per possible line.
function buildColumnControls() {
  columnControls.hidden = !table;
  if (!table) return;
  xColumnSelect.replaceChildren(...table.columns.map((name) => new Option(name, name, false, name === selection.x)));
  yColumnList.replaceChildren(...table.columns.filter((name) => name !== selection.x).map((name) => {
    const row = document.createElement("div");
    row.className = "series-option";
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = name;
    box.checked = selection.ys.includes(name);
    box.addEventListener("change", () => {
      const checked = [...yColumnList.querySelectorAll("input[type=checkbox]:checked")].map((input) => input.value);
      selection = { x: selection.x, ys: checked };
      view = fullView(); // A different set of lines has a different Y range.
      updateSeries();
      lockLastLine();
      render();
    });
    label.append(box, ` ${name}`);
    const color = document.createElement("input");
    color.type = "color";
    color.value = lineColors[name];
    color.setAttribute("aria-label", `Color for ${name}`);
    color.addEventListener("input", () => {
      chosenColors[name] = color.value;
      updateSeries();
      render();
    });
    row.append(label, color);
    return row;
  }));
  lockLastLine();
}

// At least one line stays selected: its checkbox can't be unchecked.
function lockLastLine() {
  for (const box of yColumnList.querySelectorAll("input[type=checkbox]")) {
    box.disabled = box.checked && selection.ys.length === 1;
  }
}

xColumnSelect.addEventListener("change", () => {
  selection = reconcileSelection(table.columns, { x: xColumnSelect.value, ys: selection.ys });
  view = fullView();
  updateSeries();
  buildColumnControls();
  render();
});

importButton.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  importButton.disabled = true;
  try {
    const text = await file.text(); // Read the local file without uploading it.
    table = parseFile(file.name, text); // Replace data only after every point is valid.
    // Keep the chosen columns when re-importing a file with the same columns.
    selection = reconcileSelection(table.columns, selection);
    view = fullView();
    updateSeries();
    buildColumnControls();
    render();
    const columns = table.columns.length > 2 ? ` Columns: ${table.columns.join(", ")}.` : "";
    showStatus(`Imported ${file.name}. Points: ${table.rows.length}.${columns}`);
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

function showTooltip(circle, text) {
  tooltip.textContent = text;
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

// Scrolling moves the charts under a still pointer, so hide what follows it.
// A crosshair on a focused point scrolls with its chart, so it stays: tabbing
// to a point off-screen scrolls the page.
window.addEventListener("scroll", () => {
  hideTooltip();
  if (crosshair?.fromPointer) setCrosshair(null);
}, true);
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

// Smallest and largest value on an axis, across every plotted line.
function dataRange(key) {
  const points = allPoints();
  let min = points[0][key];
  let max = min;
  for (const point of points) {
    min = Math.min(min, point[key]);
    max = Math.max(max, point[key]);
  }
  return [min, max];
}

// Without a typed label, an axis is named after its column; a Y axis with
// several lines falls back to "Y" (the legend names the lines).
function defaultAxisLabel(key) {
  if (!selection) return key.toUpperCase();
  if (key === "x") return selection.x;
  return selection.ys.length === 1 ? selection.ys[0] : "Y";
}

// Use the typed label, or the default when blank; log axes keep their "(log)" note.
function axisLabel(key) {
  const text = axisLabelInputs[key].value.trim() || defaultAxisLabel(key);
  return logScale[key] ? `${text} (log)` : text;
}

for (const key of ["x", "y"]) {
  axisLabelInputs[key].addEventListener("input", render);
}

for (const key of ["x", "y"]) {
  logButtons[key].addEventListener("click", () => {
    logScale[key] = !logScale[key];
    view = fullView(); // View fractions mean different values on the other scale.
    render();
  });
}

function updateScaleControls() {
  const descriptions = [];
  for (const key of ["x", "y"]) {
    const allowed = hasData() && allPoints().every((point) => point[key] > 0);
    const reset = logScale[key] && !allowed;
    if (!allowed) logScale[key] = false;
    const button = logButtons[key];
    button.disabled = !allowed;
    button.setAttribute("aria-pressed", String(logScale[key]));
    button.textContent = `${key.toUpperCase()}: Switch to ${logScale[key] ? "linear" : "log"} scale`;
    const reason = !allowed ? " (log scale requires all values on this axis to be positive)" : "";
    descriptions.push(`${key.toUpperCase()}: ${reset ? "reset to " : ""}${logScale[key] ? "logarithmic (base 10)" : "linear"}${reason}.`);
  }
  scaleHelp.textContent = hasData() ? descriptions.join(" ") : "Import a CSV or XML file to change the axis scales.";
}

// Plot area in the fixed SVG coordinates; CSS scales the chart to fit its container.
// The left margin fits the widest tick label (such as -1.23e+300) beside the rotated Y label.
const PLOT = { left: 96, right: 438, top: 20, bottom: 252 };

function drawChart(svg, connectPoints) {
  svg.replaceChildren();
  if (!hasData()) {
    svg.append(svgElement("text", { x: 240, y: 150, "text-anchor": "middle" }, "Import a CSV or XML file to see the chart"));
    return;
  }

  const { left, right, top, bottom } = PLOT;
  const xAxis = createAxis(...dataRange("x"), logScale.x);
  const yAxis = createAxis(...dataRange("y"), logScale.y);
  axes = { x: xAxis, y: yAxis };
  // Map through the full axis first, then through the zoomed view.
  const scaleX = (x) => left + viewPosition(xAxis.position(x), view.x) * (right - left);
  const scaleY = (y) => bottom - viewPosition(yAxis.position(y), view.y) * (bottom - top);

  // Draw the grid separately so a constant axis needs just one centered label.
  for (let i = 0; i <= 4; i++) {
    const y = bottom - i / 4 * (bottom - top);
    svg.append(svgElement("line", { x1: left, y1: y, x2: right, y2: y, class: "grid" }));
  }
  // Ticks label the visible range; formatTicks adds digits as the view narrows.
  const xLabels = formatTicks(xAxis.tickRatios.map((ratio) => xAxis.tick(viewRatio(ratio, view.x))));
  xAxis.tickRatios.forEach((ratio, i) => {
    const x = left + ratio * (right - left);
    svg.append(svgElement("text", { x, y: bottom + 22, "text-anchor": "middle" }, xLabels[i]));
  });
  const yLabels = formatTicks(yAxis.tickRatios.map((ratio) => yAxis.tick(viewRatio(ratio, view.y))));
  let widestYTick = 0;
  yAxis.tickRatios.forEach((ratio, i) => {
    const y = bottom - ratio * (bottom - top);
    const tick = svgElement("text", { x: left - 10, y: y + 4, "text-anchor": "end" }, yLabels[i]);
    svg.append(tick);
    widestYTick = Math.max(widestYTick, tick.getBBox().width);
  });
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
  // When zoomed, the line runs past the plot area, so it is clipped to it
  // (1px wider than the plot, so the stroke at the outermost points stays whole).
  if (connectPoints) {
    const clipId = `${svg.id}-clip`;
    const clip = svgElement("clipPath", { id: clipId });
    clip.append(svgElement("rect", { x: left - 1, y: top - 1, width: right - left + 2, height: bottom - top + 2 }));
    const defs = svgElement("defs", {});
    defs.append(clip);
    svg.append(defs);
    for (const line of series) {
      const coordinates = line.points.map((point) => `${scaleX(point.x)},${scaleY(point.y)}`).join(" ");
      svg.append(svgElement("polyline", {
        points: coordinates, class: "line", stroke: line.color, "clip-path": `url(#${clipId})`
      }));
    }
  }

  // Below the markers, so they stay on top and keep their tooltips.
  drawCrosshair(svg);

  // Hiding markers leaves the line and the scatter plot unchanged.
  // Only points inside the view get a marker, so zooming in on 100+ points
  // leaves fewer, separated markers (and fewer stops for keyboard focus).
  const inside = (pixel, low, high) => pixel >= low - 0.5 && pixel <= high + 0.5;
  if (!connectPoints || showLinePoints.checked) {
    for (const line of series) drawMarkers(svg, line, scaleX, scaleY, inside);
  }
  drawLegend(svg);
}

function drawMarkers(svg, line, scaleX, scaleY, inside) {
  const { left, right, top, bottom } = PLOT;
  line.points.forEach((point) => {
    if (!inside(scaleX(point.x), left, right) || !inside(scaleY(point.y), top, bottom)) return;
    // Name the columns, so values from different lines can be told apart.
    const label = `${selection.x}: ${point.x}, ${line.name}: ${point.y}`;
    const circle = svgElement("circle", {
      cx: scaleX(point.x), cy: scaleY(point.y), r: 6, class: "point", fill: line.color,
      tabindex: 0, role: "img", "aria-label": label
    });
    // Still focusable so keyboard users can read the values.
    const text = `${selection.x}: ${point.x}\n${line.name}: ${point.y}`;
    circle.addEventListener("pointerenter", () => showTooltip(circle, text));
    circle.addEventListener("pointerleave", hideTooltip);
    // Focus also puts the crosshair through the point, on both charts.
    circle.addEventListener("focus", () => {
      showTooltip(circle, text);
      setCrosshair({
        x: viewPosition(axes.x.position(point.x), view.x),
        y: viewPosition(axes.y.position(point.y), view.y)
      });
    });
    circle.addEventListener("blur", () => {
      hideTooltip();
      setCrosshair(null);
    });
    svg.append(circle);
  });
}

// Show the crosshair at `position` (plot fractions) on both charts, or hide it with null.
function setCrosshair(position) {
  crosshair = position;
  for (const svg of charts()) placeCrosshair(svg);
}

// An empty, hidden crosshair: a vertical and a horizontal line through the plot,
// and a readout on each axis with the value there. placeCrosshair moves and
// shows it, so following the pointer never redraws the chart. It ignores the
// pointer (style.css), and screen readers skip it: focused markers have labels.
function drawCrosshair(svg) {
  const layer = svgElement("g", { class: "crosshair", "aria-hidden": "true", display: "none" });
  layer.append(
    svgElement("line", { class: "crosshair-line crosshair-vertical" }),
    svgElement("line", { class: "crosshair-line crosshair-horizontal" })
  );
  for (const key of ["x", "y"]) {
    const readout = svgElement("g", { class: `crosshair-readout crosshair-${key}` });
    readout.append(svgElement("rect", { rx: 3 }), svgElement("text", {}));
    layer.append(readout);
  }
  svg.append(layer);
  placeCrosshair(svg);
}

function placeCrosshair(svg) {
  const layer = svg.querySelector(".crosshair");
  if (!layer) return;
  if (!crosshair || !hasData()) {
    layer.setAttribute("display", "none");
    return;
  }
  layer.removeAttribute("display"); // Shown before measuring the readouts.
  const { left, right, top, bottom } = PLOT;
  const x = left + crosshair.x * (right - left);
  const y = bottom - crosshair.y * (bottom - top);
  setAttributes(layer.querySelector(".crosshair-vertical"), { x1: x, y1: top, x2: x, y2: bottom });
  setAttributes(layer.querySelector(".crosshair-horizontal"), { x1: left, y1: y, x2: right, y2: y });
  // The X readout sits over the tick labels, centered under the line but kept
  // inside the chart; the Y readout ends at the axis, like the Y tick labels.
  placeReadout(layer.querySelector(".crosshair-x"), readoutText("x", crosshair.x),
    (width) => Math.max(0, Math.min(480 - width, x - width / 2)), bottom + 17);
  placeReadout(layer.querySelector(".crosshair-y"), readoutText("y", crosshair.y),
    (width) => Math.max(0, left - 4 - width), y);
}

// Size a readout's box to its text; `boxLeft` turns the width into a position.
function placeReadout(readout, text, boxLeft, middle) {
  const [box, label] = readout.children;
  label.textContent = text;
  const width = label.getBBox().width + 10;
  const height = 18;
  const x = boxLeft(width);
  setAttributes(box, { x, y: middle - height / 2, width, height });
  setAttributes(label, { x: x + width / 2, y: middle + 4 });
}

// The value under the crosshair on one axis. Its digits depend on how much the
// value changes across a pixel there (formatReadout), which shrinks with zoom.
function readoutText(key, position) {
  const range = view[key];
  const valueAt = (fraction) => axes[key].tick(Math.min(1, Math.max(0, viewRatio(fraction, range))));
  const pixel = 1 / (key === "x" ? PLOT.right - PLOT.left : PLOT.bottom - PLOT.top);
  const resolution = Math.abs(valueAt(position + pixel) - valueAt(position - pixel)) / 2;
  return formatReadout(valueAt(position), resolution);
}

function setAttributes(element, attributes) {
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
}

// With two or more lines, a legend in the plot's top-right corner names each
// color. It is part of the SVG, so exported images include it.
function drawLegend(svg) {
  if (series.length < 2) return;
  const legend = svgElement("g", { class: "legend" });
  const box = svgElement("rect", { class: "legend-box", x: -8, y: 0, rx: 4, height: 8 + series.length * 16 });
  legend.append(box);
  series.forEach((line, i) => {
    const y = 16 + i * 16;
    legend.append(
      svgElement("line", { x1: 0, y1: y - 4, x2: 16, y2: y - 4, stroke: line.color, "stroke-width": 3 }),
      svgElement("text", { x: 22, y }, line.name)
    );
  });
  svg.append(legend);
  // Size the box to the longest name once the text can be measured.
  const width = 22 + Math.max(...[...legend.querySelectorAll("text")].map((text) => text.getBBox().width));
  box.setAttribute("width", width + 16);
  legend.setAttribute("transform", `translate(${PLOT.right - width - 14} ${PLOT.top + 6})`);
}

// A constant axis has nothing to zoom into: its single value stays centered.
function zoomable(key) {
  const [min, max] = dataRange(key);
  return min !== max;
}

function zoomAt(anchorX, anchorY, factor) {
  if (zoomable("x")) view.x = zoomRange(view.x, anchorX, factor);
  if (zoomable("y")) view.y = zoomRange(view.y, anchorY, factor);
  scheduleRender();
}

function updateZoomControls() {
  const full = isFullView(view);
  const canZoom = hasData() && (zoomable("x") || zoomable("y"));
  zoomButtons.in.disabled = !canZoom || zoomLevel(view) >= 1 / MIN_SPAN - 1e-6;
  zoomButtons.out.disabled = full;
  zoomButtons.reset.disabled = full;
  for (const svg of document.querySelectorAll(".charts svg")) svg.classList.toggle("zoomed", !full);
  zoomStatus.textContent = !hasData() ? "" : full ? "Showing all points." : `Zoomed ${formatTick(zoomLevel(view), 2)}x.`;
}

// Redraw at most once per frame while the wheel or a drag fires many events.
let renderFrame = 0;
function scheduleRender() {
  if (!renderFrame) renderFrame = requestAnimationFrame(() => { renderFrame = 0; render(); });
}

// Pointer position in plot fractions: 0 at the left/bottom edge, 1 at the right/top.
function plotPosition(svg, event) {
  const box = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  const x = (event.clientX - box.left) * viewBox.width / box.width;
  const y = (event.clientY - box.top) * viewBox.height / box.height;
  return {
    x: (x - PLOT.left) / (PLOT.right - PLOT.left),
    y: (PLOT.bottom - y) / (PLOT.bottom - PLOT.top),
    inside: x >= PLOT.left && x <= PLOT.right && y >= PLOT.top && y <= PLOT.bottom
  };
}

for (const svg of charts()) {
  // Ctrl/Cmd + wheel zooms (trackpad pinch sends the same event); a plain
  // wheel still scrolls the page, so the charts never trap scrolling.
  svg.addEventListener("wheel", (event) => {
    if (!(event.ctrlKey || event.metaKey) || !hasData()) return;
    const position = plotPosition(svg, event);
    if (!position.inside) return;
    event.preventDefault();
    hideTooltip();
    const factor = Math.exp(Math.max(-1, Math.min(1, event.deltaY * 0.002)));
    zoomAt(position.x, position.y, factor);
  }, { passive: false });

  // Drag inside the plot to pan; it only does something when zoomed in.
  let drag = null;
  svg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !hasData() || isFullView(view)) return;
    const position = plotPosition(svg, event);
    if (!position.inside) return;
    drag = { start: position, view: { x: [...view.x], y: [...view.y] } };
    svg.setPointerCapture(event.pointerId);
    hideTooltip();
    setCrosshair(null); // It would point at moving values; it returns on the next move.
  });
  svg.addEventListener("pointermove", (event) => {
    const position = plotPosition(svg, event);
    if (!drag) {
      // Inside the plot, the crosshair follows the pointer on both charts.
      setCrosshair(hasData() && position.inside ? { x: position.x, y: position.y, fromPointer: true } : null);
      return;
    }
    // Pan from the starting view so rounding never accumulates over a long drag.
    view = {
      x: panRange(drag.view.x, position.x - drag.start.x),
      y: panRange(drag.view.y, position.y - drag.start.y)
    };
    scheduleRender();
  });
  const endDrag = () => { drag = null; };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", () => {
    endDrag();
    setCrosshair(null); // A touch that turned into a page scroll.
  });
  svg.addEventListener("lostpointercapture", endDrag);
  svg.addEventListener("pointerleave", () => {
    if (!drag) setCrosshair(null);
  });
}

// The buttons zoom around the center, for keyboard users and mice without a wheel.
zoomButtons.in.addEventListener("click", () => zoomAt(0.5, 0.5, 0.5));
zoomButtons.out.addEventListener("click", () => zoomAt(0.5, 0.5, 2));
zoomButtons.reset.addEventListener("click", () => {
  view = fullView();
  render();
});

function render() {
  hideTooltip();
  updateScaleControls();
  updateZoomControls();
  exportStatus.textContent = "";
  exportButtons.forEach((button) => { button.disabled = !hasData(); });
  for (const key of ["x", "y"]) axisLabelInputs[key].placeholder = defaultAxisLabel(key);
  drawChart(document.querySelector("#line-chart"), true);
  drawChart(document.querySelector("#scatter-chart"), false);
}

// Make the SVG self-contained so downloaded images keep their colors and fonts.
function chartImage(svg, title) {
  const copy = svg.cloneNode(true);
  const originals = svg.querySelectorAll("*");
  const clones = copy.querySelectorAll("*");
  // The crosshair follows the pointer; it isn't part of the chart.
  const crosshairs = copy.querySelectorAll(".crosshair");
  originals.forEach((element, index) => {
    const style = getComputedStyle(element);
    for (const property of ["fill", "stroke", "stroke-width", "font-family", "font-size", "font-weight"]) {
      clones[index].setAttribute(property, style.getPropertyValue(property));
    }
    for (const attribute of ["tabindex", "role", "aria-label", "class"]) {
      clones[index].removeAttribute(attribute);
    }
  });
  crosshairs.forEach((layer) => layer.remove()); // After styling, which pairs elements by index.
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
    if (!hasData()) return;
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
      button.disabled = !hasData();
    }
  });
});

render();
showStatus("No data yet. Import a CSV or XML file to get started.");
