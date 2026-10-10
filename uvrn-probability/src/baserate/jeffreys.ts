/**
 * Jeffreys interval for a binomial proportion (SPEC §4.4; Brown, Cai & DasGupta 2001).
 * Equal-tailed quantiles of Beta(x + 1/2, n − x + 1/2), with their boundary rule:
 * lower = 0 when x = 0 and upper = 1 when x = n. Point estimate = posterior mean (x + 1/2)/(n + 1),
 * which is never exactly 0 or 1.
 */

import { CONFIDENCE_LEVEL } from '../common/thresholds';
import { inverseRegularizedIncompleteBeta } from './beta';

export interface JeffreysResult {
  p: number;
  low: number;
  high: number;
  converged: boolean;
}

export function jeffreysInterval(x: number, n: number, confidence = CONFIDENCE_LEVEL): JeffreysResult {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`n must be a positive integer, got ${n}`);
  if (!Number.isInteger(x) || x < 0 || x > n) throw new RangeError(`x must be an integer in [0, n], got ${x}`);
  const alpha = 1 - confidence;
  const a = x + 0.5;
  const b = n - x + 0.5;
  let converged = true;
  let low = 0;
  let high = 1;
  if (x > 0) {
    const r = inverseRegularizedIncompleteBeta(alpha / 2, a, b);
    low = r.value;
    converged = converged && r.converged;
  }
  if (x < n) {
    const r = inverseRegularizedIncompleteBeta(1 - alpha / 2, a, b);
    high = r.value;
    converged = converged && r.converged;
  }
  return { p: a / (n + 1), low, high, converged };
}
