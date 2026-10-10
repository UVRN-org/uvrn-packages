import Ajv2020 from 'ajv/dist/2020';
import { readFileSync } from 'fs';
import { join } from 'path';
import { runForecast } from '../src';
import { judgmentBinary, permitQuestion, profileErrorCasesV2, vectorCasesV2 } from './fixtures-v2';

const SCHEMAS = join(__dirname, '..', '..', 'SPEC', 'schemas');
const load = (name: string) => JSON.parse(readFileSync(join(SCHEMAS, name), 'utf8'));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('SPEC/schemas (version 2)', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validateInput = ajv.compile(load('uvrn-probability-input-2.schema.json'));
  const validateResult = ajv.compile(load('uvrn-probability-result-2.schema.json'));
  const judgment = () => clone(vectorCasesV2().find((c) => c.id === 'v2-judgment-binary')!.input);

  it.each(vectorCasesV2().map((c) => [c.id, c] as const))('%s: input and result conform', (_id, c) => {
    expect(validateInput(c.input) ? null : validateInput.errors).toBeNull();
    const result = JSON.parse(JSON.stringify(runForecast(c.input, c.options)));
    expect(validateResult(result) ? null : validateResult.errors).toBeNull();
  });

  it('rejects the structural failures the implementation rejects', () => {
    expect(validateInput({ ...judgment(), extra: 1 })).toBe(false);
    expect(validateInput({ ...judgment(), market: {} })).toBe(false);
    expect(validateInput({ ...judgment(), thresholds: { minCases: 8 } })).toBe(false);
    expect(validateInput({ ...judgment(), specVersion: 'uvrn-probability-input-1' })).toBe(false);
    const noBasis = judgment();
    noBasis.judgment = { ...judgmentBinary(), evidence: [] };
    expect(validateInput(noBasis)).toBe(false);
    const partition = judgment();
    (partition.question as unknown as Record<string, unknown>).partitionConfirmed = false;
    expect(validateInput(partition)).toBe(false);
    const order = judgment();
    order.question.outcomes = [order.question.outcomes[1], order.question.outcomes[0]];
    expect(validateInput(order)).toBe(false);
    const br = clone(vectorCasesV2().find((c) => c.id === 'v2-baserate-proportion')!.input);
    expect(validateInput({ ...br, thresholds: { minCases: 0 } })).toBe(false);
    expect(validateInput({ ...br, thresholds: { minCases: 2.5 } })).toBe(false);
    expect(validateInput({ ...judgment(), question: permitQuestion(), judgment: { abstain: true, reason: 'x' } })).toBe(true);
  });

  it('timestamp patterns allow at most 3 fractional digits; days-in-month is left to runForecast', () => {
    const at = (value: string) => {
      const input = judgment();
      input.asOf.at = value;
      return validateInput(input);
    };
    for (const ok of ['2026-09-26T12:00:00.9-07:00', '2026-09-26T12:00:00.99-07:00', '2026-09-26T12:00:00.999-07:00']) {
      expect(at(ok)).toBe(true);
    }
    for (const bad of ['2026-09-26T12:00:00.9999-07:00', '2026-09-26T12:00:00.123456789-07:00']) expect(at(bad)).toBe(false);
    const feb30 = judgment();
    feb30.question.resolveBy = '2026-02-30';
    expect(validateInput(feb30)).toBe(true);
    expect(() => runForecast(feb30)).toThrow(expect.objectContaining({ code: 'invalid_question', path: 'question.resolveBy' }));
  });

  it('profile structure: tighten-only bounds and closed members', () => {
    const withProfile = (profile: Record<string, unknown>) => ({
      ...judgment(),
      profile: { specVersion: 'uvrn-probability-profile-1', id: 'p', version: '1', ...profile },
    });
    expect(validateInput(withProfile({ allowedModes: ['judgment'], thresholds: { minCases: 10 }, require: { citedEvidence: true } }))).toBe(true);
    expect(validateInput(withProfile({ thresholds: { minCases: 7 } }))).toBe(false);
    expect(validateInput(withProfile({ thresholds: { maxExchangeSpread: 0.06 } }))).toBe(false);
    expect(validateInput(withProfile({ allowedModes: [] }))).toBe(false);
    expect(validateInput(withProfile({ callback: 'x' }))).toBe(false);
    expect(validateInput(withProfile({ require: { other: true } }))).toBe(false);
    for (const c of profileErrorCasesV2()) expect(validateInput(c.input)).toBe(c.error.code === 'profile_violation');
    const r = JSON.parse(JSON.stringify(runForecast(vectorCasesV2().find((c) => c.id === 'v2-profile-judgment-accepted')!.input)));
    expect(validateResult(r)).toBe(true);
    expect(validateResult({ ...r, profile: null })).toBe(false);
    expect(validateResult({ ...r, profile: { ...r.profile, extra: 1 } })).toBe(false);
  });

  describe('result provenance records are closed and mode-coupled', () => {
    const resultOf = (id: string) => {
      const c = vectorCasesV2().find((v) => v.id === id)!;
      return JSON.parse(JSON.stringify(runForecast(c.input, c.options)));
    };
    const ok = (r: unknown) => expect(validateResult(r) ? null : validateResult.errors).toBeNull();
    const bad = (r: unknown) => expect(validateResult(r)).toBe(false);

    it('an empty judgment record fails on the assumption-only result', () => {
      const r = resultOf('v2-judgment-assumption-only');
      ok(r);
      r.inputs.judgment = {};
      bad(r);
    });

    it('a record for a mode other than the selected one fails', () => {
      const market = resultOf('v2-market-sportsbook');
      const j = resultOf('v2-judgment-binary');
      bad({ ...j, inputs: { ...j.inputs, market: market.inputs.market } });
      bad({ ...j, inputs: { ...j.inputs, judgment: null } });
      bad({ ...j, inputs: { ...j.inputs, thresholds: market.inputs.thresholds } });
      bad({ ...market, mode: 'baserate' });
      bad({ ...market, inputs: { ...market.inputs, thresholds: null } });
      const br = resultOf('v2-baserate-proportion');
      bad({ ...br, inputs: { ...br.inputs, baserate: null } });
      bad({ ...br, basis: 'market-implied' });
      const abstain = resultOf('v2-judgment-abstain');
      bad({ ...abstain, inputs: { ...abstain.inputs, judgment: j.inputs.judgment } });
      bad({ ...j, inputs: { ...j.inputs, judgment: abstain.inputs.judgment } });
    });

    it('missing required provenance fields fail', () => {
      const cases: Array<[string, (r: any) => void]> = [
        ['v2-judgment-binary', (r) => delete r.inputs.judgment.basisLabel],
        ['v2-judgment-binary', (r) => delete r.inputs.judgment.counterarguments],
        ['v2-judgment-binary', (r) => (r.inputs.judgment.basisLabel = 'assumption-only')],
        ['v2-judgment-binary', (r) => (r.inputs.judgment.range = { low: 0.6, high: 0.8 })],
        ['v2-market-sportsbook', (r) => delete r.inputs.market.resolvesAtMeaning],
        ['v2-market-sportsbook', (r) => delete r.inputs.market.eventCutoffInstantUtc],
        ['v2-market-sportsbook', (r) => (r.inputs.market.eventCutoffInstantUtc = '2026-10-30')],
        ['v2-market-sportsbook', (r) => delete r.inputs.market.outcomes[0].odds],
        ['v2-market-sportsbook', (r) => (r.inputs.market.outcomes[0].bid = 0.5)],
        ['v2-market-sportsbook', (r) => (r.inputs.market.extra = 1)],
        ['v2-market-exchange-settles-later', (r) => delete r.inputs.market.outcomes[0].depthUsd],
        ['v2-market-exchange-settles-later', (r) => delete r.inputs.market.settlesAt],
        ['v2-baserate-proportion', (r) => delete r.inputs.baserate.proportion],
        ['v2-baserate-proportion', (r) => (r.inputs.baserate.horizonUtcDate = '2027-01-15')],
        ['v2-baserate-competing', (r) => delete r.inputs.baserate.timeToEvent],
        ['v2-baserate-competing', (r) => delete r.inputs.baserate.minAtRiskRequired],
        ['v2-baserate-competing', (r) => (r.inputs.baserate.timeToEvent.interval = 'jeffreys-degenerate-fallback')],
        ['v2-baserate-competing', (r) => delete r.inputs.asOf.source],
      ];
      for (const [id, mutate] of cases) {
        const r = resultOf(id);
        mutate(r);
        bad(r);
      }
    });

    it('refused market records with submitted prices still conform', () => {
      const sb = clone(vectorCasesV2().find((c) => c.id === 'v2-market-sportsbook')!.input);
      (sb.market!.outcomes[0] as { odds: unknown }).odds = { format: 'decimal', value: 0 };
      ok(JSON.parse(JSON.stringify(runForecast(sb))));
      const ex = clone(vectorCasesV2().find((c) => c.id === 'v2-market-exchange-settles-later')!.input);
      Object.assign(ex.market!.outcomes[0], { bid: 0.7, ask: 0.6 });
      ok(JSON.parse(JSON.stringify(runForecast(ex))));
    });
  });
});
