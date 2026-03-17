/**
 * @uvrn/sdk
 *
 * TypeScript SDK for interacting with UVRN Delta Engine
 *
 * @packageDocumentation
 */

import path from 'path';
import fs from 'fs';

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
 * Package version (read from package.json at runtime so it stays in sync)
 */
function readPackageVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}
export const VERSION = readPackageVersion();
