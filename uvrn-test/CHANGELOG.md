# Changelog

## [5.1.0] - 2026-10-10

### Changed
- Version aligned to the UVRN 5.1 line (5.0.1 → 5.1.0): every public `@uvrn/*` package now ships on 5.1.x, with `@uvrn/probability` on 0.3.x. No API or behaviour changes in this entry.
- Peer ranges raised from `^5.0.0` to `^5.1.0`: `@uvrn/agent`, `@uvrn/canon`, `@uvrn/core`, `@uvrn/drift`.

## [5.0.1] - 2026-10-06

### Fixed
- `@uvrn/agent`, `@uvrn/canon` and `@uvrn/drift` are declared as required peers (the mocks are typed against them; agent was undeclared), so the types resolve for consumers.
- Republished from the public repository `UVRN-org/uvrn-packages`: package metadata (repository URL) now points at the public repo.

### Changed
- **License:** **Apache-2.0** with a NOTICE file ("Built on UVRN" attribution; no rights to the UVRN name).

## [4.0.0] - 2026-06-10 (unreleased, v4 / fable-refactor-1)

- Version aligned to the v4 generation; internal `@uvrn/*` peer ranges moved to `^4.0.0`.
  No behavioral changes in this package beyond the generation-wide hardening documented in
  the root CHANGELOG.

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-02

Initial release. Shared mocks, fixtures, and factory functions for UVRN development.

### Added
- Receipt, drift, canon, and farm factory functions with partial overrides
- `MockFarmConnector` aligned to the current `@uvrn/agent` connector contract
- `MockStore` for in-memory canon receipt storage and listing
- `MockSigner` for lightweight signing and verification in tests
- Pre-built stable, drifting, and critical fixtures
