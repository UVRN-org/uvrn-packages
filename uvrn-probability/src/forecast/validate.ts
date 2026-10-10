/**
 * Structural validation of `uvrn-probability-input-2` (SPEC/uvrn-probability-v2.md §2). Anything
 * malformed throws a typed ForecastValidationError and produces no receipt. Semantic problems with
 * supported data (stale quotes, thin classes, deadline mismatch) are refusals, decided later.
 */

import { DEFAULT_THRESHOLDS, type Thresholds } from '../common/thresholds';
import {
  expectArray,
  expectCitation,
  expectDateOrZoned,
  expectFiniteNumber,
  expectRecord,
  expectText,
  expectZoned,
  fail,
  isDateOnly,
  isPlainRecord,
} from '../common/strict';
import { parseDateOrZoned, parseZoned } from '../common/time';
import { FORECAST_INPUT_VERSION, FORECAST_V3_INPUT_VERSION, PROBABILITY_INPUT_VERSION } from '../version';
import type { ForecastMode } from './types';

const PREFIXED_HASH = /^sha256:[0-9a-f]{64}$/;
const MODES: readonly ForecastMode[] = ['market', 'baserate', 'judgment'];

export const FORECAST_INPUT_REQUIRED = ['specVersion', 'forecastId', 'mode', 'question', 'asOf', 'producer'] as const;
export const FORECAST_INPUT_OPTIONAL = ['market', 'baserate', 'judgment', 'thresholds', 'revision', 'profile'] as const;

/** The request contract `runForecast` dispatches on: 2 (`input-2`) or 3 (`input-3`). */
export type ForecastContract = 2 | 3;

/** Top-level envelope: version, closed members, mode selection, and no inputs for other modes. */
export function validateEnvelope(input: unknown): { raw: Record<string, unknown>; mode: ForecastMode; contract: ForecastContract } {
  if (!isPlainRecord(input)) fail('invalid_input', 'input', 'must be an object');
  if (input.specVersion !== FORECAST_INPUT_VERSION && input.specVersion !== FORECAST_V3_INPUT_VERSION) {
    const hint = input.specVersion === PROBABILITY_INPUT_VERSION ? '; use runProbability for the legacy version-1 contract' : '';
    fail('unsupported_version', 'specVersion', `must be "${FORECAST_INPUT_VERSION}" or "${FORECAST_V3_INPUT_VERSION}"${hint}`);
  }
  const contract: ForecastContract = input.specVersion === FORECAST_V3_INPUT_VERSION ? 3 : 2;
  const raw = expectRecord(input, 'input', FORECAST_INPUT_REQUIRED, FORECAST_INPUT_OPTIONAL);
  if (!MODES.includes(raw.mode as ForecastMode)) fail('invalid_input', 'mode', 'must be "market", "baserate", or "judgment"');
  const mode = raw.mode as ForecastMode;
  for (const other of MODES) {
    if (other !== mode && raw[other] !== undefined) {
      fail('mixed_mode_input', other, `is not allowed when mode is "${mode}"; there is no fallback or blending`);
    }
  }
  if (raw[mode] === undefined) fail('invalid_input', mode, `is required when mode is "${mode}"`);
  return { raw, mode, contract };
}

export function validateAsOf(value: unknown): { at: string; atMs: number; source: ReturnType<typeof expectCitation> } {
  const a = expectRecord(value, 'asOf', ['at', 'source']);
  const at = expectZoned(a.at, 'asOf.at');
  return { at, atMs: parseZoned(at) as number, source: expectCitation(a.source, 'asOf.source') };
}

export function validateProducer(value: unknown): { id: string; kind: 'agent' | 'human'; model: string | null } {
  const p = expectRecord(value, 'producer', ['id', 'kind'], ['model']);
  const id = expectText(p.id, 'producer.id');
  if (p.kind !== 'agent' && p.kind !== 'human') fail('invalid_input', 'producer.kind', 'must be "agent" or "human"');
  const model = p.model === undefined ? null : expectText(p.model, 'producer.model');
  return { id, kind: p.kind, model };
}

export function validateRevision(value: unknown): { previousProbabilityHash: string; reason: string } | null {
  if (value === undefined) return null;
  const r = expectRecord(value, 'revision', ['previousProbabilityHash', 'reason']);
  if (typeof r.previousProbabilityHash !== 'string' || !PREFIXED_HASH.test(r.previousProbabilityHash)) {
    fail('invalid_revision', 'revision.previousProbabilityHash', 'must be sha256:<64 lowercase hex>');
  }
  return { previousProbabilityHash: r.previousProbabilityHash, reason: expectText(r.reason, 'revision.reason', 'invalid_revision') };
}

