import { Context, ScoredCandidate, Stage } from '../../types';
import { pushWarning } from '../../pipeline';
import { readNumericField } from '../../util/readNumericField';

export interface CapPerGroupOptions {
  groupBy: (c: ScoredCandidate) => string;
  cap: number;
}

// Diversity / anti-domination knob: keep at most `cap` candidates per group,
// retaining the highest-scoring ones. Run AFTER scoring so the strongest in
// each group survive.
export function capPerGroup({ groupBy, cap }: CapPerGroupOptions): Stage {
  const resolvedCap = sanitizeCount(cap);

  return {
    name: 'capPerGroup',
    run(ctx: Context) {
      if (resolvedCap !== cap) {
        pushWarning(ctx, 'capPerGroup', 'invalid_cap', String(cap));
      }

      const counts = new Map<string, number>();
      const ordered = [...ctx.candidates].sort((a, b) => readNumericField(b, 'score') - readNumericField(a, 'score'));
      const kept: ScoredCandidate[] = [];
      for (const c of ordered) {
        const g = groupBy(c);
        const n = counts.get(g) ?? 0;
        if (n >= resolvedCap) {
          c.reason = 'group_cap_exceeded';
          ctx.dropped.push(c);
          pushWarning(ctx, 'capPerGroup', 'group_cap_exceeded', g);
        } else {
          counts.set(g, n + 1);
          kept.push(c);
        }
      }
      ctx.candidates = kept;
    },
  };
}

function sanitizeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}
