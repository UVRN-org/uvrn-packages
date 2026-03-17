/**
 * Delta Engine Core - Serialization & Hashing
 * Implements canonical JSON serialization and SHA-256 hashing.
 */
import { DeltaReceipt } from '../types';
/**
 * Canonically serializes an object (RFC 8785 style).
 * - Object keys sorted lexicographically.
 * - No whitespace.
 */
export declare function canonicalSerialize(obj: any): string;
/**
 * Computes SHA-256 hash of the canonical serialization of the receipt payload.
 * IMPORTANT: The hash matches the `canonicalSerialize` output.
 */
export declare function hashReceipt(receiptPayload: Omit<DeltaReceipt, 'hash'>): string;
/**
 * Hash of receipt payload excluding optional ts (for replay determinism).
 */
export declare function hashReceiptPayloadWithoutTs(payload: Omit<DeltaReceipt, 'hash'>): string;
