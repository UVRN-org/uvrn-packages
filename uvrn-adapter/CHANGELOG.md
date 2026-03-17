# Changelog

All notable changes to @uvrn/adapter are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Replaced `ethers` with `@noble/hashes` and `@noble/secp256k1` for EIP-191 signing. Dependency footprint reduced from ~1MB+ to ~40KB. Signing remains fully compatible with EIP-191 (Ethereum Signed Message).

### Breaking

- **wrapInDRVC3** now accepts `signerPrivateKeyHex: string` (raw hex private key, 64 hex chars, optional `0x` prefix) instead of `signer: Wallet | HDNodeWallet`.
- **signHash** now accepts `privateKeyHex: string` instead of `wallet: Wallet | HDNodeWallet`.
- Added **privateKeyToAddress(privateKeyHex: string)** for deriving the signer address from a private key; use this when you need the address without wrapping a receipt.

## [1.3.0] – (previous)

- DRVC3 v1.01 envelope; EIP-191 signing via ethers (pre-noble refactor).
