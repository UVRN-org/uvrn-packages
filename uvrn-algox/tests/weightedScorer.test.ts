import { weightedScorer } from '../src/stages/scorers/weightedScorer';
import { buildContext } from '../src/pipeline';

describe('weightedScorer', () => {
  it('blends top-level fields and nested signals with weights', async () => {
    const ctx = buildContext({
      candidates: [
        { label: 'a', prominence: 10, signals: { mentions: 4 } },
        { label: 'b', prominence: 2, signals: { mentions: 50 } },
      ],
    });
    await weightedScorer({ weights: { prominence: 1, mentions: 0.5 } }).run(ctx);
    // a: 10*1 + 4*0.5 = 12 ; b: 2*1 + 50*0.5 = 27
    expect(ctx.candidates[0].score).toBe(12);
    expect(ctx.candidates[1].score).toBe(27);
  });

  it('treats missing signals as zero', async () => {
    const ctx = buildContext({ candidates: [{ label: 'a' }] });
    await weightedScorer({ weights: { prominence: 1 } }).run(ctx);
    expect(ctx.candidates[0].score).toBe(0);
  });
});
