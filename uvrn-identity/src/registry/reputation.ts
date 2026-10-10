import type { ReputationLevel, ReputationScore } from '../types';

export function determineLevel(score: number, receipts: number): ReputationLevel {
  if (receipts <= 0) {
    return 'unknown';
  }
  if (score >= 85 && receipts >= 100) {
    return 'trusted';
  }
  if (score >= 60 && receipts >= 10) {
    return 'established';
  }
  if (receipts < 10) {
    return 'new';
  }

  return 'new';
}

export function createEmptyReputation(address: string, timestampMs = Date.now()): ReputationScore {
  const iso = new Date(timestampMs).toISOString();

  return {
    signerAddress: address,
    score: 0,
    receipts: 0,
    accuracy: 0,
    canonRate: 0,
    since: iso,
    lastSeen: iso,
    level: 'new',
  };
}

export function calculateReputationScore(
  canonRate: number,
  accuracy: number,
  receipts: number
): number {
  const volumeScore = Math.min(receipts / 100, 1) * 100;
  return canonRate * 100 * 0.4 + accuracy * 100 * 0.4 + volumeScore * 0.2;
}
