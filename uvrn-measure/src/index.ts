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
export { MeasurementRegistry, defaultRegistry } from './registry';
export type {
  AgreeVerdict,
  ConflictVerdict,
  DisagreeVerdict,
  MeasurementEvaluation,
  PotentialHistoryPoint,
  PotentialVerdict,
} from './types';
