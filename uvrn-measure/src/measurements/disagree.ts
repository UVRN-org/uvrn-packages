/**
 * Disagree measurement: fires when numeric sources materially diverge.
 * The rule is: pure numeric spread greater than `context.divergenceThreshold` (default 0.1) emits
 * `disagree`; categorical, boolean, or range contradictions are left to the conflict measurement.
 */

import type { Measurement } from '@uvrn/core';
import { divergenceThreshold, numericAgreement } from '../internal/evidence';

/**
 * disagreeMeasurement checks for material numeric divergence between comparable sources.
 * It intentionally ignores categorical and range conflicts so each measurement has one responsibility.
 */
export const disagreeMeasurement: Measurement = {
  type: 'disagree',
  evaluate(input) {
    const numeric = numericAgreement(input);
    if (!numeric) {
      return {
        type: 'disagree',
        verdict: 'none',
        confidence: 0,
        explanation: 'Disagree requires at least two numeric evidence values.',
        evidenceRefs: input.sources.map((source) => source.id),
      };
    }

    const threshold = divergenceThreshold(input);
    const disagrees = numeric.spread > threshold;

    return {
      type: 'disagree',
      verdict: disagrees ? 'disagree' : 'none',
      confidence: disagrees ? Math.min(1, numeric.spread) : 1 - numeric.spread,
      explanation: disagrees
        ? `Numeric sources diverge by ${numeric.spread.toFixed(3)}, above threshold ${threshold}.`
        : `Numeric spread ${numeric.spread.toFixed(3)} does not exceed disagreement threshold ${threshold}.`,
      evidenceRefs: numeric.refs,
    };
  },
};
