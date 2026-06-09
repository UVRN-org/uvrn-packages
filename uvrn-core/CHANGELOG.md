# Changelog

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

## [1.1.0] - 2026-06-05

### Added
- Added the additive `Measurement` contract types for pluggable relationship checks. Runtime measurement logic remains outside core, and existing receipt hashing and verification behavior are unchanged.
- Added the additive `MasterReceipt` envelope with `buildMasterReceipt` and `verifyMasterReceipt`. The base `DeltaReceipt` hash remains unchanged and participates in the master hash only through `base.hash`.

## [1.0.2] - 2026-03-08

### Fixed
- Minor type export corrections

## [1.0.1] - 2026-03-07

### Fixed
- Build output cleanup

## [1.0.0] - 2026-03-07

### Added
- Deterministic delta engine with V-Score computation
- V-Score formula: (Completeness x 0.35) + (Parity x 0.35) + (Freshness x 0.30)
- DRVC3 receipt generation and validation
- DataBundle schema validation
- Full TypeScript type exports
