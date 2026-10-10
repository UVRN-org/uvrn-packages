/**
 * The `uvrn-probability-2` / `-3` declared-field-list hash, its NetworkReceipt, and
 * version-dispatching verification (SPEC/uvrn-probability-v2.md §4, SPEC/uvrn-probability-v3.md).
 * Version 3 uses the same top-level field list; its question identity is `-question-2`. Canonicalization, hashing, and signing all go
 * through @uvrn/receipt; the frozen NetworkReceipt hash contract is unchanged.
 */

import { canonicalize, formatReceiptHash } from '@uvrn/receipt/canonical';
import {
  claimIdFromText,
  computeNetworkReceiptHash,
  sha256Hex,
  signReceipt,
  verifyReceiptFull,
  type FullVerifyResult,
  type KeyResolution,
  type NetworkReceipt,
} from '@uvrn/receipt';
import { isPlainRecord, isStrictCalendarDate, parseOffsetMinutes } from '../common/strict';
import { dayBoundsMs, isRecordableInstant, toUtcIso } from '../common/time';
import { verifyProbabilityReceipt, type ProbabilitySigner } from '../receipt';
import {
  FORECAST_SPEC_VERSION,
  FORECAST_V3_SPEC_VERSION,
  PROBABILITY_SPEC_VERSION,
  QUESTION_SPEC_VERSION,
  QUESTION_V2_SPEC_VERSION,
} from '../version';
import { computeOutcomeDeclarationHash, computeQuestionHash, type QuestionRecord } from './question';
import type { ForecastHashPayload } from './types';

/** The closed `uvrn-probability-2` hash field list, in declaration order. Version 3 uses the same list. */
export const FORECAST_HASH_FIELDS = [
  'specVersion',
  'origin',
  'forecastId',
  'question',
  'questionHash',
  'asOf',
  'producer',
  'mode',
  'status',
  'basis',
  'probabilities',
  'unit',
  'quantityKind',
  'band',
  'inputs',
  'limitations',
  'refusals',
  'revision',
] as const;

/**
 * Optional hashed members: included in the preimage when present on the record and omitted (not
 * null) when absent, so records without them keep their original probabilityHash.
 */
export const FORECAST_OPTIONAL_HASH_FIELDS = ['profile'] as const;

/** assembleForecastHashInput picks exactly the declared fields; everything else is ignored. */
export function assembleForecastHashInput(record: Record<string, unknown>): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const field of FORECAST_HASH_FIELDS) {
    if (!(field in record)) throw new TypeError(`uvrn-probability-2: required field "${field}" is missing`);
    input[field] = record[field];
  }
  for (const field of FORECAST_OPTIONAL_HASH_FIELDS) {
    if (record[field] !== undefined) input[field] = record[field];
  }
  return input;
}

/** computeForecastHash returns `sha256:<hex>` over JCS of the declared field list. */
export function computeForecastHash(record: Record<string, unknown>): string {
  return formatReceiptHash(sha256Hex(canonicalize(assembleForecastHashInput(record))));
}

function narrativeFor(payload: ForecastHashPayload): string {
  if (payload.status === 'insufficient_basis') {
    const codes = [...new Set(payload.refusals.map((r) => r.code))].join(', ');
    return `No forecast produced (${payload.mode} mode): insufficient basis (${codes}). Question ${payload.questionHash}.`;
  }
  const label =
    payload.basis === 'market-implied'
      ? 'Market-implied probability'
      : payload.basis === 'reference-class'
        ? 'Reference-class base rate'
        : 'Attributed judgment';
  return `${label} for question ${payload.questionHash} as of ${payload.asOf}. Probability, not a V-Score; a receipt does not prove accuracy.`;
}

/**
 * buildForecastReceipt wraps the hashed record in a `kind: 'probability'` NetworkReceipt
 * (uvrn-receipt-4) and signs it when a signer is given. Deterministic: occurredAt = asOf.
 */
