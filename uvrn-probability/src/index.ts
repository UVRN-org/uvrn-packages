/**
 * @uvrn/probability — deterministic, receipted forecasts.
 *
 * - `runForecast` (version 2, SPEC/uvrn-probability-v2.md): the caller selects one mode —
 *   market, base rate, or attributed judgment — for a standalone question definition.
 * - `runProbability` (legacy version 1, SPEC/uvrn-probability-v1.md): compatibility emitter with
 *   fixed precedence, kept so existing records and vectors stay reproducible.
 *
 * Market math lives in `@uvrn/probability/odds`, base rates in `@uvrn/probability/baserate`,
 * judgment validation in `@uvrn/probability/judgment`.
 *
 * A receipt proves integrity and who produced the record. It does not prove accuracy.
 * Probability is never a V-Score and never shares a field with one.
 */

export * from './forecast';
export { runProbability } from './run';
export type { ProbabilityResult, ProbabilityRunInput, ProbabilitySource, RunOptions } from './run';
export {
  PROBABILITY_HASH_FIELDS,
  assembleProbabilityHashInput,
  buildProbabilityReceipt,
  computeProbabilityHash,
  verifyProbabilityReceipt,
} from './receipt';
export type {
  ProbabilityHashPayload,
  ProbabilityMethod,
  ProbabilitySigner,
  ProbabilityVerifyResult,
} from './receipt';
export {
  FORECAST_REFUSAL_CODES,
  FORECAST_VALIDATION_CODES,
  ForecastValidationError,
  REFUSAL_CODES,
  ProbabilityInputError,
} from './common/refusal';
export type {
  ForecastRefusal,
  ForecastRefusalCode,
  ForecastRefusalScope,
  ForecastValidationCode,
  Refusal,
  RefusalCode,
  RefusalScope,
} from './common/refusal';
export {
  BETA_CF_ITERATIONS,
  BETA_INV_ITERATIONS,
  CONFIDENCE_LEVEL,
  DEFAULT_THRESHOLDS,
  DEVIG_ITERATIONS,
  DEVIG_TOLERANCE,
  MAX_EXCHANGE_SPREAD,
  MAX_QUOTE_STALENESS_MS,
  MAX_SPORTSBOOK_OVERROUND,
  MIN_CASES,
  MIN_EXCHANGE_DEPTH_USD,
  Z_975,
  resolveThresholds,
} from './common/thresholds';
export type { Thresholds } from './common/thresholds';
export type { Citation } from './common/citation';
export type { Candidate, CandidateStatus } from './common/types';
export { round6 } from './common/round';
export type {
  JudgmentAbstention,
  JudgmentAssumption,
  JudgmentBasisLabel,
  JudgmentEvidence,
  JudgmentInput,
  JudgmentRecord,
} from './judgment/validate';
export {
  FORECAST_INPUT_VERSION,
  FORECAST_SPEC_VERSION,
  FORECAST_V2_ORIGIN,
  FORECAST_V2_VERSION,
  FORECAST_V3_INPUT_VERSION,
  FORECAST_V3_ORIGIN,
  FORECAST_V3_SPEC_VERSION,
  FORECAST_V3_VERSION,
  LEGACY_PROBABILITY_ORIGIN,
  LEGACY_PROBABILITY_VERSION,
  PACKAGE_VERSION,
  PROBABILITY_INPUT_VERSION,
  PROBABILITY_ORIGIN,
  PROBABILITY_SPEC_VERSION,
  PROFILE_SPEC_VERSION,
  QUESTION_SPEC_VERSION,
  QUESTION_V2_SPEC_VERSION,
} from './version';
