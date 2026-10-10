import {
  agreeMeasurement,
  conflictMeasurement,
  disagreeMeasurement,
  potentialMeasurement,
} from '../src';

describe('@uvrn/measure starter measurements', () => {
  describe('agreeMeasurement', () => {
    it('emits agree when numeric sources converge within threshold', () => {
      const result = agreeMeasurement.evaluate({
        claim: 'sources converge',
        sources: [
          { id: 'a', kind: 'numeric', value: 100 },
          { id: 'b', kind: 'numeric', value: 104 },
        ],
      });

      expect(result.verdict).toBe('agree');
      expect(result.evidenceRefs).toEqual(['a', 'b']);
    });

    it('emits no-agreement when numeric sources are too far apart', () => {
      const result = agreeMeasurement.evaluate({
        claim: 'sources diverge',
        sources: [
          { id: 'a', kind: 'numeric', value: 100 },
          { id: 'b', kind: 'numeric', value: 150 },
        ],
      });

      expect(result.verdict).toBe('no-agreement');
    });

    it('emits insufficient-data for missing comparable evidence', () => {
      const result = agreeMeasurement.evaluate({
        claim: 'not enough evidence',
        sources: [{ id: 'a', kind: 'numeric', value: 100 }],
      });

      expect(result.verdict).toBe('insufficient-data');
      expect(result.confidence).toBe(0);
    });

    it('explains what was missing on insufficient-data', () => {
      const result = agreeMeasurement.evaluate({
        claim: 'not enough evidence',
        sources: [{ id: 'a', kind: 'numeric', value: 100 }],
      });

      expect(result.verdict).toBe('insufficient-data');
      expect(result.explanation).toBe('Agree requires at least two comparable evidence sources; received 1 usable.');
    });
  });

  describe('disagreeMeasurement', () => {
    it('emits disagree for material numeric spread', () => {
      const result = disagreeMeasurement.evaluate({
        claim: 'sources diverge',
        sources: [
          { id: 'a', kind: 'numeric', value: 100 },
          { id: 'b', kind: 'numeric', value: 150 },
        ],
      });

      expect(result.verdict).toBe('disagree');
    });

    it('emits none when numeric spread is below threshold', () => {
      const result = disagreeMeasurement.evaluate({
        claim: 'sources close enough',
        sources: [
          { id: 'a', kind: 'numeric', value: 100 },
          { id: 'b', kind: 'numeric', value: 104 },
        ],
      });

      expect(result.verdict).toBe('none');
    });

    it('emits insufficient-data for missing numeric values', () => {
      const result = disagreeMeasurement.evaluate({
        claim: 'not numeric',
        sources: [{ id: 'a', kind: 'categorical', assertion: 'yes' }],
      });

      expect(result.verdict).toBe('insufficient-data');
      expect(result.confidence).toBe(0);
    });

    it('explains what was missing on insufficient-data', () => {
      const result = disagreeMeasurement.evaluate({
        claim: 'one numeric value',
        sources: [
          { id: 'a', kind: 'numeric', value: 100 },
          { id: 'b', kind: 'categorical', assertion: 'yes' },
        ],
      });

      expect(result.verdict).toBe('insufficient-data');
      expect(result.explanation).toBe('Disagree requires at least two numeric evidence values; received 1.');
    });
  });

  describe('conflictMeasurement', () => {
    it('emits conflict for mutually exclusive categorical assertions on the same field', () => {
      const result = conflictMeasurement.evaluate({
        claim: 'weather claim',
        sources: [
          { id: 'a', kind: 'categorical', assertion: 'rain', attributes: { field: 'weather' } },
          { id: 'b', kind: 'categorical', assertion: 'sun', attributes: { field: 'weather' } },
        ],
      });

      expect(result.verdict).toBe('conflict');
      expect(result.evidenceRefs).toEqual(['a', 'b']);
    });

    it('emits conflict for disjoint ranges on the same field', () => {
      const result = conflictMeasurement.evaluate({
        claim: 'range claim',
        sources: [
          { id: 'a', kind: 'range', range: { min: 1, max: 3 }, attributes: { field: 'count' } },
          { id: 'b', kind: 'range', range: { min: 5, max: 7 }, attributes: { field: 'count' } },
        ],
      });

      expect(result.verdict).toBe('conflict');
    });

    it('emits none when matching assertions provide no exclusion', () => {
      const result = conflictMeasurement.evaluate({
        claim: 'agreeing assertions',
        sources: [
          { id: 'a', kind: 'categorical', assertion: 'rain', attributes: { field: 'weather' } },
          { id: 'b', kind: 'categorical', assertion: 'Rain', attributes: { field: 'weather' } },
        ],
      });

      expect(result.verdict).toBe('none');
    });

    it('emits insufficient-data for pure numeric spread', () => {
      const result = conflictMeasurement.evaluate({
        claim: 'numeric spread',
        sources: [
          { id: 'a', kind: 'numeric', value: 1 },
          { id: 'b', kind: 'numeric', value: 100 },
        ],
      });

      expect(result.verdict).not.toBe('conflict');
      expect(result.verdict).toBe('insufficient-data');
    });

    it('emits none when conflictRangeTolerance absorbs the range gap', () => {
      const result = conflictMeasurement.evaluate({
        claim: 'tolerated gap',
        sources: [
          { id: 'a', kind: 'range', range: { min: 1, max: 3 }, attributes: { field: 'count' } },
          { id: 'b', kind: 'range', range: { min: 8, max: 10 }, attributes: { field: 'count' } },
        ],
        context: { conflictRangeTolerance: 10 },
      });

      expect(result.verdict).toBe('none');
    });

    it('emits conflict when the range gap exceeds conflictRangeTolerance', () => {
      const result = conflictMeasurement.evaluate({
        claim: 'material gap',
        sources: [
          { id: 'a', kind: 'range', range: { min: 1, max: 3 }, attributes: { field: 'count' } },
          { id: 'b', kind: 'range', range: { min: 8, max: 10 }, attributes: { field: 'count' } },
        ],
        context: { conflictRangeTolerance: 2 },
      });

      expect(result.verdict).toBe('conflict');
      expect(result.evidenceRefs).toEqual(['a', 'b']);
    });

    it('explains what was missing on insufficient-data', () => {
      const result = conflictMeasurement.evaluate({
        claim: 'one assertion',
        sources: [{ id: 'a', kind: 'categorical', assertion: 'rain' }],
      });

      expect(result.verdict).toBe('insufficient-data');
      expect(result.explanation).toBe('Conflict requires at least two categorical, boolean, or range assertions; received 1.');
    });
  });

  describe('potentialMeasurement', () => {
    it('emits potential when agreement is rising but still below threshold', () => {
      const result = potentialMeasurement.evaluate({
        claim: 'emerging agreement',
        sources: [{ id: 'a', kind: 'numeric', value: 1 }],
        context: {
          agreeThreshold: 0.9,
          history: [0.45, 0.55, 0.7],
        },
      });

      expect(result.verdict).toBe('potential');
      expect(result.confidence).toBeGreaterThanOrEqual(0.25);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('emits none when history is already at agreement threshold', () => {
      const result = potentialMeasurement.evaluate({
        claim: 'settled agreement',
        sources: [{ id: 'a', kind: 'numeric', value: 1 }],
        context: {
          agreeThreshold: 0.9,
          history: [0.7, 0.85, 0.92],
        },
      });

      expect(result.verdict).toBe('none');
    });

    it('emits insufficient-data on thin history', () => {
      const result = potentialMeasurement.evaluate({
        claim: 'thin history',
        sources: [{ id: 'a', kind: 'numeric', value: 1 }],
        context: {
          history: [0.7, 0.8],
        },
      });

      expect(result.verdict).toBe('insufficient-data');
      expect(result.confidence).toBe(0);
    });

    it('emits insufficient-data instead of potential when confidence is below the floor', () => {
      const result = potentialMeasurement.evaluate({
        claim: 'weak early signal',
        sources: [{ id: 'a', kind: 'numeric', value: 1 }],
        context: {
          agreeThreshold: 0.9,
          history: [0.1, 0.15, 0.2],
        },
      });

      expect(result.verdict).not.toBe('potential');
      expect(result.verdict).toBe('insufficient-data');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(0.25);
      expect(result.explanation).toContain('below the 0.25 floor');
    });

    it('explains what was missing on insufficient-data', () => {
      const result = potentialMeasurement.evaluate({
        claim: 'thin history',
        sources: [{ id: 'a', kind: 'numeric', value: 1 }],
        context: {
          history: [0.7, 0.8],
        },
      });

      expect(result.verdict).toBe('insufficient-data');
      expect(result.explanation).toBe('Potential requires at least 3 observations; received 2.');
    });
  });
});
