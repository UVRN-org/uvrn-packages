/**
 * Core vs SDK validation parity: identical fixtures must yield same pass/fail.
 * Fails if core and SDK disagree on any fixture.
 */

import { validateBundle as validateBundleCore } from '@uvrn/core';
import type { DeltaBundle } from '@uvrn/core';
import { validateBundle as validateBundleSdk } from '../validators';

function runParity(bundle: unknown): void {
  const coreResult = validateBundleCore(bundle as DeltaBundle);
  const sdkResult = validateBundleSdk(bundle);
  expect(coreResult.valid).toBe(sdkResult.valid);
}

describe('Validation parity (core vs SDK)', () => {
  test('single_dataspec: both invalid', () => {
    const bundle = {
      bundleId: 'parity-1',
      claim: 'Single spec',
      dataSpecs: [
        { id: 'only', label: 'Only', sourceKind: 'report' as const, originDocIds: [], metrics: [{ key: 'x', value: 1 }] }
      ],
      thresholdPct: 0.05
    };
    runParity(bundle);
    expect(validateBundleSdk(bundle).valid).toBe(false);
    expect(validateBundleCore(bundle as DeltaBundle).valid).toBe(false);
  });

  test('threshold_zero: both invalid', () => {
    const bundle = {
      bundleId: 'parity-2',
      claim: 'Zero threshold',
      dataSpecs: [
        { id: 'a', label: 'A', sourceKind: 'report' as const, originDocIds: [], metrics: [{ key: 'x', value: 1 }] },
        { id: 'b', label: 'B', sourceKind: 'report' as const, originDocIds: [], metrics: [{ key: 'x', value: 2 }] }
      ],
      thresholdPct: 0
    };
    runParity(bundle);
    expect(validateBundleSdk(bundle).valid).toBe(false);
    expect(validateBundleCore(bundle as DeltaBundle).valid).toBe(false);
  });

  test('nan_metric: both invalid', () => {
    const bundle = {
      bundleId: 'parity-3',
      claim: 'NaN metric',
      dataSpecs: [
        { id: 'a', label: 'A', sourceKind: 'report' as const, originDocIds: [], metrics: [{ key: 'x', value: NaN }] },
        { id: 'b', label: 'B', sourceKind: 'report' as const, originDocIds: [], metrics: [{ key: 'x', value: 2 }] }
      ],
      thresholdPct: 0.1
    };
    runParity(bundle);
    expect(validateBundleSdk(bundle).valid).toBe(false);
    expect(validateBundleCore(bundle as DeltaBundle).valid).toBe(false);
  });

  test('metric_missing_key: both invalid', () => {
    const bundle = {
      bundleId: 'parity-4',
      claim: 'Missing key',
      dataSpecs: [
        { id: 'a', label: 'A', sourceKind: 'report' as const, originDocIds: [], metrics: [{ key: '', value: 1 }] },
        { id: 'b', label: 'B', sourceKind: 'report' as const, originDocIds: [], metrics: [{ key: 'x', value: 2 }] }
      ],
      thresholdPct: 0.1
    };
    runParity(bundle);
    expect(validateBundleSdk(bundle).valid).toBe(false);
    expect(validateBundleCore(bundle as DeltaBundle).valid).toBe(false);
  });

  test('metric_non_number: both invalid', () => {
    const bundle = {
      bundleId: 'parity-5',
      claim: 'Non-number metric',
      dataSpecs: [
        { id: 'a', label: 'A', sourceKind: 'report' as const, originDocIds: [], metrics: [{ key: 'x', value: 'not a number' as unknown as number }] },
        { id: 'b', label: 'B', sourceKind: 'report' as const, originDocIds: [], metrics: [{ key: 'x', value: 2 }] }
      ],
      thresholdPct: 0.1
    };
    runParity(bundle);
    expect(validateBundleSdk(bundle).valid).toBe(false);
    expect(validateBundleCore(bundle as DeltaBundle).valid).toBe(false);
  });

  test('valid_bundle: both valid', () => {
    const bundle: DeltaBundle = {
      bundleId: 'parity-6',
      claim: 'Valid',
      dataSpecs: [
        { id: 'a', label: 'A', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'x', value: 10 }] },
        { id: 'b', label: 'B', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'x', value: 11 }] }
      ],
      thresholdPct: 0.1
    };
    runParity(bundle);
    expect(validateBundleSdk(bundle).valid).toBe(true);
    expect(validateBundleCore(bundle).valid).toBe(true);
  });
});
