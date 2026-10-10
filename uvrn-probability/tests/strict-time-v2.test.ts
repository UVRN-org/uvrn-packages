import { ForecastValidationError, runForecast, type ForecastInput } from '../src';
import { isStrictCalendarDate, isStrictZoned } from '../src/common/strict';
import { parseDateOrZoned, parseZoned } from '../src/common/time';
import { vectorCasesV2 } from './fixtures-v2';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const byId = (id: string): ForecastInput => clone(vectorCasesV2().find((c) => c.id === id)!.input);

describe('strict version-2 calendar validation', () => {
  it.each([
    ['2026-02-28T12:00:00Z', true],
    ['2028-02-29T00:00:00Z', true],
    ['2026-02-29T00:00:00Z', false],
    ['2026-02-30T12:00:00Z', false],
    ['2026-04-31T00:00:00+05:00', false],
    ['2026-04-30T00:00:00+05:00', true],
    ['2026-01-01T24:00:00Z', false],
    ['2026-01-01T23:60:00Z', false],
    ['2026-01-01T23:59:60Z', false],
    ['2026-01-01T23:59:59.9Z', true],
    ['2026-01-01T23:59:59.99Z', true],
    ['2026-01-01T23:59:59.999Z', true],
    ['2026-01-01T23:59:59.9999Z', false],
    ['2026-01-01T23:59:59.999999999Z', false],
    ['2026-01-01T23:59:59.Z', false],
    ['2026-01-01T23:59Z', true],
    ['2026-13-01T00:00:00Z', false],
    ['2026-00-10T00:00:00Z', false],
    ['2026-01-00T00:00:00Z', false],
    ['2026-01-01T00:00:00+05:00', true],
    ['2026-01-01T00:00:00-23:59', true],
    ['2026-01-01T00:00:00+24:00', false],
    ['2026-01-01T00:00:00+05:60', false],
    ['1900-02-29T00:00:00Z', false],
    ['2000-02-29T00:00:00Z', true],
    ['2026-01-01', false],
    ['2026-01-01T00:00:00', false],
  ])('zoned %s → %p', (value, ok) => {
    expect(isStrictZoned(value)).toBe(ok);
  });

  it.each([
    ['2026-02-28', true],
    ['2028-02-29', true],
    ['2026-02-29', false],
    ['2026-02-30', false],
    ['2026-04-31', false],
    ['2026-13-01', false],
    ['2026-1-01', false],
  ])('date %s → %p', (value, ok) => {
    expect(isStrictCalendarDate(value)).toBe(ok);
  });

  it('the version-1 parser keeps its lenient Date.parse behavior (unchanged)', () => {
    expect(parseZoned('2026-02-30T12:00:00Z')).toBe(Date.parse('2026-03-02T12:00:00Z'));
    expect(parseZoned('2026-01-01T24:00:00Z')).toBe(Date.parse('2026-01-02T00:00:00Z'));
    expect(parseDateOrZoned('2026-02-30')).toBeNull();
    expect(parseZoned('2026-01-01T00:00:00.123456789Z')).toBe(Date.parse('2026-01-01T00:00:00.123Z'));
  });
});

