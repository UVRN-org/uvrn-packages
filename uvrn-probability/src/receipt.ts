/**
 * The `uvrn-probability-1` declared-field-list hash and its NetworkReceipt (SPEC §5.3–5.4).
 * All canonicalization, hashing, and signing go through @uvrn/receipt — nothing is re-implemented.
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
import type { Refusal } from './common/refusal';
import { PROBABILITY_SPEC_VERSION } from './version';

export type ProbabilityMethod = 'market' | 'baserate' | 'insufficient_basis';

/** The closed `uvrn-probability-1` hash field list, in declaration order. */
export const PROBABILITY_HASH_FIELDS = [
  'specVersion',
  'origin',
  'outcomeHash',
  'asOf',
  'method',
  'p',
  'low',
  'high',
  'inputs',
  'refusals',
] as const;

export interface ProbabilityHashPayload {
  specVersion: typeof PROBABILITY_SPEC_VERSION;
  origin: string;
  outcomeHash: string;
  asOf: string;
  method: ProbabilityMethod;
  p: number | null;
  low: number | null;
  high: number | null;
  inputs: Array<Record<string, unknown>>;
  refusals: Refusal[];
}

/** assembleProbabilityHashInput picks exactly the declared fields; everything else is ignored. */
export function assembleProbabilityHashInput(record: Record<string, unknown>): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const field of PROBABILITY_HASH_FIELDS) {
    if (!(field in record)) throw new TypeError(`uvrn-probability-1: required field "${field}" is missing`);
    input[field] = record[field];
  }
  return input;
}

/** computeProbabilityHash returns `sha256:<hex>` over JCS of the declared field list. */
export function computeProbabilityHash(record: Record<string, unknown>): string {
  return formatReceiptHash(sha256Hex(canonicalize(assembleProbabilityHashInput(record))));
}

export interface ProbabilitySigner {
  /** Base64 raw 32-byte Ed25519 seed. Never echoed in outputs. */
  privateKey: string;
  publicKeyRef: string;
  /** Optional caller-supplied timestamp; the package never reads the clock. */
  signedAt?: string;
}

function narrativeFor(payload: ProbabilityHashPayload): string {
  if (payload.method === 'insufficient_basis') {
    const codes = [...new Set(payload.refusals.map((r) => r.code))].join(', ');
    return `No probability produced: insufficient basis (${codes || 'no usable candidate'}).`;
  }
  const label = payload.method === 'market' ? 'Market-implied probability' : 'Reference-class base rate';
  return `${label} ${payload.p} (band ${payload.low}–${payload.high}) as of ${payload.asOf}. Probability, not a V-Score.`;
}

/**
 * buildProbabilityReceipt wraps the hashed record in a `kind: 'probability'` NetworkReceipt
 * (uvrn-receipt-4) and signs it when a signer is given. Deterministic: occurredAt = asOf.
 */
export function buildProbabilityReceipt(
  payload: ProbabilityHashPayload & { probabilityHash: string },
  signer?: ProbabilitySigner
): NetworkReceipt {
  const claimText = `Probability for uvrn-outcome-1 declaration ${payload.outcomeHash}`;
  const receipt: NetworkReceipt = {
    schemaVersion: 'uvrn-receipt-4',
    receiptHash: '',
    kind: 'probability',
    claim: { id: claimIdFromText(claimText), text: claimText },
    source: '@uvrn/probability',
    action: 'probability.run',
    occurredAt: payload.asOf,
    payload: payload as unknown as Record<string, unknown>,
    tags: ['probability', `method:${payload.method}`],
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

export interface ProbabilityVerifyResult extends FullVerifyResult {
  /** The `uvrn-probability-1` hash recomputes from the receipt payload. */
  probabilityHashOk: boolean;
}

/**
 * verifyProbabilityReceipt = probability-hash recompute + verifyReceiptFull. "verified" still
 * means integrity + producer signature only; it says nothing about forecast accuracy.
 */
export function verifyProbabilityReceipt(
  receipt: NetworkReceipt,
  resolution: KeyResolution = {}
): ProbabilityVerifyResult {
  let probabilityHashOk = false;
  try {
    const payload = receipt.payload as Record<string, unknown>;
    probabilityHashOk = computeProbabilityHash(payload) === payload.probabilityHash;
  } catch {
    probabilityHashOk = false;
  }
  const full = verifyReceiptFull(receipt, resolution);
  return {
    ...full,
    verified: full.verified && probabilityHashOk,
    probabilityHashOk,
    ...(probabilityHashOk ? {} : { error: full.error ?? 'PROBABILITY_HASH_FAILED: uvrn-probability-1 hash does not recompute' }),
  };
}