export function buildForecastReceipt(
  payload: ForecastHashPayload & { probabilityHash: string },
  signer?: ProbabilitySigner
): NetworkReceipt {
  const questionVersion = payload.specVersion === FORECAST_V3_SPEC_VERSION ? QUESTION_V2_SPEC_VERSION : QUESTION_SPEC_VERSION;
  const claimText = `Forecast for ${questionVersion} question ${payload.questionHash}`;
  const tags = ['probability', 'forecast', `mode:${payload.mode}`, `status:${payload.status}`];
  const judgment = payload.inputs.judgment;
  if (judgment && 'basisLabel' in judgment) tags.push(`judgment:${judgment.basisLabel}`);
  const receipt: NetworkReceipt = {
    schemaVersion: 'uvrn-receipt-4',
    receiptHash: '',
    kind: 'probability',
    claim: { id: claimIdFromText(claimText), text: claimText },
    source: '@uvrn/probability',
    action: 'probability.forecast',
    occurredAt: payload.asOf,
    payload: payload as unknown as Record<string, unknown>,
    tags,
    narrative: narrativeFor(payload),
  };
  receipt.receiptHash = computeNetworkReceiptHash(receipt);
  if (!signer) return receipt;
  return signReceipt(receipt, {
    privateKey: signer.privateKey,
    publicKeyRef: signer.publicKeyRef,
    ...(signer.signedAt !== undefined ? { signedAt: signer.signedAt } : {}),
  });
}

export interface ForecastVerifyResult extends FullVerifyResult {
  /** The payload's specVersion, or null when absent. */
  specVersion: string | null;
  /** The inner probability hash for that version recomputes from the payload. */
  probabilityHashOk: boolean;
  /** Versions 2 and 3: questionHash recomputes from the recorded question. Null for version 1. */
  questionHashOk: boolean | null;
  /** Versions 2 and 3: every outcome-declaration binding's outcomeHash recomputes. Null for version 1. */
  declarationsOk: boolean | null;
  /**
   * Version 3: `inputs.deadline` is exactly the record recomputed from `question.resolveBy` and
   * `question.resolveByOffset`. Version 2: no `inputs.deadline` is present. Null for version 1.
   */
  deadlineOk: boolean | null;
}

/**
 * Recomputes questionHash under the identity the payload version requires: version 2 must carry no
 * `resolveByOffset` (question-1); version 3 must carry one (question-2).
 */
function checkQuestion(
  question: unknown,
  questionHash: unknown,
  specVersion: string
): { questionHashOk: boolean; declarationsOk: boolean } {
  try {
    const q = question as QuestionRecord & { resolveByOffset?: unknown };
    const shapeOk = specVersion === FORECAST_V3_SPEC_VERSION ? typeof q.resolveByOffset === 'string' : !('resolveByOffset' in q);
    const questionHashOk = shapeOk && computeQuestionHash(q as QuestionRecord & { resolveByOffset?: string }) === questionHash;
    const declarationsOk = q.outcomes.every(
      (o) =>
        o.outcomeDeclaration === null ||
        computeOutcomeDeclarationHash(o.outcomeDeclaration as unknown as Record<string, unknown>) === o.outcomeDeclaration.outcomeHash
    );
    return { questionHashOk, declarationsOk };
  } catch {
    return { questionHashOk: false, declarationsOk: false };
  }
}

const DEADLINE_KEYS = ['endInstantUtcExclusive', 'offset', 'resolveBy', 'startInstantUtc'];

/**
 * Version 3: recompute the deadline record from the recorded question and require an exact match
 * (same four members, same values). Version 2: the record must carry no deadline. This replays only
 * the deadline-day arithmetic; matching and forecast math are not re-run.
 */
