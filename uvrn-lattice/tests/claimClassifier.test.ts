import { CLAIM_LADDER, RuleBasedClaimClassifier } from '../src';
import type { ClaimLevel } from '../src';

const classifier = new RuleBasedClaimClassifier();

describe('RuleBasedClaimClassifier', () => {
  const cases: Array<{ claim: string; level: ClaimLevel }> = [
    { claim: 'People are talking about maximalism', level: 'L1' },
    { claim: 'Shoppers are interested in dopamine dressing', level: 'L2' },
    { claim: 'People are buying maximalist POD products', level: 'L3' },
    { claim: 'Maximalist POD shops are profitable', level: 'L4' },
    { claim: 'Maximalism is a durable market opportunity', level: 'L5' },
  ];

  it.each(cases)('classifies "$claim" as $level', ({ claim, level }) => {
    const spec = classifier.classify(claim);
    expect(spec.level).toBe(level);
    expect(spec.requiredEvidence).toEqual(CLAIM_LADDER[level].requiredEvidence);
    expect(spec.classifier).toBe('RuleBasedClaimClassifier');
  });

  it('falls back to L2 with a low-confidence note when no verb is detected', () => {
    const spec = classifier.classify('The sky is a pleasant color today');
    expect(spec.level).toBe('L2');
    expect(spec.explanation.toLowerCase()).toContain('low-certainty');
  });

  it('falls back to L2 for domain-general claims without ladder verbs (documented limitation)', () => {
    // The rule-based default is keyword-driven; "inflation is rising" carries no ladder verb,
    // so it defaults to L2. Domain-general claims are better served by an explicit ClaimSpec or
    // an LLM-driven AsyncClaimClassifier.
    expect(classifier.classify('Inflation is rising').level).toBe('L2');
    expect(classifier.classify('Earth is warming').level).toBe('L2');
  });

  it('produces requiredEvidence consistent with CLAIM_LADDER for every level', () => {
    (Object.keys(CLAIM_LADDER) as ClaimLevel[]).forEach((level) => {
      expect(CLAIM_LADDER[level].level).toBe(level);
      expect(CLAIM_LADDER[level].requiredEvidence.length).toBeGreaterThan(0);
    });
  });
});
