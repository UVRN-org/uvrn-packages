# Changelog

## [Unreleased]

### Added
- Pure `stanceToMeasurementSources()` named seam (ADR-005/ADR-011), mapping grounded numeric positions and supports/opposes assertions into the unchanged starter measurements. Inputs are not mutated and absent stance has no effect.

## [4.0.0] - 2026-06-10 (unreleased, v4 / fable-refactor-1)

### Added
- **`insufficient-data` verdict** per `SPEC/uvrn-measurement-v1.md` §4. All four starter measurements now emit `insufficient-data` (confidence 0 unless specified) when they cannot measure: too few usable sources for their evidence type, thin history, or a sub-floor potential signal. v3 emitted `no-agreement` (agree) or `none` (disagree/conflict/potential) for these thin-evidence cases; explanations now state what was missing.
- **`conflictRangeTolerance` context key** (default `0` = v3 behavior). Disjoint ranges on the same field conflict only when the gap between intervals exceeds the tolerance; hosts widen it to demand a material gap.

### Changed
- **Potential confidence hardening.** When `potential` fires, confidence is scaled by sample size and trend strength (`current × (0.5 × sampleFactor + 0.5 × trendStrength)`). When the computed confidence falls below `context.confidenceFloor` (default `0.25`), the measurement emits `insufficient-data` instead of `potential` so weak early signals are never overstated.

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

## [1.0.0] - 2026-06-05

### Added
- Added the first-party `agree`, `disagree`, `conflict`, and `potential` measurement modules.
- Added `MeasurementRegistry` and `defaultRegistry()` as the host extension point.
- Added a core-only package path with no consensus, compare, or drift peer surface in v1.
