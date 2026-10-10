/**
 * Synthetic version-2 fixtures for tests and SPEC/vectors/probability-v2.json. Every URL is
 * example.org and every question is invented: these are protocol fixtures, never real claims
 * (no real World Series, permit, or market forecast is asserted here).
 */

import { canonicalize, formatReceiptHash } from '@uvrn/receipt/canonical';
import { sha256Hex } from '@uvrn/receipt';
import type { ForecastInputV2, ForecastOptions } from '../src';
import {
  addDays,
  cite,
  exchangeBinary,
  proportionCases,
  referenceClass,
  sportsbookTwoWay,
  SPEC_KEYS,
  tteBaseRate,
  TTE_EVENTS,
} from './fixtures';

export const AS_OF_V2 = '2026-09-26T12:00:00-07:00';

export const binaryQuestion = (resolveBy = '2026-10-30') => ({
  text: 'Will the synthetic Example Home team win the fixture series?',
  resolveBy,
  resolutionRule: 'Resolves YES if the example.org fixture results page lists Example Home as series winner by the deadline.',
  kind: 'binary' as const,
  outcomes: [
    { id: 'yes', label: 'Yes', definition: 'Example Home is listed as series winner by the deadline.' },
    { id: 'no', label: 'No', definition: 'Example Home is not listed as series winner by the deadline.' },
  ],
  partitionConfirmed: true as const,
});

export const permitQuestion = () => ({
  text: 'What is the status of the synthetic Example Line permit application at the deadline?',
  resolveBy: '2027-06-30',
  resolutionRule: 'Status on the example.org commission docket page at 23:59:59Z on the deadline.',
  kind: 'categorical' as const,
  outcomes: [
    { id: 'approved', label: 'Approved', definition: 'The commission has issued an approval order.' },
    { id: 'denied-or-withdrawn', label: 'Denied or withdrawn', definition: 'The commission denied the application or the applicant withdrew it.' },
    { id: 'pending', label: 'Still pending', definition: 'No approval, denial, or withdrawal has been recorded.' },
  ],
  partitionConfirmed: true as const,
});

export const agentProducer = () => ({ id: 'fixture-agent-1', kind: 'agent' as const, model: 'fixture-model' });

const base = (forecastId: string) => ({
  specVersion: 'uvrn-probability-input-2' as const,
  forecastId,
  asOf: { at: AS_OF_V2, source: cite('asof-clock-note') },
  producer: agentProducer(),
});

export const judgmentBinary = () => ({
  probabilities: [
    { outcomeId: 'yes', p: 0.71 },
    { outcomeId: 'no', p: 0.29 },
  ],
  evidence: [{ id: 'e1', statement: 'Fixture standings page shows Example Home leading.', source: cite('standings') }],
  rationale: 'Fixture lead and schedule favor Example Home.',
  counterarguments: ['Injuries could reverse the lead.', 'Small samples mislead.'],
  uncertainty: 'Roster news after asOf is unknown; a lineup change would move this materially.',
  range: { low: 0.6, high: 0.8, rationale: 'Plausible spread of reasonable fixture readings.' },
});

export const judgmentCategorical = () => ({
  probabilities: [
    { outcomeId: 'pending', p: 0.1 },
    { outcomeId: 'approved', p: 0.6 },
    { outcomeId: 'denied-or-withdrawn', p: 0.3 },
  ],
  evidence: [{ id: 'docket', statement: 'Fixture docket shows hearings concluded.', source: cite('docket') }],
  assumptions: [{ id: 'a1', statement: 'Assume no new intervenors join before the deadline.' }],
  rationale: 'Hearings concluded; comparable fixture dockets usually close with approval.',
  counterarguments: ['Staff recommended conditions that could trigger withdrawal.'],
  uncertainty: 'Commission calendar after asOf is unknown.',
});

export const judgmentAssumptionOnly = () => ({
  probabilities: [
    { outcomeId: 'yes', p: 0.4 },
    { outcomeId: 'no', p: 0.6 },
  ],
  assumptions: [{ id: 'a1', statement: 'Speculative: assume the fixture teams are evenly matched with slight away edge.' }],
  rationale: 'No sources were read; this is a labeled speculative prior.',
  counterarguments: ['Any real evidence would supersede this prior.'],
  uncertainty: 'Entirely assumption-driven; wide plausible range.',
});

/** A valid uvrn-outcome-1 declaration binding for the YES outcome, hashed through the shared primitives. */
export function yesDeclaration(resolveBy = '2026-10-30') {
  const fields = {
    specVersion: 'uvrn-outcome-1' as const,
    entryId: 'fixture-run-1',
    predictedOutcome: 'Example Home wins the fixture series.',
    outcomeMetric: 'Fixture results page series winner',
    resolveBy,
    declaredAt: '2026-09-20T00:00:00.000Z',
  };
  return { ...fields, outcomeHash: formatReceiptHash(sha256Hex(canonicalize(fields))) };
}

