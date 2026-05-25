export type { FarmResult, FarmSource } from '@uvrn/agent';
export type { DeltaBundle, DataSpec, MetricPoint } from '@uvrn/core';

export interface SourceWeights {
  credibility: number;
  recency: number;
  coverage: number;
}

export interface ConsensusEngineOptions {
  sources: import('@uvrn/agent').FarmResult;
  weights?: Partial<SourceWeights>;
  claim?: string;
}

export interface ConsensusStats {
  sourceCount: number;
  agreementScore: number;
  coverageScore: number;
  recencyScore: number;
  weightedConsensusScore: number;
  summary: string;
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
  originalSource: import('@uvrn/agent').FarmSource;
}

export class ConsensusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConsensusError';
  }
}
