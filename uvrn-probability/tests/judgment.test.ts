import {
  ForecastValidationError,
  LIMITATION_ASSUMPTION_ONLY,
  LIMITATION_CITED,
  LIMITATION_JUDGMENT,
  runForecast,
  type ForecastInput,
} from '../src';
import { validateJudgment } from '../src/judgment';
import { cite, judgmentAssumptionOnly, judgmentBinary, judgmentCategorical, permitQuestion, vectorCasesV2 } from './fixtures-v2';

const byId = (id: string) => vectorCasesV2().find((c) => c.id === id)!;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function withJudgment(judgment: unknown, id = 'v2-judgment-binary'): ForecastInput {
  return { ...clone(byId(id).input), judgment } as ForecastInput;
}

function expectCode(fn: () => unknown, code: string): ForecastValidationError {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ForecastValidationError);
  expect((caught as ForecastValidationError).code).toBe(code);
  return caught as ForecastValidationError;
}

describe('judgment: accepted allocations', () => {
  it('binary 0.71 / 0.29 survives unchanged and is attributed to its producer', () => {
    const r = runForecast(byId('v2-judgment-binary').input);
    expect(r).toMatchObject({
      mode: 'judgment',
      status: 'forecast',
      basis: 'agent-judgment',
      producer: { id: 'fixture-agent-1', kind: 'agent', model: 'fixture-model' },
      probabilities: [
        { outcomeId: 'yes', p: 0.71 },
        { outcomeId: 'no', p: 0.29 },
      ],
    });
    expect(r.inputs.judgment).toMatchObject({ basisLabel: 'cited-evidence-and-judgment' });
    expect(r.limitations).toEqual(expect.arrayContaining([LIMITATION_JUDGMENT, LIMITATION_CITED]));
    expect(r.receipt.tags).toContain('judgment:cited-evidence-and-judgment');
  });

  it('categorical 0.60 / 0.30 / 0.10 is preserved exactly, in question order', () => {
    const r = runForecast(byId('v2-judgment-categorical').input);
    expect(r.probabilities).toEqual([
      { outcomeId: 'approved', p: 0.6 },
      { outcomeId: 'denied-or-withdrawn', p: 0.3 },
      { outcomeId: 'pending', p: 0.1 },
    ]);
    expect(r.band).toBeNull();
  });

  it('assumption-only judgment is accepted, labeled assumption-only, with rationale, counterarguments, and uncertainty', () => {
    const r = runForecast(byId('v2-judgment-assumption-only').input);
    expect(r.status).toBe('forecast');
    expect(r.inputs.judgment).toMatchObject({
      basisLabel: 'assumption-only',
      evidence: [],
      assumptions: judgmentAssumptionOnly().assumptions,
      rationale: judgmentAssumptionOnly().rationale,
      counterarguments: judgmentAssumptionOnly().counterarguments,
      uncertainty: judgmentAssumptionOnly().uncertainty,
      range: null,
    });
    expect(r.limitations).toContain(LIMITATION_ASSUMPTION_ONLY);
    expect(r.limitations).toContain(`Producer-stated uncertainty: ${judgmentAssumptionOnly().uncertainty}`);
    expect(r.receipt.tags).toContain('judgment:assumption-only');
  });

  it('abstention yields null probabilities and a judgment_abstained refusal', () => {
    const r = runForecast(byId('v2-judgment-abstain').input);
    expect(r).toMatchObject({ status: 'insufficient_basis', basis: null, probabilities: null, band: null });
    expect(r.refusals).toEqual([{ code: 'judgment_abstained', scope: 'judgment', message: expect.any(String) }]);
    expect(r.inputs.judgment).toEqual({ abstain: true, reason: 'No usable information at asOf.' });
  });

  it('boundary allocations 0 and 1 are accepted without adjustment', () => {
    const r = runForecast(
      withJudgment({
        ...judgmentBinary(),
        range: undefined,
        probabilities: [
          { outcomeId: 'yes', p: 1 },
          { outcomeId: 'no', p: 0 },
        ],
      })
    );
    expect(r.probabilities).toEqual([
      { outcomeId: 'yes', p: 1 },
      { outcomeId: 'no', p: 0 },
    ]);
  });

  it('the subpath validator agrees with runForecast', () => {
    const q = runForecast(byId('v2-judgment-categorical').input).question;
    const v = validateJudgment(judgmentCategorical(), q);
    expect(v.kind).toBe('allocation');
    expect(() => validateJudgment({ ...judgmentCategorical(), evidence: [], assumptions: [] }, q)).toThrow(ForecastValidationError);
    expect(permitQuestion().outcomes.map((o) => o.id)).toEqual(q.outcomes.map((o) => o.id));
  });
});

