/**
 * MCP Tool Handlers
 * Implements the nine tools for the Delta Engine MCP server
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
} from '@uvrn/consensus';
import { normalize } from '@uvrn/normalize';
import { defaultRegistry, stanceToMeasurementSources } from '@uvrn/measure';
import { ScoreBreakdown, SCORE_PROFILES } from '@uvrn/score';
import type { Canon, CanonStore } from '@uvrn/canon';
import type { ClaimRegistration, FarmConnector } from '@uvrn/agent';
import type { IdentityRegistry } from '@uvrn/identity';
import {
  enrichMeasurements,
  generateReceiptKeyPair,
  normalizeTopic,
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
  ToolHandlers,
  ValidateBundleInput,
  ValidateBundleOutput,
  VerifyIdentityInput,
  VerifyIdentityOutput,
  VerifyReceiptInput,
  VerifyReceiptOutput,
  ValidationError,
  ExecutionError,
} from '../types';
import { logger } from '../logger';

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
        ? `Bundle "${bundle.bundleId}" is valid with ${bundle.dataSpecs.length} data specs`
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
        verified: false,
        error: 'Invalid input: receipt must be an object',
        details: 'The provided receipt is not a valid object',
      };
    }

    const receipt = input.receipt as DeltaReceipt;
    const result = verifyReceipt(receipt);

    logger.info('Receipt verification completed', {
      verified: result.verified,
      bundleId: receipt.bundleId,
    });

    return {
      verified: result.verified,
      recomputedHash: result.recomputedHash,
      error: result.error,
      details: result.verified
        ? `Receipt for bundle "${receipt.bundleId}" is valid. Hash verified: ${receipt.hash}`
        : result.error,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Receipt verification error', { error: message });
    
    return {
      verified: false,
      error: 'Verification error',
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
        assertStanceLabel(s.stanceLabel);
        if (s.stanceEvidence !== undefined && typeof s.stanceEvidence !== 'string') {
          throw new ValidationError('stanceEvidence must be a string when provided');
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
          credibility: s.credibility,
          evidenceScore: s.evidenceScore,
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

    const networkReceipt = signReceipt(
      wrapMasterReceipt(receiptPayload, {
        claim: { id: registration.id, text: input.claim },
        source: 'uvrn-mcp',
        action: 'delta_score_claim',
        ...(topic !== undefined ? { topic } : {}),
      }),
      { privateKey: signer.privateKey, publicKeyRef: signer.publicKeyRef }
    );

    const humanView = toHumanView(networkReceipt, {
      scores: {
        vScore: breakdown.final,
        completeness: consensus.components.completeness,
        parity: consensus.components.parity,
        freshness: consensus.components.freshness,
      },
    });

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
        },
        {
          url: `mock://source-b/${claim.id}`,
          title: 'Mock Source B',
          snippet: 'Reported metric value 102 for the claim.',
          publishedAt: now,
          credibility: 0.85,
        },
      ],
    };
  }
}
