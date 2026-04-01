import type { FarmResult } from '@uvrn/agent';

export function mockFarmResult(overrides: Partial<FarmResult> = {}): FarmResult {
  const claimId = overrides.claimId ?? 'clm_test_001';

  return {
    claimId,
    sources: overrides.sources ?? [
      {
        url: `https://mock.example.com/${claimId}/1`,
        title: 'Mock source 1',
        snippet: 'First mock source for unit tests.',
        publishedAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
        credibility: 0.92,
      },
      {
        url: `https://mock.example.com/${claimId}/2`,
        title: 'Mock source 2',
        snippet: 'Second mock source for unit tests.',
        publishedAt: new Date('2026-04-01T01:00:00.000Z').toISOString(),
        credibility: 0.88,
      },
    ],
    fetchedAt: overrides.fetchedAt ?? new Date('2026-04-01T02:00:00.000Z').toISOString(),
    durationMs: overrides.durationMs ?? 25,
  };
}
