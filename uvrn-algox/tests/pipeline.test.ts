import { runPipeline } from '../src/pipeline';
import { Stage } from '../src/types';

describe('runPipeline', () => {
  it('runs stages in order and skips disabled stages', async () => {
    const calls: string[] = [];
    const stageA: Stage = { name: 'a', run: () => { calls.push('a'); } };
    const stageSkipped: Stage = {
      name: 'skip',
      enabled: () => false,
      run: () => { calls.push('skip'); },
    };
    const stageB: Stage = { name: 'b', run: async () => { calls.push('b'); } };

    const ctx = await runPipeline({
      query: { candidates: [{ label: 'x' }] },
      stages: [stageA, stageSkipped, stageB],
    });

    expect(calls).toEqual(['a', 'b']);
    expect(ctx.candidates[0]).toMatchObject({ label: 'x', score: 0 });
  });
});
