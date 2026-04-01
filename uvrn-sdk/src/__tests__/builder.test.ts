/**
 * Unit tests for BundleBuilder
 */

import { BundleBuilder } from '../builder';
import { ValidationError } from '../errors';

describe('BundleBuilder', () => {
  describe('basic construction', () => {
    test('creates bundle with required fields', () => {
      const bundle = new BundleBuilder()
        .setClaim('Test claim')
        .addDataSpecQuick(
          'spec-1',
          'Spec 1',
          'report',
          ['doc-1'],
          [{ key: 'value', value: 100 }]
        )
        .addDataSpecQuick(
          'spec-2',
          'Spec 2',
          'metric',
          ['doc-2'],
          [{ key: 'value', value: 105 }]
        )
        .build();

      expect(bundle.bundleId).toBeDefined();
      expect(bundle.claim).toBe('Test claim');
      expect(bundle.dataSpecs).toHaveLength(2);
      expect(bundle.thresholdPct).toBe(0.05); // Default
    });

    test('generates unique bundle IDs', () => {
      const builder1 = new BundleBuilder();
      const builder2 = new BundleBuilder();

      expect(builder1['bundleId']).not.toBe(builder2['bundleId']);
    });

    test('accepts custom bundle ID', () => {
      const customId = 'custom-bundle-123';
      const builder = new BundleBuilder({ bundleId: customId });

      expect(builder['bundleId']).toBe(customId);
    });

    test('accepts options in constructor', () => {
      const builder = new BundleBuilder({
        bundleId: 'test',
        claim: 'Initial claim',
        thresholdPct: 0.10,
        maxRounds: 7
      });

      expect(builder['claim']).toBe('Initial claim');
      expect(builder['thresholdPct']).toBe(0.10);
      expect(builder['maxRounds']).toBe(7);
    });
  });

  describe('fluent API', () => {
    test('methods return this for chaining', () => {
      const builder = new BundleBuilder();

      expect(builder.setClaim('test')).toBe(builder);
      expect(builder.setThreshold(0.1)).toBe(builder);
      expect(builder.setMaxRounds(5)).toBe(builder);
    });

    test('supports method chaining', () => {
      const bundle = new BundleBuilder()
        .setClaim('Chained claim')
        .setThreshold(0.08)
        .setMaxRounds(3)
        .addDataSpecQuick('s1', 'S1', 'report', ['d1'], [{ key: 'v', value: 1 }])
        .addDataSpecQuick('s2', 'S2', 'metric', ['d2'], [{ key: 'v', value: 1 }])
        .build();

      expect(bundle.claim).toBe('Chained claim');
      expect(bundle.thresholdPct).toBe(0.08);
      expect(bundle.maxRounds).toBe(3);
    });
  });

  describe('threshold configuration', () => {
    test('setThreshold accepts decimal', () => {
      const builder = new BundleBuilder().setThreshold(0.15);
      expect(builder['thresholdPct']).toBe(0.15);
    });

    test('setThresholdPercent converts percentage', () => {
      const builder = new BundleBuilder().setThresholdPercent(15);
      expect(builder['thresholdPct']).toBe(0.15);
    });

    test('default threshold is 0.05 (5%)', () => {
      const builder = new BundleBuilder();
      expect(builder['thresholdPct']).toBe(0.05);
    });
  });

  describe('adding data specs', () => {
    test('addDataSpec adds complete spec', () => {
      const spec = {
        id: 'test-id',
        label: 'Test Label',
        sourceKind: 'report' as const,
        originDocIds: ['doc-1', 'doc-2'],
        metrics: [
          { key: 'revenue', value: 1000, unit: 'USD' },
          { key: 'margin', value: 0.25 }
        ]
      };

      const builder = new BundleBuilder().addDataSpec(spec);
      expect(builder['dataSpecs']).toHaveLength(1);
      expect(builder['dataSpecs'][0]).toEqual(spec);
    });

    test('addDataSpecQuick creates spec from parameters', () => {
      const builder = new BundleBuilder().addDataSpecQuick(
        'id-1',
        'Label 1',
        'metric',
        ['doc-1'],
        [{ key: 'value', value: 100 }]
      );

      const spec = builder['dataSpecs'][0];
      expect(spec.id).toBe('id-1');
      expect(spec.label).toBe('Label 1');
      expect(spec.sourceKind).toBe('metric');
      expect(spec.originDocIds).toEqual(['doc-1']);
      expect(spec.metrics).toEqual([{ key: 'value', value: 100 }]);
    });

    test('can add multiple specs', () => {
      const builder = new BundleBuilder()
        .addDataSpecQuick('s1', 'S1', 'report', ['d1'], [{ key: 'v', value: 1 }])
        .addDataSpecQuick('s2', 'S2', 'metric', ['d2'], [{ key: 'v', value: 2 }])
        .addDataSpecQuick('s3', 'S3', 'chart', ['d3'], [{ key: 'v', value: 3 }]);

      expect(builder['dataSpecs']).toHaveLength(3);
    });
  });

  describe('validation', () => {
    test('validate returns result without building', () => {
      const builder = new BundleBuilder()
        .setClaim('Test')
        .addDataSpecQuick('s1', 'S1', 'report', ['d1'], [{ key: 'v', value: 1 }]);

      const result = builder.validate();
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
    });

    test('validate detects missing claim', () => {
      const builder = new BundleBuilder()
        .addDataSpecQuick('s1', 'S1', 'report', ['d1'], [{ key: 'v', value: 1 }]);

      const result = builder.validate();
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.field === 'claim')).toBe(true);
    });

    test('validate detects missing dataSpecs', () => {
      const builder = new BundleBuilder().setClaim('Test');

      const result = builder.validate();
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.field === 'dataSpecs')).toBe(true);
    });

    test('validate passes for valid configuration', () => {
      const builder = new BundleBuilder()
        .setClaim('Valid')
        .addDataSpecQuick('s1', 'S1', 'report', ['d1'], [{ key: 'v', value: 1 }])
        .addDataSpecQuick('s2', 'S2', 'metric', ['d2'], [{ key: 'v', value: 2 }]);

      const result = builder.validate();
      expect(result.valid).toBe(true);
    });
  });

  describe('build', () => {
    test('build returns valid bundle', () => {
      const bundle = new BundleBuilder()
        .setClaim('Build test')
        .addDataSpecQuick('s1', 'S1', 'report', ['d1'], [{ key: 'v', value: 1 }])
        .addDataSpecQuick('s2', 'S2', 'metric', ['d2'], [{ key: 'v', value: 2 }])
        .build();

      expect(bundle.bundleId).toBeDefined();
      expect(bundle.claim).toBe('Build test');
      expect(bundle.dataSpecs).toHaveLength(2);
      expect(bundle.thresholdPct).toBe(0.05);
    });

    test('build throws ValidationError for invalid bundle', () => {
      const builder = new BundleBuilder(); // Missing claim and dataSpecs

      expect(() => builder.build()).toThrow(ValidationError);
    });

    test('build includes optional maxRounds', () => {
      const bundle = new BundleBuilder()
        .setClaim('Test')
        .addDataSpecQuick('s1', 'S1', 'report', ['d1'], [{ key: 'v', value: 1 }])
        .addDataSpecQuick('s2', 'S2', 'report', ['d2'], [{ key: 'v', value: 2 }])
        .setMaxRounds(10)
        .build();

      expect(bundle.maxRounds).toBe(10);
    });

    test('build excludes maxRounds when not set', () => {
      const bundle = new BundleBuilder()
        .setClaim('Test')
        .addDataSpecQuick('s1', 'S1', 'report', ['d1'], [{ key: 'v', value: 1 }])
        .addDataSpecQuick('s2', 'S2', 'report', ['d2'], [{ key: 'v', value: 2 }])
        .build();

      expect(bundle.maxRounds).toBeUndefined();
    });
  });

  describe('reset', () => {
    test('reset clears configuration but keeps bundleId', () => {
      const builder = new BundleBuilder()
        .setClaim('Test')
        .addDataSpecQuick('s1', 'S1', 'report', ['d1'], [{ key: 'v', value: 1 }])
        .setThreshold(0.15)
        .setMaxRounds(7);

      const originalId = builder['bundleId'];
      builder.reset();

      expect(builder['bundleId']).toBe(originalId);
      expect(builder['claim']).toBe('');
      expect(builder['dataSpecs']).toHaveLength(0);
      expect(builder['thresholdPct']).toBe(0.05);
      expect(builder['maxRounds']).toBeUndefined();
    });

    test('reset returns this for chaining', () => {
      const builder = new BundleBuilder();
      expect(builder.reset()).toBe(builder);
    });
  });

  describe('static create', () => {
    test('creates new instance', () => {
      const builder = BundleBuilder.create();
      expect(builder).toBeInstanceOf(BundleBuilder);
    });

    test('accepts options', () => {
      const builder = BundleBuilder.create({ claim: 'Test' });
      expect(builder['claim']).toBe('Test');
    });
  });
});
