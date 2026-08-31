/**
 * @uvrn/receipt — the canonical UVRN receipt object model.
 * One module defines what a receipt is; every surface (packages, MCP, portal, worker, dashboard)
 * imports it. UI/UX can be rebuilt at will without touching receipt identity.
 */

export * from './types';
export * from './canonical';
export * from './schema';
export * from './topics';
export * from './identity';
export * from './vocabulary';
export * from './sign';
export * from './envelope';
export * from './render';
export * from './source-quality';
export {
  buildActionableExplanation,
} from './actionable-explanations';
export type {
  ActionableExplanation,
  SplitDriver,
  SplitDriverKind,
  SpreadDriverFactInput,
  BuildActionableExplanationArgs,
} from './actionable-explanations';
export {
  buildIdeaSnapshots,
  buildSnapshotContext,
  SNAPSHOT_RULES,
} from './snapshots/rules';
export type {
  SnapshotRule,
  SnapshotContext,
  BuildIdeaSnapshotsOptions,
} from './snapshots/rules';
