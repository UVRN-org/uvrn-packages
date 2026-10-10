import { removeVig, fractionalToDecimal, americanToDecimal } from 'oddsmith';
import { DEFAULT_THRESHOLDS } from '../src';
import {
  devigMultiplicative,
  devigPower,
  devigShin,
  evaluateMarket,
  impliedProbability,
  overround,
} from '../src/odds';
import { exchangeBinary, exchangeMulti, sportsbookMulti, sportsbookTwoWay } from './fixtures';

const ctx = { asOfMs: Date.parse('2026-09-26T12:00:00-07:00'), thresholds: { ...DEFAULT_THRESHOLDS } };

describe('impliedProbability', () => {
  it('converts american, decimal, and fractional prices', () => {
    expect(impliedProbability({ format: 'american', value: -150 })).toBeCloseTo(0.6, 12);
    expect(impliedProbability({ format: 'american', value: 130 })).toBeCloseTo(100 / 230, 12);
    expect(impliedProbability({ format: 'american', value: 100 })).toBe(0.5);
    expect(impliedProbability({ format: 'american', value: -100 })).toBe(0.5);
    expect(impliedProbability({ format: 'decimal', value: 2.5 })).toBe(0.4);
    expect(impliedProbability({ format: 'fractional', numerator: 3, denominator: 2 })).toBe(0.4);
  });

  it('rejects impossible prices', () => {
    expect(impliedProbability({ format: 'american', value: 50 })).toBeNull();
    expect(impliedProbability({ format: 'american', value: Number.NaN })).toBeNull();
    expect(impliedProbability({ format: 'decimal', value: 1 })).toBeNull();
    expect(impliedProbability({ format: 'fractional', numerator: 0, denominator: 2 })).toBeNull();
    expect(impliedProbability({ format: 'moneyline' } as never)).toBeNull();
  });
});

describe('de-vig methods', () => {
  const twoWay = [0.6, 100 / 230];
  const multi = [1 / 2.2, 5 / 16, 100 / 450, 1 / 7];

  it('every method sums to 1', () => {
    for (const q of [twoWay, multi]) {
      const sums = [
        devigMultiplicative(q),
        (devigPower(q) as { probabilities: number[] }).probabilities,
        (devigShin(q) as { probabilities: number[] }).probabilities,
      ].map((ps) => ps.reduce((a, b) => a + b, 0));
      for (const s of sums) expect(Math.abs(s - 1)).toBeLessThan(1e-9);
    }
  });

  it('Shin equals additive de-vig for two outcomes', () => {
    const shin = devigShin(twoWay);
    expect(shin.ok).toBe(true);
    const additive = twoWay.map((q) => q - overround(twoWay) / 2);
    const probs = (shin as { probabilities: number[] }).probabilities;
    probs.forEach((p, i) => expect(p).toBeCloseTo(additive[i], 9));
  });

  it('power shrinks the favorite less than multiplicative (favorite-longshot direction)', () => {
    const power = (devigPower(twoWay) as { probabilities: number[] }).probabilities;
    expect(power[0]).toBeGreaterThan(devigMultiplicative(twoWay)[0]);
  });

  it('returns a typed failure instead of a degenerate solve', () => {
    expect(devigPower([1, 0.5]).ok).toBe(false);
    expect(devigShin([1, 0.5]).ok).toBe(false);
    expect(impliedProbability({ format: 'american', value: -1e20 })).toBeNull();
  });

  it('refuses Σ implied < 1', () => {
    expect(devigPower([0.4, 0.4]).ok).toBe(false);
    expect(devigShin([0.4, 0.4]).ok).toBe(false);
  });

  it('zero-margin books pass through unchanged', () => {
    const shin = devigShin([0.25, 0.75]);
    expect(shin).toEqual({ ok: true, probabilities: [0.25, 0.75], parameter: 0, residual: 0 });
    const power = devigPower([0.25, 0.75]) as { probabilities: number[] };
    expect(power.probabilities[0]).toBeCloseTo(0.25, 12);
  });
});

describe('oddsmith cross-check (dev-only reference, not a runtime dependency)', () => {
  const decimalsTwoWay = [americanToDecimal(-150), americanToDecimal(130)];
  const decimalsMulti = [2.2, fractionalToDecimal('11/5'), americanToDecimal(350), 7.0];

  it.each([
    ['multiplicative', decimalsTwoWay],
    ['power', decimalsTwoWay],
    ['shin', decimalsTwoWay],
    ['multiplicative', decimalsMulti],
    ['power', decimalsMulti],
    ['shin', decimalsMulti],
  ] as const)('%s agrees with oddsmith to 1e-6', (method, decimals) => {
    const implied = decimals.map((d) => 1 / d);
    const solve = (r: ReturnType<typeof devigPower>) => {
      if (!r.ok) throw new Error(r.reason);
      return r.probabilities;
    };
    const ours =
      method === 'multiplicative'
        ? devigMultiplicative(implied)
        : solve(method === 'power' ? devigPower(implied) : devigShin(implied));
    const theirs = removeVig([...decimals], { method });
    ours.forEach((p, i) => expect(Math.abs(p - theirs[i])).toBeLessThan(1e-6));
  });
});

