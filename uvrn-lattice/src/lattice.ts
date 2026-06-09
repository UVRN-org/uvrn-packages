import { canonicalSerialize, runDeltaEngine } from '@uvrn/core';
import type { DataSpec, DeltaBundle } from '@uvrn/core';
import { createHash } from 'crypto';

import { MockDomainConnector } from './connectors/MockDomainConnector';
import { ClaudeSearchConnector } from './connectors/search/ClaudeSearchConnector';
import { normalizeDomainSignals } from './normalizer/domainNormalizer';
import { TemplateRouter } from './router/TemplateRouter';
import { bridgeFromDomainSignals } from './sufficiency/bridge';
import { verifyClaim } from './sufficiency/verifyClaim';
import type { SufficiencyVerdict } from './sufficiency/types';
import type {
  DomainConnector,
  DomainResult,
  DomainSpec,
  LatticeOptions,
  LatticeReceipt,
  LatticeTemplate,
  NormalizedDomainBundle,
} from './types';

const DEFAULT_THRESHOLD_PCT = 0.1;
const DEFAULT_MAX_ROUNDS = 5;

export async function runLattice(
  query: string,
  template: LatticeTemplate,
  options: LatticeOptions = {}
): Promise<LatticeReceipt> {
  const timestamp = options.timestamp ?? new Date().toISOString();
  const router = new TemplateRouter();
  const decompositionSpec = router.decompose(query, template);

  const domainBundles = await Promise.all(
    decompositionSpec.domains.map(async (domainSpec) => runDomain(query, domainSpec, options, timestamp))
  );

  const domainsMap = domainBundles.reduce<Record<string, DomainResult>>((acc, bundle) => {
    acc[bundle.result.domainId] = bundle.result;
    return acc;
  }, {});

  const dataSpecs = domainBundles
    .filter((bundle) => bundle.result.status === 'ok')
    .map((bundle) => bundle.dataSpec);

  if (dataSpecs.length < 2) {
    throw new Error(`runLattice requires at least 2 domains with usable numeric signals. Received ${dataSpecs.length}.`);
  }

  const deltaBundle = buildDeltaBundle(query, template.id, dataSpecs, options);
  const deltaReceipt = runDeltaEngine(deltaBundle, { timestamp });
  const receiptId = options.receiptId ?? buildReceiptId(template.id, query, timestamp);
  const strongestDomain = pickDomain(domainsMap, 'strongest');
  const weakestDomain = pickDomain(domainsMap, 'weakest');
  const sufficiency = buildSufficiency(domainBundles, options, timestamp);

  const receiptPayload: Omit<LatticeReceipt, 'hash'> = {
    receiptId,
    query,
    templateRef: template.id,
    decompositionSpec,
    domainsMap,
    deltaReceipt,
    vScore: deltaReceipt.deltaFinal,
    weakestDomain,
    strongestDomain,
    contradictions: [],
    interpretation: buildInterpretation(deltaReceipt.deltaFinal, strongestDomain, weakestDomain),
    explanation: 'Lattice receipt assembled from domain signals and scored by @uvrn/core runDeltaEngine().',
    ts: timestamp,
    ...(sufficiency ? { sufficiency } : {}),
  };

  return {
    ...receiptPayload,
    hash: hashLatticeReceipt(receiptPayload),
  };
}

async function runDomain(
  query: string,
  domainSpec: DomainSpec,
  options: LatticeOptions,
  timestamp: string
): Promise<{ dataSpec: DataSpec; result: DomainResult }> {
  const connector = resolveConnector(domainSpec.id, options);

  try {
    const signals = await connector.fetch(query, domainSpec, { timestamp });
    return normalizeDomainSignals(domainSpec.id, domainSpec.label, signals);
  } catch (error) {
    const result: DomainResult = {
      domainId: domainSpec.id,
      signals: [],
      score: 0,
      status: 'error',
      explanation: `${domainSpec.label} connector failed: ${error instanceof Error ? error.message : String(error)}`,
    };

    return {
      dataSpec: {
        id: `domain-${domainSpec.id}`,
        label: domainSpec.label,
        sourceKind: 'metric',
        originDocIds: [],
        metrics: [],
      },
      result,
    };
  }
}

// Opt-in claim sufficiency. Only runs when `options.claim` is set. Provenance evidence passed
// via `options.evidence` is merged with evidence bridged from the domain signals — the bridge
// augments, it does not substitute (lattice signal sources rarely map to the default taxonomy).
function buildSufficiency(
  domainBundles: NormalizedDomainBundle[],
  options: LatticeOptions,
  timestamp: string
): SufficiencyVerdict | undefined {
  if (!options.claim) {
    return undefined;
  }

  const signals = domainBundles.flatMap((bundle) => bundle.result.signals);
  const bridged = bridgeFromDomainSignals(signals, options.evidenceTagger);
  const evidence = [...(options.evidence ?? []), ...bridged];

  return verifyClaim(options.claim, evidence, {
    classifier: options.claimClassifier,
    tagger: options.evidenceTagger,
    claimId: options.claimId,
    ts: timestamp,
  });
}

function resolveConnector(domainId: string, options: LatticeOptions): DomainConnector {
  return (
    options.connectors?.[domainId] ??
    options.connector ??
    (options.searchDelegate
      ? new ClaudeSearchConnector({ delegate: options.searchDelegate })
      : new MockDomainConnector())
  );
}

function buildDeltaBundle(
  query: string,
  templateRef: string,
  dataSpecs: DataSpec[],
  options: LatticeOptions
): DeltaBundle {
  return {
    bundleId: buildBundleId(templateRef, query, dataSpecs),
    claim: query,
    dataSpecs,
    thresholdPct: options.thresholdPct ?? DEFAULT_THRESHOLD_PCT,
    maxRounds: options.maxRounds ?? DEFAULT_MAX_ROUNDS,
  };
}

function buildBundleId(templateRef: string, query: string, dataSpecs: DataSpec[]): string {
  const seed = `${templateRef}|${query}|${dataSpecs.map((spec) => spec.id).sort().join('|')}`;
  return `lattice-${shortHash(seed)}`;
}

function buildReceiptId(templateRef: string, query: string, timestamp: string): string {
  return `lattice-receipt-${shortHash(`${templateRef}|${query}|${timestamp}`)}`;
}

function pickDomain(domainsMap: Record<string, DomainResult>, mode: 'strongest' | 'weakest'): string | null {
  const domains = Object.values(domainsMap).filter((domain) => domain.status === 'ok');

  if (domains.length === 0) {
    return null;
  }

  const sorted = domains.sort((left, right) => left.score - right.score);
  return mode === 'weakest' ? sorted[0]?.domainId ?? null : sorted[sorted.length - 1]?.domainId ?? null;
}

function buildInterpretation(vScore: number, strongestDomain: string | null, weakestDomain: string | null): string {
  const outcome = vScore <= DEFAULT_THRESHOLD_PCT ? 'within consensus threshold' : 'outside consensus threshold';
  const strength = strongestDomain ? ` Strongest domain: ${strongestDomain}.` : '';
  const weakness = weakestDomain ? ` Weakest domain: ${weakestDomain}.` : '';

  return `Core deltaFinal is ${vScore}, which is ${outcome}.${strength}${weakness}`;
}

function hashLatticeReceipt(receiptPayload: Omit<LatticeReceipt, 'hash'>): string {
  return createHash('sha256').update(canonicalSerialize(receiptPayload)).digest('hex');
}

function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}
