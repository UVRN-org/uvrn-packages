import { DEFAULT_THRESHOLDS } from '../src';
import {
  conditionalCumulativeIncidence,
  evaluateBaseRate,
  inverseRegularizedIncompleteBeta,
  jeffreysInterval,
  lnGamma,
  logLogInterval,
  oneMinusKaplanMeier,
  regularizedIncompleteBeta,
  riskTable,
  type Observation,
} from '../src/baserate';
import { TTE_EVENTS, addDays, cite, proportionCases, referenceClass, tteBaseRate } from './fixtures';

const ctx = { asOfMs: Date.parse('2026-09-26T12:00:00-07:00'), thresholds: { ...DEFAULT_THRESHOLDS } };

const OBS: Observation[] = TTE_EVENTS.map(([time, status]) => ({
  time,
  type: status === 'approved' ? 1 : status === 'pending' ? 0 : 2,
}));

describe('incomplete beta', () => {
  it('matches closed forms', () => {
    expect(lnGamma(1)).toBeCloseTo(0, 12);
    expect(lnGamma(5)).toBeCloseTo(Math.log(24), 12);
    expect(lnGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 12);
    expect(regularizedIncompleteBeta(0.3, 1, 1).value).toBeCloseTo(0.3, 12);
    expect(regularizedIncompleteBeta(0.5, 7.5, 7.5).value).toBeCloseTo(0.5, 12);
    // I_x(a, 1) = x^a
    expect(regularizedIncompleteBeta(0.2, 3, 1).value).toBeCloseTo(0.008, 12);
    expect(inverseRegularizedIncompleteBeta(0.008, 3, 1).value).toBeCloseTo(0.2, 12);
  });
});

describe('Jeffreys interval', () => {
  // Reference values: independent Python stdlib computation (Simpson quadrature of the Beta
  // density with u² substitution, 200k panels, bisection on the CDF). Also agrees with the
  // commonly quoted 0/10 upper bound 0.2172 and 5/10 interval 0.2235–0.7765.
  it.each([
    [0, 10, 0.045455, 0, 0.217196],
    [5, 10, 0.5, 0.223529, 0.776471],
    [10, 10, 0.954545, 0.782804, 1],
    [3, 8, 0.388889, 0.119039, 0.705177],
    [1, 20, 0.071429, 0.005449, 0.210819],
  ])('x=%i n=%i', (x, n, p, low, high) => {
    const j = jeffreysInterval(x, n);
    expect(j.converged).toBe(true);
    expect(j.p).toBeCloseTo(p, 6);
    expect(j.low).toBeCloseTo(low, 6);
    expect(j.high).toBeCloseTo(high, 6);
  });

  it('pins the boundary rule and never reports exactly 0 or 1', () => {
    expect(jeffreysInterval(0, 1)).toMatchObject({ p: 0.25, low: 0 });
    expect(jeffreysInterval(1, 1)).toMatchObject({ p: 0.75, high: 1 });
  });

  it('rejects impossible counts', () => {
    expect(() => jeffreysInterval(3, 2)).toThrow();
    expect(() => jeffreysInterval(0, 0)).toThrow();
  });
});

