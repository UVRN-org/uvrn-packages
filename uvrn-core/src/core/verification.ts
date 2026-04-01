/**
 * Delta Engine Core - Verification Logic
 * Verify receipt integrity locally.
 */

import { DeltaReceipt, VerifyResult } from '../types';
import { hashReceipt } from './serialization';

export function verifyReceipt(receipt: DeltaReceipt): VerifyResult {
  if (!receipt) {
    return { verified: false, error: 'Receipt is null or undefined' };
  }
  if (!receipt.hash) {
    return { verified: false, error: 'Receipt missing hash' };
  }

  // extract hash and the rest
  const { hash, ...payload } = receipt;

  // Recompute hash
  const computedHash = hashReceipt(payload);

  if (computedHash === hash) {
    return { verified: true, recomputedHash: computedHash };
  } else {
    return { 
      verified: false, 
      recomputedHash: computedHash, 
      error: `Hash mismatch. Provided: ${hash}, Computed: ${computedHash}` 
    };
  }
}
