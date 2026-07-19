# Changelog

## [4.1.0] - 2026-07-19

### Closing release
- Program closing npm release 4.1.0 — ships camelCase receipt aliases (REF).

- Accept additive camelCase receipt aliases alongside the legacy snake_case drift inputs and emit
  both naming styles from one normalized computation path. Existing snake_case values and decay
  behavior remain unchanged (ADR-010).

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

## [2.0.0] - 2026-05-25

### Changed
- **Breaking:** Adds required peer dependency `@uvrn/score` — must be installed alongside `@uvrn/drift`
- Imports canonical `WEIGHTS` from `@uvrn/score` in `src/index.ts` and `src/agent-api.ts`
- Eliminates all local V-Score weight duplication across public drift paths

### Note
- Weight values unchanged when peers are installed correctly; behavior unchanged aside from peer requirement

## [1.1.0] - 2026-05-25

### Changed
- Removed local V-Score weight constants (were silent duplicates of `@uvrn/score` WEIGHTS)
- Now imports `WEIGHTS` from `@uvrn/score` (added as peer dependency)
- No behavioral change — values are identical; coupling is now explicit and documented

## [1.0.0] - 2026-03-16

Initial release. Temporal decay scoring for UVRN verification receipts.

### Added
- `computeDrift(receipt, profile, asOf?)` — core decay API
- `computeDriftFromInput(input)` — agent-style API returning snapshot, receipt, events
- `DRIFT_PROFILES` / `PROFILES` — built-in decay profiles (fast, moderate, threshold_short, etc.)
- `DriftMonitor` — continuous monitoring with threshold events
- Decay curves: LINEAR, SIGMOID, EXPONENTIAL
- Types: DriftSnapshot, DriftConfig, AgentDriftReceipt for @uvrn/canon and @uvrn/agent
