# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-16

Initial release. Canonization layer for the UVRN protocol.

### Added
- `Canon` — qualify(), suggest(), canonize(), verify(), recordRun()
- `NodeSigner` / `MockSigner` — ed25519 signing and SHA-256 hashing
- Stores: R2Store, SupabaseStore, IpfsStore, MultiStore, MockStore
- CanonReceipt — immutable receipt with content_hash and signature
- Auto-suggest flow with suggestion TTL and consecutive runs
