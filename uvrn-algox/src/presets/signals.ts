// Default wiring: a sensible signal-ranking pipeline plus a one-call helper.
// Pipeline order:
//   dropMissing("label") → dedupByKey → freshnessFilter → weightedScorer
//   → capPerGroup → topK
// Scoring runs before capPerGroup so the strongest signal per source survives.

import {
  Candidate,
  RankedResult,
  ResolvedConfig,
  SignalConfig,
  Stage,
} from '../types';
import { pushWarning, runPipeline } from '../pipeline';
import { dropMissing } from '../stages/filters/dropMissing';
import { dedupByKey } from '../stages/filters/dedupByKey';
import { freshnessFilter } from '../stages/filters/freshnessFilter';
import { capPerGroup } from '../stages/filters/capPerGroup';
import { weightedScorer } from '../stages/scorers/weightedScorer';
import { topK } from '../stages/selectors/topK';
import { normalizeUrl, hostOf } from '../util/normalizeUrl';
import { readNumericField } from '../util/readNumericField';

const DEFAULTS = {
  topK: 10,
  capPerSource: 3,
  maxAgeDays: 30 as number | null,
  weights: { prominence: 1 } as Record<string, number>,
};

export function resolveConfig(config: SignalConfig = {}): ResolvedConfig {
  const details = resolveConfigDetails(config);
  return details.config;
}

function resolveConfigDetails(config: SignalConfig = {}): {
  config: ResolvedConfig;
  invalidNow: boolean;
  negativeWeights: string[];
} {
  const now = resolveNow(config.now);
  const weights = { ...DEFAULTS.weights, ...(config.weights ?? {}) };

  return {
    config: {
      topK: clampPositiveInteger(config.topK ?? DEFAULTS.topK),
      capPerSource: clampPositiveInteger(config.capPerSource ?? DEFAULTS.capPerSource),
      maxAgeDays:
        config.maxAgeDays === undefined ? DEFAULTS.maxAgeDays : config.maxAgeDays,
      weights,
      now: now.value,
    },
    invalidNow: now.invalid,
    negativeWeights: Object.entries(weights)
      .filter(([, value]) => value < 0)
      .map(([key]) => key),
  };
}

export function buildSignalStages(config: SignalConfig = {}): Stage[] {
  const details = resolveConfigDetails(config);
  const cfg = details.config;
  const stages: Stage[] = [
    {
      name: 'configValidation',
      run(ctx) {
        if (details.invalidNow) {
          pushWarning(ctx, 'resolveConfig', 'invalid_now', String(config.now));
        }
        if (config.topK !== undefined && cfg.topK !== config.topK) {
          pushWarning(ctx, 'resolveConfig', 'invalid_topk', String(config.topK));
        }
        if (config.capPerSource !== undefined && cfg.capPerSource !== config.capPerSource) {
          pushWarning(ctx, 'resolveConfig', 'invalid_cap_per_source', String(config.capPerSource));
        }
        for (const key of details.negativeWeights) {
          pushWarning(ctx, 'resolveConfig', 'negative_weight', key);
        }
      },
    },
    dropMissing('label'),
    dedupByKey(
      (c) => (c.url ? normalizeUrl(c.url) : c.label.trim().toLowerCase()),
      { prefer: (candidate, existing) => readNumericField(candidate, 'prominence') - readNumericField(existing, 'prominence') },
    ),
  ];
  if (cfg.maxAgeDays !== null) {
    stages.push(freshnessFilter({ maxAgeDays: cfg.maxAgeDays, now: cfg.now }));
  }
  stages.push(weightedScorer({ weights: cfg.weights }));
  stages.push(
    capPerGroup({ groupBy: (c) => c.source ?? hostOf(c.url) ?? c.label, cap: cfg.capPerSource }),
  );
  stages.push(topK({ k: cfg.topK }));
  return stages;
}

// One call: candidates in, ranked result out. This is what a dashboard uses.
export async function rankSignals(
  candidates: Candidate[],
  config: SignalConfig = {},
): Promise<RankedResult> {
  const cfg = resolveConfig(config);
  const stages = buildSignalStages(config);
  const ctx = await runPipeline({
    query: { candidates, config: cfg as unknown as Record<string, unknown> },
    stages,
  });
  return {
    ranked: ctx.selected ?? [],
    dropped: ctx.dropped,
    warnings: ctx.warnings,
    config: cfg,
  };
}

function resolveNow(value: string | Date | undefined): { value: string; invalid: boolean } {
  if (value === undefined) {
    return { value: new Date().toISOString(), invalid: false };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { value: new Date().toISOString(), invalid: true };
  }

  return { value: parsed.toISOString(), invalid: false };
}

function clampPositiveInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}
