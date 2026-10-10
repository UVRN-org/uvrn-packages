import { canonicalize } from '@uvrn/receipt/canonical';
import {
  FORECAST_HASH_FIELDS,
  FORECAST_REFUSAL_CODES,
  ForecastValidationError,
  FORECAST_V2_ORIGIN,
  LIMITATION_RECEIPT,
  computeForecastHash,
  computeQuestionHash,
  runForecast,
  verifyForecastReceipt,
  type ForecastInput,
  type ForecastResult,
} from '../src';
import { exchangeBinary, sportsbookTwoWay } from './fixtures';
import {
  SPEC_KEYS,
  agentProducer,
  binaryQuestion,
  cite,
  judgmentBinary,
  permitQuestion,
  vectorCasesV2,
  yesDeclaration,
} from './fixtures-v2';

const byId = (id: string) => vectorCasesV2().find((c) => c.id === id)!;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function expectValidationError(fn: () => unknown, code: string, path?: string | RegExp): ForecastValidationError {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ForecastValidationError);
  const e = caught as ForecastValidationError;
  expect(e.code).toBe(code);
  if (typeof path === 'string') expect(e.path).toBe(path);
  else if (path) expect(e.path).toMatch(path);
  return e;
}

function numbersIn(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => numbersIn(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => numbersIn(v, out));
  return out;
}

describe('runForecast: records and receipts', () => {
  it('every valid vector input returns a receipted uvrn-probability-2 record', () => {
    for (const c of vectorCasesV2()) {
      const r = runForecast(c.input, c.options);
      expect(r.specVersion).toBe('uvrn-probability-2');
      expect(r.origin).toBe(FORECAST_V2_ORIGIN);
      expect(r.receipt.kind).toBe('probability');
      expect(r.receipt.action).toBe('probability.forecast');
      expect(r.receipt.occurredAt).toBe(r.asOf);
      expect(r.receipt.receiptHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(verifyForecastReceipt(r.receipt).integrityOk).toBe(true);
      expect(r.limitations).toContain(LIMITATION_RECEIPT);
      for (const x of r.refusals) expect(FORECAST_REFUSAL_CODES).toContain(x.code);
      if (r.status === 'insufficient_basis') {
        expect(r.refusals.length).toBeGreaterThan(0);
        expect(r.probabilities).toBeNull();
        expect(r.basis).toBeNull();
        expect(r.band).toBeNull();
      } else {
        expect(r.refusals).toEqual([]);
      }
    }
  });

  it('carries unit "1" and quantityKind "probability", both inside the hashed field list', () => {
    expect(FORECAST_HASH_FIELDS).toEqual(expect.arrayContaining(['unit', 'quantityKind', 'questionHash']));
    for (const c of vectorCasesV2()) {
      const r = runForecast(c.input, c.options);
      expect(r.unit).toBe('1');
      expect(r.quantityKind).toBe('probability');
      const payload = r.receipt.payload as Record<string, unknown>;
      expect(computeForecastHash({ ...payload, unit: 'prob' })).not.toBe(r.probabilityHash);
      expect(computeForecastHash({ ...payload, quantityKind: 'chance' })).not.toBe(r.probabilityHash);
    }
  });

  it('valid abstention and insufficient_basis requests produce receipts', () => {
    for (const id of ['v2-judgment-abstain', 'v2-market-deadline-mismatch', 'v2-baserate-interval-unavailable']) {
      const r = runForecast(byId(id).input);
      expect(r.status).toBe('insufficient_basis');
      expect(r.receipt.receiptHash).toMatch(/^sha256:/);
      expect(r.receipt.narrative).toContain('insufficient basis');
      expect(verifyForecastReceipt(r.receipt)).toMatchObject({ integrityOk: true, probabilityHashOk: true, verified: false });
    }
  });

  it('malformed requests throw typed validation errors and return no record', () => {
    const input = byId('v2-judgment-binary').input;
    let result: ForecastResult | undefined;
    expect(() => {
      result = runForecast({ ...input, surprise: 1 } as unknown as ForecastInput);
    }).toThrow(ForecastValidationError);
    expect(result).toBeUndefined();
  });

  it('is deterministic, never reads the clock or randomness, and rounds to 6 decimals', () => {
    const now = jest.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Date.now called');
    });
    const random = jest.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random called');
    });
    try {
      for (const c of vectorCasesV2()) {
        const a = canonicalize(runForecast(c.input, c.options));
        const b = canonicalize(runForecast(clone(c.input), c.options));
        expect(a).toBe(b);
        const r = runForecast(c.input, c.options);
        for (const n of numbersIn({ probabilities: r.probabilities, band: r.band, inputs: r.inputs })) {
          expect(Math.round(n * 1e6) / 1e6).toBe(n);
        }
      }
    } finally {
      now.mockRestore();
      random.mockRestore();
    }
  });

  it('calculated binary modes emit YES p and its exact millionth complement, no scalar p', () => {
    const r = runForecast(byId('v2-market-sportsbook').input);
    expect(r.probabilities).toEqual([
      { outcomeId: 'yes', p: 0.583983 },
      { outcomeId: 'no', p: 0.416017 },
    ]);
    expect(Math.round(r.probabilities![0].p * 1e6) + Math.round(r.probabilities![1].p * 1e6)).toBe(1_000_000);
    expect(r).not.toHaveProperty('p');
    expect(r).not.toHaveProperty('source');
  });

  it('never leaks the signing key', () => {
    const c = byId('v2-judgment-declaration-revision-signed');
    expect(JSON.stringify(runForecast(c.input, c.options))).not.toContain(SPEC_KEYS.privateKeySeed);
  });
});

