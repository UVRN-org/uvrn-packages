import { Context, ScoredCandidate, Stage } from '../../types';
import { pushWarning } from '../../pipeline';

export interface FreshnessOptions {
  /** Candidate field holding an ISO date. Default "observedAt". */
  field?: string;
  /** Drop candidates older than this many days. */
  maxAgeDays: number;
  /** Reference "now"; defaults to the current time. */
  now?: string | Date;
}

// Drop stale signals. Candidates with a missing or unparseable date are kept
// (and warned about) rather than silently discarded.
export function freshnessFilter({
  field = 'observedAt',
  maxAgeDays,
  now,
}: FreshnessOptions): Stage {
  return {
    name: 'freshnessFilter',
    run(ctx: Context) {
      const ref = now ? new Date(now).getTime() : Date.now();
      const maxMs = maxAgeDays * 24 * 60 * 60 * 1000;
      const kept: ScoredCandidate[] = [];
      for (const c of ctx.candidates) {
        const raw = (c as Record<string, unknown>)[field];
        if (raw === undefined || raw === null) {
          kept.push(c);
          continue;
        }
        const t = new Date(raw as string).getTime();
        if (Number.isNaN(t)) {
          pushWarning(ctx, 'freshnessFilter', 'unparseable_date', c.id ?? c.label);
          kept.push(c);
          continue;
        }
        if (ref - t > maxMs) {
          c.reason = 'stale';
          ctx.dropped.push(c);
        } else {
          kept.push(c);
        }
      }
      ctx.candidates = kept;
    },
  };
}
