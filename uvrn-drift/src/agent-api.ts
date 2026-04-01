// ─────────────────────────────────────────────
// @uvrn/drift · agent API (computeDriftFromInput)
// Used by @uvrn/agent. Takes DriftInput, returns DriftResult.
// ─────────────────────────────────────────────

import { applyDecay } from './curves/index';
import type {
  DriftInput,
  DriftResult,
  DriftSnapshot,
  DriftConfig,
  DriftThresholdEvent,
  AgentDriftReceipt,
  VScoreComponents,
  DriftProfile,
  DriftStatus,
} from './types/index';

const DRIFT_MODULE = '@uvrn/drift@0.1.0';

function toConfig(profile: DriftProfile | DriftConfig): DriftConfig {
  if ('weights' in profile && 'thresholds' in profile) {
    return profile as DriftConfig;
  }
  const p = profile as DriftProfile;
  return {
    weights:    { completeness: 0.35, parity: 0.35, freshness: 0.3 },
    thresholds: { drifting: 80, critical: 60 },
    curve:      p.curve,
    rate:       p.rate,
  };
}

function ageHours(verifiedAt: string): number {
  const verified = new Date(verifiedAt).getTime();
  const now      = Date.now();
  return Math.max(0, (now - verified) / (1000 * 60 * 60));
}

function deriveStatus(score: number, config: DriftConfig): DriftStatus {
  if (score >= config.thresholds.drifting) return 'STABLE';
  if (score >= config.thresholds.critical) return 'DRIFTING';
  return 'CRITICAL';
}

function computeVScore(components: VScoreComponents, weights: DriftConfig['weights']): number {
  const raw =
    components.completeness * weights.completeness +
    components.parity       * weights.parity +
    components.freshness    * weights.freshness;
  return Math.max(0, Math.min(100, raw));
}

function dominantComponent(
  current: VScoreComponents,
  previous: VScoreComponents
): keyof VScoreComponents | 'composite' {
  const deltas = {
    completeness: Math.abs(current.completeness - previous.completeness),
    parity:       Math.abs(current.parity - previous.parity),
    freshness:    Math.abs(current.freshness - previous.freshness),
  };
  const max = Math.max(...Object.values(deltas));
  if (max < 1) return 'composite';
  return (Object.entries(deltas).find(([, v]) => v === max)![0]) as keyof VScoreComponents;
}

function detectCrossings(
  input: DriftInput,
  snapshot: DriftSnapshot
): DriftThresholdEvent[] {
  const events: DriftThresholdEvent[] = [];
  const prev = input.previousSnapshot;
  if (!prev) return events;
  const from = prev.status;
  const to   = snapshot.status;
  if (from !== to) {
    events.push({
      receipt_id:  snapshot.receiptId,
      from,
      to,
      score:       snapshot.vScore,
      delta:       snapshot.driftDelta ?? 0,
      at:          snapshot.scoredAt,
      claimId:     input.claimId,
      receiptId:   snapshot.receiptId,
      vScore:      snapshot.vScore,
      crossedAt:   snapshot.scoredAt,
      component:   dominantComponent(snapshot.components, prev.components),
    });
  }
  return events;
}

function buildReceipt(
  input: DriftInput,
  snapshot: DriftSnapshot,
  config: DriftConfig
): AgentDriftReceipt {
  return {
    receipt_id:   `${input.receiptId}_drift_${Date.now()}`,
    claim_id:     input.claimId,
    agent:        '@uvrn/agent@0.1.0',
    drift_module: DRIFT_MODULE,
    v_score:      snapshot.vScore,
    drift_delta:  snapshot.driftDelta ?? 0,
    decay_curve:  config.curve,
    age_hours:    snapshot.ageHours ?? 0,
    status:       snapshot.status,
    components:   snapshot.components,
    thresholds:   config.thresholds,
    scored_at:    snapshot.scoredAt,
    tags:         ['#uvrn', '#drvc3', '#drift', `#${snapshot.status}`],
  };
}

export function computeDriftFromInput(input: DriftInput): DriftResult {
  const age  = ageHours(input.verifiedAt);
  const now  = new Date().toISOString();
  const cfg  = toConfig(input.config);

  const decayedComponents: VScoreComponents = {
    completeness: applyDecay(cfg.curve, input.components.completeness, age, cfg.rate),
    parity:       applyDecay(cfg.curve, input.components.parity, age, cfg.rate),
    freshness:    applyDecay(cfg.curve, input.components.freshness, age, cfg.rate),
  };

  const vScore = computeVScore(decayedComponents, cfg.weights);
  const prevScore = input.previousSnapshot?.vScore ?? input.originalScore;
  const delta = vScore - prevScore;

  const snapshot: DriftSnapshot = {
    receiptId:  input.receiptId,
    claimId:    input.claimId,
    scoredAt:   now,
    components: decayedComponents,
    vScore,
    decayCurve: cfg.curve,
    ageHours:   age,
    driftDelta: delta,
    status:     deriveStatus(vScore, cfg),
  };

  const events  = detectCrossings(input, snapshot);
  const receipt = buildReceipt(input, snapshot, cfg);

  return { snapshot, events, receipt };
}
