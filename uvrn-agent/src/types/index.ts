// ─────────────────────────────────────────────────────────────
// @uvrn/agent — types
// ─────────────────────────────────────────────────────────────

import type { DriftConfig, DriftSnapshot, DriftThresholdEvent, DriftProfile } from '@uvrn/drift';
import type { AgentDriftReceipt } from '@uvrn/drift';

export interface ClaimRegistration {
  id:           string;
  label:        string;
  query:        string;
  driftConfig:  DriftConfig | DriftProfile;
  intervalMs:   number;
  tags?:        string[];
  metadata?:    Record<string, unknown>;
}

export interface ClaimState {
  registration:     ClaimRegistration;
  lastSnapshot:     DriftSnapshot | null;
  lastVerifiedAt:   string | null;
  receiptSequence:  number;
  consecutiveFails: number;
  status:           ClaimAgentStatus;
}

export type ClaimAgentStatus =
  | 'idle'
  | 'running'
  | 'STABLE'
  | 'DRIFTING'
  | 'CRITICAL'
  | 'error';

export interface FarmResult {
  claimId:      string;
  sources:      FarmSource[];
  fetchedAt:    string;
  durationMs:   number;
}

export interface FarmSource {
  url:          string;
  title:        string;
  snippet:      string;
  publishedAt?: string;
  credibility?: number;
  /**
   * Optional host-supplied numeric evidence score. When present, downstream
   * numeric extractors (consensus, normalize `general`) prefer this value over
   * regex-parsing it out of `title`/`snippet` — so a number in the title can no
   * longer override the intended score. Additive and backward-compatible.
   */
  evidenceScore?: number;
}

export interface NormalizedComponents {
  completeness: number;
  parity:       number;
  freshness:    number;
}

export interface AgentConfig {
  farmConnector:    FarmConnector;
  receiptEmitter:   ReceiptEmitter;
  concurrency?:     number;
  maxConsecutiveFails?: number;
  jitterMs?:        number;
  agentId?:         string;
  /**
   * Optional persistence seam for durable agent state. The agent saves its
   * state through this store whenever it changes (register, unregister, each
   * run). Defaults to an `InMemoryAgentStateStore`, preserving the existing
   * in-memory behavior. Inject a durable implementation (e.g. a SQLite-backed
   * store) and call `agent.restore()` after construction so registrations,
   * snapshots, and failure counts survive restarts.
   */
  stateStore?:      AgentStateStore;
}

/**
 * Durable per-claim state captured by the agent: the registration itself plus
 * the run bookkeeping (`lastSnapshot`, `lastVerifiedAt`, `receiptSequence`,
 * `consecutiveFails`). The transient `status` field is intentionally not
 * persisted — it is rederived from `lastSnapshot` on restore.
 */
export interface PersistedClaimState {
  registration:     ClaimRegistration;
  lastSnapshot:     DriftSnapshot | null;
  lastVerifiedAt:   string | null;
  receiptSequence:  number;
  consecutiveFails: number;
}

/**
 * Snapshot of everything an agent needs to resume after a restart: every
 * tracked claim's `PersistedClaimState` plus the lifetime run counter.
 */
export interface PersistedAgentState {
  claims:    Record<string, PersistedClaimState>;
  totalRuns: number;
}

/**
 * Pluggable persistence seam for durable agent state.
 *
 * The agent writes a full `PersistedAgentState` snapshot through this
 * interface at every state-changing point and reads it back via
 * `agent.restore()`. The default `InMemoryAgentStateStore` keeps the existing
 * in-memory behavior. Implementations are injected — this package ships no
 * storage of its own.
 */
export interface AgentStateStore {
  /** Load the persisted state for an agent id, or `null` when none exists. */
  loadState(agentId: string): Promise<PersistedAgentState | null>;
  /** Persist a full state snapshot for an agent id, replacing any previous one. */
  saveState(agentId: string, state: PersistedAgentState): Promise<void>;
}

export interface FarmConnector {
  fetch(claim: ClaimRegistration): Promise<FarmResult>;
}

export interface ReceiptEmitter {
  emit(receipt: AgentDriftReceipt, events: DriftThresholdEvent[]): Promise<void>;
}

export interface AgentEvents {
  'claim:registered':   (claim: ClaimRegistration) => void;
  'claim:started':      (claimId: string) => void;
  'claim:scored':       (snapshot: DriftSnapshot) => void;
  'claim:threshold':    (event: DriftThresholdEvent) => void;
  'claim:error':        (claimId: string, error: Error) => void;
  'receipt:emitted':    (receipt: AgentDriftReceipt) => void;
  'agent:started':      () => void;
  'agent:stopped':      () => void;
}

export interface AgentStatus {
  running:    boolean;
  claims:     ClaimStatusSummary[];
  startedAt:  string | null;
  totalRuns:  number;
}

export interface ClaimStatusSummary {
  id:              string;
  label:           string;
  status:          ClaimAgentStatus;
  vScore:          number | null;
  lastVerifiedAt:  string | null;
  nextRunIn:       number;
  receiptSequence: number;
}
