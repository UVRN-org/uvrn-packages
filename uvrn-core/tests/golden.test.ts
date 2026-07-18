
import { createHash } from 'crypto';
import { runDeltaEngine } from '../src/core/engine';
import { canonicalSerializeV2 } from '../src/core/canonical-serialize-2';
import { canonicalSerialize } from '../src/core/serialization';
import { DeltaBundle } from '../src/types';

describe('Delta Engine - Golden Tests', () => {
  it('should match golden receipt and hash exactly', () => {
    const bundle: DeltaBundle = {
      bundleId: 'golden-001',
      claim: 'Test Bundle',
      thresholdPct: 0.05,
      maxRounds: 5,
      dataSpecs: [
        {
          id: 'src-A',
          label: 'Source A',
          sourceKind: 'metric',
          originDocIds: ['doc-1'],
          metrics: [{ key: 'revenue', value: 100 }, { key: 'users', value: 50 }]
        },
        {
          id: 'src-B',
          label: 'Source B',
          sourceKind: 'metric',
          originDocIds: ['doc-2'],
          metrics: [{ key: 'revenue', value: 102 }, { key: 'users', value: 50 }]
        }
      ]
    };

    const receipt = runDeltaEngine(bundle);

    // Verify hash
    expect(receipt.hash).toBe('af0735636388f76e19be836337f3449ba38412e677cea1b0f0f51e63f3e3b477');
    
    // Verify specific fields
    expect(receipt.outcome).toBe('consensus');
    expect(receipt.deltaFinal).toBe(0.01980198);
    expect(receipt.rounds).toHaveLength(1);
    expect(receipt.sources).toEqual(['Source A', 'Source B']); // Ordered by ID src-A, src-B
  });

  it('keeps valid-JSON canonical bytes and SHA-256 identical across frozen v1 and strict v2', () => {
    const payload = {
      z: [1, 2, { b: 'x', a: 'y' }],
      a: 0.5,
      nested: { deep: null },
    };
    const expected =
      '{"a":0.5,"nested":{"deep":null},"z":[1,2,{"a":"y","b":"x"}]}';
    const expectedHash = 'c84415b5764ebe66095d11c14ffc836a315c3959748bad895efb8f1f744ac72a';

    expect(canonicalSerialize(payload)).toBe(expected);
    expect(canonicalSerializeV2(payload)).toBe(expected);
    expect(createHash('sha256').update(canonicalSerialize(payload)).digest('hex')).toBe(
      expectedHash
    );
    expect(createHash('sha256').update(canonicalSerializeV2(payload)).digest('hex')).toBe(
      expectedHash
    );
  });
});
