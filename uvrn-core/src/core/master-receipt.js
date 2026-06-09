"use strict";
/**
 * Master receipt helpers build and verify the additive receipt envelope.
 * These helpers record caller-supplied measurements and node status without changing base receipt hashing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMasterReceipt = buildMasterReceipt;
exports.verifyMasterReceipt = verifyMasterReceipt;
const crypto_1 = require("crypto");
const serialization_1 = require("./serialization");
const verification_1 = require("./verification");
/**
 * buildMasterReceipt wraps an existing DeltaReceipt with measurement results and node status.
 * The base receipt participates in the master hash only through `base.hash`.
 */
function buildMasterReceipt(args) {
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
function verifyMasterReceipt(masterReceipt) {
    const baseResult = (0, verification_1.verifyReceipt)(masterReceipt.base);
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
function computeMasterHash(payload) {
    return (0, crypto_1.createHash)('sha256').update((0, serialization_1.canonicalSerialize)(payload)).digest('hex');
}
