// ─────────────────────────────────────────────────────────────
// @uvrn/agent
// ─────────────────────────────────────────────────────────────

export { Agent }                                     from './agent';
export { Scheduler }                                 from './scheduler';
export { normalizeFarmResult }                       from './farm/normalizer';
export { MockFarmConnector }                         from './farm/mock';
export { ConsoleEmitter, FileEmitter, WebhookEmitter, MultiEmitter } from './emitter/index';

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
  AgentStatus,
  AgentEvents,
} from './types/index';

export { PROFILES } from '@uvrn/drift';
export type { ProfileName } from '@uvrn/drift';
