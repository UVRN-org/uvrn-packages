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
import type {
  AbsoluteConsensusValue,
  InsufficientIndependentSources,
} from '@uvrn/consensus';
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

/**
 * ValidateDatapointInput — easy-verify front desk for a DataPoint.
 * Distinct from `delta_validate_bundle` (bundles ≠ DataPoints).
 */
export interface ValidateDatapointInput {
  dataPoint: {
    id: string;
    kind: string;
    value: unknown;
    sourceRef?: string;
  };
  /** Explicit Stage2 gate. When omitted/false, measure is never called. */
  runStage2?: boolean;
  /** Optional claim text forwarded to measure when Stage2 runs. */
  claim?: string;
  /**
   * Host evidence for Stage2. When `runStage2` is true and fewer than 2 are
   * supplied → honest `insufficient-data` (no connector/mock fallback).
   */
  sources?: Array<{
    id?: string;
    url?: string;
    value?: number;
    assertion?: string;
    label?: string;
    title?: string;
    kind?: 'numeric' | 'categorical' | 'boolean' | 'range';
    ts?: string;
  }>;
}

/**
 * ValidateDatapointOutput mirrors `@uvrn/validate` — Stage1 tokens only
 * structurally-ok | malformed; Stage2 uses measure vocabulary; never `verified`.
 */
export interface ValidateDatapointOutput {
  stage: 1 | 2;
  stage1: 'structurally-ok' | 'malformed';
  reasons: string[];
  stage2?: {
    token: string;
    measurements?: Array<{
      type: string;
      verdict: string;
      confidence: number;
      explanation: string;
      evidenceRefs: string[];
    }>;
  };
}

export interface VerifyReceiptInput {
  receipt: DeltaReceipt;
}

/**
 * VerifyReceiptOutput reports the result of a hash recompute — integrity only.
 *
 * Honest vocabulary (SPEC/uvrn-signing-v1.md): recomputing a hash proves the receipt has
 * not been altered since it was produced. It proves nothing about who produced it. Full
 * verification — integrity AND a producer signature that checks out — is
 * `verifyReceiptFull()` in `@uvrn/receipt`, whose `FullVerifyResult` reports `integrityOk`
 * and `signatureOk` separately for exactly this reason. This output reuses that vocabulary.
 */
export interface VerifyReceiptOutput {
  /** True when the receipt's canonical payload rehashes to its recorded hash. */
  integrityOk: boolean;
  /**
   * @deprecated Misleading name retained for existing callers: this is the hash recompute
   * result, identical to `integrityOk`, not a signature check. Read `integrityOk`, and use
   * `verifyReceiptFull()` from `@uvrn/receipt` when you need real verification.
   */
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
  /** ISO — when the quantity was measured/observed. Drives freshness when declared. */
  measuredAt?: string;
  /** ISO — period/instant the value applies to. */
  appliesTo?: string;
  credibility?: number; // 0–1 source reliability
  /**
   * The measurement this source reports, in its own natural magnitude — a price, a ppm
   * reading, 299792458. Finite but uncapped: no rescaling into 0–100 is required or wanted.
   * When present it is the measurement, taking precedence over `evidenceScore`.
   */
  value?: number;
  /**
   * Host-declared UCUM (or UCUM-compatible) unit for `value`. When present it is
   * `unitSource: 'declared'` and participates in BP-20 comparability checks.
   * Text-inferred units never satisfy comparability.
   */
  unit?: string;
  quantityKind?: import('@uvrn/core').QuantityKind;
  /** SDMX CL_OBS_STATUS code. */
  obsStatus?: string;
  stake?: string;
  codeLists?: import('@uvrn/core').ObservationCodeLists;
  /** Host-declared W3C PROV relations — never inferred by UVRN. */
  prov?: {
    wasDerivedFrom?: string;
    hadPrimarySource?: string;
    wasQuotedFrom?: string;
    wasRevisionOf?: string;
    wasAttributedTo?: string;
  };
  originId?: string;
  evidenceScore?: number; // 0–100 host-derived trend-support score
  stanceValue?: number; // finite -1..1 explicit claim position
  stanceLabel?: 'supports' | 'opposes' | 'mixed' | 'neutral' | 'insufficient';
  stanceConfidence?: number; // finite 0..1
  stanceEvidence?: string;
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
  /**
   * Optional host-held expectation for the absolute consensus cluster.
   * Produces a non-authoritative divergence observation on the output envelope only.
   * Never enters outcome, v_score, deltaFinal, or any hashed receipt surface.
   */
  expectedValue?: number;
  /**
   * Optional host-supplied per-origin track-record observations (BP-23).
   * Envelope-only — never hashed. Observation language; not honesty verdicts.
   */
  trackRecordObservations?: Array<{
    originId: string;
    observation: string;
  }>;
}

