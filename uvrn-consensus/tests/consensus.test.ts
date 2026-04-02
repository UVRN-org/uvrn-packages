import type { FarmResult, FarmSource } from '@uvrn/agent';
import { validateBundle } from '@uvrn/core';

import { ConsensusEngine, ConsensusError } from '../src';

function buildSource(overrides: Partial<FarmSource> = {}): FarmSource {
  return {
    url: 'https://example.com/source',
    title: 'Reserve ratio 100',
    snippet: 'Exchange reserves remain at 100 USD according to the latest filing.',
    publishedAt: '2026-04-01T00:00:00.000Z',
    credibility: 0.8,
    ...overrides,
  };
}

function buildFarmResult(overrides: Partial<FarmResult> = {}): FarmResult {
  return {
    claimId: 'clm_reserves_001',
    fetchedAt: '2026-04-02T00:00:00.000Z',
    durationMs: 25,
    sources: overrides.sources ?? [
      buildSource({
        url: 'https://example.com/source-a',
        title: 'Reserve ratio 100',
        snippet: 'Exchange reserves remain at 100 USD.',
        credibility: 0.9,
      }),
      buildSource({
        url: 'https://example.com/source-b',
        title: 'Reserve ratio 103',
        snippet: 'Independent attestation shows 103 USD.',
        credibility: 0.85,
      }),
    ],
    ...overrides,
  };
}

describe('@uvrn/consensus', () => {
  it('buildBundle() returns a core-valid DeltaBundle for 2+ usable sources', () => {
    const engine = new ConsensusEngine({ sources: buildFarmResult() });

    const bundle = engine.buildBundle('claim: Exchange X holds full reserves');
    const validation = validateBundle(bundle);

    expect(validation.valid).toBe(true);
    expect(bundle.thresholdPct).toBe(0.1);
    expect(bundle.dataSpecs).toHaveLength(2);
    expect(bundle.dataSpecs[0]?.metrics[0]?.key).toBe('consensus_value');
  });

  it('weights not summing to 1.0 throws a descriptive error', () => {
    expect(
      () =>
        new ConsensusEngine({
          sources: buildFarmResult(),
          weights: { credibility: 0.5, recency: 0.4, coverage: 0.4 },
        })
    ).toThrow('Source weights must sum to 1.0');
  });

  it('sources are sorted by weighted score descending', () => {
    const engine = new ConsensusEngine({
      sources: buildFarmResult({
        sources: [
          buildSource({
            url: 'https://example.com/old',
            title: 'Reserve ratio 110',
            publishedAt: '2026-03-01T00:00:00.000Z',
            credibility: 0.95,
          }),
          buildSource({
            url: 'https://example.com/new',
            title: 'Reserve ratio 108',
            publishedAt: '2026-04-01T12:00:00.000Z',
            credibility: 0.8,
          }),
        ],
      }),
    });

    const bundle = engine.buildBundle();

    expect(bundle.dataSpecs[0]?.originDocIds[0]).toBe('https://example.com/new');
    expect(bundle.dataSpecs[1]?.originDocIds[0]).toBe('https://example.com/old');
  });

  it('deduplication removes near-identical sources and keeps the highest-ranked one', () => {
    const engine = new ConsensusEngine({
      sources: buildFarmResult({
        sources: [
          buildSource({
            url: 'https://example.com/high',
            title: 'Reserve ratio 100',
            snippet: 'Reported reserve ratio 100 USD.',
            credibility: 0.95,
            publishedAt: '2026-04-01T00:00:00.000Z',
          }),
          buildSource({
            url: 'https://example.com/low',
            title: 'Reserve ratio 100.5',
            snippet: 'Reported reserve ratio 100.5 USD.',
            credibility: 0.55,
            publishedAt: '2026-04-01T01:00:00.000Z',
          }),
          buildSource({
            url: 'https://example.com/third',
            title: 'Reserve ratio 108',
            snippet: 'Independent reserve ratio 108 USD.',
            credibility: 0.8,
            publishedAt: '2026-04-01T03:00:00.000Z',
          }),
        ],
      }),
    });

    const bundle = engine.buildBundle();

    expect(bundle.dataSpecs).toHaveLength(2);
    expect(bundle.dataSpecs.map((spec) => spec.originDocIds[0])).toContain(
      'https://example.com/high'
    );
    expect(bundle.dataSpecs.map((spec) => spec.originDocIds[0])).not.toContain(
      'https://example.com/low'
    );
  });

  it('stats() returns deterministic scores and an LLM-friendly summary', () => {
    const engine = new ConsensusEngine({ sources: buildFarmResult() });

    const stats = engine.stats();

    expect(stats.sourceCount).toBe(2);
    expect(stats.agreementScore).toBe(50);
    expect(stats.coverageScore).toBe(100);
    expect(stats.recencyScore).toBeCloseTo(96.666, 2);
    expect(stats.weightedConsensusScore).toBeCloseTo(94, 0);
    expect(stats.summary).toContain('Consensus derived from 2 usable sources');
  });

  it('buildBundle() throws ConsensusError when fewer than 2 usable numeric sources remain', () => {
    const engine = new ConsensusEngine({
      sources: buildFarmResult({
        sources: [buildSource({ title: 'Reserve update', snippet: 'No numeric evidence present.' })],
      }),
    });

    expect(() => engine.buildBundle()).toThrow(ConsensusError);
    expect(() => engine.buildBundle()).toThrow('at least 2 usable numeric sources');
  });
});
