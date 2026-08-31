import type { DataSpec, DeltaReceipt } from '@uvrn/core';
import type { SearchDelegate } from './connectors/search/ClaudeSearchConnector';
import type {
  ClaimClassifier,
  EvidenceItem,
  EvidenceTagger,
  SufficiencyVerdict,
} from './sufficiency/types';

export type { DataSpec, DeltaBundle, DeltaReceipt, MetricPoint } from '@uvrn/core';

export type LatticeTier = 'base' | 'pro' | 'studio';
export type LatticeDepth = 'shallow' | 'standard' | 'deep';
export type DomainResultStatus = 'ok' | 'empty' | 'error';

export interface LatticeTemplate {
  id: string;
  name: string;
  domains: string[];
  signalCategories: string[];
  normalization: string;
  outputFrame: string;
  depth: LatticeDepth;
  tier: LatticeTier;
  explanation: string;
}

export interface DecompositionSpec {
  templateRef: string;
  query: string;
  domains: DomainSpec[];
  explanation: string;
}

export interface DomainSpec {
  id: string;
  label: string;
  signalCategories: string[];
  normalizationProfile: string;
  explanation: string;
}

export interface DomainSignal {
  domainId: string;
  key: string;
  value: number;
  unit?: string;
  source: string;
  /** Optional host-declared origin; forwarded onto bridged EvidenceItem when present. */
  originId?: string;
  ts: string;
  explanation: string;
}

export interface DomainResult {
  domainId: string;
  signals: DomainSignal[];
  score: number;
  status: DomainResultStatus;
  explanation: string;
}

export interface LatticeReceipt {
  receiptId: string;
  query: string;
  templateRef: string;
  decompositionSpec: DecompositionSpec;
  domainsMap: Record<string, DomainResult>;
  deltaReceipt: DeltaReceipt;
  vScore: number;
  weakestDomain: string | null;
  strongestDomain: string | null;
  contradictions: string[];
  interpretation: string;
  explanation: string;
  ts: string;
  sufficiency?: SufficiencyVerdict;
  hash: string;
}

export interface LatticeLogEntry extends LatticeReceipt {
  runId: string;
  runDate: string;
  runTime: string;
  agentVersion: string;
}

// Run-scoped context passed to a connector's fetch(). `timestamp` is the lattice run's single
// timestamp — connectors should prefer it over the wall clock so receipts are reproducible. A
// connector with genuinely time-stamped provenance (a metric measured at a known time) may still
// set its own signal `ts`; the context is the default clock, not a mandate.
export interface ConnectorContext {
  timestamp: string;
}

export interface DomainConnector {
  readonly name: string;
  fetch(query: string, domainSpec: DomainSpec, context?: ConnectorContext): Promise<DomainSignal[]>;
}

export interface LatticeOptions {
  connector?: DomainConnector;
  connectors?: Record<string, DomainConnector>;
  searchDelegate?: SearchDelegate;
  thresholdPct?: number;
  maxRounds?: number;
  timestamp?: string;
  receiptId?: string;
  // Opt-in claim sufficiency. When `claim` is set, runLattice attaches a SufficiencyVerdict to
  // the receipt. Pass provenance evidence via `evidence` (lattice signals alone use mock://
  // sources the default tagger cannot classify).
  claim?: string;
  claimId?: string;
  evidence?: EvidenceItem[];
  claimClassifier?: ClaimClassifier;
  evidenceTagger?: EvidenceTagger;
}

export interface NormalizedDomainBundle {
  dataSpec: DataSpec;
  result: DomainResult;
}
