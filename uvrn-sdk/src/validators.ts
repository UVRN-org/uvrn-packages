/**
 * Validation and Verification Functions for Delta Engine SDK
 */

import type { DeltaBundle, DeltaReceipt, DataSpec } from '@uvrn/core';
import type { ValidationResult, ValidationError, ReplayResult } from './types/sdk';
import { createHash } from 'crypto';

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
    // Compute canonical hash (same algorithm as core engine)
    const canonical = createCanonicalPayload(receipt);
    const computedHash = createHash('sha256').update(canonical).digest('hex');

    return computedHash === receipt.hash;
  } catch (error) {
    return false;
  }
}

/**
 * Creates a canonical JSON payload for hashing (same as core engine)
 * @internal
 */
function createCanonicalPayload(receipt: DeltaReceipt): string {
  // Create payload without hash field (same as core)
  const { hash, ...payload } = receipt;
  return JSON.stringify(payload, Object.keys(payload).sort());
}

/**
 * Replays a receipt's bundle through the engine to verify determinism
 *
 * Note: This requires the engine to be available (local mode recommended)
 *
 * @param receipt - The receipt containing the bundle to replay
 * @param executeFn - Function to execute bundle (provided by client)
 * @returns ReplayResult with determinism check
 *
 * @example
 * ```typescript
 * const result = await replayReceipt(receipt, (bundle) => client.runEngine(bundle));
 * if (!result.deterministic) {
 *   console.error('Non-deterministic execution detected!');
 * }
 * ```
 */
export async function replayReceipt(
  receipt: DeltaReceipt,
  _executeFn: (bundle: DeltaBundle) => Promise<DeltaReceipt>
): Promise<ReplayResult> {
  try {
    // Note: We would need the original bundle to replay
    // In a real implementation, this might be stored with the receipt
    // or reconstructed from receipt metadata
    // The _executeFn parameter is prefixed with _ to indicate it will be used in future

    // For now, return a structure that indicates we need the bundle
    return {
      success: false,
      originalReceipt: receipt,
      deterministic: false,
      error: 'Replay not yet implemented - requires original bundle or bundle reconstruction'
    };
  } catch (error) {
    return {
      success: false,
      originalReceipt: receipt,
      deterministic: false,
      error: error instanceof Error ? error.message : 'Unknown error during replay'
    };
  }
}
