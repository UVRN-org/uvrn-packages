import { DefaultEvidenceTagger, verifyClaim, verifyClaimAsync } from '../src';
import type { AsyncClaimClassifier, ClaimSpec } from '../src';

const TS = '2026-05-25T12:00:00.000Z';

describe('verifyClaim', () => {
  it('runs the zero-dependency default path end to end', () => {
    const verdict = verifyClaim(
      'People are buying maximalist POD products',
      [{ source: 'Etsy sales' }],
      { ts: TS }
    );

    expect(verdict.level).toBe('L3');
    expect(verdict.status).toBe('Supported');
    expect(verdict.obtainedEvidence).toContain('purchase');
  });

  it('uses a pre-classified ClaimSpec instead of the classifier', () => {
    const spec: ClaimSpec = {
      text: 'Custom claim',
      level: 'L4',
      requiredEvidence: ['commercial_outcome'],
      classifier: 'manual',
      explanation: 'pre-built',
    };

    const verdict = verifyClaim(spec, [{ source: 'revenue growth' }], { ts: TS });
    expect(verdict.level).toBe('L4');
    expect(verdict.status).toBe('Supported');
  });

  it('threads claimId through to the verdict', () => {
    const verdict = verifyClaim('People are buying widgets', [{ source: 'Etsy sales' }], {
      claimId: 'MAXI-POD',
      ts: TS,
    });
    expect(verdict.claimId).toBe('MAXI-POD');
  });

  it('accepts a custom tagger for domain-specific vocabulary', () => {
    const tagger = new DefaultEvidenceTagger({ myfeed: 'purchase' });
    const verdict = verifyClaim('People are buying widgets', [{ source: 'myfeed daily report' }], {
      tagger,
      ts: TS,
    });
    expect(verdict.status).toBe('Supported');
  });

  it('supports an async LLM-style classifier', async () => {
    const asyncClassifier: AsyncClaimClassifier = {
      name: 'StubLLMClassifier',
      classify: async (text: string): Promise<ClaimSpec> => ({
        text,
        level: 'L3',
        requiredEvidence: ['purchase'],
        classifier: 'StubLLMClassifier',
        explanation: 'stub',
      }),
    };

    const verdict = await verifyClaimAsync('anything', [{ source: 'Etsy sales' }], {
      classifier: asyncClassifier,
      ts: TS,
    });
    expect(verdict.status).toBe('Supported');
    expect(verdict.level).toBe('L3');
  });

  it('is domain-general: an explicit macro claim verifies against CPI/PPI evidence', () => {
    const spec: ClaimSpec = {
      text: 'Inflation is rising',
      level: 'L4',
      requiredEvidence: ['market_expansion'],
      classifier: 'manual',
      explanation: 'macro claim',
    };

    const verdict = verifyClaim(spec, [{ source: 'CPI' }, { source: 'PPI' }], { ts: TS });
    expect(verdict.status).toBe('Supported');
    expect(verdict.obtainedEvidence).toContain('market_expansion');
  });
});
