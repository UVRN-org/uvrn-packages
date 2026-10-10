/**
 * Proper scoring and aggregate helpers for per-origin track records.
 *
 * Brier is a proper scoring rule: an origin cannot improve its expected score by
 * misreporting its own confidence. Hit-rate / accuracy percentages are improper
 * and must not be used for forecast resolution.
 */

import type {
  ForecastLogEntry,
  ForecastResolution,
  MultiForecastResolution,
  OriginTrackRecord,
  ReliabilityBin,
  RevisionEvent,
  StoredForecastResolution,
  TranscriptionSample,
} from './types';

const VALUE_EPS = 1e-9;
/** Tolerance for a multi-class distribution summing to 1. */
const DISTRIBUTION_SUM_EPS = 1e-6;

/** Brier score = (p − outcome)². Lower is better calibration. */
export function brierScore(forecastP: number, outcome: 0 | 1): number {
  if (!(forecastP >= 0 && forecastP <= 1)) {
    throw new Error(`forecastP must be in [0,1]; got ${forecastP}`);
  }
  if (outcome !== 0 && outcome !== 1) {
    throw new Error(`outcome must be 0 or 1; got ${outcome}`);
  }
  const d = forecastP - outcome;
  return d * d;
}

/** Arithmetic fidelity: restatement matches origin figure within float epsilon. */
export function isFaithfulTranscription(originValue: number, restatedValue: number): boolean {
  return Math.abs(originValue - restatedValue) <= VALUE_EPS;
}

/**
 * A forecast may resolve only after its appliesTo period has elapsed.
 * Unresolved forecasts stay unresolved — they contribute nothing.
 */
export function canResolveForecast(appliesToEnd: string, resolvedAt: string): boolean {
  const endMs = Date.parse(appliesToEnd);
  const resolvedMs = Date.parse(resolvedAt);
  if (Number.isNaN(endMs) || Number.isNaN(resolvedMs)) {
    return false;
  }
  return resolvedMs >= endMs;
}

export function emptyTrackRecord(originId: string, updatedAt = new Date().toISOString()): OriginTrackRecord {
  return {
    originId,
    updatedAt,
    transcription: { samples: 0, faithful: 0, fidelity: null },
    revisions: { count: 0 },
    forecasts: { resolved: 0, meanBrier: null },
  };
}

/**
 * Derive a learned credibility in [0,1] from aggregates.
 * Prefers forecast calibration (1 − meanBrier) when forecasts exist; else transcription fidelity.
 * Returns null when there is no usable observation. Observation language only — not a verdict.
 */
