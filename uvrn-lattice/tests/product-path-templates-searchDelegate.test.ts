/**
 * Product path: built-in templates + searchDelegate → lattice receipt.
 * BP-v2.1-LATER-D7 — docs/tests tighten only (no lattice src edits this unit).
 *
 * Honest vocabulary: receipt / vScore / sufficiency ≠ verified market outcome.
 */
import {
  BUILT_IN_TEMPLATES,
  runLattice,
  type SearchDelegate,
  type SearchResult,
} from '../src';

const TIMESTAMP = '2026-08-07T12:00:00.000Z';
const QUERY = 'Should regional robotics builders enter municipal maintenance markets?';

function domainScopedResults(domainId: string): SearchResult[] {
  return [
    {
      title: `${domainId} evidence`,
      url: `https://example.com/${domainId}/article`,
      snippet: `Domain-scoped snippet for ${domainId}`,
      publishedAt: '2026-08-01',
      domain: 'example.com',
    },
  ];
}

describe('product path: templates → searchDelegate → receipt', () => {
  it('runs every built-in template through searchDelegate end-to-end', async () => {
    expect(BUILT_IN_TEMPLATES.length).toBeGreaterThanOrEqual(6);

    for (const template of BUILT_IN_TEMPLATES) {
      const seenDomains: string[] = [];
      const searchDelegate: SearchDelegate = async (_query, domainSpec) => {
        seenDomains.push(domainSpec.id);
        return domainScopedResults(domainSpec.id);
      };

      const receipt = await runLattice(QUERY, template, {
        searchDelegate,
        timestamp: TIMESTAMP,
      });

      expect(seenDomains.sort()).toEqual([...template.domains].sort());
      expect(receipt.templateRef).toBe(template.id);
      expect(receipt.receiptId).toMatch(/^lattice-receipt-/);
      expect(receipt.hash).toHaveLength(64);
      expect(Object.keys(receipt.domainsMap).sort()).toEqual([...template.domains].sort());
      // Packages API finish only — not app UI / verified-market claim
      expect(typeof receipt.vScore).toBe('number');
    }
  });

  it('documents connector priority: searchDelegate used when no explicit connector', async () => {
    const template = BUILT_IN_TEMPLATES.find((t) => t.id === 'builder-radar');
    expect(template).toBeDefined();

    let calls = 0;
    const searchDelegate: SearchDelegate = async () => {
      calls += 1;
      return domainScopedResults('economic');
    };

    const receipt = await runLattice(QUERY, template!, {
      searchDelegate,
      timestamp: TIMESTAMP,
    });

    expect(calls).toBe(template!.domains.length);
    expect(receipt.templateRef).toBe('builder-radar');
  });
});
