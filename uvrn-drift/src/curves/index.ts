// ─────────────────────────────────────────────
// @uvrn/drift · decay curves
// ─────────────────────────────────────────────
// All functions take:
//   score    — current freshness component (0–100)
//   ageHours — how old the receipt is in hours
//   rate     — curve-specific decay parameter
// and return the decayed freshness value (0–100).

/**
 * LINEAR decay.
 * Score drops by `rate` points per hour, floored at 0.
 *
 * Example: rate=0.5, age=10h → score − 5pts
 */
export function linearDecay(
  score: number,
  ageHours: number,
  rate: number
): number {
  return Math.max(0, score - rate * ageHours);
}

/**
 * SIGMOID decay.
 * Score holds near its original value until `rate` hours (the midpoint),
 * then drops steeply, flattening again at the bottom.
 *
 * Uses the logistic function:
 *   decay = score × (1 − 1 / (1 + e^(−k(t − midpoint))))
 * where k controls steepness (fixed at 0.15 for a sharp but realistic drop).
 *
 * Example: rate=48h midpoint — claim holds until ~2 days then collapses.
 */
export function sigmoidDecay(
  score: number,
  ageHours: number,
  rate: number
): number {
  const k = 0.15; // steepness — tunable in future versions
  const sigmoid = 1 / (1 + Math.exp(-k * (ageHours - rate)));
  return Math.max(0, score * (1 - sigmoid));
}

/**
 * EXPONENTIAL decay.
 * Score drops immediately and aggressively from t=0.
 *
 * Uses: decayed = score × e^(−λ × ageHours)
 * where λ (rate) controls how fast trust collapses.
 *
 * Example: rate=0.03, age=24h → score × e^(−0.72) ≈ score × 0.49
 *          A score of 90 becomes ~44 after one day. Rankings decay this fast.
 */
export function exponentialDecay(
  score: number,
  ageHours: number,
  rate: number
): number {
  return Math.max(0, score * Math.exp(-rate * ageHours));
}

/**
 * Route to the correct decay function by curve type.
 */
export function applyDecay(
  curve: 'LINEAR' | 'SIGMOID' | 'EXPONENTIAL',
  score: number,
  ageHours: number,
  rate: number
): number {
  switch (curve) {
    case 'LINEAR':      return linearDecay(score, ageHours, rate);
    case 'SIGMOID':     return sigmoidDecay(score, ageHours, rate);
    case 'EXPONENTIAL': return exponentialDecay(score, ageHours, rate);
  }
}
