import { Context, ScoredCandidate, Stage } from '../../types';
import { pushWarning } from '../../pipeline';

// Drop candidates whose required field is absent/empty.
export function dropMissing(field: string): Stage {
  const name = `dropMissing(${field})`;
  return {
    name,
    run(ctx: Context) {
      const kept: ScoredCandidate[] = [];
      for (const c of ctx.candidates) {
        const v = (c as Record<string, unknown>)[field];
        if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
          c.reason = `missing_${field}`;
          ctx.dropped.push(c);
          pushWarning(ctx, name, 'missing_field', c.id ?? c.label);
        } else {
          kept.push(c);
        }
      }
      ctx.candidates = kept;
    },
  };
}
