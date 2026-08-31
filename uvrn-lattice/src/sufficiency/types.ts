// Claim ↔ Evidence Sufficiency types.
//
// Sufficiency asks "is the RIGHT KIND of evidence present for this claim?" — a different
// question from the V-Score, which measures whether sources agree (consensus). The verdict
// here is coverage-based and never re-derives delta math. The score field is named
// `evidenceCoverageScore`, deliberately NOT `confidence`, to avoid collision with the
// V-Score (which is loosely called "confidence" elsewhere in the protocol).

// Claim ladder — burden of proof rises with the verb class of the claim.
export type ClaimLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

// Evidence taxonomy — each class proves ONE claim class. These are different claims, not
// weaker/stronger versions of one claim.
export type EvidenceClass =
  | 'attention' // people are talking/looking: search & social volume
  | 'interest' // engagement, saves, clicks, search growth
  | 'supply_entry' // sellers/producers entering the market
  | 'purchase' // people are buying: sales, marketplace velocity
  | 'repeat_purchase' // people repeatedly buying: BSR, reorder, retention
  | 'commercial_outcome' // businesses succeeding: profit, revenue growth, market share
  | 'market_expansion'; // the market is durably growing: longitudinal, cohort, macro records

export type SufficiencyStatus = 'Supported' | 'Unverified';
export type CoverageBand = 'none' | 'low' | 'moderate' | 'high';

export interface ClaimLevelMeta {
  level: ClaimLevel;
  verbClass: string;
  description: string;
  requiredEvidence: EvidenceClass[];
  explanation: string;
}

// A single piece of obtained evidence, tagged with the class it is licensed to prove.
export interface EvidenceItem {
  evidenceClass: EvidenceClass;
  source: string;
  /**
   * Host-declared origin identity for distinct-origin corroboration (F-1 path a).
   * Prefer host-supplied values. When absent, origin-aware corroboration is incomplete —
   * bare `source` strings are not treated as distinct origins.
   */
  originId?: string;
  key?: string;
  value?: number; // optional 0..100 strength; only used in scoring when a genuine strength signal
  ts?: string;
  explanation: string;
}

// Raw evidence that has not yet been classified — fed to an EvidenceTagger.
export interface TaggableEvidence {
  source: string;
  /** Optional host-declared origin; forwarded onto EvidenceItem when present. */
  originId?: string;
  key?: string;
  value?: number;
  ts?: string;
  explanation?: string;
}

// A claim after classification onto the ladder.
export interface ClaimSpec {
  text: string;
  level: ClaimLevel;
  requiredEvidence: EvidenceClass[];
  classifier: string; // provenance: which classifier produced this spec
  explanation: string;
  claimId?: string;
}

export interface SufficiencyVerdict {
  claim: string;
  claimId?: string;
  level: ClaimLevel;
  status: SufficiencyStatus;
  coverageBand: CoverageBand;
  evidenceCoverageScore: number; // 0..1, coverage-based — NOT the V-Score; NOT accuracy
  requiredEvidence: EvidenceClass[];
  obtainedEvidence: EvidenceClass[];
  missingEvidence: EvidenceClass[];
  matchedEvidence: EvidenceClass[];
  licensedClaimLevel: ClaimLevel | null; // highest level the obtained evidence can actually support
  /** Count of unique non-empty originId values among matched evidence items. */
  distinctOriginCount: number;
  /**
   * True when any matched item lacks a host-declared originId — origin-aware corroboration
   * is incomplete (no invented origins from bare source strings).
   */
  originCorroborationIncomplete: boolean;
  interpretation: string;
  explanation: string;
  ts: string;
}

export interface ClaimClassifier {
  readonly name: string;
  classify(claimText: string): ClaimSpec;
}

// Async variant for LLM-driven classifiers — returns the same ClaimSpec shape.
export interface AsyncClaimClassifier {
  readonly name: string;
  classify(claimText: string): Promise<ClaimSpec>;
}

export interface EvidenceTagger {
  readonly name: string;
  tag(input: TaggableEvidence): EvidenceItem | null; // null = source cannot be classified
}
