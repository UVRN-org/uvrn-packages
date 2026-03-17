/**
 * Unit tests for validators module
 */

import { runDeltaEngine } from '@uvrn/core';
import type { DeltaBundle, DeltaReceipt } from '@uvrn/core';
import { validateBundle, validateReceipt, verifyReceiptHash, replayReceipt } from '../validators';

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
    expect(result.errors?.some(e => e.field === 'bundle')).toBe(true);
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
    expect(result.errors?.some(e => e.field === 'bundle')).toBe(true);
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
    expect(result.errors?.some(e => e.field === 'bundle')).toBe(true);
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
    expect(result.errors?.some(e => e.field === 'bundle')).toBe(true);
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
    expect(result.errors?.some(e => e.field === 'bundle')).toBe(true);
  });

  test('validates bundle with optional maxRounds', () => {
    const bundle: DeltaBundle = {
      bundleId: 'test',
      claim: 'Test',
      dataSpecs: [
        { id: 'spec-1', label: 'Test', sourceKind: 'report', originDocIds: ['doc-1'], metrics: [{ key: 'value', value: 100 }] },
        { id: 'spec-2', label: 'Test 2', sourceKind: 'report', originDocIds: ['doc-2'], metrics: [{ key: 'value', value: 105 }] }
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
    expect(result.errors?.some(e => e.field === 'bundle')).toBe(true);
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
    expect(result.errors?.some(e => e.field === 'bundle')).toBe(true);
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
    expect(result.errors?.some(e => e.field === 'bundle')).toBe(true);
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
  test('returns true for receipt produced by core runDeltaEngine (core↔sdk parity)', () => {
    const bundle: DeltaBundle = {
      bundleId: 'parity-test',
      claim: 'Core-SDK hash parity',
      dataSpecs: [
        {
          id: 's1',
          label: 'Source A',
          sourceKind: 'report',
          originDocIds: ['d1'],
          metrics: [{ key: 'k', value: 10 }]
        },
        {
          id: 's2',
          label: 'Source B',
          sourceKind: 'report',
          originDocIds: ['d2'],
          metrics: [{ key: 'k', value: 11 }]
        }
      ],
      thresholdPct: 0.1
    };
    const receipt = runDeltaEngine(bundle);
    expect(verifyReceiptHash(receipt)).toBe(true);
  });

  test('returns false for tampered receipt (core-generated, then hash altered)', () => {
    const bundle: DeltaBundle = {
      bundleId: 'tamper-test',
      claim: 'Tamper',
      dataSpecs: [
        { id: 'a', label: 'A', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'x', value: 1 }] },
        { id: 'b', label: 'B', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'x', value: 2 }] }
      ],
      thresholdPct: 0.5
    };
    const receipt = runDeltaEngine(bundle);
    const tampered = { ...receipt, hash: receipt.hash.slice(0, -1) + (receipt.hash.slice(-1) === 'a' ? 'b' : 'a') };
    expect(verifyReceiptHash(tampered)).toBe(false);
  });

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

