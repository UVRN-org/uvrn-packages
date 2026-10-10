# Changelog

## [5.1.0] - 2026-10-10

### Changed
- Version aligned to the UVRN 5.1 line (5.0.1 → 5.1.0): every public `@uvrn/*` package now ships on 5.1.x, with `@uvrn/probability` on 0.3.x. No API or behaviour changes in this entry.
- Peer ranges raised from `^5.0.0` to `^5.1.0`: `@uvrn/core`, `@uvrn/drift`.

## [5.0.1] - 2026-10-06

### Fixed
- Removed a private package name from a type comment.
- README wording: a canon receipt records a score and its signer; it does not prove the claim is true.
- Lint: the `StoreType` open-string idiom is allowed explicitly.
- Republished from the public repository `UVRN-org/uvrn-packages`: package metadata (repository URL) now points at the public repo.

### Changed
- **License:** **Apache-2.0** with a NOTICE file ("Built on UVRN" attribution; no rights to the UVRN name).

## [4.0.0] - 2026-06-10 (unreleased)

### Changed
- Test suite deepened to meet the 60% coverage gate (A7).

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

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
