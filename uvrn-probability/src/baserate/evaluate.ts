/**
 * Base-rate evaluation (SPEC §4.4–4.6): a cited reference class, a declared-criteria similarity
 * gate, then either a Jeffreys proportion or a conditional Aalen-Johansen incidence.
 * No fuzzy similarity score: a case is in the class only if it cites every declared criterion.
 */

import { citationProblem, copyCitation, type Citation } from '../common/citation';
import type { AnyRefusal, AnyRefusalCode } from '../common/refusal';
import { round6 } from '../common/round';
import { CONFIDENCE_LEVEL, Z_975 } from '../common/thresholds';
import { MS_PER_DAY, parseDateOrZoned } from '../common/time';
import type { Candidate, CandidateStatus, Evaluation, EvaluationContext } from '../common/types';
import {
  conditionalCumulativeIncidence,
  logLogInterval,
  type EventType,
  type Observation,
} from './aalen-johansen';
import { jeffreysInterval } from './jeffreys';

export interface Criterion {
  id: string;
  text: string;
  source: Citation;
}

export interface ReferenceClass {
  id: string;
  description: string;
  criteria: Criterion[];
  source: Citation;
}

export interface ProportionCase {
  id: string;
  source: Citation;
  /** Declared criterion ids this case meets (the case's own claim, cited by `source`). */
  meetsCriteria: string[];
  outcome: 'yes' | 'no';
  /** When the case's outcome became known (must be ≤ asOf). */
  resolvedAt: string;
}

export type CaseStatus = 'approved' | 'denied' | 'withdrawn' | 'pending';

export interface TimeToEventCase {
  id: string;
  source: Citation;
  meetsCriteria: string[];
  filedAt: string;
  status: CaseStatus;
  /** Event date for approved/denied/withdrawn; last-checked date for pending. Must be ≤ asOf. */
  statusAt: string;
}

export interface ProportionBaseRateInput {
  mode: 'proportion';
  referenceClass: ReferenceClass;
  cases: ProportionCase[];
}

export interface TimeToEventBaseRateInput {
  mode: 'time-to-event';
  referenceClass: ReferenceClass;
  cases: TimeToEventCase[];
  /** The case being forecast: pending since `filedAt`. */
  subject: { id?: string; filedAt: string; source: Citation };
  /** "Approved by D": D is `horizon.by` (usually the outcome's resolveBy). */
  horizon: { by: string };
  targetEvent: 'approved';
}

export type BaseRateInput = ProportionBaseRateInput | TimeToEventBaseRateInput;

export interface BaseRateInputRecord {
  role: 'baserate';
  status: CandidateStatus;
  mode: 'proportion' | 'time-to-event';
  referenceClass: {
    id: string;
    description: string;
    criteria: Array<{ id: string; text: string; source: Citation | null }>;
    source: Citation | null;
  };
  minCases: number;
  casesDeclared: number;
  casesIncluded: number;
  cases: Array<Record<string, unknown>>;
  excluded: Array<{ id: string; missingCriteria: string[] }>;
  proportion?: {
    x: number;
    n: number;
    pointEstimate: 'posterior-mean';
    interval: 'jeffreys-equal-tailed';
    confidence: number;
  };
  timeToEvent?: {
    estimator: 'aalen-johansen-conditional';
    targetEvent: 'approved';
    competingEvents: ['denied', 'withdrawn'];
    censored: ['pending'];
    subject: { id?: string; filedAt: string; source: Citation | null };
    horizonBy: string;
    elapsedDays: number;
    horizonDays: number;
    atRiskAtElapsed: number | null;
    survivalAtElapsed: number | null;
    cifAtElapsed: number | null;
    cifAtHorizon: number | null;
    standardError: number | null;
    interval: 'log-log' | 'jeffreys-degenerate-fallback' | null;
    confidence: number;
  };
  candidate: Candidate | null;
}

