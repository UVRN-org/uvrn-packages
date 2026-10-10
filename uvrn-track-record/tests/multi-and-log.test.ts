import {
  InMemoryTrackRecordStore,
  brierMultiScore,
  buildForecastResolution,
  buildMultiForecastResolution,
  deriveLearnedCredibility,
  emptyTrackRecord,
  formatTrackRecordObservation,
  reliabilityBins,
  validateForecastLogEntry,
  type ForecastLogEntry,
} from '../src';

const END = '2026-11-04T00:00:00Z';
const AFTER = '2026-11-05T00:00:00Z';

function logEntry(overrides: Partial<ForecastLogEntry> = {}): ForecastLogEntry {
  return {
    originId: 'model:@uvrn/probability@0.1.0',
    forecastId: 'f1',
    loggedAt: '2026-09-26T12:00:00-07:00',
    method: 'market',
    refused: false,
    forecastP: 0.62,
    ...overrides,
  };
}

describe('brierMultiScore', () => {
  it('is 0 for a certain correct forecast and 2 for a certain wrong one', () => {
    expect(brierMultiScore([1, 0, 0], 0)).toBe(0);
    expect(brierMultiScore([0, 1, 0], 0)).toBe(2);
  });

  it('matches hand arithmetic', () => {
    // (0.5-1)^2 + 0.3^2 + 0.2^2 = 0.25 + 0.09 + 0.04
    expect(brierMultiScore([0.5, 0.3, 0.2], 0)).toBeCloseTo(0.38, 12);
  });

  it('equals twice the binary Brier for two classes', () => {
    expect(brierMultiScore([0.7, 0.3], 1)).toBeCloseTo(2 * (0.7 - 0) ** 2, 12);
  });

  it('rejects malformed distributions and indices', () => {
    expect(() => brierMultiScore([0.5, 0.4], 0)).toThrow(/sum to 1/);
    expect(() => brierMultiScore([1.2, -0.2], 0)).toThrow(/\[0,1\]/);
    expect(() => brierMultiScore([1], 0)).toThrow(/at least 2/);
    expect(() => brierMultiScore([0.5, 0.5], 2)).toThrow(/outcomeIndex/);
    expect(() => brierMultiScore([0.5, 0.5], 0.5)).toThrow(/outcomeIndex/);
  });
});

describe('buildMultiForecastResolution', () => {
  const base = {
    originId: 'o',
    forecastId: 'm1',
    appliesToEnd: END,
    resolvedAt: AFTER,
    classes: ['approved', 'denied', 'withdrawn'],
    forecastP: [0.5, 0.3, 0.2],
    outcomeIndex: 0,
  };

  it('computes brier-multi', () => {
    const r = buildMultiForecastResolution(base);
    expect(r.scoringRule).toBe('brier-multi');
    expect(r.brier).toBeCloseTo(0.38, 12);
  });

  it('refuses an unresolved period', () => {
    expect(() => buildMultiForecastResolution({ ...base, resolvedAt: '2026-11-01T00:00:00Z' })).toThrow(
      /unresolved/
    );
  });

  it('rejects duplicate or misaligned classes', () => {
    expect(() => buildMultiForecastResolution({ ...base, classes: ['a', 'a', 'b'] })).toThrow(/unique/);
    expect(() => buildMultiForecastResolution({ ...base, classes: ['a', 'b'] })).toThrow(/align/);
  });
});

describe('validateForecastLogEntry', () => {
  it('accepts binary, distribution, and refusal entries', () => {
    expect(validateForecastLogEntry(logEntry())).toBeNull();
    expect(
      validateForecastLogEntry(
        logEntry({ forecastP: null, classes: ['a', 'b'], forecastDistribution: [0.4, 0.6] })
      )
    ).toBeNull();
    expect(
      validateForecastLogEntry(
        logEntry({ method: 'insufficient_basis', refused: true, forecastP: null, refusalCodes: ['baserate_too_few_cases'] })
      )
    ).toBeNull();
  });

  it.each<[string, Partial<ForecastLogEntry>, RegExp]>([
    ['refused with a p', { refused: true }, /forecastP null/],
    ['refused with a distribution', { refused: true, forecastP: null, classes: ['a', 'b'], forecastDistribution: [0.5, 0.5] }, /distribution/],
    ['p out of range', { forecastP: 1.5 }, /\[0,1\]/],
    ['both p and distribution', { classes: ['a', 'b'], forecastDistribution: [0.5, 0.5] }, /not both/],
    ['bad loggedAt', { loggedAt: 'yesterday' }, /loggedAt/],
    ['missing method', { method: '' }, /method/],
    ['missing forecastId', { forecastId: '' }, /forecastId/],
  ])('rejects %s', (_label, overrides, pattern) => {
    expect(validateForecastLogEntry(logEntry(overrides))).toMatch(pattern);
  });
});

