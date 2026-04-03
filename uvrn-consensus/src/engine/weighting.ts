import type { SourceWeights } from '../types';

export const DEFAULT_SOURCE_WEIGHTS: SourceWeights = {
  credibility: 0.4,
  recency: 0.3,
  coverage: 0.3,
};

const EPSILON = 0.000001;

export function resolveWeights(weights?: Partial<SourceWeights>): SourceWeights {
  const resolved: SourceWeights = {
    ...DEFAULT_SOURCE_WEIGHTS,
    ...weights,
  };

  const total = resolved.credibility + resolved.recency + resolved.coverage;
  if (Math.abs(total - 1) > EPSILON) {
    throw new Error(
      `Source weights must sum to 1.0. Received ${total.toFixed(6)} from credibility=${resolved.credibility}, recency=${resolved.recency}, coverage=${resolved.coverage}.`
    );
  }

  return resolved;
}

export function clampScore(value: number, min = 0, max = 100): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeCredibilityScore(value?: number): number {
  if (value == null) {
    return 50;
  }

  if (value <= 1) {
    return clampScore(value * 100);
  }

  return clampScore(value);
}

export function calculateRecencyScore(
  sourceTimestampMs: number,
  fetchedAtMs: number
): number {
  const diffMs = Math.max(0, fetchedAtMs - sourceTimestampMs);
  const ageDays = diffMs / (1000 * 60 * 60 * 24);
  const rawScore = 100 - (ageDays / 30) * 100;
  return clampScore(rawScore);
}

export function calculateWeightedScore(
  credibilityScore: number,
  recencyScore: number,
  coverageScore: number,
  weights: SourceWeights
): number {
  return (
    credibilityScore * weights.credibility +
    recencyScore * weights.recency +
    coverageScore * weights.coverage
  );
}
