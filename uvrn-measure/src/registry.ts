/**
 * Measurement registry manages the active relationship modules for a host.
 * Hosts use it to add, replace, remove, and run measurements without forking core or this package.
 */

import type { Measurement, MeasurementInput, MeasurementResult, MeasurementType } from '@uvrn/core';
import { agreeMeasurement } from './measurements/agree';
import { conflictMeasurement } from './measurements/conflict';
import { disagreeMeasurement } from './measurements/disagree';
import { potentialMeasurement } from './measurements/potential';

/**
 * MeasurementRegistry stores measurement modules by type and runs them in registration order.
 * Registering the same type again replaces the prior module while preserving a single active entry.
 */
export class MeasurementRegistry {
  private readonly measurements = new Map<MeasurementType, Measurement>();

  /**
   * Adds or replaces a measurement module by its `type`.
   */
  register(measurement: Measurement): void {
    this.measurements.set(measurement.type, measurement);
  }

  /**
   * Removes a measurement module from the registry.
   */
  unregister(type: MeasurementType): void {
    this.measurements.delete(type);
  }

  /**
   * Returns one measurement module by type when it is registered.
   */
  get(type: MeasurementType): Measurement | undefined {
    return this.measurements.get(type);
  }

  /**
   * Lists all registered measurement modules in insertion order.
   */
  list(): Measurement[] {
    return Array.from(this.measurements.values());
  }

  /**
   * Runs every registered measurement against the same input and returns each result in registry order.
   */
  runAll(input: MeasurementInput): MeasurementResult[] {
    return this.list().map((measurement) => measurement.evaluate(input));
  }
}

/**
 * defaultRegistry returns a registry preloaded with UVRN's four starter measurements.
 * Hosts can register additional measurements or replace starters after construction.
 */
export function defaultRegistry(): MeasurementRegistry {
  const registry = new MeasurementRegistry();
  registry.register(agreeMeasurement);
  registry.register(disagreeMeasurement);
  registry.register(conflictMeasurement);
  registry.register(potentialMeasurement);
  return registry;
}
