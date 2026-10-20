// Port of @uvrn/probability deterministic incomplete-beta + Jeffreys interval (SPEC §4.4).
// Derived from UVRN (Apache-2.0) — Built on UVRN. See ../NOTICE.
export const CONFIDENCE_LEVEL = 0.95;
const BETA_CF_ITERATIONS = 300;
const BETA_INV_ITERATIONS = 200;
const LANCZOS_G = 7;
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];
const FPMIN = 1e-300;
const CF_CONVERGED = 1e-14;

export function lnGamma(x) {
  if (!(x >= 0.5)) throw new RangeError(`lnGamma: x must be ≥ 0.5, got ${x}`);
  const y = x - 1;
  let a = LANCZOS[0];
  const t = y + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS.length; i += 1) a += LANCZOS[i] / (y + i);
  return 0.5 * Math.log(2 * Math.PI) + (y + 0.5) * Math.log(t) - t + Math.log(a);
}

function betaCF(a, b, x) {
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d, lastDelta = 0;
  for (let m = 1; m <= BETA_CF_ITERATIONS; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; lastDelta = d * c; h *= lastDelta;
  }
  return { value: h, converged: Math.abs(lastDelta - 1) < CF_CONVERGED };
}

export function regularizedIncompleteBeta(x, a, b) {
  if (!(x >= 0 && x <= 1)) throw new RangeError(`x must be in [0,1], got ${x}`);
  if (x === 0) return { value: 0, converged: true };
  if (x === 1) return { value: 1, converged: true };
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) {
    const cf = betaCF(a, b, x);
    return { value: (front * cf.value) / a, converged: cf.converged };
  }
  const cf = betaCF(b, a, 1 - x);
  return { value: 1 - (front * cf.value) / b, converged: cf.converged };
}

export function inverseRegularizedIncompleteBeta(q, a, b) {
  if (!(q >= 0 && q <= 1)) throw new RangeError(`q must be in [0,1], got ${q}`);
  let lo = 0, hi = 1, converged = true;
  for (let i = 0; i < BETA_INV_ITERATIONS; i += 1) {
    const mid = (lo + hi) / 2;
    const cdf = regularizedIncompleteBeta(mid, a, b);
    if (!cdf.converged) converged = false;
    if (cdf.value < q) lo = mid; else hi = mid;
  }
  return { value: (lo + hi) / 2, converged };
}

/** Jeffreys equal-tailed interval; point estimate is the posterior mean (x+½)/(n+1). */
export function jeffreysInterval(x, n, confidence = CONFIDENCE_LEVEL) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`n must be a positive integer, got ${n}`);
  if (!Number.isInteger(x) || x < 0 || x > n) throw new RangeError(`x must be an integer in [0, n], got ${x}`);
  const alpha = 1 - confidence;
  const a = x + 0.5, b = n - x + 0.5;
  let converged = true, low = 0, high = 1;
  if (x > 0) { const r = inverseRegularizedIncompleteBeta(alpha / 2, a, b); low = r.value; converged = converged && r.converged; }
  if (x < n) { const r = inverseRegularizedIncompleteBeta(1 - alpha / 2, a, b); high = r.value; converged = converged && r.converged; }
  return { p: a / (n + 1), low, high, converged };
}
