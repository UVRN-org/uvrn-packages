/**
 * Strict structural validation for the version-2 contract. Every helper throws a typed
 * ForecastValidationError naming the member path; messages never echo input values.
 */

import { citationProblem, copyCitation, type Citation } from './citation';
import { ForecastValidationError, type ForecastValidationCode } from './refusal';
import { parseZoned } from './time';

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function fail(code: ForecastValidationCode, path: string, message: string): never {
  throw new ForecastValidationError(code, path, message);
}

/** expectRecord requires a plain object whose members are all declared (required ∪ optional). */
export function expectRecord(
  value: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[] = []
): Record<string, unknown> {
  if (!isPlainRecord(value)) fail('invalid_input', path, 'must be an object');
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail('unknown_field', `${path}.${key}`, 'is not a declared member');
  }
  for (const key of required) {
    if (value[key] === undefined) fail('invalid_input', `${path}.${key}`, 'is required');
  }
  return value;
}

/** A string that is non-empty after trimming leading/trailing whitespace. */
export function expectText(value: unknown, path: string, code: ForecastValidationCode = 'invalid_input'): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(code, path, 'must be a non-empty string');
  return value;
}

export function expectOptionalText(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  return expectText(value, path);
}

export function expectFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail('invalid_input', path, 'must be a finite number');
  return value;
}

export function expectArray(value: unknown, path: string, minItems = 0): unknown[] {
  if (!Array.isArray(value)) fail('invalid_input', path, 'must be an array');
  if (value.length < minItems) fail('invalid_input', path, `must contain at least ${minItems} item(s)`);
  return value;
}

const STRICT_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const STRICT_ZONED = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function validCalendarDay(year: string, month: string, day: string): boolean {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/**
 * Version-2 calendar check for `YYYY-MM-DD`: real month and day (leap years included). Unlike
 * `Date.parse`, an impossible date never rolls over into the next month.
 */
export function isStrictCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = STRICT_DATE.exec(value);
  return !!m && validCalendarDay(m[1], m[2], m[3]);
}

/**
 * Version-2 check for a zoned ISO 8601 timestamp: real calendar day, hour 0–23, minute 0–59,
 * second 0–59, at most 3 fractional-second digits (milliseconds), and offset hours 0–23 / minutes
 * 0–59. `T24:00`, Feb 30, `+24:00`, and sub-millisecond fractions are rejected rather than rolled
 * over or truncated. The version-1 parser in `time.ts` is unchanged.
 */
export function isStrictZoned(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = STRICT_ZONED.exec(value);
  if (!m || !validCalendarDay(m[1], m[2], m[3])) return false;
  if (Number(m[4]) > 23 || Number(m[5]) > 59) return false;
  if (m[6] !== undefined && Number(m[6]) > 59) return false;
  if (m[7] !== undefined && (Number(m[7]) > 23 || Number(m[8]) > 59)) return false;
  return parseZoned(value) !== null;
}

export function expectZoned(value: unknown, path: string): string {
  if (!isStrictZoned(value)) {
    fail('invalid_input', path, 'must be a valid ISO 8601 timestamp with a timezone (Z or ±hh:mm)');
  }
  return value;
}

export function expectDateOrZoned(value: unknown, path: string): string {
  if (!isStrictCalendarDate(value) && !isStrictZoned(value)) {
    fail('invalid_input', path, 'must be a valid calendar date (YYYY-MM-DD) or a zoned ISO 8601 timestamp');
  }
  return value as string;
}

const STRICT_OFFSET = /^([+-])(\d{2}):(\d{2})$/;

/** Smallest and largest civil UTC offsets accepted for a version-3 deadline, in minutes. */
export const MIN_OFFSET_MINUTES = -12 * 60;
export const MAX_OFFSET_MINUTES = 14 * 60;

/**
 * parseOffsetMinutes returns the signed minutes of a version-3 fixed UTC offset `±hh:mm`, or null.
 * Minutes must be 00–59; the range check applies to the combined signed value (−12:00 … +14:00),
 * so `-12:30` and `+14:01` are rejected. `-00:00` (an "unknown offset" marker in some standards)
 * is rejected; UTC is written `+00:00`.
 */
export function parseOffsetMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = STRICT_OFFSET.exec(value);
  if (!m) return null;
  const hours = Number(m[2]);
  const minutes = Number(m[3]);
  if (minutes > 59) return null;
  if (m[1] === '-' && hours === 0 && minutes === 0) return null;
  const total = (m[1] === '-' ? -1 : 1) * (hours * 60 + minutes);
  return total < MIN_OFFSET_MINUTES || total > MAX_OFFSET_MINUTES ? null : total;
}

export function isStrictOffset(value: unknown): value is string {
  return parseOffsetMinutes(value) !== null;
}

/** A date-only `YYYY-MM-DD` (as opposed to a zoned timestamp). */
export function isDateOnly(value: string): boolean {
  return STRICT_DATE.test(value);
}

/** expectCitation validates the citation shape (SPEC v1 §3.1), closed members, and returns a copy. */
export function expectCitation(value: unknown, path: string): Citation {
  if (!isPlainRecord(value)) fail('missing_citation', path, 'citation is missing');
  for (const key of Object.keys(value)) {
    if (key !== 'url' && key !== 'accessedAt' && key !== 'label') {
      fail('unknown_field', `${path}.${key}`, 'is not a declared citation member');
    }
  }
  const problem = citationProblem(value);
  if (problem) fail('missing_citation', path, problem);
  if (!isStrictZoned(value.accessedAt)) {
    fail('missing_citation', `${path}.accessedAt`, 'must be a valid ISO 8601 timestamp with a timezone (Z or ±hh:mm)');
  }
  return copyCitation(value as unknown as Citation);
}
