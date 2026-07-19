// ─────────────────────────────────────────────
// @uvrn/drift · types
// ─────────────────────────────────────────────

export type DecayCurve = 'LINEAR' | 'SIGMOID' | 'EXPONENTIAL';

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

interface DriftInputReceiptBase {
  issuer: string;
  timestamp: string;
  components: VScoreComponents;
  tags?: string[];
  /** Optional claim identity aliases when used in canon/agent pipelines. */
  claim_id?: string;
  claimId?: string;
}

/** Existing snake_case input contract, preserved for current callers. */
export interface DriftInputReceipt extends DriftInputReceiptBase {
  receipt_id: string;
  receiptId?: string;
  v_score: number;
  vScore?: number;
}

/** Additive camelCase input contract. */
export interface CamelCaseDriftInputReceipt extends DriftInputReceiptBase {
  receiptId: string;
  receipt_id?: string;
  vScore: number;
  v_score?: number;
}

/** Either public naming style; both map to one internal representation. */
export type DriftReceiptInput = DriftInputReceipt | CamelCaseDriftInputReceipt;

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

/** Output always carries both naming styles with equal values (ADR-010). */
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

export type DriftStatus = 'STABLE' | 'DRIFTING' | 'CRITICAL';

export interface DriftThresholdEvent {
  receipt_id: string;
  from: DriftStatus;
  to: DriftStatus;
  score: number;
  delta: number;
  at: string;
  /** Agent/canon compatibility. */
  claimId?: string;
  receiptId?: string;
  component?: keyof VScoreComponents | 'composite';
  vScore?: number;
  crossedAt?: string;
}

export interface DriftMonitorConfig {
  intervalMs: number;
  onThreshold?: (event: DriftThresholdEvent) => void;
  onTick?: (results: DriftReceipt[]) => void;
}

/** Snapshot shape used by @uvrn/canon and @uvrn/agent — score state at a point in time. */
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

/** Config for agent-style computeDriftFromInput (weights, thresholds, curve). */
export interface DriftConfig {
  weights: { completeness: number; parity: number; freshness: number };
  thresholds: { drifting: number; critical: number };
  curve: DecayCurve;
  rate: number;
}

/** Input for agent-style computeDriftFromInput. config can be DriftConfig or DriftProfile (e.g. PROFILES.slow). */
export interface DriftInput {
  receiptId: string;
  claimId: string;
  originalScore: number;
  components: VScoreComponents;
  verifiedAt: string;
  config: DriftConfig | DriftProfile;
  previousSnapshot?: DriftSnapshot | null;
}

/** Result of computeDriftFromInput — snapshot, receipt (flat shape for agent), and threshold events. */
export interface DriftResult {
  snapshot: DriftSnapshot;
  receipt: AgentDriftReceipt;
  events: DriftThresholdEvent[];
}

/** Flat receipt shape produced by computeDriftFromInput for @uvrn/agent. */
export interface AgentDriftReceipt {
  receipt_id: string;
  receiptId?: string;
  claim_id: string;
  claimId?: string;
  agent: string;
  drift_module: string;
  driftModule?: string;
  v_score: number;
  vScore?: number;
  drift_delta: number;
  driftDelta?: number;
  decay_curve: string;
  decayCurve?: string;
  age_hours: number;
  ageHours?: number;
  status: DriftStatus;
  components: VScoreComponents;
  thresholds: { drifting: number; critical: number };
  scored_at: string;
  scoredAt?: string;
  tags: string[];
}