/** Time-to-event fixtures pin v2 horizons to the question deadline. */
export function tteForecast(elapsedDays: number, horizonDays: number, events = TTE_EVENTS) {
  const baserate = tteBaseRate(elapsedDays, horizonDays, events);
  return { baserate, resolveBy: baserate.horizon.by };
}

/** Every at-risk case pending past the horizon: F = 0 and se = 0, so the log-log interval is undefined. */
export const CENSORED_DEGENERATE_EVENTS: Array<[number, 'pending']> = Array.from({ length: 8 }, () => [400, 'pending']);

/** Every at-risk case approved inside the window: F = 1 (S reaches 0, finite tail), interval undefined. */
export const ALL_APPROVED_EVENTS: Array<[number, 'approved']> = Array.from({ length: 8 }, (_, i) => [100 + i * 10, 'approved']);

/**
 * The end-of-day deadline case (SPEC v2 §3.5, §6.2 item 5): asOf = subject filing, eight cases filed
 * 2025-01-01T00:00:00Z with fractional-day durations. Date-only and 23:59:59.999Z horizons both give 0.5.
 */
export const DEADLINE_AS_OF = '2026-09-26T00:00:00Z';
export function deadlineBaseRate(horizonBy: string) {
  const filed = Date.parse('2025-01-01T00:00:00Z');
  const events: Array<[number, 'approved' | 'denied' | 'pending']> = [
    [0.5, 'approved'],
    [0.5, 'approved'],
    [1.5, 'approved'],
    [1.5, 'approved'],
    [1.75, 'denied'],
    [1.75, 'denied'],
    [3, 'pending'],
    [3, 'pending'],
  ];
  const rc = referenceClass();
  return {
    mode: 'time-to-event' as const,
    referenceClass: rc,
    cases: events.map(([days, status], i) => ({
      id: `deadline-case-${i + 1}`,
      source: cite(`deadline/cases/${i + 1}`),
      meetsCriteria: rc.criteria.map((c) => c.id),
      filedAt: '2025-01-01T00:00:00Z',
      status,
      statusAt: new Date(filed + days * 86_400_000).toISOString(),
    })),
    subject: { id: 'deadline-subject', filedAt: DEADLINE_AS_OF, source: cite('deadline/subject') },
    horizon: { by: horizonBy },
    targetEvent: 'approved' as const,
  };
}

export function deadlineForecastInput(forecastId: string, horizonBy: string): ForecastInputV2 {
  return {
    specVersion: 'uvrn-probability-input-2',
    forecastId,
    mode: 'baserate',
    question: binaryQuestion('2026-09-27'),
    asOf: { at: DEADLINE_AS_OF, source: cite('asof-clock-note', '2026-09-25T23:00:00Z') },
    producer: agentProducer(),
    baserate: deadlineBaseRate(horizonBy),
    thresholds: { minCases: 8 },
  };
}

/**
 * The end-of-day event-cutoff case (SPEC v2 §3.5): asOf is 2026-09-26T19:00Z, so a date-only
 * `resolvesAt` of that same UTC date is after asOf only when read at the end of the day.
 */
export const SAME_DAY = '2026-09-26';
export function sameDayMarketInput(forecastId: string, resolvesAt: string): ForecastInputV2 {
  return {
    ...base(forecastId),
    mode: 'market',
    question: binaryQuestion(SAME_DAY),
    market: { ...exchangeBinary(), resolvesAt },
  };
}

/** A synthetic tighten-only rule profile (SPEC v2 §8.1). Domain-neutral; ids are invented. */
export const fixtureProfile = (overrides: Record<string, unknown> = {}): NonNullable<ForecastInputV2['profile']> =>
  ({
    specVersion: 'uvrn-probability-profile-1',
    id: 'fixture-strict-profile',
    version: '1.0.0',
    ...overrides,
  }) as NonNullable<ForecastInputV2['profile']>;

export interface ValidationErrorCaseV2 {
  id: string;
  description: string;
  input: unknown;
  error: { code: string; path: string };
}

