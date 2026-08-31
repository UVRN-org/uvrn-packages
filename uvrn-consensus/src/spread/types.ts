// Spread pillar types (BP-v2.1-Spread).
// Role is claim-relative; host-owned when declared. Packages = capability; apps own narrative.
//
// EvidenceClass home (Build disposition — accept Adversary/argument-pool):
// Mirrored here from `@uvrn/lattice` so `@uvrn/consensus` stays free of a lattice peer
// for this additive readout. HANDOFF must keep the union aligned with lattice.

/**
 * Evidence population class used to partition agreement and spread.
 * Must stay aligned with `@uvrn/lattice` `EvidenceClass` (mirror — not a second taxonomy).
 */
export type EvidenceClass =
  | 'attention'
  | 'interest'
  | 'supply_entry'
  | 'purchase'
  | 'repeat_purchase'
  | 'commercial_outcome'
  | 'market_expansion';

/** How the role for a source was obtained for this claim. */
export type RoleProvenance = 'declared' | 'assumed' | 'no_role' | 'unknown';

/**
 * Claim-relative role assignment for one source.
 * Host supplies role for the active claim; packages do not invent a global source registry.
 * Optional `claimId` is host bookkeeping only (not required for math).
 * - `declared`: host supplied the class for this claim
 * - `assumed`: agent may assume only with `why` provenance
 * - `no_role` / `unknown`: honest missing label — data still organized
 */
export interface RoleAssignment {
  provenance: RoleProvenance;
  /** Present when provenance is declared or assumed. Absent for no_role/unknown. */
  evidenceClass?: EvidenceClass;
  /** Required when provenance === 'assumed'. */
  why?: string;
  /** Optional host claim key — documents claim-relative binding; unused by math. */
  claimId?: string;
}

/** One numeric observation with optional claim-relative role. */
export interface SpreadSourceInput {
  id: string;
  metricValue: number;
  /** Distinct origin identity for within-class agreement (SPEC §7.2 style). */
  originId?: string;
  /** Host- or agent-supplied role for this claim. Missing → labeled no_role. */
  role?: RoleAssignment;
}

export type SpreadSign = -1 | 0 | 1;

export interface ClassAgreementPartition {
  evidenceClass: EvidenceClass;
  originAgreementScore: number;
  distinctOriginCount: number;
  sourceCount: number;
  /** True when any retained row in this partition lacked originId. */
  originIncomplete: boolean;
}

export interface ClassPartitionedAgreementResult {
  partitions: ClassAgreementPartition[];
  /** Lowest within-class origin agreement among complete partitions (if any). */
  withinClassMinAgreement: number | null;
  /**
   * True when two or more declared/assumed EvidenceClass partitions are present.
   * Presence only — not a measured numeric divergence (use `reportSpread` for that).
   */
  multipleClassesPresent: boolean;
  incomplete: boolean;
  incompleteReasons: string[];
  /** Organized rows including no_role/unknown/incompleteAssumed — never dropped. */
  organized: OrganizedSpreadSources;
}

export interface OrganizedSpreadSources {
  byClass: Record<EvidenceClass, SpreadSourceInput[]>;
  /** True missing-role / declared-without-class labels. */
  noRole: SpreadSourceInput[];
  /** Assumed rows missing why and/or evidenceClass — separate from noRole. */
  incompleteAssumed: SpreadSourceInput[];
  unknown: SpreadSourceInput[];
  assumed: SpreadSourceInput[];
  declared: SpreadSourceInput[];
}

export interface SpreadPartitionSummary {
  evidenceClass: EvidenceClass;
  representativeValue: number | null;
  originAgreementScore: number;
  distinctOriginCount: number;
  sourceCount: number;
}

/**
 * Named C-3 spread readout.
 * Reports divergence state (magnitude + sign) — not an opportunity/accuracy score
 * and not a market verdict.
 *
 * When the signed axis cannot be computed, `magnitude` / `sign` / `signedDivergence`
 * are **null** (withheld) — not `0` — so incomplete is distinct from balanced (0/0).
 */
export interface SpreadReadout {
  /** Relative gap |demand−supply| / midpoint; null when withheld (incomplete axis). */
  magnitude: number | null;
  /** Sign of demand−supply; null when withheld. Balanced complete axis uses 0. */
  sign: SpreadSign | null;
  /** magnitude * sign when both present; null when withheld. */
  signedDivergence: number | null;
  demandClass: EvidenceClass;
  supplyClass: EvidenceClass;
  demandRepresentative: number | null;
  supplyRepresentative: number | null;
  partitions: SpreadPartitionSummary[];
  classAgreement: ClassPartitionedAgreementResult;
  incomplete: boolean;
  incompleteReasons: string[];
  /**
   * Short state description only. Never claims opportunity, buy-now edge, or accuracy.
   */
  interpretation: string;
}

export interface ReportSpreadOptions {
  /** Demand-side class for signed axis (default `attention`). */
  demandClass?: EvidenceClass;
  /** Supply-side class for signed axis (default `supply_entry`). */
  supplyClass?: EvidenceClass;
}
