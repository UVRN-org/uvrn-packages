import { runForecast } from '../src';
import { evaluateBaseRate, type BaseRateInput } from '../src/baserate/evaluate';
import { DEFAULT_THRESHOLDS } from '../src/common/thresholds';
import { parseZoned } from '../src/common/time';
import { evaluateMarket, type MarketInput } from '../src/odds/market';
import { AS_OF_V2, DEADLINE_AS_OF, deadlineBaseRate, deadlineForecastInput, SAME_DAY, sameDayMarketInput } from './fixtures-v2';
import { exchangeBinary } from './fixtures';

const record = (r: ReturnType<typeof runForecast>) => r.inputs.baserate as Record<string, any>;

describe('end-of-day horizon for date-only horizon.by (SPEC v2 §3.5)', () => {
  it('date-only and 23:59:59.999Z horizons give 0.5 with the same questionHash', () => {
    const dateOnly = runForecast(deadlineForecastInput('a', '2026-09-27'));
    const zoned = runForecast(deadlineForecastInput('b', '2026-09-27T23:59:59.999Z'));
    for (const r of [dateOnly, zoned]) {
      expect(r.status).toBe('forecast');
      expect(r.probabilities).toEqual([
        { outcomeId: 'yes', p: 0.5 },
        { outcomeId: 'no', p: 0.5 },
      ]);
      expect(record(r).horizonInstantUtc).toBe('2026-09-27T23:59:59.999Z');
      expect(record(r).horizonUtcDate).toBe('2026-09-27');
      expect(record(r).deadlineMatched).toBe(true);
    }
    expect(dateOnly.questionHash).toBe(zoned.questionHash);
    expect(record(dateOnly).timeToEvent.horizonBy).toBe('2026-09-27');
    expect(dateOnly.probabilityHash).not.toBe(zoned.probabilityHash);
  });

  it('the version-1 evaluator keeps 00:00Z for a date-only horizon (0.25) unless the v2 policy is passed', () => {
    const ctx = { asOfMs: parseZoned(DEADLINE_AS_OF) as number, thresholds: { ...DEFAULT_THRESHOLDS } };
    const input = deadlineBaseRate('2026-09-27') as unknown as BaseRateInput;
    expect(evaluateBaseRate(input, ctx).candidate?.p).toBe(0.25);
    expect(evaluateBaseRate(input, ctx, { horizonEndOfUtcDay: true }).candidate?.p).toBe(0.5);
  });

  it('a zoned horizon is evaluated at the instant given', () => {
    const r = runForecast(deadlineForecastInput('c', '2026-09-27T00:00:00Z'));
    expect(record(r).horizonInstantUtc).toBe('2026-09-27T00:00:00.000Z');
    expect(r.probabilities?.[0].p).toBe(0.25);
  });

  it('deadline matching stays by UTC date', () => {
    const r = runForecast(deadlineForecastInput('d', '2026-09-28'));
    expect(record(r).horizonInstantUtc).toBe('2026-09-28T23:59:59.999Z');
    expect(r.refusals.map((x) => x.code)).toContain('deadline_mismatch');
  });

  it('proportion records carry no horizon instant', () => {
    const input = deadlineForecastInput('e', '2026-09-27');
    input.baserate = {
      mode: 'proportion',
      referenceClass: input.baserate!.referenceClass,
      cases: [],
    };
    const r = runForecast(input);
    expect('horizonInstantUtc' in record(r)).toBe(false);
  });
});

describe('end-of-day event cutoff for a date-only market resolvesAt (SPEC v2 §3.5)', () => {
  const market = (r: ReturnType<typeof runForecast>) => r.inputs.market as Record<string, any>;

  it("a date-only cutoff on asOf's UTC date is accepted and times like the explicit 23:59:59.999Z cutoff", () => {
    const dateOnly = runForecast(sameDayMarketInput('a', SAME_DAY));
    const zoned = runForecast(sameDayMarketInput('b', `${SAME_DAY}T23:59:59.999Z`));
    for (const r of [dateOnly, zoned]) {
      expect(r.status).toBe('forecast');
      expect(r.refusals).toEqual([]);
      expect(market(r).eventCutoffInstantUtc).toBe(`${SAME_DAY}T23:59:59.999Z`);
      expect(market(r).eventCutoffUtcDate).toBe(SAME_DAY);
      expect(market(r).deadlineMatched).toBe(true);
    }
    expect(market(dateOnly).timeToEventCutoffDays).toBe(0.208333);
    expect(market(dateOnly).timeToEventCutoffDays).toBe(market(zoned).timeToEventCutoffDays);
    expect(dateOnly.probabilities).toEqual(zoned.probabilities);
    expect(dateOnly.band).toEqual(zoned.band);
    expect(dateOnly.questionHash).toBe(zoned.questionHash);
    expect(market(dateOnly).resolvesAt).toBe(SAME_DAY);
  });

  it('a zoned cutoff is read at the instant given', () => {
    const accepted = runForecast(sameDayMarketInput('c', `${SAME_DAY}T20:00:00Z`));
    expect(market(accepted).eventCutoffInstantUtc).toBe(`${SAME_DAY}T20:00:00.000Z`);
    expect(market(accepted).timeToEventCutoffDays).toBe(0.041667);
    const refused = runForecast(sameDayMarketInput('d', `${SAME_DAY}T18:00:00Z`));
    expect(refused.status).toBe('insufficient_basis');
    expect(refused.refusals.map((x) => x.code)).toEqual(['market_resolves_before_asof']);
    expect(market(refused).eventCutoffInstantUtc).toBe(`${SAME_DAY}T18:00:00.000Z`);
  });

  it('deadline matching stays by UTC date', () => {
    const input = sameDayMarketInput('e', SAME_DAY);
    input.question.resolveBy = '2026-09-27';
    const r = runForecast(input);
    expect(r.refusals.map((x) => x.code)).toEqual(['deadline_mismatch']);
    expect(market(r).eventCutoffUtcDate).toBe(SAME_DAY);
  });

  it('the version-1 evaluator keeps 00:00Z for a date-only resolvesAt unless the v2 policy is passed', () => {
    const ctx = { asOfMs: parseZoned(AS_OF_V2) as number, thresholds: { ...DEFAULT_THRESHOLDS } };
    const input = { ...exchangeBinary(), resolvesAt: SAME_DAY } as MarketInput;
    const v1 = evaluateMarket(input, ctx);
    expect(v1.refusals.map((x) => x.code)).toEqual(['market_resolves_before_asof']);
    expect(v1.record.timeToResolutionDays).toBe(-0.791667);
    const v2 = evaluateMarket(input, ctx, { resolvesEndOfUtcDay: true });
    expect(v2.refusals).toEqual([]);
    expect(v2.record.timeToResolutionDays).toBe(0.208333);
    expect(v2.record.resolvesAt).toBe(SAME_DAY);
  });
});
