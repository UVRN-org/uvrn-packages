import type { UVRNReceipt } from '../types';

export function mockReceipt(overrides: Partial<UVRNReceipt> = {}): UVRNReceipt {
  const timestamp = overrides.timestamp ?? Date.now();

  return {
    claim_id: 'clm_test_001',
    claim: 'Test claim for unit testing',
    v_score: 80,
    completeness: 80,
    parity: 80,
    freshness: 80,
    status: 'STABLE',
    timestamp,
    sources: [
      {
        name: 'MockSource1',
        data: { value: 100 },
        timestamp,
        credibility: 0.9,
      },
      {
        name: 'MockSource2',
        data: { value: 101 },
        timestamp: timestamp + 1000,
        credibility: 0.85,
      },
    ],
    ...overrides,
  };
}
