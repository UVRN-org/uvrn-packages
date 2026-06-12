/**
 * MCP Server Type Definitions
 * Extends uvrn-core types with MCP-specific interfaces
 */

// Import core types for use in this file
import type {
  DeltaBundle,
  DeltaReceipt,
  DeltaRound,
  DataSpec,
  MetricPoint,
  ValidationResult,
  VerifyResult,
  Outcome,
  EngineOpts,
} from '@uvrn/core';
import type { DriftInputReceipt, DriftReceipt } from '@uvrn/drift';
import type { DriftSnapshot } from '@uvrn/drift';
import type { CompareOptions, CompareResult } from '@uvrn/compare';
import type { CanonReceipt, CanonSigner, CanonStore, QualificationResult } from '@uvrn/canon';
import type { FarmConnector } from '@uvrn/agent';
import type { IdentityStore } from '@uvrn/identity';
import type { ReputationScore } from '@uvrn/identity';
import type { MasterReceipt } from '@uvrn/core';
import type { HumanView, NetworkReceipt } from '@uvrn/receipt';

// Re-export core types for consumers of this module
export type {
  DeltaBundle,
  DeltaReceipt,
  DeltaRound,
  DataSpec,
  MetricPoint,
  ValidationResult,
  VerifyResult,
  Outcome,
  EngineOpts,
};

/**
 * MCP Tool Input/Output Types
 */

export interface RunEngineInput {
  bundle: DeltaBundle;
  options?: {
    timestamp?: string;
  };
}

export interface RunEngineOutput {
  receipt: DeltaReceipt;
  success: true;
}

export interface ValidateBundleInput {
  bundle: DeltaBundle;
}

export interface ValidateBundleOutput {
  valid: boolean;
  error?: string;
  details?: string;
}

export interface VerifyReceiptInput {
  receipt: DeltaReceipt;
}

export interface VerifyReceiptOutput {
  verified: boolean;
  recomputedHash?: string;
  error?: string;
  details?: string;
}

/**
 * ScoreDriftInput requires an already enriched drift receipt.
 * A raw DeltaReceipt is rejected because it lacks v_score and component fields.
 */
export interface ScoreDriftInput {
  receipt: DriftInputReceipt;
  asOf?: string;
  profile?: string;
}

/**
 * ScoreDriftOutput returns the drift envelope computed by @uvrn/drift.
 */
export interface ScoreDriftOutput {
  receipt: DriftReceipt;
}

/**
 * ScoredCompareReceipt is the minimum enriched receipt shape accepted by delta_compare.
 * Each receipt must carry a claim id and V-Score; raw DeltaReceipt values do not qualify.
 */
export type ScoredCompareReceipt = Record<string, unknown> & {
  claimId?: string;
  claim_id?: string;
  vScore?: number;
  v_score?: number;
};

/**
 * CompareReceiptsInput compares exactly two already scored claim receipts.
 */
export interface CompareReceiptsInput {
  receipts: ScoredCompareReceipt[];
  options?: CompareOptions;
}

/**
 * CompareReceiptsOutput returns @uvrn/compare's winner/loser and divergence summary.
 */
export interface CompareReceiptsOutput {
  result: CompareResult;
}

/**
 * VerifyIdentityInput looks up one signer address in the in-memory identity registry.
 */
export interface VerifyIdentityInput {
  address: string;
}

/**
 * VerifyIdentityOutput returns an in-memory reputation score when one is present.
 */
export interface VerifyIdentityOutput {
  reputation: ReputationScore | null;
}

/**
 * CanonQualifyInput assesses whether a drift snapshot qualifies for canon suggestion.
 * This is read-only and never canonizes or writes.
 */
export interface CanonQualifyInput {
  claimId: string;
  snapshot: DriftSnapshot;
}

/**
 * CanonQualifyOutput returns @uvrn/canon's read-only qualification result.
 */
export interface CanonQualifyOutput {
  result: QualificationResult;
}

/**
 * CanonGetInput reads one canon receipt by id from the configured first CanonStore.
 */
export interface CanonGetInput {
  canonId: string;
}

/**
 * CanonGetOutput returns a stored canon receipt or null when missing.
 */
export interface CanonGetOutput {
  receipt: CanonReceipt | null;
}

/**
 * HostSource is a single piece of evidence supplied by the calling agent (the "host").
 * If the host can search the web, it gathers sources and passes them in; UVRN then scores
 * that evidence directly instead of relying on a configured connector or mock data.
 */
export interface HostSource {
  url: string;
  title: string;
  snippet: string;
  publishedAt?: string;
  credibility?: number; // 0–1 source reliability
  evidenceScore?: number; // 0–100 host-derived trend-support score
}

