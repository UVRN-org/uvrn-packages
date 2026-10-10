/**
 * Ed25519 producer signing per SPEC/uvrn-signing-v1.md (`uvrn-sig-1`).
 * One signing story end-to-end: the same curve the worker seal and @uvrn/canon already use.
 * Node `crypto` only — no external dependencies. The signature signs the receipt hash; it is
 * never part of the hash (additive rule).
 */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as edSign,
  verify as edVerify,
  type KeyObject,
} from 'crypto';
import { assembleHashInput, canonicalize, formatReceiptHash } from '../canonical';
import type { NetworkReceipt, ReceiptSignature } from '../types';

/** Standard DER prefix wrapping a raw 32-byte Ed25519 seed as PKCS#8. */
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
/** Standard DER prefix wrapping a raw 32-byte Ed25519 public key as SPKI. */
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export const SIG_VERSION = 'uvrn-sig-1' as const;

/** Keys are base64 of the raw 32 bytes (seed for private, point for public) per spec §1. */
export interface ReceiptKeyPair {
  publicKey: string;
  privateKey: string;
}

/** generateReceiptKeyPair creates a fresh Ed25519 keypair in the spec's raw-base64 encoding. */
export function generateReceiptKeyPair(): ReceiptKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const spki = publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
  const pkcs8 = privateKey.export({ format: 'der', type: 'pkcs8' }) as Buffer;
  return {
    publicKey: spki.subarray(spki.length - 32).toString('base64'),
    privateKey: pkcs8.subarray(pkcs8.length - 32).toString('base64'),
  };
}

function importPrivateKey(rawBase64: string): KeyObject {
  const seed = Buffer.from(rawBase64, 'base64');
  return createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, seed]), format: 'der', type: 'pkcs8' });
}

function importPublicKey(rawBase64: string): KeyObject {
  const raw = Buffer.from(rawBase64, 'base64');
  return createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: 'der', type: 'spki' });
}