/** Requests that a rule profile rejects with a typed validation error (no receipt). */
export function profileErrorCasesV2(): ValidationErrorCaseV2[] {
  const judgmentInput = () => ({ ...base('fx-profile-judgment'), mode: 'judgment' as const, question: binaryQuestion(), judgment: judgmentBinary() });
  return [
    {
      id: 'v2-profile-mode-not-allowed',
      description: 'Profile allows judgment only; a market request fails with profile_violation',
      input: {
        ...base('fx-profile-market'),
        mode: 'market',
        question: binaryQuestion('2026-10-30'),
        market: sportsbookTwoWay(),
        profile: fixtureProfile({ allowedModes: ['judgment'] }),
      },
      error: { code: 'profile_violation', path: 'mode' },
    },
    {
      id: 'v2-profile-unknown-field',
      description: 'An undeclared profile member fails closed with unknown_field',
      input: { ...judgmentInput(), profile: fixtureProfile({ callback: 'not allowed' }) },
      error: { code: 'unknown_field', path: 'profile.callback' },
    },
    {
      id: 'v2-profile-loosening-rejected',
      description: 'A profile minCases below the default (8) would loosen it and fails with invalid_profile',
      input: {
        ...base('fx-profile-loosen'),
        mode: 'baserate',
        question: binaryQuestion('2027-01-15'),
        baserate: { mode: 'proportion', referenceClass: referenceClass(), cases: proportionCases(3, 5, 2) },
        profile: fixtureProfile({ thresholds: { minCases: 4 } }),
      },
      error: { code: 'invalid_profile', path: 'profile.thresholds.minCases' },
    },
    {
      id: 'v2-profile-requirement-unmet',
      description: 'Profile requires cited evidence; an assumption-only judgment fails with profile_violation',
      input: { ...judgmentInput(), judgment: judgmentAssumptionOnly(), profile: fixtureProfile({ require: { citedEvidence: true } }) },
      error: { code: 'profile_violation', path: 'judgment.evidence' },
    },
  ];
}

export interface VectorCaseV2 {
  id: string;
  description: string;
  input: ForecastInputV2;
  options?: ForecastOptions;
}

