/**
 * Ed25519 evidence verification for reputation events.
 *
 * Signed payload bytes delegate to core's environment-pure canonical-serialize-2 module.
 */

import { canonicalSerializeV2 } from '@uvrn/core/canonical-serialize-2';
import { createPublicKey, verify } from 'node:crypto';

import type { AttestedEvidence } from '../types';

/** Signature payload version pinned into every signed reputation-evidence payload. */
export const SIG_VERSION = 'uvrn-sig-1';

/** DER SPKI prefix for a raw 32-byte Ed25519 public key (RFC 8410). */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/** Backward-compatible identity export delegated to the one live strict implementation. */
export const canonicalize = canonicalSerializeV2;

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
