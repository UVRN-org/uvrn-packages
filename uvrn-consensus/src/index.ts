export * from './types';
export { ConsensusEngine } from './engine/ConsensusEngine';
export {
  evaluateStanceMode,
  isGroundedStanceSource,
  STANCE_CONFIDENCE_MIN,
  STANCE_QUORUM_GROUNDED,
  STANCE_QUORUM_SOURCES,
} from './engine/stance';
export {
  extractProminenceValue,
  extractRankedSources,
  extractRankedSourcesWithHonesty,
  calculateAgreementScore,
  calculateOriginAgreementScore,
  resolveOriginId,
  isExcludedForecast,
  buildBundleId,
} from './engine/aggregation';
export { DEFAULT_SOURCE_WEIGHTS, resolveWeights, resolveCredibilityForWeighting } from './engine/weighting';
export {
  normalizeRoleAssignment,
  isAssumedMissingWhy,
  isPartitionableRole,
  labelRoles,
  organizeByRole,
  calculateClassPartitionedAgreement,
  reportSpread,
  spreadToDriverFacts,
} from './spread';
export type {
  EvidenceClass,
  RoleProvenance,
  RoleAssignment,
  SpreadSourceInput,
  SpreadSign,
  ClassAgreementPartition,
  ClassPartitionedAgreementResult,
  OrganizedSpreadSources,
  SpreadPartitionSummary,
  SpreadReadout,
  ReportSpreadOptions,
  SpreadDriverFact,
} from './spread';
