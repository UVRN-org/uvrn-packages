/**
 * SDK-Specific Types for Delta Engine SDK
 */

import type { DeltaReceipt } from '@uvrn/core';

/**
 * Execution mode for the Delta Engine client
 */
export type ClientMode = 'cli' | 'http' | 'local';

/**
 * Configuration options for DeltaEngineClient
 */
export interface ClientOptions {
  /**
   * Execution mode: 'cli' (spawn process), 'http' (API calls), or 'local' (direct import)
   */
  mode: ClientMode;

  /**
   * Path to CLI executable (required for CLI mode)
   */
  cliPath?: string;

  /**
   * Base URL for HTTP API (required for HTTP mode)
   * @example 'http://localhost:3000'
   */
  apiUrl?: string;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Number of retry attempts on failure
   * @default 3
   */
  retries?: number;
}

/**
 * Detailed validation error information
 */
export interface ValidationError {
  /**
   * Field or path where validation failed
   */
  field: string;

  /**
   * Error message describing the validation failure
   */
  message: string;

  /**
   * Expected value or type
   */
  expected?: string;

  /**
   * Actual value received
   */
  actual?: unknown;
}

/**
 * Result of bundle or receipt validation
 */
export interface ValidationResult {
  /**
   * Whether the validation passed
   */
  valid: boolean;

  /**
   * List of validation errors (if any)
   */
  errors?: ValidationError[];
}

/**
 * Result of receipt verification (hash + determinism check)
 */
export interface VerificationResult {
  /**
   * Whether the receipt hash is valid
   */
  verified: boolean;

  /**
   * Whether replay produced identical results (determinism check)
   */
  deterministic: boolean;

  /**
   * Original hash from receipt
   */
  originalHash?: string;

  /**
   * Recomputed hash from replay
   */
  recomputedHash?: string;

  /**
   * Additional verification details
   */
  details?: Record<string, unknown>;

  /**
   * Error message if verification failed
   */
  error?: string;
}

/**
 * Result of replaying a receipt's bundle
 */
export interface ReplayResult {
  /**
   * Whether replay was successful
   */
  success: boolean;

  /**
   * Original receipt being verified
   */
  originalReceipt: DeltaReceipt;

  /**
   * New receipt from replay
   */
  replayedReceipt?: DeltaReceipt;

  /**
   * Whether the results match exactly (based on canonical payload excluding optional ts).
   */
  deterministic: boolean;

  /**
   * True when determinism used normalized hash (ts stripped); full receipt hashes differed due to timestamp context only.
   */
  timestampNormalized?: boolean;

  /**
   * Differences found (if any). When timestampNormalized is true, may include an informational line about hash/timestamp.
   */
  differences?: string[];

  /**
   * Error message or error code if replay failed (e.g. MISSING_BUNDLE, INVALID_BUNDLE, BUNDLE_ID_MISMATCH, EXECUTION_FAILED)
   */
  error?: string;

  /**
   * Original receipt hash (for comparison)
   */
  originalHash?: string;

  /**
   * Recomputed hash from replayed receipt
   */
  recomputedHash?: string;

  /**
   * Optional details for validation or execution errors
   */
  details?: Record<string, unknown>;
}

/**
 * Options for BundleBuilder
 */
export interface BundleBuilderOptions {
  /**
   * Bundle ID (generated if not provided)
   */
  bundleId?: string;

  /**
   * Claim statement
   */
  claim?: string;

  /**
   * Threshold percentage (0.0 to 1.0)
   */
  thresholdPct?: number;

  /**
   * Maximum number of rounds
   */
  maxRounds?: number;
}
