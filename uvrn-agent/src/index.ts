// ─────────────────────────────────────────────────────────────
// @uvrn/agent
// ─────────────────────────────────────────────────────────────

export { Agent }                                     from './agent';
export { Scheduler }                                 from './scheduler';
export { normalizeFarmResult }                       from './farm/normalizer';
export { MockFarmConnector }                         from './farm/mock';
export { ConsoleEmitter, FileEmitter, WebhookEmitter, MultiEmitter } from './emitter/index';
export { InMemoryAgentStateStore }                   from './store/index';

export type {
  ClaimRegistration,
  ClaimState,
  ClaimAgentStatus,
  FarmConnector,
  FarmResult,
  FarmSource,
  NormalizedComponents,
  ReceiptEmitter,
  AgentConfig,
  AgentStateStore,
  AgentStatus,
  AgentEvents,
  PersistedAgentState,
  PersistedClaimState,
} from './types/index';

export { PROFILES } from '@uvrn/drift';
export type { ProfileName } from '@uvrn/drift';
