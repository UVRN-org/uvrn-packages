import type { HumanView } from '@uvrn/receipt';

/**
 * MetaReadout — facts bag projected from HumanView for soft-go conversational context.
 * Soft go ≠ buy. This is not a Meta Indicator SKU and must not order buy/sell/rank.
 */
export interface MetaReadout {
  /** Lined-up / stance signals from HumanView when present */
  linedUp?: {
    support: number;
    oppose: number;
  };
  verdictLabel: string;
  verdictTone: HumanView['verdictTone'];
  verdictDescriptor?: HumanView['verdictDescriptor'];
  headline: string;
  claim: string;
  /** Situation — actionableExplanation when present; never invent drivers */
  situation?: {
    question: string;
    primaryDrivers: Array<{
      id: string;
      kind: string;
      anchor: string;
      fact: string;
      counterfactual?: string;
    }>;
  };
  qualityDiagnostics?: Array<{
    code: string;
    kind: string;
    sourceId: string;
    field: string;
    note: string;
  }>;
  gaps: Array<{ what: string; plainNote: string }>;
  /** Honesty signals for hosts — never invent missing explanation drivers */
  honestyFlags: string[];
  /** Supporting context — scoreCard when present; NOT buy/rank/opportunity law */
  scoreCard?: HumanView['scoreCard'];
  provenance: {
    signed: boolean;
    hash: string;
  };
}