export function vectorCasesV2(): VectorCaseV2[] {
  const tteMain = tteForecast(0, 450);
  const atRiskOk = tteForecast(220, 420);
  const atRiskShort = tteForecast(260, 420);
  const degenerate = tteForecast(50, 300, CENSORED_DEGENERATE_EVENTS);
  return [
    {
      id: 'v2-market-sportsbook',
      description: 'Sportsbook -150/+130 mapped to YES; power de-vig; band kind method-spread (no confidence)',
      input: { ...base('fx-market-sportsbook'), mode: 'market', question: binaryQuestion('2026-10-30'), market: sportsbookTwoWay() },
    },
    {
      id: 'v2-market-exchange-settles-later',
      description: 'Exchange YES contract; event cutoff matches the deadline, settlesAt is the next day → accepted; band kind bid-ask',
      input: {
        ...base('fx-market-exchange'),
        mode: 'market',
        question: binaryQuestion('2026-11-04'),
        market: { ...exchangeBinary(), settlesAt: '2026-11-05' },
      },
    },
    {
      id: 'v2-market-deadline-mismatch',
      description: 'Exchange event cutoff one day after the question deadline → deadline_mismatch refusal',
      input: { ...base('fx-market-mismatch'), mode: 'market', question: binaryQuestion('2026-11-03'), market: exchangeBinary() },
    },
    {
      id: 'v2-market-cutoff-same-day-date-only',
      description: "Date-only event cutoff on asOf's own UTC date is read as 23:59:59.999Z (SPEC v2 §3.5) → accepted",
      input: sameDayMarketInput('fx-market-same-day-date', SAME_DAY),
    },
    {
      id: 'v2-market-cutoff-same-day-zoned',
      description: 'The explicit 23:59:59.999Z event cutoff: same probability and timing as the date-only case',
      input: sameDayMarketInput('fx-market-same-day-zoned', `${SAME_DAY}T23:59:59.999Z`),
    },
    {
      id: 'v2-baserate-proportion',
      description: 'Jeffreys x = 3 of n = 8; band kind statistical, confidence 0.95',
      input: {
        ...base('fx-baserate-proportion'),
        mode: 'baserate',
        question: binaryQuestion('2027-01-15'),
        baserate: { mode: 'proportion', referenceClass: referenceClass(), cases: proportionCases(3, 5, 2) },
      },
    },
    {
      id: 'v2-baserate-competing',
      description: 'Aalen-Johansen with competing and censored cases: approved by day 450 = 0.44 (hand-checked)',
      input: { ...base('fx-baserate-competing'), mode: 'baserate', question: binaryQuestion(tteMain.resolveBy), baserate: tteMain.baserate },
    },
    {
      id: 'v2-baserate-at-risk-boundary-accepted',
      description: 'minCases 6; exactly 6 cases at risk after ~220.8 days → accepted, P = 0.4',
      input: {
        ...base('fx-at-risk-6'),
        mode: 'baserate',
        question: binaryQuestion(atRiskOk.resolveBy),
        baserate: atRiskOk.baserate,
        thresholds: { minCases: 6 },
      },
    },
    {
      id: 'v2-baserate-at-risk-boundary-refused',
      description: 'minCases 6; only 5 cases at risk after ~260.8 days → baserate_below_min_at_risk',
      input: {
        ...base('fx-at-risk-5'),
        mode: 'baserate',
        question: binaryQuestion(atRiskShort.resolveBy),
        baserate: atRiskShort.baserate,
        thresholds: { minCases: 6 },
      },
    },
    {
      id: 'v2-baserate-interval-unavailable',
      description: 'All 8 at-risk cases censored past the horizon: F = 0, se = 0 → baserate_interval_unavailable (no binomial fallback)',
      input: { ...base('fx-degenerate'), mode: 'baserate', question: binaryQuestion(degenerate.resolveBy), baserate: degenerate.baserate },
    },
    {
      id: 'v2-baserate-deadline-date-only',
      description: 'Date-only horizon.by 2026-09-27 is evaluated at 23:59:59.999Z: 4 of 8 approvals inside → P = 0.5 (v1 00:00Z reading would give 0.25)',
      input: deadlineForecastInput('fx-deadline-date', '2026-09-27'),
    },
    {
      id: 'v2-baserate-deadline-zoned',
      description: 'Zoned horizon.by 2026-09-27T23:59:59.999Z: same questionHash and P = 0.5 as the date-only form',
      input: deadlineForecastInput('fx-deadline-zoned', '2026-09-27T23:59:59.999Z'),
    },
    {
      id: 'v2-profile-min-cases-refusal',
      description: 'Same class as v2-baserate-proportion (8 cases), but a profile raises minCases to 10 → baserate_below_min_cases',
      input: {
        ...base('fx-profile-min-cases'),
        mode: 'baserate',
        question: binaryQuestion('2027-01-15'),
        baserate: { mode: 'proportion', referenceClass: referenceClass(), cases: proportionCases(3, 5, 2) },
        profile: fixtureProfile({ allowedModes: ['baserate', 'judgment'], thresholds: { minCases: 10 } }),
      },
    },
    {
      id: 'v2-profile-judgment-accepted',
      description: 'Judgment satisfying a profile (judgment only, cited evidence and range required); result records profile id, version, and hash',
      input: {
        ...base('fx-profile-judgment'),
        mode: 'judgment',
        question: binaryQuestion(),
        judgment: judgmentBinary(),
        profile: fixtureProfile({ allowedModes: ['judgment'], require: { citedEvidence: true, judgmentRange: true } }),
      },
    },
    {
      id: 'v2-judgment-binary',
      description: 'Binary judgment 0.71 / 0.29 with cited evidence and a subjective range',
      input: { ...base('fx-judgment-binary'), mode: 'judgment', question: binaryQuestion(), judgment: judgmentBinary() },
    },
    {
      id: 'v2-judgment-categorical',
      description: 'Categorical judgment approved 0.60 / denied-or-withdrawn 0.30 / pending 0.10, reordered to question order',
      input: { ...base('fx-judgment-categorical'), mode: 'judgment', question: permitQuestion(), judgment: judgmentCategorical() },
    },
    {
      id: 'v2-judgment-assumption-only',
      description: 'Assumption-only judgment: accepted and labeled assumption-only',
      input: { ...base('fx-judgment-assumption'), mode: 'judgment', question: binaryQuestion(), judgment: judgmentAssumptionOnly() },
    },
    {
      id: 'v2-judgment-abstain',
      description: 'Explicit abstention → insufficient_basis with judgment_abstained, null probabilities, still receipted',
      input: {
        ...base('fx-judgment-abstain'),
        mode: 'judgment',
        question: binaryQuestion(),
        judgment: { abstain: true, reason: 'No usable information at asOf.' },
      },
    },
    {
      id: 'v2-judgment-declaration-revision-signed',
      description: 'Judgment with a uvrn-outcome-1 binding on YES and a revision link; signed with the SPEC test key',
      input: {
        ...base('fx-judgment-revision'),
        mode: 'judgment',
        question: {
          ...binaryQuestion(),
          outcomes: [{ ...binaryQuestion().outcomes[0], outcomeDeclaration: yesDeclaration() }, binaryQuestion().outcomes[1]],
        },
        judgment: judgmentBinary(),
        revision: { previousProbabilityHash: `sha256:${'cd'.repeat(32)}`, reason: 'Fixture: new standings page read.' },
      },
      options: {
        signer: { privateKey: SPEC_KEYS.privateKeySeed, publicKeyRef: SPEC_KEYS.publicKeyRef, signedAt: '2026-09-26T19:05:00.000Z' },
      },
    },
  ];
}

export { addDays, cite, SPEC_KEYS };
