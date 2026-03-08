
import { runDeltaEngine } from '../src/core/engine';
import { DeltaBundle } from '../src/types';

describe('Delta Engine - Ordering Tests', () => {
  it('should be agnostic to DataSpec order', () => {
    const s1 = {
      id: 'A',
      label: 'A',
      sourceKind: 'metric' as const,
      originDocIds: [],
      metrics: [{ key: 'x', value: 10 }]
    };
    const s2 = {
      id: 'B',
      label: 'B',
      sourceKind: 'metric' as const,
      originDocIds: [],
      metrics: [{ key: 'x', value: 10.5 }]
    };

    const bundle1: DeltaBundle = {
      bundleId: 'ord-1',
      claim: 'Order',
      thresholdPct: 0.1,
      dataSpecs: [s1, s2]
    };

    const bundle2: DeltaBundle = {
      bundleId: 'ord-1',
      claim: 'Order',
      thresholdPct: 0.1,
      dataSpecs: [s2, s1] // Swapped
    };

    const r1 = runDeltaEngine(bundle1);
    const r2 = runDeltaEngine(bundle2);

    expect(r1.hash).toBe(r2.hash);
    expect(r1.sources).toEqual(['A', 'B']); // Both should end up sorted by ID A, B
    expect(r2.sources).toEqual(['A', 'B']);
  });

  it('should be agnostic to metric key order inside DataSpec', () => {
    const bundle1: DeltaBundle = {
      bundleId: 'metric-ord',
      claim: 'MO',
      thresholdPct: 0.1,
      dataSpecs: [
        { id: '1', label: '1', sourceKind: 'metric', originDocIds: [], metrics: [{ key: 'a', value: 1 }, { key: 'b', value: 2 }] },
        { id: '2', label: '2', sourceKind: 'metric', originDocIds: [], metrics: [{ key: 'b', value: 2 }, { key: 'a', value: 1 }] } // 'b' first here
      ]
    };
    
    // In bundle1 spec 2, key order is b, a. 
    // Logic should handle sorting of keys when comparing/processing.
    // However, the Canonical Serialization of the input bundle isn't what we hash. We hash the RECEIPT.
    // The Receipt doesn't include raw DataSpecs, it includes computed Deltas.
    // The round metrics (deltasByMetric) should be sorted by key in the receipt serialization.
    
    const r1 = runDeltaEngine(bundle1);
    
    // We want to ensure that `r1` hash is consistent.
    // Let's create a bundle where spec 1 also has swapped order, ensuring input object structure doesn't affect output.
     const bundle2: DeltaBundle = {
      bundleId: 'metric-ord',
      claim: 'MO',
      thresholdPct: 0.1,
      dataSpecs: [
        { id: '1', label: '1', sourceKind: 'metric', originDocIds: [], metrics: [{ key: 'b', value: 2 }, { key: 'a', value: 1 }] },
        { id: '2', label: '2', sourceKind: 'metric', originDocIds: [], metrics: [{ key: 'a', value: 1 }, { key: 'b', value: 2 }] }
      ]
    };

    const r2 = runDeltaEngine(bundle2);
    expect(r1.hash).toBe(r2.hash);
  });
});
