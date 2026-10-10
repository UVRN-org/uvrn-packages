import {
  BUILT_IN_TEMPLATES,
  ClaudeSearchConnector,
  runLattice,
} from '../src';
import type { DomainSpec } from '../src/types';

const BASE_CATEGORIES = ['evidence_strength', 'domain_fit', 'implementation_readiness'];

function makeDomainSpec(overrides: Partial<DomainSpec> = {}): DomainSpec {
  return {
    id: 'economic',
    label: 'Economic',
    signalCategories: BASE_CATEGORIES,
    normalizationProfile: 'domain-average',
    explanation: 'Economic domain spec for tests.',
    ...overrides,
  };
}

describe('ClaudeSearchConnector', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns zero-valued signals when the delegate returns no results', async () => {
    const connector = new ClaudeSearchConnector({
      delegate: async () => [],
    });
    const domainSpec = makeDomainSpec();

    const signals = await connector.fetch('test query', domainSpec);

    expect(signals).toHaveLength(3);
    expect(signals.every((signal) => signal.value === 0)).toBe(true);
    expect(signals.every((signal) => signal.domainId === 'economic')).toBe(true);
    expect(signals.every((signal) => signal.source === 'delegate://')).toBe(true);
    expect(signals.every((signal) => signal.explanation === 'No results returned by delegate.')).toBe(true);
  });

  it('derives implementation_readiness from results published within the last 90 days', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-25T12:00:00.000Z'));

    const connector = new ClaudeSearchConnector({
      delegate: async () => [
        {
          title: 'Recent',
          url: 'https://example.com/recent',
          snippet: 'recent',
          publishedAt: '2026-05-20',
        },
        {
          title: 'Stale',
          url: 'https://example.com/stale',
          snippet: 'stale',
          publishedAt: '2025-01-01',
        },
        {
          title: 'Undated',
          url: 'https://example.com/undated',
          snippet: 'undated',
        },
      ],
    });

    const signals = await connector.fetch('test query', makeDomainSpec());
    const readiness = signals.find((signal) => signal.key === 'implementation_readiness');

    expect(readiness?.value).toBeCloseTo(33.3333, 3);
    expect(readiness?.explanation).toContain('implementation_readiness');
  });

  it('defaults implementation_readiness to 50 when no publishedAt values are available', async () => {
    const connector = new ClaudeSearchConnector({
      delegate: async () => [
        {
          title: 'Undated one',
          url: 'https://example.com/one',
          snippet: 'one',
        },
        {
          title: 'Undated two',
          url: 'https://example.com/two',
          snippet: 'two',
        },
      ],
    });

    const signals = await connector.fetch('test query', makeDomainSpec());
    const readiness = signals.find((signal) => signal.key === 'implementation_readiness');

    expect(readiness?.value).toBe(50);
  });

  it('derives domain_fit from SearchResult.domain and URL hostname fallback', async () => {
    const connector = new ClaudeSearchConnector({
      delegate: async () => [
        {
          title: 'Explicit domain',
          url: 'https://ignored.example/path',
          snippet: 'explicit',
          domain: 'reddit.com',
        },
        {
          title: 'URL fallback',
          url: 'https://www.techcrunch.com/article',
          snippet: 'fallback',
        },
        {
          title: 'Duplicate domain',
          url: 'https://reddit.com/thread',
          snippet: 'duplicate',
          domain: 'reddit.com',
        },
      ],
    });

    const signals = await connector.fetch('test query', makeDomainSpec());
    const domainFit = signals.find((signal) => signal.key === 'domain_fit');
    const evidenceStrength = signals.find((signal) => signal.key === 'evidence_strength');

    expect(domainFit?.value).toBe(24);
    expect(evidenceStrength?.value).toBe(30);
    expect(signals[0]?.source).toBe('https://ignored.example/path');
  });

  it('defaults unknown signal categories to 50', async () => {
    const connector = new ClaudeSearchConnector({
      delegate: async () => [
        {
          title: 'One result',
          url: 'https://example.com/one',
          snippet: 'one',
        },
      ],
    });

    const signals = await connector.fetch(
      'test query',
      makeDomainSpec({ signalCategories: ['custom_metric'] })
    );

    expect(signals).toHaveLength(1);
    expect(signals[0]?.value).toBe(50);
    expect(signals[0]?.explanation).toContain('unknown signal category');
  });

  it('runs builder-radar through runLattice as a drop-in connector replacement', async () => {
    const template = BUILT_IN_TEMPLATES.find((candidate) => candidate.id === 'builder-radar');
    expect(template).toBeDefined();

    const connector = new ClaudeSearchConnector({
      delegate: async (query, domainSpec) => [
        {
          title: `${domainSpec.label} result for ${query}`,
          url: `https://${domainSpec.id}.example/search`,
          snippet: `Scoped to ${domainSpec.id}`,
          publishedAt: '2026-05-20',
          domain: `${domainSpec.id}.example`,
        },
        {
          title: `${domainSpec.label} secondary`,
          url: `https://news.example/${domainSpec.id}`,
          snippet: 'secondary',
          publishedAt: '2026-05-18',
        },
      ],
    });

    const receipt = await runLattice('Is this SaaS idea worth building this week?', template!, {
      connector,
      timestamp: '2026-05-25T12:00:00.000Z',
    });

    expect(receipt.templateRef).toBe('builder-radar');
    expect(receipt.decompositionSpec.domains).toHaveLength(4);
    expect(receipt.vScore).toBe(receipt.deltaReceipt.deltaFinal);
    expect(receipt.interpretation).toContain('Core deltaFinal');
  });
});
