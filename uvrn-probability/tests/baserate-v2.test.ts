import { ForecastValidationError, runForecast, runProbability, type ForecastInput } from '../src';
import { OUTCOME_HASH, cite, tteBaseRate } from './fixtures';
import { ALL_APPROVED_EVENTS, CENSORED_DEGENERATE_EVENTS, binaryQuestion, tteForecast, vectorCasesV2 } from './fixtures-v2';

const byId = (id: string) => vectorCasesV2().find((c) => c.id === id)!;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function tteInput(elapsed: number, horizon: number, events?: Parameters<typeof tteForecast>[2], minCases?: number): ForecastInput {
  const t = tteForecast(elapsed, horizon, events);
  return {
    specVersion: 'uvrn-probability-input-2',
    forecastId: `tte-${elapsed}-${horizon}`,
    mode: 'baserate',
    question: binaryQuestion(t.resolveBy),
    asOf: { at: '2026-09-26T12:00:00-07:00', source: cite('asof-clock-note') },
    producer: { id: 'fixture-agent-1', kind: 'agent' },
    baserate: t.baserate,
    ...(minCases === undefined ? {} : { thresholds: { minCases } }),
  };
}

describe('version-2 minCases validation', () => {
  it.each([0, -1, 2.5, 0.5, Number.NaN])('minCases %p fails validation', (minCases) => {
    const input = clone(byId('v2-baserate-proportion').input);
    input.thresholds = { minCases };
    let caught: unknown;
    try {
      runForecast(input);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ForecastValidationError);
    expect((caught as ForecastValidationError).code).toBe('invalid_threshold');
    expect((caught as ForecastValidationError).path).toBe('thresholds.minCases');
  });

  it('minCases 1 is accepted and recorded as an override', () => {
    const input = clone(byId('v2-baserate-proportion').input);
    input.thresholds = { minCases: 1 };
    const r = runForecast(input);
    expect(r.status).toBe('forecast');
    expect(r.inputs.thresholds).toMatchObject({ overridden: ['minCases'], values: { minCases: 1 } });
  });
});

describe('at-risk gate: baserate_below_min_at_risk', () => {
  /*
   * Hand check (TTE_EVENTS, days from filing; A approved, D denied, W withdrawn, P pending):
   *   100:A 150:D 200:A 200:W 250:P 300:A 350:D 400:A 450:P 500:A
   * asOf = 2026-09-26T19:00Z and the subject filed at 00:00Z, so elapsed a = N + 19/24 days.
   *
   * Accepted, a ≈ 220.79, minCases = 6: cases with time > a are 250, 300, 350, 400, 450, 500 → 6
   * at risk, exactly minCases. Rows in (a, 420]:
   *   t=300: n=5, d1=1 → F = 1·1/5 = 0.2, S = 0.8
   *   t=350: n=4, d2=1 → S = 0.8·3/4 = 0.6
   *   t=400: n=3, d1=1 → F = 0.2 + 0.6·1/3 = 0.4
   * so P(approved by day 420 | pending at a) = 0.4.
   *
   * Refused, a ≈ 260.79, minCases = 6: cases with time > a are 300, 350, 400, 450, 500 → 5 at risk,
   * one fewer than minCases. (The initial gate still passes: 10 cases meet every criterion.)
   */
  it('exactly minCases at risk is accepted with the hand-checked estimate', () => {
    const r = runForecast(tteInput(220, 420, undefined, 6));
    expect(r.status).toBe('forecast');
    expect(r.probabilities![0]).toEqual({ outcomeId: 'yes', p: 0.4 });
    expect(r.inputs.baserate).toMatchObject({ timeToEvent: { atRiskAtElapsed: 6, interval: 'log-log' }, minAtRiskRequired: 6 });
  });

  it('one fewer than minCases at risk is refused', () => {
    const r = runForecast(tteInput(260, 420, undefined, 6));
    expect(r.status).toBe('insufficient_basis');
    expect(r.refusals.map((x) => x.code)).toEqual(['baserate_below_min_at_risk']);
    expect(r.inputs.baserate).toMatchObject({ timeToEvent: { atRiskAtElapsed: 5 } });
  });

  it('with the default minCases 8, the v1 conditional example (6 at risk) refuses in version 2', () => {
    expect(runForecast(tteInput(220, 420)).refusals.map((x) => x.code)).toEqual(['baserate_below_min_at_risk']);
    const legacy = runProbability({
      specVersion: 'uvrn-probability-input-1',
      outcome: { outcomeHash: OUTCOME_HASH },
      asOf: { at: '2026-09-26T12:00:00-07:00', source: cite('asof-clock-note') },
      baserate: tteBaseRate(220, 420),
    });
    expect(legacy.method).toBe('baserate');
    expect(legacy.p).toBe(0.4);
  });
});

