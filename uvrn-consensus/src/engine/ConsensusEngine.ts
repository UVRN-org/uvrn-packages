import type { DeltaBundle } from '@uvrn/core';

import { buildBundleId, calculateAgreementScore, extractRankedSources } from './aggregation';
import { evaluateStanceMode } from './stance';
import { resolveWeights } from './weighting';
import type {
  ConsensusEngineOptions,
  ConsensusResult,
  ConsensusStats,
  DedupConfig,
  RankedSource,
  SourceWeights,
  StanceMode,
} from '../types';
import { ConsensusError } from '../types';

export class ConsensusEngine {
  readonly #sources;
  readonly #weights: SourceWeights;
  readonly #claim?: string;
  readonly #dedup?: DedupConfig;

  constructor(options: ConsensusEngineOptions) {
    this.#sources = options.sources;
    this.#weights = resolveWeights(options.weights);
    this.#claim = options.claim;
    this.#dedup = options.dedup;
  }

  buildBundle(claim?: string): DeltaBundle {
    const resolvedClaim = claim ?? this.#claim ?? this.#sources.claimId;
    const evidenceAxis = this.stanceMode().evidenceAxis;
    const rankedSources = this.#rankedSources(evidenceAxis);

    if (rankedSources.length < 2) {
      throw new ConsensusError(
        `ConsensusEngine requires at least 2 usable numeric sources after parsing and deduplication. Received ${rankedSources.length}.`
      );
    }

    const dataSpecs = rankedSources.map((source) => source.dataSpec);

    return {
      bundleId: buildBundleId(resolvedClaim, dataSpecs),
      claim: resolvedClaim,
      dataSpecs,
      thresholdPct: 0.1,
      maxRounds: 5,
    };
  }

  stats(): ConsensusStats {
    const mode = this.stanceMode();
    const rankedSources = this.#rankedSources(mode.evidenceAxis);
    const qualitySources =
      mode.evidenceAxis === 'stance'
        ? this.#rankedSources('prominence')
        : rankedSources;
    const sourceCount = rankedSources.length;
    const agreementScore = calculateAgreementScore(rankedSources);
    const coverageScore = qualitySources.length === 0 ? 0 : qualitySources[0].coverageScore;
    const recencyScore = qualitySources.length === 0
      ? 0
      : qualitySources.reduce((sum, source) => sum + source.recencyScore, 0) / qualitySources.length;
    const weightedConsensusScore = qualitySources.length === 0
      ? 0
      : qualitySources.reduce((sum, source) => sum + source.weightScore, 0) / qualitySources.length;

    return {
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
    };
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
  buildConsensusResult(claim?: string): ConsensusResult {
    const bundle = this.buildBundle(claim);
    const stats = this.stats();
    const prominenceParity = calculateAgreementScore(this.#rankedSources('prominence'));

    return {
      bundle,
      components: {
        completeness: stats.coverageScore,
        parity: prominenceParity,
        freshness: stats.recencyScore,
      },
      stats,
    };
  }

  /** Activation provenance is exposed separately so fallback results stay frozen. */
  stanceMode(): StanceMode {
    return evaluateStanceMode(this.#sources.sources);
  }

  #rankedSources(evidenceAxis: 'stance' | 'prominence'): RankedSource[] {
    return extractRankedSources(
      this.#sources,
      this.#weights,
      this.#dedup,
      evidenceAxis
    );
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
