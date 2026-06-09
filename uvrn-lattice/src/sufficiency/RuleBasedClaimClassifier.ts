import { CLAIM_LADDER } from './ladder';
import type { ClaimClassifier, ClaimLevel, ClaimSpec } from './types';

// Verb/keyword cohorts per claim level. The classifier scans from the strongest level (L5)
// down, so the highest-matching verb wins — burden of proof rises with the strongest claim
// the text actually makes.
const LEVEL_KEYWORDS: Array<{ level: ClaimLevel; keywords: string[] }> = [
  {
    level: 'L5',
    keywords: [
      'durable',
      'sustained',
      'long-term',
      'long term',
      'repeat purchase',
      'retention',
      'cohort',
      'lasting',
      'market expanding',
      'expanding market',
      'enduring',
    ],
  },
  {
    level: 'L4',
    keywords: [
      'succeeding',
      'succeed',
      'profitable',
      'profit',
      'revenue',
      'market share',
      'businesses are',
      'business is',
    ],
  },
  {
    level: 'L3',
    keywords: [
      'buying',
      'buy',
      'purchasing',
      'purchase',
      'selling',
      'sells',
      'sell',
      'sales',
      'demand',
      'outperform',
      'outperforms',
    ],
  },
  {
    level: 'L2',
    keywords: [
      'interested',
      'interest',
      'engaging',
      'engagement',
      'saving',
      'saves',
      'clicking',
      'clicks',
      'growing interest',
    ],
  },
  {
    level: 'L1',
    keywords: [
      'talking about',
      'talking',
      'buzz',
      'mentions',
      'trending',
      'looking',
      'discussed',
      'discussion',
      'awareness',
    ],
  },
];

// Claims with no recognizable verb default to L2 (interest) — the modest bar, not the
// cheapest. Stated as a low-certainty inference in the explanation.
const FALLBACK_LEVEL: ClaimLevel = 'L2';

export class RuleBasedClaimClassifier implements ClaimClassifier {
  readonly name = 'RuleBasedClaimClassifier';

  classify(claimText: string): ClaimSpec {
    const text = claimText.toLowerCase();
    const matched = LEVEL_KEYWORDS.find((cohort) =>
      cohort.keywords.some((keyword) => text.includes(keyword))
    );

    const level = matched?.level ?? FALLBACK_LEVEL;
    const meta = CLAIM_LADDER[level];
    const explanation = matched
      ? `Classified as ${level} (${meta.verbClass}) because the claim asserts ${meta.verbClass}; requires ${meta.requiredEvidence.join(', ')}.`
      : `No clear verb detected; defaulted to ${level} (${meta.verbClass}) as a low-certainty inference. Requires ${meta.requiredEvidence.join(', ')}.`;

    return {
      text: claimText,
      level,
      requiredEvidence: [...meta.requiredEvidence],
      classifier: this.name,
      explanation,
    };
  }
}