function checkDeadline(payload: Record<string, unknown>, specVersion: string): boolean {
  const inputs = isPlainRecord(payload.inputs) ? payload.inputs : null;
  if (!inputs) return false;
  if (specVersion !== FORECAST_V3_SPEC_VERSION) return !('deadline' in inputs);
  const d = inputs.deadline;
  const q = isPlainRecord(payload.question) ? payload.question : null;
  if (!isPlainRecord(d) || !q) return false;
  if (Object.keys(d).sort().join(',') !== DEADLINE_KEYS.join(',')) return false;
  const offsetMinutes = parseOffsetMinutes(q.resolveByOffset);
  if (offsetMinutes === null || !isStrictCalendarDate(q.resolveBy)) return false;
  const { startMs, endExclusiveMs } = dayBoundsMs(q.resolveBy, offsetMinutes);
  if (!isRecordableInstant(startMs) || !isRecordableInstant(endExclusiveMs)) return false;
  return (
    d.resolveBy === q.resolveBy &&
    d.offset === q.resolveByOffset &&
    d.startInstantUtc === toUtcIso(startMs) &&
    d.endInstantUtcExclusive === toUtcIso(endExclusiveMs)
  );
}

/**
 * verifyForecastReceipt dispatches strictly on the payload version: `uvrn-probability-1` uses the
 * legacy verifier; `uvrn-probability-2` and `-3` recompute the inner probability hash, questionHash,
 * and declaration bindings, then run verifyReceiptFull. Unknown versions fail. Version 3 also
 * recomputes `inputs.deadline` from the recorded question; version 2 must carry none. "verified" requires
 * every check plus a producer signature; it says nothing about forecast accuracy.
 */
export function verifyForecastReceipt(receipt: NetworkReceipt, resolution: KeyResolution = {}): ForecastVerifyResult {
  const payload = isPlainRecord(receipt?.payload) ? (receipt.payload as Record<string, unknown>) : {};
  const specVersion = typeof payload.specVersion === 'string' ? payload.specVersion : null;

  if (specVersion === PROBABILITY_SPEC_VERSION) {
    return {
      ...verifyProbabilityReceipt(receipt, resolution),
      specVersion,
      questionHashOk: null,
      declarationsOk: null,
      deadlineOk: null,
    };
  }

  const full = verifyReceiptFull(receipt, resolution);
  if (specVersion !== FORECAST_SPEC_VERSION && specVersion !== FORECAST_V3_SPEC_VERSION) {
    return {
      ...full,
      verified: false,
      specVersion,
      probabilityHashOk: false,
      questionHashOk: null,
      declarationsOk: null,
      deadlineOk: null,
      error: `UNSUPPORTED_VERSION: payload specVersion must be "${PROBABILITY_SPEC_VERSION}", "${FORECAST_SPEC_VERSION}", or "${FORECAST_V3_SPEC_VERSION}"`,
    };
  }

  let probabilityHashOk = false;
  try {
    probabilityHashOk = computeForecastHash(payload) === payload.probabilityHash;
  } catch {
    probabilityHashOk = false;
  }
  const { questionHashOk, declarationsOk } = checkQuestion(payload.question, payload.questionHash, specVersion);
  const deadlineOk = checkDeadline(payload, specVersion);
  const innerOk = probabilityHashOk && questionHashOk && declarationsOk && deadlineOk;
  let error = full.error;
  if (!probabilityHashOk) error = `PROBABILITY_HASH_FAILED: ${specVersion} hash does not recompute`;
  else if (!questionHashOk) error = 'QUESTION_HASH_FAILED: questionHash does not recompute from the recorded question';
  else if (!declarationsOk) error = 'DECLARATION_HASH_FAILED: an outcome-declaration binding does not recompute';
  else if (!deadlineOk) {
    error =
      specVersion === FORECAST_V3_SPEC_VERSION
        ? 'DEADLINE_RECORD_FAILED: inputs.deadline does not recompute from question.resolveBy and question.resolveByOffset'
        : 'DEADLINE_RECORD_FAILED: a uvrn-probability-2 record must not carry inputs.deadline';
  }
  return {
    ...full,
    verified: full.verified && innerOk,
    specVersion,
    probabilityHashOk,
    questionHashOk,
    declarationsOk,
    deadlineOk,
    ...(error !== undefined ? { error } : {}),
  };
}
