// Pointer hover helpers, kept separate from drawing. No DOM access.

// Index of the value closest to `target`, or -1 if there is none. Values that
// are null (such as points outside the view) or not finite are skipped; on a
// tie the first one wins, so the result doesn't depend on rounding order.
function nearestIndex(values, target) {
  let best = -1;
  let bestDistance = Infinity;
  values.forEach((value, i) => {
    if (value === null || !Number.isFinite(value)) return;
    const distance = Math.abs(value - target);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}