/**
 * ScoreClaimInput asks MCP to score a claim. Evidence comes from one of three paths
 * (in precedence order): host-provided `sources`, a configured connector, or mock data.
 */
export interface ScoreClaimInput {
  claim: string;
  claimId?: string;
  label?: string;
  sources?: HostSource[]; // Optional host-provided evidence; skips connector fetch when present (≥2)
  topic?: string; // Optional topic, normalized via @uvrn/receipt normalizeTopic() onto the NetworkReceipt
}

/**
 * ScoreClaimOutput returns the master receipt, the canonical V-Score, and provenance metadata,
 * plus the v4 additions: the signed NetworkReceipt envelope and its UI-agnostic HumanView.
 */
export interface ScoreClaimOutput {
  masterReceipt: MasterReceipt;
  v_score: number; // Canonical V-Score via @uvrn/score ScoreBreakdown
  claimId: string; // Echoed from input or derived slug
  evidenceMode: 'host_sources' | 'connector' | 'mock'; // Which evidence path was taken
  sourceCount: number; // Number of sources actually scored, after numeric extraction and deduplication
  networkReceipt: NetworkReceipt; // Signed uvrn-receipt-4 envelope wrapping the MasterReceipt
  humanView: HumanView; // toHumanView(networkReceipt) — render-ready, protocol-free
  /**
   * Ephemeral mode only: the base64 raw Ed25519 public key matching the run's ephemeral
   * signature, so callers can verifyReceiptFull(networkReceipt, { publicKey }). Honest
   * vocabulary: an ephemeral signature proves integrity + origin-of-this-process only — it is
   * not a durable identity. Absent when explicit signing keys are configured.
   */
  signerPublicKey?: string;
}

/**
 * MCP Resource Types
 */

export interface ResourceUriParams {
  uvrn?: string;
  id?: string;
}

/**
 * MCP Error Types
 */

export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class ValidationError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class ExecutionError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'EXECUTION_ERROR', details);
    this.name = 'ExecutionError';
  }
}

export class ResourceNotFoundError extends MCPError {
  constructor(resourceId: string) {
    super(`Resource not found: ${resourceId}`, 'RESOURCE_NOT_FOUND', { resourceId });
    this.name = 'ResourceNotFoundError';
  }
}

/**
 * Configuration Types
 */

export interface ServerConfig {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  storagePath?: string;
  maxBundleSize?: number;
  verboseErrors?: boolean;
}

/**
 * RuntimeConfig is the injected configuration surface for MCP stateful capabilities.
 * Hosts supply stores, signers, and connectors here; omitted values resolve to zero-external defaults lazily.
 */
export interface RuntimeConfig extends ServerConfig {
  /** Canon stores used by read-only canon tools and future canon workflows. */
  canonStores?: CanonStore[];
  /** Canon signer used when a future workflow needs signing; omitted values use a lazy MockSigner default. */
  canonSigner?: CanonSigner;
  /** Identity store used by identity tools; omitted values use a lazy MockIdentityStore default. */
  identityStore?: IdentityStore;
  /** Farm connectors used by live claim scoring; no provider connector is hardcoded as a default. */
  connectors?: FarmConnector[];
  /**
   * Receipt signing for delta_score_claim NetworkReceipts. Default `'ephemeral'`: one fresh
   * Ed25519 keypair is generated per handler construction (publicKeyRef `uvrn-mcp-ephemeral`)
   * and the public key is returned in each tool result as `signerPublicKey`. With explicit
   * keys, those are used and no key material is ever emitted in results.
   */
  signing?: { privateKey: string; publicKeyRef: string } | 'ephemeral';
}

/**
 * ToolHandlers is the handler bundle created by `buildHandlers`.
 * The server calls this bundle instead of importing module-global handler singletons.
 */
export interface ToolHandlers {
  handleRunEngine(input: RunEngineInput): Promise<RunEngineOutput>;
  handleValidateBundle(input: ValidateBundleInput): Promise<ValidateBundleOutput>;
  handleVerifyReceipt(input: VerifyReceiptInput): Promise<VerifyReceiptOutput>;
  handleScoreDrift(input: ScoreDriftInput): Promise<ScoreDriftOutput>;
  handleCompare(input: CompareReceiptsInput): Promise<CompareReceiptsOutput>;
  handleVerifyIdentity(input: VerifyIdentityInput): Promise<VerifyIdentityOutput>;
  handleCanonQualify(input: CanonQualifyInput): Promise<CanonQualifyOutput>;
  handleCanonGet(input: CanonGetInput): Promise<CanonGetOutput>;
  handleScoreClaim(input: ScoreClaimInput): Promise<ScoreClaimOutput>;
}