/**
 * validateThresholds merges overrides onto the PROVISIONAL defaults. Version 2 requires minCases
 * to be a positive integer; other thresholds are finite and non-negative.
 */
export function validateThresholds(value: unknown, mode: ForecastMode): { values: Thresholds; overridden: string[] } | null {
  if (mode === 'judgment') {
    if (value !== undefined) fail('invalid_threshold', 'thresholds', 'apply only to market and baserate modes');
    return null;
  }
  const values: Thresholds = { ...DEFAULT_THRESHOLDS };
  const overridden: string[] = [];
  if (value === undefined) return { values, overridden };
  const keys = Object.keys(DEFAULT_THRESHOLDS) as (keyof Thresholds)[];
  const t = expectRecord(value, 'thresholds', [], keys);
  for (const key of keys) {
    const v = t[key];
    if (v === undefined) continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      fail('invalid_threshold', `thresholds.${key}`, 'must be a finite non-negative number');
    }
    if (key === 'minCases' && (!Number.isInteger(v) || v < 1)) {
      fail('invalid_threshold', 'thresholds.minCases', 'must be a positive integer (≥ 1)');
    }
    if (v !== values[key]) overridden.push(key);
    values[key] = v;
  }
  return { values, overridden: overridden.sort() };
}

function validateOdds(value: unknown, path: string): void {
  if (!isPlainRecord(value)) fail('invalid_input', path, 'must be an object');
  if (value.format === 'american' || value.format === 'decimal') {
    const o = expectRecord(value, path, ['format', 'value']);
    expectFiniteNumber(o.value, `${path}.value`);
  } else if (value.format === 'fractional') {
    const o = expectRecord(value, path, ['format', 'numerator', 'denominator']);
    expectFiniteNumber(o.numerator, `${path}.numerator`);
    expectFiniteNumber(o.denominator, `${path}.denominator`);
  } else {
    fail('invalid_input', `${path}.format`, 'must be "american", "decimal", or "fractional"');
  }
}

/** A date-or-zoned member; a rule profile with `require.zonedTimestamps` rejects the date-only form. */
function expectDateField(value: unknown, path: string, requireZoned: boolean): string {
  const v = expectDateOrZoned(value, path);
  if (requireZoned && isDateOnly(v)) fail('profile_violation', path, 'must be a zoned timestamp under the rule profile');
  return v;
}

/** Market structure (binary questions only). Price validity and freshness stay refusals. */
export function validateMarket(value: unknown, requireZoned = false): void {
  const m = expectRecord(
    value,
    'market',
    ['kind', 'venue', 'domain', 'resolvesAt', 'targetOutcome', 'outcomes', 'source'],
    ['settlesAt']
  );
  if (m.kind !== 'sportsbook' && m.kind !== 'exchange') fail('invalid_input', 'market.kind', 'must be "sportsbook" or "exchange"');
  expectText(m.venue, 'market.venue');
  expectText(m.domain, 'market.domain');
  expectText(m.targetOutcome, 'market.targetOutcome');
  expectDateField(m.resolvesAt, 'market.resolvesAt', requireZoned);
  if (m.settlesAt !== undefined) expectDateField(m.settlesAt, 'market.settlesAt', requireZoned);
  expectCitation(m.source, 'market.source');
  const outcomes = expectArray(m.outcomes, 'market.outcomes', m.kind === 'exchange' ? 1 : 2);
  const labels = new Set<string>();
  outcomes.forEach((raw, i) => {
    const path = `market.outcomes[${i}]`;
    const o =
      m.kind === 'sportsbook'
        ? expectRecord(raw, path, ['label', 'odds', 'quotedAt', 'source'])
        : expectRecord(raw, path, ['label', 'bid', 'ask', 'depthUsd', 'quotedAt', 'source']);
    const label = expectText(o.label, `${path}.label`);
    if (labels.has(label)) fail('invalid_input', `${path}.label`, 'duplicates another outcome label');
    labels.add(label);
    expectZoned(o.quotedAt, `${path}.quotedAt`);
    expectCitation(o.source, `${path}.source`);
    if (m.kind === 'sportsbook') validateOdds(o.odds, `${path}.odds`);
    else for (const key of ['bid', 'ask', 'depthUsd'] as const) expectFiniteNumber(o[key], `${path}.${key}`);
  });
  if (!labels.has(m.targetOutcome as string)) fail('invalid_input', 'market.targetOutcome', 'is not one of the listed outcome labels');
}

