/**
 * Agree measurement: fires when independent sources converge within an agreement threshold.
 * The rule is: numeric spread or assertion mismatch is converted to an agreement score, and `agree`
 * is emitted when that score is greater than or equal to `context.agreeThreshold` (default 0.9).
 */

import type { Measurement } from '@uvrn/core';
import { agreeThreshold, bestAgreement } from '../internal/evidence';

/**
 * agreeMeasurement checks whether available evidence lines up closely enough to count as agreement.
 * It stays core-only in v1; hosts adapt consensus output before calling this package.
 */
export const agreeMeasurement: Measurement = {
  type: 'agree',
  evaluate(input) {
    const agreement = bestAgreement(input);
    if (!agreement) {
      return {
        type: 'agree',
        verdict: 'no-agreement',
        confidence: 0,
        explanation: 'Agree requires at least two comparable evidence sources.',
        evidenceRefs: input.sources.map((source) => source.id),
      };
    }

    const threshold = agreeThreshold(input);
    const passes = agreement.score >= threshold;

    return {
      type: 'agree',
      verdict: passes ? 'agree' : 'no-agreement',
      confidence: agreement.score,
      explanation: passes
        ? `Sources converge with agreement score ${agreement.score.toFixed(3)} at threshold ${threshold}.`
        : `Sources do not reach agreement: score ${agreement.score.toFixed(3)} is below threshold ${threshold}.`,
      evidenceRefs: agreement.refs,
    };
  },
};
