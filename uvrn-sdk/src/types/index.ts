/**
 * Type Exports for Delta Engine SDK
 *
 * Re-exports core types from uvrn-core and SDK-specific types
 */

// Re-export core types from uvrn-core
export type {
  /**
   * A single metric data point with key, value, and optional metadata
   */
  MetricPoint,

  /**
   * Specification for a data source containing metrics
   */
  DataSpec,

  /**
   * Complete bundle submitted to Delta Engine for verification
   */
  DeltaBundle,

  /**
   * Information about a single engine execution round
   */
  DeltaRound,

  /**
   * Final outcome of engine execution: 'consensus' or 'indeterminate'
   */
  Outcome,

  /**
   * Receipt produced by Delta Engine after processing a bundle
   */
  DeltaReceipt,

  /**
   * Result of validation operations
   */
  ValidationResult as CoreValidationResult,

  /**
   * Result of verification operations
   */
  VerifyResult as CoreVerifyResult,

  /**
   * Options for engine execution
   */
  EngineOpts
} from '@uvrn/core';

// Export SDK-specific types
export type {
  ClientMode,
  ClientOptions,
  ValidationError,
  ValidationResult,
  VerificationResult,
  ReplayResult,
  BundleBuilderOptions
} from './sdk';
