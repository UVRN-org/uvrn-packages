/**
 * Aalen-Johansen cumulative incidence with competing events (SPEC §4.5).
 *
 * Event type 1 = the target event ("approved"); type 2 = any competing event ("denied",
 * "withdrawn") that makes the target impossible; type 0 = censored (still "pending" when last
 * checked). Treating competing events as censored (1 − Kaplan-Meier) overstates the target
 * probability; `oneMinusKaplanMeier` exists only to demonstrate that difference.
 */

import { Z_975 } from '../common/thresholds';

export type EventType = 0 | 1 | 2;

export interface Observation {
  /** Time from origin (filing) to the event or to censoring, in days. */
  time: number;
  type: EventType;
}

/** One distinct event time with its risk set and counts (censor-only times form no row). */
export interface RiskRow {
  time: number;
  atRisk: number;
  target: number;
  competing: number;
}

/**
 * riskTable builds rows at each distinct time with ≥ 1 event. A subject censored at time t is
 * still at risk for events at t (standard convention).
 */
export function riskTable(observations: Observation[]): RiskRow[] {
  const times = [...new Set(observations.filter((o) => o.type !== 0).map((o) => o.time))].sort((a, b) => a - b);
  return times.map((time) => {
    let atRisk = 0;
    let target = 0;
    let competing = 0;
    for (const o of observations) {
      if (o.time >= time) atRisk += 1;
      if (o.time === time && o.type === 1) target += 1;
      if (o.time === time && o.type === 2) competing += 1;
    }
    return { time, atRisk, target, competing };
  });
}

export interface ConditionalIncidence {
  /** (CIF(horizon) − CIF(start)) / S(start). Equals the plain CIF when start = 0. */
  estimate: number;
  /** Delta-method (Greenwood-type) variance of `estimate`. */
  variance: number;
  /** Overall event-free survival at `start` (all event types). */
  survivalAtStart: number;
  /** Unconditional CIF of the target at `start`. */
  cifAtStart: number;
  /** Unconditional CIF of the target at `horizon`. */
  cifAtHorizon: number;
  /** Observations with time > start (cases still pending at `start`). */
  atRiskAfterStart: number;
  /** Overall event-free survival relative to `start`, evaluated at the last observed time. */
  survivalAtLastObservation: number;
  /** Largest observed time (event or censoring). */
  lastObservedTime: number;
}

/**
 * conditionalCumulativeIncidence computes P(target by `horizon` | no event of any type by `start`).
 *
 * Estimator: over rows with start < t_j ≤ horizon, with S_{j−1} the event-free survival just
 * before t_j relative to `start`:
 *   F = Σ S_{j−1} · d1_j / n_j,     S_j = S_{j−1} · (1 − d_j / n_j).
 * This equals (CIF(horizon) − CIF(start)) / S(start) exactly.
 *
 * Variance (delta method on per-time multinomial hazards; Choudhury 2002):
 *   Var = Σ S_{j−1}² d1_j (n_j − d1_j) / n_j³
 *       + Σ [F − F_j]² d_j / (n_j (n_j − d_j))
 *       − 2 Σ [F − F_j] S_{j−1} d1_j / n_j²
 * where F_j is the running estimate after row j. Terms with F − F_j = 0 are skipped (this is also
 * what makes rows with n_j = d_j well-defined).
 */
export function conditionalCumulativeIncidence(
  observations: Observation[],
  start: number,
  horizon: number
): ConditionalIncidence {
  const rows = riskTable(observations);

  let survival = 1;
  let cif = 0;
  let survivalAtStart = 1;
  let cifAtStart = 0;
  let cifAtHorizon = 0;
  for (const row of rows) {
    const d = row.target + row.competing;
    if (row.time <= horizon) cifAtHorizon += (survival * row.target) / row.atRisk;
    cif += (survival * row.target) / row.atRisk;
    survival *= 1 - d / row.atRisk;
    if (row.time <= start) {
      survivalAtStart = survival;
      cifAtStart = cif;
    }
  }

  const window = rows.filter((r) => r.time > start && r.time <= horizon);
  const sBefore: number[] = [];
  const fAfter: number[] = [];
  let s = 1;
  let f = 0;
  for (const row of window) {
    sBefore.push(s);
    f += (s * row.target) / row.atRisk;
    fAfter.push(f);
    s *= 1 - (row.target + row.competing) / row.atRisk;
  }
  const estimate = f;

  let variance = 0;
  window.forEach((row, j) => {
    const n = row.atRisk;
    const d1 = row.target;
    const d = row.target + row.competing;
    const tail = estimate - fAfter[j];
    variance += (sBefore[j] * sBefore[j] * d1 * (n - d1)) / (n * n * n);
    if (tail !== 0) {
      variance += (tail * tail * d) / (n * (n - d));
      variance -= (2 * tail * sBefore[j] * d1) / (n * n);
    }
  });

  let sRelAll = 1;
  for (const row of rows) {
    if (row.time > start) sRelAll *= 1 - (row.target + row.competing) / row.atRisk;
  }

  return {
    estimate,
    variance: Math.max(0, variance),
    survivalAtStart,
    cifAtStart,
    cifAtHorizon,
    atRiskAfterStart: observations.filter((o) => o.time > start).length,
    survivalAtLastObservation: sRelAll,
    lastObservedTime: observations.reduce((mx, o) => Math.max(mx, o.time), 0),
  };
}

/**
 * logLogInterval: CI on the log(−log F) scale (Choudhury 2002):
 *   w = z · se / (F · |ln F|);  low = F^{exp(w)},  high = F^{exp(−w)}.
 * Returns null when F ∉ (0, 1) or se = 0 (the transform is undefined there).
 */
export function logLogInterval(estimate: number, se: number, z = Z_975): { low: number; high: number } | null {
  if (!(estimate > 0 && estimate < 1) || !(se > 0)) return null;
  const w = (z * se) / (estimate * Math.abs(Math.log(estimate)));
  return { low: Math.pow(estimate, Math.exp(w)), high: Math.pow(estimate, Math.exp(-w)) };
}

/**
 * oneMinusKaplanMeier is the NAIVE estimate that treats competing events as censored.
 * Diagnostic only (SPEC §4.5.4): it overstates the target probability when competing events occur.
 */
export function oneMinusKaplanMeier(observations: Observation[], horizon: number): number {
  const rows = riskTable(observations);
  let survival = 1;
  for (const row of rows) {
    if (row.time > horizon) break;
    survival *= 1 - row.target / row.atRisk;
  }
  return 1 - survival;
}
