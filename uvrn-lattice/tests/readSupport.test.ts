import { readSupport } from '../src';
import type { EvidenceItem } from '../src';

const TS = '2026-05-25T12:00:00.000Z';

describe('readSupport (named support readout)', () => {
  it('returns a documented support readout shape with origin transparency', () => {
    const evidence: EvidenceItem[] = [
      {
        evidenceClass: 'purchase',
        source: 'Etsy sales feed',
        originId: 'origin:etsy',
        explanation: 'sales',
      },
      {
        evidenceClass: 'purchase',
        source: 'Shopify velocity',
        originId: 'origin:shopify',
        explanation: 'velocity',
      },
    ];

    const readout = readSupport('People are buying maximalist POD products', evidence, {
      ts: TS,
    });

    expect(readout.status).toBe('Supported');
    expect(readout.level).toBe('L3');
    expect(readout.coverageBand).toMatch(/^(none|low|moderate|high)$/);
    expect(typeof readout.evidenceCoverageScore).toBe('number');
    expect(readout.distinctOriginCount).toBe(2);
    expect(readout.originCorroborationIncomplete).toBe(false);
    expect(readout.requiredEvidence).toContain('purchase');
    expect(readout.missingEvidence).toEqual([]);
    // Honest disclaimer may mention the forbidden words only to negate them.
    expect(readout.interpretation).toMatch(/not accuracy/i);
    expect(readout.interpretation).not.toMatch(/\bis verified\b/i);
    expect(readout.explanation).toMatch(/not accuracy/i);
  });

  it('returns honest Unverified / empty coverage when inputs cannot support the claim species', () => {
    const readout = readSupport(
      'People are buying maximalist POD products',
      [{ source: 'Pinterest' }],
      { ts: TS }
    );

    expect(readout.status).toBe('Unverified');
    expect(readout.missingEvidence).toContain('purchase');
    expect(readout.coverageBand).toBe('none');
    expect(readout.licensedClaimLevel).toBe('L1');
    expect(readout.interpretation).not.toMatch(/\bverified\b/i);
  });

  it('returns honest empty when evidence array is empty', () => {
    const readout = readSupport('People are buying maximalist POD products', [], { ts: TS });

    expect(readout.status).toBe('Unverified');
    expect(readout.obtainedEvidence).toEqual([]);
    expect(readout.evidenceCoverageScore).toBe(0);
    expect(readout.coverageBand).toBe('none');
    expect(readout.distinctOriginCount).toBe(0);
  });

  it('forwards host-supplied originId through taggable evidence', () => {
    const readout = readSupport(
      'People are talking about maximalist POD',
      [
        { source: 'Pinterest', originId: 'origin:a' },
        { source: 'Google Trends', originId: 'origin:b' },
      ],
      { ts: TS }
    );

    expect(readout.status).toBe('Supported');
    expect(readout.level).toBe('L1');
    expect(readout.distinctOriginCount).toBe(2);
    expect(readout.originCorroborationIncomplete).toBe(false);
  });
});
