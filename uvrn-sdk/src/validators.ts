/**
 * Validation and Verification Functions for Delta Engine SDK
 * Bundle validation delegates to @uvrn/core for parity; replay determinism uses
 * canonical payload excluding optional ts (see ReplayResult.timestampNormalized).
 */

import type { DeltaBundle, DeltaReceipt } from '@uvrn/core';
import { validateBundle as validateBundleCore, hashReceipt } from '@uvrn/core';

/** Normalized hash (payload without ts) for replay determinism. Uses same contract as core hashReceiptPayloadWithoutTs. */
function normalizedReceiptHash(payload: Omit<DeltaReceipt, 'hash'>): string {
  const { ts: _ts, ...rest } = payload;
  return hashReceipt(rest);
}
import type { ValidationResult, ValidationError, ReplayResult } from './types/sdk';

/**
 * Validates a Delta Bundle using core protocol rules (source of truth).
 * Pass/fail is identical to @uvrn/core validateBundle; errors are mapped to SDK shape.
 *
 * @param bundle - The bundle to validate
 * @returns ValidationResult with errors if invalid
 *
 * @example
 * ```typescript
 * const result = validateBundle(myBundle);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export function validateBundle(bundle: unknown): ValidationResult {
  if (!bundle || typeof bundle !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'bundle', message: 'Bundle must be an object', expected: 'object', actual: typeof bundle }]
    };
  }

  const coreResult = validateBundleCore(bundle as DeltaBundle);
  if (!coreResult.valid) {
    return {
      valid: false,
      errors: [{ field: 'bundle', message: coreResult.error ?? 'Bundle validation failed', expected: 'valid DeltaBundle', actual: bundle }]
    };
  }
  return { valid: true };
}

/**
 * Validates a Delta Receipt structure
 *
 * @param receipt - The receipt to validate
 * @returns ValidationResult with errors if invalid
 */
