import {
  reportRankStability,
  DEFAULT_RANK_STABILITY_VARIANTS,
} from '../src/presets/rankStability';
import { Candidate } from '../src/types';
import fixture from './fixtures/fashion-trends.json';

const candidates = fixture as Candidate[];
const now = '2026-05-24T00:00:00.000Z';

describe('reportRankStability (fashion trends)', () => {
  it('returns baseline ranking plus survive/reorder report for N=3 PREP variants', async () => {
    const result = await reportRankStability(candidates, {
      baseline: { now, weights: { prominence: 1 } },
    });

    expect(DEFAULT_RANK_STABILITY_VARIANTS).toHaveLength(3);
    expect(result.variants).toHaveLength(3);
    expect(result.baseline.rankedLabels[0]).toBe('oversized blazers');
    expect(result.variants.find((v) => v.name === 'mentions-only')?.rankedLabels[0]).toBe(
      'quiet luxury',
    );

    expect(result.report.length).toBe(result.baseline.rankedLabels.length);
    for (const entry of result.report) {
      expect(['survive', 'reorder']).toContain(entry.status);
      expect(entry.baselineRank).toBeGreaterThanOrEqual(1);
      expect(Object.keys(entry.variantRanks).sort()).toEqual(
        result.variants.map((v) => v.name).sort(),
      );
    }

    // Honest vocabulary: no verified/accurate/market claims in status enum.
    const statuses = new Set(result.report.map((e) => e.status));
    expect([...statuses].every((s) => s === 'survive' || s === 'reorder')).toBe(true);
  });

  it('marks at least one baseline identity as reorder when mentions are emphasized', async () => {
    const result = await reportRankStability(candidates, {
      baseline: { now, weights: { prominence: 1 } },
    });

    const oversized = result.report.find((e) => e.label === 'oversized blazers');
    expect(oversized).toBeDefined();
    expect(oversized!.baselineRank).toBe(1);
    expect(oversized!.status).toBe('reorder');
    expect(oversized!.variantRanks['mentions-only']).not.toBe(1);

    const quiet = result.report.find((e) => e.label === 'quiet luxury');
    expect(quiet).toBeDefined();
    expect(quiet!.status).toBe('reorder');
  });

  it('marks at least one baseline identity as survive across the N=3 PREP variants', async () => {
    const result = await reportRankStability(candidates, {
      baseline: { now, weights: { prominence: 1 } },
    });

    const survivors = result.report.filter((e) => e.status === 'survive');
    expect(survivors.length).toBeGreaterThanOrEqual(1);

    for (const entry of survivors) {
      for (const variant of result.variants) {
        expect(entry.variantRanks[variant.name]).toBe(entry.baselineRank);
      }
    }
  });
});
