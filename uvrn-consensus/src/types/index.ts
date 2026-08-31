import type {
  FarmResult as AgentFarmResult,
  FarmSource as AgentFarmSource,
} from '@uvrn/agent';

export type { DeltaBundle, DataSpec, MetricPoint } from '@uvrn/core';

export type StanceLabel =
  | 'supports'
  | 'opposes'
  | 'mixed'
  | 'neutral'
  | 'insufficient';

/** Host-declared W3C PROV relations (codes only — never inferred). */
export interface HostProvRelations {
  wasDerivedFrom?: string;
  hadPrimarySource?: string;
  wasQuotedFrom?: string;
  wasRevisionOf?: string;
  wasAttributedTo?: string;
}

export interface FarmSource extends AgentFarmSource {
  stanceValue?: number;
  stanceLabel?: StanceLabel;
  stanceConfidence?: number;
  stanceEvidence?: string;
  /** Host-declared UCUM (or UCUM-compatible) unit. */
  unit?: string;
  quantityKind?: import('@uvrn/core').QuantityKind;
  measuredAt?: string;
  appliesTo?: string;
  obsStatus?: string;
  stake?: string;
  codeLists?: import('@uvrn/core').ObservationCodeLists;
  prov?: HostProvRelations;
  /** Optional explicit origin id; otherwise derived from host `prov` or the source URL. */
  originId?: string;
}

export interface FarmResult extends Omit<AgentFarmResult, 'sources'> {
  sources: FarmSource[];
}

export type StanceFallbackReason =
  | 'source-quorum-missed'
  | 'grounded-quorum-missed';

export interface StanceMode {
  evidenceAxis: 'stance' | 'prominence';
  sourceCount: number;
  groundedCount: number;
  requiredSources: 4;
  requiredGrounded: 3;
  confidenceFloor: 0.6;
  quorumMet: boolean;
  fallbackReason?: StanceFallbackReason;
}

export interface SourceWeights {
  credibility: number;
  recency: number;
  coverage: number;
}

/**
 * Configuration for near-identical source deduplication.
 *
 * Two sources are collapsed when their metric values are "near-identical" AND their
 * publication timestamps fall within the dedup time window. The defaults reproduce the
 * historical (v3) hardcoded behavior exactly: ±1% relative tolerance within 24 hours.
 *
 * Modes:
 * - `'relative'` (default): values match when |a−b| / max(|a|, |b|, 1) <= relativeTolerance
 * - `'absolute'`: values match when |a−b| <= relativeTolerance (the tolerance is read as an
 *   absolute delta in this mode)
 * - `'off'`: deduplication is disabled — every parsed source is retained
 */
export interface DedupConfig {
  /**
   * Value tolerance. In `'relative'` mode this is a ratio (default `0.01` = ±1%); in
   * `'absolute'` mode it is an absolute delta in the metric's own unit.
   */
  relativeTolerance?: number;
  /**
   * Maximum publication-time distance (ms) for two sources to be considered duplicates.
   * Default `86_400_000` (1 day).
   */
  timeWindowMs?: number;
  /** Dedup comparison mode. Default `'relative'`. */
  mode?: 'relative' | 'absolute' | 'off';
}

/** Where a prominence metric value came from. */
export type ValueSource = 'declared' | 'scraped' | 'none';

/** Whether a source timestamp was host-declared or substituted from fetch time. */
export type TimestampSource = 'declared' | 'inferred';

export interface ConsensusEngineOptions {
  sources: FarmResult;
  weights?: Partial<SourceWeights>;
  claim?: string;
  /**
   * Near-identical source deduplication thresholds. Omitting this (or any field) preserves
   * v3 behavior exactly: relative mode, ±1% tolerance, 1-day window.
   */
  dedup?: DedupConfig;
  /**
   * Opt-in learned credibility from per-origin track records (BP-23).
   * Default **false** — declared connector/transformer constants remain the weight input.
   * When true, `learnedCredibilityByOrigin[originId]` replaces the declared score for
   * weighting when present; both declared and learned scores are stamped on RankedSource.
   */
  useLearnedCredibility?: boolean;
  /**
   * Map of originId → learned credibility in [0,1] or 0–100.
   * Ignored unless `useLearnedCredibility` is true. Build via TrackRecordStore.getLearnedCredibility.
   */
  learnedCredibilityByOrigin?: Record<string, number>;
}

