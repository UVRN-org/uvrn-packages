import type { DeltaBundle } from '@uvrn/core';

const baseBundle: DeltaBundle = {
  bundleId: 'test-bundle-001',
  claim: 'Q1 revenue is approximately $1.2M',
  thresholdPct: 0.05,
  dataSpecs: [
    {
      id: 'source-a',
      label: 'Source A',
      sourceKind: 'report',
      originDocIds: ['doc-a'],
      metrics: [
        {
          key: 'revenue',
          value: 1200000,
          unit: 'USD',
          ts: '2024-04-01T00:00:00Z',
        },
      ],
    },
    {
      id: 'source-b',
      label: 'Source B',
      sourceKind: 'report',
      originDocIds: ['doc-b'],
      metrics: [
        {
          key: 'revenue',
          value: 1195000,
          unit: 'USD',
          ts: '2024-04-01T00:00:00Z',
        },
      ],
    },
  ],
};

export function createTestBundle(overrides: Partial<DeltaBundle> = {}): DeltaBundle {
  return {
    ...baseBundle,
    ...overrides,
    dataSpecs: overrides.dataSpecs ?? baseBundle.dataSpecs,
  };
}

export function createDivergentBundle(
  overrides: Partial<DeltaBundle> = {}
): DeltaBundle {
  const divergent: DeltaBundle = {
    bundleId: 'divergent-bundle-001',
    claim: 'Revenue is $1.0M',
    thresholdPct: 0.05,
    dataSpecs: [
      {
        id: 'source-a',
        label: 'Source A',
        sourceKind: 'report',
        originDocIds: ['doc-a'],
        metrics: [{ key: 'revenue', value: 0 }],
      },
      {
        id: 'source-b',
        label: 'Source B',
        sourceKind: 'report',
        originDocIds: ['doc-b'],
        metrics: [{ key: 'revenue', value: 1000000 }],
      },
    ],
  };

  return {
    ...divergent,
    ...overrides,
    dataSpecs: overrides.dataSpecs ?? divergent.dataSpecs,
  };
}
