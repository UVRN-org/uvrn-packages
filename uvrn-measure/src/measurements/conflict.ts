/**
 * Conflict measurement: fires when two sources assert mutually exclusive values.
 * The rule is: boolean/categorical assertions conflict when they differ on the same field, and ranges
 * conflict when two asserted intervals on the same field are disjoint. Pure numeric spread is never conflict.
 */

import type { Measurement, MeasurementSource } from '@uvrn/core';
import { fieldKey, normalizeAssertion, sourceLabel } from '../internal/evidence';

interface ConflictPair {
  left: MeasurementSource;
  right: MeasurementSource;
  value: string;
}

/**
 * conflictMeasurement detects direct contradiction rather than ordinary numeric divergence.
 * It requires categorical, boolean, or range assertions and reports the two sources that conflict.
 */
export const conflictMeasurement: Measurement = {
  type: 'conflict',
  evaluate(input) {
    const pair = findConflict(input.sources);
    if (!pair) {
      return {
        type: 'conflict',
        verdict: 'none',
        confidence: 0,
        explanation: 'No mutually exclusive categorical, boolean, or disjoint-range assertions were found.',
        evidenceRefs: input.sources.map((source) => source.id),
      };
    }

    return {
      type: 'conflict',
      verdict: 'conflict',
      confidence: 1,
      explanation: `Conflict: ${sourceLabel(pair.left)} and ${sourceLabel(pair.right)} assert mutually exclusive ${pair.value}.`,
      evidenceRefs: [pair.left.id, pair.right.id],
    };
  },
};

function findConflict(sources: ReadonlyArray<MeasurementSource>): ConflictPair | undefined {
  for (let leftIndex = 0; leftIndex < sources.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sources.length; rightIndex += 1) {
      const left = sources[leftIndex];
      const right = sources[rightIndex];
      if (fieldKey(left) !== fieldKey(right)) {
        continue;
      }

      if (assertionsConflict(left, right)) {
        return {
          left,
          right,
          value: `assertions "${left.assertion}" and "${right.assertion}"`,
        };
      }

      if (rangesConflict(left, right)) {
        return {
          left,
          right,
          value: `ranges ${left.range?.min}-${left.range?.max} and ${right.range?.min}-${right.range?.max}`,
        };
      }
    }
  }

  return undefined;
}

function assertionsConflict(left: MeasurementSource, right: MeasurementSource): boolean {
  const leftKind = left.kind === 'boolean' || left.kind === 'categorical';
  const rightKind = right.kind === 'boolean' || right.kind === 'categorical';
  if (!leftKind || !rightKind || !left.assertion || !right.assertion) {
    return false;
  }

  return normalizeAssertion(left.assertion) !== normalizeAssertion(right.assertion);
}

function rangesConflict(left: MeasurementSource, right: MeasurementSource): boolean {
  if (left.kind !== 'range' || right.kind !== 'range' || !left.range || !right.range) {
    return false;
  }

  return left.range.max < right.range.min || right.range.max < left.range.min;
}