describe('identities', () => {
  const judgmentInput = (): ForecastInput => clone(byId('v2-judgment-binary').input);

  it('(a) a probability revision preserves questionHash and changes probabilityHash', () => {
    const original = runForecast(judgmentInput());
    const revisedInput = judgmentInput();
    revisedInput.forecastId = 'fx-judgment-binary-rev-1';
    revisedInput.judgment = {
      ...judgmentBinary(),
      probabilities: [
        { outcomeId: 'yes', p: 0.65 },
        { outcomeId: 'no', p: 0.35 },
      ],
      range: { low: 0.55, high: 0.75, rationale: 'Revised spread.' },
    };
    revisedInput.revision = { previousProbabilityHash: original.probabilityHash, reason: 'New fixture standings read.' };
    const revised = runForecast(revisedInput);
    expect(revised.questionHash).toBe(original.questionHash);
    expect(revised.probabilityHash).not.toBe(original.probabilityHash);
    expect(revised.revision).toEqual({ previousProbabilityHash: original.probabilityHash, reason: 'New fixture standings read.' });
  });

  it('(b) a question edit, including a typo fix, changes questionHash', () => {
    const base = runForecast(judgmentInput()).questionHash;
    const typo = judgmentInput();
    typo.question.text = typo.question.text.replace('series', 'seires');
    expect(runForecast(typo).questionHash).not.toBe(base);
    const rule = judgmentInput();
    rule.question.resolutionRule += ' Ties resolve NO.';
    expect(runForecast(rule).questionHash).not.toBe(base);
    const def = judgmentInput();
    def.question.outcomes[1].definition = 'Example Home is not listed as winner.';
    expect(runForecast(def).questionHash).not.toBe(base);
    const deadline = judgmentInput();
    deadline.question.resolveBy = '2026-10-31';
    expect(runForecast(deadline).questionHash).not.toBe(base);
    const inner = judgmentInput();
    inner.question.text = inner.question.text.replace('Example Home', 'Example  Home');
    expect(runForecast(inner).questionHash).not.toBe(base);
  });

  it('(c) adding a declaration binding changes probabilityHash but not questionHash', () => {
    const plain = runForecast(judgmentInput());
    const bound = judgmentInput();
    bound.question.outcomes[0] = { ...bound.question.outcomes[0], outcomeDeclaration: yesDeclaration() };
    const r = runForecast(bound);
    expect(r.questionHash).toBe(plain.questionHash);
    expect(r.probabilityHash).not.toBe(plain.probabilityHash);
    expect(r.question.outcomes[0].outcomeDeclaration).toEqual(yesDeclaration());
    expect(plain.question.outcomes[0].outcomeDeclaration).toBeNull();
  });

  it('(d) NFC-equivalent and outer-whitespace variants yield the same questionHash; the record keeps the supplied text', () => {
    const composed = judgmentInput();
    composed.question.text = 'Will the caf\u00e9 fixture open?';
    const decomposed = judgmentInput();
    decomposed.question.text = '  Will the cafe\u0301 fixture open?\n';
    const a = runForecast(composed);
    const b = runForecast(decomposed);
    expect(a.questionHash).toBe(b.questionHash);
    expect(b.question.text).toBe('  Will the cafe\u0301 fixture open?\n');
    expect(a.probabilityHash).not.toBe(b.probabilityHash);
    const cased = judgmentInput();
    cased.question.text = 'will the caf\u00e9 fixture open?';
    expect(runForecast(cased).questionHash).not.toBe(a.questionHash);
  });

  it('questionHash excludes producer, asOf, probabilities, forecastId, and partition attestation', () => {
    const base = runForecast(judgmentInput()).questionHash;
    const other = judgmentInput();
    other.producer = { id: 'someone-else', kind: 'human' };
    other.forecastId = 'another-id';
    other.asOf = { at: '2026-09-27T08:00:00Z', source: cite('other-clock') };
    other.judgment = judgmentBinary();
    (other.judgment as { probabilities: Array<{ outcomeId: string; p: number }> }).probabilities = [
      { outcomeId: 'yes', p: 0.7 },
      { outcomeId: 'no', p: 0.3 },
    ];
    expect(runForecast(other).questionHash).toBe(base);
    expect(computeQuestionHash(binaryQuestion())).toBe(base);
  });

  it('(e) a retry with the same forecastId, identical inputs, and the same signer is byte-identical', () => {
    const c = byId('v2-judgment-declaration-revision-signed');
    const first = runForecast(clone(c.input), c.options);
    const retry = runForecast(clone(c.input), c.options);
    expect(canonicalize(retry)).toBe(canonicalize(first));
    expect(retry.receipt.signature).toEqual(first.receipt.signature);
    expect(retry.forecastId).toBe(c.input.forecastId);
  });

  it('forecastId is passed through unchanged, never generated', () => {
    const input = judgmentInput();
    input.forecastId = '  Host-ID/0001  ';
    expect(runForecast(input).forecastId).toBe('  Host-ID/0001  ');
  });
});

