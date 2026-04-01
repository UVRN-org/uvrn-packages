// ─────────────────────────────────────────────
// @uvrn/drift · main entry point
// ─────────────────────────────────────────────

import { applyDecay } from './curves/index';
import { DRIFT_PROFILES, DEFAULT } from './profiles/index';
import type {
  DriftInputReceipt,
  DriftReceipt,
  DriftProfile,
  DriftStatus,
  DriftThresholdEvent,
  DriftMonitorConfig,
} from './types/index';

// ── V-Score weights (canonical — mirrors @uvrn/core) ──────────────────────
const WEIGHT_COMPLETENESS = 0.35;
const WEIGHT_PARITY       = 0.35;
const WEIGHT_FRESHNESS    = 0.30;

// ── Threshold boundaries ──────────────────────────────────────────────────
const THRESHOLD_STABLE   = 80;
const THRESHOLD_DRIFTING = 60;

// ─────────────────────────────────────────────────────────────────────────────
// computeDrift()
//
// Core function. Takes a DRVC3 receipt and a DriftProfile, computes
// how much the score has decayed since the receipt was issued, and returns
// a new DriftReceipt with the full drift envelope attached.
//
// Usage:
//   import { computeDrift, DRIFT_PROFILES } from '@uvrn/drift';
//   const result = computeDrift(receipt, DRIFT_PROFILES.fast);
// ─────────────────────────────────────────────────────────────────────────────
export function computeDrift(
  receipt: DriftInputReceipt,
  profile: DriftProfile,
  asOf: Date = new Date()
): DriftReceipt {
  const issuedAt  = new Date(receipt.timestamp);
  const ageMs     = asOf.getTime() - issuedAt.getTime();
  const ageHours  = ageMs / (1000 * 60 * 60);

  // Apply decay to the freshness component only.
  // Completeness and parity are point-in-time facts — they don't
  // decay with time, they decay with new evidence (handled by @uvrn/agent).
  const decayedFreshness = applyDecay(
    profile.curve,
    receipt.components.freshness,
    ageHours,
    profile.rate
  );

  // Recompute V-Score with decayed freshness
  const decayedScore = Math.max(
    profile.scoreFloor ?? 0,
    receipt.components.completeness * WEIGHT_COMPLETENESS +
    receipt.components.parity       * WEIGHT_PARITY       +
    decayedFreshness                * WEIGHT_FRESHNESS
  );

  const delta  = decayedScore - receipt.v_score;
  const status = scoreToStatus(decayedScore);

  return {
    ...receipt,
    drift: {
      decayed_score:     Math.round(decayedScore * 100) / 100,
      delta:             Math.round(delta * 100) / 100,
      age_hours:         Math.round(ageHours * 100) / 100,
      curve:             profile.curve,
      profile:           profile.name,
      scored_at:         asOf.toISOString(),
      status,
      decayed_freshness: Math.round(decayedFreshness * 100) / 100,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// scoreToStatus()
// Maps a numeric V-Score to its threshold zone.
// ─────────────────────────────────────────────────────────────────────────────
export function scoreToStatus(score: number): DriftStatus {
  if (score >= THRESHOLD_STABLE)   return 'STABLE';
  if (score >= THRESHOLD_DRIFTING) return 'DRIFTING';
  return 'CRITICAL';
}

// ─────────────────────────────────────────────────────────────────────────────
// DriftMonitor
//
// A lightweight monitoring loop that watches a collection of receipts,
// re-evaluates drift on each tick, and fires threshold events when a
// receipt crosses a zone boundary.
//
// Usage:
//   const monitor = new DriftMonitor({ intervalMs: 60_000, onThreshold });
//   monitor.watch(receipt, DRIFT_PROFILES.threshold_short);
//   monitor.start();
// ─────────────────────────────────────────────────────────────────────────────
export class DriftMonitor {
  private config:   DriftMonitorConfig;
  private watched:  Map<string, { receipt: DriftInputReceipt; profile: DriftProfile }>;
  private statuses: Map<string, DriftStatus>;
  private timer:    ReturnType<typeof setInterval> | null = null;

  constructor(config: DriftMonitorConfig) {
    this.config   = config;
    this.watched  = new Map();
    this.statuses = new Map();
  }

  /** Register a receipt for continuous monitoring. */
  watch(receipt: DriftInputReceipt, profile: DriftProfile): void {
    this.watched.set(receipt.receipt_id, { receipt, profile });
    // Seed initial status so first tick can detect transitions
    this.statuses.set(receipt.receipt_id, scoreToStatus(receipt.v_score));
  }

  /** Remove a receipt from monitoring. */
  unwatch(receiptId: string): void {
    this.watched.delete(receiptId);
    this.statuses.delete(receiptId);
  }

  /** Start the monitoring loop. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.config.intervalMs);
    this.tick(); // immediate first evaluation
  }

  /** Stop the monitoring loop. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Run one evaluation cycle manually. */
  tick(): DriftReceipt[] {
    const now     = new Date();
    const results: DriftReceipt[] = [];

    for (const [id, { receipt, profile }] of this.watched) {
      const result      = computeDrift(receipt, profile, now);
      const prevStatus  = this.statuses.get(id)!;
      const nextStatus  = result.drift.status;

      // Fire threshold event if zone changed
      if (prevStatus !== nextStatus && this.config.onThreshold) {
        const event: DriftThresholdEvent = {
          receipt_id: id,
          from:       prevStatus,
          to:         nextStatus,
          score:      result.drift.decayed_score,
          delta:      result.drift.delta,
          at:         now.toISOString(),
        };
        this.config.onThreshold(event);
      }

      this.statuses.set(id, nextStatus);
      results.push(result);
    }

    if (this.config.onTick) this.config.onTick(results);
    return results;
  }

  /** Snapshot: get all current drift results without advancing the timer. */
  snapshot(): DriftReceipt[] {
    return this.tick();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// profileFor()
//
// Convenience: look up a built-in profile by name, falling back to DEFAULT.
//
// Usage:
//   const profile = profileFor('threshold_short');
// ─────────────────────────────────────────────────────────────────────────────
export function profileFor(name: string): DriftProfile {
  return DRIFT_PROFILES[name] ?? DEFAULT;
}

// ── Re-exports ───────────────────────────────────────────────────────────────
export { DRIFT_PROFILES }             from './profiles/index';
export { linearDecay, sigmoidDecay, exponentialDecay, applyDecay } from './curves/index';
export { computeDriftFromInput }     from './agent-api';
export type {
  DecayCurve,
  DriftProfile,
  DriftInputReceipt,
  DriftReceipt,
  DriftStatus,
  DriftThresholdEvent,
  DriftMonitorConfig,
  VScoreComponents,
  DriftSnapshot,
  DriftConfig,
  DriftInput,
  DriftResult,
  AgentDriftReceipt,
} from './types/index';

// ── PROFILES alias for @uvrn/agent (short names) ─────────────────────────────
export const PROFILES: Record<string, DriftProfile> = {
  ...DRIFT_PROFILES,
};
export type ProfileName = keyof typeof DRIFT_PROFILES;
