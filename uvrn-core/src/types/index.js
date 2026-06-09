"use strict";
/**
 * Loosechain Layer 1: Delta Engine Core - Types
 * These types constitute the "Protocol Law" and must remain stable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VSCORE_WEIGHTS = void 0;
/**
 * Canonical V-Score component weights. The V-Score formula lives only in
 * `@uvrn/core` (house rule #1); `@uvrn/score` re-exports these as `WEIGHTS`.
 */
exports.VSCORE_WEIGHTS = {
    completeness: 0.35,
    parity: 0.35,
    freshness: 0.3,
};
