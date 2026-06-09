import type {
  Measurement,
  MeasurementInput,
  MeasurementResult,
  MeasurementSource,
  NodeStatus,
} from '../src';

describe('Measurement contract exports', () => {
  it('allows hosts to import and implement measurement types from the public surface', () => {
    const status: NodeStatus = 'on';
    const source: MeasurementSource = {
      id: 'source-a',
      kind: 'numeric',
      value: 10,
      status,
    };
    const input: MeasurementInput = {
      claim: 'source-a should be measurable',
      sources: [source],
    };

    const measurement: Measurement = {
      type: 'custom-check',
      evaluate(received: MeasurementInput): MeasurementResult {
        return {
          type: this.type,
          verdict: received.sources.length === 1 ? 'single-source' : 'multi-source',
          confidence: 1,
          explanation: 'Custom measurement types can evaluate caller-supplied evidence.',
          evidenceRefs: received.sources.map((item) => item.id),
        };
      },
    };

    expect(measurement.evaluate(input)).toEqual({
      type: 'custom-check',
      verdict: 'single-source',
      confidence: 1,
      explanation: 'Custom measurement types can evaluate caller-supplied evidence.',
      evidenceRefs: ['source-a'],
    });
  });
});
