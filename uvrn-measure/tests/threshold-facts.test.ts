/**
 * D3 threshold facts — parse agree/disagree explanations; disagree→agree hints.
 */

import {
  agreeMeasurement,
  disagreeMeasurement,
  parseAgreeExplanation,
  parseDisagreeExplanation,
  primaryDisagreeToAgreeHint,
  thresholdFactsFromResults,
  withTypedObservation,
} from '../src';

const MONEY_PAIR_SCORE_0818 = [
  withTypedObservation(
    { id: 'src-a', kind: 'numeric', value: 100, label: 'Host A' },
    {
      quantityKind: 'money',
      unit: 'USD',
      unitSource: 'declared',
      field: 'revenue',
      measuredAt: '2026-08-01T00:00:00Z',
      appliesTo: '2026-Q2',
    }
  ),
  withTypedObservation(
    { id: 'src-b', kind: 'numeric', value: 120, label: 'Host B' },
    {
      quantityKind: 'money',
      unit: 'USD',
      unitSource: 'declared',
      field: 'revenue',
      measuredAt: '2026-08-01T00:00:00Z',
      appliesTo: '2026-Q2',
    }
  ),
];

describe('thresholdFactsFromResults (D3)', () => {
  it('parses agree no-agreement score vs threshold from live measurement', () => {
    const result = agreeMeasurement.evaluate({
      claim: 'typed money diverge moderately',
      sources: MONEY_PAIR_SCORE_0818,
    });
    expect(result.verdict).toBe('no-agreement');
    const parsed = parseAgreeExplanation(result.explanation);
    expect(parsed).toEqual({ score: 0.818, threshold: 0.9 });

    const facts = thresholdFactsFromResults([result]);
    expect(facts).toHaveLength(1);
    expect(facts[0].measurementType).toBe('agree');
    expect(facts[0].disagreeToAgreeHint).toBe(
      "They'd need to get closer — at least to about 0.9 — before this counts as agreement."
    );
    expect(primaryDisagreeToAgreeHint(facts)).toContain('at least to about 0.9');
  });

  it('parses disagree spread vs threshold from live measurement', () => {
    const result = disagreeMeasurement.evaluate({
      claim: 'typed money diverge',
      sources: MONEY_PAIR_SCORE_0818,
    });
    expect(result.verdict).toBe('disagree');
    const parsed = parseDisagreeExplanation(result.explanation);
    expect(parsed).toBeDefined();
    expect(parsed!.spread).toBeGreaterThan(parsed!.threshold);

    const facts = thresholdFactsFromResults([result]);
    expect(facts[0].disagreeToAgreeHint).toMatch(/sit much closer together/);
  });

  it('prefers agree gap over disagree gap for primary hint', () => {
    const agree = agreeMeasurement.evaluate({
      claim: 'c',
      sources: MONEY_PAIR_SCORE_0818,
    });
    const disagree = disagreeMeasurement.evaluate({
      claim: 'c',
      sources: MONEY_PAIR_SCORE_0818,
    });
    const hint = primaryDisagreeToAgreeHint(thresholdFactsFromResults([agree, disagree]));
    expect(hint).toMatch(/before this counts as agreement/);
  });

  it('hints never overstate confidence', () => {
    const agree = agreeMeasurement.evaluate({
      claim: 'c',
      sources: MONEY_PAIR_SCORE_0818,
    });
    for (const fact of thresholdFactsFromResults([agree])) {
      const blob = `${fact.explanation} ${fact.disagreeToAgreeHint ?? ''}`;
      expect(blob).not.toMatch(/high(?:ly)?\s+confiden/i);
      expect(blob).not.toMatch(/\bproven\b/i);
      expect(blob).not.toMatch(/\bverified\b/i);
    }
  });
});
