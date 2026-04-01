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
