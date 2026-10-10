/**
 * Synthetic version-3 fixtures for tests and SPEC/vectors/probability-v3.json. Built from the
 * version-2 fixtures plus a required `question.resolveByOffset`. Every URL is example.org and every
 * question is invented; the "World Series shape" case is a date/offset shape, not real odds.
 */

import type { ForecastInputV2, ForecastInputV3, ForecastOptions } from '../src';
import { SPEC_KEYS, exchangeBinary, proportionCases, referenceClass, sportsbookTwoWay } from './fixtures';
import {
  AS_OF_V2,
  agentProducer,
  binaryQuestion,
  deadlineBaseRate,
  DEADLINE_AS_OF,
  judgmentBinary,
  permitQuestion,
  judgmentCategorical,
  fixtureProfile,
  tteForecast,
} from './fixtures-v2';
import { cite } from './fixtures';

/** toV3 lifts a version-2 request to version 3 with the given fixed offset. */
export function toV3(input: ForecastInputV2, resolveByOffset: string, forecastId = input.forecastId): ForecastInputV3 {
  return {
    ...input,
    specVersion: 'uvrn-probability-input-3',
    forecastId,
    question: { ...input.question, resolveByOffset },
  };
}

const baseV2 = (forecastId: string) => ({
  specVersion: 'uvrn-probability-input-2' as const,
  forecastId,
  asOf: { at: AS_OF_V2, source: cite('asof-clock-note') },
  producer: agentProducer(),
});

/**
 * The World Series *shape*: an evening-Eastern event cutoff on 2026-10-31 is 2026-11-01 in UTC.
 * Version 2 refuses it against a 2026-10-31 deadline; version 3 at -04:00 matches it.
 */
export const WORLD_SERIES_CUTOFF = '2026-10-31T23:59:59-04:00';
export function eveningCutoffMarketV2(forecastId: string, resolvesAt = WORLD_SERIES_CUTOFF): ForecastInputV2 {
  return {
    ...baseV2(forecastId),
    mode: 'market',
    question: binaryQuestion('2026-10-31'),
    market: { ...exchangeBinary(), resolvesAt },
  };
}
export const eveningCutoffMarketV3 = (forecastId: string, resolvesAt = WORLD_SERIES_CUTOFF, offset = '-04:00') =>
  toV3(eveningCutoffMarketV2(forecastId, resolvesAt), offset);

export function judgmentV3(forecastId: string, offset: string, resolveBy = '2026-10-30'): ForecastInputV3 {
  return toV3({ ...baseV2(forecastId), mode: 'judgment', question: binaryQuestion(resolveBy), judgment: judgmentBinary() }, offset);
}

/** The v2 end-of-day deadline base rate at a fixed offset (horizon date-only unless given). */
export function deadlineBaseRateV3(forecastId: string, offset: string, horizonBy = '2026-09-27'): ForecastInputV3 {
  return toV3(
    {
      specVersion: 'uvrn-probability-input-2',
      forecastId,
      mode: 'baserate',
      question: binaryQuestion('2026-09-27'),
      asOf: { at: DEADLINE_AS_OF, source: cite('asof-clock-note', '2026-09-25T23:00:00Z') },
      producer: agentProducer(),
      baserate: deadlineBaseRate(horizonBy),
      thresholds: { minCases: 8 },
    },
    offset
  );
}

export interface VectorCaseV3 {
  id: string;
  description: string;
  input: ForecastInputV3;
  options?: ForecastOptions;
}

