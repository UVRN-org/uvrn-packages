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

function evidence(
  evidenceClass: EvidenceClass,
  source: string,
  value?: number,
  originId?: string
): EvidenceItem {
  return {
    evidenceClass,
    source,
    value,
    explanation: `${source} -> ${evidenceClass}`,
    ...(originId ? { originId } : {}),
  };
}

describe('matchSufficiency', () => {
  it('marks a claim Supported when required evidence is fully covered (worked example 1)', () => {
    const verdict = matchSufficiency(
      claimSpec('L1', ['attention']),
      [
        evidence('attention', 'Pinterest', undefined, 'origin:pinterest'),
        evidence('attention', 'Printful', undefined, 'origin:printful'),
        evidence('attention', 'Etsy', undefined, 'origin:etsy'),
        evidence('attention', 'retail press', undefined, 'origin:press'),
      ],
      { ts: TS }
    );

    expect(verdict.status).toBe('Supported');
    expect(verdict.missingEvidence).toEqual([]);
    expect(verdict.licensedClaimLevel).toBe('L1');
    expect(verdict.coverageBand).toBe('high');
    expect(verdict.evidenceCoverageScore).toBeGreaterThan(0.45);
    expect(verdict.distinctOriginCount).toBe(4);
    expect(verdict.originCorroborationIncomplete).toBe(false);
  });

  it('marks a claim Unverified when required evidence is missing (worked example 2)', () => {
    const verdict = matchSufficiency(
      claimSpec('L3', ['purchase']),
      [evidence('attention', 'Pinterest', undefined, 'origin:pinterest')],
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
        evidence('market_expansion', 'CPI', 100, 'origin:cpi'),
        evidence('market_expansion', 'GDP', 100, 'origin:gdp'),
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
    expect(verdict.distinctOriginCount).toBe(0);
    expect(verdict.originCorroborationIncomplete).toBe(false);
  });

  it('is deterministic for identical inputs', () => {
    const build = () =>
      matchSufficiency(
        claimSpec('L3', ['purchase']),
        [evidence('purchase', 'Etsy sales', undefined, 'origin:etsy')],
        {
          ts: TS,
        }
      );
    expect(build()).toEqual(build());
  });

  it('does not max corroboration from same-origin restatements (F-1 path a)', () => {
    const restatement = matchSufficiency(
      claimSpec('L1', ['attention']),
      [
        evidence('attention', 'Doc A quoting BLS', 100, 'origin:bls'),
        evidence('attention', 'Doc B quoting BLS', 100, 'origin:bls'),
        evidence('attention', 'Doc C quoting BLS', 100, 'origin:bls'),
        evidence('attention', 'Doc D quoting BLS', 100, 'origin:bls'),
      ],
      { ts: TS }
    );

    const distinct = matchSufficiency(
      claimSpec('L1', ['attention']),
      [
        evidence('attention', 'Doc A', 100, 'origin:bls'),
        evidence('attention', 'Doc B', 100, 'origin:census'),
      ],
      { ts: TS }
    );

    expect(restatement.status).toBe('Supported');
    expect(distinct.status).toBe('Supported');
    expect(restatement.distinctOriginCount).toBe(1);
    expect(distinct.distinctOriginCount).toBe(2);
    // Same originId × N must not outscore two distinct origins (origin-blind source count would).
    expect(distinct.evidenceCoverageScore).toBeGreaterThan(restatement.evidenceCoverageScore);
  });

  it('marks origin corroboration incomplete when matched items lack originId', () => {
    const verdict = matchSufficiency(
      claimSpec('L1', ['attention']),
      [
        evidence('attention', 'Pinterest', 100),
        evidence('attention', 'Printful', 100),
      ],
      { ts: TS }
    );

    expect(verdict.status).toBe('Supported');
    expect(verdict.originCorroborationIncomplete).toBe(true);
    expect(verdict.distinctOriginCount).toBe(0);
    // Without originIds, corroboration term is 0 (no invented origins from source strings).
    // coverage=1, strength=1 → 0.5 + 0.25 = 0.75 → high band edge; incomplete still honest.
    expect(verdict.evidenceCoverageScore).toBe(0.75);
  });
});
