/**
 * Canonicalization and hash-payload assembly per SPEC/uvrn-receipt-v1.md §1–2.
 * This module is environment-pure (no crypto, no Node APIs) so the Cloudflare worker and the
 * browser can import it directly — one canonicalization implementation in the whole ecosystem.
 */

import type { NetworkReceipt } from '../types';

/**
 * canonicalize serializes a JSON value per RFC 8785 (JCS): sorted keys, no whitespace,
 * ECMAScript number form, undefined object members omitted, undefined array elements as null.
 * Non-finite numbers throw — they must never enter a hashed payload.
 */
export function canonicalize(value: unknown): string {
  if (value === undefined) {
    throw new TypeError('canonicalize: top-level value must not be undefined');
  }
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError('canonicalize: non-finite numbers are not allowed in hashed payloads');
    }
    if (typeof value === 'function' || typeof value === 'symbol' || value === undefined) {
      throw new TypeError(`canonicalize: cannot serialize a ${typeof value} value`);
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map((item) => (item === undefined ? 'null' : serialize(item))).join(',') + ']';
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return '{' + keys.map((key) => JSON.stringify(key) + ':' + serialize(record[key])).join(',') + '}';
}

/**
 * The declared hash field list for `uvrn-receipt-4` (SPEC §2.4).
 * The hash covers exactly these fields; everything else on the envelope is ignored by verifiers.
 */
export const NETWORK_RECEIPT_HASH_FIELDS = [
  'schemaVersion',
  'kind',
  'claim',
  'source',
  'action',
  'occurredAt',
  'payload',
  'topic',
  'tags',
  'narrative',
  'links',
  'chainId',
  'sdk',
] as const;

const REQUIRED_HASH_FIELDS = [
  'schemaVersion',
  'kind',
  'claim',
  'source',
  'action',
  'occurredAt',
  'payload',
] as const;

/**
 * assembleHashInput picks the declared `uvrn-receipt-4` hash fields off an envelope,
 * including optional fields only when present. Unknown envelope fields are ignored by design
 * (the additive unknown-field rule).
 */
export function assembleHashInput(
  receipt: Partial<NetworkReceipt> | Record<string, unknown>
): Record<string, unknown> {
  const record = receipt as Record<string, unknown>;
  for (const field of REQUIRED_HASH_FIELDS) {
    if (record[field] === undefined || record[field] === null) {
      throw new TypeError(`assembleHashInput: required field "${field}" is missing`);
    }
  }
  const input: Record<string, unknown> = {};
  for (const field of NETWORK_RECEIPT_HASH_FIELDS) {
    const value = record[field];
    if (value !== undefined && value !== null) {
      input[field] = value;
    }
  }
  return input;
}

/**
 * The declared hash field list for the frozen legacy registry shape `drvc3-receipt-1`
 * (SPEC §2.3). `sdk` is required there; the optional tail is included only when present.
 */
export const LEGACY_RECEIPT_HASH_FIELDS = [
  'schemaVersion',
  'source',
  'action',
  'payload',
  'occurredAt',
  'sdk',
  'tags',
  'receiptType',
  'narrative',
  'links',
  'chainId',
] as const;

/**
 * assembleLegacyHashInput reproduces the worker's frozen `drvc3-receipt-1` hash input so the
 * registry can retire its hand-rolled duplicate. Behavior is byte-identical to the live worker.
 */
export function assembleLegacyHashInput(record: Record<string, unknown>): Record<string, unknown> {
  const required = ['schemaVersion', 'source', 'action', 'payload', 'occurredAt', 'sdk'];
  for (const field of required) {
    if (record[field] === undefined || record[field] === null) {
      throw new TypeError(`assembleLegacyHashInput: required field "${field}" is missing`);
    }
  }
  const input: Record<string, unknown> = {};
  for (const field of LEGACY_RECEIPT_HASH_FIELDS) {
    const value = record[field];
    if (value !== undefined && value !== null) {
      input[field] = value;
    }
  }
  return input;
}

/** Matches a prefixed receipt hash, e.g. `sha256:ab12...` (64 lowercase hex chars). */
export const RECEIPT_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** formatReceiptHash wraps a raw lowercase hex digest in the prefixed encoding. */
export function formatReceiptHash(hex: string): string {
  return `sha256:${hex}`;
}
