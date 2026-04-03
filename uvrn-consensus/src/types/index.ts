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
