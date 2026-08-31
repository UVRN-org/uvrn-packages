import { readMetaReadout } from '../src';
import type { HumanView } from '@uvrn/receipt';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function minimalScoreCard(): HumanView['scoreCard'] {
  return {
    plainMeaning: {
      vScore: 'How complete and consistent the evidence package looks — not whether the claim is true.',
      completeness: 'How much of the expected evidence surface is present.',
      parity: 'How consistent comparable sources are with each other.',
      freshness: 'How recent the retained evidence is relative to the claim window.',
    },
  };
}

function stubView(overrides: Partial<HumanView> = {}): HumanView {
  return {
    headline: 'Sources are split',
    verdictLabel: 'Split',
    verdictTone: 'split',
    claim: 'Example claim under review.',
    scoreCard: minimalScoreCard(),
    sources: [],
    measurements: [],
    gaps: [],
    provenance: {
      hash: 'abc123',
      signed: true,
      verifyUrl: 'https://example.test/verify',
    },
    howToVerify: 'Verify the receipt hash and signature.',
    ...overrides,
  };
}

describe('@uvrn/meta-readout package identity', () => {
  it('package.json name is @uvrn/meta-readout', () => {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
    ) as { name: string };
    expect(pkg.name).toBe('@uvrn/meta-readout');
  });
});

describe('readMetaReadout', () => {
  it('maps stanceSummary to linedUp and copies gaps', () => {
    const view = stubView({
      stanceSummary: { support: 3, oppose: 1 },
      gaps: [{ what: 'missing-source', plainNote: 'No secondary source retained.' }],
    });

    const out = readMetaReadout(view);

    expect(out.linedUp).toEqual({ support: 3, oppose: 1 });
    expect(out.gaps).toEqual([{ what: 'missing-source', plainNote: 'No secondary source retained.' }]);
    expect(out.verdictLabel).toBe('Split');
    expect(out.verdictTone).toBe('split');
    expect(out.headline).toBe('Sources are split');
    expect(out.claim).toBe('Example claim under review.');
    expect(out.provenance).toEqual({ signed: true, hash: 'abc123' });
    expect(out.scoreCard).toEqual(view.scoreCard);
  });

  it('flags missing actionableExplanation and does not invent drivers', () => {
    const view = stubView({
      stanceSummary: { support: 2, oppose: 2 },
    });

    const out = readMetaReadout(view);

    expect(out.honestyFlags).toContain('missing-actionable-explanation');
    expect(out.situation).toBeUndefined();
  });

  it('copies situation from actionableExplanation without inventing drivers', () => {
    const view = stubView({
      actionableExplanation: {
        question: 'disagree-to-agree',
        primaryDrivers: [
          {
            id: 'measurement.agree.no-agreement',
            kind: 'measurement',
            anchor: 'measurements[0].explanation',
            fact: 'Comparable sources did not converge above the agree threshold.',
            counterfactual: 'Closer numeric overlap would move toward agree.',
          },
        ],
      },
    });

    const out = readMetaReadout(view);

    expect(out.honestyFlags).not.toContain('missing-actionable-explanation');
    expect(out.situation).toEqual({
      question: 'disagree-to-agree',
      primaryDrivers: [
        {
          id: 'measurement.agree.no-agreement',
          kind: 'measurement',
          anchor: 'measurements[0].explanation',
          fact: 'Comparable sources did not converge above the agree threshold.',
          counterfactual: 'Closer numeric overlap would move toward agree.',
        },
      ],
    });
  });

  it('sets honesty flags for quality diagnostics, gaps, and unsigned provenance', () => {
    const view = stubView({
      gaps: [{ what: 'thin-evidence', plainNote: 'Only one source retained.' }],
      sourceQualityDiagnostics: [
        {
          code: 'evidenceScore.weak',
          kind: 'weak',
          sourceId: 'src-a',
          field: 'evidenceScore',
          note: 'evidenceScore below weakEvidenceScore threshold.',
        },
      ],
      provenance: {
        hash: 'def456',
        signed: false,
        verifyUrl: 'https://example.test/verify',
      },
    });

    const out = readMetaReadout(view);

    expect(out.honestyFlags).toEqual(
      expect.arrayContaining([
        'missing-actionable-explanation',
        'weak-or-inconsistent-sources',
        'gaps-present',
        'unsigned-provenance',
      ])
    );
    expect(out.qualityDiagnostics).toEqual([
      {
        code: 'evidenceScore.weak',
        kind: 'weak',
        sourceId: 'src-a',
        field: 'evidenceScore',
        note: 'evidenceScore below weakEvidenceScore threshold.',
      },
    ]);
    expect(out.provenance.signed).toBe(false);
  });

  it('omits linedUp when stanceSummary is absent', () => {
    const out = readMetaReadout(stubView());
    expect(out.linedUp).toBeUndefined();
  });

  it('copies verdictDescriptor when present', () => {
    const descriptor = {
      term: 'contested-split',
      parent: 'split' as const,
      definition: 'Support and oppose both present with meaningful weight.',
    };
    const out = readMetaReadout(stubView({ verdictDescriptor: descriptor }));
    expect(out.verdictDescriptor).toEqual(descriptor);
  });
});
