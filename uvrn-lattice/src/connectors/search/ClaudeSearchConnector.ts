import type { ConnectorContext, DomainConnector, DomainSignal, DomainSpec } from '../../types';

export type SearchDelegate = (
  query: string,
  domainSpec: DomainSpec,
) => Promise<SearchResult[]>;

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  domain?: string;
}

export interface ClaudeSearchConnectorOptions {
  delegate: SearchDelegate;
  label?: string;
}

const KNOWN_METRICS = new Set([
  'evidence_strength',
  'domain_fit',
  'implementation_readiness',
]);

const RECENCY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export class ClaudeSearchConnector implements DomainConnector {
  readonly name: string;
  private readonly delegate: SearchDelegate;

  constructor(options: ClaudeSearchConnectorOptions) {
    this.delegate = options.delegate;
    this.name = options.label ?? 'ClaudeSearchConnector';
  }

  async fetch(query: string, domainSpec: DomainSpec, context?: ConnectorContext): Promise<DomainSignal[]> {
    const results = await this.delegate(query, domainSpec);
    const now = context?.timestamp ?? new Date().toISOString();

    if (results.length === 0) {
      return domainSpec.signalCategories.map((key) => ({
        domainId: domainSpec.id,
        key,
        value: 0,
        unit: 'score',
        source: 'delegate://',
        ts: now,
        explanation: 'No results returned by delegate.',
      }));
    }

    // Anchor recency to the run timestamp (not wall-clock) so the same inputs hash identically.
    const parsedNow = Date.parse(now);
    const nowMs = Number.isFinite(parsedNow) ? parsedNow : Date.now();
    const metrics = computeMetrics(results, nowMs);
    const uniqueDomainCount = countUniqueDomains(results);
    const source = results[0]?.url ?? 'delegate://';

    return domainSpec.signalCategories.map((key) => {
      const isKnownMetric = KNOWN_METRICS.has(key);
      const value = isKnownMetric ? metrics[key]! : 50;

      return {
        domainId: domainSpec.id,
        key,
        value: clampMetric(value),
        unit: 'score',
        source,
        ts: now,
        explanation: buildExplanation(key, results.length, uniqueDomainCount, value, isKnownMetric),
      };
    });
  }
}

function computeMetrics(results: SearchResult[], nowMs: number): Record<string, number> {
  const uniqueDomainCount = countUniqueDomains(results);

  return {
    evidence_strength: Math.min(100, results.length * 10),
    domain_fit: Math.min(100, uniqueDomainCount * 12),
    implementation_readiness: computeImplementationReadiness(results, nowMs),
  };
}

function computeImplementationReadiness(results: SearchResult[], nowMs: number): number {
  const datedResults = results.filter((result) => result.publishedAt);

  if (datedResults.length === 0) {
    return 50;
  }

  const recentCount = datedResults.filter((result) => {
    const publishedAt = Date.parse(result.publishedAt!);
    return Number.isFinite(publishedAt) && nowMs - publishedAt <= RECENCY_WINDOW_MS;
  }).length;

  return clampMetric((recentCount / results.length) * 100);
}

function countUniqueDomains(results: SearchResult[]): number {
  const domains = new Set<string>();

  for (const result of results) {
    const rootDomain = resolveRootDomain(result);
    if (rootDomain) {
      domains.add(rootDomain);
    }
  }

  return domains.size;
}

function resolveRootDomain(result: SearchResult): string | null {
  if (result.domain) {
    return stripWww(result.domain);
  }

  try {
    const hostname = new URL(result.url).hostname;
    return stripWww(hostname);
  } catch {
    return null;
  }
}

function stripWww(hostname: string): string {
  return hostname.replace(/^www\./i, '');
}

function buildExplanation(
  key: string,
  resultCount: number,
  uniqueDomainCount: number,
  value: number,
  isKnownMetric: boolean
): string {
  if (!isKnownMetric) {
    return `${key} is an unknown signal category; defaulted to ${value}.`;
  }

  if (key === 'evidence_strength') {
    return `evidence_strength derived from ${resultCount} search result${resultCount === 1 ? '' : 's'} across ${uniqueDomainCount} domain${uniqueDomainCount === 1 ? '' : 's'}`;
  }

  if (key === 'domain_fit') {
    return `domain_fit derived from ${uniqueDomainCount} unique root domain${uniqueDomainCount === 1 ? '' : 's'} in ${resultCount} search result${resultCount === 1 ? '' : 's'}`;
  }

  return `implementation_readiness derived from recency of ${Math.round(value)}% of results within the last 90 days`;
}

function clampMetric(value: number): number {
  return Math.max(0, Math.min(100, value));
}
