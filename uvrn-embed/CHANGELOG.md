# Changelog

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

## [1.0.0] - 2026-04-02

Initial release. Embeddable UVRN consensus badge for React apps and plain HTML pages.

### Added
- `ConsensusBadge` React component for live claim-status rendering
- Configurable `apiUrl` support for hosted or self-hosted UVRN-compatible APIs
- In-memory badge cache with configurable TTL via `cacheMs`
- Standalone UMD build with `window.UVRN.init()` and `window.UVRN.renderBadge()`

### Changed
- Removed unused `@uvrn/core` entry from `package.json`, `README.md`, and `CHANGELOG.md` — `@uvrn/embed` is standalone and does not require `@uvrn/core` to be installed (EMB-01)
