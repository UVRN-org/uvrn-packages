/**
 * runForecast — the version-2 and version-3 interface (SPEC/uvrn-probability-v2.md, -v3.md),
 * dispatched on the request's `specVersion`. Version 3 adds a required fixed-offset local deadline;
 * a version-2 request produces exactly the version-2 record. The caller selects exactly
 * one mode; there is no precedence, fallback, or blending. Malformed requests throw a typed
 * ForecastValidationError (no receipt). Every valid request, including abstention and
 * insufficient_basis, returns a receipted record. No clock, randomness, network, or model calls.
 */

import type { BaseRateInput } from '../baserate/evaluate';
import type { ForecastRefusal } from '../common/refusal';
import { DEFAULT_THRESHOLDS, type Thresholds } from '../common/thresholds';
import { toUtcIso } from '../common/time';
import { expectText, fail } from '../common/strict';
import { MILLIONTHS, validateJudgment } from '../judgment/validate';
import type { ProbabilitySigner } from '../receipt';
import { FORECAST_SPEC_VERSION, FORECAST_V2_ORIGIN, FORECAST_V3_ORIGIN, FORECAST_V3_SPEC_VERSION } from '../version';
import { evaluateForecastBaseRate, evaluateForecastMarket, type ModeEvaluation } from './modes';
import { applyProfileThresholds, checkProfileMode, validateProfile } from './profile';
import { computeQuestionHash, validateQuestion, validateQuestionV3, type QuestionRecordV3, type ValidatedDeadline } from './question';
import { buildForecastReceipt, computeForecastHash } from './receipt';
import type {
  ForecastBand,
  ForecastBasis,
  ForecastHashPayload,
  ForecastInput,
  ForecastInputs,
  ForecastMarketInput,
  ForecastResult,
  ForecastStatus,
} from './types';
import {
  validateAsOf,
  validateBaseRate,
  validateEnvelope,
  validateMarket,
  validateProducer,
  validateRevision,
  validateThresholds,
} from './validate';

export interface ForecastOptions {
  /** Ed25519 producer key. Omit for an unsigned (integrity-checkable only) receipt. */
  signer?: ProbabilitySigner;
}

/** Fixed honesty notes (SPEC v2 §4.4). Always present. */
export const LIMITATION_RECEIPT =
  'A receipt proves record integrity and, when signed, which key signed it. It does not prove accuracy, the truth of cited sources, or that the forecast existed before the outcome.';
export const LIMITATION_NO_READINGS =
  'No automatic numerical adjustment is applied from UVRN readings (V-Score, agreement, drift, stance, signal). Probability is not a V-Score.';
export const LIMITATION_PARTITION =
  'Outcome definitions are checked for structure only; the producer attests they are mutually exclusive and exhaustive.';
export const LIMITATION_MARKET =
  "Market-implied price with no favorite-longshot or horizon bias correction. Only the event-cutoff date was matched; the caller asserts the market's event is the question's event.";
export const LIMITATION_BASERATE =
  'Reference-class base rate: assumes comparable cases, a defensible observation origin, and censoring that does not systematically conceal the target outcome.';
export const LIMITATION_THRESHOLDS = 'Thresholds are PROVISIONAL implementer defaults, recorded in inputs.thresholds.';
export const LIMITATION_JUDGMENT =
  'Attributed judgment: an opinion of the named producer, not a market price or statistical estimate. Acceptance validates structure, not accuracy.';
export const LIMITATION_ASSUMPTION_ONLY = 'Basis label: assumption-only. No cited evidence was supplied.';
export const LIMITATION_CITED = 'Basis label: cited-evidence-and-judgment. Citation structure was checked, not whether sources support the claims.';
/** Version 3 only: the fixed offset is the caller's attestation (SPEC v3 §3). */
export const LIMITATION_FIXED_OFFSET =
  "Deadline day read at the caller-supplied fixed UTC offset (question.resolveByOffset); that the offset is correct for the date is the caller's attestation. No time-zone or daylight-saving rules are applied.";
