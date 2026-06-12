/**
 * Ed25519 evidence verification for reputation events.
 *
 * The canonicalization here is a deliberate local copy of the RFC 8785 (JCS) serializer in
 * `@uvrn/receipt` (`src/canonical/index.ts`) — `@uvrn/identity` stays zero-dep, so it must not
 * import the receipt package. Keep the two implementations byte-identical.
 */

import { createPublicKey, verify } from 'node:crypto';

import type { AttestedEvidence } from '../types';

/** Signature payload version pinned into every signed reputation-evidence payload. */
export const SIG_VERSION = 'uvrn-sig-1';

/** DER SPKI prefix for a raw 32-byte Ed25519 public key (RFC 8410). */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * canonicalize serializes a JSON value per RFC 8785 (JCS): sorted keys, no whitespace,
 * ECMAScript number form, undefined object members omitted, undefined array elements as null.
 * Non-finite numbers throw — they must never enter a signed payload.
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
      throw new TypeError('canonicalize: non-finite numbers are not allowed in signed payloads');
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
 * buildEvidencePayload assembles the exact string that must have been signed for a piece of
 * evidence to verify: the JCS-canonical JSON of
 * `{ publicKeyRef, receiptHash, schemaVersion, sigVersion: 'uvrn-sig-1', signedAt? }`.
 */
export function buildEvidencePayload(evidence: AttestedEvidence): string {
  return canonicalize({
    publicKeyRef: evidence.signature.publicKeyRef,
    receiptHash: evidence.receiptHash,
    schemaVersion: evidence.schemaVersion,
    sigVersion: SIG_VERSION,
    ...(evidence.signature.signedAt ? { signedAt: evidence.signature.signedAt } : {}),
  });
}

/**
 * verifyAttestedEvidence checks the evidence's Ed25519 signature against its canonical
 * payload. Returns `false` (never throws) on malformed keys, malformed signatures, or
 * verification failure — callers treat any failure as "unattested", not as an error.
 */
export function verifyAttestedEvidence(evidence: AttestedEvidence): boolean {
  try {
    if (evidence.signature.alg !== 'ed25519') {
      return false;
    }

    const rawKey = Buffer.from(evidence.publicKey, 'base64');
    if (rawKey.length !== 32) {
      return false;
    }

    const publicKeyObject = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, rawKey]),
      format: 'der',
      type: 'spki',
    });

    return verify(
      null,
      Buffer.from(buildEvidencePayload(evidence), 'utf8'),
      publicKeyObject,
      Buffer.from(evidence.signature.sig, 'base64')
    );
  } catch {
    return false;
  }
}
