/**
 * DRVC3 Wrapper
 * Wraps Layer 1 DeltaReceipt in a DRVC3 envelope with EIP-191 signatures
 * 
 * Key Principle: The DeltaReceipt hash is READ-ONLY from Layer 1.
 * DRVC3 envelope fields (receipt_id, timestamp, signature) are envelope metadata
 * and do NOT affect determinism or replay.
 */

import { DeltaReceipt } from '@uvrn/core';
import { Wallet, HDNodeWallet } from 'ethers';
import { DRVC3Receipt, WrapOptions } from './types';
import { signHash } from './signer';

/**
 * Wraps a DeltaReceipt in a DRVC3 envelope
 * 
 * @param deltaReceipt - Layer 1 DeltaReceipt (deterministic, hash-covered)
 * @param signer - ethers Wallet for EIP-191 signing
 * @param options - Envelope options (issuer, event, etc.)
 * @returns Promise resolving to complete DRVC3 receipt
 * 
 * @example
 * ```typescript
 * import { runDeltaEngine } from '@uvrn/core';
 * import { wrapInDRVC3 } from '@uvrn/adapter';
 * import { Wallet } from 'ethers';
 * 
 * const deltaReceipt = runDeltaEngine(bundle);
 * const wallet = new Wallet(privateKey);
 * const drvc3 = await wrapInDRVC3(deltaReceipt, wallet, {
 *   issuer: 'uvrn',
 *   event: 'delta-reconciliation'
 * });
 * ```
 */
export async function wrapInDRVC3(
  deltaReceipt: DeltaReceipt,
  signer: Wallet | HDNodeWallet,
  options: WrapOptions
): Promise<DRVC3Receipt> {
  // 1. Generate receipt_id (ENVELOPE METADATA - non-deterministic, intentional)
  const timestamp = new Date().toISOString();
  const receipt_id = `drvc3-${deltaReceipt.bundleId}-${Date.now()}`;

  // 2. Read hash from DeltaReceipt (HASH DOMAIN - read-only from Layer 1)
  const hash = deltaReceipt.hash;

  // 3. Sign hash with EIP-191 (ENVELOPE METADATA - certifies "who" and "when")
  const signature = await signHash(hash, signer);

  // 4. Construct DRVC3 envelope
  const drvc3: DRVC3Receipt = {
    receipt_id,
    issuer: options.issuer,
    event: options.event,
    timestamp,
    integrity: {
      hash_algorithm: 'sha256',
      hash,
      signature_method: 'eip191',
      signature,
      signer_address: signer.address
    },
    validation: {
      v_score: deltaReceipt.deltaFinal,
      checks: {
        delta_receipt: deltaReceipt
      }
    },
    block_state: options.blockState || 'loose',
    certificate: options.certificate || 'DRVC3 v1.01'
  };

  // Add optional fields if provided
  if (options.description) {
    drvc3.description = options.description;
  }
  if (options.resource) {
    drvc3.resource = options.resource;
  }
  if (options.replayInstructions) {
    drvc3.replay_instructions = options.replayInstructions;
  }
  if (options.extensions) {
    drvc3.extensions = options.extensions;
  }
  if (options.tags) {
    drvc3.tags = options.tags;
  }

  return drvc3;
}

/**
 * Extracts the original DeltaReceipt from a DRVC3 envelope
 * 
 * @param drvc3 - DRVC3 receipt envelope
 * @returns The embedded DeltaReceipt
 */
export function extractDeltaReceipt(drvc3: DRVC3Receipt): DeltaReceipt {
  return drvc3.validation.checks.delta_receipt;
}