describe('runForecast rejects impossible timestamps at every version-2 boundary', () => {
  type Mutator = (input: ForecastInput, value: string) => void;
  const market = (i: ForecastInput) => i.market as unknown as Record<string, any>;
  const baserate = (i: ForecastInput) => i.baserate as unknown as Record<string, any>;

  const zonedBoundaries: Array<[string, string, Mutator]> = [
    ['asOf.at', 'v2-judgment-binary', (i, v) => (i.asOf.at = v)],
    ['asOf.source.accessedAt', 'v2-judgment-binary', (i, v) => (i.asOf.source.accessedAt = v)],
    ['judgment evidence accessedAt', 'v2-judgment-binary', (i, v) => ((i.judgment as any).evidence[0].source.accessedAt = v)],
    ['declaration declaredAt', 'v2-judgment-declaration-revision-signed', (i, v) => ((i.question.outcomes[0] as any).outcomeDeclaration.declaredAt = v)],
    ['market quotedAt', 'v2-market-sportsbook', (i, v) => (market(i).outcomes[0].quotedAt = v)],
    ['market source accessedAt', 'v2-market-sportsbook', (i, v) => (market(i).source.accessedAt = v)],
    ['reference class accessedAt', 'v2-baserate-proportion', (i, v) => (baserate(i).referenceClass.source.accessedAt = v)],
  ];
  const dateOrZonedBoundaries: Array<[string, string, Mutator]> = [
    ['market resolvesAt', 'v2-market-sportsbook', (i, v) => (market(i).resolvesAt = v)],
    ['market settlesAt', 'v2-market-exchange-settles-later', (i, v) => (market(i).settlesAt = v)],
    ['proportion case resolvedAt', 'v2-baserate-proportion', (i, v) => (baserate(i).cases[0].resolvedAt = v)],
    ['tte case filedAt', 'v2-baserate-competing', (i, v) => (baserate(i).cases[0].filedAt = v)],
    ['tte case statusAt', 'v2-baserate-competing', (i, v) => (baserate(i).cases[0].statusAt = v)],
    ['tte subject.filedAt', 'v2-baserate-competing', (i, v) => (baserate(i).subject.filedAt = v)],
    ['tte horizon.by', 'v2-baserate-competing', (i, v) => (baserate(i).horizon.by = v)],
  ];

  const badZoned = ['2026-02-30T12:00:00Z', '2026-02-29T00:00:00Z', '2026-01-01T24:00:00Z', '2026-04-31T00:00:00+05:00', '2026-01-01T00:00:00+24:00'];
  const badDates = ['2026-02-30', '2026-02-29', '2026-04-31'];

  function expectInvalid(input: ForecastInput, bad: string) {
    let caught: unknown;
    try {
      runForecast(input);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ForecastValidationError);
    const e = caught as ForecastValidationError;
    expect(['invalid_input', 'missing_citation', 'invalid_question']).toContain(e.code);
    expect(e.message).not.toContain(bad);
  }

  it.each(zonedBoundaries)('%s rejects impossible zoned timestamps', (_name, id, mutate) => {
    for (const bad of badZoned) {
      const input = byId(id);
      mutate(input, bad);
      expectInvalid(input, bad);
    }
  });

  it.each(dateOrZonedBoundaries)('%s rejects impossible zoned timestamps and dates', (_name, id, mutate) => {
    for (const bad of [...badZoned, ...badDates]) {
      const input = byId(id);
      mutate(input, bad);
      expectInvalid(input, bad);
    }
  });

  it('asOf with an impossible timestamp throws invalid_input without echoing the value', () => {
    const input = byId('v2-judgment-binary');
    input.asOf.at = '2026-02-30T12:00:00Z';
    expect(() => runForecast(input)).toThrow(expect.objectContaining({ code: 'invalid_input', path: 'asOf.at' }));
  });

  it('question.resolveBy rejects 2026-02-29 and accepts 2028-02-29', () => {
    const bad = byId('v2-judgment-binary');
    bad.question.resolveBy = '2026-02-29';
    expect(() => runForecast(bad)).toThrow(expect.objectContaining({ code: 'invalid_question', path: 'question.resolveBy' }));
    const ok = byId('v2-judgment-binary');
    ok.question.resolveBy = '2028-02-29';
    expect(runForecast(ok).status).toBe('forecast');
  });

  it('valid non-UTC offsets are accepted', () => {
    const input = byId('v2-judgment-binary');
    input.asOf.at = '2026-09-27T05:00:00+05:00';
    input.asOf.source.accessedAt = '2026-09-26T23:59:59.5-00:30';
    expect(runForecast(input).asOf).toBe('2026-09-27T00:00:00.000Z');
  });
});

function thrown(fn: () => unknown): ForecastValidationError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ForecastValidationError);
    return e as ForecastValidationError;
  }
  throw new Error('expected a ForecastValidationError');
}

