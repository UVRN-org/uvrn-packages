/**
 * Named thresholds for SPEC/uvrn-probability-v1.md §7.
 *
 * PROVISIONAL: every value marked PROVISIONAL below is a placeholder chosen by the implementer.
 * The package owner has not decided them. They are exported so callers can see them, and every
 * run records the effective values in `inputs[]` (role `thresholds`) so a later change is visible.
 */

/** PROVISIONAL. Minimum reference-class cases that pass the declared-criteria gate. */
export const MIN_CASES = 8;

/** PROVISIONAL. Maximum age of a market quote relative to `asOf` (24 hours, in ms). */
export const MAX_QUOTE_STALENESS_MS = 24 * 60 * 60 * 1000;

/** PROVISIONAL. Maximum exchange bid/ask spread on the target contract, in probability units. */
export const MAX_EXCHANGE_SPREAD = 0.05;

/** PROVISIONAL. Minimum cited top-of-book depth (USD, bid + ask) on the target contract. */
export const MIN_EXCHANGE_DEPTH_USD = 1000;

/**
 * PROVISIONAL. Maximum sportsbook overround (sum of implied probabilities minus 1).
 * Set wide because futures books with many outcomes routinely carry 20–40%.
 */
export const MAX_SPORTSBOOK_OVERROUND = 0.5;

/** Pinned (not provisional). Two-sided confidence level for every interval. */
export const CONFIDENCE_LEVEL = 0.95;

/** Pinned. Standard-normal quantile for CONFIDENCE_LEVEL (z_{0.975}). */
export const Z_975 = 1.959963984540054;

/** Pinned. Bisection iterations for power and Shin de-vig (always run in full). */
export const DEVIG_ITERATIONS = 200;

/** Pinned. Residual tolerance a de-vig solve must meet after DEVIG_ITERATIONS. */
export const DEVIG_TOLERANCE = 1e-9;

/** Pinned. Continued-fraction terms for the regularized incomplete beta. */
export const BETA_CF_ITERATIONS = 300;

/** Pinned. Bisection iterations for the inverse regularized incomplete beta. */
export const BETA_INV_ITERATIONS = 200;

/** Effective thresholds for one run (defaults above, optionally overridden and recorded). */
export interface Thresholds {
  minCases: number;
  maxQuoteStalenessMs: number;
  maxExchangeSpread: number;
  minExchangeDepthUsd: number;
  maxSportsbookOverround: number;
}

export const DEFAULT_THRESHOLDS: Readonly<Thresholds> = Object.freeze({
  minCases: MIN_CASES,
  maxQuoteStalenessMs: MAX_QUOTE_STALENESS_MS,
  maxExchangeSpread: MAX_EXCHANGE_SPREAD,
  minExchangeDepthUsd: MIN_EXCHANGE_DEPTH_USD,
  maxSportsbookOverround: MAX_SPORTSBOOK_OVERROUND,
});

/** resolveThresholds merges finite, non-negative overrides onto the defaults. */
export function resolveThresholds(overrides?: Partial<Thresholds>): {
  thresholds: Thresholds;
  overridden: (keyof Thresholds)[];
} {
  const thresholds: Thresholds = { ...DEFAULT_THRESHOLDS };
  const overridden: (keyof Thresholds)[] = [];
  if (overrides) {
    for (const key of Object.keys(DEFAULT_THRESHOLDS) as (keyof Thresholds)[]) {
      const value = overrides[key];
      if (value === undefined) continue;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new TypeError(`threshold "${key}" must be a finite non-negative number`);
      }
      if (value !== thresholds[key]) overridden.push(key);
      thresholds[key] = value;
    }
  }
  return { thresholds, overridden: overridden.sort() };
}
