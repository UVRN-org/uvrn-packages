/**
 * Potential measurement: fires when evidence is trending toward agreement but is not settled yet.
 * The rule is: at least N historical agreement scores are required, the last K scores must be
 * monotonically non-decreasing with a positive net change, and the current score must remain below
 * the agree threshold. Thin history always emits `none`.
 */

import type { Measurement } from '@uvrn/core';
import { agreeThreshold, contextNumber, isMonotonicRising, parseHistory } from '../internal/evidence';

/**
 * potentialMeasurement detects early movement toward agreement without claiming the sources agree.
 * Hosts pass history through `context.history` or `context.agreementHistory` as scores from 0 to 1.
 */
export const potentialMeasurement: Measurement = {
  type: 'potential',
  evaluate(input) {
    const history = parseHistory(input);
    const minObservations = Math.max(1, Math.floor(contextNumber(input, 'minObservations', 3)));
    const windowSize = Math.max(2, Math.floor(contextNumber(input, 'windowSize', 3)));

    if (history.length < minObservations) {
      return {
        type: 'potential',
        verdict: 'none',
        confidence: history.length / minObservations,
        explanation: `Potential requires ${minObservations} observations; received ${history.length}.`,
        evidenceRefs: input.sources.map((source) => source.id),
      };
    }

    const threshold = agreeThreshold(input);
    const scores = history.map((item) => item.score);
    const window = scores.slice(-windowSize);
    const current = scores[scores.length - 1];
    const rising = isMonotonicRising(window);
    const unsettled = current < threshold;
    const fires = rising && unsettled;

    return {
      type: 'potential',
      verdict: fires ? 'potential' : 'none',
      confidence: fires ? Math.min(1, current) : Math.max(0, 1 - current),
      explanation: fires
        ? `Agreement is rising across the last ${window.length} observations but remains below threshold ${threshold}.`
        : `Potential not detected: rising=${rising}, current=${current.toFixed(3)}, threshold=${threshold}.`,
      evidenceRefs: input.sources.map((source) => source.id),
    };
  },
};
