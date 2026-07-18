/**
 * Canonicalization and hash-payload assembly per SPEC/uvrn-receipt-v1.md §1–2.
 * This module is environment-pure (no crypto, no Node APIs) so the Cloudflare worker and the
 * browser can import it directly — one canonicalization implementation in the whole ecosystem.
 */

import { canonicalSerializeV2 } from '@uvrn/core/canonical-serialize-2';
import type { NetworkReceipt } from '../types';

export {
  CANONICAL_SERIALIZATION_V2,
  CanonicalSerializationError,
  canonicalSerializeV2,
} from '@uvrn/core/canonical-serialize-2';
export type { CanonicalSerializationErrorCode } from '@uvrn/core/canonical-serialize-2';

/**
 * Stable receipt API delegated to core's environment-pure canonical-serialize-2 implementation.
 */
export function canonicalize(value: unknown): string {
  return canonicalSerializeV2(value);
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
