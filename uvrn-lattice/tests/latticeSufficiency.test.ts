import { BUILT_IN_TEMPLATES, MockDomainConnector, runLattice } from '../src';
import type { DomainConnector, DomainSignal, DomainSpec, EvidenceItem, SearchResult } from '../src';

const TEMPLATE = BUILT_IN_TEMPLATES.find((candidate) => candidate.id === 'builder-radar')!;
const QUERY = 'Should regional robotics builders enter municipal maintenance markets?';
const TIMESTAMP = '2026-05-25T12:00:00.000Z';

// A connector that pins signal `ts` regardless of context, used as the golden-hash anchor.
// (Since v0.4.1 MockDomainConnector is also reproducible when options.timestamp is set; this
// fixed connector additionally ignores ConnectorContext, so the golden hex stays valid even if
// the run-timestamp plumbing changes.)
const fixedConnector: DomainConnector = {
  name: 'FixedConnector',
  async fetch(_query: string, domainSpec: DomainSpec): Promise<DomainSignal[]> {
    return domainSpec.signalCategories.map((key, index) => ({
      domainId: domainSpec.id,
      key,
      value: 50 + index * 5,
      unit: 'score',
      source: `fixed://${domainSpec.id}/${key}`,
      ts: '2026-01-01T00:00:00.000Z',
      explanation: 'fixed',
    }));
  },
};

describe('runLattice claim sufficiency hook', () => {
  // Rule 8 (additive / non-breaking): a claim-less receipt must hash exactly as it did before
  // the sufficiency field existed. This golden hex was confirmed byte-identical between the
  // v0.2.0 baseline and this branch using the deterministic connector above.
  it('keeps a claim-less receipt hash byte-identical to the pre-sufficiency baseline', async () => {
    const receipt = await runLattice('claimless query', TEMPLATE, {
      connector: fixedConnector,
      timestamp: TIMESTAMP,
    });
    expect(receipt.sufficiency).toBeUndefined();
    expect(receipt.hash).toBe('083e38f9e7699a9a64c9d1525db4c4c3a3ea01f77ff9603fa18af6732decffcc');
  });

  it('omits sufficiency when no claim is provided (non-breaking)', async () => {
    const receipt = await runLattice(QUERY, TEMPLATE, {
      connector: new MockDomainConnector(),
      timestamp: TIMESTAMP,
    });
    expect(receipt.sufficiency).toBeUndefined();
  });

  it('attaches a verdict when a claim is provided, but bridge-only mock signals stay Unverified', async () => {
    const receipt = await runLattice(QUERY, TEMPLATE, {
      connector: new MockDomainConnector(),
      claim: 'People are buying municipal robotics services',
      timestamp: TIMESTAMP,
    });

    // mock:// signal sources are not classifiable by the default taxonomy, so no evidence is
    // obtained and the verdict is present but Unverified.
    expect(receipt.sufficiency).toBeDefined();
    expect(receipt.sufficiency?.status).toBe('Unverified');
  });

  it('produces a Supported verdict when provenance evidence is supplied explicitly', async () => {
    const evidence: EvidenceItem[] = [
      { evidenceClass: 'purchase', source: 'Etsy sales', explanation: 'sales feed' },
      { evidenceClass: 'purchase', source: 'marketplace velocity', explanation: 'velocity feed' },
    ];

    const receipt = await runLattice(QUERY, TEMPLATE, {
      connector: new MockDomainConnector(),
      claim: 'People are buying municipal robotics services',
      evidence,
      timestamp: TIMESTAMP,
    });

    expect(receipt.sufficiency?.status).toBe('Supported');
    expect(receipt.sufficiency?.level).toBe('L3');
  });

  it('threads claimId from options through to receipt.sufficiency', async () => {
    const receipt = await runLattice(QUERY, TEMPLATE, {
      connector: new MockDomainConnector(),
      claim: 'People are buying municipal robotics services',
      claimId: 'ROBO-MUNI',
      timestamp: TIMESTAMP,
    });
    expect(receipt.sufficiency?.claimId).toBe('ROBO-MUNI');
  });

  it('composes searchDelegate, claim, and explicit evidence in a single run', async () => {
    const searchDelegate = async (): Promise<SearchResult[]> => [
      { title: 'r', url: 'https://example.com/a', snippet: 's', domain: 'example.com' },
    ];
    const evidence: EvidenceItem[] = [
      { evidenceClass: 'purchase', source: 'procurement records', explanation: 'tenders' },
    ];

    const receipt = await runLattice(QUERY, TEMPLATE, {
      searchDelegate,
      claim: 'People are buying municipal robotics services',
      evidence,
      timestamp: TIMESTAMP,
    });

    expect(receipt.receiptId).toMatch(/^lattice-receipt-/);
    expect(receipt.sufficiency?.status).toBe('Supported');
  });
});
