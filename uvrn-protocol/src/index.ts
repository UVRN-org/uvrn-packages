/**
 * @uvrn/protocol — the single-install UVRN production research path.
 * Re-exports core + receipt + measure + consensus + normalize + score + algox +
 * signal so normalization, ranking, and the claim → signed MasterReceipt flow
 * need exactly one dependency.
 *
 * Namespaced re-exports avoid symbol collisions between packages; the most-used
 * top-level names are also re-exported flat for the quickstart path.
 */

export * as core from '@uvrn/core';
export * as receipt from '@uvrn/receipt';
export * as measure from '@uvrn/measure';
export * as consensus from '@uvrn/consensus';
export * as normalize from '@uvrn/normalize';
export * as score from '@uvrn/score';
export * as algox from '@uvrn/algox';
export * as signal from '@uvrn/signal';

// The quickstart path, flat:
export {
  runDeltaEngine,
  verifyReceipt,
  buildMasterReceipt,
  verifyMasterReceipt,
  VSCORE_WEIGHTS,
  type DeltaBundle,
  type DeltaReceipt,
  type MasterReceipt,
  type MeasurementResult,
} from '@uvrn/core';
export {
  wrapDeltaReceipt,
  wrapMasterReceipt,
  enrichMeasurements,
  signReceipt,
  verifyReceiptFull,
  generateReceiptKeyPair,
  toHumanView,
  type NetworkReceipt,
  type HumanView,
} from '@uvrn/receipt';
export { agreeMeasurement, disagreeMeasurement, conflictMeasurement, potentialMeasurement } from '@uvrn/measure';
export { ConsensusEngine } from '@uvrn/consensus';
