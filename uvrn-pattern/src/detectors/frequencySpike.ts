import type { Detector, HistoryEvent, PatternObservation, ScanScope } from '../types';

export type FrequencySpikeOptions = {
  /** Minimum event count for a subjectRef within the window to emit an observation. Default 3. */
  minCount?: number;
};

/**
 * Zero-external statistical baseline: subjectRefs whose event count in-window
 * meets minCount. Observation only — never verified / never receipt-class.
 */
export class FrequencySpikeDetector implements Detector {
  readonly id = 'frequency-spike';
  readonly version = '0.1.0';
  readonly #minCount: number;

  constructor(options: FrequencySpikeOptions = {}) {
    this.#minCount = options.minCount ?? 3;
  }

  detect(events: HistoryEvent[], scope: ScanScope): PatternObservation[] {
    const counts = new Map<string, HistoryEvent[]>();
    for (const e of events) {
      const list = counts.get(e.subjectRef) ?? [];
      list.push(e);
      counts.set(e.subjectRef, list);
    }

    const out: PatternObservation[] = [];
    for (const [subjectRef, list] of counts) {
      if (list.length < this.#minCount) continue;
      out.push({
        id: `obs:frequency-spike:${subjectRef}:${scope.window.from}:${scope.window.to}`,
        kind: 'frequency-spike',
        summary: `Subject ${subjectRef} appeared ${list.length} times in the scoped window (threshold ${this.#minCount}). Statistical observation only — not verified.`,
        subjectRefs: [subjectRef],
        window: { ...scope.window },
        method: `${this.id}@${this.version}`,
        confidenceNote:
          'Uncalibrated v0 statistical baseline; no detection quality floor named at Admin start. False positives are an inherent disclosed property.',
        joinScope: scope.joinScope,
        falsePositiveStance: 'disclosed-inherent',
      });
    }
    return out;
  }
}
