/**
 * Spread → factual driver anchors (BP-v2.1-LATER-D3).
 *
 * Maps an existing SpreadReadout into plain-language facts hosts can surface.
 * Does not invent opportunity scores, ranking weights, or market advice.
 */

import type { SpreadReadout } from './types';

export interface SpreadDriverFact {
  kind: 'spread';
  /** Stable machine id for this fact row. */
  id: string;
  /** Anchor path — always reportSpread fields. */
  anchor: string;
  fact: string;
  /** Optional incomplete-axis note; never a ranking claim. */
  counterfactual?: string;
}

const OVERSTATEMENT =
  /\b(buy\s+now|guaranteed|proven|verified\b|high(?:ly)?\s+confiden(?:t|ce)|act\s+now)\b/i;

/**
 * Convert a SpreadReadout into factual driver rows for actionable explanations.
 * Incomplete axes stay honest (withheld), not zero-filled.
 */
export function spreadToDriverFacts(readout: SpreadReadout): SpreadDriverFact[] {
  const facts: SpreadDriverFact[] = [];

  if (readout.incomplete || readout.magnitude === null || readout.sign === null) {
    const reasons =
      readout.incompleteReasons.length > 0
        ? readout.incompleteReasons.join('; ')
        : 'signed axis incomplete';
    const row: SpreadDriverFact = {
      kind: 'spread',
      id: 'spread.incomplete',
      anchor: 'reportSpread.incompleteReasons',
      fact: `We can't yet say how far demand and supply sit apart — ${reasons}.`,
      counterfactual:
        'Once both sides are present, we could describe that gap as a state of the numbers — not as market advice.',
    };
    assertClean(row);
    facts.push(row);
    return facts;
  }

  const mag = readout.magnitude;
  const sign = readout.sign;
  const signed = readout.signedDivergence;
  const row: SpreadDriverFact = {
    kind: 'spread',
    id: 'spread.divergence',
    anchor: 'reportSpread.magnitude+sign',
    fact:
      `Demand (${readout.demandClass}) and supply (${readout.supplyClass}) sit apart by about ${mag.toFixed(3)}` +
      (signed !== null ? ` (signed gap ${signed.toFixed(3)}, sign ${sign})` : ` (sign ${sign})`) +
      `. ${readout.interpretation}`,
  };
  assertClean(row);
  facts.push(row);
  return facts;
}

function assertClean(row: SpreadDriverFact): void {
  const blob = `${row.fact} ${row.counterfactual ?? ''}`;
  if (OVERSTATEMENT.test(blob)) {
    throw new Error(`spread driver overstatement blocked: ${blob}`);
  }
}
