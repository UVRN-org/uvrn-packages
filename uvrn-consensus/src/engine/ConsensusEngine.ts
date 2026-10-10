import type { DeltaBundle } from '@uvrn/core';

import {
  buildBundleId,
  extractRankedSourcesWithHonesty,
} from './aggregation';
import { evaluateStanceMode } from './stance';
import { resolveWeights } from './weighting';
import type {
  AbsoluteConsensusValue,
  BundleBuildResult,
  ConsensusBuildResult,
  ConsensusEngineOptions,
  ConsensusResult,
  ConsensusStats,
  DedupConfig,
  RankedSource,
  SourceWeights,
  StanceMode,
} from '../types';

export class ConsensusEngine {
  readonly #sources;
  readonly #weights: SourceWeights;
  readonly #claim?: string;
  readonly #dedup?: DedupConfig;
  readonly #useLearnedCredibility: boolean;
  readonly #learnedCredibilityByOrigin?: Record<string, number>;

  constructor(options: ConsensusEngineOptions) {
    this.#sources = options.sources;
    this.#weights = resolveWeights(options.weights);
    this.#claim = options.claim;
    this.#dedup = options.dedup;
    this.#useLearnedCredibility = options.useLearnedCredibility === true;
    this.#learnedCredibilityByOrigin = options.learnedCredibilityByOrigin;
  }

  buildBundle<T extends BundleBuildResult = DeltaBundle>(claim?: string): T {
    const resolvedClaim = claim ?? this.#claim ?? this.#sources.claimId;
    const evidenceAxis = this.stanceMode().evidenceAxis;
    const rankedSources = this.#rankedSources(evidenceAxis);

    if (rankedSources.length < 2) {
      return this.#insufficientSources(evidenceAxis, rankedSources) as T;
    }

    const dataSpecs = rankedSources.map((source) => source.dataSpec);

    return {
      bundleId: buildBundleId(resolvedClaim, dataSpecs),
      claim: resolvedClaim,
      dataSpecs,
      thresholdPct: 0.1,
      maxRounds: 5,
    } as T;
  }

  stats(): ConsensusStats {
    const mode = this.stanceMode();
    const honesty = this.#honesty(mode.evidenceAxis);
    const rankedSources = honesty.ranked;
    const qualityHonesty =
      mode.evidenceAxis === 'stance' ? this.#honesty('prominence') : honesty;
    const qualitySources = qualityHonesty.ranked;
    const sourceCount = rankedSources.length;
    // Pre-dedup origin agreement (SPEC §7.3) — not document-count over deduped ranked.
    const agreementScore = honesty.originAgreementScore;
    const coverageScore = qualitySources.length === 0 ? 0 : qualitySources[0].coverageScore;
    const recencyScore = qualitySources.length === 0
      ? 0
      : qualitySources.reduce((sum, source) => sum + source.recencyScore, 0) / qualitySources.length;
    const weightedConsensusScore = qualitySources.length === 0
      ? 0
      : qualitySources.reduce((sum, source) => sum + source.weightScore, 0) / qualitySources.length;

    const stats = {
      sourceCount,
      agreementScore,
      coverageScore,
      recencyScore,
      weightedConsensusScore,
      ...(mode.evidenceAxis === 'stance' ? { evidenceAxis: 'stance' as const } : {}),
      summary: this.#summary(
        sourceCount,
        agreementScore,
        coverageScore,
        recencyScore,
        weightedConsensusScore
      ),
    } as ConsensusStats;

