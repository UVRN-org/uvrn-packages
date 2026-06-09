import type { ScoredCandidate } from '../types';

export function readNumericField(candidate: ScoredCandidate, key: string): number {
  const topLevel = (candidate as Record<string, unknown>)[key];

  if (typeof topLevel === 'number' && Number.isFinite(topLevel)) {
    return topLevel;
  }

  const nested = candidate.signals?.[key];
  return typeof nested === 'number' && Number.isFinite(nested) ? nested : 0;
}
