import {
  BUILT_IN_TEMPLATES,
  MockDomainConnector,
  runLattice,
} from '../src';
import type { DomainSpec, SearchDelegate, SearchResult } from '../src';

const TEMPLATE = BUILT_IN_TEMPLATES.find((candidate) => candidate.id === 'builder-radar')!;
const QUERY = 'Should regional robotics builders enter municipal maintenance markets?';
const TIMESTAMP = '2026-05-25T12:00:00.000Z';

function makeResults(count = 3): SearchResult[] {
  return Array.from({ length: count }, (_, index) => ({
    title: `Result ${index}`,
    url: `https://example${index}.com/article`,
    snippet: 'snippet',
    domain: `example${index}.com`,
  }));
}

describe('runLattice searchDelegate auto-connector', () => {
  it('invokes the delegate for every domain and returns a valid receipt', async () => {
    let calls = 0;
    const delegate: SearchDelegate = async () => {
      calls += 1;
      return makeResults();
    };

    const receipt = await runLattice(QUERY, TEMPLATE, {
      searchDelegate: delegate,
      timestamp: TIMESTAMP,
    });

    expect(calls).toBe(TEMPLATE.domains.length);
    expect(receipt.receiptId).toMatch(/^lattice-receipt-/);
    expect(Object.keys(receipt.domainsMap).sort()).toEqual(
      ['cultural', 'economic', 'legal', 'technical']
    );
    expect(receipt.hash).toHaveLength(64);
  });

  it('prefers an explicit connector over searchDelegate (delegate never called)', async () => {
    let calls = 0;
    const delegate: SearchDelegate = async () => {
      calls += 1;
      return makeResults();
    };

    const receipt = await runLattice(QUERY, TEMPLATE, {
      connector: new MockDomainConnector(),
      searchDelegate: delegate,
      timestamp: TIMESTAMP,
    });

    expect(calls).toBe(0);
    expect(receipt.receiptId).toMatch(/^lattice-receipt-/);
  });

  it('prefers a per-domain connector over searchDelegate', async () => {
    let calls = 0;
    const delegate: SearchDelegate = async () => {
      calls += 1;
      return makeResults();
    };

    const connectors = Object.fromEntries(
      TEMPLATE.domains.map((domainId) => [domainId, new MockDomainConnector()])
    );

    const receipt = await runLattice(QUERY, TEMPLATE, {
      connectors,
      searchDelegate: delegate,
      timestamp: TIMESTAMP,
    });

    expect(calls).toBe(0);
    expect(receipt.receiptId).toMatch(/^lattice-receipt-/);
  });

  it('falls back to MockDomainConnector when no connector options are given', async () => {
    const receipt = await runLattice(QUERY, TEMPLATE, { timestamp: TIMESTAMP });

    expect(receipt.receiptId).toMatch(/^lattice-receipt-/);
    expect(Object.values(receipt.domainsMap).every((domain) => domain.status === 'ok')).toBe(true);
  });

  it('produces a reproducible hash for a dated search run when a timestamp is supplied', async () => {
    // Results carry publishedAt, exercising implementation_readiness recency scoring. Because
    // recency is anchored to options.timestamp (not wall-clock), two runs hash identically.
    const datedDelegate: SearchDelegate = async () => [
      { title: 'a', url: 'https://a.com/x', snippet: 's', publishedAt: '2026-05-01', domain: 'a.com' },
      { title: 'b', url: 'https://b.com/y', snippet: 's', publishedAt: '2024-01-01', domain: 'b.com' },
    ];

    const run = () =>
      runLattice(QUERY, TEMPLATE, { searchDelegate: datedDelegate, timestamp: TIMESTAMP });
    const [first, second] = await Promise.all([run(), run()]);

    expect(first.hash).toBe(second.hash);
  });

  it('marks a domain as error when the delegate throws, without failing the run', async () => {
    const delegate: SearchDelegate = async (_query: string, domainSpec: DomainSpec) => {
      if (domainSpec.id === 'legal') {
        throw new Error('delegate boom');
      }
      return makeResults();
    };

    const receipt = await runLattice(QUERY, TEMPLATE, {
      searchDelegate: delegate,
      timestamp: TIMESTAMP,
    });

    expect(receipt.domainsMap.legal?.status).toBe('error');
    expect(receipt.domainsMap.legal?.explanation).toContain('connector failed');
    expect(receipt.receiptId).toMatch(/^lattice-receipt-/);
  });
});
