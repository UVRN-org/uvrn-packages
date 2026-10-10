/**
 * @uvrn/measure provides pluggable relationship measurements for UVRN evidence.
 * It implements first-party agree, disagree, conflict, and potential modules over the core Measurement contract.
 */

export type {
  Measurement,
  MeasurementInput,
  MeasurementResult,
  MeasurementSource,
  MeasurementType,
  NodeStatus,
} from '@uvrn/core';
export { agreeMeasurement } from './measurements/agree';
export { disagreeMeasurement } from './measurements/disagree';
export { conflictMeasurement } from './measurements/conflict';
export { potentialMeasurement } from './measurements/potential';
export { stanceToMeasurementSources } from './stance';
export type {
  StanceLabel,
  StanceMeasurementProjection,
  StanceSource,
} from './stance';
export { withTypedObservation } from './typedObservation';
export type { TypedObservationAttrs } from './typedObservation';
export { MeasurementRegistry, defaultRegistry } from './registry';
export {
  parseAgreeExplanation,
  parseDisagreeExplanation,
  thresholdFactsFromResults,
  primaryDisagreeToAgreeHint,
} from './explain';
export type { MeasurementResultLike, MeasurementThresholdFact } from './explain';
export type {
  AgreeVerdict,
  ConflictVerdict,
  DisagreeVerdict,
  MeasurementEvaluation,
  PotentialHistoryPoint,
  PotentialVerdict,
} from './types';
