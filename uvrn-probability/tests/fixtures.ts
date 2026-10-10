/**
 * Synthetic fixtures for tests and SPEC/vectors/probability-v1.json. Every URL is example.org:
 * these are protocol fixtures, not research. Real cited inputs arrive with M5.
 */

import type { ProbabilityRunInput, RunOptions } from '../src';

export const AS_OF = '2026-09-26T12:00:00-07:00';
export const OUTCOME_HASH = `sha256:${'ab'.repeat(32)}`;

/** Fixed Ed25519 key from SPEC/vectors/network-receipt.json (spec test key, not a real key). */
export const SPEC_KEYS = {
  privateKeySeed: 'dXZybi1zcGVjLXZlY3Rvci1zZWVkLTAwMDAwMDAwMDE=',
  publicKey: 'w3IQVOJs6tNyvvcVJSUT1pPJIorT3V+eFIrCschFyV4=',
  publicKeyRef: 'uvrn-spec-pk-2026-v1',
};

export const cite = (path: string, accessedAt = '2026-09-26T11:00:00-07:00') => ({
  url: `https://example.org/${path}`,
  accessedAt,
});

export function addDays(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

const base = (): Pick<ProbabilityRunInput, 'specVersion' | 'outcome' | 'asOf'> => ({
  specVersion: 'uvrn-probability-input-1',
  outcome: { outcomeHash: OUTCOME_HASH },
  asOf: { at: AS_OF, source: cite('asof-clock-note') },
});

const QUOTED = '2026-09-26T10:30:00-07:00';

export const sportsbookTwoWay = () => ({
  kind: 'sportsbook' as const,
  venue: 'Example Book',
  domain: 'sports/baseball',
  resolvesAt: '2026-10-30',
  targetOutcome: 'Home',
  source: cite('book/market-1'),
  outcomes: [
    { label: 'Home', odds: { format: 'american' as const, value: -150 }, quotedAt: QUOTED, source: cite('book/market-1/home') },
    { label: 'Away', odds: { format: 'american' as const, value: 130 }, quotedAt: QUOTED, source: cite('book/market-1/away') },
  ],
});

export const sportsbookMulti = () => ({
  kind: 'sportsbook' as const,
  venue: 'Example Book',
  domain: 'sports/baseball',
  resolvesAt: '2026-11-05',
  targetOutcome: 'Team A',
  source: cite('book/futures-1'),
  outcomes: [
    { label: 'Team A', odds: { format: 'decimal' as const, value: 2.2 }, quotedAt: QUOTED, source: cite('book/futures-1/a') },
    { label: 'Team B', odds: { format: 'fractional' as const, numerator: 11, denominator: 5 }, quotedAt: QUOTED, source: cite('book/futures-1/b') },
    { label: 'Team C', odds: { format: 'american' as const, value: 350 }, quotedAt: QUOTED, source: cite('book/futures-1/c') },
    { label: 'Team D', odds: { format: 'decimal' as const, value: 7.0 }, quotedAt: QUOTED, source: cite('book/futures-1/d') },
  ],
});

export const exchangeBinary = (overrides: Partial<{ bid: number; ask: number; depthUsd: number; quotedAt: string }> = {}) => ({
  kind: 'exchange' as const,
  venue: 'Example Exchange',
  domain: 'politics/us',
  resolvesAt: '2026-11-04T00:00:00Z',
  targetOutcome: 'Yes',
  source: cite('exchange/contract-1'),
  outcomes: [
    {
      label: 'Yes',
      bid: overrides.bid ?? 0.61,
      ask: overrides.ask ?? 0.63,
      depthUsd: overrides.depthUsd ?? 5000,
      quotedAt: overrides.quotedAt ?? QUOTED,
      source: cite('exchange/contract-1/book'),
    },
  ],
});

export const exchangeMulti = () => ({
  kind: 'exchange' as const,
  venue: 'Example Exchange',
  domain: 'politics/us',
  resolvesAt: '2026-11-04T00:00:00Z',
  targetOutcome: 'Candidate B',
  source: cite('exchange/event-2'),
  outcomes: [
    { label: 'Candidate A', bid: 0.47, ask: 0.49, depthUsd: 9000, quotedAt: QUOTED, source: cite('exchange/event-2/a') },
    { label: 'Candidate B', bid: 0.4, ask: 0.42, depthUsd: 7000, quotedAt: QUOTED, source: cite('exchange/event-2/b') },
    { label: 'Candidate C', bid: 0.12, ask: 0.14, depthUsd: 2500, quotedAt: QUOTED, source: cite('exchange/event-2/c') },
  ],
});

export const referenceClass = () => ({
  id: 'example-transmission-cpcn',
  description: 'Synthetic reference class: state-commission CPCN applications for transmission lines',
  source: cite('reference-class/definition'),
  criteria: [
    { id: 'commission', text: 'Decided by the state utilities commission', source: cite('criteria/commission') },
    { id: 'cpcn-transmission', text: 'CPCN application for a transmission line', source: cite('criteria/cpcn') },
  ],
});

const BOTH = ['commission', 'cpcn-transmission'];

export function proportionCases(yes: number, no: number, excluded = 0) {
  const cases = [];
  for (let i = 0; i < yes + no; i += 1) {
    cases.push({
      id: `case-${String(i + 1).padStart(2, '0')}`,
      source: cite(`cases/${i + 1}`),
      meetsCriteria: BOTH,
      outcome: i < yes ? ('yes' as const) : ('no' as const),
      resolvedAt: addDays('2021-01-01', i * 30),
    });
  }
  for (let i = 0; i < excluded; i += 1) {
    cases.push({
      id: `excluded-${i + 1}`,
      source: cite(`cases/excluded-${i + 1}`),
      meetsCriteria: ['commission'],
      outcome: 'yes' as const,
      resolvedAt: addDays('2022-01-01', i * 30),
    });
  }
  return cases;
}

/**
 * Hand-computed Aalen-Johansen example (days from filing; 1 = approved, 2 = denied/withdrawn, 0 = pending):
 *   100:A  150:D  200:A  200:W  250:P  300:A  350:D  400:A  450:P  500:A
 * See tests/baserate.test.ts for the row-by-row arithmetic.
 */
export const TTE_EVENTS: Array<[number, 'approved' | 'denied' | 'withdrawn' | 'pending']> = [
  [100, 'approved'],
  [150, 'denied'],
  [200, 'approved'],
  [200, 'withdrawn'],
  [250, 'pending'],
  [300, 'approved'],
  [350, 'denied'],
  [400, 'approved'],
  [450, 'pending'],
  [500, 'approved'],
];

export function tteCases(events = TTE_EVENTS) {
  return events.map(([days, status], i) => ({
    id: `docket-${String(i + 1).padStart(2, '0')}`,
    source: cite(`dockets/${i + 1}`),
    meetsCriteria: BOTH,
    filedAt: '2020-01-01',
    status,
    statusAt: addDays('2020-01-01', days),
  }));
}

export function tteBaseRate(elapsedDays: number, horizonDays: number, events = TTE_EVENTS) {
  const filedAt = addDays('2026-09-26', -elapsedDays);
  return {
    mode: 'time-to-event' as const,
    referenceClass: referenceClass(),
    cases: tteCases(events),
    subject: { id: 'subject-application', filedAt, source: cite('dockets/subject') },
    horizon: { by: addDays(filedAt, horizonDays) },
    targetEvent: 'approved' as const,
  };
}

export interface VectorCase {
  id: string;
  description: string;
  input: ProbabilityRunInput;
  options?: RunOptions;
}

export function vectorCases(): VectorCase[] {
  return [
    {
      id: 'sportsbook-two-way',
      description: 'American -150/+130; power de-vig default; multiplicative/power/Shin spread is the band',
      input: { ...base(), market: sportsbookTwoWay() },
    },
    {
      id: 'sportsbook-multi-outcome',
      description: 'Four-outcome futures in mixed decimal/fractional/american formats',
      input: { ...base(), market: sportsbookMulti() },
    },
    {
      id: 'exchange-binary',
      description: 'Single YES contract, bid 0.61 / ask 0.63: midpoint with the spread as band',
      input: { ...base(), market: exchangeBinary() },
    },
    {
      id: 'exchange-multi-outcome',
      description: 'Three exclusive contracts; midpoints normalized to sum to 1',
      input: { ...base(), market: exchangeMulti() },
    },
    {
      id: 'market-stale-refusal',
      description: 'Quote 30h before asOf exceeds the 24h staleness limit; no base rate → insufficient_basis',
      input: { ...base(), market: exchangeBinary({ quotedAt: '2026-09-25T06:00:00-07:00' }) },
    },
    {
      id: 'stale-market-falls-back-to-baserate',
      description: 'Stale market is refused and reported; the base rate is selected by precedence',
      input: {
        ...base(),
        market: exchangeBinary({ quotedAt: '2026-09-25T06:00:00-07:00' }),
        baserate: { mode: 'proportion', referenceClass: referenceClass(), cases: proportionCases(3, 5) },
      },
    },
    {
      id: 'market-wins-over-baserate',
      description: 'Both candidates usable: market selected, base rate reported as not-selected',
      input: {
        ...base(),
        market: exchangeBinary(),
        baserate: { mode: 'proportion', referenceClass: referenceClass(), cases: proportionCases(3, 5) },
      },
    },
    {
      id: 'baserate-small-n',
      description: 'x = 3 of n = 8 (two cases excluded by the criteria gate): Jeffreys 0.119039–0.705177',
      input: { ...base(), baserate: { mode: 'proportion', referenceClass: referenceClass(), cases: proportionCases(3, 5, 2) } },
    },
    {
      id: 'baserate-x-zero',
      description: 'x = 0 of n = 10: lower bound pinned to 0; point estimate 0.5/11',
      input: { ...base(), baserate: { mode: 'proportion', referenceClass: referenceClass(), cases: proportionCases(0, 10) } },
    },
    {
      id: 'baserate-x-equals-n',
      description: 'x = n = 10: upper bound pinned to 1; point estimate 10.5/11',
      input: { ...base(), baserate: { mode: 'proportion', referenceClass: referenceClass(), cases: proportionCases(10, 0) } },
    },
    {
      id: 'baserate-censored-competing',
      description: 'Aalen-Johansen with competing (denied/withdrawn) and censored (pending) cases; approved by day 450 = 0.44',
      input: { ...base(), baserate: tteBaseRate(0, 450) },
    },
    {
      id: 'baserate-conditional',
      description: 'Pending ~220 days at asOf; P(approved by day 420 | pending) = (0.44 − 0.2)/0.6 = 0.4',
      input: { ...base(), baserate: tteBaseRate(220, 420) },
    },
    {
      id: 'baserate-below-min-cases',
      description: 'Only 7 cases meet every declared criterion (minCases = 8) → refusal',
      input: { ...base(), baserate: { mode: 'proportion', referenceClass: referenceClass(), cases: proportionCases(4, 3, 3) } },
    },
    {
      id: 'baserate-horizon-beyond-followup',
      description: 'Last case is still pending at day 450; a day-600 horizon is outside the data → refusal',
      input: { ...base(), baserate: tteBaseRate(0, 600, TTE_EVENTS.slice(0, 9)) },
    },
    {
      id: 'no-candidate',
      description: 'Neither market nor base rate supplied → insufficient_basis with no_candidate',
      input: { ...base() },
    },
    {
      id: 'signed-exchange-binary',
      description: 'exchange-binary signed with the SPEC test key (Ed25519 is deterministic)',
      input: { ...base(), market: exchangeBinary() },
      options: {
        signer: {
          privateKey: SPEC_KEYS.privateKeySeed,
          publicKeyRef: SPEC_KEYS.publicKeyRef,
          signedAt: '2026-09-26T19:00:00.000Z',
        },
      },
    },
  ];
}
