/**
 * Question definition, `questionHash` identity, and optional uvrn-outcome-1 declaration bindings
 * (SPEC/uvrn-probability-v2.md §3). The question is recorded as supplied; normalization (Unicode
 * NFC, then trim) applies only to the hash preimage.
 */

import { canonicalize, formatReceiptHash } from '@uvrn/receipt/canonical';
import { sha256Hex } from '@uvrn/receipt';
import { expectArray, expectRecord, expectText, expectZoned, fail, isStrictCalendarDate, parseOffsetMinutes } from '../common/strict';
import { MAX_RECORDED_MS, MIN_RECORDED_MS, MS_PER_DAY, dayBoundsMs, toUtcIso } from '../common/time';
import { QUESTION_SPEC_VERSION, QUESTION_V2_SPEC_VERSION } from '../version';

const PREFIXED_HASH = /^sha256:[0-9a-f]{64}$/;

export type QuestionKind = 'binary' | 'categorical';

/**
 * A uvrn-outcome-1 declaration binding: `entryId`, the other five hashed declaration members,
 * and `outcomeHash` (SPEC/uvrn-outcome-v1.md §3). Resolution members are not accepted here.
 */
export interface OutcomeDeclarationBinding {
  specVersion: 'uvrn-outcome-1';
  entryId: string;
  predictedOutcome: string;
  outcomeMetric: string;
  resolveBy: string;
  declaredAt: string;
  outcomeHash: string;
}

export interface QuestionOutcome {
  /** Stable outcome id. Binary questions use exactly `yes`, then `no`. */
  id: string;
  label: string;
  /** What must be true for this outcome; definitions are mutually exclusive and exhaustive. */
  definition: string;
  outcomeDeclaration?: OutcomeDeclarationBinding;
}

export interface ForecastQuestion {
  text: string;
  /** YYYY-MM-DD, interpreted through the end of that day in UTC. */
  resolveBy: string;
  resolutionRule: string;
  kind: QuestionKind;
  outcomes: QuestionOutcome[];
  /** The producer attests the outcomes are mutually exclusive and exhaustive. Structure is checked; meaning is not. */
  partitionConfirmed: true;
}

/** Version-3 question: the same members plus a REQUIRED fixed UTC offset for the deadline day. */
export interface ForecastQuestionV3 extends ForecastQuestion {
  /** `±hh:mm`, −12:00 … +14:00 (not `-00:00`). `resolveBy` runs from local 00:00 to the next local 00:00. */
  resolveByOffset: string;
}

/** The question as recorded in the output: as supplied, with absent declarations as null. */
export interface QuestionRecord {
  text: string;
  resolveBy: string;
  resolutionRule: string;
  kind: QuestionKind;
  outcomes: Array<{ id: string; label: string; definition: string; outcomeDeclaration: OutcomeDeclarationBinding | null }>;
  partitionConfirmed: true;
}

/** Version-3 question record: the version-2 record plus `resolveByOffset` as supplied. */
export interface QuestionRecordV3 extends QuestionRecord {
  resolveByOffset: string;
}

/**
 * The version-3 deadline as recorded in `inputs.deadline` (hashed): the local deadline day at the
 * supplied offset, as UTC instants. `endInstantUtcExclusive` is the first instant after the day.
 */
export interface DeadlineRecord {
  resolveBy: string;
  offset: string;
  startInstantUtc: string;
  endInstantUtcExclusive: string;
}

/** A validated version-3 deadline: the record plus the numbers evaluation needs. */
export interface ValidatedDeadline {
  record: DeadlineRecord;
  offsetMinutes: number;
  startMs: number;
  endExclusiveMs: number;
}

/** The closed uvrn-outcome-1 hash field list (SPEC/uvrn-outcome-v1.md §3), in declaration order. */
export const OUTCOME_DECLARATION_HASH_FIELDS = [
  'specVersion',
  'entryId',
  'predictedOutcome',
  'outcomeMetric',
  'resolveBy',
  'declaredAt',
] as const;

/** computeOutcomeDeclarationHash recomputes `uvrn-outcome-1` over its closed field list. */
export function computeOutcomeDeclarationHash(declaration: Record<string, unknown>): string {
  const preimage: Record<string, unknown> = {};
  for (const field of OUTCOME_DECLARATION_HASH_FIELDS) preimage[field] = declaration[field];
  return formatReceiptHash(sha256Hex(canonicalize(preimage)));
}

/** Hash-preimage normalization only: Unicode NFC, then trim leading/trailing whitespace. */
export function normalizeQuestionString(value: string): string {
  return value.normalize('NFC').trim();
}

