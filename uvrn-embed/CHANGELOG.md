# Changelog

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