describe('Aalen-Johansen (hand-computed)', () => {
  /*
   * Days from filing:  100:A 150:D 200:A 200:W 250:P 300:A 350:D 400:A 450:P 500:A
   * (A approved = target, D/W denied/withdrawn = competing, P pending = censored)
   *
   *  t    n  d1 d2 | S before | CIF += S·d1/n       | S after
   *  100 10   1  0 |  1       | 0.1                 | 0.9
   *  150  9   0  1 |  0.9     | 0.1                 | 0.8
   *  200  8   1  1 |  0.8     | 0.1 + 0.1  = 0.2    | 0.6
   *  (250 censored: leaves the risk set, no row)
   *  300  5   1  0 |  0.6     | 0.2 + 0.12 = 0.32   | 0.48
   *  350  4   0  1 |  0.48    | 0.32                | 0.36
   *  400  3   1  0 |  0.36    | 0.32 + 0.12 = 0.44  | 0.24
   *  (450 censored)
   *  500  1   1  0 |  0.24    | 0.44 + 0.24 = 0.68  | 0
   *
   * CIF(450) = 0.44.  Naive 1 − KM(450) (competing treated as censored):
   *   KM = 0.9 · 7/8 · 4/5 · 2/3 = 0.42 → 1 − KM = 0.58 > 0.44 (overstates by 0.14).
   *
   * Conditional, pending at a = 220, horizon D = 420: (CIF(420) − CIF(220)) / S(220)
   *   = (0.44 − 0.2) / 0.6 = 0.4.
   * Delta-method variance over rows 300, 350, 400 (S relative to a: 1, 0.8, 0.6; F after: 0.2, 0.2, 0.4):
   *   Σ S² d1(n−d1)/n³        = 4/125 + 0 + 0.36·2/27        = 0.058667
   *   Σ (F−F_j)² d/(n(n−d))   = 0.04/20 + 0.04/12             = 0.005333
   *   −2 Σ (F−F_j) S d1/n²    = −2·0.2·1/25                   = −0.016
   *   Var = 0.048, se = 0.219089. Log-log 95%: w = 1.959964·0.219089/(0.4·|ln 0.4|) = 1.171597,
   *   low = 0.4^e^w = 0.051976, high = 0.4^e^−w = 0.752816.
   */
  it('risk table', () => {
    expect(riskTable(OBS).map((r) => [r.time, r.atRisk, r.target, r.competing])).toEqual([
      [100, 10, 1, 0],
      [150, 9, 0, 1],
      [200, 8, 1, 1],
      [300, 5, 1, 0],
      [350, 4, 0, 1],
      [400, 3, 1, 0],
      [500, 1, 1, 0],
    ]);
  });

  it('unconditional CIF and naive KM overstatement', () => {
    const ci = conditionalCumulativeIncidence(OBS, 0, 450);
    expect(ci.estimate).toBeCloseTo(0.44, 12);
    expect(ci.variance).toBeCloseTo(0.02752, 10);
    expect(oneMinusKaplanMeier(OBS, 450)).toBeCloseTo(0.58, 12);
    expect(oneMinusKaplanMeier(OBS, 450)).toBeGreaterThan(ci.estimate);
    expect(conditionalCumulativeIncidence(OBS, 0, 10_000).estimate).toBeCloseTo(0.68, 12);
  });

  it('conditional form equals (CIF(D) − CIF(a)) / S(a)', () => {
    const ci = conditionalCumulativeIncidence(OBS, 220, 420);
    expect(ci.cifAtStart).toBeCloseTo(0.2, 12);
    expect(ci.cifAtHorizon).toBeCloseTo(0.44, 12);
    expect(ci.survivalAtStart).toBeCloseTo(0.6, 12);
    expect(ci.estimate).toBeCloseTo((ci.cifAtHorizon - ci.cifAtStart) / ci.survivalAtStart, 12);
    expect(ci.estimate).toBeCloseTo(0.4, 12);
    expect(ci.variance).toBeCloseTo(0.048, 12);
    expect(ci.atRiskAfterStart).toBe(6);
    const band = logLogInterval(ci.estimate, Math.sqrt(ci.variance))!;
    expect(band.low).toBeCloseTo(0.051976, 6);
    expect(band.high).toBeCloseTo(0.752816, 6);
  });

  it('log-log interval is undefined at 0, 1, or zero se', () => {
    expect(logLogInterval(0, 0.1)).toBeNull();
    expect(logLogInterval(1, 0.1)).toBeNull();
    expect(logLogInterval(0.5, 0)).toBeNull();
  });
});

