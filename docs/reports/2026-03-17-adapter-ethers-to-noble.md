# Adapter ethers → noble refactor – report

**Date:** 2026-03-17  
**Scope:** @uvrn/adapter  
**Status:** Complete.

## Summary

- **Dependencies:** Removed `ethers`; added `@noble/hashes` and `@noble/secp256k1`. Package footprint reduced from ~1MB+ to ~40KB.
- **Signing:** EIP-191 (Ethereum Signed Message) is implemented natively in [uvrn-adapter/src/signer.ts](../uvrn-adapter/src/signer.ts) using keccak_256, secp256k1 sign/recover, and EIP-55 checksum. Signature format and recovery remain compatible with existing receipts.
- **API (breaking):** `wrapInDRVC3(deltaReceipt, signerPrivateKeyHex, options)` and `signHash(hash, privateKeyHex)` now take a raw hex private key string instead of an ethers Wallet. Added `privateKeyToAddress(privateKeyHex)` for address derivation.
- **Tests:** All tests updated to use a fixed test private key; Jest configured to transform ESM-only @noble packages (transformIgnorePatterns + babel-jest). All 7 tests pass.
- **Docs:** README and adapter CHANGELOG updated; root CHANGELOG references the breaking change.

## What remains

- None for this refactor. Consumers that currently pass an ethers `Wallet` must switch to passing `wallet.privateKey` (or equivalent hex string).
