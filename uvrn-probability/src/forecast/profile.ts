/**
 * Rule profiles (`uvrn-probability-profile-1`, SPEC/uvrn-probability-v2.md §8.1): caller-supplied,
 * data-only policy that can only TIGHTEN a forecast request — restrict modes, raise floors / lower
 * ceilings on the existing thresholds, and require stricter input forms. No callbacks, no code.
 * A profile is identified by a hash of its uvrn-jcs-1 canonical form; its content is the caller's.
 */

import { canonicalize, formatReceiptHash } from '@uvrn/receipt/canonical';
import { sha256Hex } from '@uvrn/receipt';
import { DEFAULT_THRESHOLDS, type Thresholds } from '../common/thresholds';
import { expectArray, expectRecord, expectText, fail, isPlainRecord } from '../common/strict';
import { PROFILE_SPEC_VERSION } from '../version';
import type { ForecastMode } from './types';

const MODES: readonly ForecastMode[] = ['market', 'baserate', 'judgment'];

/** Which direction is stricter for each threshold: a floor rises, a ceiling falls. */
export const THRESHOLD_DIRECTION: Readonly<Record<keyof Thresholds, 'floor' | 'ceiling'>> = Object.freeze({
  minCases: 'floor',
  maxQuoteStalenessMs: 'ceiling',
  maxExchangeSpread: 'ceiling',
  minExchangeDepthUsd: 'floor',
  maxSportsbookOverround: 'ceiling',
});

export interface ForecastProfileRequirements {
  /** Market and base-rate date fields must be zoned timestamps, not date-only (question.resolveBy stays a date). */
  zonedTimestamps?: boolean;
  /** A binary judgment allocation must include a subjective `range`. */
  judgmentRange?: boolean;
  /** A judgment allocation must cite at least one evidence item (no assumption-only estimates). */
  citedEvidence?: boolean;
}

export interface ForecastProfile {
  specVersion: typeof PROFILE_SPEC_VERSION;
  id: string;
  version: string;
  /** Modes this profile permits; omitted means all three. */
  allowedModes?: ForecastMode[];
  /** Limits at least as strict as the PROVISIONAL defaults; the strictest of profile and caller wins. */
  thresholds?: Partial<Thresholds>;
  require?: ForecastProfileRequirements;
}

/** What the result records about the applied profile (covered by probabilityHash). */
export interface ForecastProfileRecord {
  specVersion: typeof PROFILE_SPEC_VERSION;
  id: string;
  version: string;
  /** `sha256:` + hex SHA-256 of the uvrn-jcs-1 canonicalization of the supplied profile. */
  hash: string;
}

export interface ValidatedProfile {
  profile: ForecastProfile;
  record: ForecastProfileRecord;
  allowedModes: readonly ForecastMode[];
  thresholds: Partial<Thresholds>;
  require: Required<ForecastProfileRequirements>;
}

/** computeProfileHash returns `sha256:<hex>` over JCS of the profile exactly as supplied. */
export function computeProfileHash(profile: ForecastProfile): string {
  return formatReceiptHash(sha256Hex(canonicalize(profile as unknown as Record<string, unknown>)));
}

function stricter(key: keyof Thresholds, a: number, b: number): number {
  return THRESHOLD_DIRECTION[key] === 'floor' ? Math.max(a, b) : Math.min(a, b);
}

/** True when `value` is at least as strict as `limit` for this threshold. */
export function isAtLeastAsStrict(key: keyof Thresholds, value: number, limit: number): boolean {
  return THRESHOLD_DIRECTION[key] === 'floor' ? value >= limit : value <= limit;
}

/**
 * validateProfile checks the closed profile structure and the tighten-only rule. A profile that
 * would loosen a default fails with `invalid_profile`; it is never silently clamped.
 */
