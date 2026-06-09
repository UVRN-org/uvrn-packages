# Changelog

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
