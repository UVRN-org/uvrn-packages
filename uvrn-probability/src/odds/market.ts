/**
 * Market evaluation (SPEC §4.1–4.3): cited sportsbook or exchange quotes → a market-implied
 * candidate with a band, or typed refusals. Exchange and sportsbook prices are labeled
 * "market-implied"; v1 applies no favorite-longshot or horizon bias correction.
 */

import { citationProblem, copyCitation, type Citation } from '../common/citation';
import { refusal, type AnyRefusal, type Refusal } from '../common/refusal';
import { round6, clamp01 } from '../common/round';
import { MS_PER_DAY, parseDateOrZoned, parseZoned } from '../common/time';
import type { Candidate, CandidateStatus, EvaluationContext, Evaluation } from '../common/types';
import {
  DEFAULT_DEVIG_METHOD,
  devigMultiplicative,
  devigPower,
  devigShin,
  exchangeMid,
  impliedProbability,
  normalizeToOne,
  overround,
  type DevigMethod,
  type OddsValue,
} from './math';

export interface SportsbookOutcome {
  label: string;
  odds: OddsValue;
  /** Zoned ISO timestamp when the price was quoted. */
  quotedAt: string;
  source: Citation;
}

export interface ExchangeOutcome {
  label: string;
  /** Best bid, probability units [0, 1] (e.g. 0.41 for a 41¢ contract). */
  bid: number;
  /** Best ask, probability units [0, 1]. */
  ask: number;
  /** Cited USD notional resting at best bid plus best ask. */
  depthUsd: number;
  quotedAt: string;
  source: Citation;
}

export interface MarketInput {
  kind: 'sportsbook' | 'exchange';
  /** Venue name, e.g. "Kalshi", "DraftKings". */
  venue: string;
  /** Question domain, e.g. "sports/baseball", "politics/us" — recorded for later bias study. */
  domain: string;
  /** When the market resolves (calendar date or zoned timestamp). */
  resolvesAt: string;
  /** The outcome label that corresponds to the declared uvrn-outcome-1 prediction. */
  targetOutcome: string;
  /** Mutually exclusive, exhaustive outcomes (sportsbook ≥ 2; exchange ≥ 1). */
  outcomes: Array<SportsbookOutcome | ExchangeOutcome>;
  /** Citation for the market itself (rules / listing page). */
  source: Citation;
}

export interface MarketOutcomeRecord {
  label: string;
  quotedAt: string;
  ageHours: number | null;
  source: Citation | null;
  odds?: OddsValue;
  impliedP?: number;
  bid?: number;
  ask?: number;
  mid?: number;
  depthUsd?: number;
}

