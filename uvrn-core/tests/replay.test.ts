
import { runDeltaEngine } from '../src/core/engine';
import { DeltaBundle } from '../src/types';

describe('Delta Engine - Replay Tests', () => {
  it('should be deterministic across multiple runs', () => {
    const bundle: DeltaBundle = {
      bundleId: 'replay-001',
      claim: 'Replay Check',
      thresholdPct: 0.01,
      dataSpecs: [
        {
          id: 's1',
          label: 'S1',
          sourceKind: 'metric',
          originDocIds: [],
          metrics: [{ key: 'k1', value: 123.456 }]
        },
        {
          id: 's2',
          label: 'S2',
          sourceKind: 'metric',
          originDocIds: [],
          metrics: [{ key: 'k1', value: 123.457 }]
        }
      ]
    };

    const receipt1 = runDeltaEngine(bundle);
    const receipt2 = runDeltaEngine(bundle);
    const receipt3 = runDeltaEngine(bundle);

    expect(receipt1).toEqual(receipt2);
    expect(receipt2).toEqual(receipt3);
    expect(receipt1.hash).toBe(receipt3.hash);
  });
});
