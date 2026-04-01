
import { runDeltaEngine } from '../src/core/engine';
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
});
