/**
 * Odds math (SPEC §4.1). Pure functions, no I/O, no clock, no randomness.
 * Power and Shin are solved by bisection with a fixed iteration count; a solve that does not
 * meet DEVIG_TOLERANCE returns a typed failure instead of a number.
 */

import { DEVIG_ITERATIONS, DEVIG_TOLERANCE } from '../common/thresholds';

export type OddsValue =
  | { format: 'american'; value: number }
  | { format: 'decimal'; value: number }
  | { format: 'fractional'; numerator: number; denominator: number };

export type DevigMethod = 'multiplicative' | 'power' | 'shin';

/** The default de-vig method (Clarke, Kovalchik & Ingram 2017: power best or tied). */
export const DEFAULT_DEVIG_METHOD: DevigMethod = 'power';

export type SolveResult =
  | { ok: true; probabilities: number[]; parameter: number; residual: number }
  | { ok: false; reason: string };

/**
 * impliedProbability converts one quoted price to its vig-inclusive implied probability.
 * American +A → 100/(A+100); −A → A/(A+100) (|A| ≥ 100). Decimal d > 1 → 1/d.
 * Fractional n/d → d/(n+d). Returns null for an invalid quote.
 */
export function impliedProbability(odds: OddsValue): number | null {
  const q = rawImplied(odds);
  return q !== null && q > 0 && q < 1 ? q : null;
}

function rawImplied(odds: OddsValue): number | null {
  if (!odds || typeof odds !== 'object') return null;
  switch (odds.format) {
    case 'american': {
      const a = odds.value;
      if (typeof a !== 'number' || !Number.isFinite(a) || Math.abs(a) < 100) return null;
      return a > 0 ? 100 / (a + 100) : -a / (-a + 100);
    }
    case 'decimal': {
      const d = odds.value;
      if (typeof d !== 'number' || !Number.isFinite(d) || d <= 1) return null;
      return 1 / d;
    }
    case 'fractional': {
      const { numerator: n, denominator: d } = odds;
      if (
        typeof n !== 'number' ||
        typeof d !== 'number' ||
        !Number.isFinite(n) ||
        !Number.isFinite(d) ||
        n <= 0 ||
        d <= 0
      ) {
        return null;
      }
      return d / (n + d);
    }
    default:
      return null;
  }
}

function allOpenUnit(values: number[]): boolean {
  return values.length > 0 && values.every((q) => q > 0 && q < 1);
}

function sum(values: number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

/** Overround = Σ implied − 1 (the bookmaker margin). */
export function overround(implied: number[]): number {
  return sum(implied) - 1;
}

/** devigMultiplicative: p_i = q_i / Σq (proportional normalization). */
export function devigMultiplicative(implied: number[]): number[] {
  const total = sum(implied);
  return implied.map((q) => q / total);
}

/**
 * devigPower: find k ≥ 1 with Σ q_i^k = 1; p_i = q_i^k.
 * Bracket [1, hi] where hi doubles from 2 (at most 64 doublings), then DEVIG_ITERATIONS bisections.
 */
export function devigPower(implied: number[]): SolveResult {
  if (!allOpenUnit(implied)) return { ok: false, reason: 'every implied probability must be in (0, 1)' };
  const f = (k: number) => sum(implied.map((q) => Math.pow(q, k))) - 1;
  if (f(1) < 0) return { ok: false, reason: 'power de-vig requires Σ implied ≥ 1' };
  let lo = 1;
  let hi = 2;
  let doublings = 0;
  while (f(hi) > 0) {
    lo = hi;
    hi *= 2;
    doublings += 1;
    if (doublings > 64) return { ok: false, reason: 'power de-vig could not bracket a root' };
  }
  for (let i = 0; i < DEVIG_ITERATIONS; i += 1) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  const k = (lo + hi) / 2;
  const residual = Math.abs(f(k));
  if (!(residual <= DEVIG_TOLERANCE)) {
    return { ok: false, reason: `power de-vig did not converge (residual ${residual})` };
  }
  return { ok: true, probabilities: implied.map((q) => Math.pow(q, k)), parameter: k, residual };
}

/**
 * Shin (1993) de-vig as parameterized by Jullien & Salanié (1994):
 * p_i(z) = (√(z² + 4(1−z)·q_i²/B) − z) / (2(1−z)), B = Σq, find z ∈ [0, 0.99] with Σ p_i(z) = 1.
 * For two outcomes this equals additive de-vig p_i = q_i − (B−1)/2.
 */
export function devigShin(implied: number[]): SolveResult {
  if (!allOpenUnit(implied)) return { ok: false, reason: 'every implied probability must be in (0, 1)' };
  const booksum = sum(implied);
  const pAt = (z: number) =>
    implied.map((q) => (Math.sqrt(z * z + (4 * (1 - z) * q * q) / booksum) - z) / (2 * (1 - z)));
  const g = (z: number) => sum(pAt(z)) - 1;
  if (booksum < 1) return { ok: false, reason: 'Shin de-vig requires Σ implied ≥ 1' };
  if (booksum === 1) {
    return { ok: true, probabilities: implied.slice(), parameter: 0, residual: 0 };
  }
  let lo = 0;
  let hi = 0.99;
  if (!(g(hi) < 0)) return { ok: false, reason: 'Shin de-vig could not bracket a root' };
  for (let i = 0; i < DEVIG_ITERATIONS; i += 1) {
    const mid = (lo + hi) / 2;
    if (g(mid) > 0) lo = mid;
    else hi = mid;
  }
  const z = (lo + hi) / 2;
  const residual = Math.abs(g(z));
  if (!(residual <= DEVIG_TOLERANCE)) {
    return { ok: false, reason: `Shin de-vig did not converge (residual ${residual})` };
  }
  return { ok: true, probabilities: pAt(z), parameter: z, residual };
}

/** exchangeMid: midpoint of a bid/ask quoted in probability units [0, 1]. */
export function exchangeMid(bid: number, ask: number): number {
  return (bid + ask) / 2;
}

/** normalizeToOne: proportional normalization so the values sum to 1. */
export function normalizeToOne(values: number[]): number[] {
  const total = sum(values);
  return values.map((v) => v / total);
}
