import { rankSignals } from '../src/presets/signals';
import { Candidate } from '../src/types';
import fixture from './fixtures/fashion-trends.json';

const candidates = fixture as Candidate[];
const now = '2026-05-24T00:00:00.000Z';

describe('rankSignals (fashion trends)', () => {
  it('returns the most prominent signals, ranked, with defaults applied', async () => {
    const result = await rankSignals(candidates, { now });

    // Highest prominence among fresh, non-duplicate, labelled signals.
    expect(result.ranked[0].label).toBe('oversized blazers');
    // Ranked descending by score.
    const scores = result.ranked.map((c) => c.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);

    const droppedReasons = result.dropped.map((c) => c.reason);
    expect(result.dropped.some((c) => c.label === 'y2k revival')).toBe(true); // stale
    expect(droppedReasons).toContain('duplicate'); // vogue.com/a/ collapses
    expect(droppedReasons).toContain('missing_label'); // empty-label entry

    // Config is echoed for transparency.
    expect(result.config.topK).toBe(10);
    expect(result.config.maxAgeDays).toBe(30);
  });

  it('respects a tighter per-source cap (anti-domination knob)', async () => {
    const result = await rankSignals(candidates, { now, capPerSource: 2 });
    const vogue = result.ranked.filter((c) => c.source === 'vogue.com');
    expect(vogue.length).toBeLessThanOrEqual(2);
  });

  it('re-weights ranking when a different signal is emphasized', async () => {
    const result = await rankSignals(candidates, {
      now,
      weights: { mentions: 1 },
    });
    // "quiet luxury" has the most mentions (1500) among fresh signals.
    expect(result.ranked[0].label).toBe('quiet luxury');
  });
});