describe('degenerate survival: baserate_interval_unavailable (no binomial fallback)', () => {
  it('censored-only risk set (F = 0, se = 0) refuses in version 2', () => {
    const r = runForecast(tteInput(50, 300, CENSORED_DEGENERATE_EVENTS));
    expect(r.refusals.map((x) => x.code)).toEqual(['baserate_interval_unavailable']);
    expect(r.inputs.baserate).toMatchObject({ timeToEvent: { interval: null, atRiskAtElapsed: 8 } });
  });

  it('all-approved finite tail (F = 1, survival reaches 0) is not beyond follow-up but still refuses the interval', () => {
    const r = runForecast(tteInput(50, 300, ALL_APPROVED_EVENTS));
    expect(r.refusals.map((x) => x.code)).toEqual(['baserate_interval_unavailable']);
  });

  it('the legacy v1 path keeps its documented Jeffreys fallback unchanged', () => {
    const legacy = runProbability({
      specVersion: 'uvrn-probability-input-1',
      outcome: { outcomeHash: OUTCOME_HASH },
      asOf: { at: '2026-09-26T12:00:00-07:00', source: cite('asof-clock-note') },
      baserate: tteBaseRate(50, 300, CENSORED_DEGENERATE_EVENTS),
    });
    expect(legacy.method).toBe('baserate');
    const rec = legacy.inputs.find((i) => i.role === 'baserate') as { timeToEvent: { interval: string } };
    expect(rec.timeToEvent.interval).toBe('jeffreys-degenerate-fallback');
  });
});

describe('retained estimators and refusals', () => {
  it('competing events keep the hand-checked Aalen-Johansen estimate 0.44 by day 450', () => {
    const r = runForecast(byId('v2-baserate-competing').input);
    expect(r.probabilities).toEqual([
      { outcomeId: 'yes', p: 0.44 },
      { outcomeId: 'no', p: 0.56 },
    ]);
    expect(r.inputs.baserate).toMatchObject({
      timeToEvent: { estimator: 'aalen-johansen-conditional', competingEvents: ['denied', 'withdrawn'], interval: 'log-log' },
    });
  });

  it('keeps the beyond-follow-up refusal', () => {
    const r = runForecast(tteInput(0, 600, [
      [100, 'approved'],
      [150, 'denied'],
      [200, 'approved'],
      [200, 'withdrawn'],
      [250, 'pending'],
      [300, 'approved'],
      [350, 'denied'],
      [400, 'approved'],
      [450, 'pending'],
    ]));
    expect(r.refusals.map((x) => x.code)).toEqual(['baserate_horizon_beyond_followup']);
  });

  it('keeps the initial reference-class gate and Jeffreys boundary rule', () => {
    const r = runForecast(byId('v2-baserate-proportion').input);
    expect(r.band).toMatchObject({ low: 0.119039, high: 0.705177, kind: 'statistical', confidence: 0.95 });
    const thin = clone(byId('v2-baserate-proportion').input);
    (thin.baserate as { cases: unknown[] }).cases = (thin.baserate as { cases: unknown[] }).cases.slice(0, 7);
    expect(runForecast(thin).refusals.map((x) => x.code)).toContain('baserate_below_min_cases');
  });
});
