// Port of @uvrn/consensus source ranking, origin-aware agreement and dedup (prominence axis).
// Numeric path mirrors the package; the assertion path (categorical claims) is a UVRN-adapt extension.
// Derived from UVRN (Apache-2.0) — Built on UVRN. See ../NOTICE.
const DAY = 86_400_000;
export const DEFAULT_WEIGHTS = Object.freeze({ credibility: 0.4, recency: 0.3, coverage: 0.3 });
export const DEFAULT_DEDUP = Object.freeze({ relativeTolerance: 0.01, timeWindowMs: DAY, mode: 'relative' });
const clamp = (v, lo = 0, hi = 100) => Math.min(Math.max(v, lo), hi);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const validTs = (s) => typeof s === 'string' && s && Number.isFinite(Date.parse(s));
const normAssertion = (s) => String(s ?? '').trim().toLowerCase();

export function normalizeCredibility(v) {
  if (v == null) return 50;
  return v <= 1 ? clamp(v * 100) : clamp(v);
}
export function recencyScore(sourceMs, evalMs, windowDays = 30) {
  const ageDays = Math.max(0, evalMs - sourceMs) / DAY;
  return clamp(100 - (ageDays / windowDays) * 100);
}
export function resolveOriginId(s) {
  if (typeof s.originId === 'string' && s.originId.trim()) return s.originId.trim();
  const p = s.prov;
  if (p) {
    const edge = p.hadPrimarySource ?? p.wasQuotedFrom ?? p.wasDerivedFrom ?? p.wasRevisionOf ?? p.wasAttributedTo;
    if (typeof edge === 'string' && edge.trim()) return edge.trim();
  }
  return s.url ?? s.id ?? s.title ?? 'unknown';
}
/** Forecasts are not evidence: obsStatus 'F' sources are excluded unless their period has already elapsed. */
export function isExcludedForecast(s, evalMs) {
  if (s.obsStatus !== 'F') return { exclude: false };
  if (!validTs(s.appliesTo)) return { exclude: true };
  return Date.parse(s.appliesTo) < evalMs ? { exclude: false, obsStatus: 'I' } : { exclude: true };
}
/** Agreement counts distinct origins, not documents: one vote per origin at its first-seen value. */
export function originAgreementScore(items) {
  if (!items.length) return 0;
  const byOrigin = new Map();
  for (const it of items) if (!byOrigin.has(it.originId)) byOrigin.set(it.originId, it.key);
  const counts = new Map();
  for (const k of byOrigin.values()) counts.set(k, (counts.get(k) ?? 0) + 1);
  return (Math.max(...counts.values()) / byOrigin.size) * 100;
}
function nearIdentical(a, b, d) {
  if (d.mode === 'off') return false;
  if (Math.abs(a.publishedAtMs - b.publishedAtMs) > d.timeWindowMs) return false;
  if (a.assertion != null || b.assertion != null) return a.originId === b.originId; // extension: one voice per origin
  const diff = Math.abs(a.value - b.value);
  if (d.mode === 'absolute') return diff <= d.relativeTolerance;
  return diff / Math.max(Math.abs(a.value), Math.abs(b.value), 1) <= d.relativeTolerance;
}

/**
 * sources: [{ id, title, url, originId?, prov?, publishedAt?, measuredAt?, credibility?, value?, assertion?, obsStatus?, appliesTo? }]
 * opts: { fetchedAt, weights, dedup, freshnessWindowDays }
 */
