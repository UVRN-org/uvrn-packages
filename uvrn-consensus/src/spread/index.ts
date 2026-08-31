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
} from './types';

export {
  normalizeRoleAssignment,
  isAssumedMissingWhy,
  isPartitionableRole,
  labelRoles,
  organizeByRole,
} from './role';

export { calculateClassPartitionedAgreement } from './classPartitionedAgreement';
export { reportSpread } from './reportSpread';
export { spreadToDriverFacts } from './toDriverFacts';
export type { SpreadDriverFact } from './toDriverFacts';
