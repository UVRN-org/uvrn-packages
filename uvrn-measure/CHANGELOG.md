# Changelog

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

## [1.0.0] - 2026-06-05

### Added
- Added the first-party `agree`, `disagree`, `conflict`, and `potential` measurement modules.
- Added `MeasurementRegistry` and `defaultRegistry()` as the host extension point.
- Added a core-only package path with no consensus, compare, or drift peer surface in v1.
