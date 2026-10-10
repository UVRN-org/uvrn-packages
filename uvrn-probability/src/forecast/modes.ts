/**
 * Calculated-mode adapters for version 2 (SPEC/uvrn-probability-v2.md §6). They reuse the v1
 * market and base-rate math unchanged, then apply the version-2 rules: event-cutoff deadline
 * matching, the at-risk gate, no degenerate binomial fallback, and labeled band kinds.
 * Binary questions only; the target market outcome / base-rate event is the question's YES.
 */

import {
  evaluateBaseRate,
  horizonInstantMs,
  type BaseRateInput,
  type BaseRateInputRecord,
  type BaseRatePolicy,
} from '../baserate/evaluate';
import {
  FORECAST_REFUSAL_CODES,
  ForecastValidationError,
  type AnyRefusal,
  type ForecastRefusal,
  type ForecastRefusalCode,
} from '../common/refusal';
import { CONFIDENCE_LEVEL } from '../common/thresholds';
import { isRecordableInstant, localDate, toUtcIso } from '../common/time';
import type { EvaluationContext } from '../common/types';
import {
  evaluateMarket,
  marketCutoffInstantMs,
  type ExchangeOutcome,
  type MarketInput,
  type MarketInputRecord,
  type MarketPolicy,
  type MarketOutcomeRecord,
  type SportsbookOutcome,
} from '../odds/market';
import type { OddsValue } from '../odds/math';
import type { ValidatedDeadline } from './question';
import type { ForecastBand, ForecastMarketInput } from './types';

export interface ModeEvaluation {
  record: Record<string, unknown>;
  /** Rounded YES probability, or null when any refusal applies. */
  yesP: number | null;
  band: ForecastBand | null;
  refusals: ForecastRefusal[];
}

const FORECAST_CODES = new Set<string>(FORECAST_REFUSAL_CODES);

/**
 * Version-2 inputs are structurally validated before evaluation, so a structural refusal from a
 * shared evaluator means the validator and evaluator disagree: fail loudly instead of receipting it.
 */
function toForecastRefusals(refusals: AnyRefusal[], scope: 'market' | 'baserate'): ForecastRefusal[] {
  return refusals.map((r) => {
    if (!FORECAST_CODES.has(r.code)) {
      throw new ForecastValidationError('invalid_input', scope, r.message);
    }
    return { code: r.code as ForecastRefusalCode, scope, message: r.message };
  });
}

function utcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Version-2 outcome records keep the submitted price fields (sportsbook `odds`; exchange `bid`,
 * `ask`, `depthUsd`) even when the price is refused, so a refused receipt still shows what was
 * priced. Computed fields (`impliedP`, `mid`) appear only when the price is valid. The structural
 * validator has already rejected non-finite numbers, so every copied value is finite.
 */
function outcomeRecordsWithPrices(input: ForecastMarketInput, v1: MarketOutcomeRecord[]): MarketOutcomeRecord[] {
  return v1.map((rec, i) => {
    const submitted = input.outcomes[i] as Partial<SportsbookOutcome & ExchangeOutcome>;
    const out: MarketOutcomeRecord = { ...rec };
    if (input.kind === 'sportsbook') {
      const odds = submitted.odds as OddsValue;
      out.odds =
        odds.format === 'fractional'
          ? { format: 'fractional', numerator: odds.numerator, denominator: odds.denominator }
          : { format: odds.format, value: odds.value };
    } else {
      out.bid = submitted.bid as number;
      out.ask = submitted.ask as number;
      out.depthUsd = submitted.depthUsd as number;
    }
    return out;
  });
}

/**
 * Version 3: an instant matches the deadline when it falls in the local deadline day
 * [start, endExclusive) at the question's fixed offset (interval membership, not date formatting).
 */
function inDeadlineDay(ms: number, deadline: ValidatedDeadline): boolean {
  return deadline.startMs <= ms && ms < deadline.endExclusiveMs;
}

/**
 * evaluateForecastMarket applies the calculated-mode rules. With `deadline` (version 3 only), a
 * date-only `resolvesAt` is read at the local end of its day at the deadline's offset and the
 * cutoff is matched by interval membership; without it, behavior is exactly version 2.
 */
