/**
 * @uvrn/protocol — the single-install UVRN common path (decision D-3).
 * Re-exports core + receipt + measure + consensus + score + signal so the 10-line
 * claim → signed MasterReceipt flow needs exactly one dependency.
 *
 * Namespaced re-exports avoid symbol collisions between packages; the most-used
 * top-level names are also re-exported flat for the quickstart path.
 */

export * as core from '@uvrn/core';
export * as receipt from '@uvrn/receipt';
export * as measure from '@uvrn/measure';
export * as consensus from '@uvrn/consensus';
export * as score from '@uvrn/score';
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