export function vectorCasesV3(): VectorCaseV3[] {
  return [
    {
      id: 'v3-market-offset-match',
      description: 'Evening-Eastern event cutoff 2026-10-31T23:59:59-04:00 (2026-11-01 in UTC) against deadline 2026-10-31 at -04:00 → accepted (v2 refuses this shape)',
      input: eveningCutoffMarketV3('fx3-market-offset-match'),
    },
    {
      id: 'v3-market-offset-mismatch',
      description: 'Event cutoff 2026-11-01T00:00:00-04:00 is the first instant after the local deadline day → deadline_mismatch',
      input: eveningCutoffMarketV3('fx3-market-offset-mismatch', '2026-11-01T00:00:00-04:00'),
    },
    {
      id: 'v3-market-mismatch-local-differs',
      description:
        'Event cutoff 2026-10-31T03:00:00Z is before the local day starts at -04:00: local date 2026-10-30, UTC date 2026-10-31 → deadline_mismatch naming the local date',
      input: eveningCutoffMarketV3('fx3-market-local-differs', '2026-10-31T03:00:00Z'),
    },
    {
      id: 'v3-market-date-only-local-end',
      description: 'Date-only resolvesAt 2026-10-31 at -04:00 is read at local 23:59:59.999 (2026-11-01T03:59:59.999Z) → accepted',
      input: eveningCutoffMarketV3('fx3-market-date-only', '2026-10-31'),
    },
    {
      id: 'v3-market-offset-plus-0530',
      description: 'Fractional offset +05:30: sportsbook cutoff 2026-10-30T23:00:00+05:30 on deadline 2026-10-30 → accepted',
      input: toV3(
        { ...baseV2('fx3-plus-0530'), mode: 'market', question: binaryQuestion('2026-10-30'), market: { ...sportsbookTwoWay(), resolvesAt: '2026-10-30T23:00:00+05:30' } },
        '+05:30'
      ),
    },
    {
      id: 'v3-market-offset-plus-0545',
      description: 'Fractional offset +05:45 with a date-only cutoff read at local end of day → accepted',
      input: toV3(
        { ...baseV2('fx3-plus-0545'), mode: 'market', question: binaryQuestion('2026-10-30'), market: sportsbookTwoWay() },
        '+05:45'
      ),
    },
    {
      id: 'v3-market-utc-offset',
      description: 'Explicit +00:00: same probability as the v2 v2-market-sportsbook case, but a new identity (question-2) and hash',
      input: toV3({ ...baseV2('fx-market-sportsbook'), mode: 'market', question: binaryQuestion('2026-10-30'), market: sportsbookTwoWay() }, '+00:00'),
    },
    {
      id: 'v3-judgment-offset-minus-1200',
      description: 'Judgment at the westernmost accepted offset -12:00',
      input: judgmentV3('fx3-judgment-minus-1200', '-12:00'),
    },
    {
      id: 'v3-judgment-offset-plus-1400',
      description: 'Judgment at the easternmost accepted offset +14:00',
      input: judgmentV3('fx3-judgment-plus-1400', '+14:00'),
    },
    {
      id: 'v3-judgment-categorical',
      description: 'Categorical judgment with a local deadline (-05:00)',
      input: toV3(
        { ...baseV2('fx3-judgment-categorical'), mode: 'judgment', question: permitQuestion(), judgment: judgmentCategorical() },
        '-05:00'
      ),
    },
    {
      id: 'v3-judgment-abstain',
      description: 'Abstention with a local deadline: insufficient_basis, still receipted with inputs.deadline',
      input: toV3(
        { ...baseV2('fx3-judgment-abstain'), mode: 'judgment', question: binaryQuestion('2026-10-30'), judgment: { abstain: true, reason: 'Fixture: no basis yet.' } },
        '+09:00'
      ),
    },
    {
      id: 'v3-baserate-horizon-local-end',
      description: 'Date-only horizon 2026-09-27 at +05:30 is evaluated at local 23:59:59.999 (2026-09-27T18:29:59.999Z) → matched',
      input: deadlineBaseRateV3('fx3-baserate-local-end', '+05:30'),
    },
    {
      id: 'v3-baserate-mismatch-local-differs',
      description:
        'Horizon 2026-09-27T02:00:00Z at -04:00 is local 2026-09-26 but UTC 2026-09-27, before the local deadline day → deadline_mismatch naming the local date',
      input: deadlineBaseRateV3('fx3-baserate-local-differs', '-04:00', '2026-09-27T02:00:00Z'),
    },
    {
      id: 'v3-baserate-mixed-date-reading',
      description:
        'One record, two readings: the date-only horizon.by is read at the local end of day at -07:00, while the date-only reference-case filedAt/statusAt and subject.filedAt keep their 00:00Z meaning (SPEC v3 §3.4)',
      input: (() => {
        const t = tteForecast(0, 450);
        return toV3(
          { ...baseV2('fx3-baserate-mixed'), mode: 'baserate', question: binaryQuestion(t.resolveBy), baserate: t.baserate },
          '-07:00'
        );
      })(),
    },
    {
      id: 'v3-baserate-proportion',
      description: 'Proportion base rate: no horizon, horizonDeadlineDate null, deadlineMatched null',
      input: toV3(
        {
          ...baseV2('fx3-baserate-proportion'),
          mode: 'baserate',
          question: binaryQuestion('2027-01-15'),
          baserate: { mode: 'proportion', referenceClass: referenceClass(), cases: proportionCases(3, 5, 2) },
        },
        '-08:00'
      ),
    },
    {
      id: 'v3-profile-tightened-refusal',
      description: 'A profile raising minCases to 9 refuses the x = 3 of n = 8 class (baserate_below_min_cases), with a local deadline',
      input: toV3(
        {
          ...baseV2('fx3-profile'),
          mode: 'baserate',
          question: binaryQuestion('2027-01-15'),
          baserate: { mode: 'proportion', referenceClass: referenceClass(), cases: proportionCases(3, 5, 2) },
          profile: fixtureProfile({ thresholds: { minCases: 9 } }),
        },
        '+01:00'
      ),
    },
    {
      id: 'v3-market-signed',
      description: 'The offset-match market case, signed with the SPEC test key',
      input: eveningCutoffMarketV3('fx3-market-signed'),
      options: { signer: { privateKey: SPEC_KEYS.privateKeySeed, publicKeyRef: SPEC_KEYS.publicKeyRef, signedAt: '2026-09-26T19:05:00Z' } },
    },
  ];
}