export function deriveLearnedCredibility(record: OriginTrackRecord): number | null {
  const parts: number[] = [];
  if (record.forecasts.resolved > 0 && record.forecasts.meanBrier != null) {
    parts.push(clamp01(1 - record.forecasts.meanBrier));
  }
  if (record.transcription.samples > 0 && record.transcription.fidelity != null) {
    parts.push(clamp01(record.transcription.fidelity));
  }
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Operator-facing observation string — never honesty/motive language. */
export function formatTrackRecordObservation(record: OriginTrackRecord): string {
  const bits: string[] = [`origin=${record.originId}`];
  if (record.transcription.samples > 0) {
    bits.push(
      `transcription_fidelity=${record.transcription.fidelity?.toFixed(4) ?? 'null'} ` +
        `(${record.transcription.faithful}/${record.transcription.samples} faithful samples)`
    );
  }
  if (record.revisions.count > 0) {
    bits.push(
      `revisions_observed=${record.revisions.count}` +
        (record.revisions.lastRevisionAt ? ` last=${record.revisions.lastRevisionAt}` : '')
    );
  }
  if (record.forecasts.resolved > 0) {
    bits.push(
      `forecasts_resolved=${record.forecasts.resolved} mean_brier=${record.forecasts.meanBrier?.toFixed(4) ?? 'null'}`
    );
  }
  if (record.forecastsMulti && record.forecastsMulti.resolved > 0) {
    bits.push(
      `multi_forecasts_resolved=${record.forecastsMulti.resolved} ` +
        `mean_brier_multi=${record.forecastsMulti.meanBrier?.toFixed(4) ?? 'null'}`
    );
  }
  if (record.forecastLog && record.forecastLog.logged > 0) {
    bits.push(
      `outputs_logged=${record.forecastLog.logged} refused=${record.forecastLog.refused}`
    );
  }
  return `Track-record observation: ${bits.join('; ')}. These are measured agreement/resolution figures, not judgments about honesty.`;
}

export function applyTranscriptionSample(
  record: OriginTrackRecord,
  sample: TranscriptionSample,
  nowIso = new Date().toISOString()
): OriginTrackRecord {
  const samples = record.transcription.samples + 1;
  const faithful = record.transcription.faithful + (sample.faithful ? 1 : 0);
  return {
    ...record,
    updatedAt: nowIso,
    transcription: {
      samples,
      faithful,
      fidelity: samples > 0 ? faithful / samples : null,
    },
  };
}

export function applyRevisionEvent(
  record: OriginTrackRecord,
  event: RevisionEvent,
  nowIso = new Date().toISOString()
): OriginTrackRecord {
  return {
    ...record,
    updatedAt: nowIso,
    revisions: {
      count: record.revisions.count + 1,
      lastRevisionAt: event.observedAt,
    },
  };
}

export function applyForecastResolution(
  record: OriginTrackRecord,
  resolution: ForecastResolution,
  nowIso = new Date().toISOString()
): OriginTrackRecord {
  const prevResolved = record.forecasts.resolved;
  const prevMean = record.forecasts.meanBrier ?? 0;
  const resolved = prevResolved + 1;
  const meanBrier = (prevMean * prevResolved + resolution.brier) / resolved;
  return {
    ...record,
    updatedAt: nowIso,
    forecasts: { resolved, meanBrier },
  };
}

/** Build a ForecastResolution with computed Brier after period-elapsed check. */
export function buildForecastResolution(input: {
  originId: string;
  forecastId: string;
  appliesToEnd: string;
  resolvedAt: string;
  forecastP: number;
  outcome: 0 | 1;
  claimId?: string;
}): ForecastResolution {
  if (!canResolveForecast(input.appliesToEnd, input.resolvedAt)) {
    throw new Error(
      `forecast unresolved: resolvedAt (${input.resolvedAt}) is before appliesToEnd (${input.appliesToEnd})`
    );
  }
  const brier = brierScore(input.forecastP, input.outcome);
  return {
    originId: input.originId,
    forecastId: input.forecastId,
    appliesToEnd: input.appliesToEnd,
    resolvedAt: input.resolvedAt,
    forecastP: input.forecastP,
    outcome: input.outcome,
    brier,
    scoringRule: 'brier',
    claimId: input.claimId,
  };
}

function distributionProblem(classes: string[], forecastP: number[]): string | null {
  if (!Array.isArray(classes) || classes.length < 2) return 'classes must list at least 2 classes';
  if (new Set(classes).size !== classes.length) return 'classes must be unique';
  if (!Array.isArray(forecastP) || forecastP.length !== classes.length) {
    return 'forecastP must align with classes';
  }
  for (const p of forecastP) {
    if (!(typeof p === 'number' && p >= 0 && p <= 1)) return `forecastP entries must be in [0,1]; got ${p}`;
  }
  const sum = forecastP.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > DISTRIBUTION_SUM_EPS) return `forecastP must sum to 1; got ${sum}`;
  return null;
}

/**
 * Multi-category Brier score = Σ_k (p_k − o_k)², where o is one-hot on outcomeIndex.
 * Range [0,2]; lower is better. Proper for multi-class forecasts.
 */
export function brierMultiScore(forecastP: number[], outcomeIndex: number): number {
  const classes = forecastP.map((_, i) => String(i));
  const problem = distributionProblem(classes, forecastP);
  if (problem) throw new Error(problem);
  if (!Number.isInteger(outcomeIndex) || outcomeIndex < 0 || outcomeIndex >= forecastP.length) {
    throw new Error(`outcomeIndex must index forecastP; got ${outcomeIndex}`);
  }
  let score = 0;
  for (let k = 0; k < forecastP.length; k++) {
    const d = forecastP[k] - (k === outcomeIndex ? 1 : 0);
    score += d * d;
  }
  return score;
}

/** Build a MultiForecastResolution with computed multi-class Brier after period-elapsed check. */
export function buildMultiForecastResolution(input: {
  originId: string;
  forecastId: string;
  appliesToEnd: string;
  resolvedAt: string;
  classes: string[];
  forecastP: number[];
  outcomeIndex: number;
  claimId?: string;
}): MultiForecastResolution {
  if (!canResolveForecast(input.appliesToEnd, input.resolvedAt)) {
    throw new Error(
      `forecast unresolved: resolvedAt (${input.resolvedAt}) is before appliesToEnd (${input.appliesToEnd})`
    );
  }
  const problem = distributionProblem(input.classes, input.forecastP);
  if (problem) throw new Error(problem);
  const brier = brierMultiScore(input.forecastP, input.outcomeIndex);
  return {
    originId: input.originId,
    forecastId: input.forecastId,
    appliesToEnd: input.appliesToEnd,
    resolvedAt: input.resolvedAt,
    classes: [...input.classes],
    forecastP: [...input.forecastP],
    outcomeIndex: input.outcomeIndex,
    brier,
    scoringRule: 'brier-multi',
    claimId: input.claimId,
  };
}

