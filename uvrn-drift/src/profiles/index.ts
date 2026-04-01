// ─────────────────────────────────────────────
// @uvrn/drift · built-in DriftProfiles
// ─────────────────────────────────────────────
// These are generic, domain-agnostic example profiles that demonstrate
// each decay curve type at different speeds. They serve as reasonable
// starting points for common claim freshness categories.
//
// Consumers should create their own DriftProfile objects tuned to their
// specific domain (financial, research, regulatory, etc.) using the
// DriftProfile interface. The framework supports any custom profile.
//
// All profiles are exported individually and collected in DRIFT_PROFILES.

import type { DriftProfile } from '../types/index';

// ── Fast decay ─────────────────────────────────────────────────────────────

/**
 * Fast-moving claims where data goes stale within hours.
 * Decay: EXPONENTIAL — aggressive decay from t=0.
 *
 * Use for: any claim type where the underlying data changes rapidly
 * and old information quickly becomes unreliable.
 */
export const FAST: DriftProfile = {
  name: 'fast',
  curve: 'EXPONENTIAL',
  rate: 0.08,
  staleAfterHours: 24,
  scoreFloor: 0,
};

/**
 * Moderate-speed claims where data stays relevant for days.
 * Decay: EXPONENTIAL — steady decay, slower than FAST.
 *
 * Use for: claims that update regularly but aren't invalidated
 * by a few hours of delay.
 */
export const MODERATE: DriftProfile = {
  name: 'moderate',
  curve: 'EXPONENTIAL',
  rate: 0.04,
  staleAfterHours: 48,
  scoreFloor: 5,
};

// ── Threshold decay ────────────────────────────────────────────────────────

/**
 * Claims that hold firm then collapse at a threshold age.
 * Decay: SIGMOID — score stays high until the midpoint, then drops hard.
 *
 * Use for: any claim type where data is either current or not —
 * binary freshness with a sharp transition.
 */
export const THRESHOLD_SHORT: DriftProfile = {
  name: 'threshold_short',
  curve: 'SIGMOID',
  rate: 36,             // midpoint: 36 hours
  staleAfterHours: 72,
  scoreFloor: 0,
};

/**
 * Long-hold threshold claims — data holds for weeks then drops.
 * Decay: SIGMOID — extended plateau followed by sharp decline.
 *
 * Use for: claims based on data that remains valid for extended
 * periods but becomes sharply outdated once superseded.
 */
export const THRESHOLD_LONG: DriftProfile = {
  name: 'threshold_long',
  curve: 'SIGMOID',
  rate: 336,            // midpoint: 2 weeks
  staleAfterHours: 2160, // 90 days
  scoreFloor: 10,
};

// ── Slow decay ─────────────────────────────────────────────────────────────

/**
 * Slow-moving claims where data stays relevant for weeks/months.
 * Decay: LINEAR — gradual, predictable erosion over time.
 *
 * Use for: established facts, announcements, or findings that
 * slowly lose relevance but don't suddenly become invalid.
 */
export const SLOW: DriftProfile = {
  name: 'slow',
  curve: 'LINEAR',
  rate: 0.1,
  staleAfterHours: 8760, // 1 year
  scoreFloor: 20,
};

/**
 * Very slow decay for long-lived claims (academic, archival).
 * Decay: LINEAR — minimal erosion over months to years.
 */
export const ARCHIVAL: DriftProfile = {
  name: 'archival',
  curve: 'LINEAR',
  rate: 0.02,
  staleAfterHours: 17520, // 2 years
  scoreFloor: 30,
};

// ── Default ─────────────────────────────────────────────────────────────────

/**
 * Fallback profile for uncategorized claims.
 * Conservative LINEAR decay over 30 days.
 */
export const DEFAULT: DriftProfile = {
  name: 'default',
  curve: 'LINEAR',
  rate: 0.15,
  staleAfterHours: 720,
  scoreFloor: 0,
};

// ── Registry ────────────────────────────────────────────────────────────────

export const DRIFT_PROFILES: Record<string, DriftProfile> = {
  fast:             FAST,
  moderate:         MODERATE,
  threshold_short:  THRESHOLD_SHORT,
  threshold_long:   THRESHOLD_LONG,
  slow:             SLOW,
  archival:         ARCHIVAL,
  default:          DEFAULT,
};
