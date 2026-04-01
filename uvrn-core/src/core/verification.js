"use strict";
/**
 * Delta Engine Core - Verification Logic
 * Verify receipt integrity locally.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyReceipt = verifyReceipt;
const serialization_1 = require("./serialization");
function verifyReceipt(receipt) {
    if (!receipt) {
        return { verified: false, error: 'Receipt is null or undefined' };
    }
    if (!receipt.hash) {
        return { verified: false, error: 'Receipt missing hash' };
    }
    // extract hash and the rest
    const { hash, ...payload } = receipt;
    // Recompute hash
    const computedHash = (0, serialization_1.hashReceipt)(payload);
    if (computedHash === hash) {
        return { verified: true, recomputedHash: computedHash };
    }
    else {
        return {
            verified: false,
            recomputedHash: computedHash,
            error: `Hash mismatch. Provided: ${hash}, Computed: ${computedHash}`
        };
    }
}
