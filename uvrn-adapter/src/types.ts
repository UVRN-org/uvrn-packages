/**
 * DRVC3 Types for UVRN Adapter (v1.01)
 * Layer 2 envelope types that wrap Layer 1 DeltaReceipt
 *
 * v1.01 adds the `extensions` field for Layer 2 provenance data.
 */

import { DeltaReceipt } from '@uvrn/core';

/**
 * DRVC3 Integrity block - contains hash and signature data
 */
export interface DRVC3Integrity {
  hash_algorithm: 'sha256';
  hash: string;
  signature_method: 'eip191';
  signature: string;
  signer_address: string;
}

/**
 * DRVC3 Validation block - contains score and embedded checks
 */
export interface DRVC3Validation {
  v_score: number;
  checks: {
    delta_receipt: DeltaReceipt;
    [key: string]: unknown;
  };
}

/**
 * DRVC3 Resource block (optional) - describes the verified resource
 */
export interface DRVC3Resource {
  type?: string;
  url?: string;
  branch?: string;
  commit_hash?: string;
}

/**
 * Block state - "loose" means mutable/portable, "blocked" means canonized/permanent
 */
export type BlockState = 'loose' | 'blocked';

/**
 * Full DRVC3 Receipt Envelope
 * Wraps Layer 1 DeltaReceipt with protocol metadata and signatures
 */
export interface DRVC3Receipt {
  receipt_id: string;
  issuer: string;
  event: string;
  timestamp: string;
  description?: string;
  resource?: DRVC3Resource;
  integrity: DRVC3Integrity;
  validation: DRVC3Validation;
  block_state: BlockState;
  certificate: string;
  replay_instructions?: Record<string, unknown>;
  tags?: string[];
  /**
   * Layer 2 extension data — provenance, evidence, domain-specific metadata.
   * This field is NOT covered by the L1 integrity hash. It is envelope metadata
   * owned by the consumer chain (e.g., MarketChain source URLs, evidence links).
   */
  extensions?: Record<string, unknown>;
}

/**
 * Options for wrapping a DeltaReceipt in DRVC3 envelope
 */
export interface WrapOptions {
  /** Issuer identifier (e.g., "uvrn", "app.example.com") */
  issuer: string;
  /** Event type (e.g., "delta-reconciliation") */
  event: string;
  /** Block state - defaults to "loose" */
  blockState?: BlockState;
  /** DRVC3 certificate version - defaults to "DRVC3 v1.0" */
  certificate?: string;
  /** Optional description */
  description?: string;
  /** Optional resource metadata */
  resource?: DRVC3Resource;
  /** Optional replay instructions */
  replayInstructions?: Record<string, unknown>;
  /** Optional tags (e.g., ["#uvrn", "#receipt"]) */
  tags?: string[];
  /** Optional Layer 2 extension data (provenance, evidence, domain metadata) */
  extensions?: Record<string, unknown>;
}

/**
 * Validation result from schema validation
 */
export interface DRVC3ValidationResult {
  valid: boolean;
  errors?: string[];
}
