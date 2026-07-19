import type {
  FarmResult as AgentFarmResult,
  FarmSource as AgentFarmSource,
} from '@uvrn/agent';

export type { DeltaBundle, DataSpec, MetricPoint } from '@uvrn/core';

export type StanceLabel =
  | 'supports'
  | 'opposes'
  | 'mixed'
  | 'neutral'
  | 'insufficient';

export interface FarmSource extends AgentFarmSource {
  stanceValue?: number;
  stanceLabel?: StanceLabel;
  stanceConfidence?: number;
  stanceEvidence?: string;
}

export interface FarmResult extends Omit<AgentFarmResult, 'sources'> {
  sources: FarmSource[];
}

export type StanceFallbackReason =
  | 'source-quorum-missed'
  | 'grounded-quorum-missed';

export interface StanceMode {
  evidenceAxis: 'stance' | 'prominence';
  sourceCount: number;
  groundedCount: number;
  requiredSources: 4;
  requiredGrounded: 3;
  confidenceFloor: 0.6;
  quorumMet: boolean;
  fallbackReason?: StanceFallbackReason;
}

export interface SourceWeights {
  credibility: number;
  recency: number;
  coverage: number;
}

/**
 * Configuration for near-identical source deduplication.
 *
 * Two sources are collapsed when their metric values are "near-identical" AND their
 * publication timestamps fall within the dedup time window. The defaults reproduce the
 * historical (v3) hardcoded behavior exactly: ±1% relative tolerance within 24 hours.
 *
 * Modes:
 * - `'relative'` (default): values match when |a−b| / max(|a|, |b|, 1) <= relativeTolerance
 * - `'absolute'`: values match when |a−b| <= relativeTolerance (the tolerance is read as an
 *   absolute delta in this mode)
 * - `'off'`: deduplication is disabled — every parsed source is retained
 */
export interface DedupConfig {
  /**
   * Value tolerance. In `'relative'` mode this is a ratio (default `0.01` = ±1%); in
   * `'absolute'` mode it is an absolute delta in the metric's own unit.
   */
  relativeTolerance?: number;
  /**
   * Maximum publication-time distance (ms) for two sources to be considered duplicates.
   * Default `86_400_000` (1 day).
   */
  timeWindowMs?: number;
  /** Dedup comparison mode. Default `'relative'`. */
  mode?: 'relative' | 'absolute' | 'off';
}

export interface ConsensusEngineOptions {
  sources: FarmResult;
  weights?: Partial<SourceWeights>;
  claim?: string;
  /**
   * Near-identical source deduplication thresholds. Omitting this (or any field) preserves
   * v3 behavior exactly: relative mode, ±1% tolerance, 1-day window.
   */
  dedup?: DedupConfig;
}

export interface ConsensusStats {
  sourceCount: number;
  agreementScore: number;
  coverageScore: number;
  recencyScore: number;
  weightedConsensusScore: number;
  summary: string;
  /**
   * Present only when stance quorum activates. Omitting it on fallback keeps
   * the frozen prominence result byte-identical (D2 hard wall 4).
   */
  evidenceAxis?: 'stance';
}

/**
 * Named V-Score input components derived from a consensus run.
 * These values are the bridge between @uvrn/consensus and @uvrn/score.
 *
 * Sibling coupling: @uvrn/score consumes these fields directly via
 * ScoreBreakdown({ completeness, parity, freshness }).
 *
 * Note: maps consensus source stats into V-Score inputs — does not convert
 * a DeltaReceipt from @uvrn/core into V-Score components.
 */
export interface ConsensusResult {
  /** DeltaBundle ready for @uvrn/core runDeltaEngine() */
  bundle: import('@uvrn/core').DeltaBundle;
  /** Named V-Score input components — pass directly to @uvrn/score ScoreBreakdown */
  components: {
    /** Source coverage: % of sources that yielded usable numeric values (0–100) */
    completeness: number;
    /** Parity (0–100): near-identical sources are deduped first, then parity = the largest retained numeric-value cluster after two-decimal normalization */
    parity: number;
    /** Recency: average recency score across ranked sources (0–100) */
    freshness: number;
  };
  /** Full stats for debugging/audit — superset of components */
  stats: ConsensusStats;
}

export interface RankedSource {
  dataSpec: import('@uvrn/core').DataSpec;
  weightScore: number;
  credibilityScore: number;
  recencyScore: number;
  coverageScore: number;
  metricValue: number;
  publishedAt: string;
  unit?: string;
  originalSource: FarmSource;
}

export class ConsensusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConsensusError';
  }
}
