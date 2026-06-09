import type { MeasurementResult } from '@uvrn/core';

/**
 * AgreeVerdict is the outcome emitted by the agree measurement.
 * `agree` means available evidence converges within tolerance; `no-agreement` means it does not.
 */
export type AgreeVerdict = 'agree' | 'no-agreement';

/**
 * DisagreeVerdict is the outcome emitted by the disagree measurement.
 * `disagree` means available numeric evidence materially diverges; `none` means no material divergence was found.
 */
export type DisagreeVerdict = 'disagree' | 'none';

/**
 * ConflictVerdict is the outcome emitted by the conflict measurement.
 * `conflict` means two sources assert mutually exclusive categorical, boolean, or range values.
 */
export type ConflictVerdict = 'conflict' | 'none';

/**
 * PotentialVerdict is the outcome emitted by the potential measurement.
 * `potential` means agreement is rising over time but still below the agree threshold.
 */
export type PotentialVerdict = 'potential' | 'none';

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