describe('evaluateMarket', () => {
  it('sportsbook: power point estimate inside the method-spread band', () => {
    const { candidate, record, refusals } = evaluateMarket(sportsbookTwoWay(), ctx);
    expect(refusals).toEqual([]);
    expect(candidate).toEqual({ p: 0.583983, low: 0.579832, high: 0.583983 });
    expect(record.priceLabel).toBe('market-implied');
    expect(record.biasCorrection).toBe('none');
    expect(record.sportsbook?.defaultMethod).toBe('power');
    expect(record.sportsbook?.shin).toEqual([0.582609, 0.417391]);
    expect(record.timeToResolutionDays).toBeGreaterThan(33);
    expect(record.domain).toBe('sports/baseball');
  });

  it('multi-outcome sportsbook distributions sum to 1 per method', () => {
    const { record } = evaluateMarket(sportsbookMulti(), ctx);
    for (const key of ['multiplicative', 'power', 'shin'] as const) {
      const s = record.sportsbook![key]!.reduce((a, b) => a + b, 0);
      expect(Math.abs(s - 1)).toBeLessThanOrEqual(4e-6);
    }
  });

  it('exchange: midpoint with bid/ask band, spread and depth recorded', () => {
    const { candidate, record } = evaluateMarket(exchangeBinary(), ctx);
    expect(candidate).toEqual({ p: 0.62, low: 0.61, high: 0.63 });
    expect(record.exchange).toEqual({ spread: 0.02, depthUsd: 5000, normalizationSum: null });
  });

  it('exchange multi-outcome normalizes midpoints', () => {
    const { candidate, record } = evaluateMarket(exchangeMulti(), ctx);
    expect(record.exchange?.normalizationSum).toBe(1.02);
    expect(candidate?.p).toBeCloseTo(0.41 / 1.02, 6);
  });

  const codes = (m: unknown) => evaluateMarket(m as never, ctx).refusals.map((r) => r.code);

  it('refuses stale, future, wide, thin, and unresolvable quotes', () => {
    expect(codes(exchangeBinary({ quotedAt: '2026-09-25T06:00:00-07:00' }))).toEqual(['market_quote_stale']);
    expect(codes(exchangeBinary({ quotedAt: '2026-09-26T13:00:00-07:00' }))).toEqual(['market_quote_after_asof']);
    expect(codes(exchangeBinary({ bid: 0.5, ask: 0.6 }))).toEqual(['market_spread_too_wide']);
    expect(codes(exchangeBinary({ depthUsd: 10 }))).toEqual(['market_depth_too_thin']);
    expect(codes({ ...exchangeBinary(), resolvesAt: '2026-09-01' })).toEqual(['market_resolves_before_asof']);
    expect(codes({ ...exchangeBinary(), targetOutcome: 'Maybe' })).toEqual(['market_target_not_found']);
    expect(codes(exchangeBinary({ bid: 0.7, ask: 0.6 }))).toContain('market_invalid_odds');
  });

  it('refuses a missing citation instead of guessing', () => {
    const m = sportsbookTwoWay();
    (m.outcomes[0] as { source: unknown }).source = { url: 'not-a-url', accessedAt: '2026-09-26' };
    expect(codes(m)).toEqual(['missing_citation']);
  });

  it('refuses a certainty-priced outcome and an out-of-range overround', () => {
    const m = sportsbookTwoWay();
    m.outcomes[0].odds = { format: 'american', value: -1e20 };
    expect(codes(m)).toEqual(['market_invalid_odds']);
    // 0.9 + 0.666667 → overround 0.566667 > 0.5
    m.outcomes[0].odds = { format: 'american', value: -900 };
    m.outcomes[1].odds = { format: 'american', value: -200 };
    expect(codes(m)).toEqual(['market_overround_out_of_range']);
    m.outcomes[0].odds = { format: 'american', value: 200 };
    m.outcomes[1].odds = { format: 'american', value: 200 };
    expect(codes(m)).toEqual(['market_overround_out_of_range']);
  });

  it('honors recorded threshold overrides', () => {
    const loose = { ...ctx, thresholds: { ...ctx.thresholds, maxExchangeSpread: 0.2 } };
    expect(evaluateMarket(exchangeBinary({ bid: 0.5, ask: 0.6 }), loose).refusals).toEqual([]);
  });
});
