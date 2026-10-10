import { checkMetricsComparability, runDeltaEngine } from '../src';
import type { DeltaBundle } from '../src';

describe('BP-20 comparability', () => {
  it('refuses cross-dimension declared units without producing a scored delta', () => {
    const bundle: DeltaBundle = {
      bundleId: 'cmp-1',
      claim: 'cross dimension',
      thresholdPct: 0.1,
      dataSpecs: [
        {
          id: 'a',
          label: 'A',
          sourceKind: 'metric',
          originDocIds: ['a'],
          metrics: [
            {
              key: 'consensus_value',
              value: 10,
              unit: '%',
              unitSource: 'declared',
              quantityKind: 'percentage',
            },
          ],
        },
        {
          id: 'b',
          label: 'B',
          sourceKind: 'metric',
          originDocIds: ['b'],
          metrics: [
            {
              key: 'consensus_value',
              value: 20,
              unit: '[USD]',
              unitSource: 'declared',
              quantityKind: 'money',
            },
          ],
        },
      ],
    };
    const receipt = runDeltaEngine(bundle, { timestamp: '2026-06-01T00:00:00.000Z' });
    expect(receipt.rounds[0]?.deltasByMetric).toEqual({});
    expect(receipt.rounds[0]?.notes?.[0]).toContain('dimension-mismatch');
  });

  it('legacy untyped metrics remain comparable (frozen path)', () => {
    const refusal = checkMetricsComparability([
      { key: 'consensus_value', value: 1 },
      { key: 'consensus_value', value: 2 },
    ]);
    expect(refusal).toBeNull();
  });
});
