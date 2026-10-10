import {
  agreeMeasurement,
  conflictMeasurement,
  disagreeMeasurement,
  stanceToMeasurementSources,
  type StanceSource,
} from '../src';

const quorumMet = require('../../SPEC/vectors/stance-quorum-met.json');
const opposing = require('../../SPEC/vectors/stance-opposing-conflict.json');

describe('stanceToMeasurementSources (ADR-011)', () => {
  test.each([
    ['stance-quorum-met', quorumMet],
    ['stance-opposing-conflict', opposing],
  ])('executes BP-01 vector %s', (_name, vector) => {
    const input = vector.input.sources as StanceSource[];
    const projection = stanceToMeasurementSources(input);

    expect(projection).toEqual(vector.expected.projection);
    expect(
      agreeMeasurement.evaluate({ claim: vector.claim, sources: projection.numeric })
    ).toEqual(vector.expected.measurements.agree);
    expect(
      disagreeMeasurement.evaluate({ claim: vector.claim, sources: projection.numeric })
    ).toEqual(vector.expected.measurements.disagree);
    expect(
      conflictMeasurement.evaluate({
        claim: vector.claim,
        sources: projection.categorical,
      })
    ).toEqual(vector.expected.measurements.conflict);
  });

  it('confidence-gates without mutating or guessing invalid evidence', () => {
    const sources: StanceSource[] = [
      {
        id: 'low',
        stanceValue: 1,
        stanceLabel: 'supports',
        stanceConfidence: 0.59,
        stanceEvidence: 'Grounded text.',
      },
      {
        id: 'mixed',
        stanceValue: 0.2,
        stanceLabel: 'mixed',
        stanceConfidence: 0.8,
        stanceEvidence: 'Mixed evidence.',
      },
    ];
    const before = JSON.stringify(sources);

    expect(stanceToMeasurementSources(sources)).toEqual({
      numeric: [
        {
          id: 'mixed',
          kind: 'numeric',
          value: 0.2,
          attributes: { field: 'claim-stance', stanceLabel: 'mixed' },
        },
      ],
      categorical: [],
    });
    expect(JSON.stringify(sources)).toBe(before);
  });
});