describe('replayReceipt', () => {
  test('returns success and deterministic when receipt matches replayed result', async () => {
    const bundle: DeltaBundle = {
      bundleId: 'replay-test',
      claim: 'Replay determinism',
      dataSpecs: [
        { id: 'a', label: 'A', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'x', value: 10 }] },
        { id: 'b', label: 'B', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'x', value: 11 }] }
      ],
      thresholdPct: 0.1
    };
    const receipt = runDeltaEngine(bundle);
    const result = await replayReceipt(receipt, bundle, async (b) => runDeltaEngine(b));
    expect(result.success).toBe(true);
    expect(result.deterministic).toBe(true);
    expect(result.replayedReceipt).toBeDefined();
    expect(result.originalHash).toBe(receipt.hash);
    expect(result.recomputedHash).toBe(receipt.hash);
  });

  test('returns success false and BUNDLE_ID_MISMATCH when bundleId does not match receipt', async () => {
    const bundle: DeltaBundle = {
      bundleId: 'replay-test',
      claim: 'Replay',
      dataSpecs: [
        { id: 'a', label: 'A', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'x', value: 10 }] },
        { id: 'b', label: 'B', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'x', value: 11 }] }
      ],
      thresholdPct: 0.1
    };
    const receipt = runDeltaEngine(bundle);
    const otherBundle: DeltaBundle = { ...bundle, bundleId: 'other-id' };
    const result = await replayReceipt(receipt, otherBundle, async (b) => runDeltaEngine(b));
    expect(result.success).toBe(false);
    expect(result.error).toBe('BUNDLE_ID_MISMATCH');
    expect(result.deterministic).toBe(false);
  });

  test('returns success false for invalid bundle', async () => {
    const receipt: DeltaReceipt = {
      bundleId: 'test-123',
      deltaFinal: 0.02,
      sources: ['A', 'B'],
      rounds: [{ round: 1, deltasByMetric: {}, withinThreshold: true, witnessRequired: false }],
      suggestedFixes: [],
      outcome: 'consensus',
      hash: 'abc123'
    };
    const invalidBundle = { bundleId: 'test-123', claim: '', dataSpecs: [], thresholdPct: 0.05 } as unknown as DeltaBundle;
    const result = await replayReceipt(receipt, invalidBundle, async () => receipt);
    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_BUNDLE');
  });

  test('returns success false for missing bundle', async () => {
    const receipt: DeltaReceipt = {
      bundleId: 'test-123',
      deltaFinal: 0.02,
      sources: ['A', 'B'],
      rounds: [],
      suggestedFixes: [],
      outcome: 'consensus',
      hash: 'abc123'
    };
    const result = await replayReceipt(receipt, null as unknown as DeltaBundle, async () => receipt);
    expect(result.success).toBe(false);
    expect(result.error).toBe('MISSING_BUNDLE');
  });

  test('returns deterministic false when replayed receipt differs (e.g. different outcome)', async () => {
    const bundle: DeltaBundle = {
      bundleId: 'replay-test',
      claim: 'Replay',
      dataSpecs: [
        { id: 'a', label: 'A', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'x', value: 10 }] },
        { id: 'b', label: 'B', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'x', value: 11 }] }
      ],
      thresholdPct: 0.1
    };
    const receipt = runDeltaEngine(bundle);
    const result = await replayReceipt(receipt, bundle, async () => ({
      ...receipt,
      outcome: 'indeterminate' as const
    }));
    expect(result.success).toBe(true);
    expect(result.deterministic).toBe(false);
    expect(result.differences).toBeDefined();
    expect(result.differences?.some(d => d.includes('outcome'))).toBe(true);
  });

  test('returns EXECUTION_FAILED when executeFn throws', async () => {
    const bundle: DeltaBundle = {
      bundleId: 'replay-test',
      claim: 'Replay',
      dataSpecs: [
        { id: 'a', label: 'A', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'x', value: 10 }] },
        { id: 'b', label: 'B', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'x', value: 11 }] }
      ],
      thresholdPct: 0.1
    };
    const receipt = runDeltaEngine(bundle);
    const result = await replayReceipt(receipt, bundle, async () => {
      throw new Error('Engine unavailable');
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('EXECUTION_FAILED');
  });

  describe('replay timestamp matrix (determinism uses canonical payload excluding ts)', () => {
    const baseBundle: DeltaBundle = {
      bundleId: 'replay-ts',
      claim: 'Timestamp matrix',
      dataSpecs: [
        { id: 'a', label: 'A', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'x', value: 10 }] },
        { id: 'b', label: 'B', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'x', value: 11 }] }
      ],
      thresholdPct: 0.1
    };
    const fixedTs = '2020-01-01T00:00:00.000Z';

    test('receipt no ts, replay no ts: deterministic true', async () => {
      const receipt = runDeltaEngine(baseBundle);
      const result = await replayReceipt(receipt, baseBundle, async (b) => runDeltaEngine(b));
      expect(result.success).toBe(true);
      expect(result.deterministic).toBe(true);
      expect(result.originalHash).toBe(result.recomputedHash);
    });

    test('receipt no ts, replay with ts: deterministic true, timestampNormalized', async () => {
      const receipt = runDeltaEngine(baseBundle);
      const result = await replayReceipt(receipt, baseBundle, async (b) => runDeltaEngine(b, { timestamp: fixedTs }));
      expect(result.success).toBe(true);
      expect(result.deterministic).toBe(true);
      expect(result.timestampNormalized).toBe(true);
    });

    test('receipt with ts, replay no ts: deterministic true, timestampNormalized', async () => {
      const receipt = runDeltaEngine(baseBundle, { timestamp: fixedTs });
      const result = await replayReceipt(receipt, baseBundle, async (b) => runDeltaEngine(b));
      expect(result.success).toBe(true);
      expect(result.deterministic).toBe(true);
      expect(result.timestampNormalized).toBe(true);
    });

    test('receipt with ts, replay with ts (same): deterministic true, full hash match', async () => {
      const receipt = runDeltaEngine(baseBundle, { timestamp: fixedTs });
      const result = await replayReceipt(receipt, baseBundle, async (b) => runDeltaEngine(b, { timestamp: fixedTs }));
      expect(result.success).toBe(true);
      expect(result.deterministic).toBe(true);
      expect(result.originalHash).toBe(result.recomputedHash);
    });

    test('outcome differs: deterministic false, reason is not timestamp policy', async () => {
      const receipt = runDeltaEngine(baseBundle);
      const result = await replayReceipt(receipt, baseBundle, async () => ({
        ...receipt,
        outcome: 'indeterminate' as const
      }));
      expect(result.success).toBe(true);
      expect(result.deterministic).toBe(false);
      expect(result.differences?.some(d => d.includes('outcome'))).toBe(true);
    });
  });
});
