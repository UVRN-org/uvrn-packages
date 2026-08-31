import { checkMetricsComparability } from '@uvrn/core';

import {
  DEFAULT_SOURCE_WEIGHTS,
  extractRankedSourcesWithHonesty,
  resolveOriginId,
} from '../src';
import type { FarmResult, FarmSource } from '../src';

function source(overrides: Partial<FarmSource> = {}): FarmSource {
  return {
    url: 'https://example.com/s',
    title: 'Untitled',
    snippet: '',
    credibility: 0.8,
    evidenceScore: 50,
    publishedAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

function farm(sources: FarmSource[], fetchedAt = '2026-06-01T00:00:00.000Z'): FarmResult {
  return { claimId: 'prov', fetchedAt, durationMs: 1, sources };
}

describe('BP-20 provenance / origin / units', () => {
  it('four sources one declared origin → one origin vote; restatements retained', () => {
    const primary = 'https://bls.example/print-1';
    const sources = [
      source({ url: primary, evidenceScore: 10, originId: primary }),
      source({
        url: 'https://news.example/a',
        evidenceScore: 10,
        prov: { wasQuotedFrom: primary },
      }),
      source({
        url: 'https://news.example/b',
        evidenceScore: 10,
        prov: { hadPrimarySource: primary },
      }),
      source({
        url: 'https://news.example/c',
        evidenceScore: 10,
        prov: { wasDerivedFrom: primary },
      }),
    ];
    const result = extractRankedSourcesWithHonesty(
      farm(sources),
      DEFAULT_SOURCE_WEIGHTS,
      { mode: 'off' }
    );
    expect(result.distinctOriginCount).toBe(1);
    expect(result.observationSourceCount).toBe(4);
    expect(result.transcriptionCorroboration).toBe(3);
    expect(result.originAgreementScore).toBe(100);
  });

  it('identical undeclared values are not merged as one origin', () => {
    const sources = [
      source({ url: 'https://a.example/1', evidenceScore: 42 }),
      source({ url: 'https://b.example/2', evidenceScore: 42 }),
      source({ url: 'https://c.example/3', evidenceScore: 42 }),
      source({ url: 'https://d.example/4', evidenceScore: 42 }),
    ];
    const result = extractRankedSourcesWithHonesty(
      farm(sources),
      DEFAULT_SOURCE_WEIGHTS,
      { mode: 'off' }
    );
    expect(result.distinctOriginCount).toBe(4);
    expect(result.originAgreementScore).toBe(100);
    expect(new Set(result.ranked.map((r) => r.originId)).size).toBe(4);
  });

  it('near-identical undeclared pair still two origins for agreement after dedup path', () => {
    const sources = [
      source({
        url: 'https://a.example/1',
        evidenceScore: 100,
        publishedAt: '2026-04-01T00:00:00.000Z',
      }),
      source({
        url: 'https://b.example/2',
        evidenceScore: 100.5, // within 1% relative
        publishedAt: '2026-04-01T12:00:00.000Z',
      }),
      source({
        url: 'https://c.example/3',
        evidenceScore: 50,
        publishedAt: '2026-04-01T00:00:00.000Z',
      }),
    ];
    const result = extractRankedSourcesWithHonesty(farm(sources), DEFAULT_SOURCE_WEIGHTS);
    // Dedup may collapse the near-identical pair in ranked, but origin agreement uses pre-dedup.
    expect(result.distinctOriginCount).toBe(3);
    expect(result.originAgreementScore).toBeCloseTo((1 / 3) * 100, 5);
  });

  it('forecast F excluded from observation pool; exclusion counted', () => {
    const evalMs = Date.parse('2026-06-01T00:00:00.000Z');
    const sources = [
      source({
        url: 'https://a.example/obs',
        evidenceScore: 10,
        obsStatus: 'A',
        measuredAt: '2026-05-01T00:00:00.000Z',
      }),
      source({
        url: 'https://b.example/fc',
        evidenceScore: 10,
        obsStatus: 'F',
        appliesTo: '2026-12-01T00:00:00.000Z', // future
      }),
    ];
    const result = extractRankedSourcesWithHonesty(
      farm(sources),
      DEFAULT_SOURCE_WEIGHTS,
      { mode: 'off' },
      'prominence',
      false,
      evalMs
    );
    expect(result.excludedForecastCount).toBe(1);
    expect(result.observationSourceCount).toBe(1);
  });

  it('backfilled F over elapsed appliesTo is recorded as I and kept in pool', () => {
    const evalMs = Date.parse('2026-06-01T00:00:00.000Z');
    const sources = [
      source({
        url: 'https://a.example/obs',
        evidenceScore: 10,
        obsStatus: 'A',
      }),
      source({
        url: 'https://b.example/backfill',
        evidenceScore: 10,
        obsStatus: 'F',
        appliesTo: '2026-01-01T00:00:00.000Z', // past
      }),
    ];
    const result = extractRankedSourcesWithHonesty(
      farm(sources),
      DEFAULT_SOURCE_WEIGHTS,
      { mode: 'off' },
      'prominence',
      false,
      evalMs
    );
    expect(result.excludedForecastCount).toBe(0);
    expect(result.observationSourceCount).toBe(2);
    const backfill = result.ranked.find((r) => r.originalSource.url.includes('backfill'));
    expect(backfill?.obsStatus).toBe('I');
  });

  it('host unit is declared; inferred guess never satisfies comparability', () => {
    const withHost = extractRankedSourcesWithHonesty(
      farm([
        source({
          url: 'https://a.example/1',
          evidenceScore: 10,
          unit: '%',
          title: '10 percent growth',
        }),
        source({
          url: 'https://b.example/2',
          evidenceScore: 12,
          unit: '%',
          title: '12 percent growth',
        }),
      ]),
      DEFAULT_SOURCE_WEIGHTS,
      { mode: 'off' }
    );
    expect(withHost.ranked.every((r) => r.unitSource === 'declared')).toBe(true);

    const guessed = extractRankedSourcesWithHonesty(
      farm([
        source({
          url: 'https://a.example/1',
          evidenceScore: 10,
          title: '10% growth', // inferUnit → %
        }),
        source({
          url: 'https://b.example/2',
          evidenceScore: 12,
          title: '12% growth',
        }),
      ]),
      DEFAULT_SOURCE_WEIGHTS,
      { mode: 'off' }
    );
    expect(guessed.ranked.every((r) => r.unitSource === 'inferred')).toBe(true);
    expect(guessed.ranked.every((r) => r.unit === '%')).toBe(true);

    const refusal = checkMetricsComparability(
      guessed.ranked.map((r) => r.dataSpec.metrics[0]!)
    );
    expect(refusal?.reason).toBe('inferred-unit-ineligible');
  });

  it('missing host unit with quantityKind → missing-unit (no synthesis)', () => {
    const refusal = checkMetricsComparability([
      { key: 'consensus_value', value: 1, quantityKind: 'money' },
      { key: 'consensus_value', value: 2, quantityKind: 'money' },
    ]);
    expect(refusal?.reason).toBe('missing-unit');
  });

  it('resolveOriginId never uses value equality', () => {
    const a = source({ url: 'https://a.example', evidenceScore: 99 });
    const b = source({ url: 'https://b.example', evidenceScore: 99 });
    expect(resolveOriginId(a)).toBe('https://a.example');
    expect(resolveOriginId(b)).toBe('https://b.example');
    expect(resolveOriginId(a)).not.toBe(resolveOriginId(b));
  });

  it('publishedAt is not written to MetricPoint.ts', () => {
    const result = extractRankedSourcesWithHonesty(
      farm([
        source({
          url: 'https://a.example',
          evidenceScore: 10,
          publishedAt: '2026-04-01T00:00:00.000Z',
          // no measuredAt
        }),
      ]),
      DEFAULT_SOURCE_WEIGHTS,
      { mode: 'off' }
    );
    const metric = result.ranked[0]?.dataSpec.metrics[0];
    expect(metric?.ts).toBeUndefined();
    expect(metric?.measuredAt).toBeUndefined();
  });
});