describe('millisecond limit: v2 zoned timestamps allow at most 3 fractional digits', () => {
  type Mutator = (input: ForecastInput, value: string) => void;
  const market = (i: ForecastInput) => i.market as unknown as Record<string, any>;
  const baserate = (i: ForecastInput) => i.baserate as unknown as Record<string, any>;

  /** [name, vector, base timestamp (fraction inserted before the offset), mutator, code, path] */
  const boundaries: Array<[string, string, string, Mutator, string, string]> = [
    ['asOf.at', 'v2-judgment-binary', '2026-09-26T12:00:00-07:00', (i, v) => (i.asOf.at = v), 'invalid_input', 'asOf.at'],
    [
      'market quotedAt',
      'v2-market-sportsbook',
      '2026-09-26T10:30:00-07:00',
      (i, v) => (market(i).outcomes[0].quotedAt = v),
      'invalid_input',
      'market.outcomes[0].quotedAt',
    ],
    [
      'citation accessedAt',
      'v2-judgment-binary',
      '2026-09-26T11:00:00-07:00',
      (i, v) => (i.asOf.source.accessedAt = v),
      'missing_citation',
      'asOf.source.accessedAt',
    ],
    [
      'tte case statusAt',
      'v2-baserate-competing',
      '2020-04-10T00:00:00Z',
      (i, v) => (baserate(i).cases[0].statusAt = v),
      'invalid_input',
      'baserate.cases[0].statusAt',
    ],
    [
      'proportion case resolvedAt',
      'v2-baserate-proportion',
      '2021-01-01T00:00:00Z',
      (i, v) => (baserate(i).cases[0].resolvedAt = v),
      'invalid_input',
      'baserate.cases[0].resolvedAt',
    ],
  ];
  const withFraction = (ts: string, frac: string) => ts.replace(/(Z|[+-]\d{2}:\d{2})$/, `.${frac}$1`);

  it.each(boundaries)('%s accepts .9, .99, .999', (_name, id, ts, mutate) => {
    for (const frac of ['9', '99', '999']) {
      const input = byId(id);
      mutate(input, withFraction(ts, frac));
      expect(() => runForecast(input)).not.toThrow();
    }
  });

  it.each(boundaries)('%s rejects .9999 and .123456789 with its own code and path', (_name, id, ts, mutate, code, path) => {
    for (const frac of ['9999', '123456789']) {
      const bad = withFraction(ts, frac);
      const input = byId(id);
      mutate(input, bad);
      const e = thrown(() => runForecast(input));
      expect({ code: e.code, path: e.path }).toEqual({ code, path });
      expect(e.message).not.toContain(bad);
      expect(e.message).not.toContain(frac);
    }
  });
});

describe('strict dates on nested citations and outcome declarations', () => {
  type Mutator = (input: ForecastInput, value: string) => void;
  const baserate = (i: ForecastInput) => i.baserate as unknown as Record<string, any>;
  const market = (i: ForecastInput) => i.market as unknown as Record<string, any>;
  const declaration = (i: ForecastInput) => (i.question.outcomes[0] as any).outcomeDeclaration;

  const citations: Array<[string, string, Mutator, string]> = [
    ['criteria citation', 'v2-baserate-proportion', (i, v) => (baserate(i).referenceClass.criteria[1].source.accessedAt = v), 'baserate.referenceClass.criteria[1].source.accessedAt'],
    ['case-source citation', 'v2-baserate-competing', (i, v) => (baserate(i).cases[2].source.accessedAt = v), 'baserate.cases[2].source.accessedAt'],
    ['outcome-source citation', 'v2-market-sportsbook', (i, v) => (market(i).outcomes[1].source.accessedAt = v), 'market.outcomes[1].source.accessedAt'],
  ];

  it.each(citations)('%s rejects impossible and sub-millisecond accessedAt as missing_citation', (_name, id, mutate, path) => {
    for (const bad of ['2026-02-30T12:00:00Z', '2026-02-29T00:00:00Z', '2026-01-01T24:00:00Z', '2026-09-26T11:00:00.9999-07:00']) {
      const input = byId(id);
      mutate(input, bad);
      const e = thrown(() => runForecast(input));
      expect({ code: e.code, path: e.path }).toEqual({ code: 'missing_citation', path });
      expect(e.message).not.toContain(bad);
    }
  });

  it('outcome-declaration resolveBy rejects impossible dates with invalid_input', () => {
    for (const bad of ['2026-02-30', '2026-02-29', '2026-04-31']) {
      const input = byId('v2-judgment-declaration-revision-signed');
      declaration(input).resolveBy = bad;
      const e = thrown(() => runForecast(input));
      expect({ code: e.code, path: e.path }).toEqual({ code: 'invalid_input', path: 'question.outcomes[0].outcomeDeclaration.resolveBy' });
      expect(e.message).not.toContain(bad);
    }
  });

  it('outcome-declaration declaredAt rejects impossible and sub-millisecond timestamps with invalid_input', () => {
    for (const bad of ['2026-02-30T00:00:00Z', '2026-09-20T00:00:00.0000Z', '2026-09-20T00:00:00.123456789Z']) {
      const input = byId('v2-judgment-declaration-revision-signed');
      declaration(input).declaredAt = bad;
      const e = thrown(() => runForecast(input));
      expect({ code: e.code, path: e.path }).toEqual({ code: 'invalid_input', path: 'question.outcomes[0].outcomeDeclaration.declaredAt' });
      expect(e.message).not.toContain(bad);
    }
  });
});
