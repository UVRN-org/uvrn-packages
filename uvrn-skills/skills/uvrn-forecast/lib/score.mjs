// Port of @uvrn/score ScoreBreakdown + profiles, and @uvrn/drift decay curves.
// V-Score = Completeness×0.35 + Parity×0.35 + Freshness×0.30 (canonical weights live in @uvrn/core).
// Derived from UVRN (Apache-2.0) — Built on UVRN. See ../NOTICE.
export const WEIGHTS = Object.freeze({ completeness: 0.35, parity: 0.35, freshness: 0.30 });
export const SCORE_PROFILES = {
  financial: { name: 'financial', thresholds: { stable: 80, drifting: 55 }, note: 'Financial data decays fastest and depends on recency' },
  research: { name: 'research', thresholds: { stable: 75, drifting: 50 }, note: 'Research claims decay slowly and tolerate older evidence' },
  news: { name: 'news', thresholds: { stable: 70, drifting: 45 }, note: 'News claims decay quickly and require recent sourcing' },
  general: { name: 'general', thresholds: { stable: 75, drifting: 50 }, note: 'Standard freshness expectations for mixed claim types' },
};
const round1 = (v) => Number(v.toFixed(1));
const applyWeight = (raw, w) => round1((raw * Math.round(w * 100)) / 100);
export function statusFor(score, profile) {
  return score >= profile.thresholds.stable ? 'STABLE' : score >= profile.thresholds.drifting ? 'DRIFTING' : 'CRITICAL';
}
export function scoreBreakdown(components, profileName = 'general') {
  const profile = SCORE_PROFILES[profileName] ?? SCORE_PROFILES.general;
  const part = (raw, weight) => ({ raw, weight, weighted: applyWeight(raw, weight) });
  const completeness = part(components.completeness, WEIGHTS.completeness);
  const parity = part(components.parity, WEIGHTS.parity);
  const freshness = part(components.freshness, WEIGHTS.freshness);
  const final = round1(completeness.weighted + parity.weighted + freshness.weighted);
  const lowest = [['Completeness', completeness], ['Parity', parity], ['Freshness', freshness]].reduce((lo, cur) => (cur[1].raw < lo[1].raw ? cur : lo));
  return { completeness, parity, freshness, final, profile: profile.name, status: statusFor(final, profile), limitingFactor: lowest[0] };
}
// ── drift: decay applies to the Freshness component only ──
export const linearDecay = (score, ageHours, rate) => Math.max(0, score - rate * ageHours);
export const sigmoidDecay = (score, ageHours, rate) => Math.max(0, score * (1 - 1 / (1 + Math.exp(-0.15 * (ageHours - rate)))));
export const exponentialDecay = (score, ageHours, rate) => Math.max(0, score * Math.exp(-rate * ageHours));
export function applyDecay(curve, score, ageHours, rate) {
  if (curve === 'LINEAR') return linearDecay(score, ageHours, rate);
  if (curve === 'SIGMOID') return sigmoidDecay(score, ageHours, rate);
  if (curve === 'EXPONENTIAL') return exponentialDecay(score, ageHours, rate);
  throw new Error(`unknown decay curve ${curve}`);
}
