import type { MeasurementResult } from '@uvrn/core';

/**
 * AgreeVerdict is the outcome emitted by the agree measurement.
 * `agree` means available evidence converges within tolerance; `no-agreement` means it does not;
 * `insufficient-data` means there were too few usable comparable sources to measure.
 */
export type AgreeVerdict = 'agree' | 'no-agreement' | 'insufficient-data';

/**
 * DisagreeVerdict is the outcome emitted by the disagree measurement.
 * `disagree` means available numeric evidence materially diverges; `none` means no material divergence was found;
 * `insufficient-data` means there were too few numeric values to measure.
 */
export type DisagreeVerdict = 'disagree' | 'none' | 'insufficient-data';

/**
 * ConflictVerdict is the outcome emitted by the conflict measurement.
 * `conflict` means two sources assert mutually exclusive categorical, boolean, or range values;
 * `insufficient-data` means there were too few categorical, boolean, or range assertions to measure.
 */
export type ConflictVerdict = 'conflict' | 'none' | 'insufficient-data';

/**
 * PotentialVerdict is the outcome emitted by the potential measurement.
 * `potential` means agreement is rising over time but still below the agree threshold;
 * `insufficient-data` means history was too thin or the signal fell below the confidence floor.
 */
export type PotentialVerdict = 'potential' | 'none' | 'insufficient-data';

/**
 * PotentialHistoryPoint is one historical agreement observation used by the potential measurement.
 * Scores are normalized from 0 to 1 and ordered by timestamp or array order.
 */
export interface PotentialHistoryPoint {
  /** Normalized agreement score at this observation. */
  score: number;
  /** Optional ISO timestamp for the observation. */
  ts?: string;
}

/**
 * MeasurementEvaluation is a convenience alias for results emitted by starter measurements.
 * It keeps host code explicit while preserving the open `MeasurementResult` contract from core.
 */
export type MeasurementEvaluation = MeasurementResult;