describe('judgment: rejected without normalization', () => {
  it('neither evidence nor labeled assumptions → judgment_basis_missing', () => {
    const { evidence: _e, ...noBasis } = judgmentBinary();
    expectCode(() => runForecast(withJudgment(noBasis)), 'judgment_basis_missing');
    expectCode(() => runForecast(withJudgment({ ...judgmentBinary(), evidence: [], assumptions: [] })), 'judgment_basis_missing');
  });

  it('missing or empty rationale, counterarguments, or uncertainty fail', () => {
    for (const key of ['rationale', 'counterarguments', 'uncertainty'] as const) {
      const missing = { ...judgmentBinary() } as Record<string, unknown>;
      delete missing[key];
      expectCode(() => runForecast(withJudgment(missing)), 'invalid_input');
    }
    expectCode(() => runForecast(withJudgment({ ...judgmentBinary(), rationale: '  ' })), 'invalid_judgment');
    expectCode(() => runForecast(withJudgment({ ...judgmentBinary(), counterarguments: [] })), 'invalid_input');
    expectCode(() => runForecast(withJudgment({ ...judgmentBinary(), counterarguments: [''] })), 'invalid_judgment');
    expectCode(() => runForecast(withJudgment({ ...judgmentBinary(), uncertainty: '' })), 'invalid_judgment');
  });

  const probs = (yes: unknown, no: unknown) => ({
    ...judgmentBinary(),
    range: undefined,
    probabilities: [
      { outcomeId: 'yes', p: yes },
      { outcomeId: 'no', p: no },
    ],
  });

  it('NaN, out-of-range, and precision violations fail', () => {
    expectCode(() => runForecast(withJudgment(probs(NaN, 0.29))), 'invalid_distribution');
    expectCode(() => runForecast(withJudgment(probs(1.2, -0.2))), 'invalid_distribution');
    expectCode(() => runForecast(withJudgment(probs(0.7100001, 0.2899999))), 'invalid_distribution');
    expectCode(() => runForecast(withJudgment(probs('0.71', 0.29))), 'invalid_distribution');
  });

  it('sum errors fail and are never normalized', () => {
    expectCode(() => runForecast(withJudgment(probs(0.7, 0.29))), 'invalid_distribution');
    expectCode(() => runForecast(withJudgment(probs(0.5, 0.500001))), 'invalid_distribution');
    expectCode(() => runForecast(withJudgment(probs(1.4, 0.6))), 'invalid_distribution');
  });

  it('duplicate, unknown, and missing outcome classes fail', () => {
    const dup = { ...judgmentBinary(), probabilities: [{ outcomeId: 'yes', p: 0.5 }, { outcomeId: 'yes', p: 0.5 }] };
    expectCode(() => runForecast(withJudgment(dup)), 'invalid_distribution');
    const unknown = { ...judgmentBinary(), probabilities: [{ outcomeId: 'yes', p: 0.5 }, { outcomeId: 'maybe', p: 0.5 }] };
    expectCode(() => runForecast(withJudgment(unknown)), 'invalid_distribution');
    const missing = { ...judgmentCategorical(), probabilities: [{ outcomeId: 'approved', p: 0.6 }, { outcomeId: 'pending', p: 0.4 }] };
    expectCode(() => runForecast(withJudgment(missing, 'v2-judgment-categorical')), 'invalid_distribution');
  });

  it('invalid ranges fail: not enclosing YES, zero-width, out of [0,1], or on a categorical question', () => {
    const range = (low: number, high: number) => ({ ...judgmentBinary(), range: { low, high, rationale: 'r' } });
    expectCode(() => runForecast(withJudgment(range(0.72, 0.8))), 'invalid_range');
    expectCode(() => runForecast(withJudgment(range(0.71, 0.71))), 'invalid_range');
    expectCode(() => runForecast(withJudgment(range(0.6, 1.2))), 'invalid_range');
    expectCode(() => runForecast(withJudgment(range(0.8, 0.6))), 'invalid_range');
    expectCode(
      () => runForecast(withJudgment({ ...judgmentCategorical(), range: { low: 0.5, high: 0.7, rationale: 'r' } }, 'v2-judgment-categorical')),
      'invalid_range'
    );
    expectCode(() => runForecast(withJudgment({ ...judgmentBinary(), range: { low: 0.6, high: 0.8, rationale: '' } })), 'invalid_range');
  });

  it('evidence citations and ids are structurally checked, never content-checked', () => {
    const badCite = { ...judgmentBinary(), evidence: [{ id: 'e1', statement: 's', source: { url: 'nope', accessedAt: '2026-09-26T11:00:00Z' } }] };
    expectCode(() => runForecast(withJudgment(badCite)), 'missing_citation');
    const dupIds = {
      ...judgmentBinary(),
      evidence: [{ id: 'x', statement: 's', source: cite('s') }],
      assumptions: [{ id: 'x', statement: 'a' }],
    };
    expectCode(() => runForecast(withJudgment(dupIds)), 'invalid_judgment');
  });

  it('abstention form is closed and explicit', () => {
    expectCode(() => runForecast(withJudgment({ abstain: false, reason: 'x' })), 'invalid_judgment');
    expectCode(() => runForecast(withJudgment({ abstain: true, reason: 'x', probabilities: [] })), 'unknown_field');
    expectCode(() => runForecast(withJudgment({ abstain: true, reason: ' ' })), 'invalid_judgment');
  });
});