export interface ValidationErrorCaseV3 {
  id: string;
  description: string;
  input: unknown;
  error: { code: string; path: string };
}

export function validationErrorCasesV3(): ValidationErrorCaseV3[] {
  const withOffset = (id: string, offset: unknown) => {
    const q = { ...binaryQuestion('2026-10-30'), resolveByOffset: offset };
    return { ...judgmentV3(id, '+00:00'), question: q };
  };
  const { resolveByOffset: _omit, ...noOffsetQuestion } = judgmentV3('x', '+00:00').question;
  return [
    {
      id: 'v3-missing-offset',
      description: 'A missing resolveByOffset is a missing required member: invalid_input (consistent with v2)',
      input: { ...judgmentV3('fx3-missing', '+00:00'), question: noOffsetQuestion },
      error: { code: 'invalid_input', path: 'question.resolveByOffset' },
    },
    { id: 'v3-offset-minus-zero', description: '-00:00 is rejected; UTC is +00:00', input: withOffset('fx3-m00', '-00:00'), error: { code: 'invalid_question', path: 'question.resolveByOffset' } },
    { id: 'v3-offset-minus-1201', description: 'Below -12:00', input: withOffset('fx3-m1201', '-12:01'), error: { code: 'invalid_question', path: 'question.resolveByOffset' } },
    { id: 'v3-offset-plus-1401', description: 'Above +14:00', input: withOffset('fx3-p1401', '+14:01'), error: { code: 'invalid_question', path: 'question.resolveByOffset' } },
    { id: 'v3-offset-plus-2400', description: 'Not a civil offset', input: withOffset('fx3-p2400', '+24:00'), error: { code: 'invalid_question', path: 'question.resolveByOffset' } },
    {
      id: 'v3-asof-at-deadline-end',
      description: 'asOf exactly at the exclusive end of the local deadline day (2026-10-31 at -04:00 ends 2026-11-01T04:00:00Z)',
      input: { ...judgmentV3('fx3-asof-end', '-04:00', '2026-10-31'), asOf: { at: '2026-11-01T04:00:00Z', source: cite('asof-clock-note', '2026-11-01T03:00:00Z') } },
      error: { code: 'invalid_question', path: 'question.resolveBy' },
    },
    {
      id: 'v3-year-range-upper',
      description: '9999-12-31 at -12:00 would end at +010000-01-01T12:00Z: outside years 0000–9999',
      input: judgmentV3('fx3-year-upper', '-12:00', '9999-12-31'),
      error: { code: 'invalid_question', path: 'question.resolveBy' },
    },
    {
      id: 'v3-year-range-upper-exact',
      description: '9999-12-31 at +00:00: the exclusive end is exactly 10000-01-01T00:00Z → rejected',
      input: judgmentV3('fx3-year-upper-exact', '+00:00', '9999-12-31'),
      error: { code: 'invalid_question', path: 'question.resolveBy' },
    },
    {
      id: 'v3-year-range-lower',
      description:
        '0000-01-01 at +14:00 would start at -000001-12-31T10:00Z: outside years 0000–9999. asOf is 0000-01-01T00:00Z (before that local day ends), so only the year-range rule can fire',
      input: {
        ...judgmentV3('fx3-year-lower', '+14:00', '0000-01-01'),
        asOf: { at: '0000-01-01T00:00:00Z', source: cite('asof-clock-note', '0000-01-01T00:00:00Z') },
      },
      error: { code: 'invalid_question', path: 'question.resolveBy' },
    },
    {
      id: 'v3-cutoff-year-range',
      description:
        'Deadline 9999-12-30 at -01:00 with a date-only resolvesAt 9999-12-31 would be read at +010000-01-01T00:59:59.999Z: invalid_input, no receipt',
      input: { ...eveningCutoffMarketV3('fx3-cutoff-year', '9999-12-31', '-01:00'), question: { ...binaryQuestion('9999-12-30'), resolveByOffset: '-01:00' } },
      error: { code: 'invalid_input', path: 'market.resolvesAt' },
    },
    {
      id: 'v3-horizon-year-range',
      description: 'A date-only horizon.by 9999-12-31 read at local end of day at -01:00 falls in year 10000: invalid_input, no receipt',
      input: (() => {
        const b = deadlineBaseRateV3('fx3-horizon-year', '-01:00', '9999-12-31');
        return { ...b, question: { ...b.question, resolveBy: '9999-12-30' } };
      })(),
      error: { code: 'invalid_input', path: 'baserate.horizon.by' },
    },
  ];
}