export function analyzeSources(sources, opts = {}) {
  const fetchedAtMs = validTs(opts.fetchedAt) ? Date.parse(opts.fetchedAt) : Date.now();
  const weights = { ...DEFAULT_WEIGHTS, ...(opts.weights ?? {}) };
  const wsum = weights.credibility + weights.recency + weights.coverage;
  if (Math.abs(wsum - 1) > 1e-6) throw new Error(`Source weights must sum to 1.0. Received ${wsum.toFixed(6)}`);
  const dedupCfg = { ...DEFAULT_DEDUP, ...(opts.dedup ?? {}) };
  const windowDays = opts.freshnessWindowDays ?? 30;

  const numericMode = sources.some((s) => isNum(s.value));
  const usableOf = (s) => (numericMode ? isNum(s.value) : normAssertion(s.assertion) !== '');
  const usableCount = sources.filter(usableOf).length;
  const unusableSourceCount = sources.length - usableCount;
  const coverageScore = sources.length === 0 ? 0 : (usableCount / sources.length) * 100;
  const inferredPublishTimestampCount = sources.filter((s) => !validTs(s.publishedAt)).length;

  const pool = []; let excludedForecastCount = 0;
  sources.forEach((s, index) => {
    if (!usableOf(s)) return;
    const gate = isExcludedForecast(s, fetchedAtMs);
    if (gate.exclude) { excludedForecastCount += 1; return; }
    const hasMeasured = validTs(s.measuredAt);
    const recency = hasMeasured ? recencyScore(Date.parse(s.measuredAt), fetchedAtMs, windowDays) : 0;
    const originId = resolveOriginId(s);
    const credibilityScore = normalizeCredibility(s.credibility);
    const publishedAtMs = validTs(s.publishedAt) ? Date.parse(s.publishedAt) : fetchedAtMs;
    const item = {
      index, id: s.id ?? `source-${index + 1}`, title: s.title ?? s.id ?? `Source ${index + 1}`, url: s.url, originId,
      value: numericMode ? s.value : undefined, assertion: numericMode ? undefined : normAssertion(s.assertion),
      key: numericMode ? s.value.toFixed(2) : normAssertion(s.assertion),
      credibilityScore, recencyScore: recency, timestampSource: hasMeasured ? 'declared' : 'inferred',
      publishedAtMs, coverageScore, obsStatus: gate.obsStatus ?? s.obsStatus,
    };
    item.weightScore = credibilityScore * weights.credibility + recency * weights.recency + coverageScore * weights.coverage;
    pool.push(item);
  });

  const distinctOrigins = new Set(pool.map((p) => p.originId)).size;
  const agreementScore = originAgreementScore(pool);
  // What the parity number counts: one vote per origin (first-seen value), grouped by identical value/assertion.
  const firstByOrigin = new Map(); for (const it of pool) if (!firstByOrigin.has(it.originId)) firstByOrigin.set(it.originId, it.key);
  const clusterMap = new Map(); for (const [o, k] of firstByOrigin) clusterMap.set(k, [...(clusterMap.get(k) ?? []), o]);
  const originClusters = [...clusterMap.entries()].map(([key, origins]) => ({ key, origins })).sort((a, b) => b.origins.length - a.origins.length);
  const ranked = [...pool].sort((a, b) => b.weightScore - a.weightScore);
  const retained = [];
  for (const c of ranked) if (!retained.some((e) => nearIdentical(e, c, dedupCfg))) retained.push(c);
  const retainedOrigins = new Set(retained.map((r) => r.originId)).size;
  // DEVIATION from @uvrn/consensus (documented): independence is judged by distinct ORIGINS, not by value similarity.
  // The package's value-dedup keeps the score components (below) faithful, but two different origins reporting the same
  // value are the best case for a fact-check, not "insufficient". One representative per origin (highest weight) is used
  // for the independence gate, the measurements and the displayed source list.
  const bestByOrigin = new Map();
  for (const c of ranked) if (!bestByOrigin.has(c.originId)) bestByOrigin.set(c.originId, c);
  const independent = [...bestByOrigin.values()];

  const sourceCount = retained.length;
  const recency = sourceCount ? retained.reduce((a, r) => a + r.recencyScore, 0) / sourceCount : 0;
  const weighted = sourceCount ? retained.reduce((a, r) => a + r.weightScore, 0) / sourceCount : 0;
  const values = numericMode ? retained.map((r) => r.value).sort((a, b) => a - b) : [];
  const mid = Math.floor(values.length / 2);
  const median = values.length ? (values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2) : null;

  const base = {
    basis: numericMode ? 'numeric (ported from @uvrn/consensus)' : 'assertion (UVRN-adapt extension for categorical claims)',
    inputCount: sources.length, usableCount, unusableSourceCount, excludedForecastCount, inferredPublishTimestampCount,
    observationSourceCount: pool.length, distinctOriginCount: distinctOrigins, retainedCount: sourceCount, retainedOriginCount: retainedOrigins,
    deduplicatedCount: pool.length - sourceCount,
    originClusters,
    components: { completeness: coverageScore, parity: agreementScore, freshness: recency },
    stats: { sourceCount, agreementScore, coverageScore: sourceCount ? coverageScore : 0, recencyScore: recency, weightedConsensusScore: weighted },
    absoluteConsensusValue: numericMode ? { median, n: values.length, min: values[0] ?? null, max: values[values.length - 1] ?? null } : null,
    independentCount: independent.length,
    ranked: independent.map(({ index, id, title, url, originId, value, assertion, credibilityScore, recencyScore: rs, weightScore, timestampSource, obsStatus }) =>
      ({ index, id, title, url, originId, value, assertion, credibilityScore, recencyScore: rs, weightScore, timestampSource, obsStatus })),
  };
  // Independence gate: fewer than two independent origins is an honest result, not an error and not a score.
  if (independent.length < 2) {
    const shortfall = 2 - independent.length;
    return { ...base, insufficientIndependentSources: {
      inputCount: sources.length, usableCount, retainedCount: sourceCount, distinctOriginCount: independent.length, requiredCount: 2, shortfall,
      deduplicatedCount: pool.length - sourceCount,
      reason: usableCount < 2
        ? `Only ${usableCount} of ${sources.length} sources contained a usable ${numericMode ? 'numeric measurement' : 'assertion'}; ${shortfall} more independent source${shortfall === 1 ? '' : 's'} required.`
        : `${usableCount} usable sources, but they trace to only ${independent.length} independent origin${independent.length === 1 ? '' : 's'}; ${shortfall} more independent origin${shortfall === 1 ? '' : 's'} required.`,
    } };
  }
  return base;
}
