/**
 * D1 measurement sensitivity — host-configurable agreeThreshold with typed observations.
 * Proves default 0.9 is unchanged; overrides change agree/potential verdicts.
 * Uses host-declared quantityKind/unit attributes — never prose/title scrape.
 */

import {
  agreeMeasurement,
  potentialMeasurement,
  withTypedObservation,
} from '../src';

/** Numeric pair with agreement score ≈ 0.818 (spread 20/110). */
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

/** Rising history ending at 0.85 — unsettled at default 0.9, settled at 0.8. */
const RISING_HISTORY_085 = [0.55, 0.7, 0.85];

describe('agreeThreshold host sensitivity (typed observations)', () => {
  describe('default remains 0.9', () => {
    it('omitted agreeThreshold matches explicit 0.9 on the same typed pair', () => {
      const claim = 'typed money sources diverge moderately';
      const without = agreeMeasurement.evaluate({
        claim,
        sources: MONEY_PAIR_SCORE_0818,
      });
      const withDefault = agreeMeasurement.evaluate({
        claim,
        sources: MONEY_PAIR_SCORE_0818,
        context: { agreeThreshold: 0.9 },
      });

      expect(without.verdict).toBe('no-agreement');
      expect(withDefault.verdict).toBe('no-agreement');
      expect(without.confidence).toBeCloseTo(withDefault.confidence, 5);
      expect(without.confidence).toBeGreaterThan(0.8);
      expect(without.confidence).toBeLessThan(0.9);
    });
  });

  describe('at least two host override values', () => {
    it('agreeThreshold 0.75 fires agree for typed money observations', () => {
      const result = agreeMeasurement.evaluate({
        claim: 'host lowers threshold for this run only',
        sources: MONEY_PAIR_SCORE_0818,
        context: { agreeThreshold: 0.75 },
      });

      expect(result.verdict).toBe('agree');
      expect(result.confidence).toBeGreaterThanOrEqual(0.75);
      expect(result.explanation).toContain('threshold 0.75');
      expect(MONEY_PAIR_SCORE_0818[0].attributes?.quantityKind).toBe('money');
      expect(MONEY_PAIR_SCORE_0818[0].attributes?.unitSource).toBe('declared');
    });

    it('agreeThreshold 0.95 keeps no-agreement for the same typed money observations', () => {
      const result = agreeMeasurement.evaluate({
        claim: 'host raises threshold for this run only',
        sources: MONEY_PAIR_SCORE_0818,
        context: { agreeThreshold: 0.95 },
      });

      expect(result.verdict).toBe('no-agreement');
      expect(result.confidence).toBeLessThan(0.95);
      expect(result.explanation).toContain('threshold 0.95');
    });
  });

  describe('potential sensitivity via same host knob', () => {
    const typedSeed = [
      withTypedObservation(
        { id: 'seed', kind: 'numeric', value: 1 },
        {
          quantityKind: 'percentage',
          unit: '%',
          unitSource: 'declared',
          field: 'agreement-score',
        }
      ),
    ];

    it('agreeThreshold 0.9 treats rising history ending 0.85 as potential', () => {
      const result = potentialMeasurement.evaluate({
        claim: 'emerging agreement',
        sources: typedSeed,
        context: {
          agreeThreshold: 0.9,
          history: RISING_HISTORY_085,
        },
      });

      expect(result.verdict).toBe('potential');
    });

    it('agreeThreshold 0.8 treats the same history as settled (none)', () => {
      const result = potentialMeasurement.evaluate({
        claim: 'emerging agreement',
        sources: typedSeed,
        context: {
          agreeThreshold: 0.8,
          history: RISING_HISTORY_085,
        },
      });

      expect(result.verdict).toBe('none');
      expect(result.explanation).toContain('threshold=0.8');
    });
  });

  describe('no prose scrape path', () => {
    it('withTypedObservation does not invent quantityKind from claim or label text', () => {
      const bare = {
        id: 'prose-trap',
        kind: 'numeric' as const,
        value: 42,
        label: 'Revenue grew 12% in Q2 according to the forecast title',
      };
      const typed = withTypedObservation(bare, {
        quantityKind: 'count',
        unit: '1',
        unitSource: 'declared',
        field: 'units-sold',
      });

      expect(typed.attributes?.quantityKind).toBe('count');
      expect(typed.attributes?.quantityKind).not.toBe('percentage');
      expect(typed.attributes?.quantityKind).not.toBe('money');
      expect(typed.label).toBe(bare.label);
    });
  });
});
