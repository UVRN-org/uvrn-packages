// ─────────────────────────────────────────────────────────────
// @uvrn/agent — farm normalizer
// ─────────────────────────────────────────────────────────────

import type { FarmResult, FarmSource, NormalizedComponents } from '../types/index';

function scoreCompleteness(sources: FarmSource[]): number {
  if (sources.length === 0) return 0;
  const countScore = 100 * (1 - Math.exp(-0.25 * sources.length));
  const credScores = sources.filter(s => s.credibility != null);
  const credBonus  = credScores.length > 0
    ? credScores.reduce((sum, s) => sum + (s.credibility ?? 0), 0) / credScores.length * 0.1
    : 0;
  return clamp(countScore + credBonus);
}

function scoreParity(sources: FarmSource[]): number {
  if (sources.length === 0) return 0;
  if (sources.length === 1) return 70;
  const dated = sources
    .filter(s => s.publishedAt)
    .map(s => new Date(s.publishedAt!).getTime());
  if (dated.length < 2) return 75;
  const min    = Math.min(...dated);
  const max    = Math.max(...dated);
  const days   = (max - min) / (1000 * 60 * 60 * 24);
  const spreadScore = 100 * Math.exp(-0.015 * days);
  return clamp(spreadScore);
}

function scoreFreshness(sources: FarmSource[], fetchedAt: string): number {
  if (sources.length === 0) return 0;
  const fetchTime   = new Date(fetchedAt).getTime();
  const sourceDates = sources
    .filter(s => s.publishedAt)
    .map(s => new Date(s.publishedAt!).getTime());
  if (sourceDates.length === 0) return 60;
  const mostRecent = Math.max(...sourceDates);
  const ageHours   = (fetchTime - mostRecent) / (1000 * 60 * 60);
  const freshScore = 100 * Math.exp(-0.004 * ageHours);
  return clamp(freshScore);
}

export function normalizeFarmResult(result: FarmResult): NormalizedComponents {
  return {
    completeness: scoreCompleteness(result.sources),
    parity:       scoreParity(result.sources),
    freshness:    scoreFreshness(result.sources, result.fetchedAt),
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
