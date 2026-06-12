/**
 * Potential measurement: fires when evidence is trending toward agreement but is not settled yet.
 * The rule is: at least N historical agreement scores are required, the last K scores must be
 * monotonically non-decreasing with a positive net change, and the current score must remain below
 * the agree threshold. Thin history or a signal below `context.confidenceFloor` (default 0.25)
 * emits `insufficient-data` so weak early signals are never overstated.
 */

import type { Measurement } from '@uvrn/core';
import { agreeThreshold, clamp, contextNumber, isMonotonicRising, parseHistory } from '../internal/evidence';

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
        verdict: 'insufficient-data',
        confidence: 0,
        explanation: `Potential requires at least ${minObservations} observations; received ${history.length}.`,
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

    if (fires) {
      const windowFirst = window[0];
      const windowLast = window[window.length - 1];
      const sampleFactor = Math.min(1, history.length / (2 * minObservations));
      const trendStrength = clamp((windowLast - windowFirst) / Math.max(0.05, 1 - windowFirst), 0, 1);
      const confidence = clamp(current * (0.5 * sampleFactor + 0.5 * trendStrength), 0, 1);
      const confidenceFloor = contextNumber(input, 'confidenceFloor', 0.25);

      if (confidence < confidenceFloor) {
        return {
          type: 'potential',
          verdict: 'insufficient-data',
          confidence,
          explanation: `Early signal detected but confidence ${confidence.toFixed(3)} is below the ${confidenceFloor} floor; reported as insufficient data rather than overstated.`,
          evidenceRefs: input.sources.map((source) => source.id),
        };
      }

      return {
        type: 'potential',
        verdict: 'potential',
        confidence,
        explanation: `Agreement is rising across the last ${window.length} observations but remains below threshold ${threshold}.`,
        evidenceRefs: input.sources.map((source) => source.id),
      };
    }

    return {
      type: 'potential',
      verdict: 'none',
      confidence: Math.max(0, 1 - current),
      explanation: `Potential not detected: rising=${rising}, current=${current.toFixed(3)}, threshold=${threshold}.`,
      evidenceRefs: input.sources.map((source) => source.id),
    };
  },
};