export function applyMultiForecastResolution(
  record: OriginTrackRecord,
  resolution: MultiForecastResolution,
  nowIso = new Date().toISOString()
): OriginTrackRecord {
  const prevResolved = record.forecastsMulti?.resolved ?? 0;
  const prevMean = record.forecastsMulti?.meanBrier ?? 0;
  const resolved = prevResolved + 1;
  const meanBrier = (prevMean * prevResolved + resolution.brier) / resolved;
  return {
    ...record,
    updatedAt: nowIso,
    forecastsMulti: { resolved, meanBrier },
  };
}

/** Returns a problem description, or null when the entry is well-formed. */
export function validateForecastLogEntry(entry: ForecastLogEntry): string | null {
  if (!entry || typeof entry !== 'object') return 'entry must be an object';
  if (!entry.originId) return 'originId is required';
  if (!entry.forecastId) return 'forecastId is required';
  if (typeof entry.loggedAt !== 'string' || Number.isNaN(Date.parse(entry.loggedAt))) {
    return 'loggedAt must be an ISO timestamp';
  }
  if (!entry.method) return 'method is required';
  if (typeof entry.refused !== 'boolean') return 'refused must be a boolean';
  const hasDistribution = entry.forecastDistribution !== undefined || entry.classes !== undefined;
  if (entry.refused) {
    if (entry.forecastP !== null) return 'refused entries must have forecastP null';
    if (hasDistribution) return 'refused entries must not carry a distribution';
    return null;
  }
  if (hasDistribution) {
    if (entry.forecastP !== null) return 'give forecastP or a distribution, not both';
    return distributionProblem(entry.classes ?? [], entry.forecastDistribution ?? []);
  }
  if (!(typeof entry.forecastP === 'number' && entry.forecastP >= 0 && entry.forecastP <= 1)) {
    return `forecastP must be in [0,1]; got ${entry.forecastP}`;
  }
  return null;
}

export function applyForecastLogEntry(
  record: OriginTrackRecord,
  entry: ForecastLogEntry,
  nowIso = new Date().toISOString()
): OriginTrackRecord {
  return {
    ...record,
    updatedAt: nowIso,
    forecastLog: {
      logged: (record.forecastLog?.logged ?? 0) + 1,
      refused: (record.forecastLog?.refused ?? 0) + (entry.refused ? 1 : 0),
    },
  };
}

/** Deterministic ordering for listed resolutions and log entries. */
export function compareByTimeThenId(
  aTime: string,
  aId: string,
  bTime: string,
  bId: string
): number {
  const d = Date.parse(aTime) - Date.parse(bTime);
  if (d !== 0 && !Number.isNaN(d)) return d;
  return aId < bId ? -1 : aId > bId ? 1 : 0;
}

/**
 * Equal-width reliability bins. Binary resolutions contribute (forecastP, outcome);
 * multi-class resolutions contribute one-vs-rest pairs (p_k, outcomeIndex === k) per class.
 * Bins are [i/n, (i+1)/n), the last bin closed at 1.
 */
export function reliabilityBins(
  resolutions: StoredForecastResolution[],
  binCount = 10
): ReliabilityBin[] {
  if (!Number.isInteger(binCount) || binCount < 1) {
    throw new Error(`binCount must be a positive integer; got ${binCount}`);
  }
  const sums = Array.from({ length: binCount }, () => ({ count: 0, p: 0, hits: 0 }));
  const add = (p: number, hit: boolean) => {
    const i = Math.min(binCount - 1, Math.floor(p * binCount));
    sums[i].count += 1;
    sums[i].p += p;
    sums[i].hits += hit ? 1 : 0;
  };
  for (const r of resolutions) {
    if (r.scoringRule === 'brier-multi') {
      r.forecastP.forEach((p, k) => add(p, k === r.outcomeIndex));
    } else {
      add(r.forecastP, r.outcome === 1);
    }
  }
  return sums.map((s, i) => ({
    lower: i / binCount,
    upper: (i + 1) / binCount,
    count: s.count,
    meanForecast: s.count > 0 ? s.p / s.count : null,
    observedFrequency: s.count > 0 ? s.hits / s.count : null,
  }));
}
