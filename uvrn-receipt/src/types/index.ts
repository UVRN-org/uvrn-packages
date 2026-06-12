/**
 * NetworkReceipt envelope types per SPEC/uvrn-receipt-v1.md §3 and SPEC/uvrn-signing-v1.md.
 * This module is the one receipt shape every UVRN surface consumes; no surface defines its own.
 */

/**
 * ReceiptKind names what protocol object the envelope carries.
 * It supersedes the legacy registry `receiptType`; the open string form admits host kinds.
 */
export type ReceiptKind =
  | 'delta'
  | 'master'
  | 'drift'
  | 'canon'
  | 'parity'
  | 'analytics'
  | 'genesis'
  | (string & {});

/**
 * ClaimRef pairs a stable claim identifier with the human claim text.
 * The id is stable across receipts so the network can assemble claim timelines.
 */
export interface ClaimRef {
  /** Stable claim identifier (recommended: slug + 8-char sha256 suffix). */
  id: string;
  /** Human-readable claim text. */
  text: string;
}

/**
 * Topic is the structured form of the serialized `domain[/subject[/instrument]]` string.
 * Starter domains are controlled; unknown domains are accepted under `custom/`.
 */
export interface Topic {
  /** Top-level domain, e.g. `markets`, `products`, or `custom`. */
  domain: string;
  /** Optional second segment, e.g. `crypto`. */
  subject?: string;
  /** Optional third segment, e.g. `BTC` (case preserved by convention). */
  instrument?: string;
}

/**
 * NetworkReceiptLink declares a typed relationship from this receipt to another by hash.
 * Mirrors the registry `receipt_links` semantics.
 */
export interface NetworkReceiptLink {
  /** Target receipt hash in `sha256:<64 hex>` form. */
  hash: string;
  /** Relationship type. */
  rel: 'follows' | 'caused-by' | 'references' | 'part-of' | 'responds-to';
  /** Optional human label, ≤256 chars. */
  label?: string;
}

/**
 * SdkInfo identifies the producing SDK build for integrity cross-checks.
 */
export interface SdkInfo {
  name: string;
  version: string;
  integrityHash: string;
}

/**
 * ReceiptSignature is the producer signature envelope (`uvrn-sig-1`).
 * It signs the receipt hash and is itself never part of the hash.
 */
export interface ReceiptSignature {
  /** Signature algorithm; Ed25519 only in v1. */
  alg: 'ed25519';
  /** Opaque key reference a verifier can resolve to a public key. */
  publicKeyRef: string;
  /** Base64 of the 64-byte Ed25519 signature. */
  sig: string;
  /** Optional ISO timestamp; when present it is part of the signed payload. */
  signedAt?: string;
}

/**
 * NetworkReceipt is the additive envelope aligning protocol receipts with the network registry.
 * `payload` is the protocol object untouched; everything else is envelope metadata.
 */
export interface NetworkReceipt {
  /** Envelope schema version; hash contract per SPEC/uvrn-receipt-v1.md §2.4. */
  schemaVersion: 'uvrn-receipt-4';
  /** `sha256:<64 hex>` over the declared hash field list. */
  receiptHash: string;
  /** What protocol object the payload carries. */
  kind: ReceiptKind;
  /** Stable claim identity plus human text. */
  claim: ClaimRef;
  /** Producing system, e.g. `uvrn-sdk`. */
  source: string;
  /** Event name, e.g. `delta.consensus`. */
  action: string;
  /** ISO 8601 UTC time the underlying event occurred. */
  occurredAt: string;
  /** The protocol object, byte-for-byte (DeltaReceipt, MasterReceipt, AgentDriftReceipt, ...). */
  payload: Record<string, unknown>;
  /** Serialized topic string, e.g. `markets/crypto/BTC`. */
  topic?: string;
  /** Free-form cross-cutting labels. */
  tags?: string[];
  /** Plain-English synopsis, ≤500 chars; REQUIRED when kind='master'. */
  narrative?: string;
  /** Typed links to other receipts, ≤50. */
  links?: NetworkReceiptLink[];
  /** Named chain membership, ≤128 chars. */
  chainId?: string;
  /** Producing SDK identity. */
  sdk?: SdkInfo;
  /** Producer signature; additive, never hashed. */
  signature?: ReceiptSignature;
}

/**
 * VerdictTone is the presentation-layer tone for a measurement outcome (Layer D).
 * Protocol verdict names never change; tones map over them.
 */
export type VerdictTone = 'aligned' | 'split' | 'contradiction' | 'early-signal' | 'insufficient';

/**
 * HumanScoreCard carries the V-Score and its components with plain-language meanings.
 * Component values are absent when the producing surface did not supply them.
 */
export interface HumanScoreCard {
  vScore?: number;
  completeness?: number;
  parity?: number;
  freshness?: number;
  /** Plain meaning per component (SPEC vocabulary D4) — always present. */
  plainMeaning: {
    vScore: string;
    completeness: string;
    parity: string;
    freshness: string;
  };
}

/**
 * HumanSource is one evidence source row in the human view, including unavailable ones.
 */
export interface HumanSource {
  name: string;
  status: 'on' | 'off' | 'unavailable';
  /** Optional contribution note (e.g. the value or assertion the source supplied). */
  contribution?: string;
  plainNote: string;
}

/**
 * HumanMeasurement is one measurement row in the human view.
 */
export interface HumanMeasurement {
  type: string;
  verdict: string;
  confidence: number;
  plainExplanation: string;
  whyItMatters: string;
}

/**
 * HumanGap records missing evidence explicitly — recorded, not hidden.
 */
export interface HumanGap {
  what: string;
  plainNote: string;
}

/**
 * HumanProvenance summarizes integrity/signature state with honest vocabulary.
 */
export interface HumanProvenance {
  hash: string;
  /** True only when a producer signature envelope is present. */
  signed: boolean;
  signerRef?: string;
  registeredAt?: string;
  verifyUrl: string;
}

/**
 * HumanView is the structured, UI-agnostic human representation of a receipt.
 * Any renderer (React, CLI, plain HTML, PDF) can present it without protocol knowledge.
 */
export interface HumanView {
  headline: string;
  verdictLabel: string;
  verdictTone: VerdictTone;
  claim: string;
  scoreCard: HumanScoreCard;
  sources: HumanSource[];
  measurements: HumanMeasurement[];
  gaps: HumanGap[];
  provenance: HumanProvenance;
  howToVerify: string;
}
