import type { AgentDriftReceipt, DriftSnapshot, VScoreComponents } from '@uvrn/drift';

function components(overrides: Partial<VScoreComponents> = {}): VScoreComponents {
  return {
    completeness: 80,
    parity: 80,
    freshness: 80,
    ...overrides,
  };
}

export function mockDriftSnapshot(overrides: Partial<DriftSnapshot> = {}): DriftSnapshot {
  return {
    receiptId: 'rcpt_test_001',
    claimId: 'clm_test_001',
    scoredAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
    components: components(overrides.components),
    vScore: 80,
    decayCurve: 'LINEAR',
    ageHours: 1,
    driftDelta: -2,
    status: 'STABLE',
    ...overrides,
  };
}

export function mockAgentDriftReceipt(
  overrides: Partial<AgentDriftReceipt> = {}
): AgentDriftReceipt {
  return {
    receipt_id: 'drift_receipt_test_001',
    claim_id: 'clm_test_001',
    agent: '@uvrn/agent@test',
    drift_module: '@uvrn/drift@test',
    v_score: 80,
    drift_delta: -2,
    decay_curve: 'LINEAR',
    age_hours: 1,
    status: 'STABLE',
    components: components(overrides.components),
    thresholds: {
      drifting: 80,
      critical: 60,
    },
    scored_at: new Date('2026-04-01T00:00:00.000Z').toISOString(),
    tags: ['#uvrn', '#test'],
    ...overrides,
  };
}
