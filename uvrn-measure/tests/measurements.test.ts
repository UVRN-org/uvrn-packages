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

    it('emits no-agreement for missing comparable evidence', () => {
      const result = agreeMeasurement.evaluate({
        claim: 'not enough evidence',
        sources: [{ id: 'a', kind: 'numeric', value: 100 }],
      });

      expect(result.verdict).toBe('no-agreement');
      expect(result.confidence).toBe(0);
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

    it('emits none for missing numeric values', () => {
      const result = disagreeMeasurement.evaluate({
        claim: 'not numeric',
        sources: [{ id: 'a', kind: 'categorical', assertion: 'yes' }],
      });

      expect(result.verdict).toBe('none');
      expect(result.confidence).toBe(0);
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

    it('does not emit conflict for pure numeric spread', () => {
      const result = conflictMeasurement.evaluate({
        claim: 'numeric spread',
        sources: [
          { id: 'a', kind: 'numeric', value: 1 },
          { id: 'b', kind: 'numeric', value: 100 },
        ],
      });

      expect(result.verdict).toBe('none');
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

    it('emits none on thin history', () => {
      const result = potentialMeasurement.evaluate({
        claim: 'thin history',
        sources: [{ id: 'a', kind: 'numeric', value: 1 }],
        context: {
          history: [0.7, 0.8],
        },
      });

      expect(result.verdict).toBe('none');
      expect(result.confidence).toBeLessThan(1);
    });
  });
});
