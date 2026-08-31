/**
 * PatternObservation v0 — statistical observation over history.
 * Not receipt-class: never hashed/signed like NetworkReceipt / MasterReceipt.
 * Detected ≠ verified ≠ true.
 */

export type FalsePositiveStance = 'disclosed-inherent';

export type PatternWindow = {
  from: string;
  to: string;
};

export type PatternObservation = {
  id: string;
  kind: string;
  summary: string;
  subjectRefs: string[];
  window: PatternWindow;
  method: string;
  /** Always disclose calibration state (v0: uncalibrated). */
  confidenceNote: string;
  /** What was aggregated — privacy / join disclosure hook. Required. */
  joinScope: string;
  falsePositiveStance: FalsePositiveStance;
};

/** Normalized history row for detectors — host maps store APIs into this shape. */
export type HistoryEvent = {
  id: string;
  /** Claim id, origin id, or other subject key used for aggregation. */
  subjectRef: string;
  observedAt: string;
  originId?: string;
  claimId?: string;
  kind?: string;
  value?: number;
};

export type ScanScope = {
  /** Required — refuse unbound / silent global scans. */
  joinScope: string;
  window: PatternWindow;
  /** Optional filter; when set, only these subjectRefs are considered. */
  subjectRefs?: string[];
};

/**
 * Load-bearing bet (suite): v0 batch/read over existing store history APIs —
 * no new cross-claim index. Hosts inject a HistoryReader that wraps list()/listRecords()/etc.
 * If the read cannot answer even a trivial scoped batch → measured-gap (escalate).
 */
export type HistoryReadOk = {
  ok: true;
  events: HistoryEvent[];
};

export type HistoryReadGap = {
  ok: false;
  reason: 'measured-gap';
  message: string;
};

export type HistoryReadResult = HistoryReadOk | HistoryReadGap;

export interface HistoryReader {
  readBatch(scope: ScanScope): Promise<HistoryReadResult>;
}

export interface Detector {
  readonly id: string;
  readonly version: string;
  detect(events: HistoryEvent[], scope: ScanScope): PatternObservation[];
}

export type ScanResult =
  | {
      status: 'observations';
      observations: PatternObservation[];
      /** Honesty: never claim verified. */
      honesty: { detectedNotVerified: true; receiptClass: false };
    }
  | {
      status: 'insufficient';
      reason: string;
      observations: [];
      honesty: { detectedNotVerified: true; receiptClass: false };
    }
  | {
      status: 'measured-gap';
      message: string;
      escalate: true;
      observations: [];
      honesty: { detectedNotVerified: true; receiptClass: false };
    }
  | {
      status: 'refused';
      reason: string;
      observations: [];
      honesty: { detectedNotVerified: true; receiptClass: false };
    };
