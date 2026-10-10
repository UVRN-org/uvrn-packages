import { runDeltaEngine } from '../src/core/engine';
import { validateBundle } from '../src/core/validation';
import { DeltaBundle } from '../src/types';

describe('Delta Engine - absoluteEpsilon (BP-17)', () => {
  const nearZeroPair = (): DeltaBundle => ({
    bundleId: 'nz-pair',
    claim: 'near zero pair',
    thresholdPct: 0.1,
    dataSpecs: [
      {
        id: 'a',
        label: 'A',
        sourceKind: 'metric',
        originDocIds: [],
        metrics: [{ key: 'v', value: 0 }],
      },
      {
        id: 'b',
        label: 'B',
        sourceKind: 'metric',
        originDocIds: [],
        metrics: [{ key: 'v', value: 0.01 }],
      },
    ],
  });

  it('unset absoluteEpsilon keeps 0 vs 0.01 as max variance (frozen path)', () => {
    const r = runDeltaEngine(nearZeroPair());
    expect(r.rounds[0].deltasByMetric['v']).toBe(1.0);
    expect(r.outcome).toBe('indeterminate');
    expect(r.hash).toBe(
      '829f486127108414e214dfe41a52bad677cd6213c414ce987ef452ff370c0188',
    );
  });

  it('set absoluteEpsilon makes 0 vs 0.01 consensus (C24 pair)', () => {
    const bundle: DeltaBundle = { ...nearZeroPair(), absoluteEpsilon: 0.01 };
    const r = runDeltaEngine(bundle);
    expect(r.rounds[0].deltasByMetric['v']).toBe(0);
    expect(r.deltaFinal).toBe(0);
    expect(r.outcome).toBe('consensus');
  });

  it('leaves both-zero as delta 0 regardless of epsilon', () => {
    const bundle: DeltaBundle = {
      bundleId: 'zeros-2',
      claim: 'Z2',
      thresholdPct: 0.1,
      absoluteEpsilon: 0.01,
      dataSpecs: [
        {
          id: '1',
          label: '1',
          sourceKind: 'metric',
          originDocIds: [],
          metrics: [{ key: 'z', value: 0 }],
        },
        {
          id: '2',
          label: '2',
          sourceKind: 'metric',
          originDocIds: [],
          metrics: [{ key: 'z', value: 0 }],
        },
      ],
    };
    const r = runDeltaEngine(bundle);
    expect(r.rounds[0].deltasByMetric['z']).toBe(0);
    expect(r.outcome).toBe('consensus');
  });

  it('validateBundle rejects non-finite absoluteEpsilon when present', () => {
    const base = nearZeroPair();
    expect(validateBundle({ ...base, absoluteEpsilon: Number.NaN }).valid).toBe(
      false,
    );
    expect(
      validateBundle({ ...base, absoluteEpsilon: Number.POSITIVE_INFINITY })
        .valid,
    ).toBe(false);
  });

  it('validateBundle rejects negative absoluteEpsilon when present', () => {
    const r = validateBundle({ ...nearZeroPair(), absoluteEpsilon: -0.01 });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/absoluteEpsilon/);
  });

  it('validateBundle accepts absent absoluteEpsilon unchanged', () => {
    expect(validateBundle(nearZeroPair()).valid).toBe(true);
  });

  it('validateBundle accepts finite non-negative absoluteEpsilon', () => {
    expect(
      validateBundle({ ...nearZeroPair(), absoluteEpsilon: 0 }).valid,
    ).toBe(true);
    expect(
      validateBundle({ ...nearZeroPair(), absoluteEpsilon: 0.01 }).valid,
    ).toBe(true);
  });
});