describe('modes: attribution and independence', () => {
  it('different modes on the same research carry their own mode, basis, and producer and never read each other', () => {
    const question = binaryQuestion('2026-11-04');
    const shared = {
      specVersion: 'uvrn-probability-input-2' as const,
      asOf: { at: '2026-09-26T12:00:00-07:00', source: cite('asof-clock-note') },
      question,
    };
    const market = runForecast({
      ...shared,
      forecastId: 'same-research-market',
      mode: 'market',
      producer: { id: 'desk-agent', kind: 'agent' },
      market: exchangeBinary(),
    });
    const judgment = runForecast({
      ...shared,
      forecastId: 'same-research-judgment',
      mode: 'judgment',
      producer: { id: 'analyst-1', kind: 'human' },
      judgment: {
        ...judgmentBinary(),
        range: undefined,
        rationale: 'Anchored on the fixture market, discounted for thin schedule information.',
      } as never,
    });
    expect(market.questionHash).toBe(judgment.questionHash);
    expect(market).toMatchObject({ mode: 'market', basis: 'market-implied', producer: { id: 'desk-agent', kind: 'agent', model: null } });
    expect(judgment).toMatchObject({ mode: 'judgment', basis: 'agent-judgment', producer: { id: 'analyst-1', kind: 'human', model: null } });
    expect(market.inputs.judgment).toBeNull();
    expect(market.inputs.baserate).toBeNull();
    expect(judgment.inputs.market).toBeNull();
    expect(judgment.inputs.thresholds).toBeNull();
    expect(market.receipt.tags).toContain('mode:market');
    expect(judgment.receipt.tags).toContain('mode:judgment');

    const changedMarket = runForecast({
      ...shared,
      forecastId: 'same-research-market',
      mode: 'market',
      producer: { id: 'desk-agent', kind: 'agent' },
      market: exchangeBinary({ bid: 0.4, ask: 0.42 }),
    });
    expect(changedMarket.probabilities).not.toEqual(market.probabilities);
    const judgmentAgain = runForecast({
      ...shared,
      forecastId: 'same-research-judgment',
      mode: 'judgment',
      producer: { id: 'analyst-1', kind: 'human' },
      judgment: { ...judgmentBinary(), range: undefined, rationale: 'Anchored on the fixture market, discounted for thin schedule information.' } as never,
    });
    expect(judgmentAgain.probabilityHash).toBe(judgment.probabilityHash);
  });

  it('band kinds differ by source; only statistical intervals carry 0.95', () => {
    const kinds = Object.fromEntries(
      ['v2-market-sportsbook', 'v2-market-exchange-settles-later', 'v2-baserate-proportion', 'v2-judgment-binary', 'v2-judgment-assumption-only'].map(
        (id) => [id, runForecast(byId(id).input).band]
      )
    );
    expect(kinds['v2-market-sportsbook']).toMatchObject({ outcomeId: 'yes', kind: 'method-spread', confidence: null });
    expect(kinds['v2-market-exchange-settles-later']).toMatchObject({ outcomeId: 'yes', kind: 'bid-ask', confidence: null, low: 0.61, high: 0.63 });
    expect(kinds['v2-baserate-proportion']).toMatchObject({ outcomeId: 'yes', kind: 'statistical', confidence: 0.95 });
    expect(kinds['v2-judgment-binary']).toEqual({ outcomeId: 'yes', low: 0.6, high: 0.8, kind: 'subjective', confidence: null });
    expect(kinds['v2-judgment-assumption-only']).toBeNull();
  });
});

