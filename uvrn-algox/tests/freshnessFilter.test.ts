import { freshnessFilter } from '../src/stages/filters/freshnessFilter';
import { buildContext } from '../src/pipeline';

describe('freshnessFilter', () => {
  const now = '2026-05-24T00:00:00.000Z';

  it('drops candidates older than maxAgeDays', async () => {
    const ctx = buildContext({
      candidates: [
        { label: 'fresh', observedAt: '2026-05-20T00:00:00.000Z' },
        { label: 'stale', observedAt: '2026-01-01T00:00:00.000Z' },
      ],
    });
    await freshnessFilter({ maxAgeDays: 30, now }).run(ctx);
    expect(ctx.candidates.map((c) => c.label)).toEqual(['fresh']);
    expect(ctx.dropped[0].label).toBe('stale');
    expect(ctx.dropped[0].reason).toBe('stale');
  });

  it('keeps candidates with missing or unparseable dates and warns', async () => {
    const ctx = buildContext({
      candidates: [
        { label: 'nodate' },
        { label: 'baddate', observedAt: 'not-a-date' },
      ],
    });
    await freshnessFilter({ maxAgeDays: 30, now }).run(ctx);
    expect(ctx.candidates).toHaveLength(2);
    expect(ctx.warnings.some((w) => w.code === 'unparseable_date')).toBe(true);
  });
});
