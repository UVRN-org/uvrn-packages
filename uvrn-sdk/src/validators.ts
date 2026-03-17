/**
 * Validation and Verification Functions for Delta Engine SDK
 */

import type { DeltaBundle, DeltaReceipt, DataSpec } from '@uvrn/core';
import { hashReceipt } from '@uvrn/core';
import type { ValidationResult, ValidationError, ReplayResult } from './types/sdk';

/**
 * Validates a Delta Bundle structure and data
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
  const errors: ValidationError[] = [];

  // Check if bundle is an object
  if (!bundle || typeof bundle !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'bundle', message: 'Bundle must be an object', expected: 'object', actual: typeof bundle }]
    };
  }

  const b = bundle as Partial<DeltaBundle>;

  // Validate bundleId
  if (!b.bundleId || typeof b.bundleId !== 'string' || b.bundleId.trim() === '') {
    errors.push({ field: 'bundleId', message: 'bundleId is required and must be a non-empty string', expected: 'string', actual: b.bundleId });
  }

  // Validate claim
  if (!b.claim || typeof b.claim !== 'string' || b.claim.trim() === '') {
    errors.push({ field: 'claim', message: 'claim is required and must be a non-empty string', expected: 'string', actual: b.claim });
  }

  // Validate dataSpecs
  if (!Array.isArray(b.dataSpecs)) {
    errors.push({ field: 'dataSpecs', message: 'dataSpecs must be an array', expected: 'array', actual: typeof b.dataSpecs });
  } else {
    if (b.dataSpecs.length === 0) {
      errors.push({ field: 'dataSpecs', message: 'dataSpecs must contain at least one DataSpec', expected: 'non-empty array', actual: 'empty array' });
    }

    // Validate each DataSpec
    b.dataSpecs.forEach((spec: unknown, index: number) => {
      const specErrors = validateDataSpec(spec, `dataSpecs[${index}]`);
      errors.push(...specErrors);
    });
  }

  // Validate thresholdPct
  if (typeof b.thresholdPct !== 'number') {
    errors.push({ field: 'thresholdPct', message: 'thresholdPct must be a number', expected: 'number', actual: typeof b.thresholdPct });
  } else if (b.thresholdPct < 0 || b.thresholdPct > 1) {
    errors.push({ field: 'thresholdPct', message: 'thresholdPct must be between 0.0 and 1.0', expected: '0.0 to 1.0', actual: b.thresholdPct });
  }

  // Validate maxRounds (optional)
  if (b.maxRounds !== undefined) {
    if (typeof b.maxRounds !== 'number' || b.maxRounds < 1 || !Number.isInteger(b.maxRounds)) {
      errors.push({ field: 'maxRounds', message: 'maxRounds must be a positive integer', expected: 'positive integer', actual: b.maxRounds });
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Validates a DataSpec object
 * @internal
 */
function validateDataSpec(spec: unknown, fieldPath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!spec || typeof spec !== 'object') {
    return [{ field: fieldPath, message: 'DataSpec must be an object', expected: 'object', actual: typeof spec }];
  }

  const s = spec as Partial<DataSpec>;

  // Validate id
  if (!s.id || typeof s.id !== 'string') {
    errors.push({ field: `${fieldPath}.id`, message: 'id is required and must be a string', expected: 'string', actual: s.id });
  }

  // Validate label
  if (!s.label || typeof s.label !== 'string') {
    errors.push({ field: `${fieldPath}.label`, message: 'label is required and must be a string', expected: 'string', actual: s.label });
  }

  // Validate sourceKind
  const validSourceKinds = ['report', 'metric', 'chart', 'meta'];
  if (!s.sourceKind || !validSourceKinds.includes(s.sourceKind)) {
    errors.push({ field: `${fieldPath}.sourceKind`, message: `sourceKind must be one of: ${validSourceKinds.join(', ')}`, expected: validSourceKinds.join('|'), actual: s.sourceKind });
  }

  // Validate originDocIds
  if (!Array.isArray(s.originDocIds)) {
    errors.push({ field: `${fieldPath}.originDocIds`, message: 'originDocIds must be an array', expected: 'array', actual: typeof s.originDocIds });
  }

  // Validate metrics
  if (!Array.isArray(s.metrics)) {
    errors.push({ field: `${fieldPath}.metrics`, message: 'metrics must be an array', expected: 'array', actual: typeof s.metrics });
  } else if (s.metrics.length === 0) {
    errors.push({ field: `${fieldPath}.metrics`, message: 'metrics must contain at least one MetricPoint', expected: 'non-empty array', actual: 'empty array' });
  }

  return errors;
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
 * Requires the original bundle that produced the receipt.
 *
 * @param receipt - The receipt to verify (must match the bundle)
 * @param bundle - The original DeltaBundle that produced the receipt (required)
 * @param executeFn - Function to execute the bundle (e.g. runDeltaEngine); must return a DeltaReceipt
 * @returns ReplayResult with success, deterministic flag, and optional differences
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

  if (originalHash !== recomputedHash) {
    differences.push(`hash: original ${originalHash} !== recomputed ${recomputedHash}`);
  }
  if (receipt.deltaFinal !== replayedReceipt.deltaFinal) {
    differences.push(`deltaFinal: ${receipt.deltaFinal} !== ${replayedReceipt.deltaFinal}`);
  }
  if (receipt.outcome !== replayedReceipt.outcome) {
    differences.push(`outcome: ${receipt.outcome} !== ${replayedReceipt.outcome}`);
  }
  if (receipt.rounds.length !== replayedReceipt.rounds.length) {
    differences.push(`rounds.length: ${receipt.rounds.length} !== ${replayedReceipt.rounds.length}`);
  }

  const deterministic = differences.length === 0;
  return {
    success: true,
    originalReceipt: receipt,
    replayedReceipt,
    deterministic,
    differences: deterministic ? undefined : differences,
    originalHash,
    recomputedHash
  };
}