/** The members that define question identity; declarations and attestations are not among them. */
export interface QuestionIdentityFields {
  text: string;
  kind: string;
  resolveBy: string;
  resolutionRule: string;
  outcomes: ReadonlyArray<{ id: string; label: string; definition: string }>;
  /**
   * Present only on version-3 questions (validators reject it on version 2). When present, the
   * identity is `uvrn-probability-question-2` and includes it; when absent, `-question-1`.
   */
  resolveByOffset?: string;
}

/**
 * The closed question-identity preimage. Excludes declarations, producer, time, probabilities.
 * Without `resolveByOffset` it is exactly `uvrn-probability-question-1`; with it (version 3) it is
 * `uvrn-probability-question-2`, the question-1 members plus `resolveByOffset`.
 */
export function questionHashPreimage(question: QuestionIdentityFields) {
  const n = normalizeQuestionString;
  const base = {
    text: n(question.text),
    kind: n(question.kind),
    resolveBy: n(question.resolveBy),
    resolutionRule: n(question.resolutionRule),
    outcomes: question.outcomes.map((o) => ({ id: n(o.id), label: n(o.label), definition: n(o.definition) })),
  };
  if (question.resolveByOffset === undefined) return { specVersion: QUESTION_SPEC_VERSION, ...base };
  return { specVersion: QUESTION_V2_SPEC_VERSION, ...base, resolveByOffset: n(question.resolveByOffset) };
}

/** computeQuestionHash returns `sha256:<hex>` over JCS of the normalized question preimage. */
export function computeQuestionHash(question: QuestionIdentityFields): string {
  return formatReceiptHash(sha256Hex(canonicalize(questionHashPreimage(question))));
}

/** End of the deadline day in UTC (exclusive bound): resolveBy 00:00:00Z + 1 day. */
export function deadlineEndMs(resolveBy: string): number {
  return Date.parse(`${resolveBy}T00:00:00Z`) + MS_PER_DAY;
}

function validateDeclaration(value: unknown, path: string, resolveBy: string): OutcomeDeclarationBinding {
  const d = expectRecord(value, path, [...OUTCOME_DECLARATION_HASH_FIELDS, 'outcomeHash']);
  if (d.specVersion !== 'uvrn-outcome-1') fail('unsupported_version', `${path}.specVersion`, 'must be "uvrn-outcome-1"');
  for (const key of ['entryId', 'predictedOutcome', 'outcomeMetric'] as const) expectText(d[key], `${path}.${key}`);
  if (!isStrictCalendarDate(d.resolveBy)) fail('invalid_input', `${path}.resolveBy`, 'must be a valid YYYY-MM-DD date');
  expectZoned(d.declaredAt, `${path}.declaredAt`);
  if (typeof d.outcomeHash !== 'string' || !PREFIXED_HASH.test(d.outcomeHash)) {
    fail('invalid_input', `${path}.outcomeHash`, 'must be sha256:<64 lowercase hex>');
  }
  if (computeOutcomeDeclarationHash(d) !== d.outcomeHash) {
    fail('outcome_declaration_mismatch', `${path}.outcomeHash`, 'does not recompute from the declaration fields (uvrn-outcome-1)');
  }
  if (d.resolveBy !== resolveBy) {
    fail('outcome_declaration_mismatch', `${path}.resolveBy`, 'differs from question.resolveBy');
  }
  return {
    specVersion: 'uvrn-outcome-1',
    entryId: d.entryId as string,
    predictedOutcome: d.predictedOutcome as string,
    outcomeMetric: d.outcomeMetric as string,
    resolveBy: d.resolveBy,
    declaredAt: d.declaredAt as string,
    outcomeHash: d.outcomeHash,
  };
}

/**
 * validateQuestion checks structure (not semantic truth) and returns the question record.
 * `asOfMs` must fall before the end of the deadline day in UTC.
 */
export function validateQuestion(value: unknown, asOfMs: number): QuestionRecord {
  return validateQuestionCore(value, asOfMs, false).record;
}

/**
 * validateQuestionV3 checks a version-3 question: the version-2 rules plus a REQUIRED
 * `resolveByOffset`. The deadline day runs from local 00:00 to the next local 00:00 at that offset,
 * and `asOfMs` must fall before its exclusive end (the v2 rule with the local bound).
 */
export function validateQuestionV3(value: unknown, asOfMs: number): { record: QuestionRecordV3; deadline: ValidatedDeadline } {
  const { record, deadline } = validateQuestionCore(value, asOfMs, true);
  return { record: record as QuestionRecordV3, deadline: deadline as ValidatedDeadline };
}

