// Zoom and pan state, kept separate from the data and from drawing.
// A view stores, per axis, the visible part of the full data range as fractions:
// [0, 1] shows the data, [0.25, 0.5] its second quarter, [-0.5, 1.5] the data
// with half its width of space on each side. Fractions are measured after the
// axis transform, so the same code serves linear and log axes.

// Smallest visible span: at most 1000x magnification.
const MIN_SPAN = 0.001;
// Largest visible span: zoomed out to 0.1x, the data fills the middle tenth.
// Views stay inside this limit, centered on the data: [-4.5, 5.5].
const MAX_SPAN = 10;
const LIMIT = [(1 - MAX_SPAN) / 2, (1 + MAX_SPAN) / 2];

function fullView() {
  return { x: [0, 1], y: [0, 1] };
}

// The data's own range, which Reset zoom returns to (allowing for rounding).
function isFullView(view) {
  return [view.x, view.y].every(([start, end]) => Math.abs(start) < 1e-9 && Math.abs(end - 1) < 1e-9);
}

// Shift a range of the given span so it stays inside the limit.
function placeRange(start, span) {
  const clampedSpan = Math.min(MAX_SPAN, Math.max(MIN_SPAN, span));
  const clampedStart = Math.min(LIMIT[1] - clampedSpan, Math.max(LIMIT[0], start));
  return [clampedStart, clampedStart + clampedSpan];
}

// Zoom by `factor` (below 1 zooms in) while keeping the value under `anchor`
// fixed on screen. `anchor` is the pointer's position within the plot, 0 to 1.
function zoomRange([start, end], anchor, factor) {
  const span = end - start;
  const nextSpan = Math.min(MAX_SPAN, Math.max(MIN_SPAN, span * factor));
  const fixed = start + anchor * span;
  return placeRange(fixed - anchor * nextSpan, nextSpan);
}

// Move the content by `delta`, a fraction of the plot size. Positive moves it
// right (or up), revealing lower values; the range stays inside the limit.
function panRange([start, end], delta) {
  const span = end - start;
  return placeRange(start - delta * span, span);
}

// Position of a full-range fraction inside the visible range (0 to 1 when visible).
function viewPosition(ratio, [start, end]) {
  return (ratio - start) / (end - start);
}

// Full-range fraction shown at `ratio` (0 to 1) of the visible range.
function viewRatio(ratio, [start, end]) {
  return start + ratio * (end - start);
}

// Magnification of the axis zoomed furthest from 1x, in or out: a constant
// axis never zooms, so it mustn't hide the other axis's level.
function zoomLevel(view) {
  const [x, y] = [view.x, view.y].map(([start, end]) => 1 / (end - start));
  return Math.abs(Math.log(x)) >= Math.abs(Math.log(y)) ? x : y;
}
