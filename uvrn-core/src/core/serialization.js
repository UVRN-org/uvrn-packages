"use strict";
/**
 * Delta Engine Core - Serialization & Hashing
 * Implements canonical JSON serialization and SHA-256 hashing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalSerialize = canonicalSerialize;
exports.hashReceipt = hashReceipt;
const crypto_1 = require("crypto");
/**
 * Canonically serializes an object (RFC 8785 style).
 * - Object keys sorted lexicographically.
 * - No whitespace.
 */
function canonicalSerialize(obj) {
    if (obj === undefined) {
        return '';
    }
    if (obj === null || typeof obj !== 'object') {
        return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
        return '[' + obj.map((item) => canonicalSerialize(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const acc = [];
    for (const key of keys) {
        acc.push(JSON.stringify(key) + ':' + canonicalSerialize(obj[key]));
    }
    return '{' + acc.join(',') + '}';
}
/**
 * Computes SHA-256 hash of the canonical serialization of the receipt payload.
 * IMPORTANT: The hash matches the `canonicalSerialize` output.
 */
function hashReceipt(receiptPayload) {
    const canonical = canonicalSerialize(receiptPayload);
    return (0, crypto_1.createHash)('sha256').update(canonical).digest('hex');
}
