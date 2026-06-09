/**
 * Master receipt helpers build and verify the additive receipt envelope.
 * These helpers record caller-supplied measurements and node status without changing base receipt hashing.
 */

import { createHash } from 'crypto';
import type {
  BuildMasterReceiptArgs,
  MasterReceipt,
  VerifyMasterReceiptResult,
} from '../types';
import { canonicalSerialize } from './serialization';
import { verifyReceipt } from './verification';

/**
 * buildMasterReceipt wraps an existing DeltaReceipt with measurement results and node status.
 * The base receipt participates in the master hash only through `base.hash`.
 */
export function buildMasterReceipt(args: BuildMasterReceiptArgs): MasterReceipt {
  const claim = args.claim ?? args.base.bundleId;
  const ts = args.timestamp ?? new Date().toISOString();
  const envelopeVersion = 1;
  const masterHash = computeMasterHash({
    envelopeVersion,
    claim,
    baseHash: args.base.hash,
    measurements: args.measurements,
    nodes: args.nodes,
    ts,
  });

  return {
    envelopeVersion,
    claim,
    base: args.base,
    measurements: args.measurements,
    nodes: args.nodes,
    ts,
    masterHash,
  };
}

/**
 * verifyMasterReceipt verifies both the unchanged base receipt and the additive master hash.
 * It delegates base verification to `verifyReceipt` and recomputes the master envelope hash.
 */
export function verifyMasterReceipt(masterReceipt: MasterReceipt): VerifyMasterReceiptResult {
  const baseResult = verifyReceipt(masterReceipt.base);
  const recomputedHash = computeMasterHash({
    envelopeVersion: masterReceipt.envelopeVersion,
    claim: masterReceipt.claim,
    baseHash: masterReceipt.base.hash,
    measurements: masterReceipt.measurements,
    nodes: masterReceipt.nodes,
    ts: masterReceipt.ts,
  });
  const masterHashOk = recomputedHash === masterReceipt.masterHash;
  const baseVerified = baseResult.verified;

  if (baseVerified && masterHashOk) {
    return {
      verified: true,
      baseVerified,
      masterHashOk,
    };
  }

  return {
    verified: false,
    baseVerified,
    masterHashOk,
    error: baseVerified ? 'Master receipt hash mismatch' : baseResult.error ?? 'Base receipt verification failed',
  };
}

interface MasterHashPayload {
  envelopeVersion: number;
  claim: string;
  baseHash: string;
  measurements: MasterReceipt['measurements'];
  nodes: MasterReceipt['nodes'];
  ts: string;
}

function computeMasterHash(payload: MasterHashPayload): string {
  return createHash('sha256').update(canonicalSerialize(payload)).digest('hex');
}