describe('deadline matching (event cutoff, not settlement)', () => {
  it('a market whose event cutoff is one day off the question deadline refuses', () => {
    for (const resolveBy of ['2026-11-03', '2026-11-05']) {
      const input = clone(byId('v2-market-exchange-settles-later').input);
      input.question.resolveBy = resolveBy;
      const r = runForecast(input);
      expect(r.status).toBe('insufficient_basis');
      expect(r.refusals.map((x) => x.code)).toEqual(['deadline_mismatch']);
      expect(r.inputs.market).toMatchObject({ deadlineMatched: false, eventCutoffUtcDate: '2026-11-04' });
    }
  });

  it('a market that settles the next day but whose event cutoff matches is accepted', () => {
    const r = runForecast(byId('v2-market-exchange-settles-later').input);
    expect(r.status).toBe('forecast');
    expect(r.inputs.market).toMatchObject({
      resolvesAt: '2026-11-04T00:00:00Z',
      resolvesAtMeaning: 'event-cutoff',
      settlesAt: '2026-11-05',
      deadlineMatched: true,
    });
  });

  it('a time-to-event horizon on a different UTC date than the deadline refuses', () => {
    const input = clone(byId('v2-baserate-competing').input);
    const by = (input.baserate as { horizon: { by: string } }).horizon.by;
    input.question.resolveBy = new Date(Date.parse(`${by}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const r = runForecast(input);
    expect(r.refusals.map((x) => x.code)).toEqual(['deadline_mismatch']);
  });

  it("uses event-cutoff wording for a cutoff at or before asOf", () => {
    const input = clone(byId('v2-market-exchange-settles-later').input);
    input.question.resolveBy = '2026-09-26';
    (input.market as { resolvesAt: string }).resolvesAt = '2026-09-26T18:00:00Z';
    const r = runForecast(input);
    const refusal = r.refusals.find((x) => x.code === 'market_resolves_before_asof')!;
    expect(refusal.message).toContain('event cutoff');
  });
});

describe('typed validation errors (no receipt)', () => {
  const judgment = () => clone(byId('v2-judgment-binary').input);
  const market = () => clone(byId('v2-market-sportsbook').input);

  it('unknown versions, including the legacy input, fail explicitly', () => {
    expectValidationError(() => runForecast({ ...judgment(), specVersion: 'uvrn-probability-input-unsupported' } as never), 'unsupported_version', 'specVersion');
    const e = expectValidationError(() => runForecast({ ...judgment(), specVersion: 'uvrn-probability-input-1' } as never), 'unsupported_version');
    expect(e.message).toContain('runProbability');
  });

  it('unknown fields fail at any depth', () => {
    expectValidationError(() => runForecast({ ...judgment(), extra: true } as never), 'unknown_field', 'input.extra');
    const q = judgment();
    (q.question as unknown as Record<string, unknown>).notes = 'x';
    expectValidationError(() => runForecast(q), 'unknown_field', 'question.notes');
    const m = market();
    (m.market as unknown as Record<string, unknown>).fee = 0.01;
    expectValidationError(() => runForecast(m), 'unknown_field', 'market.fee');
    const c = market();
    (c.asOf.source as unknown as Record<string, unknown>).note = 'x';
    expectValidationError(() => runForecast(c), 'unknown_field', 'asOf.source.note');
  });

  it('mixed-mode input and a missing mode input fail; there is no fallback', () => {
    expectValidationError(() => runForecast({ ...market(), judgment: judgmentBinary() } as never), 'mixed_mode_input', 'judgment');
    const { market: _m, ...noMarket } = market();
    expectValidationError(() => runForecast(noMarket as never), 'invalid_input', 'market');
    expectValidationError(() => runForecast({ ...judgment(), mode: 'blend' } as never), 'invalid_input', 'mode');
  });

  it('categorical calculated requests fail with unsupported_mode_for_question', () => {
    expectValidationError(
      () => runForecast({ ...market(), question: permitQuestion() } as never),
      'unsupported_mode_for_question'
    );
    const br = clone(byId('v2-baserate-proportion').input);
    expectValidationError(() => runForecast({ ...br, question: permitQuestion() }), 'unsupported_mode_for_question');
  });

  it('question structure: definitions, partition, binary ids, dates', () => {
    const noDef = judgment();
    delete (noDef.question.outcomes[1] as Partial<(typeof noDef.question.outcomes)[number]>).definition;
    expectValidationError(() => runForecast(noDef), 'invalid_input', 'question.outcomes[1].definition');
    const emptyDef = judgment();
    emptyDef.question.outcomes[1].definition = '   ';
    expectValidationError(() => runForecast(emptyDef), 'invalid_question', 'question.outcomes[1].definition');
    const partition = judgment();
    (partition.question as unknown as Record<string, unknown>).partitionConfirmed = false;
    expectValidationError(() => runForecast(partition), 'invalid_question', 'question.partitionConfirmed');
    const ids = judgment();
    ids.question.outcomes = [ids.question.outcomes[1], ids.question.outcomes[0]];
    expectValidationError(() => runForecast(ids), 'invalid_question', 'question.outcomes');
    const dup = clone(byId('v2-judgment-categorical').input);
    dup.question.outcomes[2].id = 'approved';
    expectValidationError(() => runForecast(dup), 'invalid_question', 'question.outcomes[2].id');
    const past = judgment();
    past.question.resolveBy = '2026-09-25';
    expectValidationError(() => runForecast(past), 'invalid_question', 'question.resolveBy');
    const badDate = judgment();
    badDate.question.resolveBy = '2026-02-30';
    expectValidationError(() => runForecast(badDate), 'invalid_question', 'question.resolveBy');
    const sameDay = judgment();
    sameDay.question.resolveBy = '2026-09-26';
    expect(runForecast(sameDay).status).toBe('forecast');
  });

  it('outcome-declaration bindings must recompute and share the deadline', () => {
    const bad = judgment();
    bad.question.outcomes[0] = { ...bad.question.outcomes[0], outcomeDeclaration: { ...yesDeclaration(), entryId: 'edited-after' } };
    expectValidationError(() => runForecast(bad), 'outcome_declaration_mismatch', 'question.outcomes[0].outcomeDeclaration.outcomeHash');
    const otherDate = judgment();
    otherDate.question.outcomes[0] = { ...otherDate.question.outcomes[0], outcomeDeclaration: yesDeclaration('2026-10-29') };
    expectValidationError(() => runForecast(otherDate), 'outcome_declaration_mismatch', 'question.outcomes[0].outcomeDeclaration.resolveBy');
    const extra = judgment();
    extra.question.outcomes[0] = {
      ...extra.question.outcomes[0],
      outcomeDeclaration: { ...yesDeclaration(), outcomeStatus: 'pending' } as never,
    };
    expectValidationError(() => runForecast(extra), 'unknown_field');
  });

  it('asOf, producer, forecastId, revision, and citations are validated', () => {
    const zone = judgment();
    zone.asOf.at = '2026-09-26T12:00:00';
    expectValidationError(() => runForecast(zone), 'invalid_input', 'asOf.at');
    const cite0 = judgment();
    (cite0.asOf as unknown as Record<string, unknown>).source = { url: 'ftp://example.org', accessedAt: '2026-09-26T11:00:00Z' };
    expectValidationError(() => runForecast(cite0), 'missing_citation', 'asOf.source');
    expectValidationError(() => runForecast({ ...judgment(), forecastId: ' ' }), 'invalid_input', 'forecastId');
    expectValidationError(() => runForecast({ ...judgment(), producer: { id: 'x', kind: 'robot' } } as never), 'invalid_input', 'producer.kind');
    expectValidationError(
      () => runForecast({ ...judgment(), revision: { previousProbabilityHash: 'sha256:abc', reason: 'x' } }),
      'invalid_revision',
      'revision.previousProbabilityHash'
    );
    expectValidationError(
      () => runForecast({ ...judgment(), revision: { previousProbabilityHash: `sha256:${'a'.repeat(64)}`, reason: '' } }),
      'invalid_revision',
      'revision.reason'
    );
    const mk = market();
    (mk.market!.outcomes[0] as unknown as Record<string, unknown>).source = {};
    expectValidationError(() => runForecast(mk), 'missing_citation', 'market.outcomes[0].source');
    const absent = market();
    delete (absent.market!.outcomes[0] as unknown as Record<string, unknown>).source;
    expectValidationError(() => runForecast(absent), 'invalid_input', 'market.outcomes[0].source');
    const target = market();
    target.market!.targetOutcome = 'Nobody';
    expectValidationError(() => runForecast(target), 'invalid_input', 'market.targetOutcome');
  });

  it('thresholds apply to calculated modes only', () => {
    expectValidationError(() => runForecast({ ...judgment(), thresholds: { minCases: 8 } }), 'invalid_threshold', 'thresholds');
    expectValidationError(() => runForecast({ ...market(), thresholds: { maxFee: 1 } } as never), 'unknown_field', 'thresholds.maxFee');
    expectValidationError(() => runForecast({ ...market(), thresholds: { maxExchangeSpread: -0.1 } }), 'invalid_threshold');
    const r = runForecast({ ...market(), thresholds: { maxQuoteStalenessMs: 3_600_000 * 48 } });
    expect(r.inputs.thresholds).toMatchObject({ provisional: true, overridden: ['maxQuoteStalenessMs'] });
  });

  it('messages name paths and rules without echoing input values', () => {
    const j = judgment();
    (j.judgment as { probabilities: Array<{ outcomeId: string; p: number }> }).probabilities[0].p = 0.7123456;
    const e = expectValidationError(() => runForecast(j), 'invalid_distribution');
    expect(e.message).not.toContain('0.7123456');
    const m = market();
    m.market!.targetOutcome = 'secret-target-label';
    expect(expectValidationError(() => runForecast(m), 'invalid_input').message).not.toContain('secret-target-label');
  });

  it('uses the sportsbook fixture unchanged', () => {
    expect(market().market).toEqual(sportsbookTwoWay());
    expect(agentProducer().kind).toBe('agent');
  });
});
