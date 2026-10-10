// Rank-stability report over alternative weightings.
// Reports ordering stability only — not verification, accuracy, or market outcome.

import { Candidate, RankedResult, ResolvedConfig, SignalConfig } from '../types';
import { rankSignals } from './signals';

/** Honest status vocabulary: ordering stability only. */
export type RankStabilityStatus = 'survive' | 'reorder';

/** A named weight variant to compare against the baseline ranking. */
export interface RankStabilityVariant {
  /** Stable name for this variant in the report. */
  name: string;
  /** Weight map passed to `rankSignals` for this variant. */
  weights: Record<string, number>;
}

/**
 * Implementer PREP proposal (N = 3) — not product law.
 * Used when callers omit `variants`.
 */
export const DEFAULT_RANK_STABILITY_VARIANTS: readonly RankStabilityVariant[] = [
  { name: 'mentions-only', weights: { mentions: 1 } },
  { name: 'prominence-mentions-balanced', weights: { prominence: 1, mentions: 1 } },
  { name: 'mentions-dominant', weights: { prominence: 0.25, mentions: 1 } },
];

/** Options for `reportRankStability`. */
export interface RankStabilityOptions {
  /**
   * Baseline `rankSignals` config. Default weights are `{ prominence: 1 }`.
   * Shared non-weight knobs (`now`, `topK`, `capPerSource`, `maxAgeDays`) apply
   * to every variant unless a field is overridden here only for baseline.
   */
  baseline?: SignalConfig;
  /** Declared weight variants. Defaults to `DEFAULT_RANK_STABILITY_VARIANTS`. */
  variants?: readonly RankStabilityVariant[];
}

/** One baseline-ranked identity and whether its rank held across variants. */
export interface RankStabilityEntry {
  /** Candidate identity: `id` if present, else normalized label. */
  identity: string;
  /** Label from the baseline ranking. */
  label: string;
  /** 1-based rank in the baseline ranking. */
  baselineRank: number;
  /** `survive` iff the identity keeps the same 1-based rank in every variant. */
  status: RankStabilityStatus;
  /** 1-based rank per variant name, or `null` if the identity is absent there. */
  variantRanks: Record<string, number | null>;
}

/** Full stability report: baseline, per-variant rankings, survive/reorder rows. */
export interface RankStabilityReport {
  baseline: {
    config: ResolvedConfig;
    rankedLabels: string[];
    ranked: RankedResult['ranked'];
  };
  variants: Array<{
    name: string;
    weights: Record<string, number>;
    config: ResolvedConfig;
    rankedLabels: string[];
    ranked: RankedResult['ranked'];
  }>;
  /** One row per baseline-ranked identity, in baseline rank order. */
  report: RankStabilityEntry[];
}

/**
 * Rank a fixed candidate set under a baseline weighting and declared variants,
 * then report which baseline ranks **survive** (same 1-based index in every
 * variant) and which **reorder**.
 *
 * This describes ordering stability under re-weight — not verification,
 * factual correctness, or market outcome.
 */
export async function reportRankStability(
  candidates: Candidate[],
  options: RankStabilityOptions = {},
): Promise<RankStabilityReport> {
  const baselineConfig: SignalConfig = { ...(options.baseline ?? {}) };
  if (baselineConfig.weights === undefined) {
    baselineConfig.weights = { prominence: 1 };
  }

  const variants = options.variants ?? DEFAULT_RANK_STABILITY_VARIANTS;
  const shared = sharedNonWeightConfig(baselineConfig);

  const baselineResult = await rankSignals(candidates, baselineConfig);
  const variantResults: RankStabilityReport['variants'] = [];

  for (const variant of variants) {
    const result = await rankSignals(candidates, {
      ...shared,
      weights: variant.weights,
    });
    variantResults.push({
      name: variant.name,
      weights: { ...variant.weights },
      config: result.config,
      rankedLabels: result.ranked.map((c) => c.label),
      ranked: result.ranked,
    });
  }

  const report: RankStabilityEntry[] = baselineResult.ranked.map((candidate, index) => {
    const baselineRank = index + 1;
    const identity = candidateIdentity(candidate);
    const variantRanks: Record<string, number | null> = {};
    let survive = true;

    for (const variant of variantResults) {
      const variantIndex = variant.ranked.findIndex(
        (c) => candidateIdentity(c) === identity,
      );
      const variantRank = variantIndex === -1 ? null : variantIndex + 1;
      variantRanks[variant.name] = variantRank;
      if (variantRank !== baselineRank) {
        survive = false;
      }
    }

    return {
      identity,
      label: candidate.label,
      baselineRank,
      status: survive ? 'survive' : 'reorder',
      variantRanks,
    };
  });

  return {
    baseline: {
      config: baselineResult.config,
      rankedLabels: baselineResult.ranked.map((c) => c.label),
      ranked: baselineResult.ranked,
    },
    variants: variantResults,
    report,
  };
}

function sharedNonWeightConfig(baseline: SignalConfig): SignalConfig {
  const shared: SignalConfig = {};
  if (baseline.topK !== undefined) shared.topK = baseline.topK;
  if (baseline.capPerSource !== undefined) shared.capPerSource = baseline.capPerSource;
  if (baseline.maxAgeDays !== undefined) shared.maxAgeDays = baseline.maxAgeDays;
  if (baseline.now !== undefined) shared.now = baseline.now;
  return shared;
}

/** Identity key: prefer `id`, else normalized label. */
export function candidateIdentity(candidate: Candidate): string {
  if (typeof candidate.id === 'string' && candidate.id.length > 0) {
    return candidate.id;
  }
  return candidate.label.trim().toLowerCase();
}
