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

  it('prefers source.evidenceScore over numeric titles so equal scores fully agree', () => {
    // Regression for the title-number trap: each source has a different number in its
    // title ("Top 10/20/30") but an identical evidenceScore (50). With the fix, the
    // extractor reads the field, so all three values match and agreement is total.
    // Dates are spaced >1 day apart so the dedupe window (≤1% AND ≤1 day) doesn't merge them.
    const engine = new ConsensusEngine({
      sources: buildFarmResult({
        sources: [
          buildSource({
            url: 'https://example.com/a',
            title: 'Top 10 trend report',
            snippet: 'Strong demand observed.',
            evidenceScore: 50,
            publishedAt: '2026-04-01T00:00:00.000Z',
          }),
          buildSource({
            url: 'https://example.com/b',
            title: 'Top 20 movers this week',
            snippet: 'Momentum continues.',
            evidenceScore: 50,
            publishedAt: '2026-04-03T00:00:00.000Z',
          }),
          buildSource({
            url: 'https://example.com/c',
            title: 'Top 30 ranked signals',
            snippet: 'Sustained interest.',
            evidenceScore: 50,
            publishedAt: '2026-04-05T00:00:00.000Z',
          }),
        ],
      }),
    });

    const stats = engine.stats();

    expect(stats.sourceCount).toBe(3);
    expect(stats.agreementScore).toBe(100);
  });

  describe('DedupConfig', () => {
    // Two near-identical sources: values 0.5% apart, published one hour apart — inside the
    // default ±1% / 1-day dedup window, so v3 behavior collapses them to one.
    function buildNearIdenticalPair(): FarmResult {
      return buildFarmResult({
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
        ],
      });
    }

    it('explicit default config produces identical output to no config', () => {
      const implicit = new ConsensusEngine({ sources: buildNearIdenticalPair() });
      const explicit = new ConsensusEngine({
        sources: buildNearIdenticalPair(),
        dedup: { relativeTolerance: 0.01, timeWindowMs: 86_400_000, mode: 'relative' },
      });

      // Both dedupe the ±1%-within-a-day pair down to a single source, exactly as today.
      expect(implicit.stats().sourceCount).toBe(1);
      expect(explicit.stats()).toEqual(implicit.stats());
    });

    it("mode 'off' disables deduplication and keeps both sources", () => {
      const engine = new ConsensusEngine({
        sources: buildNearIdenticalPair(),
        dedup: { mode: 'off' },
      });

      expect(engine.stats().sourceCount).toBe(2);
      expect(engine.buildBundle().dataSpecs).toHaveLength(2);
    });

    it('wider relativeTolerance dedupes sources 5% apart that the default keeps', () => {
      const sources = () =>
        buildFarmResult({
          sources: [
            buildSource({
              url: 'https://example.com/base',
              title: 'Reserve ratio 100',
              snippet: 'Reported reserve ratio 100 USD.',
              credibility: 0.95,
              publishedAt: '2026-04-01T00:00:00.000Z',
            }),
            buildSource({
              url: 'https://example.com/nearby',
              title: 'Reserve ratio 105',
              snippet: 'Reported reserve ratio 105 USD.',
              credibility: 0.55,
              publishedAt: '2026-04-01T01:00:00.000Z',
            }),
          ],
        });

      const defaultEngine = new ConsensusEngine({ sources: sources() });
      const widened = new ConsensusEngine({
        sources: sources(),
        dedup: { relativeTolerance: 0.05 },
      });

      expect(defaultEngine.stats().sourceCount).toBe(2);
      expect(widened.stats().sourceCount).toBe(1);
    });

    it("mode 'absolute' reads the tolerance as an absolute delta", () => {
      const sources = () =>
        buildFarmResult({
          sources: [
            buildSource({
              url: 'https://example.com/a',
              title: 'Reserve ratio 103',
              snippet: 'Reported reserve ratio 103 USD.',
              credibility: 0.95,
              publishedAt: '2026-04-01T00:00:00.000Z',
            }),
            buildSource({
              url: 'https://example.com/b',
              title: 'Reserve ratio 100',
              snippet: 'Reported reserve ratio 100 USD.',
              credibility: 0.55,
              publishedAt: '2026-04-01T01:00:00.000Z',
            }),
          ],
        });

      // 103 vs 100 is ~2.9% apart — outside the default ±1% relative window…
      const defaultEngine = new ConsensusEngine({ sources: sources() });
      expect(defaultEngine.stats().sourceCount).toBe(2);

      // …but within an absolute delta of 5, so absolute mode collapses them.
      const absolute = new ConsensusEngine({
        sources: sources(),
        dedup: { mode: 'absolute', relativeTolerance: 5 },
      });
      expect(absolute.stats().sourceCount).toBe(1);
    });
  });

  it('buildConsensusResult() returns bundle and mapped V-Score components', () => {
    const engine = new ConsensusEngine({ sources: buildFarmResult() });

    const result = engine.buildConsensusResult('claim: Exchange X holds full reserves');

    expect(result.bundle.claim).toBe('claim: Exchange X holds full reserves');
    expect(result.components.completeness).toBe(result.stats.coverageScore);
    expect(result.components.parity).toBe(result.stats.agreementScore);
    expect(result.components.freshness).toBe(result.stats.recencyScore);
    expect(result.components.completeness).toBe(100);
    expect(result.components.parity).toBe(50);
    expect(result.components.freshness).toBeCloseTo(96.666, 2);
  });
});
