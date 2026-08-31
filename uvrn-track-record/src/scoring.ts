/**
 * Proper scoring and aggregate helpers for per-origin track records.
 *
 * Brier is a proper scoring rule: an origin cannot improve its expected score by
 * misreporting its own confidence. Hit-rate / accuracy percentages are improper
 * and must not be used for forecast resolution.
 */

import type {
  ForecastResolution,
  OriginTrackRecord,
  RevisionEvent,
  TranscriptionSample,
} from './types';

const VALUE_EPS = 1e-9;

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
