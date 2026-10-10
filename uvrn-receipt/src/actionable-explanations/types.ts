/**
 * Actionable explanations (BP-v2.1-LATER-D3) — render-only types.
 * Never enter NETWORK_RECEIPT_HASH_FIELDS or master/delta hash lists.
 */

export type SplitDriverKind =
  | 'measurement'
  | 'stance'
  | 'source-quality'
  | 'spread'
  | 'gap';

/** One factual driver of split / disagree, with optional disagree→agree counterfactual. */
export interface SplitDriver {
  /** Stable machine id (e.g. `measurement.agree.no-agreement`). */
  id: string;
  kind: SplitDriverKind;
  /** Factual anchor path (measurement explanation, stanceSummary, diagnostic code, etc.). */
  anchor: string;
  /** Plain-language fact grounded in the anchor. */
  fact: string;
  /** Answers “what would move disagree → agree?” when derivable from facts. */
  counterfactual?: string;
}

/** Host-facing actionable explanation block for humanView. */
export interface ActionableExplanation {
  question: 'disagree-to-agree';
  /** Deterministic primary drivers (measurement first, then stance, quality, spread, gaps). */
  primaryDrivers: SplitDriver[];
}

/**
 * Optional host-supplied spread facts (from `@uvrn/consensus` `spreadToDriverFacts`).
 * Kept structurally local so `@uvrn/receipt` does not depend on consensus.
 */
export interface SpreadDriverFactInput {
  id: string;
  anchor: string;
  fact: string;
  counterfactual?: string;
}