const EVENT_TYPE: Record<CaseStatus, EventType> = {
  approved: 1,
  denied: 2,
  withdrawn: 2,
  pending: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringList(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((v) => typeof v === 'string') ? (value as string[]) : null;
}

/**
 * Opt-in statistical policy for the version-2 forecast path (SPEC/uvrn-probability-v2.md §6).
 * Omitted (the legacy `runProbability` path), behavior is exactly SPEC/uvrn-probability-v1.md §4.5.
 */
export interface BaseRatePolicy {
  /** Refuse `baserate_below_min_at_risk` when fewer than minCases cases remain at risk after the elapsed time. */
  requireMinAtRisk?: boolean;
  /** Refuse `baserate_interval_unavailable` instead of the v1 Jeffreys degenerate fallback. */
  refuseDegenerateInterval?: boolean;
  /**
   * Evaluate a date-only `horizon.by` at the end of that UTC day (23:59:59.999Z) instead of v1's
   * 00:00Z. Zoned horizons are used as given. Case dates keep v1 semantics either way.
   */
  horizonEndOfUtcDay?: boolean;
  /**
   * Version 3 only: with `horizonEndOfUtcDay`, evaluate a date-only `horizon.by` at the end of that
   * day at this fixed UTC offset instead of UTC. Omitted or 0 is exactly the version-2 reading.
   * Case and subject dates are never affected. Only the v3 path in `forecast/modes.ts` sets it.
   */
  endOfDayOffsetMinutes?: number;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * horizonInstantMs returns the instant a time-to-event horizon is evaluated at, or null when it
 * does not parse. Without the v2 policy this is exactly v1's parseDateOrZoned.
 */
export function horizonInstantMs(by: unknown, policy: BaseRatePolicy = {}): number | null {
  const ms = parseDateOrZoned(by);
  if (ms === null || !policy.horizonEndOfUtcDay || !DATE_ONLY.test(by as string)) return ms;
  return ms - (policy.endOfDayOffsetMinutes ?? 0) * 60_000 + MS_PER_DAY - 1;
}

export function evaluateBaseRate(
  input: BaseRateInput,
  ctx: EvaluationContext,
  policy: BaseRatePolicy = {}
): Evaluation<BaseRateInputRecord> {
  const refusals: AnyRefusal[] = [];
  const refuse = (code: AnyRefusalCode, message: string) => refusals.push({ code, scope: 'baserate', message });
  const b = (isRecord(input) ? input : {}) as Partial<BaseRateInput> & Record<string, unknown>;

  const mode = b.mode === 'proportion' || b.mode === 'time-to-event' ? b.mode : null;
  if (!mode) refuse('invalid_input', 'baserate.mode must be "proportion" or "time-to-event"');

  const rc = (isRecord(b.referenceClass) ? b.referenceClass : {}) as Partial<ReferenceClass>;
  if (typeof rc.id !== 'string' || !rc.id) refuse('invalid_input', 'baserate.referenceClass.id must be a non-empty string');
  if (typeof rc.description !== 'string') refuse('invalid_input', 'baserate.referenceClass.description must be a string');
  const rcCitation = citationProblem(rc.source);
  if (rcCitation) refuse('missing_citation', `baserate.referenceClass.source: ${rcCitation}`);

  const criteria = Array.isArray(rc.criteria) ? rc.criteria : [];
  if (criteria.length === 0) refuse('invalid_input', 'baserate.referenceClass.criteria must declare at least one criterion');
  const criterionIds = new Set<string>();
  const criteriaRecord = criteria.map((raw, i) => {
    const c = (isRecord(raw) ? raw : {}) as Partial<Criterion>;
    if (typeof c.id !== 'string' || !c.id) refuse('invalid_input', `criteria[${i}].id must be a non-empty string`);
    else if (criterionIds.has(c.id)) refuse('invalid_input', `criterion id "${c.id}" is duplicated`);
    else criterionIds.add(c.id);
    if (typeof c.text !== 'string' || !c.text) refuse('invalid_input', `criteria[${i}].text must be a non-empty string`);
    const problem = citationProblem(c.source);
    if (problem) refuse('missing_citation', `criteria[${i}].source: ${problem}`);
    return {
      id: typeof c.id === 'string' ? c.id : '',
      text: typeof c.text === 'string' ? c.text : '',
      source: problem ? null : copyCitation(c.source as Citation),
    };
  });

  const rawCases = Array.isArray(b.cases) ? b.cases : [];
  const caseIds = new Set<string>();
  const casesRecord: Array<Record<string, unknown>> = [];
  const excluded: Array<{ id: string; missingCriteria: string[] }> = [];
  const included: Array<{ outcome?: 'yes' | 'no'; obs?: Observation }> = [];

  rawCases.forEach((raw, i) => {
    const c = (isRecord(raw) ? raw : {}) as Record<string, unknown>;
    const id = typeof c.id === 'string' ? c.id : '';
    const bad = (msg: string) => refuse('baserate_invalid_case', `case[${i}]${id ? ` "${id}"` : ''}: ${msg}`);
    if (!id) bad('id must be a non-empty string');
    else if (caseIds.has(id)) bad('id is duplicated');
    caseIds.add(id);
    const problem = citationProblem(c.source);
    if (problem) refuse('missing_citation', `case[${i}].source: ${problem}`);
    const meets = stringList(c.meetsCriteria);
    if (!meets) bad('meetsCriteria must be an array of criterion ids');
    for (const cid of meets ?? []) {
      if (!criterionIds.has(cid)) {
        refuse('baserate_unknown_criterion', `case "${id}" cites undeclared criterion "${cid}"`);
      }
    }
    const echo: Record<string, unknown> = {
      id,
      source: problem ? null : copyCitation(c.source as Citation),
      meetsCriteria: meets ? [...meets].sort() : [],
    };

    let obs: Observation | undefined;
    let outcome: 'yes' | 'no' | undefined;
    if (mode === 'proportion') {
      if (c.outcome !== 'yes' && c.outcome !== 'no') bad('outcome must be "yes" or "no"');
      else outcome = c.outcome;
      const resolvedMs = parseDateOrZoned(c.resolvedAt);
      if (resolvedMs === null) bad('resolvedAt must be a calendar date or zoned timestamp');
      else if (resolvedMs > ctx.asOfMs) {
        refuse('baserate_event_after_asof', `case "${id}" resolved after asOf; it cannot be known at asOf`);
      }
      echo.outcome = c.outcome;
      echo.resolvedAt = c.resolvedAt;
    } else if (mode === 'time-to-event') {
      const status = c.status as CaseStatus;
      if (!(status in EVENT_TYPE)) bad('status must be approved | denied | withdrawn | pending');
      const filedMs = parseDateOrZoned(c.filedAt);
      const statusMs = parseDateOrZoned(c.statusAt);
      if (filedMs === null) bad('filedAt must be a calendar date or zoned timestamp');
      if (statusMs === null) bad('statusAt must be a calendar date or zoned timestamp');
      if (filedMs !== null && statusMs !== null) {
        if (statusMs < filedMs) bad('statusAt is before filedAt');
        else if (statusMs > ctx.asOfMs) {
          refuse('baserate_event_after_asof', `case "${id}" statusAt is after asOf; it cannot be known at asOf`);
        } else if (status in EVENT_TYPE) {
          obs = { time: (statusMs - filedMs) / MS_PER_DAY, type: EVENT_TYPE[status] };
          echo.timeDays = round6(obs.time);
        }
      }
      echo.filedAt = c.filedAt;
      echo.status = c.status;
      echo.statusAt = c.statusAt;
    }
    casesRecord.push(echo);

    const missing = [...criterionIds].filter((cid) => !(meets ?? []).includes(cid)).sort();
    if (missing.length > 0) excluded.push({ id, missingCriteria: missing });
    else included.push({ outcome, obs });
  });

  const minCases = ctx.thresholds.minCases;
  if (included.length < minCases) {
    refuse(
      'baserate_below_min_cases',
      `${included.length} case(s) meet every declared criterion; at least ${minCases} are required`
    );
  }

  const record: BaseRateInputRecord = {
    role: 'baserate',
    status: 'refused',
    mode: mode ?? 'proportion',
    referenceClass: {
      id: typeof rc.id === 'string' ? rc.id : '',
      description: typeof rc.description === 'string' ? rc.description : '',
      criteria: criteriaRecord,
      source: rcCitation ? null : copyCitation(rc.source as Citation),
    },
    minCases,
    casesDeclared: rawCases.length,
    casesIncluded: included.length,
    cases: casesRecord,
    excluded,
    candidate: null,
  };

  let candidate: Candidate | null = null;

  if (mode === 'proportion') {
    const outcomes = included.map((c) => c.outcome).filter((o): o is 'yes' | 'no' => o !== undefined);
    const n = outcomes.length;
    const x = outcomes.filter((o) => o === 'yes').length;
    record.proportion = {
      x,
      n,
      pointEstimate: 'posterior-mean',
      interval: 'jeffreys-equal-tailed',
      confidence: CONFIDENCE_LEVEL,
    };
    if (n >= 1 && n === included.length) {
      const j = jeffreysInterval(x, n);
      if (!j.converged) refuse('baserate_nonconvergence', 'incomplete-beta inverse did not converge');
      candidate = { p: round6(j.p), low: round6(j.low), high: round6(j.high) };
    }
  }

  if (mode === 'time-to-event') {
    const t = b as Partial<TimeToEventBaseRateInput>;
    if (t.targetEvent !== 'approved') refuse('invalid_input', 'baserate.targetEvent must be "approved" in v1');
    const subject = (isRecord(t.subject) ? t.subject : {}) as Partial<TimeToEventBaseRateInput['subject']>;
    const subjectCitation = citationProblem(subject.source);
    if (subjectCitation) refuse('missing_citation', `baserate.subject.source: ${subjectCitation}`);
    const filedMs = parseDateOrZoned(subject.filedAt);
    const horizon = (isRecord(t.horizon) ? t.horizon : {}) as Partial<TimeToEventBaseRateInput['horizon']>;
    const byMs = horizonInstantMs(horizon.by, policy);
    if (filedMs === null) refuse('invalid_input', 'baserate.subject.filedAt must be a calendar date or zoned timestamp');
    else if (filedMs > ctx.asOfMs) refuse('invalid_input', 'baserate.subject.filedAt is after asOf');
    if (byMs === null) refuse('invalid_input', 'baserate.horizon.by must be a calendar date or zoned timestamp');

    const elapsed = filedMs === null ? 0 : (ctx.asOfMs - filedMs) / MS_PER_DAY;
    const horizonDays = filedMs === null || byMs === null ? 0 : (byMs - filedMs) / MS_PER_DAY;
    if (filedMs !== null && byMs !== null && horizonDays <= elapsed) {
      refuse('baserate_horizon_not_after_elapsed', 'horizon.by is not after asOf; nothing is left to forecast');
    }

    const tte: NonNullable<BaseRateInputRecord['timeToEvent']> = {
      estimator: 'aalen-johansen-conditional',
      targetEvent: 'approved',
      competingEvents: ['denied', 'withdrawn'],
      censored: ['pending'],
      subject: {
        ...(typeof subject.id === 'string' ? { id: subject.id } : {}),
        filedAt: typeof subject.filedAt === 'string' ? subject.filedAt : '',
        source: subjectCitation ? null : copyCitation(subject.source as Citation),
      },
      horizonBy: typeof horizon.by === 'string' ? horizon.by : '',
      elapsedDays: round6(elapsed),
      horizonDays: round6(horizonDays),
      atRiskAtElapsed: null,
      survivalAtElapsed: null,
      cifAtElapsed: null,
      cifAtHorizon: null,
      standardError: null,
      interval: null,
      confidence: CONFIDENCE_LEVEL,
    };
    record.timeToEvent = tte;

    const observations = included.map((c) => c.obs).filter((o): o is Observation => o !== undefined);
    if (observations.length > 0 && observations.length === included.length && filedMs !== null && byMs !== null) {
      const ci = conditionalCumulativeIncidence(observations, elapsed, horizonDays);
      tte.atRiskAtElapsed = ci.atRiskAfterStart;
      tte.survivalAtElapsed = round6(ci.survivalAtStart);
      tte.cifAtElapsed = round6(ci.cifAtStart);
      tte.cifAtHorizon = round6(ci.cifAtHorizon);
      if (ci.atRiskAfterStart === 0 || ci.survivalAtStart === 0) {
        refuse(
          'baserate_no_risk_set_at_elapsed',
          `no reference case was still pending after ${round6(elapsed)} days; the conditional rate is undefined`
        );
      } else {
        const thinRiskSet = policy.requireMinAtRisk === true && ci.atRiskAfterStart < minCases;
        const beyondFollowup = horizonDays > ci.lastObservedTime && ci.survivalAtLastObservation > 0;
        if (thinRiskSet) {
          refuse(
            'baserate_below_min_at_risk',
            `${ci.atRiskAfterStart} reference case(s) remain at risk after ${round6(elapsed)} days; at least ${minCases} are required`
          );
        }
        if (beyondFollowup) {
          refuse(
            'baserate_horizon_beyond_followup',
            `horizon (${round6(horizonDays)} days) is beyond the longest follow-up (${round6(ci.lastObservedTime)} days) while cases remain unresolved`
          );
        }
        if (!thinRiskSet && !beyondFollowup) {
          const se = Math.sqrt(ci.variance);
          tte.standardError = round6(se);
          const band = logLogInterval(ci.estimate, se, Z_975);
          if (band) {
            tte.interval = 'log-log';
            candidate = { p: round6(ci.estimate), low: round6(band.low), high: round6(band.high) };
          } else if (policy.refuseDegenerateInterval) {
            refuse(
              'baserate_interval_unavailable',
              `the log-log interval is undefined (estimate ${round6(ci.estimate)}, standard error ${round6(se)}); no interval is substituted`
            );
          } else {
            const n = ci.atRiskAfterStart;
            const x = Math.min(n, Math.max(0, Math.round(ci.estimate * n)));
            const j = jeffreysInterval(x, n);
            if (!j.converged) refuse('baserate_nonconvergence', 'incomplete-beta inverse did not converge');
            tte.interval = 'jeffreys-degenerate-fallback';
            candidate = {
              p: round6(ci.estimate),
              low: round6(Math.min(j.low, ci.estimate)),
              high: round6(Math.max(j.high, ci.estimate)),
            };
          }
        }
      }
    }
  }

  if (refusals.length > 0) candidate = null;
  record.candidate = candidate;
  if (candidate) record.status = 'not-selected';
  return { candidate, record, refusals };
}
