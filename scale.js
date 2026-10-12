// Keep labels as text: converting a rounded 1.80e+308 back to a number overflows.
function formatTick(value) {
  const [mantissa, exponent] = value.toPrecision(3).split("e");
  const compact = mantissa.includes(".") ? mantissa.replace(/0+$/, "").replace(/\.$/, "") : mantissa;
  return exponent === undefined ? compact : `${compact}e${exponent}`;
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

// Return normalized positions and tick values without changing the source data.
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
      const ratio = useLog
        ? fraction(Math.log10(value), logMin, logMax)
        : fraction(value, min, max);
      return Math.max(0, Math.min(1, ratio));
    },
    tick(ratio) {
      if (!useLog || ratio === 0 || ratio === 1) return interpolate(min, max, ratio);
      // Preserve finite endpoints even if exponentiation rounds beyond their range.
      return Math.max(min, Math.min(max, 10 ** interpolate(logMin, logMax, ratio)));
    },
    tickRatios: [0, 0.25, 0.5, 0.75, 1]
  };
}