/**
 * Observation-only note comparing a host-supplied expectation to the measured
 * absolute consensus cluster. Does not adjudicate which side is right.
 */
export interface ExpectedValueDivergenceNote {
  hostExpected: number;
  measuredCluster: number | null;
  absoluteDifference: number | null;
  /** Plain observation — never a verdict. */
  observation: string;
}

/**
 * Quorum state for the stance axis, carried through from `evaluateStanceMode()` in
 * `@uvrn/consensus` rather than recomputed, so the envelope and the receipt payload's
 * `stanceMode` can never disagree.
 */
export interface StanceQuorumNote {
  met: boolean;
  evidenceAxis: 'stance' | 'prominence';
  sourceCount: number;
  groundedCount: number;
  requiredSources: number;
  requiredGrounded: number;
  confidenceFloor: number;
  /** Present only when the quorum was missed. A reason, never a verdict on the sources. */
  reason?: 'source-quorum-missed' | 'grounded-quorum-missed';
}

/**
 * StanceCounts reports every stance label the sources carried, whether or not the stance
 * quorum was met. Envelope-only: it is never added to any hashed receipt payload.
 *
 * Distinct from the receipt payload's `stanceSummary`, which reports two labels (`support`
 * and `oppose`) and only when the quorum activates the stance axis. `stanceCounts` reports
 * all five labels on every stance-capable run, so a genuine disagreement below quorum is
 * visible instead of looking like nothing was found. The two coexist and mean different
 * things; neither replaces the other.
 */
export interface StanceCounts {
  supports: number;
  opposes: number;
  mixed: number;
  neutral: number;
  insufficient: number;
  /** Sources that carried no stance label at all — counted, not silently dropped. */
  unlabeled: number;
  quorum: StanceQuorumNote;
}

/**
 * Echo of a host-supplied measurement, at the magnitude and in the unit it arrived in.
 * Envelope-only and inert: `unit` is recorded and handed back, never interpreted.
 */
export interface HostMeasurementEcho {
  url: string;
  value: number;
  unit?: string;
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
  /** Untyped median and range from the retained post-dedup consensus metrics. */
  absoluteConsensusValue?: AbsoluteConsensusValue;
  /**
   * Present when fewer than two independent numeric sources survive.
   * No receipt is constructed for this outcome.
   */
  insufficientIndependentSources?:
    InsufficientIndependentSources['insufficientIndependentSources'];
  /**
   * All five stance labels plus quorum state, reported on every run. Envelope-only —
   * never hashed, and never a substitute for the payload's gated `stanceSummary`.
   */
  stanceCounts: StanceCounts;
  /**
   * Present only when at least one host source supplied `value`. Envelope-only echo of
   * those measurements and their units, unrescaled — never hashed.
   */
  hostMeasurements?: HostMeasurementEcho[];
  /**
   * Present only when the host supplied `expectedValue`. Envelope-only observation;
   * never hashed and never used to alter scoring.
   */
  expectedValueDivergence?: ExpectedValueDivergenceNote;
  /**
   * Present when the host supplied `trackRecordObservations`. Envelope-only echoes of
   * per-origin reliability observations — never hashed, never honesty verdicts.
   */
  trackRecordObservations?: Array<{
    originId: string;
    observation: string;
  }>;
  /**
   * Ephemeral mode only: the base64 raw Ed25519 public key matching the run's ephemeral
   * signature, so callers can verifyReceiptFull(networkReceipt, { publicKey }). Honest
   * vocabulary: an ephemeral signature proves integrity + origin-of-this-process only — it is
   * not a durable identity. Absent when explicit signing keys are configured.
   */
  signerPublicKey?: string;
}

