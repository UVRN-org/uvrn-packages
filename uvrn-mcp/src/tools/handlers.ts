/**
 * MCP Tool Handlers
 * Implements the twelve tools for the Delta Engine MCP server
 */

import { createHash } from 'node:crypto';
import {
  buildMasterReceipt,
  runDeltaEngine,
  validateBundle,
  verifyReceipt,
  DeltaBundle,
  DeltaReceipt,
  MeasurementSource,
  NodeStatusRecord,
} from '@uvrn/core';
import { computeDrift, profileFor } from '@uvrn/drift';
import { CompareEngine } from '@uvrn/compare';
import {
  ConsensusEngine,
  type FarmResult as ConsensusFarmResult,
  type StanceLabel,
  type StanceMode,
} from '@uvrn/consensus';
import { normalize } from '@uvrn/normalize';
import { defaultRegistry, stanceToMeasurementSources } from '@uvrn/measure';
import { ScoreBreakdown, SCORE_PROFILES } from '@uvrn/score';
import type { Canon, CanonStore } from '@uvrn/canon';
import type { ClaimRegistration, FarmConnector } from '@uvrn/agent';
import type { IdentityRegistry } from '@uvrn/identity';
import {
  canonicalClaimId,
  enrichMeasurements,
  generateReceiptKeyPair,
  normalizeTopic,
  parseTopic,
  signReceipt,
  toHumanView,
  wrapMasterReceipt,
} from '@uvrn/receipt';
import {
  CanonGetInput,
  CanonGetOutput,
  CanonQualifyInput,
  CanonQualifyOutput,
  CompareReceiptsInput,
  CompareReceiptsOutput,
  RuntimeConfig,
  RunEngineInput,
  RunEngineOutput,
  ScoreDriftInput,
  ScoreDriftOutput,
  ScoreClaimInput,
  ScoreClaimOutput,
  ExpectedValueDivergenceNote,
  HostMeasurementEcho,
  StanceCounts,
  ReadSupportInput,
  ReadSupportOutput,
  ReportRankStabilityInput,
  ReportRankStabilityOutput,
  PatternScanInput,
  PatternScanOutput,
  ToolHandlers,
  ValidateBundleInput,
  ValidateBundleOutput,
  ValidateDatapointInput,
  ValidateDatapointOutput,
  VerifyIdentityInput,
  VerifyIdentityOutput,
  VerifyReceiptInput,
  VerifyReceiptOutput,
  ValidationError,
  ExecutionError,
} from '../types';
import { logger } from '../logger';

/**
 * Absolute consensus cluster from ConsensusEngine dataSpecs — mode of
 * consensus_value metrics (two-decimal keys). Used for host expectedValue
 * observation only; not a first-class scored field (that is BP-16).
 */
function absoluteClusterFromDataSpecs(
  dataSpecs: DeltaBundle['dataSpecs']
): number | null {
  const counts = new Map<string, { n: number; value: number }>();
  for (const spec of dataSpecs) {
    for (const metric of spec.metrics ?? []) {
      if (metric.key !== 'consensus_value') continue;
      if (typeof metric.value !== 'number' || !Number.isFinite(metric.value)) continue;
      const key = metric.value.toFixed(2);
      const prev = counts.get(key);
      counts.set(key, { n: (prev?.n ?? 0) + 1, value: metric.value });
    }
  }
  if (counts.size === 0) return null;
  let best: { n: number; value: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.n > best.n) best = entry;
  }
  return best?.value ?? null;
}

/**
 * Counts every stance label the sources carried and pairs them with the quorum state
 * from `evaluateStanceMode()`. Envelope-only (BP-18): the caller sees a disagreement even
 * when the quorum was missed, without anything reaching a hashed payload.
 */
function buildStanceCounts(
  sources: readonly ConsensusFarmResult['sources'][number][],
  stanceMode: StanceMode
): StanceCounts {
  const counts: Record<StanceLabel, number> = {
    supports: 0,
    opposes: 0,
    mixed: 0,
    neutral: 0,
    insufficient: 0,
  };
  let unlabeled = 0;
  for (const source of sources) {
    const label = source.stanceLabel;
    if (label !== undefined && label in counts) {
      counts[label] += 1;
    } else {
      unlabeled += 1;
    }
  }

  return {
    ...counts,
    unlabeled,
    quorum: {
      met: stanceMode.quorumMet,
      evidenceAxis: stanceMode.evidenceAxis,
      sourceCount: stanceMode.sourceCount,
      groundedCount: stanceMode.groundedCount,
      requiredSources: stanceMode.requiredSources,
      requiredGrounded: stanceMode.requiredGrounded,
      confidenceFloor: stanceMode.confidenceFloor,
      ...(stanceMode.fallbackReason !== undefined
        ? { reason: stanceMode.fallbackReason }
        : {}),
    },
  };
}

