import {
  assessSourceQuality,
  assessConfidenceTheaterRisk,
  SOURCE_QUALITY_THRESHOLDS,
  toHumanView,
  wrapMasterReceipt,
  computeNetworkReceiptHash,
  type SourceQualityInput,
} from '../src';
import { makeMasterReceipt } from './fixtures';

function strongSource(id: string, overrides: Partial<SourceQualityInput> = {}): SourceQualityInput {
  return {
    id,
    stanceLabel: 'supports',
    stanceValue: 0.8,
    stanceConfidence: 0.85,
    stanceEvidence: 'Grounded note for fixture.',
    evidenceScore: 80,
    credibility: 0.9,
    ...overrides,
  };
}

describe('assessSourceQuality (D2 AC matrix)', () => {
  it('emits no diagnostics for strong declared inputs', () => {
    expect(assessSourceQuality([strongSource('a'), strongSource('b')])).toEqual([]);
  });

  it('fires weak stanceLabel.insufficient', () => {
    const d = assessSourceQuality([
      strongSource('s1', { stanceLabel: 'insufficient', stanceConfidence: 0.2, stanceEvidence: '' }),
    ]);
    expect(d.some((x) => x.code === 'stanceLabel.insufficient' && x.kind === 'weak')).toBe(true);
  });

  it('fires weak stanceLabel.missing when other stance fields present', () => {
    const d = assessSourceQuality([
      {
        id: 's1',
        stanceConfidence: 0.9,
        stanceEvidence: 'text',
        evidenceScore: 80,
        credibility: 0.8,
      },
    ]);
    expect(d.map((x) => x.code)).toContain('stanceLabel.missing');
  });

  it('fires stanceLabel.value_inconsistent for supports + negative value', () => {
    const d = assessSourceQuality([strongSource('s1', { stanceValue: -0.7 })]);
    expect(d.some((x) => x.code === 'stanceLabel.value_inconsistent' && x.kind === 'inconsistent')).toBe(
      true
    );
  });

  it('fires stanceLabel.ungrounded below confidence floor', () => {
    const d = assessSourceQuality([
      strongSource('s1', { stanceConfidence: SOURCE_QUALITY_THRESHOLDS.stanceConfidenceFloor - 0.1 }),
    ]);
    expect(d.some((x) => x.code === 'stanceLabel.ungrounded')).toBe(true);
  });

  it('fires evidenceScore.missing and evidenceScore.weak', () => {
    const missing = assessSourceQuality([
      strongSource('m', { evidenceScore: undefined }),
    ]);
    expect(missing.some((x) => x.code === 'evidenceScore.missing' && x.kind === 'weak')).toBe(true);

    const weak = assessSourceQuality([
      strongSource('w', { evidenceScore: SOURCE_QUALITY_THRESHOLDS.weakEvidenceScore - 1 }),
    ]);
    expect(weak.some((x) => x.code === 'evidenceScore.weak' && x.kind === 'weak')).toBe(true);
  });

  it('fires evidenceScore.confidence_theater when high confidence + weak evidence', () => {
    const d = assessSourceQuality([
      strongSource('t', {
        evidenceScore: 10,
        stanceConfidence: SOURCE_QUALITY_THRESHOLDS.highStanceConfidence,
      }),
    ]);
    expect(d.some((x) => x.code === 'evidenceScore.confidence_theater' && x.kind === 'inconsistent')).toBe(
      true
    );
  });

  it('fires credibility.missing and credibility.weak', () => {
    const missing = assessSourceQuality([strongSource('c', { credibility: undefined })]);
    expect(missing.some((x) => x.code === 'credibility.missing' && x.kind === 'weak')).toBe(true);

    const weak = assessSourceQuality([strongSource('c2', { credibility: 0.1 })]);
    expect(weak.some((x) => x.code === 'credibility.weak' && x.kind === 'weak')).toBe(true);
  });

  it('fires credibility.defaulted_as_strong when undeclared + high stanceConfidence', () => {
    const d = assessSourceQuality([
      strongSource('d', {
        credibility: undefined,
        stanceConfidence: SOURCE_QUALITY_THRESHOLDS.highStanceConfidence,
      }),
    ]);
    expect(d.some((x) => x.code === 'credibility.defaulted_as_strong' && x.kind === 'inconsistent')).toBe(
      true
    );
  });

  it('notes never contain fake high-confidence language', () => {
    const d = assessSourceQuality([
      {
        id: 'bad',
        stanceLabel: 'supports',
        stanceValue: -0.5,
        stanceConfidence: 0.95,
        stanceEvidence: '',
        evidenceScore: 5,
      },
    ]);
    expect(d.length).toBeGreaterThan(0);
    for (const item of d) {
      expect(item.note).not.toMatch(/high(?:ly)?\s+confiden/i);
      expect(item.note).not.toMatch(/\bproven\b/i);
      expect(item.note).not.toMatch(/\bverified\b/i);
    }
  });
});

