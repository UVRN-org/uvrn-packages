import { capPerGroup } from '../src/stages/filters/capPerGroup';
import { buildContext } from '../src/pipeline';
import { ScoredCandidate } from '../src/types';

describe('capPerGroup', () => {
  it('keeps the highest-scoring candidates per group and drops the rest', async () => {
    const ctx = buildContext({
      candidates: [
        { label: 'a', source: 'vogue.com' },
        { label: 'b', source: 'vogue.com' },
        { label: 'c', source: 'vogue.com' },
        { label: 'd', source: 'elle.com' },
      ],
    });
    // assign scores: a=5, b=9, c=1, d=3
    const score: Record<string, number> = { a: 5, b: 9, c: 1, d: 3 };
    ctx.candidates.forEach((c) => (c.score = score[c.label]));

    await capPerGroup({ groupBy: (c: ScoredCandidate) => c.source ?? '', cap: 2 }).run(ctx);

    const keptLabels = ctx.candidates.map((c) => c.label).sort();
    // vogue keeps b(9) and a(5); c(1) dropped. elle keeps d.
    expect(keptLabels).toEqual(['a', 'b', 'd']);
    expect(ctx.dropped.map((c) => c.label)).toEqual(['c']);
    expect(ctx.dropped[0].reason).toBe('group_cap_exceeded');
  });
});
