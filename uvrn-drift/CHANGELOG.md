# Changelog

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