function buildExpectedValueNote(
  hostExpected: number,
  measuredCluster: number | null
): ExpectedValueDivergenceNote {
  const absoluteDifference =
    measuredCluster === null ? null : Math.abs(hostExpected - measuredCluster);
  const observation =
    measuredCluster === null
      ? `Host expected ${hostExpected}; no absolute consensus cluster was measurable from the sources.`
      : `Host expected ${hostExpected}; the sources landed on ${measuredCluster}; the two differ by ${absoluteDifference}.`;
  return { hostExpected, measuredCluster, absoluteDifference, observation };
}

/**
 * buildHandlers creates the MCP tool handler bundle for one resolved runtime configuration.
 * Stateful defaults, such as the identity mock store, are imported lazily only when their tool runs.
 */
/**
 * ReceiptSigner is the resolved signing identity for one handler bundle.
 * `ephemeralPublicKey` is set only in ephemeral mode, where the public key is safe (and
 * necessary) to emit in tool results so callers can verify.
 */
interface ReceiptSigner {
  privateKey: string;
  publicKeyRef: string;
  ephemeralPublicKey?: string;
}

function resolveSigner(config: RuntimeConfig): ReceiptSigner {
  const signing = config.signing ?? 'ephemeral';
  if (signing === 'ephemeral') {
    const keyPair = generateReceiptKeyPair();
    return {
      privateKey: keyPair.privateKey,
      publicKeyRef: 'uvrn-mcp-ephemeral',
      ephemeralPublicKey: keyPair.publicKey,
    };
  }
  // Explicit keys: use them and never emit the private side (or echo the public side) anywhere.
  return { privateKey: signing.privateKey, publicKeyRef: signing.publicKeyRef };
}

export function buildHandlers(config: RuntimeConfig): ToolHandlers {
  let identityRegistryPromise: Promise<IdentityRegistry> | undefined;
  let canonPromise: Promise<{ canon: Canon; stores: CanonStore[] }> | undefined;
  const signer = resolveSigner(config);

  async function getIdentityRegistry(): Promise<IdentityRegistry> {
    if (!identityRegistryPromise) {
      identityRegistryPromise = (async () => {
        const { IdentityRegistry: Registry, MockIdentityStore } = await import('@uvrn/identity');
        return new Registry({ store: config.identityStore ?? new MockIdentityStore() });
      })();
    }
    return identityRegistryPromise;
  }

  async function getCanonRuntime(): Promise<{ canon: Canon; stores: CanonStore[] }> {
    if (!canonPromise) {
      canonPromise = (async () => {
        const { Canon: CanonEngine, MockSigner, MockStore } = await import('@uvrn/canon');
        const stores = config.canonStores ?? [new MockStore()];
        const signer = config.canonSigner ?? new MockSigner();
        return {
          canon: new CanonEngine({
            stores,
            signer,
            autoSuggest: {
              enabled: false,
              consecutiveRuns: 3,
              minScore: 85,
              suggestionTtlMs: 24 * 60 * 60 * 1000,
            },
            canonizerId: 'uvrn-mcp',
          }),
          stores,
        };
      })();
    }
    return canonPromise;
  }

  return {
    handleRunEngine: (input) => handleRunEngine(input, config),
    handleValidateBundle,
    handleVerifyReceipt,
    handleScoreDrift: (input) => handleScoreDrift(input, config),
    handleCompare: (input) => handleCompare(input, config),
    handleVerifyIdentity: (input) => handleVerifyIdentity(input, getIdentityRegistry),
    handleCanonQualify: (input) => handleCanonQualify(input, getCanonRuntime),
    handleCanonGet: (input) => handleCanonGet(input, getCanonRuntime),
    handleScoreClaim: (input) => handleScoreClaim(input, config, signer),
    handleReadSupport,
    handleReportRankStability,
    handleValidateDatapoint,
    handlePatternScan: (input) => handlePatternScan(input, config),
  };
}

/**
 * Tool: delta_run_engine
 * Executes the Delta Engine on a provided bundle
 */
async function handleRunEngine(input: RunEngineInput, config: RuntimeConfig): Promise<RunEngineOutput> {
  logger.debug('handleRunEngine called', { bundleId: input.bundle?.bundleId });

  try {
    // Validate input structure
    if (!input.bundle || typeof input.bundle !== 'object') {
      throw new ValidationError('Invalid input: bundle must be an object');
    }

    const bundle = input.bundle as DeltaBundle;

    // Enforce MAX_BUNDLE_SIZE if configured
    if (config.maxBundleSize) {
      const bundleSize = JSON.stringify(bundle).length;
      if (bundleSize > config.maxBundleSize) {
        throw new ValidationError(
          `Bundle size (${bundleSize} bytes) exceeds maximum allowed size (${config.maxBundleSize} bytes)`,
          { bundleSize, maxBundleSize: config.maxBundleSize }
        );
      }
    }

    // Explicitly validate bundle structure before execution
    const validationResult = validateBundle(bundle);
    if (!validationResult.valid) {
      throw new ValidationError(
        `Bundle validation failed: ${validationResult.error}`,
        { validationResult }
      );
    }

    // Run the engine
    const receipt = runDeltaEngine(bundle, {
      timestamp: input.options?.timestamp,
    });

    logger.info('Engine executed successfully', {
      bundleId: bundle.bundleId,
      outcome: receipt.outcome,
    });

    return {
      receipt,
      success: true,
    };
  } catch (error) {
    // Preserve validation errors as-is
    if (error instanceof ValidationError) {
      throw error;
    }
    
    const message = error instanceof Error ? error.message : String(error);
    const errorDetails = config.verboseErrors ? { originalError: error } : undefined;
    
    logger.error('Engine execution failed', { error: message });
    throw new ExecutionError(`Engine execution failed: ${message}`, errorDetails);
  }
}

