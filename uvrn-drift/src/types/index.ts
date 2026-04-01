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

export interface DriftInputReceipt {
  receipt_id: string;
  issuer: string;
  timestamp: string;
  v_score: number;
  components: VScoreComponents;
  tags?: string[];
  /** Optional claim id when receipt is used in canon/agent pipeline. */
  claim_id?: string;
}

export interface DriftReceipt extends DriftInputReceipt {
  drift: {
    decayed_score: number;
    delta: number;
    age_hours: number;
    curve: DecayCurve;
    profile: string;
    scored_at: string;
    status: DriftStatus;
    decayed_freshness: number;
  };
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
  claim_id: string;
  agent: string;
  drift_module: string;
  v_score: number;
  drift_delta: number;
  decay_curve: string;
  age_hours: number;
  status: DriftStatus;
  components: VScoreComponents;
  thresholds: { drifting: number; critical: number };
  scored_at: string;
  tags: string[];
}
