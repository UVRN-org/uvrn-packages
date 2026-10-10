import { readFileSync } from 'fs';
import { join } from 'path';
import { canonicalize } from '@uvrn/receipt/canonical';
import {
  LEGACY_PROBABILITY_ORIGIN,
  PACKAGE_VERSION,
  PROBABILITY_ORIGIN,
  ProbabilityInputError,
  computeProbabilityHash,
  runProbability,
  verifyProbabilityReceipt,
  type ProbabilityRunInput,
} from '../src';
import { SPEC_KEYS, vectorCases } from './fixtures';

const byId = (id: string) => vectorCases().find((c) => c.id === id)!;

function numbersIn(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => numbersIn(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => numbersIn(v, out));
  return out;
}

describe('runProbability', () => {
  it('is deterministic: two runs are byte-identical under JCS', () => {
    for (const c of vectorCases()) {
      const a = canonicalize(runProbability(c.input, c.options));
      const b = canonicalize(runProbability(JSON.parse(JSON.stringify(c.input)), c.options));
      expect(a).toBe(b);
    }
  });

  it('never reads the clock or randomness', () => {
    const now = jest.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Date.now called');
    });
    const random = jest.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random called');
    });
    try {
      for (const c of vectorCases()) expect(() => runProbability(c.input, c.options)).not.toThrow();
    } finally {
      now.mockRestore();
      random.mockRestore();
    }
  });

  it('emits no computed number with more than 6 decimals', () => {
    for (const c of vectorCases()) {
      const r = runProbability(c.input, c.options);
      const computed = numbersIn({ p: r.p, low: r.low, high: r.high, inputs: r.inputs });
      for (const n of computed) expect(Math.round(n * 1e6) / 1e6).toBe(n);
    }
  });

  it('applies precedence and reports both candidates', () => {
    const r = runProbability(byId('market-wins-over-baserate').input);
    expect(r.method).toBe('market');
    const statuses = r.inputs.filter((i) => i.role === 'market' || i.role === 'baserate').map((i) => [i.role, i.status]);
    expect(statuses).toEqual([
      ['market', 'selected'],
      ['baserate', 'not-selected'],
    ]);
    const fallback = runProbability(byId('stale-market-falls-back-to-baserate').input);
    expect(fallback.method).toBe('baserate');
    expect(fallback.refusals.map((x) => x.code)).toEqual(['market_quote_stale']);
  });

  it('insufficient_basis carries null numbers, refusals, and no desk source', () => {
    const r = runProbability(byId('no-candidate').input);
    expect(r).toMatchObject({ method: 'insufficient_basis', p: null, low: null, high: null, source: null });
    expect(r.refusals.map((x) => x.code)).toEqual(['no_candidate']);
    expect(r.receipt.narrative).toContain('insufficient basis');
  });

  it('projects a UCUM "1" probability source, never a V-Score', () => {
    const r = runProbability(byId('exchange-binary').input);
    expect(r.source).toEqual({
      value: 0.62,
      unit: '1',
      quantityKind: 'probability',
      origin: LEGACY_PROBABILITY_ORIGIN,
      measuredAt: '2026-09-26T19:00:00.000Z',
      obsStatus: 'F',
      codeLists: { ucum: 'ucum-2.1', clObsStatus: 'sdmx-2.1/CL_OBS_STATUS' },
      receiptHash: r.receipt.receiptHash,
    });
    expect(JSON.stringify(r)).not.toMatch(/vScore|v_score/);
  });

  it('pins the current origin to package.json version', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    expect(PACKAGE_VERSION).toBe(pkg.version);
    expect(PROBABILITY_ORIGIN).toBe(`model:@uvrn/probability@${pkg.version}`);
  });

  it('pins the legacy compatibility emitter to the 0.1.0 origin', () => {
    expect(LEGACY_PROBABILITY_ORIGIN).toBe('model:@uvrn/probability@0.1.0');
    for (const c of vectorCases()) expect(runProbability(c.input, c.options).origin).toBe(LEGACY_PROBABILITY_ORIGIN);
  });

  it('throws only when the output cannot be bound to a question or an instant', () => {
    const input = byId('exchange-binary').input;
    expect(() => runProbability({ ...input, outcome: { outcomeHash: 'nope' } })).toThrow(ProbabilityInputError);
    expect(() => runProbability({ ...input, asOf: { ...input.asOf, at: '2026-09-26T12:00:00' } })).toThrow(
      ProbabilityInputError
    );
  });

  it('turns other input problems into refusals', () => {
    const input = byId('exchange-binary').input;
    const r = runProbability({ ...input, specVersion: 'v0' } as unknown as ProbabilityRunInput);
    expect(r.method).toBe('insufficient_basis');
    expect(r.refusals.map((x) => x.code)).toEqual(['invalid_input']);
    const noCite = runProbability({ ...input, asOf: { at: input.asOf.at } } as unknown as ProbabilityRunInput);
    expect(noCite.refusals.map((x) => x.code)).toEqual(['missing_citation']);
    const badThreshold = runProbability({ ...input, thresholds: { minCases: -1 } });
    expect(badThreshold.refusals.map((x) => x.code)).toEqual(['invalid_input']);
  });

  it('records threshold overrides in inputs', () => {
    const input = byId('exchange-binary').input;
    const r = runProbability({ ...input, thresholds: { maxExchangeSpread: 0.1 } });
    const t = r.inputs.find((i) => i.role === 'thresholds')!;
    expect(t).toMatchObject({ provisional: true, overridden: ['maxExchangeSpread'] });
    expect((t.values as Record<string, number>).maxExchangeSpread).toBe(0.1);
  });
});

describe('receipt', () => {
  it('unsigned receipts are integrity-checked only, never verified', () => {
    const r = runProbability(byId('exchange-binary').input);
    const v = verifyProbabilityReceipt(r.receipt);
    expect(v).toMatchObject({ integrityOk: true, probabilityHashOk: true, signed: false, verified: false });
  });

  it('signed receipts verify with the producer key', () => {
    const c = byId('signed-exchange-binary');
    const r = runProbability(c.input, c.options);
    expect(r.receipt.kind).toBe('probability');
    expect(r.receipt.occurredAt).toBe(r.asOf);
    expect(verifyProbabilityReceipt(r.receipt, { publicKey: SPEC_KEYS.publicKey })).toMatchObject({
      verified: true,
      integrityOk: true,
      signatureOk: true,
      probabilityHashOk: true,
    });
    expect(JSON.stringify(r)).not.toContain(SPEC_KEYS.privateKeySeed);
  });

  it('detects tampering with the probability', () => {
    const c = byId('signed-exchange-binary');
    const r = runProbability(c.input, c.options);
    const tampered = { ...r.receipt, payload: { ...r.receipt.payload, p: 0.99 } };
    const v = verifyProbabilityReceipt(tampered, { publicKey: SPEC_KEYS.publicKey });
    expect(v.verified).toBe(false);
    expect(v.integrityOk).toBe(false);
    expect(v.probabilityHashOk).toBe(false);
  });

  it('the probability hash covers exactly the declared field list', () => {
    const r = runProbability(byId('exchange-binary').input);
    const payload = r.receipt.payload as Record<string, unknown>;
    expect(computeProbabilityHash({ ...payload, extra: 'ignored' })).toBe(r.probabilityHash);
    const { refusals: _omit, ...missing } = payload;
    expect(() => computeProbabilityHash(missing)).toThrow(/refusals/);
  });
});