/** sha256Hex digests a canonical string to lowercase hex. */
export function sha256Hex(canonical: string): string {
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * computeNetworkReceiptHash recomputes the `uvrn-receipt-4` prefixed hash over the declared
 * field list (SPEC/uvrn-receipt-v1.md §2.4).
 */
export function computeNetworkReceiptHash(
  receipt: Partial<NetworkReceipt> | Record<string, unknown>
): string {
  return formatReceiptHash(sha256Hex(canonicalize(assembleHashInput(receipt))));
}

interface SignaturePayload {
  publicKeyRef: string;
  receiptHash: string;
  schemaVersion: string;
  sigVersion: typeof SIG_VERSION;
  signedAt?: string;
}

function signaturePayload(receipt: NetworkReceipt, publicKeyRef: string, signedAt?: string): SignaturePayload {
  const payload: SignaturePayload = {
    publicKeyRef,
    receiptHash: receipt.receiptHash,
    schemaVersion: receipt.schemaVersion,
    sigVersion: SIG_VERSION,
  };
  if (signedAt !== undefined) payload.signedAt = signedAt;
  return payload;
}

/** SignReceiptOptions carry the producer key material and reference. */
export interface SignReceiptOptions {
  /** Base64 raw 32-byte Ed25519 seed. */
  privateKey: string;
  /** Opaque key reference verifiers can resolve, e.g. `acme-pk-2026-v1`. */
  publicKeyRef: string;
  /** Optional ISO timestamp recorded in the envelope and the signed payload. */
  signedAt?: string;
}

/**
 * signReceipt returns a copy of the receipt with the `uvrn-sig-1` producer signature attached.
 * The receipt hash must verify before signing; signing never mutates the input.
 */
export function signReceipt(receipt: NetworkReceipt, options: SignReceiptOptions): NetworkReceipt {
  const recomputed = computeNetworkReceiptHash(receipt);
  if (recomputed !== receipt.receiptHash) {
    throw new Error(
      `signReceipt: receipt hash does not verify (stored ${receipt.receiptHash}, recomputed ${recomputed})`
    );
  }
  const payload = signaturePayload(receipt, options.publicKeyRef, options.signedAt);
  const sig = edSign(null, Buffer.from(canonicalize(payload), 'utf8'), importPrivateKey(options.privateKey));
  const signature: ReceiptSignature = {
    alg: 'ed25519',
    publicKeyRef: options.publicKeyRef,
    sig: sig.toString('base64'),
  };
  if (options.signedAt !== undefined) signature.signedAt = options.signedAt;
  return { ...receipt, signature };
}

/** SignatureCheck reports the signature half of verification on its own. */
export interface SignatureCheck {
  signatureOk: boolean;
  error?: string;
}

/**
 * verifySignature checks the producer signature against a resolved public key
 * (base64 raw 32 bytes). It does not re-check integrity — use verifyReceiptFull for both.
 */
export function verifySignature(receipt: NetworkReceipt, publicKey: string): SignatureCheck {
  if (!receipt.signature) {
    return { signatureOk: false, error: 'receipt carries no signature' };
  }
  if (receipt.signature.alg !== 'ed25519') {
    return { signatureOk: false, error: `unsupported signature alg "${receipt.signature.alg}"` };
  }
  try {
    const payload = signaturePayload(receipt, receipt.signature.publicKeyRef, receipt.signature.signedAt);
    const ok = edVerify(
      null,
      Buffer.from(canonicalize(payload), 'utf8'),
      importPublicKey(publicKey),
      Buffer.from(receipt.signature.sig, 'base64')
    );
    return ok ? { signatureOk: true } : { signatureOk: false, error: 'signature does not verify' };
  } catch (cause) {
    return { signatureOk: false, error: `signature check failed: ${(cause as Error).message}` };
  }
}

/**
 * verifyDetachedSignature checks a producer signature given only the hash, schema version, and
 * signature envelope — no full receipt required. This is what registries and reputation systems
 * use when they hold receipt metadata rather than the whole envelope.
 */
export function verifyDetachedSignature(
  args: { receiptHash: string; schemaVersion: string; signature: ReceiptSignature },
  publicKey: string
): SignatureCheck {
  if (args.signature.alg !== 'ed25519') {
    return { signatureOk: false, error: `unsupported signature alg "${args.signature.alg}"` };
  }
  try {
    const payload: SignaturePayload = {
      publicKeyRef: args.signature.publicKeyRef,
      receiptHash: args.receiptHash,
      schemaVersion: args.schemaVersion,
      sigVersion: SIG_VERSION,
    };
    if (args.signature.signedAt !== undefined) payload.signedAt = args.signature.signedAt;
    const ok = edVerify(
      null,
      Buffer.from(canonicalize(payload), 'utf8'),
      importPublicKey(publicKey),
      Buffer.from(args.signature.sig, 'base64')
    );
    return ok ? { signatureOk: true } : { signatureOk: false, error: 'signature does not verify' };
  } catch (cause) {
    return { signatureOk: false, error: `signature check failed: ${(cause as Error).message}` };
  }
}

/** KeyResolution supplies public keys for verifyReceiptFull, checked in order. */
export interface KeyResolution {
  /** Direct public key (base64 raw 32 bytes) — used regardless of publicKeyRef. */
  publicKey?: string;
  /** Map of publicKeyRef → public key. */
  keys?: Record<string, string>;
}

/**
 * FullVerifyResult reports integrity and signature separately (gaps recorded, not hidden).
 * `verified` is true only when the hash recomputes AND a present signature verifies.
 * Honest vocabulary: integrity alone is "integrity-checked", never "verified".
 */
export interface FullVerifyResult {
  verified: boolean;
  integrityOk: boolean;
  /** Undefined when the receipt carries no signature. */
  signatureOk?: boolean;
  signed: boolean;
  error?: string;
}

/**
 * verifyReceiptFull = integrity (hash recompute) + signature + key lookup
 * (SPEC/uvrn-signing-v1.md §2.4). An unsigned receipt can be integrity-checked but never
 * `verified`. A requested-but-unresolvable key fails loudly with KEY_NOT_FOUND.
 */
export function verifyReceiptFull(receipt: NetworkReceipt, resolution: KeyResolution = {}): FullVerifyResult {
  let integrityOk = false;
  let error: string | undefined;
  try {
    integrityOk = computeNetworkReceiptHash(receipt) === receipt.receiptHash;
    if (!integrityOk) error = 'INTEGRITY_FAILED: receipt hash does not recompute';
  } catch (cause) {
    error = `INTEGRITY_FAILED: ${(cause as Error).message}`;
  }

  const signed = receipt.signature !== undefined;
  if (!signed) {
    return {
      verified: false,
      integrityOk,
      signed,
      error: error ?? 'receipt is integrity-checked only — no signature to verify',
    };
  }
  if (!integrityOk) {
    return { verified: false, integrityOk, signed, error };
  }

  const publicKey =
    resolution.publicKey ?? resolution.keys?.[receipt.signature!.publicKeyRef];
  if (!publicKey) {
    return {
      verified: false,
      integrityOk,
      signed,
      signatureOk: false,
      error: `KEY_NOT_FOUND: no public key for ref "${receipt.signature!.publicKeyRef}"`,
    };
  }

  const check = verifySignature(receipt, publicKey);
  return {
    verified: integrityOk && check.signatureOk,
    integrityOk,
    signed,
    signatureOk: check.signatureOk,
    error: check.error,
  };
}