describe('evaluateBaseRate', () => {
  const codes = (b: unknown) => evaluateBaseRate(b as never, ctx).refusals.map((r) => r.code);

  it('applies the declared-criteria gate and records exclusions', () => {
    const { candidate, record } = evaluateBaseRate(
      { mode: 'proportion', referenceClass: referenceClass(), cases: proportionCases(3, 5, 2) },
      ctx
    );
    expect(record.casesDeclared).toBe(10);
    expect(record.casesIncluded).toBe(8);
    expect(record.excluded).toEqual([
      { id: 'excluded-1', missingCriteria: ['cpcn-transmission'] },
      { id: 'excluded-2', missingCriteria: ['cpcn-transmission'] },
    ]);
    expect(candidate).toEqual({ p: 0.388889, low: 0.119039, high: 0.705177 });
  });

  it('refuses below minCases, undeclared criteria, and future events', () => {
    expect(codes({ mode: 'proportion', referenceClass: referenceClass(), cases: proportionCases(4, 3) })).toEqual([
      'baserate_below_min_cases',
    ]);
    const cases = proportionCases(4, 4);
    cases[0].meetsCriteria = [...cases[0].meetsCriteria, 'vibes'];
    expect(codes({ mode: 'proportion', referenceClass: referenceClass(), cases })).toEqual(['baserate_unknown_criterion']);
    const future = proportionCases(4, 4);
    future[1].resolvedAt = '2027-01-01';
    expect(codes({ mode: 'proportion', referenceClass: referenceClass(), cases: future })).toEqual([
      'baserate_event_after_asof',
    ]);
  });

  it('time-to-event conditional result matches the hand computation', () => {
    const { candidate, record } = evaluateBaseRate(tteBaseRate(220, 420), ctx);
    expect(candidate).toEqual({ p: 0.4, low: 0.051976, high: 0.752816 });
    expect(record.timeToEvent).toMatchObject({
      estimator: 'aalen-johansen-conditional',
      competingEvents: ['denied', 'withdrawn'],
      censored: ['pending'],
      atRiskAtElapsed: 6,
      survivalAtElapsed: 0.6,
      cifAtElapsed: 0.2,
      interval: 'log-log',
      standardError: 0.219089,
    });
  });

  it('refuses when nothing was pending that long, or the horizon is outside the data', () => {
    expect(codes(tteBaseRate(600, 700))).toEqual(['baserate_no_risk_set_at_elapsed']);
    expect(codes(tteBaseRate(0, 600, TTE_EVENTS.slice(0, 9)))).toEqual(['baserate_horizon_beyond_followup']);
    expect(codes(tteBaseRate(300, 200))).toEqual(['baserate_horizon_not_after_elapsed']);
  });

  it('falls back to a Jeffreys band when the log-log transform is undefined (CIF = 0)', () => {
    const events: Array<[number, 'approved' | 'denied' | 'withdrawn' | 'pending']> = [
      [100, 'approved'],
      [120, 'approved'],
      [150, 'approved'],
      [180, 'approved'],
      [300, 'denied'],
      [310, 'denied'],
      [320, 'withdrawn'],
      [330, 'denied'],
    ];
    const { candidate, record } = evaluateBaseRate(tteBaseRate(200, 400, events), ctx);
    expect(record.timeToEvent?.interval).toBe('jeffreys-degenerate-fallback');
    expect(candidate?.p).toBe(0);
    expect(candidate?.low).toBe(0);
    expect(candidate!.high).toBeGreaterThan(0);
  });

  it('rejects malformed cases rather than dropping them silently', () => {
    const b = tteBaseRate(220, 420);
    (b.cases[0] as { status: string }).status = 'granted';
    expect(codes(b)).toContain('baserate_invalid_case');
    const c = tteBaseRate(220, 420);
    c.cases[1].statusAt = addDays('2020-01-01', -5);
    expect(codes(c)).toContain('baserate_invalid_case');
    const d = tteBaseRate(220, 420);
    (d.subject as { source: unknown }).source = cite('x', '2026-09-26');
    expect(codes(d)).toEqual(['missing_citation']);
  });
});
