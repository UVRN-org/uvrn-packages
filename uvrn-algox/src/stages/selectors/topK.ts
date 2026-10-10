import { Context, Stage } from '../../types';
import { pushWarning } from '../../pipeline';
import { readNumericField } from '../../util/readNumericField';

export interface TopKOptions {
  /** How many candidates to keep. */
  k: number;
}

// Sort by score (desc) and keep the top K. The rest move to `dropped`.
export function topK({ k }: TopKOptions): Stage {
  const resolvedK = sanitizeCount(k);

  return {
    name: 'topK',
    run(ctx: Context) {
      if (resolvedK !== k) {
        pushWarning(ctx, 'topK', 'invalid_k', String(k));
      }

      const sorted = [...ctx.candidates].sort((a, b) => readNumericField(b, 'score') - readNumericField(a, 'score'));
      ctx.selected = sorted.slice(0, resolvedK);
      ctx.candidates = ctx.selected;
      for (const c of sorted.slice(resolvedK)) {
        c.reason = c.reason ?? 'below_topk';
        ctx.dropped.push(c);
      }
      if (ctx.selected.length < resolvedK) {
        pushWarning(ctx, 'topK', 'insufficient_candidates', `${ctx.selected.length}/${resolvedK}`);
      }
    },
  };
}

function sanitizeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}