function validateMeets(value: unknown, path: string): void {
  const list = expectArray(value, path);
  list.forEach((v, i) => expectText(v, `${path}[${i}]`));
}

/** Base-rate structure (binary questions only). Gates, counts, and estimator support stay refusals. */
export function validateBaseRate(value: unknown, asOfMs: number, requireZoned = false): void {
  if (!isPlainRecord(value)) fail('invalid_input', 'baserate', 'must be an object');
  const mode = value.mode;
  if (mode !== 'proportion' && mode !== 'time-to-event') {
    fail('invalid_input', 'baserate.mode', 'must be "proportion" or "time-to-event"');
  }
  const b =
    mode === 'proportion'
      ? expectRecord(value, 'baserate', ['mode', 'referenceClass', 'cases'])
      : expectRecord(value, 'baserate', ['mode', 'referenceClass', 'cases', 'subject', 'horizon', 'targetEvent']);

  const rc = expectRecord(b.referenceClass, 'baserate.referenceClass', ['id', 'description', 'criteria', 'source']);
  expectText(rc.id, 'baserate.referenceClass.id');
  if (typeof rc.description !== 'string') fail('invalid_input', 'baserate.referenceClass.description', 'must be a string');
  expectCitation(rc.source, 'baserate.referenceClass.source');
  const criterionIds = new Set<string>();
  expectArray(rc.criteria, 'baserate.referenceClass.criteria', 1).forEach((raw, i) => {
    const path = `baserate.referenceClass.criteria[${i}]`;
    const c = expectRecord(raw, path, ['id', 'text', 'source']);
    const id = expectText(c.id, `${path}.id`);
    if (criterionIds.has(id)) fail('invalid_input', `${path}.id`, 'duplicates another criterion id');
    criterionIds.add(id);
    expectText(c.text, `${path}.text`);
    expectCitation(c.source, `${path}.source`);
  });

  expectArray(b.cases, 'baserate.cases').forEach((raw, i) => {
    const path = `baserate.cases[${i}]`;
    if (mode === 'proportion') {
      const c = expectRecord(raw, path, ['id', 'source', 'meetsCriteria', 'outcome', 'resolvedAt']);
      expectText(c.id, `${path}.id`);
      expectCitation(c.source, `${path}.source`);
      validateMeets(c.meetsCriteria, `${path}.meetsCriteria`);
      if (c.outcome !== 'yes' && c.outcome !== 'no') fail('invalid_input', `${path}.outcome`, 'must be "yes" or "no"');
      expectDateField(c.resolvedAt, `${path}.resolvedAt`, requireZoned);
    } else {
      const c = expectRecord(raw, path, ['id', 'source', 'meetsCriteria', 'filedAt', 'status', 'statusAt']);
      expectText(c.id, `${path}.id`);
      expectCitation(c.source, `${path}.source`);
      validateMeets(c.meetsCriteria, `${path}.meetsCriteria`);
      expectDateField(c.filedAt, `${path}.filedAt`, requireZoned);
      if (!['approved', 'denied', 'withdrawn', 'pending'].includes(c.status as string)) {
        fail('invalid_input', `${path}.status`, 'must be approved | denied | withdrawn | pending');
      }
      expectDateField(c.statusAt, `${path}.statusAt`, requireZoned);
    }
  });

  if (mode === 'time-to-event') {
    const s = expectRecord(b.subject, 'baserate.subject', ['filedAt', 'source'], ['id']);
    if (s.id !== undefined) expectText(s.id, 'baserate.subject.id');
    const filed = expectDateField(s.filedAt, 'baserate.subject.filedAt', requireZoned);
    if ((parseDateOrZoned(filed) as number) > asOfMs) fail('invalid_input', 'baserate.subject.filedAt', 'is after asOf');
    expectCitation(s.source, 'baserate.subject.source');
    const h = expectRecord(b.horizon, 'baserate.horizon', ['by']);
    expectDateField(h.by, 'baserate.horizon.by', requireZoned);
    if (b.targetEvent !== 'approved') fail('invalid_input', 'baserate.targetEvent', 'must be "approved"');
  }
}