export interface MarketInputRecord {
  role: 'market';
  status: CandidateStatus;
  kind: 'sportsbook' | 'exchange';
  venue: string;
  domain: string;
  priceLabel: 'market-implied';
  biasCorrection: 'none';
  resolvesAt: string;
  timeToResolutionDays: number | null;
  targetOutcome: string;
  source: Citation | null;
  outcomes: MarketOutcomeRecord[];
  sportsbook?: {
    overround: number;
    defaultMethod: DevigMethod;
    multiplicative: number[] | null;
    power: number[] | null;
    shin: number[] | null;
    powerK: number | null;
    shinZ: number | null;
    methodSpread: number | null;
  };
  exchange?: {
    spread: number;
    depthUsd: number;
    normalizationSum: number | null;
  };
  candidate: Candidate | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function copyOdds(odds: OddsValue): OddsValue {
  return odds.format === 'fractional'
    ? { format: 'fractional', numerator: odds.numerator, denominator: odds.denominator }
    : { format: odds.format, value: odds.value };
}

function roundAll(values: number[] | null): number[] | null {
  return values ? values.map(round6) : null;
}

/**
 * Opt-in rules used by version 2 (SPEC/uvrn-probability-v2.md §3.5). Every flag defaults to
 * false, which is exactly the version-1 behavior.
 */
export interface MarketPolicy {
  /** A date-only `resolvesAt` is read as 23:59:59.999Z of that UTC day instead of 00:00Z. */
  resolvesEndOfUtcDay?: boolean;
  /**
   * Version 3 only: with `resolvesEndOfUtcDay`, read a date-only `resolvesAt` at the end of that
   * day at this fixed UTC offset (local 23:59:59.999) instead of UTC. Omitted or 0 is exactly the
   * version-2 reading. Only the v3 path in `forecast/modes.ts` sets it.
   */
  endOfDayOffsetMinutes?: number;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * marketCutoffInstantMs returns the instant a market's `resolvesAt` is read as, or null when it
 * does not parse. Without the v2 policy this is exactly v1's parseDateOrZoned.
 */
export function marketCutoffInstantMs(resolvesAt: unknown, policy: MarketPolicy = {}): number | null {
  const ms = parseDateOrZoned(resolvesAt);
  if (ms === null || !policy.resolvesEndOfUtcDay || !DATE_ONLY.test(resolvesAt as string)) return ms;
  return ms - (policy.endOfDayOffsetMinutes ?? 0) * 60_000 + MS_PER_DAY - 1;
}

/**
 * evaluateMarket turns one cited market into a candidate. Every problem found is reported;
 * the candidate is null whenever any refusal applies.
 */
export function evaluateMarket(
  input: MarketInput,
  ctx: EvaluationContext,
  policy: MarketPolicy = {}
): Evaluation<MarketInputRecord> {
  const refusals: AnyRefusal[] = [];
  const refuse = (code: Refusal['code'], message: string) => refusals.push(refusal(code, 'market', message));
  const m = (isRecord(input) ? input : {}) as Partial<MarketInput>;

  const kind = m.kind === 'sportsbook' || m.kind === 'exchange' ? m.kind : null;
  if (!kind) refuse('invalid_input', 'market.kind must be "sportsbook" or "exchange"');
  for (const key of ['venue', 'domain', 'targetOutcome'] as const) {
    if (typeof m[key] !== 'string' || (m[key] as string).length === 0) {
      refuse('invalid_input', `market.${key} must be a non-empty string`);
    }
  }
  const marketCitationProblem = citationProblem(m.source);
  if (marketCitationProblem) refuse('missing_citation', `market.source: ${marketCitationProblem}`);

  const resolvesMs = marketCutoffInstantMs(m.resolvesAt, policy);
  let timeToResolutionDays: number | null = null;
  if (resolvesMs === null) {
    refuse('invalid_input', 'market.resolvesAt must be a calendar date or zoned ISO timestamp');
  } else {
    timeToResolutionDays = round6((resolvesMs - ctx.asOfMs) / MS_PER_DAY);
    if (resolvesMs <= ctx.asOfMs) {
      refuse('market_resolves_before_asof', 'the market resolves at or before asOf; a price is not a forecast');
    }
  }

  const rawOutcomes = Array.isArray(m.outcomes) ? m.outcomes : [];
  const minOutcomes = kind === 'exchange' ? 1 : 2;
  if (rawOutcomes.length < minOutcomes) {
    refuse('invalid_input', `market.outcomes must list at least ${minOutcomes} outcome(s) for ${kind ?? 'this market'}`);
  }

  const labels = new Set<string>();
  const outcomeRecords: MarketOutcomeRecord[] = [];
  const implied: number[] = [];
  const bids: number[] = [];
  const asks: number[] = [];
  const depths: number[] = [];

  rawOutcomes.forEach((raw, index) => {
    const o = (isRecord(raw) ? raw : {}) as Record<string, unknown>;
    const label = typeof o.label === 'string' ? o.label : '';
    if (!label) refuse('invalid_input', `market.outcomes[${index}].label must be a non-empty string`);
    else if (labels.has(label)) refuse('invalid_input', `market.outcomes label "${label}" is duplicated`);
    labels.add(label);

    const problem = citationProblem(o.source);
    if (problem) refuse('missing_citation', `market.outcomes[${index}].source: ${problem}`);

    const quotedMs = parseZoned(o.quotedAt);
    let ageHours: number | null = null;
    if (quotedMs === null) {
      refuse('invalid_input', `market.outcomes[${index}].quotedAt must be a zoned ISO timestamp`);
    } else if (quotedMs > ctx.asOfMs) {
      refuse('market_quote_after_asof', `quote for "${label}" is timestamped after asOf`);
    } else {
      ageHours = round6((ctx.asOfMs - quotedMs) / 3_600_000);
      if (ctx.asOfMs - quotedMs > ctx.thresholds.maxQuoteStalenessMs) {
        refuse(
          'market_quote_stale',
          `quote for "${label}" is ${ageHours}h old; the limit is ${ctx.thresholds.maxQuoteStalenessMs / 3_600_000}h`
        );
      }
    }

    const rec: MarketOutcomeRecord = {
      label,
      quotedAt: typeof o.quotedAt === 'string' ? o.quotedAt : '',
      ageHours,
      source: problem ? null : copyCitation(o.source as Citation),
    };

    if (kind === 'sportsbook') {
      const q = impliedProbability(o.odds as OddsValue);
      if (q === null) {
        refuse('market_invalid_odds', `market.outcomes[${index}].odds is not a valid american, decimal, or fractional price`);
      } else {
        rec.odds = copyOdds(o.odds as OddsValue);
        rec.impliedP = round6(q);
        implied.push(q);
      }
    } else if (kind === 'exchange') {
      const bid = o.bid;
      const ask = o.ask;
      const depth = o.depthUsd;
      const valid =
        typeof bid === 'number' &&
        typeof ask === 'number' &&
        typeof depth === 'number' &&
        Number.isFinite(bid) &&
        Number.isFinite(ask) &&
        Number.isFinite(depth) &&
        bid >= 0 &&
        ask <= 1 &&
        bid <= ask &&
        depth >= 0;
      if (!valid) {
        refuse('market_invalid_odds', `market.outcomes[${index}] needs 0 ≤ bid ≤ ask ≤ 1 and depthUsd ≥ 0`);
      } else {
        rec.bid = bid;
        rec.ask = ask;
        rec.mid = round6(exchangeMid(bid, ask));
        rec.depthUsd = depth;
        bids.push(bid);
        asks.push(ask);
        depths.push(depth);
      }
    }
    outcomeRecords.push(rec);
  });

  const targetIndex = rawOutcomes.findIndex(
    (o) => isRecord(o) && typeof m.targetOutcome === 'string' && o.label === m.targetOutcome
  );
  if (typeof m.targetOutcome === 'string' && m.targetOutcome && targetIndex < 0) {
    refuse('market_target_not_found', `targetOutcome "${m.targetOutcome}" is not one of the listed outcomes`);
  }

  const record: MarketInputRecord = {
    role: 'market',
    status: 'refused',
    kind: kind ?? 'sportsbook',
    venue: typeof m.venue === 'string' ? m.venue : '',
    domain: typeof m.domain === 'string' ? m.domain : '',
    priceLabel: 'market-implied',
    biasCorrection: 'none',
    resolvesAt: typeof m.resolvesAt === 'string' ? m.resolvesAt : '',
    timeToResolutionDays,
    targetOutcome: typeof m.targetOutcome === 'string' ? m.targetOutcome : '',
    source: marketCitationProblem ? null : copyCitation(m.source as Citation),
    outcomes: outcomeRecords,
    candidate: null,
  };

  let candidate: Candidate | null = null;
  const pricesComplete =
    kind === 'sportsbook' ? implied.length === rawOutcomes.length : bids.length === rawOutcomes.length;

  if (kind === 'sportsbook' && pricesComplete && implied.length >= 2) {
    const over = overround(implied);
    const multiplicative = devigMultiplicative(implied);
    let power: number[] | null = null;
    let shin: number[] | null = null;
    let powerK: number | null = null;
    let shinZ: number | null = null;
    if (over < 0 || over > ctx.thresholds.maxSportsbookOverround) {
      refuse(
        'market_overround_out_of_range',
        `overround ${round6(over)} is outside [0, ${ctx.thresholds.maxSportsbookOverround}]`
      );
    } else {
      const p = devigPower(implied);
      const s = devigShin(implied);
      if (p.ok) {
        power = p.probabilities;
        powerK = p.parameter;
      } else {
        refuse('devig_nonconvergence', p.reason);
      }
      if (s.ok) {
        shin = s.probabilities;
        shinZ = s.parameter;
      } else {
        refuse('devig_nonconvergence', s.reason);
      }
    }
    let methodSpread: number | null = null;
    if (power && shin && targetIndex >= 0) {
      const values = [multiplicative[targetIndex], power[targetIndex], shin[targetIndex]];
      const low = Math.min(...values);
      const high = Math.max(...values);
      methodSpread = round6(high - low);
      candidate = { p: round6(power[targetIndex]), low: round6(low), high: round6(high) };
    }
    record.sportsbook = {
      overround: round6(over),
      defaultMethod: DEFAULT_DEVIG_METHOD,
      multiplicative: roundAll(multiplicative),
      power: roundAll(power),
      shin: roundAll(shin),
      powerK: powerK === null ? null : round6(powerK),
      shinZ: shinZ === null ? null : round6(shinZ),
      methodSpread,
    };
  }

  if (kind === 'exchange' && pricesComplete && bids.length >= 1 && targetIndex >= 0) {
    const bid = bids[targetIndex];
    const ask = asks[targetIndex];
    const spread = ask - bid;
    const depth = depths[targetIndex];
    if (spread > ctx.thresholds.maxExchangeSpread) {
      refuse('market_spread_too_wide', `spread ${round6(spread)} exceeds ${ctx.thresholds.maxExchangeSpread}`);
    }
    if (depth < ctx.thresholds.minExchangeDepthUsd) {
      refuse('market_depth_too_thin', `depth $${depth} is below $${ctx.thresholds.minExchangeDepthUsd}`);
    }
    const mids = bids.map((b, i) => exchangeMid(b, asks[i]));
    let normalizationSum: number | null = null;
    let p = mids[targetIndex];
    let low = bid;
    let high = ask;
    if (mids.length > 1) {
      normalizationSum = mids.reduce((a, b) => a + b, 0);
      if (!(normalizationSum > 0)) {
        refuse('market_invalid_odds', 'exchange midpoints sum to zero; cannot normalize');
      } else {
        p = normalizeToOne(mids)[targetIndex];
        low = clamp01(bid / normalizationSum);
        high = clamp01(ask / normalizationSum);
      }
    }
    record.exchange = {
      spread: round6(spread),
      depthUsd: depth,
      normalizationSum: normalizationSum === null ? null : round6(normalizationSum),
    };
    candidate = { p: round6(p), low: round6(Math.min(low, p)), high: round6(Math.max(high, p)) };
  }

  if (refusals.length > 0) candidate = null;
  record.candidate = candidate;
  if (candidate) record.status = 'not-selected';
  return { candidate, record, refusals };
}