/**
 * Tool: delta_validate_datapoint
 * Thin adapter → `@uvrn/validate` Stage1 (+ optional Stage2 measure route).
 * Does not overload delta_validate_bundle. Never emits verified.
 */
async function handleValidateDatapoint(
  input: ValidateDatapointInput
): Promise<ValidateDatapointOutput> {
  logger.debug('handleValidateDatapoint called', { runStage2: input?.runStage2 === true });

  try {
    const { validateDataPoint } = await import('@uvrn/validate');

    const sources: MeasurementSource[] | undefined = Array.isArray(input?.sources)
      ? input.sources.map((s, index) => {
          const id =
            (typeof s.id === 'string' && s.id.trim().length > 0 && s.id) ||
            (typeof s.url === 'string' && s.url.trim().length > 0 && s.url) ||
            `source-${index + 1}`;
          const label =
            (typeof s.label === 'string' && s.label) ||
            (typeof s.title === 'string' && s.title) ||
            id;
          const kind =
            s.kind ??
            (typeof s.value === 'number'
              ? 'numeric'
              : typeof s.assertion === 'string'
                ? 'categorical'
                : undefined);
          const source: MeasurementSource = {
            id,
            label,
            status: 'on',
          };
          if (kind !== undefined) source.kind = kind;
          if (typeof s.value === 'number') source.value = s.value;
          if (typeof s.assertion === 'string') source.assertion = s.assertion;
          if (typeof s.ts === 'string') source.ts = s.ts;
          return source;
        })
      : undefined;

    const result = validateDataPoint(input?.dataPoint, {
      runStage2: input?.runStage2 === true,
      ...(typeof input?.claim === 'string' ? { claim: input.claim } : {}),
      ...(sources !== undefined ? { sources } : {}),
    });

    // Belt-and-suspenders honesty: this surface must never claim verified.
    const serialized = JSON.stringify(result);
    if (/"verified"/.test(serialized) || /integrity-checked/.test(serialized)) {
      throw new ExecutionError(
        'delta_validate_datapoint refused to emit forbidden honesty tokens (verified / integrity-checked)'
      );
    }

    return result as ValidateDatapointOutput;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ExecutionError) throw error;
    logger.error('handleValidateDatapoint failed', { error });
    throw new ExecutionError(
      `delta_validate_datapoint failed: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Tool: delta_validate_bundle
 * Validates bundle structure without executing
 */
async function handleValidateBundle(
  input: ValidateBundleInput
): Promise<ValidateBundleOutput> {
  logger.debug('handleValidateBundle called');

  try {
    // Validate input structure
    if (!input.bundle || typeof input.bundle !== 'object') {
      return {
        valid: false,
        error: 'Invalid input: bundle must be an object',
        details: 'The provided bundle is not a valid object',
      };
    }

    const bundle = input.bundle as DeltaBundle;
    const result = validateBundle(bundle);

    logger.info('Bundle validation completed', {
      valid: result.valid,
      bundleId: bundle.bundleId,
    });

    return {
      valid: result.valid,
      error: result.error,
      details: result.valid
        ? `Bundle "${bundle.bundleId}" passed structural validation with ${bundle.dataSpecs.length} data specs. Structure only — nothing here checks evidence, hashes, or signatures.`
        : result.error,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Bundle validation error', { error: message });
    
    return {
      valid: false,
      error: 'Validation error',
      details: message,
    };
  }
}

/**
 * Tool: delta_verify_receipt
 * Verifies receipt integrity and hash chain
 */
async function handleVerifyReceipt(
  input: VerifyReceiptInput
): Promise<VerifyReceiptOutput> {
  logger.debug('handleVerifyReceipt called');

  try {
    // Validate input structure
    if (!input.receipt || typeof input.receipt !== 'object') {
      return {
        integrityOk: false,
        verified: false,
        error: 'Invalid input: receipt must be an object',
        details: 'The provided receipt is not an object',
      };
    }

    const receipt = input.receipt as DeltaReceipt;
    const result = verifyReceipt(receipt);
    // verifyReceipt() recomputes the canonical hash and compares it. No key, no signature,
    // no producer — so this is integrity, not verification (SPEC/uvrn-signing-v1.md).
    const integrityOk = result.verified;

    logger.info('Receipt integrity check completed', {
      integrityOk,
      bundleId: receipt.bundleId,
    });

    return {
      integrityOk,
      verified: integrityOk,
      recomputedHash: result.recomputedHash,
      error: result.error,
      details: integrityOk
        ? `Receipt for bundle "${receipt.bundleId}" is integrity-checked: its canonical payload rehashes to ${receipt.hash}. No producer signature was checked, so this is not verification — use verifyReceiptFull() from @uvrn/receipt for integrity plus signature.`
        : result.error,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Receipt integrity check error', { error: message });

    return {
      integrityOk: false,
      verified: false,
      error: 'Integrity check error',
      details: message,
    };
  }
}

/**
 * Tool: delta_score_drift
 * Computes temporal drift for an already enriched DriftInputReceipt.
 */
async function handleScoreDrift(input: ScoreDriftInput, config: RuntimeConfig): Promise<ScoreDriftOutput> {
  logger.debug('handleScoreDrift called', { receiptId: input.receipt?.receipt_id });

  try {
    if (!input.receipt || typeof input.receipt !== 'object') {
      throw new ValidationError('Invalid input: receipt must be an enriched DriftInputReceipt');
    }
    if (typeof input.receipt.v_score !== 'number' || !input.receipt.components) {
      throw new ValidationError(
        'delta_score_drift requires a DriftInputReceipt with v_score and components; raw DeltaReceipt input is not accepted'
      );
    }

    const asOf = input.asOf ? new Date(input.asOf) : new Date();
    if (Number.isNaN(asOf.getTime())) {
      throw new ValidationError('Invalid input: asOf must be an ISO date string when provided');
    }

    const profile = profileFor(input.profile ?? 'default');
    return {
      receipt: computeDrift(input.receipt, profile, asOf),
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    const errorDetails = config.verboseErrors ? { originalError: error } : undefined;
    logger.error('Drift scoring failed', { error: message });
    throw new ExecutionError(`Drift scoring failed: ${message}`, errorDetails);
  }
}

/**
 * Tool: delta_compare
 * Compares exactly two already scored receipts carrying claimId and vScore fields.
 */
async function handleCompare(input: CompareReceiptsInput, config: RuntimeConfig): Promise<CompareReceiptsOutput> {
  logger.debug('handleCompare called', { receiptCount: input.receipts?.length });

  try {
    if (!Array.isArray(input.receipts) || input.receipts.length !== 2) {
      throw new ValidationError('delta_compare requires exactly two enriched receipts');
    }

    input.receipts.forEach((receipt, index) => {
      const claimId = receipt.claimId ?? receipt.claim_id;
      const vScore = receipt.vScore ?? receipt.v_score;
      if (typeof claimId !== 'string' || claimId.length === 0 || typeof vScore !== 'number') {
        throw new ValidationError(
          `delta_compare receipt ${index} must include claimId/claim_id and vScore/v_score; raw DeltaReceipt input is not accepted`
        );
      }
    });

    return {
      result: CompareEngine.compare(input.receipts, input.options),
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    const errorDetails = config.verboseErrors ? { originalError: error } : undefined;
    logger.error('Receipt comparison failed', { error: message });
    throw new ExecutionError(`Receipt comparison failed: ${message}`, errorDetails);
  }
}

/**
 * Tool: delta_verify_identity
 * Reads signer reputation from an in-memory MockIdentityStore.
 */
async function handleVerifyIdentity(
  input: VerifyIdentityInput,
  getIdentityRegistry: () => Promise<IdentityRegistry>
): Promise<VerifyIdentityOutput> {
  logger.debug('handleVerifyIdentity called', { address: input.address });

  if (!input.address || typeof input.address !== 'string') {
    throw new ValidationError('Invalid input: address must be a non-empty string');
  }

  return {
    reputation: await (await getIdentityRegistry()).reputation(input.address),
  };
}

/**
 * Tool: delta_canon_qualify
 * Assesses canon qualification without writing or canonizing anything.
 */
async function handleCanonQualify(
  input: CanonQualifyInput,
  getCanonRuntime: () => Promise<{ canon: Canon; stores: CanonStore[] }>
): Promise<CanonQualifyOutput> {
  if (!input.claimId || typeof input.claimId !== 'string') {
    throw new ValidationError('Invalid input: claimId must be a non-empty string');
  }
  if (!input.snapshot || typeof input.snapshot !== 'object') {
    throw new ValidationError('Invalid input: snapshot must be a DriftSnapshot');
  }

  const { canon } = await getCanonRuntime();
  return {
    result: canon.qualify(input.claimId, input.snapshot),
  };
}

/**
 * Tool: delta_canon_get
 * Reads a canon receipt by id from the configured first CanonStore.
 */
async function handleCanonGet(
  input: CanonGetInput,
  getCanonRuntime: () => Promise<{ canon: Canon; stores: CanonStore[] }>
): Promise<CanonGetOutput> {
  if (!input.canonId || typeof input.canonId !== 'string') {
    throw new ValidationError('Invalid input: canonId must be a non-empty string');
  }

  const { stores } = await getCanonRuntime();
  return {
    receipt: await stores[0].read(input.canonId),
  };
}

/**
 * Tool: delta_score_claim
 * Fetches configured connector sources, runs consensus/core/measure, and returns a MasterReceipt.
 */
async function handleScoreClaim(
  input: ScoreClaimInput,
  config: RuntimeConfig,
  signer: ReceiptSigner
): Promise<ScoreClaimOutput> {
  logger.debug('handleScoreClaim called', { claimId: input.claimId });

  try {
    if (!input.claim || typeof input.claim !== 'string') {
      throw new ValidationError('Invalid input: claim must be a non-empty string');
    }
    if (input.topic !== undefined && (typeof input.topic !== 'string' || input.topic.length === 0)) {
      throw new ValidationError('Invalid input: topic must be a non-empty string when provided');
    }
    // Normalization never rejects: unknown domains land under custom/ — recorded, not hidden.
    const topic = input.topic !== undefined ? normalizeTopic(input.topic).topic : undefined;

    const registration = claimRegistrationFromInput(input);
    const nodes: NodeStatusRecord[] = [];
    const farmResults: ConsensusFarmResult[] = [];
    const hostMeasurements: HostMeasurementEcho[] = [];
    let evidenceMode: 'host_sources' | 'connector' | 'mock';

    // Host-evidence precedence: any non-empty `sources` array means the caller
    // requested host-evidence mode, so exactly one source is a hard error — it does
    // NOT silently fall back to connectors/mock. Empty `[]` or omitted `sources`
    // fall through to the connector/mock path below.
    if (input.sources && input.sources.length > 0 && input.sources.length < 2) {
      throw new ValidationError('Host evidence requires at least 2 sources');
    }

    if (input.sources && input.sources.length >= 2) {
      // Path 1: host-provided evidence. The caller searched and supplied sources directly.
      // evidenceScore (if present) is carried on the FarmSource.evidenceScore field and
      // preferred by consensus/normalize numeric extraction — see extractMetricValue().
      evidenceMode = 'host_sources';
      for (const s of input.sources) {
        assertFiniteRange(s.credibility, 'credibility', 0, 1);
        assertFiniteRange(s.evidenceScore, 'evidenceScore', 0, 100);
        assertFiniteRange(s.stanceValue, 'stanceValue', -1, 1);
        assertFiniteRange(s.stanceConfidence, 'stanceConfidence', 0, 1);
        // Uncapped is not unvalidated: any magnitude is allowed, NaN/Infinity are not.
        assertFinite(s.value, 'value');
        assertStanceLabel(s.stanceLabel);
        if (s.unit !== undefined && typeof s.unit !== 'string') {
          throw new ValidationError('unit must be a string when provided');
        }
        if (s.stanceEvidence !== undefined && typeof s.stanceEvidence !== 'string') {
          throw new ValidationError('stanceEvidence must be a string when provided');
        }
        if (s.value !== undefined) {
          hostMeasurements.push({
            url: s.url,
            value: s.value,
            ...(s.unit !== undefined ? { unit: s.unit } : {}),
          });
        }
      }
      const observedAt = new Date().toISOString();
      farmResults.push({
        claimId: registration.id,
        fetchedAt: observedAt,
        durationMs: 0,
        sources: input.sources.map((s) => ({
          url: s.url,
          title: s.title,
          snippet: s.snippet,
          publishedAt: s.publishedAt,
          measuredAt: s.measuredAt,
          appliesTo: s.appliesTo,
          credibility: s.credibility,
          // FarmSource.evidenceScore is the numeric channel consensus/normalize read
          // (extractProminenceValue). A host-supplied `value` is the measurement, so it
          // takes that channel when present, at its own magnitude and unrescaled. The
          // MCP-level `evidenceScore` input keeps its 0–100 quality semantics and its
          // range check above; `value` never widens that bound.
          evidenceScore: s.value ?? s.evidenceScore,
          // Host-declared unit → unitSource declared in consensus (BP-20).
          unit: s.unit,
          quantityKind: s.quantityKind,
          obsStatus: s.obsStatus,
          stake: s.stake,
          codeLists: s.codeLists,
          prov: s.prov,
          originId: s.originId,
          stanceValue: s.stanceValue,
          stanceLabel: s.stanceLabel,
          stanceConfidence: s.stanceConfidence,
          stanceEvidence: s.stanceEvidence,
        })),
      });
      nodes.push({
        id: 'HostSources',
        status: 'on',
        detail: `${input.sources.length} host sources`,
        observedAt,
      });
    } else {
      // Path 2: configured connectors, or the zero-external mock fallback.
      const connectors = config.connectors && config.connectors.length > 0
        ? config.connectors
        : [new DefaultMockConnector()];
      evidenceMode = config.connectors && config.connectors.length > 0 ? 'connector' : 'mock';

      for (const [index, connector] of connectors.entries()) {
        const nodeId = connector.constructor.name || `connector-${index + 1}`;
        try {
          const result = await connector.fetch(registration);
          farmResults.push(result);
          nodes.push({
            id: nodeId,
            status: result.sources.length > 0 ? 'on' : 'unavailable',
            detail: result.sources.length > 0 ? `${result.sources.length} sources fetched` : 'empty result',
            observedAt: result.fetchedAt,
          });
        } catch (error) {
          nodes.push({
            id: nodeId,
            status: 'off',
            detail: error instanceof Error ? error.message : String(error),
            observedAt: new Date().toISOString(),
          });
        }
      }
    }

    const merged = mergeFarmResults(registration, farmResults);
    if (merged.sources.length < 2) {
      throw new ExecutionError('Score claim requires at least two fetched sources after connector failures', { nodes });
    }

    const normalized = normalize(merged.sources, 'general');
    const consensusEngine = new ConsensusEngine({ sources: merged, claim: input.claim });
    const stanceMode = consensusEngine.stanceMode();
    const consensus = consensusEngine.buildConsensusResult(input.claim);
    const base = runDeltaEngine(consensus.bundle);
    const breakdown = new ScoreBreakdown(consensus.components, SCORE_PROFILES.general);
    const stanceProjection = stanceToMeasurementSources(
      merged.sources.map((source) => ({
        id: source.url,
        label: source.title,
        ts: source.publishedAt,
        status: 'on',
        stanceValue: source.stanceValue,
        stanceLabel: source.stanceLabel,
        stanceConfidence: source.stanceConfidence,
        stanceEvidence: source.stanceEvidence,
      }))
    );
    const measurementResults = defaultRegistry().runAll({
      claim: input.claim,
      sources:
        stanceMode.evidenceAxis === 'stance'
          ? [...stanceProjection.numeric, ...stanceProjection.categorical]
          : normalized.sources.map((source, index): MeasurementSource => ({
              id: `${source.name}-${index}`,
              kind: typeof source.value === 'number' ? 'numeric' : 'categorical',
              value: typeof source.value === 'number' ? source.value : undefined,
              assertion: typeof source.value === 'string' ? source.value : undefined,
              label: source.name,
              ts: toIsoTimestamp(source.timestamp, merged.fetchedAt),
              attributes: {
                unit: source.unit,
                credibility: source.credibility,
                normalizer: source.normalizer,
              },
              status: 'on',
            })),
      context: {
        components: consensus.components,
      },
    });
    // Enrich BEFORE buildMasterReceipt so humanExplanation sits inside the hashed
    // master envelope (B5.2) — enriching afterwards would invalidate masterHash.
    const measurements = enrichMeasurements(measurementResults);

    const masterReceipt = buildMasterReceipt({
      base,
      claim: input.claim,
      measurements,
      nodes,
    });
    // Host NetworkReceipt envelope owns additive stanceMode provenance (SPEC §3 /
    // ADR-011). Attach on every stance-capable run — including prominence fallback —
    // without mutating the returned masterReceipt / frozen delta surfaces (D2 hard wall 4).
    const receiptPayload = {
      ...masterReceipt,
      stanceMode,
      ...(stanceMode.evidenceAxis === 'stance'
        ? {
            stanceSummary: {
              support: stanceProjection.categorical.filter(
                (source) => source.assertion === 'supports'
              ).length,
              oppose: stanceProjection.categorical.filter(
                (source) => source.assertion === 'opposes'
              ).length,
            },
          }
        : {}),
    };

    // Attach additive arcanum identity fields AFTER wrap (hash sealed) and BEFORE sign.
    // canonicalClaimId + arcanumType are unknown-fields (SPEC §2.4) — never hashed.
    const wrapped = wrapMasterReceipt(receiptPayload, {
      claim: { id: registration.id, text: input.claim },
      source: 'uvrn-mcp',
      action: 'delta_score_claim',
      ...(topic !== undefined ? { topic } : {}),
    });
    const domain =
      topic !== undefined ? parseTopic(normalizeTopic(topic).topic).domain : '';
    const networkReceipt = signReceipt(
      {
        ...wrapped,
        canonicalClaimId: canonicalClaimId(input.claim, domain),
        arcanumType: domain === 'markets' ? 'uvrn-market' : 'uvrn-research',
      },
      { privateKey: signer.privateKey, publicKeyRef: signer.publicKeyRef }
    );

    // FIRST CONSUMER REPOINT (BP-A2): when a Layer 4 archive/store is injected, persist
    // after sign so the scored receipt survives process exit. Ephemeral hosts omit this —
    // default behavior unchanged (no silent invent of a store).
    if (config.arcanum) {
      config.arcanum.persist(networkReceipt);
    } else if (config.receiptStore) {
      config.receiptStore.save(networkReceipt);
    }

    const humanView = toHumanView(networkReceipt, {
      scores: {
        vScore: breakdown.final,
        completeness: consensus.components.completeness,
        parity: consensus.components.parity,
        freshness: consensus.components.freshness,
      },
    });

    // expectedValue is host input → envelope observation only. Computed after
    // receipts are sealed so it cannot enter hashed surfaces.
    let expectedValueDivergence: ExpectedValueDivergenceNote | undefined;
    if (input.expectedValue !== undefined) {
      if (typeof input.expectedValue !== 'number' || !Number.isFinite(input.expectedValue)) {
        throw new ValidationError('expectedValue must be a finite number when provided');
      }
      const measuredCluster = absoluteClusterFromDataSpecs(consensus.bundle.dataSpecs);
      expectedValueDivergence = buildExpectedValueNote(input.expectedValue, measuredCluster);
    }

    return {
      masterReceipt,
      v_score: breakdown.final,
      claimId: registration.id,
      evidenceMode,
      // Post-parse/post-dedupe count of sources actually scored by consensus —
      // not the raw merged count (MINOR-2).
      sourceCount: consensus.stats.sourceCount,
      networkReceipt,
      humanView,
      // Envelope-only (BP-18): all five stance labels plus quorum state, reported whether
      // or not the quorum was met. Deliberately computed after the receipts are sealed so
      // it cannot reach `receiptPayload` — the payload's gated `stanceSummary` is untouched.
      stanceCounts: buildStanceCounts(merged.sources, stanceMode),
      ...(hostMeasurements.length > 0 ? { hostMeasurements } : {}),
      ...(expectedValueDivergence !== undefined ? { expectedValueDivergence } : {}),
      ...(input.trackRecordObservations !== undefined && input.trackRecordObservations.length > 0
        ? { trackRecordObservations: input.trackRecordObservations }
        : {}),
      // Ephemeral mode only: emit the public key so callers can verify this run's
      // signature. Explicit keys are never echoed in results.
      ...(signer.ephemeralPublicKey !== undefined
        ? { signerPublicKey: signer.ephemeralPublicKey }
        : {}),
    };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ExecutionError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const errorDetails = config.verboseErrors ? { originalError: error } : undefined;
    logger.error('Score claim failed', { error: message });
    throw new ExecutionError(`Score claim failed: ${message}`, errorDetails);
  }
}

function toIsoTimestamp(value: unknown, fallback: string): string {
  const candidate = typeof value === 'string' || typeof value === 'number' || value instanceof Date
    ? new Date(value)
    : undefined;
  if (candidate && !Number.isNaN(candidate.getTime())) {
    return candidate.toISOString();
  }

  const fallbackDate = new Date(fallback);
  if (!Number.isNaN(fallbackDate.getTime())) {
    return fallbackDate.toISOString();
  }

  return new Date().toISOString();
}

/**
 * Validates an optional numeric field is a finite number within [min, max].
 * Clients may not enforce the JSON-schema bounds, so we re-check at the handler
 * boundary. `undefined` is allowed (field is optional); everything else must be a
 * finite number in range — rejects non-number, NaN, Infinity, and out-of-range.
 */
function assertFiniteRange(value: unknown, field: string, min: number, max: number): void {
  if (
    value !== undefined &&
    (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
  ) {
    throw new ValidationError(`${field} must be a finite number between ${min} and ${max}`);
  }
}

/**
 * Validates an optional numeric field is a finite number of any magnitude. Uncapped is
 * not the same as unvalidated: NaN, Infinity, and non-numbers are still rejected.
 */
function assertFinite(value: unknown, field: string): void {
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
    throw new ValidationError(`${field} must be a finite number when provided`);
  }
}

function assertStanceLabel(value: unknown): void {
  if (
    value !== undefined &&
    !['supports', 'opposes', 'mixed', 'neutral', 'insufficient'].includes(
      value as string
    )
  ) {
    throw new ValidationError(
      'stanceLabel must be one of supports, opposes, mixed, neutral, or insufficient'
    );
  }
}

function claimRegistrationFromInput(input: ScoreClaimInput): ClaimRegistration {
  // When no explicit claimId is supplied, derive a human-readable slug and append a
  // deterministic short hash of the original claim so distinct claims that slug to the
  // same string (punctuation/symbol differences) don't collide (MINOR-3).
  let id: string;
  if (input.claimId) {
    id = input.claimId;
  } else {
    const slug = input.claim.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'claim';
    const hash = createHash('sha256').update(input.claim).digest('hex').slice(0, 8);
    id = `${slug}-${hash}`;
  }
  return {
    id,
    label: input.label ?? input.claim,
    query: input.claim,
    driftConfig: profileFor('default'),
    intervalMs: 0,
    tags: ['mcp'],
    metadata: {
      source: 'uvrn-mcp',
    },
  };
}

function mergeFarmResults(
  registration: ClaimRegistration,
  results: ConsensusFarmResult[]
): ConsensusFarmResult {
  const sources = results.flatMap((result) => result.sources);
  return {
    claimId: registration.id,
    sources,
    fetchedAt: new Date().toISOString(),
    durationMs: results.reduce((sum, result) => sum + result.durationMs, 0),
  };
}

/**
 * DefaultMockConnector provides deterministic zero-external claim evidence for MCP demos and tests.
 * It is intentionally local to MCP and is not a provider-specific service default.
 */
class DefaultMockConnector implements FarmConnector {
  async fetch(claim: ClaimRegistration): Promise<ConsensusFarmResult> {
    const now = new Date('2026-06-05T00:00:00.000Z').toISOString();
    return {
      claimId: claim.id,
      fetchedAt: now,
      durationMs: 0,
      sources: [
        {
          url: `mock://source-a/${claim.id}`,
          title: 'Mock Source A',
          snippet: 'Reported metric value 100 for the claim.',
          publishedAt: now,
          credibility: 0.9,
          // Declared metric — title/snippet scrape is opt-in and off (BP-15).
          evidenceScore: 100,
        },
        {
          url: `mock://source-b/${claim.id}`,
          title: 'Mock Source B',
          snippet: 'Reported metric value 102 for the claim.',
          publishedAt: now,
          credibility: 0.85,
          evidenceScore: 102,
        },
      ],
    };
  }
}

