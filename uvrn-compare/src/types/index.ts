export interface CompareOptions {
  normalize?: boolean;
  includeTimeline?: boolean;
}

export interface CompareResult {
  winner: unknown;
  loser: unknown;
  delta: number;
  divergenceAt?: string;
  summary: string;
  details: {
    receiptA: { claimId: string; vScore: number; status: string };
    receiptB: { claimId: string; vScore: number; status: string };
  };
}

export interface SeriesOptions {
  claim?: string;
}

export interface SeriesResult {
  claimId: string;
  trend: 'improving' | 'declining' | 'stable';
  peakScore: number;
  peakAt?: number;
  latestScore: number;
  changeRate: number;
  summary: string;
}
