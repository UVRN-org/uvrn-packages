# Changelog

## [5.1.0] - 2026-10-10

### Changed
- Version aligned to the UVRN 5.1 line (5.0.1 → 5.1.0): every public `@uvrn/*` package now ships on 5.1.x, with `@uvrn/probability` on 0.3.x. No API or behaviour changes in this entry.
- Peer ranges raised from `^5.0.0` to `^5.1.0`: `@uvrn/core`.

## [5.0.1] - 2026-10-06

### Fixed
- Republished from the public repository `UVRN-org/uvrn-packages`: package metadata (repository URL) now points at the public repo.

### Changed
- **License:** MIT → **Apache-2.0** with a NOTICE file ("Built on UVRN" attribution; no rights to the UVRN name). Earlier published versions stay MIT.

## [4.0.0] - 2026-06-10 (unreleased, v4 / fable-refactor-1)

- Version aligned to the v4 generation; internal `@uvrn/*` peer ranges moved to `^4.0.0`.
  No behavioral changes in this package beyond the generation-wide hardening documented in
  the root CHANGELOG.

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

### Fixed
- DRVC3 envelope now uses a monotonic millisecond clock so two back-to-back `wrapInDRVC3` calls always produce distinct `receipt_id`/`timestamp`. Envelope metadata only — the embedded `DeltaReceipt`, `integrity.hash`, signature input, schema, and verification semantics are unchanged.

## [1.0.2] - 2026-03-08

### Fixed
- Build output and type export corrections

## [1.0.0] - 2026-03-07

### Added
- DRVC3 envelope wrapping with EIP-191 signatures
- JSON schema validation (ajv)
- Receipt signing and verification
