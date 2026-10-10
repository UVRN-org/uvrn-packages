/**
 * Structural copies of the record shapes the main-entry stores persist, taken from the
 * OPTIONAL peers @uvrn/canon, @uvrn/identity, @uvrn/drift, @uvrn/watch and @uvrn/agent.
 *
 * Why local: the main entry's published declarations must type-check for a consumer that
 * installs only @uvrn/store-sqlite (no optional peers, no skipLibCheck). Importing these
 * types from the peers made `dist/*.d.ts` fail with TS2307 in that setup.
 *
 * TypeScript is structural, so these are interchangeable with the peer types: the stores
 * still satisfy CanonStore / IdentityStore / TimelineStore / WatchStore / AgentStateStore.
 * `tests/peer-types.test.ts` asserts exact type equality against the real peer packages, so
 * any drift fails the build. Type-only; nothing here exists at runtime. Not re-exported.
 */

// ── @uvrn/drift ────────────────────────────────────────────────────────────

export type DecayCurve = 'LINEAR' | 'SIGMOID' | 'EXPONENTIAL';

export type DriftStatus = 'STABLE' | 'DRIFTING' | 'CRITICAL';

export interface DriftProfile {
  name: string;
  curve: DecayCurve;
  rate: number;
  staleAfterHours: number;
  scoreFloor?: number;
}

export interface VScoreComponents {
  completeness: number;
  parity: number;
  freshness: number;
}

export interface DriftValues {
  decayed_score: number;
  decayedScore?: number;
  delta: number;
  age_hours: number;
  ageHours?: number;
  curve: DecayCurve;
  profile: string;
  scored_at: string;
  scoredAt?: string;
  status: DriftStatus;
  decayed_freshness: number;
  decayedFreshness?: number;
}

export interface DriftReceipt {
  receipt_id: string;
  receiptId?: string;
  issuer: string;
  timestamp: string;
  v_score: number;
  vScore?: number;
  components: VScoreComponents;
  tags?: string[];
  claim_id?: string;
  claimId?: string;
  drift: DriftValues;
}

export interface DriftSnapshot {
  receiptId: string;
  claimId: string;
  scoredAt: string;
  components: VScoreComponents;
  vScore: number;
  decayCurve?: string;
  ageHours?: number;
  driftDelta?: number;
  status: DriftStatus;
}

export interface DriftConfig {
  weights: { completeness: number; parity: number; freshness: number };
  thresholds: { drifting: number; critical: number };
  curve: DecayCurve;
  rate: number;
}

// ── @uvrn/canon ────────────────────────────────────────────────────────────

export type StoreType = 'r2' | 'supabase' | 'ipfs' | 'sqlite' | (string & {});

export interface StorageProof {
  store: StoreType;
  location: string;
  written_at: string;
  checksum: string;
}

export interface CheckerAttestation {
  kind: 'ai' | 'human';
  identity: string;
  decidedAt: string;
  verdict: 'pass' | 'fail' | 'abstain';
  notes?: string;
}

export type CanonTrigger =
  | { type: 'auto_suggest'; confirmed_by: string; suggestion_id: string }
  | { type: 'manual'; confirmed_by: string; reason?: string };

export interface CanonReceipt {
  canon_id: string;
  receipt_id: string;
  claim_id: string;
  canon_seq: number;
  drift_receipt: DriftReceipt;
  final_snapshot: DriftSnapshot;
  triggered_by: CanonTrigger;
  canonized_at: string;
  canonized_by: string;
  content_hash: string;
  signature: string;
  public_key: string;
  storage_proofs: StorageProof[];
  reviewer_attestation?: CheckerAttestation;
  certificate: 'DRVC3 v1.01';
  block_state: 'canonized';
  tags: string[];
  replay_id: string;
}

// ── @uvrn/identity ─────────────────────────────────────────────────────────

export type ReputationLevel = 'trusted' | 'established' | 'new' | 'unknown';

export interface ReputationScore {
  signerAddress: string;
  score: number;
  receipts: number;
  accuracy: number;
  canonRate: number;
  since: string;
  lastSeen: string;
  level: ReputationLevel;
  attestedReceipts?: number;
}

export interface ReputationActivity {
  signerAddress: string;
  receiptId: string;
  vScore: number;
  consensusVScore: number;
  canonized: boolean;
  timestamp: number;
}

// ── @uvrn/watch ────────────────────────────────────────────────────────────

export type AlertStatus = Extract<DriftStatus, 'DRIFTING' | 'CRITICAL'>;
export type AlertMode = 'once' | 'every';

export interface AlertEvent {
  claimId: string;
  status: AlertStatus;
  vScore: number;
  driftDelta: number;
  triggeredAt: string;
  subscriberId: string;
  summary: string;
}

export interface DeliveryTarget {
  deliver(event: AlertEvent): Promise<void>;
}

export interface NotifyTargets {
  callback?: (event: AlertEvent) => void;
  webhook?: string;
  slack?: string;
  discord?: string;
  targets?: DeliveryTarget | DeliveryTarget[];
}

export interface SubscribeOptions {
  on: AlertStatus | AlertStatus[];
  notify: NotifyTargets;
  mode?: AlertMode;
  cooldown?: number;
  retryAttempts?: number;
  retryBackoffMs?: number;
}

export interface Subscription {
  claimId: string;
  options: SubscribeOptions;
  subscriberId: string;
  lastAlertAt?: number;
  alertCount: number;
  active: boolean;
}

// ── @uvrn/agent ────────────────────────────────────────────────────────────

export interface ClaimRegistration {
  id: string;
  label: string;
  query: string;
  driftConfig: DriftConfig | DriftProfile;
  intervalMs: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface PersistedClaimState {
  registration: ClaimRegistration;
  lastSnapshot: DriftSnapshot | null;
  lastVerifiedAt: string | null;
  receiptSequence: number;
  consecutiveFails: number;
}

export interface PersistedAgentState {
  claims: Record<string, PersistedClaimState>;
  totalRuns: number;
}
