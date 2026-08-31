import type { ComparabilityRefusal, MetricPoint, UnitSource } from '../types';

function unitSourceOf(m: MetricPoint): UnitSource {
  if (m.unitSource) {
    return m.unitSource;
  }
  if (m.unit) {
    // Legacy points with a unit string but no authority tag are treated as
    // undeclared for typed checks — callers must set unitSource explicitly.
    return 'none';
  }
  return 'none';
}

/**
 * Typed comparability check (uvrn-typed-observation-v1 §4).
 *
 * Legacy path: when no metric carries quantityKind and none carries a declared
 * unit, returns null (comparable) — frozen engine behavior unchanged.
 *
 * Never synthesizes UCUM from quantityKind. Missing host unit → missing-unit.
 * Inferred units never satisfy comparability.
 */
export function checkMetricsComparability(
  metrics: MetricPoint[],
  sourceIds?: string[]
): ComparabilityRefusal | null {
  if (metrics.length < 2) {
    return null;
  }

  const typed = metrics.some(
    (m) => m.quantityKind != null || unitSourceOf(m) === 'declared' || unitSourceOf(m) === 'inferred'
  );
  if (!typed) {
    return null;
  }

  for (let i = 0; i < metrics.length; i += 1) {
    const m = metrics[i]!;
    const src = unitSourceOf(m);
    if (src === 'inferred') {
      return {
        type: 'comparability-refusal',
        reason: 'inferred-unit-ineligible',
        left: {
          sourceId: sourceIds?.[i],
          quantityKind: m.quantityKind,
          unit: m.unit,
        },
      };
    }
    if (src !== 'declared' || !m.unit) {
      return {
        type: 'comparability-refusal',
        reason: 'missing-unit',
        left: {
          sourceId: sourceIds?.[i],
          quantityKind: m.quantityKind,
          unit: m.unit,
        },
      };
    }
  }

  const first = metrics[0]!;
  for (let i = 1; i < metrics.length; i += 1) {
    const other = metrics[i]!;
    // Exact UCUM string match for dimension equality (no invented defaults).
    if (first.unit !== other.unit) {
      return {
        type: 'comparability-refusal',
        reason: 'dimension-mismatch',
        left: {
          sourceId: sourceIds?.[0],
          quantityKind: first.quantityKind,
          unit: first.unit,
        },
        right: {
          sourceId: sourceIds?.[i],
          quantityKind: other.quantityKind,
          unit: other.unit,
        },
      };
    }
    if (
      first.quantityKind != null &&
      other.quantityKind != null &&
      first.quantityKind !== other.quantityKind
    ) {
      return {
        type: 'comparability-refusal',
        reason: 'dimension-mismatch',
        left: {
          sourceId: sourceIds?.[0],
          quantityKind: first.quantityKind,
          unit: first.unit,
        },
        right: {
          sourceId: sourceIds?.[i],
          quantityKind: other.quantityKind,
          unit: other.unit,
        },
      };
    }
  }

  return null;
}
