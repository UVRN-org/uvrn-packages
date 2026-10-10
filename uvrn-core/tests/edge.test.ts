
import { runDeltaEngine } from '../src/core/engine';
import { DeltaBundle } from '../src/types';

describe('Delta Engine - Edge Cases', () => {
  it('should throw on validation error (NaN)', () => {
    const bundle: any = {
      bundleId: 'bad',
      claim: 'bad',
      thresholdPct: 0.1,
      dataSpecs: [
        { id: '1', label: '1', metrics: [{ key: 'x', value: NaN }] },
        { id: '2', label: '2', metrics: [{ key: 'x', value: 10 }] }
      ]
    };
    expect(() => runDeltaEngine(bundle)).toThrow(/Invalid DeltaBundle/);
  });

  it('should handle one zero and one non-zero as delta=1.0', () => {
    const bundle: DeltaBundle = {
      bundleId: 'zeros',
      claim: 'Z',
      thresholdPct: 0.1,
      dataSpecs: [
        { id: '1', label: '1', sourceKind: 'metric', originDocIds: [], metrics: [{ key: 'z', value: 0 }] },
        { id: '2', label: '2', sourceKind: 'metric', originDocIds: [], metrics: [{ key: 'z', value: 100 }] }
      ]
    };
    const r = runDeltaEngine(bundle);
    const d = r.rounds[0].deltasByMetric['z'];
    expect(d).toBe(1.0);
    expect(r.outcome).toBe('indeterminate'); // 1.0 > 0.1
  });

  it('should handle both zeros as delta=0.0', () => {
    const bundle: DeltaBundle = {
      bundleId: 'zeros-2',
      claim: 'Z2',
      thresholdPct: 0.1,
      dataSpecs: [
        { id: '1', label: '1', sourceKind: 'metric', originDocIds: [], metrics: [{ key: 'z', value: 0 }] },
        { id: '2', label: '2', sourceKind: 'metric', originDocIds: [], metrics: [{ key: 'z', value: 0 }] }
      ]
    };
    const r = runDeltaEngine(bundle);
    const d = r.rounds[0].deltasByMetric['z'];
    expect(d).toBe(0.0);
    expect(r.outcome).toBe('consensus');
  });

  it('should ignore metrics present in only one source', () => {
    const bundle: DeltaBundle = {
      bundleId: 'sparse',
      claim: 'S',
      thresholdPct: 0.1,
      dataSpecs: [
        { id: '1', label: '1', sourceKind: 'metric', originDocIds: [], metrics: [{ key: 'common', value: 10 }, { key: 'only1', value: 50 }] },
        { id: '2', label: '2', sourceKind: 'metric', originDocIds: [], metrics: [{ key: 'common', value: 10.01 }] } // Missing 'only1'
      ]
    };
    const r = runDeltaEngine(bundle);
    const roundDetails = r.rounds[0].deltasByMetric;
    
    expect(roundDetails).toHaveProperty('common');
    expect(roundDetails).not.toHaveProperty('only1');
  });
});
