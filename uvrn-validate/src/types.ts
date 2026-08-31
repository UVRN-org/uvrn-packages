import type { MeasurementResult, MeasurementSource } from '@uvrn/core';

/**
 * Minimal front-desk input. Distinct from DeltaBundle / DataSpec and from receipts.
 */
export type DataPoint = {
  /** Stable caller id for the point. */
  id: string;
  /** Caller-declared kind (v0 does not freeze a closed enum). */
  kind: string;
  /** Payload whose presence is checked in Stage1. */
  value: unknown;
  /**
   * Optional Stage1-shaped string only. Does not feed Stage2 in v0 —
   * Stage2 is host-sources-only (`options.sources`). Connectors/mock/`score_claim`
   * full path = expand-later.
   */
  sourceRef?: string;
};

/** Stage1 shape/presence only — never integrity-checked or verified. */
export type Stage1Token = 'structurally-ok' | 'malformed';

/**
 * Stage2 headline tokens reuse existing `@uvrn/measure` starter verdicts.
 * `primaryMeasureToken` prefers the agree module (`agree` | `no-agreement` |
 * `insufficient-data`); fallback to the first measurement can surface
 * `disagree` | `conflict` | `potential` | `none` as well.
 * Forbidden on this surface: `verified`. Stage1 must not emit `integrity-checked`.
 */
export type Stage2Token =
  | 'agree'
  | 'no-agreement'
  | 'disagree'
  | 'none'
  | 'conflict'
  | 'potential'
  | 'insufficient-data';

export type ValidateDataPointOptions = {
  /**
   * Explicit Stage2 gate. When false/omitted, measure is never called.
   * When true with fewer than two host sources → honest `insufficient-data`.
   */
  runStage2?: boolean;
  /**
   * Host evidence for Stage2. Counted only when `runStage2` is true.
   * Shape matches `@uvrn/measure` / MeasurementSource (score_claim-compatible numeric path).
   * DataPoint.sourceRef does not populate this list in v0.
   */
  sources?: ReadonlyArray<MeasurementSource>;
  /** Optional claim text forwarded to measure when Stage2 runs. */
  claim?: string;
};

export type Stage2Result = {
  /** Measure vocabulary token (or insufficient-data on shortfall). */
  token: Stage2Token;
  /** Present when measure ran (≥2 sources). */
  measurements?: MeasurementResult[];
};

export type ValidateDataPointResult = {
  /** Which stage produced the decisive answer (1 = shape only; 2 = relational). */
  stage: 1 | 2;
  stage1: Stage1Token;
  /** Human-readable shape notes (malformed reasons, or empty when ok). */
  reasons: string[];
  /** Present only when `runStage2` was explicitly true and Stage1 was structurally-ok. */
  stage2?: Stage2Result;
};
