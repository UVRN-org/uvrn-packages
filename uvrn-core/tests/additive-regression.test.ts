import { runDeltaEngine, verifyReceipt } from '../src';
import { DeltaBundle } from '../src/types';

describe('Core additive-change regression', () => {
  it('keeps the golden hash and verifyReceipt output unchanged', () => {
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
          metrics: [
            { key: 'revenue', value: 100 },
            { key: 'users', value: 50 },
          ],
        },
        {
          id: 'src-B',
          label: 'Source B',
          sourceKind: 'metric',
          originDocIds: ['doc-2'],
          metrics: [
            { key: 'revenue', value: 102 },
            { key: 'users', value: 50 },
          ],
        },
      ],
    };

    const receipt = runDeltaEngine(bundle);

    expect(receipt.hash).toBe('af0735636388f76e19be836337f3449ba38412e677cea1b0f0f51e63f3e3b477');
    expect(verifyReceipt(receipt)).toEqual({
      verified: true,
      recomputedHash: 'af0735636388f76e19be836337f3449ba38412e677cea1b0f0f51e63f3e3b477',
    });
  });
});
