import { Context, ScoredCandidate, Stage } from '../../types';

export type KeyFn = (c: ScoredCandidate) => string | undefined;
export type DedupPreferFn = (candidate: ScoredCandidate, existing: ScoredCandidate) => number;

export interface DedupByKeyOptions {
  prefer?: DedupPreferFn;
}

// Keep one candidate per key. With `prefer`, stronger duplicates can replace
// earlier weaker entries; without it this remains first-wins.
export function dedupByKey(keyFn: KeyFn, options: DedupByKeyOptions = {}): Stage {
  return {
    name: 'dedupByKey',
    run(ctx: Context) {
      const seen = new Map<string, ScoredCandidate>();
      const kept: ScoredCandidate[] = [];
      for (const c of ctx.candidates) {
        const key = keyFn(c);
        if (key === undefined) {
          kept.push(c);
          continue;
        }
        const existing = seen.get(key);
        if (existing) {
          const shouldReplace = options.prefer ? options.prefer(c, existing) > 0 : false;

          if (shouldReplace) {
            existing.reason = 'duplicate';
            ctx.dropped.push(existing);
            const existingIndex = kept.indexOf(existing);
            if (existingIndex >= 0) {
              kept[existingIndex] = c;
            }
            seen.set(key, c);
            continue;
          }

          c.reason = 'duplicate';
          ctx.dropped.push(c);
        } else {
          seen.set(key, c);
          kept.push(c);
        }
      }
      ctx.candidates = kept;
    },
  };
}
