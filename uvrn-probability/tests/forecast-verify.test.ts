import { computeOutcomeDeclarationHash } from '../src/forecast/question';
import { computeForecastHash, computeQuestionHash, runForecast, runProbability, verifyForecastReceipt } from '../src';
import { vectorCases } from './fixtures';
import { SPEC_KEYS, vectorCasesV2 } from './fixtures-v2';

const byId = (id: string) => vectorCasesV2().find((c) => c.id === id)!;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('verifyForecastReceipt', () => {
  const signedCase = byId('v2-judgment-declaration-revision-signed');
  const signed = () => runForecast(clone(signedCase.input), signedCase.options);

  it('an unsigned record is integrity-checked only, never verified', () => {
    const r = runForecast(byId('v2-judgment-binary').input);
    expect(verifyForecastReceipt(r.receipt)).toMatchObject({
      specVersion: 'uvrn-probability-2',
      integrityOk: true,
      probabilityHashOk: true,
      questionHashOk: true,
      declarationsOk: true,
      signed: false,
      verified: false,
    });
  });

  it('a signed record verifies with the producer key', () => {
    expect(verifyForecastReceipt(signed().receipt, { publicKey: SPEC_KEYS.publicKey })).toMatchObject({
      verified: true,
      signatureOk: true,
      probabilityHashOk: true,
      questionHashOk: true,
      declarationsOk: true,
    });
  });

  it('dispatches version-1 receipts to the legacy verifier', () => {
    const c = vectorCases().find((x) => x.id === 'signed-exchange-binary')!;
    const v1 = runProbability(c.input, c.options);
    expect(verifyForecastReceipt(v1.receipt, { publicKey: SPEC_KEYS.publicKey })).toMatchObject({
      specVersion: 'uvrn-probability-1',
      verified: true,
      probabilityHashOk: true,
      questionHashOk: null,
    });
  });

  it('unknown versions fail clearly', () => {
    const r = signed();
    const forged = { ...r.receipt, payload: { ...r.receipt.payload, specVersion: 'uvrn-probability-9' } };
    const v = verifyForecastReceipt(forged, { publicKey: SPEC_KEYS.publicKey });
    expect(v.verified).toBe(false);
    expect(v.error).toMatch(/^UNSUPPORTED_VERSION/);
  });

  const tampers: Array<[string, (p: Record<string, any>) => void]> = [
    ['producer attribution', (p) => (p.producer.id = 'someone-else')],
    ['producer model', (p) => (p.producer.model = 'other-model')],
    ['probabilities', (p) => (p.probabilities = [{ outcomeId: 'yes', p: 0.72 }, { outcomeId: 'no', p: 0.28 }])],
    ['question text', (p) => (p.question.text = `${p.question.text}!`)],
    ['question definition', (p) => (p.question.outcomes[1].definition = 'edited')],
    ['assumptions', (p) => (p.inputs.judgment.assumptions = [{ id: 'z', statement: 'added later' }])],
    ['evidence', (p) => (p.inputs.judgment.evidence[0].statement = 'edited')],
    ['rationale', (p) => (p.inputs.judgment.rationale = 'edited')],
    ['counterarguments', (p) => (p.inputs.judgment.counterarguments = [])],
    ['uncertainty', (p) => (p.inputs.judgment.uncertainty = 'edited')],
    ['range', (p) => (p.band.low = 0.5)],
    ['declaration binding', (p) => (p.question.outcomes[0].outcomeDeclaration = null)],
    ['revision', (p) => (p.revision = null)],
    ['forecastId', (p) => (p.forecastId = 'other')],
    ['basis label', (p) => (p.inputs.judgment.basisLabel = 'assumption-only')],
  ];

  it.each(tampers)('tampering with %s invalidates the inner hash and verification', (_name, mutate) => {
    const r = signed();
    const payload = clone(r.receipt.payload) as Record<string, any>;
    mutate(payload);
    expect(computeForecastHash(payload)).not.toBe(r.probabilityHash);
    const v = verifyForecastReceipt({ ...r.receipt, payload }, { publicKey: SPEC_KEYS.publicKey });
    expect(v.verified).toBe(false);
    expect(v.probabilityHashOk).toBe(false);
  });

  it('a recomputed inner hash still fails when questionHash or a declaration no longer recomputes', () => {
    const r = signed();
    const q = clone(r.receipt.payload) as Record<string, any>;
    q.question.text = 'Rewritten question';
    q.probabilityHash = computeForecastHash(q);
    expect(verifyForecastReceipt({ ...r.receipt, payload: q })).toMatchObject({ probabilityHashOk: true, questionHashOk: false, verified: false });

    const d = clone(r.receipt.payload) as Record<string, any>;
    d.question.outcomes[0].outcomeDeclaration.entryId = 'rebound';
    d.probabilityHash = computeForecastHash(d);
    expect(computeQuestionHash(d.question)).toBe(d.questionHash);
    expect(computeOutcomeDeclarationHash(d.question.outcomes[0].outcomeDeclaration)).not.toBe(
      d.question.outcomes[0].outcomeDeclaration.outcomeHash
    );
    expect(verifyForecastReceipt({ ...r.receipt, payload: d })).toMatchObject({ declarationsOk: false, verified: false });
  });

  it('the inner hash covers exactly the declared field list', () => {
    const r = signed();
    const payload = r.receipt.payload as Record<string, unknown>;
    expect(computeForecastHash({ ...payload, extra: 'ignored' })).toBe(r.probabilityHash);
    const { revision: _omit, ...missing } = payload;
    expect(() => computeForecastHash(missing)).toThrow(/revision/);
  });
});
