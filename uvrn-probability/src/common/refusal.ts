/**
 * Closed refusal-code list for SPEC/uvrn-probability-v1.md §6. A refusal is a first-class result:
 * the package reports why it will not produce a number instead of guessing one.
 */

export const REFUSAL_CODES = [
  'invalid_input',
  'missing_citation',
  'no_candidate',
  'market_invalid_odds',
  'market_target_not_found',
  'market_quote_after_asof',
  'market_quote_stale',
  'market_resolves_before_asof',
  'market_overround_out_of_range',
  'market_spread_too_wide',
  'market_depth_too_thin',
  'devig_nonconvergence',
  'baserate_unknown_criterion',
  'baserate_invalid_case',
  'baserate_event_after_asof',
  'baserate_below_min_cases',
  'baserate_no_risk_set_at_elapsed',
  'baserate_horizon_not_after_elapsed',
  'baserate_horizon_beyond_followup',
  'baserate_nonconvergence',
] as const;

export type RefusalCode = (typeof REFUSAL_CODES)[number];

export type RefusalScope = 'input' | 'market' | 'baserate';

export interface Refusal {
  code: RefusalCode;
  scope: RefusalScope;
  /** Plain-language reason. Observation language only. */
  message: string;
}

export function refusal(code: RefusalCode, scope: RefusalScope, message: string): Refusal {
  return { code, scope, message };
}

/**
 * Closed refusal-code list for the version-2 forecast contract (SPEC/uvrn-probability-v2.md §7).
 * Structural problems (`invalid_input`, `missing_citation`, `market_target_not_found`) are typed
 * validation errors in version 2, never refusals, so they are absent here.
 */
export const FORECAST_REFUSAL_CODES = [
  'market_invalid_odds',
  'market_quote_after_asof',
  'market_quote_stale',
  'market_resolves_before_asof',
  'market_overround_out_of_range',
  'market_spread_too_wide',
  'market_depth_too_thin',
  'devig_nonconvergence',
  'baserate_unknown_criterion',
  'baserate_invalid_case',
  'baserate_event_after_asof',
  'baserate_below_min_cases',
  'baserate_no_risk_set_at_elapsed',
  'baserate_horizon_not_after_elapsed',
  'baserate_horizon_beyond_followup',
  'baserate_nonconvergence',
  'baserate_below_min_at_risk',
  'baserate_interval_unavailable',
  'deadline_mismatch',
  'judgment_abstained',
] as const;

export type ForecastRefusalCode = (typeof FORECAST_REFUSAL_CODES)[number];

export type ForecastRefusalScope = 'market' | 'baserate' | 'judgment';

export interface ForecastRefusal {
  code: ForecastRefusalCode;
  scope: ForecastRefusalScope;
  /** Plain-language reason. Never contains key material or input dumps. */
  message: string;
}

/** Internal: evaluators shared by both contracts may emit either list's codes. */
export type AnyRefusalCode = RefusalCode | ForecastRefusalCode;
export interface AnyRefusal {
  code: AnyRefusalCode;
  scope: RefusalScope | ForecastRefusalScope;
  message: string;
}

/** Closed list of typed validation-error codes for the version-2 contract (no receipt is produced). */
export const FORECAST_VALIDATION_CODES = [
  'unsupported_version',
  'unknown_field',
  'invalid_input',
  'missing_citation',
  'mixed_mode_input',
  'unsupported_mode_for_question',
  'invalid_question',
  'outcome_declaration_mismatch',
  'invalid_threshold',
  'invalid_revision',
  'invalid_judgment',
  'judgment_basis_missing',
  'invalid_distribution',
  'invalid_range',
  'invalid_profile',
  'profile_violation',
] as const;

export type ForecastValidationCode = (typeof FORECAST_VALIDATION_CODES)[number];

/**
 * Typed error for a malformed version-2 request. No receipt is produced; the host logs these
 * separately. `path` names the offending member; messages never echo input values.
 */
export class ForecastValidationError extends Error {
  readonly code: ForecastValidationCode;
  readonly path: string;
  constructor(code: ForecastValidationCode, path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'ForecastValidationError';
    this.code = code;
    this.path = path;
  }
}

/** Typed error for inputs that cannot be bound to a question or a time (no output is possible). */
export class ProbabilityInputError extends Error {
  readonly code = 'invalid_input' as const;
  constructor(message: string) {
    super(message);
    this.name = 'ProbabilityInputError';
  }
}
