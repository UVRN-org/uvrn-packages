import { SCORE_PROFILES, ScoreBreakdown, WEIGHTS } from '../src';

describe('@uvrn/score', () => {
  test('computes weighted values and final score from top-level receipt fields', () => {
    const breakdown = new ScoreBreakdown(
      {
        completeness: 88,
        parity: 92,
        freshness: 75,
        v_score: 85.5,
      },
      SCORE_PROFILES.financial
    );

    expect(breakdown.completeness).toEqual({ raw: 88, weight: 0.35, weighted: 30.8 });
    expect(breakdown.parity).toEqual({ raw: 92, weight: 0.35, weighted: 32.2 });
    expect(breakdown.freshness).toEqual({ raw: 75, weight: 0.3, weighted: 22.5 });
    expect(breakdown.final).toBe(85.5);
  });

  test('accepts drift-style nested components', () => {
    const breakdown = new ScoreBreakdown(
      {
        claim_id: 'clm_001',
        components: {
          completeness: 80,
          parity: 78,
          freshness: 64,
        },
      },
      SCORE_PROFILES.general
    );

    expect(breakdown.final).toBe(74.5);
    expect(breakdown.profile).toBe('general');
  });

  test('produces an LLM-friendly explanation string', () => {
    const breakdown = new ScoreBreakdown(
      { completeness: 70, parity: 74, freshness: 61 },
      SCORE_PROFILES.news
    );

    expect(breakdown.explanation).toContain('V-Score:');
    expect(breakdown.explanation).toContain('Consensus is');
    expect(breakdown.explanation.length).toBeGreaterThan(40);
  });

  test('exports all built-in scoring profiles', () => {
    expect(Object.keys(SCORE_PROFILES)).toEqual(
      expect.arrayContaining(['financial', 'research', 'news', 'general'])
    );
    expect(SCORE_PROFILES.research.thresholds.stable).toBe(75);
  });

  test('exports canonical weight fallback constants', () => {
    expect(WEIGHTS).toEqual({
      completeness: 0.35,
      parity: 0.35,
      freshness: 0.3,
    });
  });

  test('toJSON returns a serializable breakdown result', () => {
    const breakdown = new ScoreBreakdown(
      { completeness: 90, parity: 85, freshness: 80 },
      SCORE_PROFILES.financial
    );

    const serialized = JSON.parse(JSON.stringify(breakdown.toJSON()));

    expect(serialized.final).toBe(85.3);
    expect(serialized.explanation).toContain('financial profile');
  });
});
