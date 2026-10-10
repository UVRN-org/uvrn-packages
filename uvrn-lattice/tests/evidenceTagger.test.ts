import { DefaultEvidenceTagger, bridgeFromDomainSignals } from '../src';
import type { DomainSignal, EvidenceClass } from '../src';

const tagger = new DefaultEvidenceTagger();

describe('DefaultEvidenceTagger', () => {
  const cases: Array<{ source: string; evidenceClass: EvidenceClass }> = [
    { source: 'Pinterest', evidenceClass: 'attention' },
    { source: 'TikTok', evidenceClass: 'attention' },
    { source: 'Google Trends', evidenceClass: 'attention' },
    { source: 'Etsy listings', evidenceClass: 'supply_entry' },
    { source: 'Etsy sales', evidenceClass: 'purchase' },
    { source: 'Amazon BSR', evidenceClass: 'repeat_purchase' },
    { source: 'revenue growth', evidenceClass: 'commercial_outcome' },
    { source: 'CPI', evidenceClass: 'market_expansion' },
    { source: 'temperature record', evidenceClass: 'market_expansion' },
    { source: 'cohort analysis', evidenceClass: 'market_expansion' },
  ];

  it.each(cases)('tags "$source" as $evidenceClass', ({ source, evidenceClass }) => {
    expect(tagger.tag({ source })?.evidenceClass).toBe(evidenceClass);
  });

  it('returns null for an unrecognized source', () => {
    expect(tagger.tag({ source: 'mock://economic/evidence_strength' })).toBeNull();
  });

  // Locks the intended resolution of an overlapping phrase: "cohort retention" reads as a
  // retention (repeat_purchase) signal, while bare "cohort" reads as a longitudinal
  // (market_expansion) signal. Documented so a future taxonomy edit cannot silently flip it.
  it('resolves overlapping cohort phrasing deterministically', () => {
    expect(tagger.tag({ source: 'cohort retention' })?.evidenceClass).toBe('repeat_purchase');
    expect(tagger.tag({ source: 'cohort analysis' })?.evidenceClass).toBe('market_expansion');
  });

  it('applies caller-supplied overrides ahead of the default taxonomy', () => {
    const custom = new DefaultEvidenceTagger({ tvl: 'market_expansion' });
    expect(custom.tag({ source: 'DeFi TVL feed' })?.evidenceClass).toBe('market_expansion');
  });

  it('bridges DomainSignals through the tagger and drops the consensus metric value', () => {
    const signal: DomainSignal = {
      domainId: 'economic',
      key: 'sales',
      value: 84,
      unit: 'score',
      source: 'Etsy sales',
      ts: '2026-05-25T00:00:00.000Z',
      explanation: 'mock',
    };

    const [item] = bridgeFromDomainSignals([signal]);
    expect(item?.evidenceClass).toBe('purchase');
    expect(item?.value).toBeUndefined(); // 0..100 consensus metric is not an evidence-strength signal
  });

  it('drops bridged signals whose source the taxonomy cannot classify', () => {
    const signal: DomainSignal = {
      domainId: 'economic',
      key: 'evidence_strength',
      value: 70,
      unit: 'score',
      source: 'mock://economic/evidence_strength',
      ts: '2026-05-25T00:00:00.000Z',
      explanation: 'mock',
    };

    expect(bridgeFromDomainSignals([signal])).toHaveLength(0);
  });
});
