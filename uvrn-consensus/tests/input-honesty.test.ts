import {
  DEFAULT_SOURCE_WEIGHTS,
  extractProminenceValue,
  extractRankedSourcesWithHonesty,
} from '../src';
import type { FarmResult, FarmSource } from '../src';

function source(overrides: Partial<FarmSource> = {}): FarmSource {
  return {
    url: 'https://example.com/s',
    title: 'Untitled',
    snippet: '',
    credibility: 0.8,
    ...overrides,
  };
}

function farm(sources: FarmSource[], fetchedAt = '2026-04-02T00:00:00.000Z'): FarmResult {
  return {
    claimId: 'honesty',
    fetchedAt,
    durationMs: 1,
    sources,
  };
}

describe('BP-15 input honesty', () => {
  it('returns declared evidenceScore unchanged', () => {
    const result = extractProminenceValue(
      source({ evidenceScore: 42, title: '2025 Market Report: computed value is 99' })
    );
    expect(result).toEqual({ value: 42, valueSource: 'declared' });
  });

  it('defaults text scrape OFF — absent evidenceScore is unusable, not a headline number', () => {
    const result = extractProminenceValue(
      source({ title: '2025 Market Report: computed value is 42' })
    );
    expect(result).toEqual({ value: null, valueSource: 'none' });
  });

  it('opt-in scrape skips bare years and list-count patterns, then takes the next number', () => {
    const yearThenValue = extractProminenceValue(
      source({ title: '2025 Market Report: computed value is 42' }),
      true
    );
    expect(yearThenValue).toEqual({ value: 42, valueSource: 'scraped' });

    const topList = extractProminenceValue(
      source({ title: 'Top 10 trend report value 42' }),
      true
    );
    expect(topList).toEqual({ value: 42, valueSource: 'scraped' });

    const things = extractProminenceValue(
      source({ title: '5 things about markets', snippet: 'answer 42' }),
      true
    );
    expect(things).toEqual({ value: 42, valueSource: 'scraped' });
  });

  it('reports unusable sources via count; does not invent values', () => {
    const result = extractRankedSourcesWithHonesty(
      farm([
        source({
          url: 'https://example.com/a',
          title: 'Study 2025 finds computed value',
          publishedAt: '2026-05-01T12:00:00.000Z',
        }),
        source({
          url: 'https://example.com/b',
          title: 'Report 2025 on computed value',
          publishedAt: '2026-05-03T12:00:00.000Z',
        }),
        source({
          url: 'https://example.com/c',
          title: 'Background',
          publishedAt: '2026-05-05T12:00:00.000Z',
          evidenceScore: 42,
        }),
      ]),
      DEFAULT_SOURCE_WEIGHTS
    );

    expect(result.unusableSourceCount).toBe(2);
    expect(result.ranked).toHaveLength(1);
    expect(result.ranked[0]?.metricValue).toBe(42);
    expect(result.ranked[0]?.valueSource).toBe('declared');
    expect(result.ranked[0]?.unusableSourceCount).toBe(2);
  });

  it('tags timestampSource from measuredAt; publish time alone earns no freshness', () => {
    const result = extractRankedSourcesWithHonesty(
      farm(
        [
          source({
            url: 'https://example.com/dated',
            evidenceScore: 50,
            publishedAt: '2026-04-01T00:00:00.000Z',
            // BP-20: freshness uses declared measuredAt (SPEC §5), not publishedAt.
            measuredAt: '2026-04-01T00:00:00.000Z',
          }),
          source({
            url: 'https://example.com/undated',
            evidenceScore: 50,
            // no publishedAt, no measuredAt
          }),
        ],
        '2026-04-02T00:00:00.000Z'
      ),
      DEFAULT_SOURCE_WEIGHTS,
      { mode: 'off' }
    );

    // Farm-wide publish-time inference stamp (BP-15) — undated lacks publishedAt.
    expect(result.inferredTimestampCount).toBe(1);
    const dated = result.ranked.find((r) => r.originalSource.url.endsWith('/dated'));
    const undated = result.ranked.find((r) => r.originalSource.url.endsWith('/undated'));
    expect(dated?.timestampSource).toBe('declared');
    expect(dated?.recencyScore).toBeGreaterThan(0);
    expect(undated?.timestampSource).toBe('inferred');
    expect(undated?.recencyScore).toBe(0);
    expect(undated?.inferredTimestampCount).toBe(1);
  });

  it('prominenceUsableCount gate matches main-loop usable set (coverage)', () => {
    const sources = [
      source({
        url: 'https://example.com/a',
        title: '2025 year trap',
        publishedAt: '2026-05-01T12:00:00.000Z',
      }),
      source({
        url: 'https://example.com/b',
        evidenceScore: 42,
        publishedAt: '2026-05-02T12:00:00.000Z',
      }),
      source({
        url: 'https://example.com/c',
        evidenceScore: 42,
        publishedAt: '2026-05-03T12:00:00.000Z',
      }),
    ];
    const result = extractRankedSourcesWithHonesty(farm(sources), DEFAULT_SOURCE_WEIGHTS, {
      mode: 'off',
    });

    // 1 unusable of 3 → coverage 66.666…
    expect(result.unusableSourceCount).toBe(1);
    expect(result.ranked).toHaveLength(2);
    expect(result.ranked[0]?.coverageScore).toBeCloseTo((2 / 3) * 100, 5);
    expect(result.ranked.every((r) => r.coverageScore === result.ranked[0]?.coverageScore)).toBe(
      true
    );
  });

  it('allowTextScrape=true tags scraped values', () => {
    const result = extractRankedSourcesWithHonesty(
      farm([
        source({
          url: 'https://example.com/a',
          title: 'computed value is 42',
          publishedAt: '2026-05-01T12:00:00.000Z',
        }),
        source({
          url: 'https://example.com/b',
          title: 'computed value is 42',
          publishedAt: '2026-05-02T12:00:00.000Z',
        }),
      ]),
      DEFAULT_SOURCE_WEIGHTS,
      { mode: 'off' },
      'prominence',
      true
    );

    expect(result.unusableSourceCount).toBe(0);
    expect(result.ranked.map((r) => r.valueSource)).toEqual(['scraped', 'scraped']);
    expect(result.ranked.map((r) => r.metricValue)).toEqual([42, 42]);
  });
});
