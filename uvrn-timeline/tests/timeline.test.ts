import { mockCanonReceipt, mockDriftSnapshot } from '@uvrn/test';

import { MockTimelineStore, Timeline } from '../src';

describe('@uvrn/timeline', () => {
  it('timeline.query() returns the correct snapshot count for a date range', async () => {
    const timeline = new Timeline({
      store: new MockTimelineStore({
        snapshots: [
          mockDriftSnapshot({ claimId: 'clm_timeline', scoredAt: '2026-04-01T01:00:00.000Z' }),
          mockDriftSnapshot({ claimId: 'clm_timeline', scoredAt: '2026-04-02T01:00:00.000Z' }),
          mockDriftSnapshot({ claimId: 'clm_other', scoredAt: '2026-04-02T01:00:00.000Z' }),
        ],
      }),
    });

    const result = await timeline.query('clm_timeline', {
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-03T00:00:00.000Z',
    });

    expect(result.snapshots).toHaveLength(2);
  });

  it('resolution: daily aggregates to one point per day', async () => {
    const timeline = new Timeline({
      store: new MockTimelineStore({
        snapshots: [
          mockDriftSnapshot({
            claimId: 'clm_timeline',
            vScore: 80,
            scoredAt: '2026-04-01T01:00:00.000Z',
          }),
          mockDriftSnapshot({
            claimId: 'clm_timeline',
            vScore: 85,
            scoredAt: '2026-04-01T23:00:00.000Z',
          }),
          mockDriftSnapshot({
            claimId: 'clm_timeline',
            vScore: 90,
            scoredAt: '2026-04-02T10:00:00.000Z',
          }),
        ],
      }),
    });

    const result = await timeline.query('clm_timeline', {
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-03T00:00:00.000Z',
      resolution: 'daily',
    });

    expect(result.snapshots).toHaveLength(2);
    expect(result.snapshots[0]?.vScore).toBe(85);
  });

  it('chart() returns arrays of equal length', async () => {
    const timeline = new Timeline({
      store: new MockTimelineStore({
        snapshots: [
          mockDriftSnapshot({ claimId: 'clm_timeline', scoredAt: '2026-04-01T01:00:00.000Z' }),
          mockDriftSnapshot({ claimId: 'clm_timeline', scoredAt: '2026-04-02T01:00:00.000Z' }),
        ],
      }),
    });

    const result = await timeline.query('clm_timeline');
    const chart = result.chart();

    expect(chart.labels).toHaveLength(chart.vScores.length);
    expect(chart.labels).toHaveLength(chart.statuses.length);
  });

  it('chart() includes canonMarkers at the nearest indices', async () => {
    const timeline = new Timeline({
      store: new MockTimelineStore({
        snapshots: [
          mockDriftSnapshot({ claimId: 'clm_timeline', scoredAt: '2026-04-01T00:00:00.000Z' }),
          mockDriftSnapshot({ claimId: 'clm_timeline', scoredAt: '2026-04-02T00:00:00.000Z' }),
        ],
        canonEvents: [
          mockCanonReceipt({
            claim_id: 'clm_timeline',
            canonized_at: '2026-04-02T01:00:00.000Z',
          }),
        ],
      }),
    });

    const result = await timeline.query('clm_timeline');
    const chart = result.chart();

    expect(chart.canonMarkers).toHaveLength(1);
    expect(chart.canonMarkers[0]?.index).toBe(1);
  });

  it('summary is non-empty and LLM-friendly', async () => {
    const timeline = new Timeline({
      store: new MockTimelineStore({
        snapshots: [
          mockDriftSnapshot({
            claimId: 'clm_timeline',
            vScore: 88,
            status: 'DRIFTING',
            scoredAt: '2026-04-01T00:00:00.000Z',
          }),
        ],
        canonEvents: [mockCanonReceipt({ claim_id: 'clm_timeline' })],
      }),
    });

    const result = await timeline.query('clm_timeline');

    expect(result.summary).toContain('Claim clm_timeline');
    expect(result.summary).toContain('1 canonization event');
  });

  it('empty date ranges return empty snapshots and do not throw', async () => {
    const timeline = new Timeline({
      store: new MockTimelineStore(),
    });

    const result = await timeline.query('clm_missing');

    expect(result.snapshots).toEqual([]);
    expect(result.summary).toContain('no timeline snapshots');
  });

  it('constructor validates that either store or apiUrl is present', () => {
    expect(() => new Timeline({})).toThrow('requires either a store or apiUrl');
    expect(() => new Timeline({ apiUrl: 'https://api.uvrn.test' })).not.toThrow();
  });
});
