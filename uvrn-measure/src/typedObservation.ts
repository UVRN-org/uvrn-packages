/**
 * Thin host helpers for attaching typed-observation axes onto MeasurementSource.
 * Axes follow SPEC/uvrn-typed-observation-v1 and live in `attributes` (additive).
 * Hosts must declare quantityKind / unit — this helper never scrapes prose or titles.
 */

import type { MeasurementSource, QuantityKind, UnitSource } from '@uvrn/core';

/**
 * Host-declared typed-observation fields to merge into MeasurementSource.attributes.
 * Orthogonal to MeasurementSource.kind (evidence shape).
 */
export interface TypedObservationAttrs {
  /** Quantity/dimension class (money, percentage, count, …). */
  quantityKind: QuantityKind;
  /** Host-declared UCUM (or product) unit string. */
  unit?: string;
  /** Authority of `unit`. Comparability accepts only `declared`. */
  unitSource?: UnitSource;
  /** Comparison field key (also used by conflict field rule). */
  field?: string;
  /** ISO — measurement/observation time. */
  measuredAt?: string;
  /** ISO — period/instant the value applies to. */
  appliesTo?: string;
  /** SDMX CL_OBS_STATUS code when host declares it. */
  obsStatus?: string;
}

/**
 * Returns a copy of `source` with typed-observation axes merged into attributes.
 * Existing attributes are preserved; typed keys overwrite on collision.
 * Does not mutate the input and does not invent units from quantityKind.
 */
export function withTypedObservation(
  source: MeasurementSource,
  typed: TypedObservationAttrs
): MeasurementSource {
  const attributes: Record<string, unknown> = {
    ...(source.attributes ?? {}),
    quantityKind: typed.quantityKind,
  };

  if (typed.unit !== undefined) {
    attributes.unit = typed.unit;
  }
  if (typed.unitSource !== undefined) {
    attributes.unitSource = typed.unitSource;
  }
  if (typed.field !== undefined) {
    attributes.field = typed.field;
  }
  if (typed.measuredAt !== undefined) {
    attributes.measuredAt = typed.measuredAt;
  }
  if (typed.appliesTo !== undefined) {
    attributes.appliesTo = typed.appliesTo;
  }
  if (typed.obsStatus !== undefined) {
    attributes.obsStatus = typed.obsStatus;
  }

  return {
    ...source,
    attributes,
  };
}
