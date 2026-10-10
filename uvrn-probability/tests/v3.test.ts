/**
 * Version 3 (SPEC/uvrn-probability-v3.md): fixed-offset local deadlines. Covers the contract,
 * boundaries, identity, verification, and the guardrails that keep versions 1 and 2 unchanged.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  FORECAST_V3_ORIGIN,
  ForecastValidationError,
  LIMITATION_FIXED_OFFSET,
  LIMITATION_PROFILE,
  buildForecastReceipt,
  computeForecastHash,
  computeQuestionHash,
  runForecast,
  verifyForecastReceipt,
  type ForecastHashPayload,
  type ForecastResult,
} from '../src';
import { horizonInstantMs } from '../src/baserate/evaluate';
import { parseOffsetMinutes } from '../src/common/strict';
import { validateQuestionV3 } from '../src/forecast/question';
import { marketCutoffInstantMs } from '../src/odds/market';
import { SPEC_KEYS } from './fixtures';
import { binaryQuestion, vectorCasesV2 } from './fixtures-v2';
import {
  deadlineBaseRateV3,
  eveningCutoffMarketV2,
  eveningCutoffMarketV3,
  judgmentV3,
  toV3,
  validationErrorCasesV3,
  vectorCasesV3,
} from './fixtures-v3';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const byId = (id: string) => vectorCasesV3().find((c) => c.id === id)!;
const MS = (iso: string) => Date.parse(iso);

function expectError(fn: () => unknown, code: string, path?: string, message?: RegExp): void {
  let caught: unknown;
  try {
    fn();
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(ForecastValidationError);
  const e = caught as ForecastValidationError;
  expect(e.code).toBe(code);
  if (path) expect(e.path).toBe(path);
  if (message) expect(e.message).toMatch(message);
}

describe('version 3: contract', () => {
  it('input-3 is accepted and yields a uvrn-probability-3 record with the pinned v3 origin', () => {
    const r = runForecast(eveningCutoffMarketV3('fx3-accepted'));
    expect(r.specVersion).toBe('uvrn-probability-3');
    expect(r.origin).toBe(FORECAST_V3_ORIGIN);
    expect(r.origin).toBe('model:@uvrn/probability@0.3.0');
    expect(r.question).toMatchObject({ resolveBy: '2026-10-31', resolveByOffset: '-04:00' });
    expect(r.receipt.claim.text).toBe(`Forecast for uvrn-probability-question-2 question ${r.questionHash}`);
  });

  it('records inputs.deadline as the local deadline day in UTC instants', () => {
    const r = runForecast(eveningCutoffMarketV3('fx3-deadline'));
    expect(r.specVersion === 'uvrn-probability-3' && r.inputs.deadline).toEqual({
      resolveBy: '2026-10-31',
      offset: '-04:00',
      startInstantUtc: '2026-10-31T04:00:00.000Z',
      endInstantUtcExclusive: '2026-11-01T04:00:00.000Z',
    });
  });

  it('the fixed-offset limitation is the frozen text, after the profile limitation and before mode limitations', () => {
    expect(LIMITATION_FIXED_OFFSET).toBe(
      "Deadline day read at the caller-supplied fixed UTC offset (question.resolveByOffset); that the offset is correct for the date is the caller's attestation. No time-zone or daylight-saving rules are applied."
    );
    const plain = runForecast(eveningCutoffMarketV3('fx3-lim'));
    expect(plain.limitations.slice(3, 4)).toEqual([LIMITATION_FIXED_OFFSET]);
    const profiled = runForecast(byId('v3-profile-tightened-refusal').input);
    const i = profiled.limitations.indexOf(LIMITATION_FIXED_OFFSET);
    expect(profiled.limitations[i - 1]).toBe(LIMITATION_PROFILE);
    expect(i).toBe(4);
  });

  it('the same top-level hashed field list as version 2', () => {
    const v2 = runForecast(vectorCasesV2()[0].input);
    const v3 = runForecast(byId('v3-market-utc-offset').input);
    expect(Object.keys(v3).sort()).toEqual(Object.keys(v2).sort());
  });

  it('+00:00 gives the v2 probabilities but a new identity (question-2) and hash', () => {
    const v2 = runForecast(vectorCasesV2().find((c) => c.id === 'v2-market-sportsbook')!.input);
    const v3 = runForecast(byId('v3-market-utc-offset').input);
    expect(v3.probabilities).toEqual(v2.probabilities);
    expect(v3.band).toEqual(v2.band);
    expect(v3.questionHash).not.toBe(v2.questionHash);
    expect(v3.probabilityHash).not.toBe(v2.probabilityHash);
  });

  it('proportion mode records horizonDeadlineDate: null alongside horizonUtcDate: null', () => {
    const r = runForecast(byId('v3-baserate-proportion').input);
    expect(r.inputs.baserate).toMatchObject({ horizonUtcDate: null, horizonDeadlineDate: null, deadlineMatched: null });
  });

  it('version 2 keeps the question-1 claim text', () => {
    const r = runForecast(vectorCasesV2()[0].input);
    expect(r.receipt.claim.text).toBe(`Forecast for uvrn-probability-question-1 question ${r.questionHash}`);
  });

  it('version constants are literal pins (v3 origin never derived from PACKAGE_VERSION)', () => {
    const source = readFileSync(join(__dirname, '..', 'src', 'version.ts'), 'utf8');
    expect(source).toContain("export const FORECAST_V3_VERSION = '0.3.0';");
    expect(source).toContain('export const FORECAST_V3_ORIGIN = `model:@uvrn/probability@${FORECAST_V3_VERSION}`;');
  });
});

describe('version 3: offsets and validation errors', () => {
  it.each([
    ['+00:00', 0],
    ['+14:00', 840],
    ['-12:00', -720],
    ['+05:30', 330],
    ['+05:45', 345],
    ['-04:00', -240],
    ['-09:30', -570],
  ])('%s parses to %i minutes', (offset, minutes) => {
    expect(parseOffsetMinutes(offset)).toBe(minutes);
  });

  it.each(['-00:00', '-12:01', '-12:30', '+14:01', '+14:30', '+24:00', '+12:60', '+5:00', '+0500', '05:00', 'Z', ' +05:00', '+05:00 ', '+０５:００', ''])(
    '%j is rejected',
    (offset) => {
      expect(parseOffsetMinutes(offset)).toBeNull();
    }
  );

  it.each([null, 0, 300, undefined, {}])('non-string %j is rejected', (value) => {
    expect(parseOffsetMinutes(value)).toBeNull();
  });

  it.each(validationErrorCasesV3().map((c) => [c.id, c] as const))('%s', (_id, c) => {
    expectError(() => runForecast(c.input as never), c.error.code, c.error.path);
  });

  it('year-range rejections carry the range message (not the asOf message)', () => {
    for (const id of ['v3-year-range-upper', 'v3-year-range-upper-exact', 'v3-year-range-lower']) {
      const c = validationErrorCasesV3().find((x) => x.id === id)!;
      expectError(() => runForecast(c.input as never), 'invalid_question', 'question.resolveBy', /years 0000–9999/);
    }
  });

  it('the year-range-lower case can only fail on the year range (its asOf is before that local day ends)', () => {
    const c = validationErrorCasesV3().find((x) => x.id === 'v3-year-range-lower')!;
    const input = c.input as { asOf: { at: string }; question: { resolveBy: string; resolveByOffset: string } };
    const endExclusive = MS(`${input.question.resolveBy}T00:00:00Z`) - 14 * 3_600_000 + 86_400_000;
    expect(MS(input.asOf.at)).toBeLessThan(endExclusive);
    expectError(() => runForecast(c.input as never), 'invalid_question', 'question.resolveBy', /years 0000–9999/);
  });

  it('D6: cutoff / horizon read instants outside years 0000–9999 are invalid_input with the range message', () => {
    for (const [id, path] of [
      ['v3-cutoff-year-range', 'market.resolvesAt'],
      ['v3-horizon-year-range', 'baserate.horizon.by'],
    ] as const) {
      const c = validationErrorCasesV3().find((x) => x.id === id)!;
      expectError(() => runForecast(c.input as never), 'invalid_input', path, /years 0000–9999/);
    }
  });

  it('D6 lower bound: a market cutoff read in year -1 is invalid_input with no receipt', () => {
    // 0000-01-01T00:00:00+14:00 is -000001-12-31T10:00:00.000Z; the deadline day itself is in range.
    const input = eveningCutoffMarketV3('fx3-cutoff-year-lower', '0000-01-01T00:00:00+14:00');
    expectError(() => runForecast(input), 'invalid_input', 'market.resolvesAt', /years 0000–9999/);
  });

  it('D6 lower bound: a base-rate horizon read in year -1 is invalid_input with no receipt', () => {
    const input = deadlineBaseRateV3('fx3-horizon-year-lower', '-04:00', '0000-01-01T00:00:00+14:00');
    expectError(() => runForecast(input), 'invalid_input', 'baserate.horizon.by', /years 0000–9999/);
  });

  it('year-range inner edges are accepted (validated directly; asOf placed inside the day)', () => {
    const q = (resolveBy: string, resolveByOffset: string) => ({ ...binaryQuestion(resolveBy), resolveByOffset });
    const lower = validateQuestionV3(q('0000-01-01', '+00:00'), MS('0000-01-01T00:00:00Z'));
    expect(lower.deadline.record.startInstantUtc).toBe('0000-01-01T00:00:00.000Z');
    const upper = validateQuestionV3(q('9999-12-31', '+00:01'), MS('9999-12-31T00:00:00Z'));
    expect(upper.deadline.record.endInstantUtcExclusive).toBe('9999-12-31T23:59:00.000Z');
  });

  it('asOf at end − 1 ms is accepted; exactly at end is invalid_question', () => {
    const at = (iso: string) => ({ ...judgmentV3('fx3-asof', '-04:00', '2026-10-31'), asOf: { at: iso, source: { url: 'https://example.org/asof', accessedAt: '2026-10-31T00:00:00Z' } } });
    expect(runForecast(at('2026-11-01T03:59:59.999Z')).status).toBe('forecast');
    expectError(() => runForecast(at('2026-11-01T04:00:00.000Z')), 'invalid_question', 'question.resolveBy', /-04:00/);
  });

  it('version 2 still rejects resolveByOffset as an undeclared question member', () => {
    const v2 = clone(vectorCasesV2().find((c) => c.id === 'v2-judgment-binary')!.input);
    (v2.question as unknown as Record<string, unknown>).resolveByOffset = '-04:00';
    expectError(() => runForecast(v2), 'unknown_field', 'question.resolveByOffset');
  });
});

describe('version 3: deadline matching by interval membership', () => {
  // Local deadline day for 2026-10-31 at -04:00 is [2026-10-31T04:00Z, 2026-11-01T04:00Z).
  it.each([
    ['start − 1 ms', '2026-10-31T03:59:59.999Z', false],
    ['start', '2026-10-31T04:00:00.000Z', true],
    ['end − 1 ms', '2026-11-01T03:59:59.999Z', true],
    ['end', '2026-11-01T04:00:00.000Z', false],
  ])('market cutoff at %s matched=%s', (_label, cutoff, matched) => {
    const r = runForecast(eveningCutoffMarketV3('fx3-edge', cutoff));
    expect((r.inputs.market as Record<string, unknown>).deadlineMatched).toBe(matched);
    expect(r.refusals.map((x) => x.code)).toEqual(matched ? [] : ['deadline_mismatch']);
  });

  it('the World Series shape: v2 refuses, v3 at -04:00 matches', () => {
    expect(runForecast(eveningCutoffMarketV2('fx-ws-v2')).refusals.map((x) => x.code)).toEqual(['deadline_mismatch']);
    const r = runForecast(eveningCutoffMarketV3('fx-ws-v3'));
    expect(r.status).toBe('forecast');
    expect(r.inputs.market).toMatchObject({ eventCutoffUtcDate: '2026-11-01', eventCutoffDeadlineDate: '2026-10-31', deadlineMatched: true });
  });

  it('mismatch messages name the LOCAL date when it differs from the UTC date (market and base rate)', () => {
    const m = runForecast(byId('v3-market-mismatch-local-differs').input);
    expect(m.inputs.market).toMatchObject({ eventCutoffUtcDate: '2026-10-31', eventCutoffDeadlineDate: '2026-10-30', deadlineMatched: false });
    expect(m.refusals).toEqual([
      {
        code: 'deadline_mismatch',
        scope: 'market',
        message: "the market's event cutoff falls on 2026-10-30 at UTC offset -04:00; the question deadline is 2026-10-31 at -04:00",
      },
    ]);
    const b = runForecast(byId('v3-baserate-mismatch-local-differs').input);
    expect(b.inputs.baserate).toMatchObject({ horizonUtcDate: '2026-09-27', horizonDeadlineDate: '2026-09-26', deadlineMatched: false });
    expect(b.refusals.find((r) => r.code === 'deadline_mismatch')?.message).toBe(
      'the base-rate horizon falls on 2026-09-26 at UTC offset -04:00; the question deadline is 2026-09-27 at -04:00'
    );
  });

  it('the v3 mismatch message names the local date and the offset', () => {
    const r = runForecast(byId('v3-market-offset-mismatch').input);
    expect(r.refusals[0].message).toBe(
      "the market's event cutoff falls on 2026-11-01 at UTC offset -04:00; the question deadline is 2026-10-31 at -04:00"
    );
  });

  it.each([
    ['-12:00', '2026-10-31', '2026-11-01T11:59:59.999Z'],
    ['-04:00', '2026-10-31', '2026-11-01T03:59:59.999Z'],
    ['+05:30', '2026-10-31', '2026-10-31T18:29:59.999Z'],
    ['+05:45', '2026-10-31', '2026-10-31T18:14:59.999Z'],
    ['+14:00', '2026-10-31', '2026-10-31T09:59:59.999Z'],
  ])('date-only resolvesAt at %s is read at local end − 1 ms, identical to the explicit zoned form', (offset, date, instant) => {
    const dateOnly = runForecast(eveningCutoffMarketV3('fx3-do', date, offset));
    expect((dateOnly.inputs.market as Record<string, unknown>).eventCutoffInstantUtc).toBe(instant);
    const explicit = runForecast(eveningCutoffMarketV3('fx3-do', `${date}T23:59:59.999${offset}`, offset));
    expect(explicit.probabilities).toEqual(dateOnly.probabilities);
    expect((explicit.inputs.market as Record<string, unknown>).timeToEventCutoffDays).toBe(
      (dateOnly.inputs.market as Record<string, unknown>).timeToEventCutoffDays
    );
  });

  it('a date-only cutoff on the next local day is a deadline_mismatch', () => {
    const r = runForecast(eveningCutoffMarketV3('fx3-next', '2026-11-01'));
    expect(r.refusals.map((x) => x.code)).toEqual(['deadline_mismatch']);
  });

  it('a date-only horizon.by at +05:30 is evaluated at local end of day and matched', () => {
    const r = runForecast(deadlineBaseRateV3('fx3-hz', '+05:30'));
    expect(r.inputs.baserate).toMatchObject({
      horizonInstantUtc: '2026-09-27T18:29:59.999Z',
      horizonUtcDate: '2026-09-27',
      horizonDeadlineDate: '2026-09-27',
      deadlineMatched: true,
    });
  });

  it('mixed reading: date-only horizon at the local end, date-only case/subject dates at 00:00Z', () => {
    const c = byId('v3-baserate-mixed-date-reading');
    const r = runForecast(c.input);
    const b = r.inputs.baserate as Record<string, unknown>;
    const by = (c.input.baserate as { horizon: { by: string } }).horizon.by;
    expect(b.horizonInstantUtc).toBe(new Date(MS(`${by}T00:00:00Z`) + 7 * 3_600_000 + 86_400_000 - 1).toISOString());
    // Case dates are date-only and read at 00:00Z: every case duration is a whole number of days.
    const timed = (b.cases as Array<{ timeDays?: number }>).filter((k) => k.timeDays !== undefined);
    expect(timed.length).toBeGreaterThan(0);
    for (const kase of timed) expect(Number.isInteger(kase.timeDays)).toBe(true);
  });
});

describe('guardrails: versions 1 and 2 date-only reads are unchanged', () => {
  const date = '2026-10-31';
  it('market: v1 reads 00:00Z, v2 reads UTC end − 1 ms, offset applies only with the v3 policy', () => {
    expect(marketCutoffInstantMs(date)).toBe(MS('2026-10-31T00:00:00Z'));
    expect(marketCutoffInstantMs(date, { resolvesEndOfUtcDay: true })).toBe(MS('2026-10-31T23:59:59.999Z'));
    expect(marketCutoffInstantMs(date, { resolvesEndOfUtcDay: true, endOfDayOffsetMinutes: 0 })).toBe(MS('2026-10-31T23:59:59.999Z'));
    expect(marketCutoffInstantMs(date, { resolvesEndOfUtcDay: true, endOfDayOffsetMinutes: -240 })).toBe(MS('2026-11-01T03:59:59.999Z'));
    expect(marketCutoffInstantMs(date, { endOfDayOffsetMinutes: -240 })).toBe(MS('2026-10-31T00:00:00Z'));
    expect(marketCutoffInstantMs('2026-10-31T20:00:00-04:00', { resolvesEndOfUtcDay: true, endOfDayOffsetMinutes: -240 })).toBe(
      MS('2026-11-01T00:00:00Z')
    );
  });

  it('horizon: v1 reads 00:00Z, v2 reads UTC end − 1 ms, offset applies only with the v3 policy', () => {
    expect(horizonInstantMs(date)).toBe(MS('2026-10-31T00:00:00Z'));
    expect(horizonInstantMs(date, { horizonEndOfUtcDay: true })).toBe(MS('2026-10-31T23:59:59.999Z'));
    expect(horizonInstantMs(date, { horizonEndOfUtcDay: true, endOfDayOffsetMinutes: 330 })).toBe(MS('2026-10-31T18:29:59.999Z'));
    expect(horizonInstantMs(date, { endOfDayOffsetMinutes: 330 })).toBe(MS('2026-10-31T00:00:00Z'));
  });
});

describe('version 3: receipts and verification', () => {
  const signed = () => runForecast(byId('v3-market-signed').input, byId('v3-market-signed').options);

  it('a signed v3 receipt verifies with the SPEC test key', () => {
    expect(verifyForecastReceipt(signed().receipt, { publicKey: SPEC_KEYS.publicKey })).toMatchObject({
      verified: true,
      specVersion: 'uvrn-probability-3',
      probabilityHashOk: true,
      questionHashOk: true,
      declarationsOk: true,
    });
  });

  it('an unsigned v3 receipt is integrity-checked only, never "verified"', () => {
    const v = verifyForecastReceipt(runForecast(eveningCutoffMarketV3('fx3-unsigned')).receipt);
    expect(v).toMatchObject({ verified: false, integrityOk: true, probabilityHashOk: true, questionHashOk: true });
  });

  it.each(['resolveBy', 'offset', 'startInstantUtc', 'endInstantUtcExclusive'])('tampering inputs.deadline.%s breaks the hash', (field) => {
    const r = signed();
    const payload = clone(r.receipt.payload) as Record<string, any>;
    payload.inputs.deadline[field] = field === 'offset' ? '-05:00' : field === 'resolveBy' ? '2026-10-30' : '2026-10-31T05:00:00.000Z';
    const v = verifyForecastReceipt({ ...r.receipt, payload }, { publicKey: SPEC_KEYS.publicKey });
    expect(v.verified).toBe(false);
    expect(v.probabilityHashOk).toBe(false);
  });

  it('tampering question.resolveByOffset breaks the question and probability hashes', () => {
    const r = signed();
    const payload = clone(r.receipt.payload) as Record<string, any>;
    payload.question.resolveByOffset = '-05:00';
    const v = verifyForecastReceipt({ ...r.receipt, payload }, { publicKey: SPEC_KEYS.publicKey });
    expect(v).toMatchObject({ verified: false, probabilityHashOk: false, questionHashOk: false });
  });

  /** Re-derive questionHash and probabilityHash for a forged payload, then rebuild its receipt. */
  function reseal(payload: Record<string, any>): ForecastResult['receipt'] {
    payload.questionHash = computeQuestionHash(payload.question);
    const probabilityHash = computeForecastHash(payload);
    return buildForecastReceipt({ ...(payload as unknown as ForecastHashPayload), probabilityHash });
  }

  it('forged: a v2-labelled record carrying resolveByOffset (question-2 identity, hashes recomputed) fails questionHashOk', () => {
    const r = runForecast(vectorCasesV2()[0].input);
    const { probabilityHash: _p, receipt: _r, ...payload } = clone(r) as Record<string, any>;
    payload.question.resolveByOffset = '+00:00';
    const receipt = reseal(payload);
    const v = verifyForecastReceipt(receipt);
    expect(v.probabilityHashOk).toBe(true);
    expect(v.questionHashOk).toBe(false);
    expect(v.integrityOk).toBe(true);
    expect(v.error).toMatch(/^QUESTION_HASH_FAILED/);
  });

  it('forged: a v3-labelled record without resolveByOffset (question-1 identity, hashes recomputed) fails questionHashOk', () => {
    const r = runForecast(eveningCutoffMarketV3('fx3-forge'));
    const { probabilityHash: _p, receipt: _r, ...payload } = clone(r) as Record<string, any>;
    delete payload.question.resolveByOffset;
    const receipt = reseal(payload);
    const v = verifyForecastReceipt(receipt);
    expect(v.probabilityHashOk).toBe(true);
    expect(v.questionHashOk).toBe(false);
    expect(v.error).toMatch(/^QUESTION_HASH_FAILED/);
  });

  describe('D5: verification recomputes inputs.deadline from the question', () => {
    const forgeV3 = (mutate: (payload: Record<string, any>) => void) => {
      const r = runForecast(eveningCutoffMarketV3('fx3-d5'));
      const { probabilityHash: _p, receipt: _r, ...payload } = clone(r) as Record<string, any>;
      mutate(payload);
      return verifyForecastReceipt(reseal(payload));
    };

    it('a clean v3 record has deadlineOk true; v2 true; v1 null', () => {
      expect(verifyForecastReceipt(runForecast(eveningCutoffMarketV3('fx3-d5-clean')).receipt).deadlineOk).toBe(true);
      expect(verifyForecastReceipt(runForecast(vectorCasesV2()[0].input).receipt).deadlineOk).toBe(true);
      const v1 = JSON.parse(readFileSync(join(__dirname, '..', '..', 'SPEC', 'vectors', 'probability-v1.json'), 'utf8'));
      const legacy = require('../src').runProbability(v1.cases[0].input);
      expect(verifyForecastReceipt(legacy.receipt).deadlineOk).toBeNull();
    });

    it.each([
      ['deleted', (p: Record<string, any>) => delete p.inputs.deadline],
      ['contradictory end', (p: Record<string, any>) => (p.inputs.deadline.endInstantUtcExclusive = '2026-11-01T05:00:00.000Z')],
      ['contradictory start', (p: Record<string, any>) => (p.inputs.deadline.startInstantUtc = '2026-10-31T05:00:00.000Z')],
      ['offset disagrees with the question', (p: Record<string, any>) => (p.inputs.deadline.offset = '-05:00')],
      ['resolveBy disagrees with the question', (p: Record<string, any>) => (p.inputs.deadline.resolveBy = '2026-10-30')],
      ['extra member', (p: Record<string, any>) => (p.inputs.deadline.note = 'x')],
      ['garbage question offset (deadline matched to it)', (p: Record<string, any>) => {
        p.question.resolveByOffset = 'garbage';
        p.inputs.deadline.offset = 'garbage';
      }],
    ])('forged v3 (%s, hashes recomputed) fails deadlineOk', (_label, mutate) => {
      const v = forgeV3(mutate);
      expect(v.probabilityHashOk).toBe(true);
      expect(v.deadlineOk).toBe(false);
      expect(v.verified).toBe(false);
      expect(v.error).toMatch(/^(DEADLINE_RECORD_FAILED|QUESTION_HASH_FAILED)/);
    });

    it('forged v2 carrying inputs.deadline (hashes recomputed) fails deadlineOk', () => {
      const r = runForecast(vectorCasesV2()[0].input);
      const { probabilityHash: _p, receipt: _r, ...payload } = clone(r) as Record<string, any>;
      payload.inputs.deadline = { resolveBy: '2026-10-30', offset: '+00:00', startInstantUtc: '2026-10-30T00:00:00.000Z', endInstantUtcExclusive: '2026-10-31T00:00:00.000Z' };
      const v = verifyForecastReceipt(reseal(payload));
      expect(v).toMatchObject({ probabilityHashOk: true, questionHashOk: true, deadlineOk: false, verified: false });
      expect(v.error).toBe('DEADLINE_RECORD_FAILED: a uvrn-probability-2 record must not carry inputs.deadline');
    });

    it('an unsigned v3 record whose deadline was tampered and re-sealed reports the v3 DEADLINE_RECORD_FAILED message', () => {
      const v = forgeV3((p) => (p.inputs.deadline.offset = '-05:00'));
      expect(v.error).toBe('DEADLINE_RECORD_FAILED: inputs.deadline does not recompute from question.resolveBy and question.resolveByOffset');
    });
  });

  describe('D5: a re-signed forgery is integrity-checked and signature-valid, but never "verified"', () => {
    const signer = byId('v3-market-signed').options!.signer!;
    /** Re-derive both hashes for a forged payload, then rebuild and RE-SIGN its receipt with the SPEC test key. */
    const resign = (payload: Record<string, any>) => {
      payload.questionHash = computeQuestionHash(payload.question);
      const probabilityHash = computeForecastHash(payload);
      return buildForecastReceipt({ ...(payload as unknown as ForecastHashPayload), probabilityHash }, signer);
    };
    const forgeSigned = (base: ForecastResult, mutate: (payload: Record<string, any>) => void) => {
      const { probabilityHash: _p, receipt: _r, ...payload } = clone(base) as Record<string, any>;
      mutate(payload);
      return verifyForecastReceipt(resign(payload), { publicKey: SPEC_KEYS.publicKey });
    };
    const expectSignedButNotVerified = (v: ReturnType<typeof verifyForecastReceipt>) => {
      expect(v).toMatchObject({
        signed: true,
        signatureOk: true,
        integrityOk: true,
        probabilityHashOk: true,
        questionHashOk: true,
        declarationsOk: true,
        deadlineOk: false,
        verified: false,
      });
      expect(v.error).toMatch(/^DEADLINE_RECORD_FAILED/);
    };

    it('the unforged re-signed record is verified (the helper itself is sound)', () => {
      const v = forgeSigned(runForecast(eveningCutoffMarketV3('fx3-d5-signed')), () => undefined);
      expect(v).toMatchObject({ signatureOk: true, integrityOk: true, deadlineOk: true, verified: true });
    });

    it.each([
      ['deleted', (p: Record<string, any>) => delete p.inputs.deadline],
      ['contradictory end', (p: Record<string, any>) => (p.inputs.deadline.endInstantUtcExclusive = '2026-11-01T05:00:00.000Z')],
      ['contradictory start', (p: Record<string, any>) => (p.inputs.deadline.startInstantUtc = '2026-10-31T05:00:00.000Z')],
      ['offset disagrees with the question', (p: Record<string, any>) => (p.inputs.deadline.offset = '-05:00')],
      ['resolveBy disagrees with the question', (p: Record<string, any>) => (p.inputs.deadline.resolveBy = '2026-10-30')],
      ['extra member', (p: Record<string, any>) => (p.inputs.deadline.note = 'x')],
      ['garbage question offset (deadline matched to it)', (p: Record<string, any>) => {
        p.question.resolveByOffset = 'garbage';
        p.inputs.deadline.offset = 'garbage';
      }],
      ['whitespace-padded question offset (deadline matched to it)', (p: Record<string, any>) => {
        p.question.resolveByOffset = ' -04:00';
        p.inputs.deadline.offset = ' -04:00';
      }],
      ['deadline is an array', (p: Record<string, any>) => (p.inputs.deadline = Object.values(p.inputs.deadline))],
      ['whole deadline day shifted by one day', (p: Record<string, any>) => {
        p.inputs.deadline = {
          resolveBy: '2026-11-01',
          offset: '-04:00',
          startInstantUtc: '2026-11-01T04:00:00.000Z',
          endInstantUtcExclusive: '2026-11-02T04:00:00.000Z',
        };
      }],
    ])('signed forged v3 (%s): signature and integrity pass, deadlineOk false, not verified', (_label, mutate) => {
      expectSignedButNotVerified(forgeSigned(runForecast(eveningCutoffMarketV3('fx3-d5-signed')), mutate));
    });

    it('signed forged v2 carrying inputs.deadline: signature and integrity pass, deadlineOk false, not verified', () => {
      const v = forgeSigned(runForecast(vectorCasesV2()[0].input), (p) => {
        p.inputs.deadline = { resolveBy: '2026-10-30', offset: '+00:00', startInstantUtc: '2026-10-30T00:00:00.000Z', endInstantUtcExclusive: '2026-10-31T00:00:00.000Z' };
      });
      expectSignedButNotVerified(v);
      expect(v.error).toBe('DEADLINE_RECORD_FAILED: a uvrn-probability-2 record must not carry inputs.deadline');
    });

    it.each([
      ['lower', '0000-01-01', '+14:00', '-000001-12-31T10:00:00.000Z', '0000-01-01T10:00:00.000Z'],
      ['upper', '9999-12-31', '-12:00', '9999-12-31T12:00:00.000Z', '+010000-01-01T12:00:00.000Z'],
    ])(
      'signed hand-built v3 whose deadline day leaves years 0000–9999 (%s) fails the verifier year-range check',
      (_label, resolveBy, offset, startInstantUtc, endInstantUtcExclusive) => {
        const v = forgeSigned(runForecast(eveningCutoffMarketV3('fx3-d5-year')), (p) => {
          p.question.resolveBy = resolveBy;
          p.question.resolveByOffset = offset;
          p.inputs.deadline = { resolveBy, offset, startInstantUtc, endInstantUtcExclusive };
        });
        expectSignedButNotVerified(v);
        expect(v.error).toBe('DEADLINE_RECORD_FAILED: inputs.deadline does not recompute from question.resolveBy and question.resolveByOffset');
      }
    );
  });

  it('an unknown payload version fails with UNSUPPORTED_VERSION', () => {
    const r = runForecast(eveningCutoffMarketV3('fx3-unknown'));
    const payload = { ...(clone(r.receipt.payload) as Record<string, unknown>), specVersion: 'uvrn-probability-9' };
    expect(verifyForecastReceipt({ ...r.receipt, payload }).error).toMatch(/^UNSUPPORTED_VERSION/);
  });
});

describe('version 3: every vector case runs deterministically', () => {
  it.each(vectorCasesV3().map((c) => [c.id, c] as const))('%s is reproducible', (_id, c) => {
    const a = runForecast(clone(c.input), c.options);
    const b = runForecast(clone(c.input), c.options);
    expect(a.probabilityHash).toBe(b.probabilityHash);
    expect(a.specVersion).toBe('uvrn-probability-3');
    expect(a.specVersion === 'uvrn-probability-3' && a.inputs.deadline.offset).toBe(c.input.question.resolveByOffset);
  });

  it('toV3 leaves the v2 fixture untouched', () => {
    const v2 = eveningCutoffMarketV2('fx3-untouched');
    const before = JSON.stringify(v2);
    toV3(v2, '+01:00');
    expect(JSON.stringify(v2)).toBe(before);
  });
});
