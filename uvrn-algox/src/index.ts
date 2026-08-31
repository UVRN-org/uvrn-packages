export * from './types';
export { runPipeline, buildContext, pushWarning } from './pipeline';
export { normalizeUrl, hostOf } from './util/normalizeUrl';
export { readNumericField } from './util/readNumericField';

export { dropMissing } from './stages/filters/dropMissing';
export { dedupByKey } from './stages/filters/dedupByKey';
export type { DedupByKeyOptions, DedupPreferFn, KeyFn } from './stages/filters/dedupByKey';
export { capPerGroup } from './stages/filters/capPerGroup';
export type { CapPerGroupOptions } from './stages/filters/capPerGroup';
export { freshnessFilter } from './stages/filters/freshnessFilter';
export type { FreshnessOptions } from './stages/filters/freshnessFilter';

export { weightedScorer } from './stages/scorers/weightedScorer';
export type { WeightedScorerOptions } from './stages/scorers/weightedScorer';

export { topK } from './stages/selectors/topK';
export type { TopKOptions } from './stages/selectors/topK';

export { buildSignalStages, rankSignals, resolveConfig } from './presets/signals';
export {
  reportRankStability,
  candidateIdentity,
  DEFAULT_RANK_STABILITY_VARIANTS,
} from './presets/rankStability';
export type {
  RankStabilityStatus,
  RankStabilityVariant,
  RankStabilityOptions,
  RankStabilityEntry,
  RankStabilityReport,
} from './presets/rankStability';

export {
  measurementResultsToCandidates,
  rankMeasurementResults,
} from './presets/measurementBridge';
export type {
  MeasurementResultLike,
  MeasurementBridgeOptions,
} from './presets/measurementBridge';
