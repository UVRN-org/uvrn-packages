import type { FarmSource } from '@uvrn/agent';

import { NormalizationProfiles, normalize } from '../src';

function buildSource(overrides: Partial<FarmSource> = {}): FarmSource {
  return {
    url: 'https://example.com/source',
    title: 'BTC update',
    snippet: 'Bitcoin moved to $1.23456 during trading.',
    publishedAt: '2026-04-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('@uvrn/normalize', () => {
  it('normalize(sources, financial) converts ISO timestamps to unix ms correctly', () => {
    const source = buildSource();

    const result = normalize([source], 'financial');

    expect(result.sources[0]?.timestamp).toBe(Date.parse('2026-04-01T12:00:00.000Z'));
  });

  it('normalize(sources, financial) rounds numeric values to 2 decimal places', () => {
    const source = buildSource();

    const result = normalize([source], 'financial');

    expect(result.sources[0]?.value).toBe(1.23);
    expect(NormalizationProfiles.financial.normalizePrecision(1.23456, 'USD')).toBe(1.23);
  });

  it('normalize(sources, news) extracts text and normalizes dates', () => {
    const source = buildSource({
      title: 'Headline',
      snippet: 'News summary text',
      publishedAt: '2026-04-02T10:30:00.000Z',
    });

    const result = normalize([source], 'news');

    expect(result.sources[0]?.value).toBe('News summary text');
    expect(result.sources[0]?.timestamp).toBe(Date.parse('2026-04-02T10:30:00.000Z'));
  });

  it('normalize(sources, general) handles missing credibility with default 0.5', () => {
    const source = buildSource({ credibility: undefined });

    const result = normalize([source], 'general');

    expect(result.sources[0]?.credibility).toBe(0.5);
  });

  it('normalize(sources, research) defaults credibility to 0.8', () => {
    const source = buildSource({
      title: 'Research paper',
      snippet: 'Abstract summary',
      credibility: undefined,
    });

    const result = normalize([source], 'research');

    expect(result.sources[0]?.credibility).toBe(0.8);
  });

  it('custom transformer registered via registerTransformer takes priority over profile default transform', () => {
    const source = buildSource({
      url: 'https://www.coingecko.com/en/coins/bitcoin',
      title: 'CoinGecko BTC',
      snippet: 'CoinGecko market listing',
    });

    normalize.registerTransformer('CoinGeckoFarm', (farmSource) => ({
      name: 'CoinGeckoFarm',
      value: 'custom-value',
      unit: 'text',
      timestamp: 123,
      credibility: 0.85,
      rawData: farmSource,
      normalizer: 'CoinGeckoFarm-custom',
    }));

    const result = normalize([source], 'financial');

    expect(result.sources[0]?.value).toBe('custom-value');
    expect(result.sources[0]?.normalizer).toBe('CoinGeckoFarm-custom');
    expect(normalize.getTransformer('CoinGeckoFarm')).toBeDefined();
  });

  it('all output NormalizedSource objects contain all required fields', () => {
    const source = buildSource({ credibility: 75 });

    const result = normalize([source], 'general');
    const normalized = result.sources[0];

    expect(normalized).toEqual({
      name: expect.any(String),
      value: expect.anything(),
      unit: expect.any(String),
      timestamp: expect.any(Number),
      credibility: 0.75,
      rawData: expect.anything(),
      normalizer: expect.any(String),
    });
  });
});
