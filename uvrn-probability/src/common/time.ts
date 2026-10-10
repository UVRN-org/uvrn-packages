/**
 * Timestamp rules (SPEC §3.2). Nothing in this package reads the clock: every time comes from a
 * cited input.
 */

/** Full ISO 8601 timestamp with an explicit zone: `Z` or `±hh:mm`. */
const ZONED_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

/** Calendar date `YYYY-MM-DD`, interpreted as 00:00:00 UTC. */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const MS_PER_DAY = 86_400_000;

/** parseZoned returns epoch ms for a zoned ISO timestamp, or null when the string is not one. */
export function parseZoned(value: unknown): number | null {
  if (typeof value !== 'string' || !ZONED_TIMESTAMP.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * parseDateOrZoned accepts a calendar date (UTC midnight) or a zoned timestamp.
 * Used for case event dates and resolution dates, which sources usually publish as dates.
 */
export function parseDateOrZoned(value: unknown): number | null {
  if (typeof value === 'string' && CALENDAR_DATE.test(value)) {
    const ms = Date.parse(`${value}T00:00:00Z`);
    if (Number.isNaN(ms)) return null;
    return new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
  }
  return parseZoned(value);
}

/** toUtcIso renders epoch ms as `YYYY-MM-DDTHH:mm:ss.sssZ`. */
export function toUtcIso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Version 3: every instant a v3 record renders (deadline bounds, event cutoff, horizon) must be a
 * UTC instant with a 4-digit year, so `toISOString` never emits an extended `±YYYYYY` year.
 */
export const MIN_RECORDED_MS = Date.parse('0000-01-01T00:00:00.000Z');
export const MAX_RECORDED_MS = Date.parse('9999-12-31T23:59:59.999Z');

/** True when `ms` renders as a 4-digit-year UTC instant (years 0000–9999). */
export function isRecordableInstant(ms: number): boolean {
  return ms >= MIN_RECORDED_MS && ms <= MAX_RECORDED_MS;
}

/**
 * dayBoundsMs returns the version-3 local deadline day for a `YYYY-MM-DD` date at a fixed UTC
 * offset: `startMs` = local 00:00, `endExclusiveMs` = the next local 00:00 (exactly one day later).
 */
export function dayBoundsMs(date: string, offsetMinutes: number): { startMs: number; endExclusiveMs: number } {
  const startMs = Date.parse(`${date}T00:00:00Z`) - offsetMinutes * 60_000;
  return { startMs, endExclusiveMs: startMs + MS_PER_DAY };
}

/** localDate renders the calendar date of `ms` at a fixed UTC offset, as `YYYY-MM-DD`. */
export function localDate(ms: number, offsetMinutes: number): string {
  return new Date(ms + offsetMinutes * 60_000).toISOString().slice(0, 10);
}