/**
 * Tool: delta_read_support
 * Thin adapter → lattice `readSupport` / claim ladder. No duplicate sufficiency engine.
 */
async function handleReadSupport(input: ReadSupportInput): Promise<ReadSupportOutput> {
  logger.debug('handleReadSupport called');

  if (typeof input?.claim !== 'string' || input.claim.trim().length === 0) {
    throw new ValidationError(
      'delta_read_support requires a non-empty string `claim`. Missing claim cannot be graded for support sufficiency.'
    );
  }
  if (!Array.isArray(input.evidence)) {
    throw new ValidationError(
      'delta_read_support requires `evidence` as an array. Omit is not allowed — pass [] for an honest Unverified / empty-coverage readout.'
    );
  }

  try {
    const { readSupport } = await import('@uvrn/lattice');
    const options =
      typeof input.ts === 'string' && input.ts.length > 0 ? { ts: input.ts } : {};
    // Forward host evidence unchanged — lattice owns tagging / honesty vocabulary.
    const readout = readSupport(input.claim, input.evidence as never, options);
    return readout as unknown as ReadSupportOutput;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    logger.error('handleReadSupport failed', { error });
    throw new ExecutionError(
      `delta_read_support failed: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Tool: delta_pattern_scan
 * Thin adapter → @uvrn/pattern scanPatterns. Observatory only — detected ≠ verified; not receipt-class.
 */
async function handlePatternScan(
  input: PatternScanInput,
  config: RuntimeConfig
): Promise<PatternScanOutput> {
  logger.debug('handlePatternScan called');

  if (typeof input?.joinScope !== 'string' || input.joinScope.trim().length === 0) {
    throw new ValidationError(
      'delta_pattern_scan requires a non-empty string `joinScope`. Unbound / silent global scans are refused.'
    );
  }
  if (
    !input.window ||
    typeof input.window.from !== 'string' ||
    typeof input.window.to !== 'string' ||
    input.window.from.trim().length === 0 ||
    input.window.to.trim().length === 0
  ) {
    throw new ValidationError(
      'delta_pattern_scan requires `window.from` and `window.to` as non-empty ISO strings.'
    );
  }

  try {
    const {
      InMemoryHistoryReader,
      FrequencySpikeDetector,
      scanPatterns,
    } = await import('@uvrn/pattern');

    const hasInlineHistory = Array.isArray(input.history);
    const injected = config.patternHistoryReader;

    if (!hasInlineHistory && !injected) {
      throw new ValidationError(
        'delta_pattern_scan requires `history` as an array (pass [] for honest insufficient) unless RuntimeConfig.patternHistoryReader is injected. Hosts map existing store list()/listRecords() into history events — v0 does not invent a cross-claim index.'
      );
    }

    const reader = hasInlineHistory
      ? new InMemoryHistoryReader(input.history as never)
      : (injected as never);

    const detector =
      typeof input.minCount === 'number'
        ? new FrequencySpikeDetector({ minCount: input.minCount })
        : new FrequencySpikeDetector();

    const result = await scanPatterns(
      reader,
      {
        joinScope: input.joinScope,
        window: input.window,
        ...(input.subjectRefs !== undefined ? { subjectRefs: input.subjectRefs } : {}),
      },
      detector
    );

    return result as unknown as PatternScanOutput;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    logger.error('handlePatternScan failed', { error });
    throw new ExecutionError(
      `delta_pattern_scan failed: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Tool: delta_report_rank_stability
 * Thin adapter → algox `reportRankStability`. Ordering stability only — not publish/registry law.
 */
async function handleReportRankStability(
  input: ReportRankStabilityInput
): Promise<ReportRankStabilityOutput> {
  logger.debug('handleReportRankStability called');

  if (!Array.isArray(input?.candidates)) {
    throw new ValidationError(
      'delta_report_rank_stability requires `candidates` as an array of ranking candidates.'
    );
  }
  if (input.candidates.length === 0) {
    throw new ValidationError(
      'delta_report_rank_stability requires a non-empty `candidates` array. Ranking with no candidates is undefined — supply at least one candidate with a non-empty `label`.'
    );
  }
  for (let i = 0; i < input.candidates.length; i++) {
    const c = input.candidates[i];
    if (!c || typeof c !== 'object' || typeof c.label !== 'string' || c.label.trim().length === 0) {
      throw new ValidationError(
        `delta_report_rank_stability candidates[${i}] requires a non-empty string \`label\`.`
      );
    }
  }

  try {
    const { reportRankStability } = await import('@uvrn/algox');
    const report = await reportRankStability(input.candidates, {
      ...(input.baseline !== undefined ? { baseline: input.baseline } : {}),
      ...(input.variants !== undefined ? { variants: input.variants } : {}),
    });
    return report as unknown as ReportRankStabilityOutput;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    logger.error('handleReportRankStability failed', { error });
    throw new ExecutionError(
      `delta_report_rank_stability failed: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}
