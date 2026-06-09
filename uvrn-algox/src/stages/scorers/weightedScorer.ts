import { Context, Stage } from '../../types';
import { readNumericField } from '../../util/readNumericField';

export interface WeightedScorerOptions {
  /** Weight per signal name. score = Σ weightᵢ × signalᵢ. */
  weights: Record<string, number>;
}

// Core ranking power: blend several signals into one score with tunable weights.
export function weightedScorer({ weights }: WeightedScorerOptions): Stage {
  const entries = Object.entries(weights);
  return {
    name: 'weightedScorer',
    run(ctx: Context) {
      for (const c of ctx.candidates) {
        let score = 0;
        for (const [key, w] of entries) {
          if (!Number.isFinite(w)) continue;
          score += w * readNumericField(c, key);
        }
        c.score = score;
      }
    },
  };
}
