import { mockDriftSnapshot } from '@uvrn/test';

import { CompareEngine } from '../src';

describe('@uvrn/compare', () => {
  it('compare() returns correct winner, loser, and delta for unequal scores', () => {
    const result = CompareEngine.compare([
      mockDriftSnapshot({ claimId: 'clm_a', vScore: 91, status: 'STABLE' }),
      mockDriftSnapshot({ claimId: 'clm_b', vScore: 78, status: 'DRIFTING' }),
    ]);

    expect(result.delta).toBe(13);
    expect(result.details.receiptA.claimId).toBe('clm_a');
    expect(result.details.receiptB.claimId).toBe('clm_b');
    expect(result.summary).toContain('clm_a');
    expect(result.summary).toContain('78.0');
  });

  it('compare() handles ties by returning receiptA as winner conventionally', () => {
    const result = CompareEngine.compare([
      { claim_id: 'clm_a', v_score: 88, status: 'STABLE', scored_at: '2026-04-01T00:00:00.000Z' },
      { claim_id: 'clm_b', v_score: 88, status: 'STABLE', scored_at: '2026-04-01T00:00:00.000Z' },
    ]);

    expect(result.delta).toBe(0);
    expect(result.summary.toLowerCase()).toContain('tied');
  });

  it('normalize: true converts fractional scores to 0-100 before comparing', () => {
    const result = CompareEngine.compare(
      [
        { claim_id: 'clm_a', v_score: 0.93, status: 'STABLE', scored_at: '2026-04-01T00:00:00.000Z' },
        { claim_id: 'clm_b', v_score: 0.81, status: 'STABLE', scored_at: '2026-04-01T00:00:00.000Z' },
      ],
      { normalize: true }
    );

    expect(result.delta).toBeCloseTo(12, 5);
    expect(result.details.receiptA.vScore).toBe(93);
  });

  it('divergenceAt is undefined when includeTimeline is false or not derivable', () => {
    const withoutTimeline = CompareEngine.compare([
      mockDriftSnapshot({ claimId: 'clm_a', vScore: 90 }),
      mockDriftSnapshot({ claimId: 'clm_b', vScore: 80 }),
    ]);

    const withoutHistory = CompareEngine.compare(
      [
        mockDriftSnapshot({ claimId: 'clm_a', vScore: 90 }),
        mockDriftSnapshot({ claimId: 'clm_b', vScore: 80 }),
      ],
      { includeTimeline: true }
    );

    expect(withoutTimeline.divergenceAt).toBeUndefined();
    expect(withoutHistory.divergenceAt).toBeUndefined();
  });

  it('divergenceAt is derived when two claims cross over in history', () => {
    const result = CompareEngine.compare(
      [
        mockDriftSnapshot({
          claimId: 'clm_a',
          vScore: 70,
          scoredAt: '2026-04-01T00:00:00.000Z',
        }),
        mockDriftSnapshot({
          claimId: 'clm_b',
          vScore: 80,
          scoredAt: '2026-04-01T00:00:00.000Z',
        }),
        mockDriftSnapshot({
          claimId: 'clm_a',
          vScore: 92,
          scoredAt: '2026-04-02T00:00:00.000Z',
        }),
        mockDriftSnapshot({
          claimId: 'clm_b',
          vScore: 79,
          scoredAt: '2026-04-02T00:00:00.000Z',
        }),
      ],
      { includeTimeline: true }
    );

    expect(result.divergenceAt).toBe('2026-04-02T00:00:00.000Z');
  });

  it('compareSeries() returns correct trend for improving, declining, and stable series', () => {
    const improving = CompareEngine.compareSeries([
      mockDriftSnapshot({ claimId: 'clm_series', vScore: 70, scoredAt: '2026-04-01T00:00:00.000Z' }),
      mockDriftSnapshot({ claimId: 'clm_series', vScore: 75, scoredAt: '2026-04-02T00:00:00.000Z' }),
      mockDriftSnapshot({ claimId: 'clm_series', vScore: 81, scoredAt: '2026-04-03T00:00:00.000Z' }),
    ]);

    const declining = CompareEngine.compareSeries([
      mockDriftSnapshot({ claimId: 'clm_series', vScore: 82, scoredAt: '2026-04-01T00:00:00.000Z' }),
      mockDriftSnapshot({ claimId: 'clm_series', vScore: 79, scoredAt: '2026-04-02T00:00:00.000Z' }),
      mockDriftSnapshot({ claimId: 'clm_series', vScore: 75, scoredAt: '2026-04-03T00:00:00.000Z' }),
    ]);

    const stable = CompareEngine.compareSeries([
      mockDriftSnapshot({ claimId: 'clm_series', vScore: 80, scoredAt: '2026-04-01T00:00:00.000Z' }),
      mockDriftSnapshot({ claimId: 'clm_series', vScore: 81, scoredAt: '2026-04-02T00:00:00.000Z' }),
      mockDriftSnapshot({ claimId: 'clm_series', vScore: 80.5, scoredAt: '2026-04-03T00:00:00.000Z' }),
    ]);

    expect(improving.trend).toBe('improving');
    expect(declining.trend).toBe('declining');
    expect(stable.trend).toBe('stable');
  });
});