export function evaluateForecastMarket(
  input: ForecastMarketInput,
  resolveBy: string,
  ctx: EvaluationContext,
  deadline?: ValidatedDeadline
): ModeEvaluation {
  const { settlesAt, ...legacy } = input;
  const policy: MarketPolicy = deadline
    ? { resolvesEndOfUtcDay: true, endOfDayOffsetMinutes: deadline.offsetMinutes }
    : { resolvesEndOfUtcDay: true };
  const cutoffMs = marketCutoffInstantMs(input.resolvesAt, policy) as number;
  // Version 3: refuse to render an extended-year instant (checked before any evaluation/rendering).
  if (deadline && !isRecordableInstant(cutoffMs)) {
    throw new ForecastValidationError(
      'invalid_input',
      'market.resolvesAt',
      'the event cutoff, read at the question offset, must lie within years 0000–9999'
    );
  }
  const ev = evaluateMarket(legacy as MarketInput, ctx, policy);
  const refusals = toForecastRefusals(ev.refusals, 'market').map((r) =>
    r.code === 'market_resolves_before_asof'
      ? { ...r, message: "the market's event cutoff (resolvesAt) is at or before asOf; a price is not a forecast" }
      : r
  );
  const cutoffDate = utcDate(cutoffMs);
  const cutoffLocalDate = deadline ? localDate(cutoffMs, deadline.offsetMinutes) : null;
  const deadlineMatched = deadline ? inDeadlineDay(cutoffMs, deadline) : cutoffDate === resolveBy;
  if (!deadlineMatched) {
    refusals.push({
      code: 'deadline_mismatch',
      scope: 'market',
      message: deadline
        ? `the market's event cutoff falls on ${cutoffLocalDate} at UTC offset ${deadline.record.offset}; the question deadline is ${resolveBy} at ${deadline.record.offset}`
        : `the market's event cutoff falls on UTC date ${cutoffDate}; the question deadline is ${resolveBy}`,
    });
  }

  const v1: MarketInputRecord = ev.record;
  const record: Record<string, unknown> = {
    kind: v1.kind,
    venue: v1.venue,
    domain: v1.domain,
    priceLabel: v1.priceLabel,
    biasCorrection: v1.biasCorrection,
    resolvesAt: v1.resolvesAt,
    resolvesAtMeaning: 'event-cutoff',
    eventCutoffUtcDate: cutoffDate,
    eventCutoffInstantUtc: toUtcIso(cutoffMs),
    ...(deadline ? { eventCutoffDeadlineDate: cutoffLocalDate } : {}),
    settlesAt: settlesAt ?? null,
    deadlineMatched,
    timeToEventCutoffDays: v1.timeToResolutionDays,
    targetOutcome: v1.targetOutcome,
    targetOutcomeId: 'yes',
    source: v1.source,
    outcomes: outcomeRecordsWithPrices(input, v1.outcomes),
  };
  if (v1.sportsbook) record.sportsbook = v1.sportsbook;
  if (v1.exchange) record.exchange = v1.exchange;

  const candidate = refusals.length === 0 ? ev.candidate : null;
  return {
    record: JSON.parse(JSON.stringify(record)),
    yesP: candidate ? candidate.p : null,
    band: candidate
      ? {
          outcomeId: 'yes',
          low: candidate.low,
          high: candidate.high,
          kind: input.kind === 'sportsbook' ? 'method-spread' : 'bid-ask',
          confidence: null,
        }
      : null,
    refusals,
  };
}

/**
 * evaluateForecastBaseRate applies the calculated-mode rules. With `deadline` (version 3 only), a
 * date-only `horizon.by` is evaluated at the local end of its day at the deadline's offset and the
 * horizon is matched by interval membership; case and subject dates are unaffected. Without it,
 * behavior is exactly version 2.
 */
export function evaluateForecastBaseRate(
  input: BaseRateInput,
  resolveBy: string,
  ctx: EvaluationContext,
  deadline?: ValidatedDeadline
): ModeEvaluation {
  const policy: BaseRatePolicy = deadline
    ? { requireMinAtRisk: true, refuseDegenerateInterval: true, horizonEndOfUtcDay: true, endOfDayOffsetMinutes: deadline.offsetMinutes }
    : { requireMinAtRisk: true, refuseDegenerateInterval: true, horizonEndOfUtcDay: true };
  if (deadline && input.mode === 'time-to-event') {
    // Version 3: refuse to render an extended-year instant (checked before any evaluation/rendering).
    const horizonMs = horizonInstantMs(input.horizon.by, policy) as number;
    if (!isRecordableInstant(horizonMs)) {
      throw new ForecastValidationError(
        'invalid_input',
        'baserate.horizon.by',
        'the horizon, read at the question offset, must lie within years 0000–9999'
      );
    }
  }
  const ev = evaluateBaseRate(input, ctx, policy);
  const refusals = toForecastRefusals(ev.refusals, 'baserate');

  const { status: _status, candidate: _candidate, ...rest } = ev.record as BaseRateInputRecord;
  const record: Record<string, unknown> = { ...rest, targetOutcomeId: 'yes' };
  if (input.mode === 'time-to-event') {
    const horizonMs = horizonInstantMs(input.horizon.by, policy) as number;
    const horizonDate = utcDate(horizonMs);
    const horizonLocalDate = deadline ? localDate(horizonMs, deadline.offsetMinutes) : null;
    const deadlineMatched = deadline ? inDeadlineDay(horizonMs, deadline) : horizonDate === resolveBy;
    record.horizonUtcDate = horizonDate;
    record.horizonInstantUtc = toUtcIso(horizonMs);
    if (deadline) record.horizonDeadlineDate = horizonLocalDate;
    record.deadlineMatched = deadlineMatched;
    record.minAtRiskRequired = ctx.thresholds.minCases;
    if (!deadlineMatched) {
      refusals.push({
        code: 'deadline_mismatch',
        scope: 'baserate',
        message: deadline
          ? `the base-rate horizon falls on ${horizonLocalDate} at UTC offset ${deadline.record.offset}; the question deadline is ${resolveBy} at ${deadline.record.offset}`
          : `the base-rate horizon falls on UTC date ${horizonDate}; the question deadline is ${resolveBy}`,
      });
    }
  } else {
    record.horizonUtcDate = null;
    if (deadline) record.horizonDeadlineDate = null;
    record.deadlineMatched = null;
  }

  const candidate = refusals.length === 0 ? ev.candidate : null;
  return {
    record: JSON.parse(JSON.stringify(record)),
    yesP: candidate ? candidate.p : null,
    band: candidate
      ? { outcomeId: 'yes', low: candidate.low, high: candidate.high, kind: 'statistical', confidence: CONFIDENCE_LEVEL }
      : null,
    refusals,
  };
}
