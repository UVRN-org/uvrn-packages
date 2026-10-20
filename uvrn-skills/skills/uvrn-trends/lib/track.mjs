// Port of @uvrn/track-record proper scoring helpers. Brier is a proper scoring rule; hit-rate is not.
// Derived from UVRN (Apache-2.0) — Built on UVRN. See ../NOTICE.
export function brierScore(p, outcome) {
  if (!(p >= 0 && p <= 1)) throw new Error(`forecastP must be in [0,1]; got ${p}`);
  if (outcome !== 0 && outcome !== 1) throw new Error(`outcome must be 0 or 1; got ${outcome}`);
  return (p - outcome) ** 2;
}
export function brierMultiScore(p, outcomeIndex) {
  const s = p.reduce((a, b) => a + b, 0);
  if (Math.abs(s - 1) > 1e-6) throw new Error(`forecastP must sum to 1; got ${s}`);
  if (!Number.isInteger(outcomeIndex) || outcomeIndex < 0 || outcomeIndex >= p.length) throw new Error(`outcomeIndex must index forecastP; got ${outcomeIndex}`);
  return p.reduce((a, v, k) => a + (v - (k === outcomeIndex ? 1 : 0)) ** 2, 0);
}
/** resolutions: [{ forecastP: number, outcome: 0|1 }] (binary). Bins [i/n,(i+1)/n), last closed. */
export function reliabilityBins(resolutions, binCount = 10) {
  if (!Number.isInteger(binCount) || binCount < 1) throw new Error(`binCount must be a positive integer; got ${binCount}`);
  const sums = Array.from({ length: binCount }, () => ({ count: 0, p: 0, hits: 0 }));
  for (const r of resolutions) {
    const i = Math.min(binCount - 1, Math.floor(r.forecastP * binCount));
    sums[i].count += 1; sums[i].p += r.forecastP; sums[i].hits += r.outcome === 1 ? 1 : 0;
  }
  return sums.map((s, i) => ({
    lower: i / binCount, upper: (i + 1) / binCount, count: s.count,
    meanForecast: s.count ? s.p / s.count : null, observedFrequency: s.count ? s.hits / s.count : null,
  }));
}
/** Summary of a resolved forecast log. Reference line: always forecasting 0.5 scores 0.25. */
export function trackSummary(resolutions) {
  if (!resolutions.length) return { n: 0, meanBrier: null, baselineBrier: 0.25, skill: null, bins: reliabilityBins([]) };
  const scores = resolutions.map((r) => brierScore(r.forecastP, r.outcome));
  const meanBrier = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { n: resolutions.length, meanBrier, baselineBrier: 0.25, skill: 1 - meanBrier / 0.25, bins: reliabilityBins(resolutions) };
}
