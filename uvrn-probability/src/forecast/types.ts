/**
 * Forecast contract types. Version 2 (SPEC/uvrn-probability-v2.md): input `uvrn-probability-input-2`,
 * output/hash `uvrn-probability-2`. Version 3 (SPEC/uvrn-probability-v3.md): input
 * `uvrn-probability-input-3`, output/hash `uvrn-probability-3`, adding a required fixed-offset local
 * deadline. The unions are discriminated on `specVersion`; version-2 shapes are unchanged.
 */

import type { NetworkReceipt } from '@uvrn/receipt';
import type { BaseRateInput } from '../baserate/evaluate';
import type { Citation } from '../common/citation';
import type { ForecastRefusal } from '../common/refusal';
import type { Thresholds } from '../common/thresholds';
import type { AbstentionRecord, JudgmentAbstention, JudgmentInput, JudgmentRecord } from '../judgment/validate';
import type { ExchangeOutcome, SportsbookOutcome } from '../odds/market';
import type {
  FORECAST_INPUT_VERSION,
  FORECAST_SPEC_VERSION,
  FORECAST_V3_INPUT_VERSION,
  FORECAST_V3_SPEC_VERSION,
} from '../version';
import type { ForecastProfile, ForecastProfileRecord } from './profile';
import type { DeadlineRecord, ForecastQuestion, ForecastQuestionV3, QuestionRecord, QuestionRecordV3 } from './question';

export type ForecastMode = 'market' | 'baserate' | 'judgment';

export interface ForecastProducer {
  /** Who produced the estimate. The receipt signer separately identifies the signing key. */
  id: string;
  kind: 'agent' | 'human';
  /** Caller-declared model identifier; not verified. */
  model?: string;
}

/** Version-2 market input. Binary questions only; `targetOutcome` is the market label for YES. */
export interface ForecastMarketInput {
  kind: 'sportsbook' | 'exchange';
  venue: string;
  domain: string;
  /**
   * The market's underlying EVENT CUTOFF: the instant by which the predicted event must occur
   * for the market's YES to pay. Must fall on the same UTC date as `question.resolveBy`. Not the
   * administrative settlement time (see `settlesAt`).
   */
  resolvesAt: string;
  /** Optional administrative settlement time. Recorded only; never matched against the deadline. */
  settlesAt?: string;
  /** The market outcome label that corresponds to the question's YES outcome. */
  targetOutcome: string;
  outcomes: Array<SportsbookOutcome | ExchangeOutcome>;
  source: Citation;
}

/** The version-2 request (`uvrn-probability-input-2`). */
export interface ForecastInputV2 {
  specVersion: typeof FORECAST_INPUT_VERSION;
  /** Caller-assigned, preserved unchanged. Reuse only for an identical retry. */
  forecastId: string;
  mode: ForecastMode;
  question: ForecastQuestion;
  asOf: { at: string; source: Citation };
  producer: ForecastProducer;
  market?: ForecastMarketInput;
  baserate?: BaseRateInput;
  judgment?: JudgmentInput | JudgmentAbstention;
  /** Calculated modes only. Overrides are recorded, never silent. */
  thresholds?: Partial<Thresholds>;
  revision?: { previousProbabilityHash: string; reason: string };
  /** Optional tighten-only rule profile (`uvrn-probability-profile-1`). Omitted = default behavior. */
  profile?: ForecastProfile;
}

/** The version-3 request (`uvrn-probability-input-3`): version 2 with a required `question.resolveByOffset`. */
export interface ForecastInputV3 extends Omit<ForecastInputV2, 'specVersion' | 'question'> {
  specVersion: typeof FORECAST_V3_INPUT_VERSION;
  question: ForecastQuestionV3;
}

/** Any request `runForecast` accepts, discriminated on `specVersion`. */
export type ForecastInput = ForecastInputV2 | ForecastInputV3;

export type ForecastStatus = 'forecast' | 'insufficient_basis';
export type ForecastBasis = 'market-implied' | 'reference-class' | 'agent-judgment';
export type BandKind = 'method-spread' | 'bid-ask' | 'statistical' | 'subjective';

export interface ForecastBand {
  outcomeId: 'yes';
  low: number;
  high: number;
  kind: BandKind;
  /** 0.95 only for statistical intervals; null otherwise. */
  confidence: number | null;
}

export interface ForecastInputs {
  asOf: { at: string; atUtc: string; source: Citation };
  /** Effective thresholds for calculated modes; null in judgment mode. */
  thresholds: { provisional: true; values: Thresholds; overridden: string[] } | null;
  market: Record<string, unknown> | null;
  baserate: Record<string, unknown> | null;
  judgment: JudgmentRecord | AbstentionRecord | null;
}

/** Version-3 inputs: the version-2 members plus the required, hashed local `deadline`. */
export interface ForecastInputsV3 extends ForecastInputs {
  deadline: DeadlineRecord;
}

/** The closed `uvrn-probability-2` hashed record. */
export interface ForecastHashPayloadV2 {
  specVersion: typeof FORECAST_SPEC_VERSION;
  origin: string;
  forecastId: string;
  question: QuestionRecord;
  questionHash: string;
  asOf: string;
  producer: { id: string; kind: 'agent' | 'human'; model: string | null };
  mode: ForecastMode;
  status: ForecastStatus;
  basis: ForecastBasis | null;
  probabilities: Array<{ outcomeId: string; p: number }> | null;
  unit: '1';
  quantityKind: 'probability';
  band: ForecastBand | null;
  inputs: ForecastInputs;
  limitations: string[];
  refusals: ForecastRefusal[];
  revision: { previousProbabilityHash: string; reason: string } | null;
  /** Present only when a rule profile was supplied; hashed when present, absent (not null) otherwise. */
  profile?: ForecastProfileRecord;
}

/**
 * The closed `uvrn-probability-3` hashed record: the same top-level field list as version 2, with a
 * version-3 question (carrying `resolveByOffset`) and `inputs.deadline`.
 */
export interface ForecastHashPayloadV3 extends Omit<ForecastHashPayloadV2, 'specVersion' | 'question' | 'inputs'> {
  specVersion: typeof FORECAST_V3_SPEC_VERSION;
  question: QuestionRecordV3;
  inputs: ForecastInputsV3;
}

export type ForecastHashPayload = ForecastHashPayloadV2 | ForecastHashPayloadV3;

export type ForecastResultV2 = ForecastHashPayloadV2 & { probabilityHash: string; receipt: NetworkReceipt };
export type ForecastResultV3 = ForecastHashPayloadV3 & { probabilityHash: string; receipt: NetworkReceipt };
export type ForecastResult = ForecastResultV2 | ForecastResultV3;
