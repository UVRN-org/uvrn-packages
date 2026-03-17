/**
 * @uvrn/sdk
 *
 * TypeScript SDK for interacting with UVRN Delta Engine
 *
 * @packageDocumentation
 */

// Export main client
export { DeltaEngineClient } from './client';

// Export builder utility
export { BundleBuilder } from './builder';

// Export validators
export {
  validateBundle,
  validateReceipt,
  verifyReceiptHash,
  replayReceipt
} from './validators';

// Export error classes
export {
  DeltaEngineError,
  ValidationError,
  ExecutionError,
  NetworkError,
  ConfigurationError
} from './errors';

// Export all types
export type {
  // Core types from uvrn-core
  MetricPoint,
  DataSpec,
  DeltaBundle,
  DeltaRound,
  Outcome,
  DeltaReceipt,
  CoreValidationResult,
  CoreVerifyResult,
  EngineOpts,

  // SDK-specific types
  ClientMode,
  ClientOptions,
  ValidationError as ValidationErrorType,
  ValidationResult,
  VerificationResult,
  ReplayResult,
  BundleBuilderOptions
} from './types';

// Export default
export { DeltaEngineClient as default } from './client';

/**
 * Package version
 */
export const VERSION = '1.0.0';
