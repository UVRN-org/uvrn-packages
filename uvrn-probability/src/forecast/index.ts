/**
 * Version-2 forecast contract (SPEC/uvrn-probability-v2.md): caller-selected mode, question
 * identity, `uvrn-probability-2` hash and receipt, version-dispatching verification.
 */

export {
  LIMITATION_ASSUMPTION_ONLY,
  LIMITATION_BASERATE,
  LIMITATION_CITED,
  LIMITATION_JUDGMENT,
  LIMITATION_MARKET,
  LIMITATION_NO_READINGS,
  LIMITATION_PARTITION,
  LIMITATION_FIXED_OFFSET,
  LIMITATION_PROFILE,
  LIMITATION_RECEIPT,
  LIMITATION_THRESHOLDS,
  runForecast,
} from './run';
export type { ForecastOptions } from './run';
export {
  FORECAST_HASH_FIELDS,
  FORECAST_OPTIONAL_HASH_FIELDS,
  assembleForecastHashInput,
  buildForecastReceipt,
  computeForecastHash,
  verifyForecastReceipt,
} from './receipt';
export type { ForecastVerifyResult } from './receipt';
export {
  OUTCOME_DECLARATION_HASH_FIELDS,
  computeOutcomeDeclarationHash,
  computeQuestionHash,
  normalizeQuestionString,
  questionHashPreimage,
} from './question';
export type {
  DeadlineRecord,
  ForecastQuestion,
  ForecastQuestionV3,
  OutcomeDeclarationBinding,
  QuestionIdentityFields,
  QuestionKind,
  QuestionOutcome,
  QuestionRecord,
  QuestionRecordV3,
} from './question';
export { THRESHOLD_DIRECTION, computeProfileHash } from './profile';
export type { ForecastProfile, ForecastProfileRecord, ForecastProfileRequirements } from './profile';
export type {
  BandKind,
  ForecastBand,
  ForecastBasis,
  ForecastHashPayload,
  ForecastInput,
  ForecastInputV2,
  ForecastInputV3,
  ForecastInputsV3,
  ForecastHashPayloadV2,
  ForecastHashPayloadV3,
  ForecastInputs,
  ForecastMarketInput,
  ForecastMode,
  ForecastProducer,
  ForecastResult,
  ForecastResultV2,
  ForecastResultV3,
  ForecastStatus,
} from './types';
