# Changelog

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
