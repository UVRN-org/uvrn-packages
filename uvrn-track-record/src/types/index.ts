/**
 * Per-origin track-record types — mirror frozen STORE-D1-API.md Track records section.
 * These measure observed transcription and forecast resolution. They are never honesty
 * verdicts and must never enter a hashed receipt.
 */

/** Aggregate reliability observation for one origin. Never enters a hashed receipt. */
export type OriginTrackRecord = {
  originId: string;
  updatedAt: string; // ISO
  transcription: {
    samples: number;
    faithful: number;
    /** faithful/samples when samples>0; else null */
    fidelity: number | null;
  };
  revisions: {
    count: number;
    lastRevisionAt?: string; // ISO
  };
  forecasts: {
    resolved: number;
    /** Mean Brier score over resolved forecasts; null if none */
    meanBrier: number | null;
  };
  /**
   * Multi-class forecasts scored with the multi-category Brier rule (range [0,2]).
   * Kept separate from `forecasts` so binary meanBrier keeps its [0,1] meaning.
   */
  forecastsMulti?: {
    resolved: number;
    meanBrier: number | null;
  };
  /** Every logged output, including refusals — the denominator for an honest record. */
  forecastLog?: {
    logged: number;
    refused: number;
  };
  /** Optional opaque notes for operators — observation language only, never verdicts */
  notes?: string;
};

export type TranscriptionSample = {
  originId: string;
  sampleId: string; // idempotency key
  observedAt: string; // ISO
  /** Arithmetic: restatement matches origin figure */
  faithful: boolean;
  originValue: number;
  restatedValue: number;
  claimId?: string;
};

export type RevisionEvent = {
  originId: string;
  revisionId: string; // idempotency key
  observedAt: string; // ISO
  /** PROV wasRevisionOf target / prior figure id when known */
  priorId?: string;
  claimId?: string;
};

export type ForecastResolution = {
  originId: string;
  forecastId: string; // idempotency key
  /** Period end (appliesTo) that must have elapsed before resolve */
  appliesToEnd: string; // ISO
  resolvedAt: string; // ISO
  /** Forecast probability channel used for Brier — package-defined */
  forecastP: number; // [0,1]
  outcome: 0 | 1;
  /** Proper scoring rule result; Brier = (forecastP - outcome)^2 */
  brier: number;
  scoringRule: 'brier';
  claimId?: string;
};

/**
 * Multi-class forecast resolution. Brier = Σ_k (forecastP[k] − o_k)², range [0,2].
 * forecastP is aligned with classes and sums to 1.
 */
export type MultiForecastResolution = {
  originId: string;
  forecastId: string; // idempotency key
  appliesToEnd: string; // ISO
  resolvedAt: string; // ISO
  classes: string[];
  forecastP: number[];
  /** Index into classes of the class that occurred */
  outcomeIndex: number;
  brier: number;
  scoringRule: 'brier-multi';
  claimId?: string;
};

export type StoredForecastResolution = ForecastResolution | MultiForecastResolution;

/**
 * One forecast output as produced — logged before resolution, refusals included.
 * A record that only logs the outputs it likes is not a track record.
 */
export type ForecastLogEntry = {
  originId: string;
  forecastId: string; // idempotency key
  /** Output timestamp (the forecast's as-of), zoned ISO */
  loggedAt: string;
  /** Producer-defined method label, e.g. 'market' | 'baserate' | 'insufficient_basis' */
  method: string;
  refused: boolean;
  refusalCodes?: string[];
  /** Binary probability; null when refused or when a distribution is given */
  forecastP: number | null;
  classes?: string[];
  forecastDistribution?: number[];
  /** Hash of the declared outcome being forecast (e.g. uvrn-outcome-1 outcomeHash) */
  outcomeHash?: string;
  receiptHash?: string;
  claimId?: string;
};

/** Equal-width reliability bin over forecast probability. */
export type ReliabilityBin = {
  lower: number;
  upper: number;
  count: number;
  /** Mean forecast probability in the bin; null when empty */
  meanForecast: number | null;
  /** Observed event frequency in the bin; null when empty */
  observedFrequency: number | null;
};

/**
 * Pluggable persistence seam for per-origin track records.
 *
 * Implementations: InMemoryTrackRecordStore (offline default), SqliteTrackRecordStore,
 * D1ClientTrackRecordStore (worker API). Signers live in IdentityStore — do not reuse it.
 */
export interface TrackRecordStore {
  getRecord(originId: string): Promise<OriginTrackRecord | null>;
  putRecord(record: OriginTrackRecord): Promise<void>;
  listRecords(limit?: number): Promise<OriginTrackRecord[]>;
  addTranscription(sample: TranscriptionSample): Promise<void>;
  addRevision(event: RevisionEvent): Promise<void>;
  /**
   * Persist a forecast resolution. Implementations MUST reject when
   * `resolvedAt` is before `appliesToEnd` (unresolved period).
   */
  addForecastResolution(resolution: ForecastResolution): Promise<void>;
  /**
   * Derived learned credibility in [0,1] from stored aggregates, or null when
   * there is insufficient observation. Never a honesty verdict.
   */
  getLearnedCredibility(originId: string): Promise<number | null>;
  /**
   * Optional: append one produced output, refusals included. Idempotent on forecastId.
   * Implementations MUST reject entries that fail validateForecastLogEntry.
   */
  logForecast?(entry: ForecastLogEntry): Promise<void>;
  /** Optional: logged outputs for an origin, ordered by loggedAt then forecastId. */
  listForecastLog?(originId: string, limit?: number): Promise<ForecastLogEntry[]>;
  /**
   * Optional: persist a multi-class resolution. Same unresolved-period rule as
   * addForecastResolution.
   */
  addMultiForecastResolution?(resolution: MultiForecastResolution): Promise<void>;
  /**
   * Optional: stored per-forecast resolutions (binary and multi) for reliability bins,
   * ordered by resolvedAt then forecastId.
   */
  listForecastResolutions?(originId: string, limit?: number): Promise<StoredForecastResolution[]>;
}
