/**
 * Master receipt types describe the additive envelope that aggregates a base DeltaReceipt.
 * The base receipt remains unchanged and independently verifiable; this envelope records measurements and node status.
 */

import type { DeltaReceipt } from './index';
import type { MeasurementResult, NodeStatus } from './measurement';

/**
 * NodeStatusRecord records one participating source or node and whether it was available.
 * Off and unavailable states are preserved as receipt facts instead of being hidden.
 */
export interface NodeStatusRecord {
  /** Stable source or node identifier. */
  id: string;
  /** Reachability status observed for this source or node. */
  status: NodeStatus;
  /** Optional plain-language reason such as timeout or auth failure. */
  detail?: string;
  /** Optional ISO timestamp for when the status was observed. */
  observedAt?: string;
}

/**
 * MasterReceipt is an additive receipt envelope over an existing DeltaReceipt.
 * It collects measurement results and node status while preserving the base receipt's original hash.
 */
export interface MasterReceipt {
  /** Hashed-shape version for the master envelope. */
  envelopeVersion: number;
  /** Claim or claim identifier represented by the master receipt. */
  claim: string;
  /** Existing base receipt, unchanged and independently verifiable. */
  base: DeltaReceipt;
  /** Measurement results that ran for this claim. */
  measurements: MeasurementResult[];
  /** Full source or node roster including off and unavailable entries. */
  nodes: NodeStatusRecord[];
  /** ISO timestamp for the master envelope. */
  ts: string;
  /** SHA-256 hash of the canonical master envelope payload. */
  masterHash: string;
}

/**
 * BuildMasterReceiptArgs are the caller-supplied facts used to create a MasterReceipt.
 * Core records these facts but does not fetch nodes, run measurements, or decide health.
 */
export interface BuildMasterReceiptArgs {
  /** Existing base receipt to wrap. */
  base: DeltaReceipt;
  /** Measurement results to include in the master envelope. */
  measurements: MeasurementResult[];
  /** Node status records to include in the master envelope. */
  nodes: NodeStatusRecord[];
  /** Optional claim string; defaults to the base bundle id when omitted. */
  claim?: string;
  /** Optional ISO timestamp; defaults to the current time when omitted. */
  timestamp?: string;
}

/**
 * VerifyMasterReceiptResult reports whether the base receipt and master envelope hash both verify.
 * `verified` is true only when the untouched base receipt and additive master hash are valid.
 */
export interface VerifyMasterReceiptResult {
  /** True only when `baseVerified` and `masterHashOk` are both true. */
  verified: boolean;
  /** Result of delegating to the existing `verifyReceipt(base)` path. */
  baseVerified: boolean;
  /** Result of recomputing the additive master envelope hash. */
  masterHashOk: boolean;
  /** Optional failure reason. */
  error?: string;
}