export interface ConsensusStats {
  sourceCount: number;
  /**
   * Median and range of the numeric metrics retained after deduplication.
   * These untyped values report what the retained sources landed on; they do
   * not establish that the underlying claim is true.
   */
  absoluteConsensusValue: AbsoluteConsensusValue;
  agreementScore: number;
  coverageScore: number;
  recencyScore: number;
  weightedConsensusScore: number;
  summary: string;
  /**
   * Present only when stance quorum activates. Omitting it on fallback keeps
   * the frozen prominence result byte-identical (D2 hard wall 4).
   */
  evidenceAxis?: 'stance';
  /**
   * Count of input sources that could not contribute a prominence value.
   * Additive; omitted from ConsensusEngine.stats() in this unit so frozen
   * ConsensusResult bytes stay identical — available via RankedSource stamps
   * and `extractRankedSourcesWithHonesty`.
   */
  unusableSourceCount?: number;
  /**
   * Count of input sources whose publication time was inferred (absent/invalid).
   * Additive; same exposure path as `unusableSourceCount`.
   */
  inferredTimestampCount?: number;
}

export interface AbsoluteConsensusValue {
  median: number | null;
  n: number;
  min: number | null;
  max: number | null;
}

export interface InsufficientIndependentSources {
  insufficientIndependentSources: {
    inputCount: number;
    usableCount: number;
    retainedCount: number;
    requiredCount: 2;
    shortfall: number;
    deduplicatedCount: number;
    reason: string;
  };
  absoluteConsensusValue: AbsoluteConsensusValue;
}

export type BundleBuildResult =
  | import('@uvrn/core').DeltaBundle
  | InsufficientIndependentSources;

export type ConsensusBuildResult =
  | ConsensusResult
  | InsufficientIndependentSources;

/**
 * Named V-Score input components derived from a consensus run.
 * These values are the bridge between @uvrn/consensus and @uvrn/score.
 *
 * Sibling coupling: @uvrn/score consumes these fields directly via
 * ScoreBreakdown({ completeness, parity, freshness }).
 *
 * Note: maps consensus source stats into V-Score inputs — does not convert
 * a DeltaReceipt from @uvrn/core into V-Score components.
 */
export interface ConsensusResult {
  /** DeltaBundle ready for @uvrn/core runDeltaEngine() */
  bundle: import('@uvrn/core').DeltaBundle;
  /** Named V-Score input components — pass directly to @uvrn/score ScoreBreakdown */
  components: {
    /** Source coverage: % of sources that yielded usable numeric values (0–100) */
    completeness: number;
    /** Parity (0–100): near-identical sources are deduped first, then parity = the largest retained numeric-value cluster after two-decimal normalization */
    parity: number;
    /** Recency: average recency score across ranked sources (0–100) */
    freshness: number;
  };
  /** Full stats for debugging/audit — superset of components */
  stats: ConsensusStats;
}

export interface RankedSource {
  dataSpec: import('@uvrn/core').DataSpec;
  weightScore: number;
  credibilityScore: number;
  recencyScore: number;
  coverageScore: number;
  metricValue: number;
  publishedAt: string;
  unit?: string;
  unitSource?: import('@uvrn/core').UnitSource;
  quantityKind?: import('@uvrn/core').QuantityKind;
  measuredAt?: string;
  appliesTo?: string;
  obsStatus?: string;
  stake?: string;
  /** Resolved origin identity (host PROV or self). Never from value-similarity. */
  originId: string;
  originalSource: FarmSource;
  /** How the metric value was obtained. */
  valueSource: ValueSource;
  /**
   * Whether measurement time was host-declared (`measuredAt`) or inferred.
   * Publish time alone does not make this `declared`.
   */
  timestampSource: TimestampSource;
  /**
   * Farm-wide count of sources with no usable prominence value.
   * Stamped identically on every ranked source (same pattern as coverageScore).
   */
  unusableSourceCount: number;
  /**
   * Farm-wide count of sources with absent/invalid measuredAt (and no usable
   * declared measurement time).
   */
  inferredTimestampCount: number;
  /** Sources excluded from the observation pool as forecasts (`obsStatus: F`). */
  excludedForecastCount: number;
  /** Document count sharing this origin beyond the first (restatement signal). */
  transcriptionCorroboration: number;
  /** Distinct origins in the observation pool (agreement denominator basis). */
  distinctOriginCount: number;
  /**
   * Declared credibility (connector/host) after normalizeCredibilityScore.
   * Present when `useLearnedCredibility` is on so callers can compare declared vs learned.
   */
  declaredCredibilityScore?: number;
  /**
   * Learned credibility observation used for weighting when opt-in is on.
   * Omitted when opt-in is off or no learned score exists for the origin.
   */
  learnedCredibilityScore?: number;
}

/** Full aggregation result including honesty counts when the ranked list is empty. */
export interface RankedSourcesResult {
  ranked: RankedSource[];
  unusableSourceCount: number;
  inferredTimestampCount: number;
  excludedForecastCount: number;
  /** Pre-dedup observation-pool size (documents). */
  observationSourceCount: number;
  distinctOriginCount: number;
  /** How many sources are restatements of a declared multi-doc origin. */
  transcriptionCorroboration: number;
  /**
   * Agreement over the pre-dedup observation pool by distinct origins.
   * Use this (not document-count over deduped ranked) for honest origin scoring.
   */
  originAgreementScore: number;
}

export class ConsensusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConsensusError';
  }
}
