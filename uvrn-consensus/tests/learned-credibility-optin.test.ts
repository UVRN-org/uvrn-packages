import {
  DEFAULT_SOURCE_WEIGHTS,
  extractRankedSourcesWithHonesty,
  resolveCredibilityForWeighting,
} from '../src';
import type { FarmResult, FarmSource } from '../src';

function source(overrides: Partial<FarmSource> = {}): FarmSource {
  const publishedAt = overrides.publishedAt ?? '2026-06-01T00:00:00.000Z';
  return {
    url: 'https://example.com/s',
    title: 'Untitled',
    snippet: 'value is 100',
    credibility: 0.9,
    evidenceScore: 100,
    publishedAt,
    measuredAt: overrides.measuredAt ?? publishedAt,
    ...overrides,
  };
}

function farm(sources: FarmSource[]): FarmResult {
  return {
    claimId: 'clm_optin',
    fetchedAt: '2026-07-01T12:00:00.000Z',
    durationMs: 1,
    sources,
  };
}

describe('learned credibility opt-in (BP-23)', () => {
  const sources = [
    source({ url: 'https://a.example/1', originId: 'origin:a' }),
    source({ url: 'https://b.example/1', originId: 'origin:b' }),
  ];

  it('resolveCredibilityForWeighting keeps declared when opt-in off', () => {
    const r = resolveCredibilityForWeighting({
      declared: 0.9,
      learned: 0.2,
      useLearned: false,
    });
    expect(r.weightScore).toBe(90);
    expect(r.declaredScore).toBe(90);
    expect(r.learnedScore).toBeUndefined();
  });

  it('resolveCredibilityForWeighting uses learned when opt-in on', () => {
    const r = resolveCredibilityForWeighting({
      declared: 0.9,
      learned: 0.2,
      useLearned: true,
    });
    expect(r.weightScore).toBe(20);
    expect(r.declaredScore).toBe(90);
    expect(r.learnedScore).toBe(20);
  });

  it('defaults off — no learned stamps; declared drives credibilityScore', () => {
    const out = extractRankedSourcesWithHonesty(farm(sources), DEFAULT_SOURCE_WEIGHTS, {
      mode: 'off',
    });
    for (const s of out.ranked) {
      expect(s.declaredCredibilityScore).toBeUndefined();
      expect(s.learnedCredibilityScore).toBeUndefined();
      expect(s.credibilityScore).toBe(90);
    }
  });

  it('when opt-in on, stamps both declared and learned and weights with learned', () => {
    const out = extractRankedSourcesWithHonesty(
      farm(sources),
      DEFAULT_SOURCE_WEIGHTS,
      { mode: 'off' },
      'prominence',
      false,
      undefined,
      { useLearned: true, byOrigin: { 'origin:a': 0.2, 'origin:b': 0.2 } }
    );
    const a = out.ranked.find((s) => s.originId === 'origin:a');
    expect(a?.declaredCredibilityScore).toBe(90);
    expect(a?.learnedCredibilityScore).toBe(20);
    expect(a?.credibilityScore).toBe(20);
  });
});
