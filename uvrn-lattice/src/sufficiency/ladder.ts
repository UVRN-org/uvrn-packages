import type { ClaimLevel, ClaimLevelMeta, EvidenceClass } from './types';

// The claim ladder. Burden of proof rises with the verb: "talking" needs only attention,
// "buying" needs purchase evidence, "durable opportunity" needs longitudinal proof.
export const CLAIM_LADDER: Record<ClaimLevel, ClaimLevelMeta> = {
  L1: {
    level: 'L1',
    verbClass: 'talking',
    description: 'people are talking about it',
    requiredEvidence: ['attention'],
    explanation: 'L1 asserts attention; requires search/social volume.',
  },
  L2: {
    level: 'L2',
    verbClass: 'interest',
    description: 'people are interested',
    requiredEvidence: ['interest'],
    explanation: 'L2 asserts interest; requires engagement, saves, clicks, or search growth.',
  },
  L3: {
    level: 'L3',
    verbClass: 'buying',
    description: 'people are buying',
    requiredEvidence: ['purchase'],
    explanation:
      'L3 asserts buying; requires purchase evidence. Seller entry (supply) is supportive but not sufficient.',
  },
  L4: {
    level: 'L4',
    verbClass: 'succeeding',
    description: 'businesses are succeeding because of it',
    requiredEvidence: ['commercial_outcome'],
    explanation: 'L4 asserts commercial success; requires profit, revenue growth, or market share.',
  },
  L5: {
    level: 'L5',
    verbClass: 'durable',
    description: 'this is a durable market opportunity',
    requiredEvidence: ['market_expansion', 'repeat_purchase'],
    explanation:
      'L5 asserts a durable opportunity; requires longitudinal market expansion and repeat purchase.',
  },
};

// Ladder order, weakest to strongest. Used to compute the highest level a given evidence
// set can license.
export const LADDER_ORDER: ClaimLevel[] = ['L1', 'L2', 'L3', 'L4', 'L5'];

// Domain-general source/keyword -> evidence class taxonomy. Checked in order, so more
// specific phrases ("revenue growth", "etsy sales") must precede generic ones ("revenue",
// "sales"). Matching is case-insensitive substring against an evidence source or key.
//
// This table is what makes the layer domain-general: "Earth is warming" maps via temperature
// records to market_expansion; "inflation is rising" via CPI/PPI; "AI adoption accelerating"
// via adoption/usage.
export const EVIDENCE_TAXONOMY: Array<{ match: string; evidenceClass: EvidenceClass }> = [
  // interest (specific search phrasing before attention's generic "search")
  { match: 'search growth', evidenceClass: 'interest' },
  { match: 'saves', evidenceClass: 'interest' },
  { match: 'clicks', evidenceClass: 'interest' },
  { match: 'engagement', evidenceClass: 'interest' },
  { match: 'intent', evidenceClass: 'interest' },
  // attention
  { match: 'pinterest', evidenceClass: 'attention' },
  { match: 'tiktok', evidenceClass: 'attention' },
  { match: 'google trends', evidenceClass: 'attention' },
  { match: 'trends', evidenceClass: 'attention' },
  { match: 'search volume', evidenceClass: 'attention' },
  { match: 'mentions', evidenceClass: 'attention' },
  { match: 'buzz', evidenceClass: 'attention' },
  // supply entry
  { match: 'etsy listings', evidenceClass: 'supply_entry' },
  { match: 'new listings', evidenceClass: 'supply_entry' },
  { match: 'listings', evidenceClass: 'supply_entry' },
  { match: 'sellers', evidenceClass: 'supply_entry' },
  // purchase (etsy sales before generic sales)
  { match: 'etsy sales', evidenceClass: 'purchase' },
  { match: 'marketplace velocity', evidenceClass: 'purchase' },
  { match: 'units sold', evidenceClass: 'purchase' },
  { match: 'sales', evidenceClass: 'purchase' },
  { match: 'orders', evidenceClass: 'purchase' },
  // repeat purchase
  { match: 'amazon bsr', evidenceClass: 'repeat_purchase' },
  { match: 'best seller rank', evidenceClass: 'repeat_purchase' },
  { match: 'bsr', evidenceClass: 'repeat_purchase' },
  { match: 'reorder', evidenceClass: 'repeat_purchase' },
  { match: 'repeat', evidenceClass: 'repeat_purchase' },
  { match: 'retention', evidenceClass: 'repeat_purchase' },
  // commercial outcome (revenue growth before revenue)
  { match: 'revenue growth', evidenceClass: 'commercial_outcome' },
  { match: 'revenue', evidenceClass: 'commercial_outcome' },
  { match: 'profit', evidenceClass: 'commercial_outcome' },
  { match: 'market share', evidenceClass: 'commercial_outcome' },
  { match: 'margin', evidenceClass: 'commercial_outcome' },
  // market expansion (domain-general macro proof)
  { match: 'longitudinal', evidenceClass: 'market_expansion' },
  { match: 'cohort', evidenceClass: 'market_expansion' },
  { match: 'temperature record', evidenceClass: 'market_expansion' },
  { match: 'temperature', evidenceClass: 'market_expansion' },
  { match: 'cpi', evidenceClass: 'market_expansion' },
  { match: 'ppi', evidenceClass: 'market_expansion' },
  { match: 'gdp', evidenceClass: 'market_expansion' },
  { match: 'adoption rate', evidenceClass: 'market_expansion' },
  { match: 'adoption', evidenceClass: 'market_expansion' },
  { match: 'market expansion', evidenceClass: 'market_expansion' },
];
