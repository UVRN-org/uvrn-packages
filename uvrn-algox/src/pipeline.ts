// Orchestrator. Runs stages sequentially in array order; a stage may implement
// `enabled(ctx)` to opt out for a given run. Generalized from the Expanse
// pipeline (src/lib/expanse-pipeline/pipeline.js) but typed and domain-free.

import { Context, PipelineQuery, ScoredCandidate, Stage } from './types';

export function buildContext(query: PipelineQuery): Context {
  const candidates: ScoredCandidate[] = (query.candidates ?? []).map((c) => ({
    ...c,
    score: 0,
  }));
  return {
    candidates,
    dropped: [],
    selected: null,
    warnings: [],
    config: query.config ?? {},
    query,
  };
}

export function pushWarning(
  ctx: Context,
  stage: string,
  code: string,
  detail?: string,
): void {
  ctx.warnings.push({ stage, code, detail });
}

export async function runPipeline({
  query,
  stages,
}: {
  query: PipelineQuery;
  stages: Stage[];
}): Promise<Context> {
  const ctx = buildContext(query);
  for (const stage of stages) {
    if (typeof stage.enabled === 'function' && !stage.enabled(ctx)) continue;
    await stage.run(ctx);
  }
  return ctx;
}
