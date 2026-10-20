// Port of @uvrn/probability odds math (SPEC/uvrn-probability-v1.md §4.1).
// Pure functions. Derived from UVRN (Apache-2.0) — Built on UVRN. See ../NOTICE.
export const DEVIG_ITERATIONS = 200;
export const DEVIG_TOLERANCE = 1e-9;

export function round6(x) {
  if (!Number.isFinite(x)) throw new RangeError(`round6: non-finite value ${x}`);
  const r = Math.round(x * 1e6) / 1e6;
  return r === 0 ? 0 : r;
}
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sum = (a) => a.reduce((s, v) => s + v, 0);

function rawImplied(o) {
  if (!o || typeof o !== 'object') return null;
  switch (o.format) {
    case 'american': {
      const a = o.value;
      if (typeof a !== 'number' || !Number.isFinite(a) || Math.abs(a) < 100) return null;
      return a > 0 ? 100 / (a + 100) : -a / (-a + 100);
    }
    case 'decimal': {
      const d = o.value;
      if (typeof d !== 'number' || !Number.isFinite(d) || d <= 1) return null;
      return 1 / d;
    }
    case 'fractional': {
      const { numerator: n, denominator: d } = o;
      if (![n, d].every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)) return null;
      return d / (n + d);
    }
    default:
      return null;
  }
}
/** Vig-inclusive implied probability of one quoted price, or null if the quote is invalid. */
export function impliedProbability(odds) {
  const q = rawImplied(odds);
  return q !== null && q > 0 && q < 1 ? q : null;
}
export const overround = (implied) => sum(implied) - 1;
export function devigMultiplicative(implied) {
  const t = sum(implied);
  return implied.map((q) => q / t);
}
const allOpenUnit = (v) => v.length > 0 && v.every((q) => q > 0 && q < 1);

export function devigPower(implied) {
  if (!allOpenUnit(implied)) return { ok: false, reason: 'every implied probability must be in (0, 1)' };
  const f = (k) => sum(implied.map((q) => Math.pow(q, k))) - 1;
  if (f(1) < 0) return { ok: false, reason: 'power de-vig requires Σ implied ≥ 1' };
  let lo = 1, hi = 2, doublings = 0;
  while (f(hi) > 0) {
    lo = hi; hi *= 2; doublings += 1;
    if (doublings > 64) return { ok: false, reason: 'power de-vig could not bracket a root' };
  }
  for (let i = 0; i < DEVIG_ITERATIONS; i += 1) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid; else hi = mid;
  }
  const k = (lo + hi) / 2;
  const residual = Math.abs(f(k));
  if (!(residual <= DEVIG_TOLERANCE)) return { ok: false, reason: `power de-vig did not converge (residual ${residual})` };
  return { ok: true, probabilities: implied.map((q) => Math.pow(q, k)), parameter: k, residual };
}

export function devigShin(implied) {
  if (!allOpenUnit(implied)) return { ok: false, reason: 'every implied probability must be in (0, 1)' };
  const B = sum(implied);
  const pAt = (z) => implied.map((q) => (Math.sqrt(z * z + (4 * (1 - z) * q * q) / B) - z) / (2 * (1 - z)));
  const g = (z) => sum(pAt(z)) - 1;
  if (B < 1) return { ok: false, reason: 'Shin de-vig requires Σ implied ≥ 1' };
  if (B === 1) return { ok: true, probabilities: implied.slice(), parameter: 0, residual: 0 };
  let lo = 0, hi = 0.99;
  if (!(g(hi) < 0)) return { ok: false, reason: 'Shin de-vig could not bracket a root' };
  for (let i = 0; i < DEVIG_ITERATIONS; i += 1) {
    const mid = (lo + hi) / 2;
    if (g(mid) > 0) lo = mid; else hi = mid;
  }
  const z = (lo + hi) / 2;
  const residual = Math.abs(g(z));
  if (!(residual <= DEVIG_TOLERANCE)) return { ok: false, reason: `Shin de-vig did not converge (residual ${residual})` };
  return { ok: true, probabilities: pAt(z), parameter: z, residual };
}
export const exchangeMid = (bid, ask) => (bid + ask) / 2;
export const normalizeToOne = (v) => { const t = sum(v); return v.map((x) => x / t); };
