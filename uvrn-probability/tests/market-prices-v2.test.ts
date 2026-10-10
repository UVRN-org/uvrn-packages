import { ForecastValidationError, runProbability, runForecast, type ForecastInput } from '../src';
import { AS_OF, OUTCOME_HASH, cite, sportsbookTwoWay } from './fixtures';
import { vectorCasesV2 } from './fixtures-v2';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const sportsbookCase = (): ForecastInput => clone(vectorCasesV2().find((c) => c.id === 'v2-market-sportsbook')!.input);
const exchangeCase = (): ForecastInput => clone(vectorCasesV2().find((c) => c.id === 'v2-market-exchange-settles-later')!.input);

type OutcomeRecord = Record<string, unknown>;
const outcomesOf = (r: ReturnType<typeof runForecast>) => (r.inputs.market as { outcomes: OutcomeRecord[] }).outcomes;

describe('version 2 market records keep submitted prices on refusal', () => {
  it.each([0, -100])('sportsbook decimal odds %p refuse market_invalid_odds and record the submitted odds', (value) => {
    const input = sportsbookCase();
    (input.market!.outcomes[0] as { odds: unknown }).odds = { format: 'decimal', value };
    const r = runForecast(input);
    expect(r.status).toBe('insufficient_basis');
    expect(r.refusals.map((x) => x.code)).toContain('market_invalid_odds');
    const [first, second] = outcomesOf(r);
    expect(first.odds).toEqual({ format: 'decimal', value });
    expect(first.impliedP).toBeUndefined();
    expect(second.odds).toEqual(sportsbookTwoWay().outcomes[1].odds);
    expect(second.impliedP).toBeGreaterThan(0);
  });

  it('two different refused prices produce different probabilityHash values', () => {
    const zero = sportsbookCase();
    (zero.market!.outcomes[0] as { odds: unknown }).odds = { format: 'decimal', value: 0 };
    const negative = sportsbookCase();
    (negative.market!.outcomes[0] as { odds: unknown }).odds = { format: 'decimal', value: -100 };
    expect(runForecast(zero).probabilityHash).not.toBe(runForecast(negative).probabilityHash);
  });

  it('a refused fractional price is recorded as submitted', () => {
    const input = sportsbookCase();
    (input.market!.outcomes[1] as { odds: unknown }).odds = { format: 'fractional', numerator: 5, denominator: 0 };
    const r = runForecast(input);
    expect(r.refusals.map((x) => x.code)).toContain('market_invalid_odds');
    expect(outcomesOf(r)[1].odds).toEqual({ format: 'fractional', numerator: 5, denominator: 0 });
  });

  it('exchange bid > ask refuses market_invalid_odds and records bid, ask, and depthUsd but no mid', () => {
    const input = exchangeCase();
    Object.assign(input.market!.outcomes[0], { bid: 0.7, ask: 0.6, depthUsd: 4200 });
    const r = runForecast(input);
    expect(r.refusals.map((x) => x.code)).toContain('market_invalid_odds');
    const [yes] = outcomesOf(r);
    expect(yes).toMatchObject({ bid: 0.7, ask: 0.6, depthUsd: 4200 });
    expect(yes.mid).toBeUndefined();
    const other = exchangeCase();
    Object.assign(other.market!.outcomes[0], { bid: 0.8, ask: 0.6, depthUsd: 4200 });
    expect(runForecast(other).probabilityHash).not.toBe(r.probabilityHash);
  });

  it('exchange negative depth refuses and is recorded', () => {
    const input = exchangeCase();
    Object.assign(input.market!.outcomes[0], { depthUsd: -1 });
    const r = runForecast(input);
    expect(r.refusals.map((x) => x.code)).toContain('market_invalid_odds');
    expect(outcomesOf(r)[0].depthUsd).toBe(-1);
  });

  it('non-finite prices never reach a record: they are typed validation errors', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const sb = sportsbookCase();
      (sb.market!.outcomes[0] as { odds: unknown }).odds = { format: 'decimal', value: bad };
      expect(() => runForecast(sb)).toThrow(ForecastValidationError);
      const ex = exchangeCase();
      Object.assign(ex.market!.outcomes[0], { bid: bad });
      expect(() => runForecast(ex)).toThrow(ForecastValidationError);
    }
  });

  it('valid prices are recorded exactly as before (computed fields present)', () => {
    const [home] = outcomesOf(runForecast(sportsbookCase()));
    expect(home.odds).toEqual({ format: 'american', value: -150 });
    expect(home.impliedP).toBe(0.6);
    const [yes] = outcomesOf(runForecast(exchangeCase()));
    expect(yes).toMatchObject({ bid: 0.61, ask: 0.63, mid: 0.62, depthUsd: 5000 });
  });

  it('the legacy v1 emitter still omits refused prices (v1 output unchanged)', () => {
    const market = sportsbookTwoWay();
    (market.outcomes[0] as { odds: unknown }).odds = { format: 'decimal', value: 0 };
    const r = runProbability({
      specVersion: 'uvrn-probability-input-1',
      outcome: { outcomeHash: OUTCOME_HASH },
      asOf: { at: AS_OF, source: cite('asof-clock-note') },
      market,
    });
    const v1Market = r.inputs.find((i) => (i as { role: string }).role === 'market') as { outcomes: OutcomeRecord[] };
    expect(v1Market.outcomes[0].odds).toBeUndefined();
  });
});
