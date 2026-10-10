export type { FarmSource } from '@uvrn/agent';

export interface NormalizedSource {
  name: string;
  value: number | string | null;
  unit: string;
  timestamp: number;
  credibility: number;
  rawData: unknown;
  normalizer: string;
}

export interface NormalizationProfile {
  name: string;
  description: string;
  transform(source: import('@uvrn/agent').FarmSource): NormalizedSource;
  normalizeTimestamp(timestamp: unknown): number;
  normalizePrecision(value: number, unit: string): number;
}

export interface NormalizationResult {
  sources: NormalizedSource[];
  profile: string;
  timestamp: number;
}
