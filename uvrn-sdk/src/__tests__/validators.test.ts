/**
 * Unit tests for validators module
 */

import { validateBundle, validateReceipt, verifyReceiptHash } from '../validators';
import type { DeltaBundle, DeltaReceipt } from '@uvrn/core';

describe('validateBundle', () => {
  test('validates correct bundle', () => {
    const bundle: DeltaBundle = {
      bundleId: 'test-123',
      claim: 'Test claim',
      dataSpecs: [
        {
          id: 'spec-1',
          label: 'Test Spec',
          sourceKind: 'report',
          originDocIds: ['doc-1'],
          metrics: [{ key: 'value', value: 100 }]
        },
        {
          id: 'spec-2',
          label: 'Test Spec 2',
          sourceKind: 'metric',
          originDocIds: ['doc-2'],
          metrics: [{ key: 'value', value: 105 }]
        }
      ],
      thresholdPct: 0.05
    };

    const result = validateBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  test('rejects null bundle', () => {
    const result = validateBundle(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0].field).toBe('bundle');
  });

  test('rejects bundle without bundleId', () => {
    const bundle = {
      bundleId: '',
      claim: 'Test',
      dataSpecs: [],
      thresholdPct: 0.05
    };

    const result = validateBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.field === 'bundleId')).toBe(true);
  });

  test('rejects bundle without claim', () => {
    const bundle = {
      bundleId: 'test',
      claim: '',
      dataSpecs: [],
      thresholdPct: 0.05
    };

    const result = validateBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.field === 'claim')).toBe(true);
  });

  test('rejects bundle with empty dataSpecs', () => {
    const bundle = {
      bundleId: 'test',
      claim: 'Test',
      dataSpecs: [],
      thresholdPct: 0.05
    };

    const result = validateBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.field === 'dataSpecs')).toBe(true);
  });

  test('rejects bundle with invalid threshold (negative)', () => {
    const bundle = {
      bundleId: 'test',
      claim: 'Test',
      dataSpecs: [
        {
          id: 'spec-1',
          label: 'Test',
          sourceKind: 'report' as const,
          originDocIds: ['doc-1'],
          metrics: [{ key: 'value', value: 100 }]
        }
      ],
      thresholdPct: -0.1
    };

    const result = validateBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.field === 'thresholdPct')).toBe(true);
  });

  test('rejects bundle with invalid threshold (> 1)', () => {
    const bundle = {
      bundleId: 'test',
      claim: 'Test',
      dataSpecs: [
        {
          id: 'spec-1',
          label: 'Test',
          sourceKind: 'report' as const,
          originDocIds: ['doc-1'],
          metrics: [{ key: 'value', value: 100 }]
        }
      ],
      thresholdPct: 1.5
    };

    const result = validateBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.field === 'thresholdPct')).toBe(true);
  });

  test('validates bundle with optional maxRounds', () => {
    const bundle: DeltaBundle = {
      bundleId: 'test',
      claim: 'Test',
      dataSpecs: [
        {
          id: 'spec-1',
          label: 'Test',
          sourceKind: 'report',
          originDocIds: ['doc-1'],
          metrics: [{ key: 'value', value: 100 }]
        }
      ],
      thresholdPct: 0.05,
      maxRounds: 10
    };

    const result = validateBundle(bundle);
    expect(result.valid).toBe(true);
  });

  test('rejects invalid DataSpec missing id', () => {
    const bundle = {
      bundleId: 'test',
      claim: 'Test',
      dataSpecs: [
        {
          label: 'Test',
          sourceKind: 'report' as const,
          originDocIds: ['doc-1'],
          metrics: [{ key: 'value', value: 100 }]
        }
      ],
      thresholdPct: 0.05
    };

    const result = validateBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.field.includes('.id'))).toBe(true);
  });

  test('rejects invalid sourceKind', () => {
    const bundle = {
      bundleId: 'test',
      claim: 'Test',
      dataSpecs: [
        {
          id: 'spec-1',
          label: 'Test',
          sourceKind: 'invalid' as any,
          originDocIds: ['doc-1'],
          metrics: [{ key: 'value', value: 100 }]
        }
      ],
      thresholdPct: 0.05
    };

    const result = validateBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.field.includes('.sourceKind'))).toBe(true);
  });

  test('rejects DataSpec with empty metrics', () => {
    const bundle = {
      bundleId: 'test',
      claim: 'Test',
      dataSpecs: [
        {
          id: 'spec-1',
          label: 'Test',
          sourceKind: 'report' as const,
          originDocIds: ['doc-1'],
          metrics: []
        }
      ],
      thresholdPct: 0.05
    };

    const result = validateBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.field.includes('.metrics'))).toBe(true);
  });
});

describe('validateReceipt', () => {
  const validReceipt: DeltaReceipt = {
    bundleId: 'test-123',
    deltaFinal: 0.02,
    sources: ['Source A', 'Source B'],
    rounds: [
      {
        round: 1,
        deltasByMetric: { value: 0.02 },
        withinThreshold: true,
        witnessRequired: false
      }
    ],
    suggestedFixes: [],
    outcome: 'consensus',
    hash: 'abc123def456'
  };

  test('validates correct receipt', () => {
    const result = validateReceipt(validReceipt);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  test('rejects null receipt', () => {
    const result = validateReceipt(null);
    expect(result.valid).toBe(false);
    expect(result.errors![0].field).toBe('receipt');
  });

  test('rejects receipt without bundleId', () => {
    const receipt = { ...validReceipt, bundleId: '' };
    const result = validateReceipt(receipt);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.field === 'bundleId')).toBe(true);
  });

  test('rejects receipt without deltaFinal', () => {
    const receipt = { ...validReceipt, deltaFinal: undefined };
    const result = validateReceipt(receipt);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.field === 'deltaFinal')).toBe(true);
  });

  test('rejects receipt with invalid outcome', () => {
    const receipt = { ...validReceipt, outcome: 'invalid' as any };
    const result = validateReceipt(receipt);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.field === 'outcome')).toBe(true);
  });

  test('rejects receipt without hash', () => {
    const receipt = { ...validReceipt, hash: '' };
    const result = validateReceipt(receipt);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.field === 'hash')).toBe(true);
  });

  test('accepts both consensus and indeterminate outcomes', () => {
    const consensusReceipt = { ...validReceipt, outcome: 'consensus' as const };
    const indeterminateReceipt = { ...validReceipt, outcome: 'indeterminate' as const };

    expect(validateReceipt(consensusReceipt).valid).toBe(true);
    expect(validateReceipt(indeterminateReceipt).valid).toBe(true);
  });
});

describe('verifyReceiptHash', () => {
  test('returns false for invalid hash', () => {
    const receipt: DeltaReceipt = {
      bundleId: 'test-123',
      deltaFinal: 0.02,
      sources: ['A', 'B'],
      rounds: [],
      suggestedFixes: [],
      outcome: 'consensus',
      hash: 'invalid-hash'
    };

    const result = verifyReceiptHash(receipt);
    expect(result).toBe(false);
  });

  test('handles malformed receipt gracefully', () => {
    const receipt = {} as DeltaReceipt;
    const result = verifyReceiptHash(receipt);
    expect(result).toBe(false);
  });
});
