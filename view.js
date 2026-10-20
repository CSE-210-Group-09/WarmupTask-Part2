// Zoom and pan state, kept separate from the data and from drawing.
// A view stores, per axis, the visible part of the full data range as fractions:
// [0, 1] shows everything, [0.25, 0.5] shows the second quarter. Fractions are
// measured after the axis transform, so the same code serves linear and log axes.

// Smallest visible span: at most 1000x magnification.
const MIN_SPAN = 0.001;

function fullView() {
  return { x: [0, 1], y: [0, 1] };
}

function isFullRange([start, end]) {
  return start <= 0 && end >= 1;
}

function isFullView(view) {
  return isFullRange(view.x) && isFullRange(view.y);
}

// Shift a range of the given span so it stays inside [0, 1].
function placeRange(start, span) {
  const clampedSpan = Math.min(1, Math.max(MIN_SPAN, span));
  const clampedStart = Math.min(1 - clampedSpan, Math.max(0, start));
  return [clampedStart, clampedStart + clampedSpan];
}

// Zoom by `factor` (below 1 zooms in) while keeping the value under `anchor`
// fixed on screen. `anchor` is the pointer's position within the plot, 0 to 1.
function zoomRange([start, end], anchor, factor) {
  const span = end - start;
  const nextSpan = Math.min(1, Math.max(MIN_SPAN, span * factor));
  const fixed = start + anchor * span;
  return placeRange(fixed - anchor * nextSpan, nextSpan);
}

// Move the content by `delta`, a fraction of the plot size. Positive moves it
// right (or up), revealing lower values; the range stays inside [0, 1].
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

function zoomLevel(view) {
  return 1 / Math.min(view.x[1] - view.x[0], view.y[1] - view.y[0]);
}
