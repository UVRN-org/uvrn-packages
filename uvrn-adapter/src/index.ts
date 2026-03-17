/**
 * UVRN Adapter
 * Layer 2 - Wraps Delta Engine Core receipts in DRVC3 envelopes
 */

// Types
export * from './types';

// Core wrapper
export { wrapInDRVC3, extractDeltaReceipt } from './wrapper';

// Signing utilities
export { signHash, recoverSigner, verifySignature } from './signer';

// Validation (validateDRVC3 is schema-only; use verifyDRVC3Integrity for full integrity)
export { validateDRVC3, isDRVC3Receipt, verifyDRVC3Integrity } from './validator';