describe('toHumanView source-quality path', () => {
  const master = makeMasterReceipt();
  const wrapped = wrapMasterReceipt(master, {
    claim: master.claim,
    source: 'uvrn-sdk',
    action: 'master.measured',
    topic: 'markets/crypto/BTC',
  });

  it('documents diagnostics on humanView + gaps when options supply weak inputs', () => {
    const view = toHumanView(wrapped, {
      sourceQualityInputs: [
        {
          id: 'weak-a',
          stanceLabel: 'supports',
          stanceValue: 0.9,
          stanceConfidence: 0.95,
          stanceEvidence: 'thin',
          evidenceScore: 10,
          // credibility undeclared
        },
      ],
    });

    expect(view.sourceQualityDiagnostics?.length).toBeGreaterThan(0);
    expect(view.sourceQualityDiagnostics?.some((d) => d.field === 'evidenceScore')).toBe(true);
    expect(view.sourceQualityDiagnostics?.some((d) => d.field === 'credibility')).toBe(true);
    expect(view.gaps.some((g) => g.what.includes('Source-quality'))).toBe(true);
    // Aligned + high measurement confidence + quality issues → theater caveat
    expect(view.sourceQualityDiagnostics?.some((d) => d.code === 'confidence.theater_risk')).toBe(
      true
    );
    expect(view.headline).toContain('source-quality caveats apply');
    expect(view.headline).not.toMatch(/high confidence/i);
    expect(view.verdictLabel).not.toMatch(/high confidence/i);
  });

  it('reads non-hashed envelope sourceQualityInputs (receipt path)', () => {
    const withInputs = {
      ...wrapped,
      sourceQualityInputs: [
        strongSource('env-1', { evidenceScore: 5, credibility: 0.05 }),
      ],
    };
    const view = toHumanView(withInputs);
    expect(view.sourceQualityDiagnostics?.some((d) => d.code === 'evidenceScore.weak')).toBe(true);
    expect(view.sourceQualityDiagnostics?.some((d) => d.code === 'credibility.weak')).toBe(true);
  });

  it('does not change receiptHash when sourceQualityInputs are attached (unknown-field rule)', () => {
    const baseHash = computeNetworkReceiptHash(wrapped);
    const withInputs = {
      ...wrapped,
      sourceQualityInputs: [strongSource('hash-safe', { evidenceScore: 1 })],
    };
    expect(computeNetworkReceiptHash(withInputs)).toBe(baseHash);
  });

  it('omits sourceQualityDiagnostics when no inputs are supplied', () => {
    const view = toHumanView(wrapped);
    expect(view.sourceQualityDiagnostics).toBeUndefined();
    expect(view.gaps.every((g) => !g.what.includes('Source-quality'))).toBe(true);
  });
});

describe('assessConfidenceTheaterRisk', () => {
  it('stays quiet when quality is clean', () => {
    expect(
      assessConfidenceTheaterRisk({
        diagnostics: [],
        verdictTone: 'aligned',
        measurementConfidences: [1],
      })
    ).toBeUndefined();
  });
});
