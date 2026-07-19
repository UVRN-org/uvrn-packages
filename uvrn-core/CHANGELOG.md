# Changelog

## [4.1.0] - 2026-07-18 (unreleased)

### Added
- Environment-pure, browser-safe `canonical-serialize-2` implementation and public subpath.
- Explicit version selector with frozen `canonical-serialize-1`, strict v2, and unknown-version
  rejection; typed strict-input errors and migration table.

### Compatibility
- Legacy `canonicalSerialize` and `hashReceipt` remain byte-frozen on v1.
- Valid-JSON canonical bytes and golden hashes are identical under v1 and v2.
- V2 converts dense undefined array elements and true sparse holes to JSON `null`, omits
  undefined object members, and rejects non-finite / non-JSON inputs.

## [4.0.0] - 2026-06-10 (published to npm 2026-06-12, v4 / fable-refactor-1)

- Master-receipt ordering rule (SPEC/uvrn-receipt-v1.md §2.2): `buildMasterReceipt` sorts
  `measurements` by (type, first evidence ref, insertion index) and `nodes` by id before
  hashing, and stores that order. Verification recomputes over the stored order, so receipts
  produced before this rule remain byte-for-byte valid. Shuffled input now yields an identical
  `masterHash`.
- Additive `MeasurementResult.humanExplanation?` (Layer D human vocabulary; populated via
  `@uvrn/receipt`'s `enrichMeasurements()` before hashing).
- Removed stale committed `src/*.js` / `*.d.ts` build artifacts — `tsc → dist/` is the single
  build path (v3 findings note 4).
- The frozen v3 paths are untouched: `canonicalSerialize`, `hashReceipt`, `verifyReceipt`, and
  the DeltaReceipt shape are byte-for-byte identical to 3.0.0.
- Internal `@uvrn/*` peer ranges moved to `^4.0.0`.

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
