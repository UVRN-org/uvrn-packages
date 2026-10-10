import type { ComponentBreakdown, ScoringProfile, ScoreBreakdownResult } from '../types';

function statusFor(score: number, profile: ScoringProfile): 'STABLE' | 'DRIFTING' | 'CRITICAL' {
  if (score >= profile.thresholds.stable) {
    return 'STABLE';
  }

  if (score >= profile.thresholds.drifting) {
    return 'DRIFTING';
  }

  return 'CRITICAL';
}

function summarizeLimitingComponent(
  result: Pick<ScoreBreakdownResult, 'completeness' | 'parity' | 'freshness'>
): string {
  const components: Array<[string, ComponentBreakdown]> = [
    ['Completeness', result.completeness],
    ['Parity', result.parity],
    ['Freshness', result.freshness],
  ];

  const [label] = components.reduce((lowest, current) => {
    return current[1].raw < lowest[1].raw ? current : lowest;
  });

  return `${label} is the limiting factor.`;
}

export function buildExplanation(result: ScoreBreakdownResult, profile: ScoringProfile): string {
  const status = statusFor(result.final, profile);

  return [
    `V-Score: ${result.final.toFixed(1)} (${profile.name} profile)`,
    `Completeness: ${result.completeness.raw}/100 (${result.completeness.weighted.toFixed(1)} pts)`,
    `Parity: ${result.parity.raw}/100 (${result.parity.weighted.toFixed(1)} pts)`,
    `Freshness: ${result.freshness.raw}/100 (${result.freshness.weighted.toFixed(1)} pts)`,
    `Consensus is ${status}.`,
    summarizeLimitingComponent(result),
  ].join(' — ');
}
