export interface ScoringProfile {
  name: string;
  description: string;
  completenessNote: string;
  parityNote: string;
  freshnessNote: string;
  thresholds: {
    stable: number;
    drifting: number;
  };
}

export interface ComponentBreakdown {
  raw: number;
  weight: number;
  weighted: number;
}

export interface ScoreBreakdownResult {
  completeness: ComponentBreakdown;
  parity: ComponentBreakdown;
  freshness: ComponentBreakdown;
  final: number;
  explanation: string;
  profile: string;
}

export interface ScoreInputComponents {
  completeness: number;
  parity: number;
  freshness: number;
}

import { VSCORE_WEIGHTS } from '@uvrn/core';

/**
 * V-Score component weights. Re-exported from `@uvrn/core`'s canonical
 * `VSCORE_WEIGHTS` — the formula lives only in core (house rule #1). This is a
 * passthrough, not a second source of truth.
 */
export const WEIGHTS = VSCORE_WEIGHTS;
