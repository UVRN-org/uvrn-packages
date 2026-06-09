# Changelog

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

## [1.0.2] - 2026-03-08

### Fixed
- Build output corrections

## [1.0.0] - 2026-03-07

### Added
- Fastify REST API for bundle processing
- POST /v1/run endpoint
- CORS, rate limiting, helmet security
- Health check endpoint