export const LIMITATION_PROFILE =
  'A caller-supplied rule profile was applied (identified by profile.hash). A profile can only tighten modes, thresholds, and input forms; the package does not verify who authored it.';

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function runForecast(input: ForecastInput, options: ForecastOptions = {}): ForecastResult {
  const { raw, mode, contract } = validateEnvelope(input);
  const profile = validateProfile(raw.profile);
  checkProfileMode(profile, mode);
  const asOf = validateAsOf(raw.asOf);
  let deadline: ValidatedDeadline | undefined;
  let question: ReturnType<typeof validateQuestion>;
  if (contract === 3) {
    const v3 = validateQuestionV3(raw.question, asOf.atMs);
    question = v3.record;
    deadline = v3.deadline;
  } else {
    question = validateQuestion(raw.question, asOf.atMs);
  }
  if (mode !== 'judgment' && question.kind !== 'binary') {
    fail('unsupported_mode_for_question', 'mode', `"${mode}" supports binary questions only in this version; use judgment for categorical questions`);
  }
  const forecastId = expectText(raw.forecastId, 'forecastId');
  const producer = validateProducer(raw.producer);
  const revision = validateRevision(raw.revision);
  const thresholds = validateThresholds(raw.thresholds, mode);
  if (thresholds && profile) {
    thresholds.values = applyProfileThresholds(thresholds.values, profile);
    thresholds.overridden = (Object.keys(DEFAULT_THRESHOLDS) as (keyof Thresholds)[])
      .filter((key) => thresholds.values[key] !== DEFAULT_THRESHOLDS[key])
      .sort();
  }

  const questionHash = computeQuestionHash(question);
  const inputs: ForecastInputs = {
    asOf: { at: asOf.at, atUtc: toUtcIso(asOf.atMs), source: asOf.source },
    thresholds: thresholds ? { provisional: true, values: { ...thresholds.values }, overridden: thresholds.overridden } : null,
    market: null,
    baserate: null,
    judgment: null,
  };
  const limitations: string[] = [LIMITATION_RECEIPT, LIMITATION_NO_READINGS, LIMITATION_PARTITION];
  if (profile) limitations.push(LIMITATION_PROFILE);
  if (deadline) limitations.push(LIMITATION_FIXED_OFFSET);
  let refusals: ForecastRefusal[] = [];
  let probabilities: ForecastHashPayload['probabilities'] = null;
  let band: ForecastBand | null = null;
  let basis: ForecastBasis | null = null;

  if (mode === 'judgment') {
    const judged = validateJudgment(raw.judgment, question);
    inputs.judgment = judged.record;
    limitations.push(LIMITATION_JUDGMENT);
    if (judged.kind === 'abstention') {
      refusals = [{ code: 'judgment_abstained', scope: 'judgment', message: 'the producer abstained; no allocation was supplied' }];
    } else {
      if (profile?.require.citedEvidence && judged.record.evidence.length === 0) {
        fail('profile_violation', 'judgment.evidence', 'the rule profile requires at least one cited evidence item');
      }
      if (profile?.require.judgmentRange && question.kind === 'binary' && judged.record.range === null) {
        fail('profile_violation', 'judgment.range', 'the rule profile requires a subjective range for a binary judgment');
      }
      basis = 'agent-judgment';
      probabilities = judged.probabilities;
      const r = judged.record;
      limitations.push(r.basisLabel === 'assumption-only' ? LIMITATION_ASSUMPTION_ONLY : LIMITATION_CITED);
      limitations.push(`Producer-stated uncertainty: ${r.uncertainty}`);
      if (r.range) band = { outcomeId: 'yes', low: r.range.low, high: r.range.high, kind: 'subjective', confidence: null };
    }
  } else {
    const ctx = { asOfMs: asOf.atMs, thresholds: thresholds!.values };
    let evaluation: ModeEvaluation;
    if (mode === 'market') {
      validateMarket(raw.market, profile?.require.zonedTimestamps === true);
      evaluation = evaluateForecastMarket(deepCopy(raw.market) as ForecastMarketInput, question.resolveBy, ctx, deadline);
      inputs.market = evaluation.record;
      limitations.push(LIMITATION_MARKET);
    } else {
      validateBaseRate(raw.baserate, asOf.atMs, profile?.require.zonedTimestamps === true);
      evaluation = evaluateForecastBaseRate(deepCopy(raw.baserate) as BaseRateInput, question.resolveBy, ctx, deadline);
      inputs.baserate = evaluation.record;
      limitations.push(LIMITATION_BASERATE);
    }
    limitations.push(LIMITATION_THRESHOLDS);
    refusals = evaluation.refusals;
    if (evaluation.yesP !== null && refusals.length === 0) {
      basis = mode === 'market' ? 'market-implied' : 'reference-class';
      const yesMillionths = Math.round(evaluation.yesP * MILLIONTHS);
      probabilities = [
        { outcomeId: 'yes', p: yesMillionths / MILLIONTHS },
        { outcomeId: 'no', p: (MILLIONTHS - yesMillionths) / MILLIONTHS },
      ];
      band = evaluation.band;
    }
  }

  const common = {
    forecastId,
    question: deepCopy(question),
    questionHash,
    asOf: toUtcIso(asOf.atMs),
    producer,
    mode,
    status: (probabilities ? 'forecast' : 'insufficient_basis') as ForecastStatus,
    basis,
    probabilities,
    unit: '1' as const,
    quantityKind: 'probability' as const,
    band,
    inputs: deepCopy(inputs),
    limitations,
    refusals,
    revision,
    ...(profile ? { profile: profile.record } : {}),
  };
  const payload: ForecastHashPayload = deadline
    ? {
        specVersion: FORECAST_V3_SPEC_VERSION,
        origin: FORECAST_V3_ORIGIN,
        ...common,
        question: common.question as QuestionRecordV3,
        inputs: { ...common.inputs, deadline: { ...deadline.record } },
      }
    : { specVersion: FORECAST_SPEC_VERSION, origin: FORECAST_V2_ORIGIN, ...common };
  const probabilityHash = computeForecastHash(payload as unknown as Record<string, unknown>);
  const receipt = buildForecastReceipt({ ...payload, probabilityHash }, options.signer);
  return { ...payload, probabilityHash, receipt };
}
