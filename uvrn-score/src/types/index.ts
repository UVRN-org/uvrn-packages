export interface ScoringProfile {
  name: string;
  description: string;
  completenessNote: string;
  parityNote: string;
  freshnessNote: string;
  thresholds: {
    stable: number;
    drifting: number;
  };
}

export interface ComponentBreakdown {
  raw: number;
  weight: number;
  weighted: number;
}

export interface ScoreBreakdownResult {
  completeness: ComponentBreakdown;
  parity: ComponentBreakdown;
  freshness: ComponentBreakdown;
  final: number;
  explanation: string;
  profile: string;
}

export interface ScoreInputComponents {
  completeness: number;
  parity: number;
  freshness: number;
}

export const WEIGHTS = {
  completeness: 0.35,
  parity: 0.35,
  freshness: 0.3,
} as const;