export function validateProfile(value: unknown): ValidatedProfile | null {
  if (value === undefined) return null;
  if (!isPlainRecord(value)) fail('invalid_profile', 'profile', 'must be an object');
  if (value.specVersion !== PROFILE_SPEC_VERSION) {
    fail('unsupported_version', 'profile.specVersion', `must be "${PROFILE_SPEC_VERSION}"`);
  }
  const p = expectRecord(value, 'profile', ['specVersion', 'id', 'version'], ['allowedModes', 'thresholds', 'require']);
  const id = expectText(p.id, 'profile.id', 'invalid_profile');
  const version = expectText(p.version, 'profile.version', 'invalid_profile');
  const copy: ForecastProfile = { specVersion: PROFILE_SPEC_VERSION, id, version };

  let allowedModes: readonly ForecastMode[] = MODES;
  if (p.allowedModes !== undefined) {
    const list = expectArray(p.allowedModes, 'profile.allowedModes');
    if (list.length === 0) fail('invalid_profile', 'profile.allowedModes', 'must list at least one mode');
    const seen = new Set<ForecastMode>();
    list.forEach((m, i) => {
      if (!MODES.includes(m as ForecastMode)) {
        fail('invalid_profile', `profile.allowedModes[${i}]`, 'must be "market", "baserate", or "judgment"');
      }
      if (seen.has(m as ForecastMode)) fail('invalid_profile', `profile.allowedModes[${i}]`, 'duplicates another mode');
      seen.add(m as ForecastMode);
    });
    copy.allowedModes = list as ForecastMode[];
    allowedModes = MODES.filter((m) => seen.has(m));
  }

  const thresholds: Partial<Thresholds> = {};
  if (p.thresholds !== undefined) {
    const keys = Object.keys(DEFAULT_THRESHOLDS) as (keyof Thresholds)[];
    const t = expectRecord(p.thresholds, 'profile.thresholds', [], keys);
    for (const key of keys) {
      const v = t[key];
      if (v === undefined) continue;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        fail('invalid_profile', `profile.thresholds.${key}`, 'must be a finite non-negative number');
      }
      if (key === 'minCases' && (!Number.isInteger(v) || v < 1)) {
        fail('invalid_profile', 'profile.thresholds.minCases', 'must be a positive integer (≥ 1)');
      }
      if (!isAtLeastAsStrict(key, v, DEFAULT_THRESHOLDS[key])) {
        const side = THRESHOLD_DIRECTION[key] === 'floor' ? 'below' : 'above';
        fail('invalid_profile', `profile.thresholds.${key}`, `is ${side} the default; a profile may only tighten`);
      }
      thresholds[key] = v;
    }
    copy.thresholds = { ...thresholds };
  }

  const require: Required<ForecastProfileRequirements> = { zonedTimestamps: false, judgmentRange: false, citedEvidence: false };
  if (p.require !== undefined) {
    const keys = ['zonedTimestamps', 'judgmentRange', 'citedEvidence'] as const;
    const r = expectRecord(p.require, 'profile.require', [], keys);
    const copied: ForecastProfileRequirements = {};
    for (const key of keys) {
      if (r[key] === undefined) continue;
      if (typeof r[key] !== 'boolean') fail('invalid_profile', `profile.require.${key}`, 'must be a boolean');
      require[key] = r[key] as boolean;
      copied[key] = r[key] as boolean;
    }
    copy.require = copied;
  }

  return {
    profile: copy,
    record: { specVersion: PROFILE_SPEC_VERSION, id, version, hash: computeProfileHash(copy) },
    allowedModes,
    thresholds,
    require,
  };
}

/** A disallowed mode is a typed validation error: the request is outside the caller's own policy. */
export function checkProfileMode(profile: ValidatedProfile | null, mode: ForecastMode): void {
  if (profile && !profile.allowedModes.includes(mode)) {
    fail('profile_violation', 'mode', 'is not allowed by the rule profile');
  }
}

/**
 * applyProfileThresholds composes tighten-only: for each key the effective value is the stricter of
 * the caller's value (or the default) and the profile's limit.
 */
export function applyProfileThresholds(values: Thresholds, profile: ValidatedProfile | null): Thresholds {
  if (!profile) return values;
  const out: Thresholds = { ...values };
  for (const key of Object.keys(profile.thresholds) as (keyof Thresholds)[]) {
    out[key] = stricter(key, out[key], profile.thresholds[key] as number);
  }
  return out;
}
