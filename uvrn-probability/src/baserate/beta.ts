/**
 * Deterministic regularized incomplete beta I_x(a, b) and its inverse (SPEC §4.4).
 * Fixed iteration counts; no early exit, so the same inputs always run the same arithmetic.
 */

import { BETA_CF_ITERATIONS, BETA_INV_ITERATIONS } from '../common/thresholds';

const LANCZOS_G = 7;
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];
const FPMIN = 1e-300;
const CF_CONVERGED = 1e-14;

/** lnGamma via the Lanczos approximation (g = 7, n = 9); valid for x ≥ 0.5. */
export function lnGamma(x: number): number {
  if (!(x >= 0.5)) throw new RangeError(`lnGamma: x must be ≥ 0.5, got ${x}`);
  const y = x - 1;
  let a = LANCZOS[0];
  const t = y + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS.length; i += 1) a += LANCZOS[i] / (y + i);
  return 0.5 * Math.log(2 * Math.PI) + (y + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction for I_x(a,b) (modified Lentz), BETA_CF_ITERATIONS terms. */
function betaContinuedFraction(a: number, b: number, x: number): { value: number; converged: boolean } {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  let lastDelta = 0;
  for (let m = 1; m <= BETA_CF_ITERATIONS; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    lastDelta = d * c;
    h *= lastDelta;
  }
  return { value: h, converged: Math.abs(lastDelta - 1) < CF_CONVERGED };
}

export interface BetaValue {
  value: number;
  converged: boolean;
}

/** regularizedIncompleteBeta returns I_x(a, b) for a, b ≥ 0.5 and x ∈ [0, 1]. */
export function regularizedIncompleteBeta(x: number, a: number, b: number): BetaValue {
  if (!(x >= 0 && x <= 1)) throw new RangeError(`x must be in [0,1], got ${x}`);
  if (x === 0) return { value: 0, converged: true };
  if (x === 1) return { value: 1, converged: true };
  const lnFront = lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const front = Math.exp(lnFront);
  if (x < (a + 1) / (a + b + 2)) {
    const cf = betaContinuedFraction(a, b, x);
    return { value: (front * cf.value) / a, converged: cf.converged };
  }
  const cf = betaContinuedFraction(b, a, 1 - x);
  return { value: 1 - (front * cf.value) / b, converged: cf.converged };
}

/**
 * inverseRegularizedIncompleteBeta returns x with I_x(a, b) = q by bisection on [0, 1]
 * (BETA_INV_ITERATIONS halvings). `converged` is false if any CDF evaluation failed to converge.
 */
export function inverseRegularizedIncompleteBeta(q: number, a: number, b: number): BetaValue {
  if (!(q >= 0 && q <= 1)) throw new RangeError(`q must be in [0,1], got ${q}`);
  let lo = 0;
  let hi = 1;
  let converged = true;
  for (let i = 0; i < BETA_INV_ITERATIONS; i += 1) {
    const mid = (lo + hi) / 2;
    const cdf = regularizedIncompleteBeta(mid, a, b);
    if (!cdf.converged) converged = false;
    if (cdf.value < q) lo = mid;
    else hi = mid;
  }
  return { value: (lo + hi) / 2, converged };
}