describe('reliabilityBins', () => {
  it('bins binary forecasts and closes the last bin at 1', () => {
    const rs = [
      buildForecastResolution({ originId: 'o', forecastId: 'a', appliesToEnd: END, resolvedAt: AFTER, forecastP: 0.05, outcome: 0 }),
      buildForecastResolution({ originId: 'o', forecastId: 'b', appliesToEnd: END, resolvedAt: AFTER, forecastP: 0.95, outcome: 1 }),
      buildForecastResolution({ originId: 'o', forecastId: 'c', appliesToEnd: END, resolvedAt: AFTER, forecastP: 1, outcome: 1 }),
    ];
    const bins = reliabilityBins(rs, 10);
    expect(bins).toHaveLength(10);
    expect(bins[0]).toEqual({ lower: 0, upper: 0.1, count: 1, meanForecast: 0.05, observedFrequency: 0 });
    expect(bins[9].count).toBe(2);
    expect(bins[9].meanForecast).toBeCloseTo(0.975, 12);
    expect(bins[9].observedFrequency).toBe(1);
    expect(bins[5]).toMatchObject({ count: 0, meanForecast: null, observedFrequency: null });
  });

  it('expands multi-class forecasts one-vs-rest', () => {
    const r = buildMultiForecastResolution({
      originId: 'o', forecastId: 'm', appliesToEnd: END, resolvedAt: AFTER,
      classes: ['x', 'y', 'z'], forecastP: [0.6, 0.3, 0.1], outcomeIndex: 1,
    });
    const bins = reliabilityBins([r], 2);
    // 0.3 and 0.1 fall in [0,0.5); 0.6 in [0.5,1]
    expect(bins[0]).toMatchObject({ count: 2, observedFrequency: 0.5 });
    expect(bins[0].meanForecast).toBeCloseTo(0.2, 12);
    expect(bins[1]).toMatchObject({ count: 1, meanForecast: 0.6, observedFrequency: 0 });
  });

  it('rejects a non-positive bin count', () => {
    expect(() => reliabilityBins([], 0)).toThrow(/binCount/);
  });
});

describe('InMemoryTrackRecordStore — log and multi', () => {
  it('logs every output including refusals, idempotently, in deterministic order', async () => {
    const store = new InMemoryTrackRecordStore();
    const origin = 'model:@uvrn/probability@0.1.0';
    await store.logForecast(logEntry({ forecastId: 'f2', loggedAt: '2026-09-27T00:00:00Z' }));
    await store.logForecast(
      logEntry({ forecastId: 'f1', method: 'insufficient_basis', refused: true, forecastP: null })
    );
    await store.logForecast(logEntry({ forecastId: 'f1', refused: true, forecastP: null }));

    const log = await store.listForecastLog(origin);
    expect(log.map((e) => e.forecastId)).toEqual(['f1', 'f2']);
    const record = await store.getRecord(origin);
    expect(record?.forecastLog).toEqual({ logged: 2, refused: 1 });
    expect(formatTrackRecordObservation(record!)).toContain('outputs_logged=2 refused=1');
  });

  it('rejects invalid log entries', async () => {
    const store = new InMemoryTrackRecordStore();
    await expect(store.logForecast(logEntry({ refused: true }))).rejects.toThrow(/invalid forecast log entry/);
  });

  it('keeps multi-class Brier separate from binary meanBrier and credibility', async () => {
    const store = new InMemoryTrackRecordStore();
    await store.addForecastResolution(
      buildForecastResolution({ originId: 'o', forecastId: 'b1', appliesToEnd: END, resolvedAt: AFTER, forecastP: 0.8, outcome: 1 })
    );
    const multi = buildMultiForecastResolution({
      originId: 'o', forecastId: 'm1', appliesToEnd: END, resolvedAt: AFTER,
      classes: ['x', 'y'], forecastP: [0, 1], outcomeIndex: 0,
    });
    await store.addMultiForecastResolution(multi);
    await store.addMultiForecastResolution(multi);

    const record = (await store.getRecord('o'))!;
    expect(record.forecasts.meanBrier).toBeCloseTo(0.04, 12);
    expect(record.forecastsMulti).toEqual({ resolved: 1, meanBrier: 2 });
    expect(deriveLearnedCredibility(record)).toBeCloseTo(0.96, 12);

    const stored = await store.listForecastResolutions('o');
    expect(stored.map((r) => r.scoringRule)).toEqual(['brier', 'brier-multi']);
  });

  it('rejects unresolved multi-class resolutions', async () => {
    const store = new InMemoryTrackRecordStore();
    await expect(
      store.addMultiForecastResolution({
        originId: 'o', forecastId: 'm', appliesToEnd: END, resolvedAt: '2026-01-01T00:00:00Z',
        classes: ['x', 'y'], forecastP: [0.5, 0.5], outcomeIndex: 0, brier: 0.5, scoringRule: 'brier-multi',
      })
    ).rejects.toThrow(/unresolved/);
  });

  it('leaves existing record shape untouched when the new methods are unused', async () => {
    const store = new InMemoryTrackRecordStore();
    await store.addForecastResolution(
      buildForecastResolution({ originId: 'o', forecastId: 'b1', appliesToEnd: END, resolvedAt: AFTER, forecastP: 0.5, outcome: 1 })
    );
    const record = (await store.getRecord('o'))!;
    expect(Object.keys(record).sort()).toEqual(Object.keys(emptyTrackRecord('o')).sort());
  });
});
