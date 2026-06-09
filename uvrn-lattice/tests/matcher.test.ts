import { matchSufficiency } from '../src';
import type { ClaimSpec, EvidenceClass, EvidenceItem } from '../src';

const TS = '2026-05-25T12:00:00.000Z';

function claimSpec(level: ClaimSpec['level'], requiredEvidence: EvidenceClass[]): ClaimSpec {
  return {
    text: `test claim ${level}`,
    level,
    requiredEvidence,
    classifier: 'test',
    explanation: 'test',
  };
}

function evidence(evidenceClass: EvidenceClass, source: string, value?: number): EvidenceItem {
  return { evidenceClass, source, value, explanation: `${source} -> ${evidenceClass}` };
}

describe('matchSufficiency', () => {
  it('marks a claim Supported when required evidence is fully covered (worked example 1)', () => {
    const verdict = matchSufficiency(
      claimSpec('L1', ['attention']),
      [
        evidence('attention', 'Pinterest'),
        evidence('attention', 'Printful'),
        evidence('attention', 'Etsy'),
        evidence('attention', 'retail press'),
      ],
      { ts: TS }
    );

    expect(verdict.status).toBe('Supported');
    expect(verdict.missingEvidence).toEqual([]);
    expect(verdict.licensedClaimLevel).toBe('L1');
    expect(verdict.coverageBand).toBe('high');
    expect(verdict.evidenceCoverageScore).toBeGreaterThan(0.45);
  });

  it('marks a claim Unverified when required evidence is missing (worked example 2)', () => {
    const verdict = matchSufficiency(
      claimSpec('L3', ['purchase']),
      [evidence('attention', 'Pinterest')],
      { ts: TS }
    );

    expect(verdict.status).toBe('Unverified');
    expect(verdict.missingEvidence).toEqual(['purchase']);
    expect(verdict.coverageBand).toBe('none');
    // Evidence only licenses the weaker L1 claim, below the asserted L3.
    expect(verdict.licensedClaimLevel).toBe('L1');
  });

  it('caps an Unverified verdict at coverage band "low" despite partial coverage', () => {
    const verdict = matchSufficiency(
      claimSpec('L5', ['market_expansion', 'repeat_purchase']),
      [
        evidence('market_expansion', 'CPI', 100),
        evidence('market_expansion', 'GDP', 100),
      ],
      { ts: TS }
    );

    expect(verdict.status).toBe('Unverified');
    expect(verdict.missingEvidence).toEqual(['repeat_purchase']);
    expect(verdict.coverageBand).toBe('low'); // would be "moderate" by score, capped for honesty
  });

  it('treats an empty requiredEvidence claim as vacuously Supported with zero coverage score', () => {
    // Unreachable via the built-in ladder (every level requires >=1 class); only via a custom
    // ClaimSpec. Locked here so the edge behavior is intentional, not accidental.
    const verdict = matchSufficiency(claimSpec('L1', []), [], { ts: TS });
    expect(verdict.status).toBe('Supported');
    expect(verdict.evidenceCoverageScore).toBe(0);
    expect(verdict.coverageBand).toBe('none');
  });

  it('is deterministic for identical inputs', () => {
    const build = () =>
      matchSufficiency(claimSpec('L3', ['purchase']), [evidence('purchase', 'Etsy sales')], {
        ts: TS,
      });
    expect(build()).toEqual(build());
  });
});