function validateQuestionCore(
  value: unknown,
  asOfMs: number,
  v3: boolean
): { record: QuestionRecord | QuestionRecordV3; deadline: ValidatedDeadline | null } {
  const required = ['text', 'resolveBy', 'resolutionRule', 'kind', 'outcomes', 'partitionConfirmed'];
  const q = expectRecord(value, 'question', v3 ? [...required, 'resolveByOffset'] : required);
  expectText(q.text, 'question.text', 'invalid_question');
  expectText(q.resolutionRule, 'question.resolutionRule', 'invalid_question');
  if (!isStrictCalendarDate(q.resolveBy)) fail('invalid_question', 'question.resolveBy', 'must be a valid YYYY-MM-DD date');
  let deadline: ValidatedDeadline | null = null;
  if (v3) {
    const offsetMinutes = parseOffsetMinutes(q.resolveByOffset);
    if (offsetMinutes === null) {
      fail('invalid_question', 'question.resolveByOffset', 'must be a UTC offset ±hh:mm from -12:00 to +14:00 (UTC is +00:00; -00:00 is not accepted)');
    }
    const { startMs, endExclusiveMs } = dayBoundsMs(q.resolveBy, offsetMinutes);
    // Before any instant is rendered: both recorded bounds must be 4-digit-year UTC instants
    // (an exclusive end of exactly 10000-01-01T00:00Z is rejected too).
    if (startMs < MIN_RECORDED_MS || endExclusiveMs > MAX_RECORDED_MS) {
      fail('invalid_question', 'question.resolveBy', 'the local deadline day must lie within years 0000–9999');
    }
    if (!(asOfMs < endExclusiveMs)) {
      fail('invalid_question', 'question.resolveBy', `the deadline (end of day at ${q.resolveByOffset as string}) must be after asOf`);
    }
    deadline = {
      offsetMinutes,
      startMs,
      endExclusiveMs,
      record: {
        resolveBy: q.resolveBy,
        offset: q.resolveByOffset as string,
        startInstantUtc: toUtcIso(startMs),
        endInstantUtcExclusive: toUtcIso(endExclusiveMs),
      },
    };
  } else if (!(asOfMs < deadlineEndMs(q.resolveBy))) {
    fail('invalid_question', 'question.resolveBy', 'the deadline (end of day UTC) must be after asOf');
  }
  if (q.kind !== 'binary' && q.kind !== 'categorical') {
    fail('invalid_question', 'question.kind', 'must be "binary" or "categorical"');
  }
  if (q.partitionConfirmed !== true) {
    fail('invalid_question', 'question.partitionConfirmed', 'must be true: the producer attests the outcomes are mutually exclusive and exhaustive');
  }
  const rawOutcomes = expectArray(q.outcomes, 'question.outcomes', 2);
  const outcomes = rawOutcomes.map((raw, i) => {
    const path = `question.outcomes[${i}]`;
    const o = expectRecord(raw, path, ['id', 'label', 'definition'], ['outcomeDeclaration']);
    expectText(o.id, `${path}.id`, 'invalid_question');
    expectText(o.label, `${path}.label`, 'invalid_question');
    expectText(o.definition, `${path}.definition`, 'invalid_question');
    return {
      id: o.id as string,
      label: o.label as string,
      definition: o.definition as string,
      outcomeDeclaration:
        o.outcomeDeclaration === undefined
          ? null
          : validateDeclaration(o.outcomeDeclaration, `${path}.outcomeDeclaration`, q.resolveBy as string),
    };
  });
  const seen = new Set<string>();
  outcomes.forEach((o, i) => {
    const key = normalizeQuestionString(o.id);
    if (seen.has(key)) fail('invalid_question', `question.outcomes[${i}].id`, 'duplicates another outcome id');
    seen.add(key);
  });
  if (q.kind === 'binary') {
    if (outcomes.length !== 2 || outcomes[0].id !== 'yes' || outcomes[1].id !== 'no') {
      fail('invalid_question', 'question.outcomes', 'a binary question has exactly two outcomes with ids "yes" then "no"');
    }
  }
  const record: QuestionRecord = {
    text: q.text as string,
    resolveBy: q.resolveBy,
    resolutionRule: q.resolutionRule as string,
    kind: q.kind,
    outcomes,
    partitionConfirmed: true,
  };
  return { record: deadline ? { ...record, resolveByOffset: deadline.record.offset } : record, deadline };
}