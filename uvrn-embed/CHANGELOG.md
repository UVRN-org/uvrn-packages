# Changelog

## [5.1.0] - 2026-10-10

### Changed
- Version aligned to the UVRN 5.1 line (5.0.1 → 5.1.0): every public `@uvrn/*` package now ships on 5.1.x, with `@uvrn/probability` on 0.3.x. No API or behaviour changes in this entry.

## [5.0.1] - 2026-10-06

### Fixed
- `require('@uvrn/embed')` returns the real API (it returned `{}` from the browser bundle). `exports` now has `types`/`import`/`require`/`default`.
- The script-tag bundle stays available at `@uvrn/embed/umd` (and `@uvrn/embed/dist/embed.umd.js`); the `browser` field that pointed bundlers at it is removed.
- `react` / `react-dom` peers are required (the component needs them); ranges unchanged. `ConsensusBadge` returns `ReactElement`, so types work with @types/react 18 and 19.
- Republished from the public repository `UVRN-org/uvrn-packages`: package metadata (repository URL) now points at the public repo.

### Changed
- **License:** **Apache-2.0** with a NOTICE file ("Built on UVRN" attribution; no rights to the UVRN name).

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