export function validateReceipt(receipt: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!receipt || typeof receipt !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'receipt', message: 'Receipt must be an object', expected: 'object', actual: typeof receipt }]
    };
  }

  const r = receipt as Partial<DeltaReceipt>;

  // Validate bundleId
  if (!r.bundleId || typeof r.bundleId !== 'string') {
    errors.push({ field: 'bundleId', message: 'bundleId is required and must be a string', expected: 'string', actual: r.bundleId });
  }

  // Validate deltaFinal
  if (typeof r.deltaFinal !== 'number') {
    errors.push({ field: 'deltaFinal', message: 'deltaFinal must be a number', expected: 'number', actual: typeof r.deltaFinal });
  }

  // Validate sources
  if (!Array.isArray(r.sources)) {
    errors.push({ field: 'sources', message: 'sources must be an array', expected: 'array', actual: typeof r.sources });
  }

  // Validate rounds
  if (!Array.isArray(r.rounds)) {
    errors.push({ field: 'rounds', message: 'rounds must be an array', expected: 'array', actual: typeof r.rounds });
  }

  // Validate outcome
  if (r.outcome !== 'consensus' && r.outcome !== 'indeterminate') {
    errors.push({ field: 'outcome', message: 'outcome must be "consensus" or "indeterminate"', expected: 'consensus|indeterminate', actual: r.outcome });
  }

  // Validate hash
  if (!r.hash || typeof r.hash !== 'string') {
    errors.push({ field: 'hash', message: 'hash is required and must be a string', expected: 'string', actual: r.hash });
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Verifies the integrity of a receipt by recomputing its hash
 *
 * @param receipt - The receipt to verify
 * @returns true if hash matches, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = verifyReceiptHash(receipt);
 * if (!isValid) {
 *   console.error('Receipt has been tampered with!');
 * }
 * ```
 */
export function verifyReceiptHash(receipt: DeltaReceipt): boolean {
  try {
    const { hash, ...payload } = receipt;
    const computedHash = hashReceipt(payload);
    return computedHash === hash;
  } catch (error) {
    return false;
  }
}

/**
 * Replays a receipt's bundle through the engine to verify determinism.
 * Determinism is based on canonical payload excluding optional ts; receipt.hash
 * remains over the full payload for integrity. When only ts differs, result
 * is still deterministic and timestampNormalized is set.
 *
 * @param receipt - The receipt to verify (must match the bundle)
 * @param bundle - The original DeltaBundle that produced the receipt (required)
 * @param executeFn - Function to execute the bundle (e.g. runDeltaEngine); must return a DeltaReceipt
 * @returns ReplayResult with success, deterministic flag, optional timestampNormalized, and differences
 *
 * @example
 * ```typescript
 * const result = await replayReceipt(receipt, bundle, (b) => runDeltaEngine(b));
 * if (!result.deterministic) {
 *   console.error('Non-deterministic execution:', result.differences);
 * }
 * ```
 */
export async function replayReceipt(
  receipt: DeltaReceipt,
  bundle: DeltaBundle,
  executeFn: (bundle: DeltaBundle) => Promise<DeltaReceipt>
): Promise<ReplayResult> {
  const baseResult: ReplayResult = {
    success: false,
    originalReceipt: receipt,
    deterministic: false
  };

  const receiptValidation = validateReceipt(receipt);
  if (!receiptValidation.valid) {
    return {
      ...baseResult,
      error: 'INVALID_RECEIPT',
      details: { errors: receiptValidation.errors }
    };
  }

  if (bundle == null || typeof bundle !== 'object') {
    return { ...baseResult, error: 'MISSING_BUNDLE' };
  }

  const bundleValidation = validateBundle(bundle);
  if (!bundleValidation.valid) {
    return {
      ...baseResult,
      error: 'INVALID_BUNDLE',
      details: { errors: bundleValidation.errors }
    };
  }

  if (receipt.bundleId !== bundle.bundleId) {
    return {
      ...baseResult,
      error: 'BUNDLE_ID_MISMATCH',
      details: { receiptBundleId: receipt.bundleId, bundleBundleId: bundle.bundleId }
    };
  }

  let replayedReceipt: DeltaReceipt;
  try {
    replayedReceipt = await executeFn(bundle);
  } catch (error) {
    return {
      ...baseResult,
      error: 'EXECUTION_FAILED',
      details: { message: error instanceof Error ? error.message : String(error) }
    };
  }

  const replayedValidation = validateReceipt(replayedReceipt);
  if (!replayedValidation.valid) {
    return {
      ...baseResult,
      replayedReceipt,
      error: 'REPLAYED_RECEIPT_INVALID',
      details: { errors: replayedValidation.errors }
    };
  }

  const differences: string[] = [];
  const originalHash = receipt.hash;
  const { hash: _replayedHash, ...replayedPayload } = replayedReceipt;
  const recomputedHash = hashReceipt(replayedPayload);

  // Semantic comparison
  if (receipt.deltaFinal !== replayedReceipt.deltaFinal) {
    differences.push(`deltaFinal: ${receipt.deltaFinal} !== ${replayedReceipt.deltaFinal}`);
  }
  if (receipt.outcome !== replayedReceipt.outcome) {
    differences.push(`outcome: ${receipt.outcome} !== ${replayedReceipt.outcome}`);
  }
  if (receipt.rounds.length !== replayedReceipt.rounds.length) {
    differences.push(`rounds.length: ${receipt.rounds.length} !== ${replayedReceipt.rounds.length}`);
  }

  // Determinism: compare canonical payload excluding ts (replay timestamp policy)
  const { hash: _origHash, ...originalPayload } = receipt;
  const originalNormalizedHash = normalizedReceiptHash(originalPayload);
  const replayedNormalizedHash = normalizedReceiptHash(replayedPayload);
  const normalizedHashesMatch = originalNormalizedHash === replayedNormalizedHash;
  const fullHashesMatch = originalHash === recomputedHash;
  const semanticMatch = differences.length === 0;

  const deterministic = normalizedHashesMatch && semanticMatch;
  let timestampNormalized = false;
  let finalDifferences: string[] | undefined;

  if (deterministic && !fullHashesMatch) {
    timestampNormalized = true;
    finalDifferences = ['hash (timestamp context differed; normalized hash match)'];
  } else if (!deterministic) {
    if (!fullHashesMatch) {
      differences.push(`hash: original ${originalHash} !== recomputed ${recomputedHash}`);
    }
    finalDifferences = differences;
  }

  return {
    success: true,
    originalReceipt: receipt,
    replayedReceipt,
    deterministic,
    timestampNormalized: timestampNormalized || undefined,
    differences: finalDifferences,
    originalHash,
    recomputedHash
  };
}