    // Keep existing multi-source JSON bytes frozen while exposing the additive
    // statistic to typed callers. Producing surfaces can copy it onto their
    // unhashed output envelopes explicitly.
    Object.defineProperty(stats, 'absoluteConsensusValue', {
      value: this.#absoluteConsensusValue(rankedSources),
      enumerable: false,
      writable: false,
    });
    return stats;
  }

  /**
   * Build a DeltaBundle and derive named V-Score input components in one call.
   * Returns a ConsensusResult — the bridge between @uvrn/consensus and @uvrn/score.
   *
   * Usage:
   *   const engine = new ConsensusEngine({ sources, claim });
   *   const result = engine.buildConsensusResult();
   *   const bundle = result.bundle;          // → @uvrn/core runDeltaEngine(bundle)
   *   const breakdown = new ScoreBreakdown(result.components, profile); // → @uvrn/score
   */
  buildConsensusResult<T extends ConsensusBuildResult = ConsensusResult>(claim?: string): T {
    const bundle = this.buildBundle<BundleBuildResult>(claim);
    if ('insufficientIndependentSources' in bundle) {
      return bundle as T;
    }
    const stats = this.stats();
    const prominenceParity = this.#honesty('prominence').originAgreementScore;

    return {
      bundle,
      components: {
        completeness: stats.coverageScore,
        parity: prominenceParity,
        freshness: stats.recencyScore,
      },
      stats,
    } as T;
  }

  /** Activation provenance is exposed separately so fallback results stay frozen. */
  stanceMode(): StanceMode {
    return evaluateStanceMode(this.#sources.sources);
  }

  #honesty(
    evidenceAxis: 'stance' | 'prominence',
    dedup: DedupConfig | undefined = this.#dedup
  ) {
    return extractRankedSourcesWithHonesty(
      this.#sources,
      this.#weights,
      dedup,
      evidenceAxis,
      false,
      undefined,
      {
        useLearned: this.#useLearnedCredibility,
        byOrigin: this.#learnedCredibilityByOrigin,
      }
    );
  }

  #rankedSources(
    evidenceAxis: 'stance' | 'prominence',
    dedup: DedupConfig | undefined = this.#dedup
  ): RankedSource[] {
    return this.#honesty(evidenceAxis, dedup).ranked;
  }

  #absoluteConsensusValue(rankedSources: RankedSource[]): AbsoluteConsensusValue {
    const values = rankedSources.map((source) => source.metricValue).sort((a, b) => a - b);
    const n = values.length;
    if (n === 0) {
      return { median: null, n: 0, min: null, max: null };
    }
    const middle = Math.floor(n / 2);
    const median =
      n % 2 === 1
        ? values[middle]!
        : (values[middle - 1]! + values[middle]!) / 2;
    return {
      median,
      n,
      min: values[0]!,
      max: values[n - 1]!,
    };
  }

  #insufficientSources(
    evidenceAxis: 'stance' | 'prominence',
    retained: RankedSource[]
  ): import('../types').InsufficientIndependentSources {
    const usable = this.#rankedSources(evidenceAxis, { mode: 'off' });
    const inputCount = this.#sources.sources.length;
    const retainedCount = retained.length;
    const usableCount = usable.length;
    const deduplicatedCount = usableCount - retainedCount;
    const shortfall = 2 - retainedCount;
    const reason =
      usableCount < 2
        ? `Only ${usableCount} of ${inputCount} input sources contained a usable numeric measurement; ${shortfall} more independent source${shortfall === 1 ? '' : 's'} required.`
        : `${usableCount} usable measurements were found, but ${deduplicatedCount} near-identical source${deduplicatedCount === 1 ? ' was' : 's were'} removed, leaving ${retainedCount}; ${shortfall} more independent source${shortfall === 1 ? '' : 's'} required.`;
    return {
      insufficientIndependentSources: {
        inputCount,
        usableCount,
        retainedCount,
        requiredCount: 2,
        shortfall,
        deduplicatedCount,
        reason,
      },
      absoluteConsensusValue: this.#absoluteConsensusValue(retained),
    };
  }

  #summary(
    sourceCount: number,
    agreementScore: number,
    coverageScore: number,
    recencyScore: number,
    weightedConsensusScore: number
  ): string {
    if (sourceCount === 0) {
      return 'No usable numeric sources were available for consensus scoring.';
    }

    return `Consensus derived from ${sourceCount} usable sources with agreement ${agreementScore.toFixed(1)}, coverage ${coverageScore.toFixed(1)}, recency ${recencyScore.toFixed(1)}, and weighted consensus ${weightedConsensusScore.toFixed(1)}.`;
  }
}
