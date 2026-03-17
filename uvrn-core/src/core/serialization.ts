/**
 * Delta Engine Core - Serialization & Hashing
 * Implements canonical JSON serialization and SHA-256 hashing.
 */

import { createHash } from 'crypto';
import { DeltaReceipt } from '../types';

/**
 * Canonically serializes an object (RFC 8785 style).
 * - Object keys sorted lexicographically.
 * - No whitespace.
 */
export function canonicalSerialize(obj: unknown): string {
  if (obj === undefined) {
    return '';
  }
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map((item: unknown) => canonicalSerialize(item)).join(',') + ']';
  }

  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const acc: string[] = [];
  for (const key of keys) {
    acc.push(JSON.stringify(key) + ':' + canonicalSerialize(record[key]));
  }
  return '{' + acc.join(',') + '}';
}

/**
 * Computes SHA-256 hash of the canonical serialization of the receipt payload.
 * IMPORTANT: The hash matches the `canonicalSerialize` output.
 */
export function hashReceipt(receiptPayload: Omit<DeltaReceipt, 'hash'>): string {
  const canonical = canonicalSerialize(receiptPayload);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Computes hash of the receipt payload excluding the optional `ts` field.
 * Used for replay determinism: when comparing original vs replayed receipt,
 * normalized hashes (without ts) determine determinism; receipt.hash remains
 * over the full payload for integrity.
 */
export function hashReceiptPayloadWithoutTs(payload: Omit<DeltaReceipt, 'hash'>): string {
  const { ts: _ts, ...rest } = payload;
  return hashReceipt(rest);
}
