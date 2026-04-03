import type { DeltaBundle } from '@uvrn/core';

import { buildBundleId, calculateAgreementScore, extractRankedSources } from './aggregation';
import { resolveWeights } from './weighting';
import type { ConsensusEngineOptions, ConsensusStats, RankedSource, SourceWeights } from '../types';
import { ConsensusError } from '../types';

export class ConsensusEngine {
  readonly #sources;
  readonly #weights: SourceWeights;
  readonly #claim?: string;

  constructor(options: ConsensusEngineOptions) {
    this.#sources = options.sources;
    this.#weights = resolveWeights(options.weights);
    this.#claim = options.claim;
  }

  buildBundle(claim?: string): DeltaBundle {
    const resolvedClaim = claim ?? this.#claim ?? this.#sources.claimId;
    const rankedSources = this.#rankedSources();

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
    const rankedSources = this.#rankedSources();
    const sourceCount = rankedSources.length;
    const agreementScore = calculateAgreementScore(rankedSources);
    const coverageScore = sourceCount === 0 ? 0 : rankedSources[0].coverageScore;
    const recencyScore = sourceCount === 0
      ? 0
      : rankedSources.reduce((sum, source) => sum + source.recencyScore, 0) / sourceCount;
    const weightedConsensusScore = sourceCount === 0
      ? 0
      : rankedSources.reduce((sum, source) => sum + source.weightScore, 0) / sourceCount;

    return {
      sourceCount,
      agreementScore,
      coverageScore,
      recencyScore,
      weightedConsensusScore,
      summary: this.#summary(
        sourceCount,
        agreementScore,
        coverageScore,
        recencyScore,
        weightedConsensusScore
      ),
    };
  }

  #rankedSources(): RankedSource[] {
    return extractRankedSources(this.#sources, this.#weights);
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
