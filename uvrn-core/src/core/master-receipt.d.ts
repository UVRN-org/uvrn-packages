/**
 * Master receipt helpers build and verify the additive receipt envelope.
 * These helpers record caller-supplied measurements and node status without changing base receipt hashing.
 */
import type { BuildMasterReceiptArgs, MasterReceipt, VerifyMasterReceiptResult } from '../types';
/**
 * buildMasterReceipt wraps an existing DeltaReceipt with measurement results and node status.
 * The base receipt participates in the master hash only through `base.hash`.
 */
export declare function buildMasterReceipt(args: BuildMasterReceiptArgs): MasterReceipt;
/**
 * verifyMasterReceipt verifies both the unchanged base receipt and the additive master hash.
 * It delegates base verification to `verifyReceipt` and recomputes the master envelope hash.
 */
export declare function verifyMasterReceipt(masterReceipt: MasterReceipt): VerifyMasterReceiptResult;
