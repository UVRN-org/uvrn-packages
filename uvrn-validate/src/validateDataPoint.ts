import { checkDataPointShape } from './stage1';
import { runStage2Measure } from './stage2';
import type { DataPoint, ValidateDataPointOptions, ValidateDataPointResult } from './types';

/**
 * Easy-verify front desk for a DataPoint.
 *
 * Stage1 always runs (shape/presence → structurally-ok | malformed).
 * Stage2 runs only when `options.runStage2 === true` and Stage1 is structurally-ok.
 * Never emits `verified` or Stage1 `integrity-checked`.
 */
export function validateDataPoint(
  dataPoint: unknown,
  options: ValidateDataPointOptions = {}
): ValidateDataPointResult {
  const stage1 = checkDataPointShape(dataPoint);

  if (stage1.token === 'malformed') {
    return {
      stage: 1,
      stage1: 'malformed',
      reasons: stage1.reasons,
    };
  }

  if (options.runStage2 !== true) {
    return {
      stage: 1,
      stage1: 'structurally-ok',
      reasons: [],
    };
  }

  const point = dataPoint as DataPoint;
  const sources = options.sources ?? [];
  const claim =
    typeof options.claim === 'string' && options.claim.trim().length > 0
      ? options.claim
      : `datapoint:${point.id}:${point.kind}`;

  const stage2 = runStage2Measure({ claim, sources });

  return {
    stage: 2,
    stage1: 'structurally-ok',
    reasons: [],
    stage2,
  };
}
