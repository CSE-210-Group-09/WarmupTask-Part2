// Keep labels as text: converting a rounded 1.80e+308 back to a number overflows.
function formatTick(value, precision = 3) {
  const [mantissa, exponent] = value.toPrecision(precision).split("e");
  const compact = mantissa.includes(".") ? mantissa.replace(/0+$/, "").replace(/\.$/, "") : mantissa;
  return exponent === undefined ? compact : `${compact}e${exponent}`;
}

// Labels for a row of ticks. Three significant digits suffice at full view, but
// a zoomed axis can show 1000.1 and 1000.2, which both round to "1e+3". Add
// digits until different values get different labels.
function formatTicks(values) {
  for (let precision = 3; precision < 17; precision++) {
    const labels = values.map((value) => formatTick(value, precision));
    const distinct = values.every((value, i) =>
      values.every((other, j) => value === other || labels[i] !== labels[j])
    );
    if (distinct) return labels;
  }
  return values.map((value) => formatTick(value, 17));
}

function interpolate(min, max, ratio) {
  if (ratio === 0) return min;
  if (ratio === 1) return max;
  // Opposite extremes can overflow in max - min; weighted endpoints stay finite.
  return Math.sign(min) === Math.sign(max)
    ? min + (max - min) * ratio
    : min * (1 - ratio) + max * ratio;
}

function fraction(value, min, max) {
  const span = max - min;
  // Only halve when necessary: halving subnormal numbers can erase the range.
  return Number.isFinite(span)
    ? (value - min) / span
    : (value / 2 - min / 2) / (max / 2 - min / 2);
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// Return normalized positions and tick values without changing the source data.
// Positions run from 0 at min to 1 at max, and continue past them, since a
// zoomed-out or panned view (view.js) shows values beyond the data.
function createAxis(min, max, logarithmic = false) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw new Error("Axis bounds must be finite and ordered.");
  }
  if (logarithmic && min <= 0) throw new Error("Log scale requires positive values.");
  if (min === max) {
    return { position: () => 0.5, tick: () => min, tickRatios: [0.5] };
  }

  const logMin = logarithmic ? Math.log10(min) : 0;
  const logMax = logarithmic ? Math.log10(max) : 0;
  // Very close numbers may have identical floating-point logarithms.
  const useLog = logarithmic && logMin !== logMax;
  return {
    position(value) {
      return useLog ? fraction(Math.log10(value), logMin, logMax) : fraction(value, min, max);
    },
    tick(ratio) {
      const inside = ratio >= 0 && ratio <= 1;
      // Beyond the data, values can pass the largest numbers; stop at the last finite one.
      if (!useLog || ratio === 0 || ratio === 1) {
        return clamp(interpolate(min, max, ratio), -Number.MAX_VALUE, Number.MAX_VALUE);
      }
      // Preserve finite endpoints even if exponentiation rounds beyond their range.
      // Outside the data, log ticks add decades but never reach zero.
      const value = 10 ** interpolate(logMin, logMax, ratio);
      return inside ? clamp(value, min, max) : clamp(value, Number.MIN_VALUE, Number.MAX_VALUE);
    },
    tickRatios: [0, 0.25, 0.5, 0.75, 1]
  };
}
