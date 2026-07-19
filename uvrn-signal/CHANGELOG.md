# Changelog

## [4.0.0] - 2026-06-10 (published to npm 2026-06-12, v4 / fable-refactor-1)

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

Initial release. Typed event bus for UVRN package-to-package coordination.

### Added
- `SignalBus` — typed pub/sub event bus wrapping Node `EventEmitter`
- `SignalBridge` — event forwarding bridge between bus instances
- `UVRNEventMap` and event payload types for drift, canon, agent, and watch signals
- Custom event map support with inferred payload types