/**
 * ReadSupportInput — post-pipeline support sufficiency via lattice `readSupport`.
 * `evidence` is required (may be an empty array for an honest Unverified readout).
 */
export interface ReadSupportInput {
  claim: string;
  /** Required. Empty array → honest Unverified / empty coverage; omit → validation error. */
  evidence: unknown[];
  ts?: string;
}

/** Opaque SupportReadout from `@uvrn/lattice` — forwarded unchanged (no duplicate engine). */
export type ReadSupportOutput = Record<string, unknown>;

/**
 * ReportRankStabilityInput — post-pipeline ordering stability via algox `reportRankStability`.
 * `candidates` is required and must be a non-empty array of objects with `label`.
 */
export interface ReportRankStabilityInput {
  candidates: Array<{
    id?: string;
    label: string;
    url?: string;
    source?: string;
    prominence?: number;
    observedAt?: string;
    signals?: Record<string, number>;
    [k: string]: unknown;
  }>;
  baseline?: {
    weights?: Record<string, number>;
    now?: string;
    topK?: number;
    capPerSource?: number;
    maxAgeDays?: number;
  };
  variants?: Array<{
    name: string;
    weights: Record<string, number>;
  }>;
}

/** Opaque RankStabilityReport from `@uvrn/algox` — forwarded unchanged. */
export type ReportRankStabilityOutput = Record<string, unknown>;

/**
 * PatternScanInput — observatory scan via `@uvrn/pattern` `scanPatterns`.
 * Requires explicit joinScope + window. Host supplies `history` batch (may be [])
 * unless RuntimeConfig.patternHistoryReader is injected. Detected ≠ verified.
 */
export interface PatternScanInput {
  joinScope: string;
  window: { from: string; to: string };
  subjectRefs?: string[];
  /** Host-mapped history events (from store list()/listRecords() etc.). Required unless patternHistoryReader is configured. */
  history?: Array<{
    id: string;
    subjectRef: string;
    observedAt: string;
    originId?: string;
    claimId?: string;
    kind?: string;
    value?: number;
  }>;
  /** Optional detector minCount for frequency-spike baseline (default 3). */
  minCount?: number;
}

/** Opaque ScanResult from `@uvrn/pattern` — forwarded with honesty envelope. */
export type PatternScanOutput = Record<string, unknown>;

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
  /**
   * Optional Layer 4 archive / receipt outbox (BP-A2). When set, `delta_score_claim`
   * persists the signed NetworkReceipt after sign so it survives process exit.
   * Hosts typically inject `@suttlemedia/arcanum` `ArcanumArchive` (or any `{ persist }` /
   * `{ save }` adapter). Omitted → ephemeral default unchanged (no second store layer).
   */
  arcanum?: {
    persist(receipt: import('@uvrn/receipt').NetworkReceipt): import('@uvrn/receipt').NetworkReceipt;
  };
  /**
   * Additive receipt-store inject (alias surface). Prefer `arcanum` for the first consumer;
   * `receiptStore.save` is accepted so hosts can pass `SqliteReceiptStore` directly.
   * When both are set, `arcanum.persist` wins.
   */
  receiptStore?: {
    save(receipt: import('@uvrn/receipt').NetworkReceipt): void;
  };
  /**
   * Optional HistoryReader for `delta_pattern_scan` (host wraps existing store list APIs).
   * When omitted, the tool requires a host-supplied `history` array on the call.
   */
  patternHistoryReader?: {
    readBatch(scope: {
      joinScope: string;
      window: { from: string; to: string };
      subjectRefs?: string[];
    }): Promise<
      | { ok: true; events: unknown[] }
      | { ok: false; reason: 'measured-gap'; message: string }
    >;
  };
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
  handleReadSupport(input: ReadSupportInput): Promise<ReadSupportOutput>;
  handleReportRankStability(input: ReportRankStabilityInput): Promise<ReportRankStabilityOutput>;
  handleValidateDatapoint(input: ValidateDatapointInput): Promise<ValidateDatapointOutput>;
  handlePatternScan(input: PatternScanInput): Promise<PatternScanOutput>;
}
