// Thin bridge: measurement-result-like rows → Candidate[] / rankSignals.
// BP-v2.1-LATER-D7 — packages APIs only. Zero runtime deps; no @uvrn/measure import.
// Does not invent origins, verified-market claims, or a second ranking engine.

import type { Candidate, RankedResult, SignalConfig } from '../types';
import { rankSignals } from './signals';

/**
 * Loose measurement row accepted by the bridge.
 * Matches the public shape of `@uvrn/core` MeasurementResult without coupling algox to core/measure.
 */
export interface MeasurementResultLike {
  /** Measurement type, e.g. `agree`, `disagree`, `conflict`, `potential`. */
  type: string;
  /** Measurement-defined outcome string. */
  verdict: string;
  /** Confidence in the verdict, normalized 0–1 when present. */
  confidence?: number;
  /** Plain-language explanation (preserved on Candidate; not ranked as text). */
  explanation?: string;
  /** Source ids that drove the verdict (preserved; not invented). */
  evidenceRefs?: string[];
  /** Optional stable id from the caller. */
  id?: string;
  /** Optional ISO observation time for freshness filtering. */
  observedAt?: string;
  /** Optional grouping key; defaults to `type` when absent. */
  source?: string;
}

export interface MeasurementBridgeOptions {
  /**
   * When true (default), rows with verdict `insufficient-data` still map to candidates
   * so hosts see the gap. Ranking may drop them via normal filters; we do not hide them.
   */
  includeInsufficient?: boolean;
}

function clampConfidence(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(1, Math.max(0, value));
}

/**
 * Map measurement results into algox `Candidate[]`.
 * Prominence = confidence × 100 when confidence is present (so default prominence weight works).
 * Extra fields (`measurementType`, `measurementVerdict`, `explanation`, `evidenceRefs`) pass through.
 */
export function measurementResultsToCandidates(
  results: readonly MeasurementResultLike[],
  options: MeasurementBridgeOptions = {}
): Candidate[] {
  const includeInsufficient = options.includeInsufficient !== false;
  const out: Candidate[] = [];

  results.forEach((result, index) => {
    if (!includeInsufficient && result.verdict === 'insufficient-data') {
      return;
    }

    const confidence = clampConfidence(result.confidence);
    const prominence = confidence === undefined ? undefined : confidence * 100;
    const label = `${result.type}:${result.verdict}`;

    const candidate: Candidate = {
      id: result.id ?? `measurement:${result.type}:${index}`,
      label,
      source: result.source ?? result.type,
      ...(prominence !== undefined ? { prominence } : {}),
      ...(result.observedAt ? { observedAt: result.observedAt } : {}),
      signals: {
        ...(confidence !== undefined
          ? { confidence, measurementConfidence: confidence }
          : {}),
      },
      measurementType: result.type,
      measurementVerdict: result.verdict,
      ...(result.explanation !== undefined ? { explanation: result.explanation } : {}),
      ...(result.evidenceRefs !== undefined ? { evidenceRefs: result.evidenceRefs } : {}),
    };

    out.push(candidate);
  });

  return out;
}

/**
 * One-call helper: measurement results → existing `rankSignals`.
 * Defaults `maxAgeDays` to `null` because measurement rows often lack `observedAt`
 * (callers may still pass a freshness window).
 *
 * Ranking is ordering under declared weights — not verification, accuracy, or market outcome.
 */
export async function rankMeasurementResults(
  results: readonly MeasurementResultLike[],
  config: SignalConfig = {},
  options: MeasurementBridgeOptions = {}
): Promise<RankedResult> {
  const candidates = measurementResultsToCandidates(results, options);
  return rankSignals(candidates, {
    ...config,
    maxAgeDays: config.maxAgeDays === undefined ? null : config.maxAgeDays,
  });
}
