import type { FarmConnector, FarmResult, FarmSource, ClaimRegistration } from '@uvrn/agent';
import type { CanonReceipt, CanonStore, CanonSigner, StorageProof } from '@uvrn/canon';
import type { AgentDriftReceipt, DriftReceipt, DriftSnapshot, DriftStatus, VScoreComponents } from '@uvrn/drift';

export interface UVRNReceiptSource {
  name: string;
  data: Record<string, unknown>;
  timestamp: number;
  credibility: number;
}

export interface UVRNReceipt {
  claim_id: string;
  claim: string;
  v_score: number;
  completeness: number;
  parity: number;
  freshness: number;
  status: DriftStatus;
  timestamp: number;
  sources: UVRNReceiptSource[];
}

export interface MockFarmConnectorOptions {
  latencyMs?: number;
  sources?: FarmSource[];
}

export interface MockSignerOptions {
  address?: string;
}

export interface MockSignedEnvelope {
  signature: string;
  address: string;
  receipt: unknown;
}

export interface Fixtures {
  claimId: string;
  stableReceipt: UVRNReceipt;
  driftingReceipt: UVRNReceipt;
  criticalReceipt: UVRNReceipt;
}

export type {
  AgentDriftReceipt,
  CanonReceipt,
  CanonSigner,
  CanonStore,
  ClaimRegistration,
  DriftReceipt,
  DriftSnapshot,
  FarmConnector,
  FarmResult,
  FarmSource,
  StorageProof,
  VScoreComponents,
};
