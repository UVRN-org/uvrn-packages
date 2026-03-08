import {
  DeltaBundle,
  DeltaReceipt,
  DeltaRound,
  EngineOpts,
  Outcome
} from '../types';
import { validateBundle } from './validation';
import { hashReceipt } from './serialization';

/**
 * Rounds a number to a fixed precision (8 decimal places) to mitigate FP hazards.
 */
function roundDet(num: number): number {
  return Math.round(num * 100000000) / 100000000;
}

/**
 * Computes Delta between two numbers.
 * Formula: |a - b| / ((a + b)/2)
 *
 * Rules:
 * - If both 0 -> 0
 * - If one 0, other != 0 -> 1.0 (Max Variance for this context)
 */
function computeDelta(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  if (a === 0 || b === 0) return 1.0;

  const numerator = Math.abs(a - b);
  const denominator = (a + b) / 2;
  // Determine absolute delta
  const rawDelta = numerator / denominator;
  return roundDet(rawDelta);
}

export function runDeltaEngine(bundle: DeltaBundle, opts?: EngineOpts): DeltaReceipt {
  // 1. Validate
  const validation = validateBundle(bundle);
  if (!validation.valid) {
    throw new Error(`Invalid DeltaBundle: ${validation.error}`);
  }

  // 2. Sort DataSpecs (Stable Ordering)
  const sortedSpecs = [...bundle.dataSpecs].sort((a, b) => a.id.localeCompare(b.id));
  const sourceLabels = sortedSpecs.map(s => s.label);

  // 3. Extract Comparable Metrics
  const allKeys = new Set<string>();
  sortedSpecs.forEach(spec => {
    spec.metrics.forEach(m => allKeys.add(m.key));
  });
  const sortedKeys = Array.from(allKeys).sort(); // Lexicographical sort

  const comparableKeys: string[] = [];
  
  for (const key of sortedKeys) {
    let count = 0;
    for (const spec of sortedSpecs) {
      if (spec.metrics.some(m => m.key === key)) count++;
    }
    if (count >= 2) {
      comparableKeys.push(key);
    }
  }

  const maxRounds = bundle.maxRounds || 5;
  const rounds: DeltaRound[] = [];
  let outcome: Outcome = 'indeterminate';

  // 4. Run Cycles
  let currentRound = 0;
  let finalDelta = 0;

  while (currentRound < maxRounds) {
    currentRound++;
    const deltasByMetric: Record<string, number> = {};
    let maxDeltaInRound = 0;

    for (const key of comparableKeys) {
      const values: number[] = [];
      for (const spec of sortedSpecs) {
        const m = spec.metrics.find(x => x.key === key);
        if (m) values.push(m.value);
      }

      const min = Math.min(...values);
      const max = Math.max(...values);
      
      const d = computeDelta(max, min);
      deltasByMetric[key] = d;
      if (d > maxDeltaInRound) {
        maxDeltaInRound = d;
      }
    }

    finalDelta = maxDeltaInRound;
    const within = maxDeltaInRound <= bundle.thresholdPct;

    const roundData: DeltaRound = {
      round: currentRound,
      deltasByMetric,
      withinThreshold: within,
      witnessRequired: !within && currentRound === maxRounds,
    };

    rounds.push(roundData);

    if (within) {
      outcome = 'consensus';
      break; 
    }
    
    // Continue loop if not within threshold
  }

  if (outcome !== 'consensus') {
    outcome = 'indeterminate';
  }

  // 5. Construct Receipt (excluding hash)
  const receiptPayload: Omit<DeltaReceipt, 'hash'> = {
    bundleId: bundle.bundleId,
    deltaFinal: finalDelta,
    sources: sourceLabels,
    rounds,
    suggestedFixes: [],
    outcome,
  };

  if (opts?.timestamp) {
    receiptPayload.ts = opts.timestamp;
  }

  // 6. Canonical Serialize & Hash
  const hash = hashReceipt(receiptPayload);

  return {
    ...receiptPayload,
    hash
  };
}
