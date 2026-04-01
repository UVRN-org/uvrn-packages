/**
 * Bundle Builder - Fluent API for constructing Delta Bundles
 */

import type { DeltaBundle, DataSpec, MetricPoint } from '@uvrn/core';
import type { BundleBuilderOptions, ValidationResult } from './types/sdk';
import { validateBundle } from './validators';
import { ValidationError as ValidationErr } from './errors';
import { randomBytes } from 'crypto';

/**
 * Fluent API for building Delta Bundles
 *
 * @example
 * ```typescript
 * const bundle = new BundleBuilder()
 *   .setBundleId('my-bundle')
 *   .setClaim('Q1 revenue matches projections')
 *   .addDataSpec({
 *     id: 'forecast',
 *     label: 'Q1 Forecast',
 *     sourceKind: 'report',
 *     originDocIds: ['doc-1'],
 *     metrics: [{ key: 'revenue', value: 1000000 }]
 *   })
 *   .addDataSpec({
 *     id: 'actual',
 *     label: 'Q1 Actual',
 *     sourceKind: 'report',
 *     originDocIds: ['doc-2'],
 *     metrics: [{ key: 'revenue', value: 1020000 }]
 *   })
 *   .setThreshold(0.05)
 *   .build();
 * ```
 */
export class BundleBuilder {
  private bundleId: string;
  private claim: string = '';
  private dataSpecs: DataSpec[] = [];
  private thresholdPct: number = 0.05; // Default 5%
  private maxRounds?: number;

  /**
   * Creates a new BundleBuilder
   *
   * @param options - Optional initial configuration
   */
  constructor(options?: BundleBuilderOptions) {
    this.bundleId = options?.bundleId || this.generateBundleId();
    if (options?.claim) this.claim = options.claim;
    if (options?.thresholdPct !== undefined) this.thresholdPct = options.thresholdPct;
    if (options?.maxRounds !== undefined) this.maxRounds = options.maxRounds;
  }

  /**
   * Generates a unique bundle ID
   * @internal
   */
  private generateBundleId(): string {
    const timestamp = Date.now();
    const random = randomBytes(4).toString('hex');
    return `bundle-${timestamp}-${random}`;
  }

  /**
   * Sets the bundle ID
   *
   * @param bundleId - Unique identifier for this bundle
   * @returns this builder instance for chaining
   */
  setBundleId(bundleId: string): this {
    this.bundleId = bundleId;
    return this;
  }

  /**
   * Sets the claim statement
   *
   * @param claim - The claim this bundle will verify
   * @returns this builder instance for chaining
   *
   * @example
   * ```typescript
   * builder.setClaim('Revenue projections are within 10% of actuals');
   * ```
   */
  setClaim(claim: string): this {
    this.claim = claim;
    return this;
  }

  /**
   * Adds a DataSpec to the bundle
   *
   * @param spec - Complete DataSpec object
   * @returns this builder instance for chaining
   *
   * @example
   * ```typescript
   * builder.addDataSpec({
   *   id: 'source-1',
   *   label: 'Forecast Data',
   *   sourceKind: 'report',
   *   originDocIds: ['doc-123'],
   *   metrics: [
   *     { key: 'revenue', value: 1000000, unit: 'USD' }
   *   ]
   * });
   * ```
   */
  addDataSpec(spec: DataSpec): this {
    this.dataSpecs.push(spec);
    return this;
  }

  /**
   * Creates and adds a DataSpec with a fluent interface
   *
   * @param id - Unique identifier
   * @param label - Human-readable label
   * @param sourceKind - Type of data source
   * @param originDocIds - Source document IDs
   * @param metrics - Metric data points
   * @returns this builder instance for chaining
   *
   * @example
   * ```typescript
   * builder.addDataSpecQuick(
   *   'source-1',
   *   'Forecast',
   *   'report',
   *   ['doc-123'],
   *   [{ key: 'revenue', value: 1000000 }]
   * );
   * ```
   */
  addDataSpecQuick(
    id: string,
    label: string,
    sourceKind: 'report' | 'metric' | 'chart' | 'meta',
    originDocIds: string[],
    metrics: MetricPoint[]
  ): this {
    return this.addDataSpec({
      id,
      label,
      sourceKind,
      originDocIds,
      metrics
    });
  }

  /**
   * Sets the threshold percentage for delta comparison
   *
   * @param threshold - Threshold as a decimal (0.0 to 1.0)
   * @returns this builder instance for chaining
   *
   * @example
   * ```typescript
   * builder.setThreshold(0.10); // 10% threshold
   * ```
   */
  setThreshold(threshold: number): this {
    this.thresholdPct = threshold;
    return this;
  }

  /**
   * Sets the threshold percentage using a percentage value
   *
   * @param percent - Threshold as percentage (0 to 100)
   * @returns this builder instance for chaining
   *
   * @example
   * ```typescript
   * builder.setThresholdPercent(10); // 10% threshold
   * ```
   */
  setThresholdPercent(percent: number): this {
    this.thresholdPct = percent / 100;
    return this;
  }

  /**
   * Sets the maximum number of rounds
   *
   * @param rounds - Maximum rounds (defaults to 5 if not set)
   * @returns this builder instance for chaining
   */
  setMaxRounds(rounds: number): this {
    this.maxRounds = rounds;
    return this;
  }

  /**
   * Validates the current bundle configuration without building
   *
   * @returns ValidationResult indicating if the bundle is valid
   *
   * @example
   * ```typescript
   * const result = builder.validate();
   * if (!result.valid) {
   *   console.error('Bundle configuration is invalid:', result.errors);
   * }
   * ```
   */
  validate(): ValidationResult {
    const bundle = this.toBundle();
    return validateBundle(bundle);
  }

  /**
   * Converts current configuration to a DeltaBundle object (without validation)
   * @internal
   */
  private toBundle(): DeltaBundle {
    const bundle: DeltaBundle = {
      bundleId: this.bundleId,
      claim: this.claim,
      dataSpecs: this.dataSpecs,
      thresholdPct: this.thresholdPct
    };

    if (this.maxRounds !== undefined) {
      bundle.maxRounds = this.maxRounds;
    }

    return bundle;
  }

  /**
   * Builds and returns the final DeltaBundle
   *
   * @throws {ValidationError} if the bundle configuration is invalid
   * @returns Complete, validated DeltaBundle
   *
   * @example
   * ```typescript
   * try {
   *   const bundle = builder.build();
   *   // Use bundle...
   * } catch (error) {
   *   if (error instanceof ValidationError) {
   *     console.error('Invalid bundle:', error.errors);
   *   }
   * }
   * ```
   */
  build(): DeltaBundle {
    const bundle = this.toBundle();
    const validation = validateBundle(bundle);

    if (!validation.valid) {
      throw new ValidationErr(
        'Invalid bundle configuration',
        validation.errors || []
      );
    }

    return bundle;
  }

  /**
   * Resets the builder to initial state (keeps bundleId)
   *
   * @returns this builder instance for chaining
   */
  reset(): this {
    this.claim = '';
    this.dataSpecs = [];
    this.thresholdPct = 0.05;
    this.maxRounds = undefined;
    return this;
  }

  /**
   * Creates a new builder instance with a fresh bundle ID
   *
   * @returns new BundleBuilder instance
   */
  static create(options?: BundleBuilderOptions): BundleBuilder {
    return new BundleBuilder(options);
  }
}
