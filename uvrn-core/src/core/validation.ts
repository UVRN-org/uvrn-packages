/**
 * Delta Engine Core - Validation Logic
 * Structural validation only. No inference or enrichment.
 */

import { DeltaBundle, ValidationResult } from '../types';

export function validateBundle(bundle: DeltaBundle): ValidationResult {
  if (!bundle) {
    return { valid: false, error: 'Bundle is undefined or null' };
  }

  if (typeof bundle.bundleId !== 'string' || !bundle.bundleId) {
    return { valid: false, error: 'Missing or invalid bundleId' };
  }

  if (typeof bundle.claim !== 'string' || !bundle.claim) {
    return { valid: false, error: 'Missing or invalid claim' };
  }

  if (!Array.isArray(bundle.dataSpecs) || bundle.dataSpecs.length < 2) {
    return { valid: false, error: 'dataSpecs must be an array with at least 2 items' };
  }

  // Validate thresholdPct
  if (typeof bundle.thresholdPct !== 'number' || isNaN(bundle.thresholdPct)) {
    return { valid: false, error: 'thresholdPct must be a valid number' };
  }
  if (bundle.thresholdPct <= 0 || bundle.thresholdPct > 1) {
    return { valid: false, error: 'thresholdPct must be > 0 and <= 1' };
  }

  // Validate internals of dataSpecs
  for (let i = 0; i < bundle.dataSpecs.length; i++) {
    const spec = bundle.dataSpecs[i];
    if (!spec.id || typeof spec.id !== 'string') {
      return { valid: false, error: `DataSpec at index ${i} missing id` };
    }
    if (!spec.label || typeof spec.label !== 'string') {
      return { valid: false, error: `DataSpec at index ${i} missing label` };
    }
    if (!Array.isArray(spec.metrics)) {
      return { valid: false, error: `DataSpec at index ${i} metrics must be an array` };
    }
    
    for (const metric of spec.metrics) {
      if (!metric.key || typeof metric.key !== 'string') {
        return { valid: false, error: `DataSpec[${i}] has metric without key` };
      }
      if (typeof metric.value !== 'number' || isNaN(metric.value)) {
        return { valid: false, error: `DataSpec[${i}] metric '${metric.key}' has invalid value` };
      }
    }
  }

  return { valid: true };
}
