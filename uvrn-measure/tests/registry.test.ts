import type { Measurement } from '@uvrn/core';
import { defaultRegistry, MeasurementRegistry } from '../src';

describe('MeasurementRegistry', () => {
  const customMeasurement: Measurement = {
    type: 'custom',
    evaluate(input) {
      return {
        type: 'custom',
        verdict: 'observed',
        confidence: 1,
        explanation: 'Custom registry test measurement ran.',
        evidenceRefs: input.sources.map((source) => source.id),
      };
    },
  };

  it('registers and retrieves a measurement', () => {
    const registry = new MeasurementRegistry();
    registry.register(customMeasurement);

    expect(registry.get('custom')).toBe(customMeasurement);
    expect(registry.list()).toEqual([customMeasurement]);
  });

  it('replaces a measurement with the same type', () => {
    const registry = new MeasurementRegistry();
    const replacement: Measurement = {
      ...customMeasurement,
      evaluate() {
        return {
          type: 'custom',
          verdict: 'replacement',
          confidence: 1,
          explanation: 'Replacement registry test measurement ran.',
          evidenceRefs: [],
        };
      },
    };

    registry.register(customMeasurement);
    registry.register(replacement);

    expect(registry.list()).toHaveLength(1);
    expect(registry.get('custom')).toBe(replacement);
  });

  it('unregisters a measurement', () => {
    const registry = new MeasurementRegistry();
    registry.register(customMeasurement);
    registry.unregister('custom');

    expect(registry.get('custom')).toBeUndefined();
    expect(registry.list()).toEqual([]);
  });

  it('runs all registered measurements in order', () => {
    const registry = defaultRegistry();
    const results = registry.runAll({
      claim: 'registry run',
      sources: [
        { id: 'a', kind: 'numeric', value: 100 },
        { id: 'b', kind: 'numeric', value: 104 },
      ],
      context: {
        history: [0.4, 0.5, 0.6],
      },
    });

    expect(results.map((result) => result.type)).toEqual(['agree', 'disagree', 'conflict', 'potential']);
  });
});
