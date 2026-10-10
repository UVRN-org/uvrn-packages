import type { MeasurementResult, MeasurementSource } from '@uvrn/core';
import { defaultRegistry } from '@uvrn/measure';
import type { Stage2Result, Stage2Token } from './types';

/**
 * Stage2 thin route into existing `@uvrn/measure` — no new measurement math.
 * Callers must already have passed Stage1 and set runStage2.
 *
 * <2 host sources → insufficient-data (honest success; measure not invoked).
 * ≥2 sources → defaultRegistry().runAll() and return measure vocabulary tokens.
 * Never emits `verified`.
 */
export function runStage2Measure(args: {
  claim: string;
  sources: ReadonlyArray<MeasurementSource>;
}): Stage2Result {
  if (args.sources.length < 2) {
    return {
      token: 'insufficient-data',
    };
  }

  const measurements = defaultRegistry().runAll({
    claim: args.claim,
    sources: args.sources,
  });

  return {
    token: primaryMeasureToken(measurements),
    measurements,
  };
}

/**
 * Prefer the agree module's verdict as the relational headline (existing measure vocab:
 * `agree` | `no-agreement` | `insufficient-data`). Falls back to the first result
 * (may be `disagree` | `none` | `conflict` | `potential` | …), then insufficient-data.
 */
function primaryMeasureToken(measurements: MeasurementResult[]): Stage2Token {
  const agree = measurements.find((m) => m.type === 'agree');
  if (agree) {
    return agree.verdict as Stage2Token;
  }
  if (measurements.length > 0) {
    return measurements[0]!.verdict as Stage2Token;
  }
  return 'insufficient-data';
}
