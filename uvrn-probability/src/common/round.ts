/**
 * Output rounding (SPEC §5.1): every computed number is rounded to 6 decimals with exactly
 * `Math.round(x * 1e6) / 1e6` before canonicalization. Negative zero is normalized to 0.
 */
export function round6(x: number): number {
  if (!Number.isFinite(x)) {
    throw new RangeError(`round6: non-finite value ${x} cannot enter an output`);
  }
  const r = Math.round(x * 1e6) / 1e6;
  return r === 0 ? 0 : r;
}

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
