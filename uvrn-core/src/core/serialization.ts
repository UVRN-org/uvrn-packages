/**
 * Delta Engine Core - Serialization & Hashing
 * Implements canonical JSON serialization and SHA-256 hashing.
 */

import { createHash } from 'crypto';
import { DeltaReceipt } from '../types';
import {
  CANONICAL_SERIALIZATION_V2,
  canonicalSerializeV2,
} from './canonical-serialize-2';

/** Frozen historical serializer discriminator. New producers must select v2 explicitly. */
export const CANONICAL_SERIALIZATION_V1 = 'canonical-serialize-1' as const;

export type CanonicalSerializationVersion =
  | typeof CANONICAL_SERIALIZATION_V1
  | typeof CANONICAL_SERIALIZATION_V2;

/** Raised when an artifact declares a canonicalization version this verifier does not know. */
export class UnsupportedCanonicalSerializationVersionError extends TypeError {
  readonly version: string;

  constructor(version: string) {
    super(`Unsupported canonicalization version: ${version}`);
    this.name = 'UnsupportedCanonicalSerializationVersionError';
    this.version = version;
  }
}

/**
 * Frozen legacy canonical-serialize-1 implementation.
 *
 * This byte surface intentionally retains historical lenient behavior for version-selected
 * verification only. Do not fix, alias to v2, or use for new producers.
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
    return '[' + obj.map((item) => canonicalSerialize(item)).join(',') + ']';
  }

  const o = obj as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  const acc: string[] = [];
  for (const key of keys) {
    acc.push(JSON.stringify(key) + ':' + canonicalSerialize(o[key]));
  }
  return '{' + acc.join(',') + '}';
}

/**
 * Selects the serializer declared by an artifact. Unknown versions reject; there is no fallback.
 */
export function canonicalSerializeForVersion(version: string, value: unknown): string {
  switch (version) {
    case CANONICAL_SERIALIZATION_V1:
      return canonicalSerialize(value);
    case CANONICAL_SERIALIZATION_V2:
      return canonicalSerializeV2(value);
    default:
      throw new UnsupportedCanonicalSerializationVersionError(version);
  }
}

/**
 * Computes SHA-256 hash of the canonical serialization of the receipt payload.
 * IMPORTANT: This frozen DeltaReceipt path remains canonical-serialize-1 for compatibility.
 */
export function hashReceipt(receiptPayload: Omit<DeltaReceipt, 'hash'>): string {
  const canonical = canonicalSerialize(receiptPayload);
  return createHash('sha256').update(canonical).digest('hex');
}
