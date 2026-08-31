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
}
