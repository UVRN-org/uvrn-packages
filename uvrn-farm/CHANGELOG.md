# Changelog

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-02

Initial release. Provider-agnostic connector framework for UVRN data ingestion.

### Added
- `BaseConnector` with retry, timeout, API key validation, and claim coercion helpers
- Reference connectors for CoinGecko, Coinbase, Perplexity, and NewsAPI
- `MultiFarm` for parallel fan-out and partial-result aggregation
- `ConnectorRegistry` for connector discovery and composition

### Changed (internal — no public API impact)
- FARM-05: removed runtime `PROFILES` import from `@uvrn/agent` in `BaseConnector` and `MultiFarm`; replaced duplicated string-to-claim fallback with a single internal helper (`src/internal/defaultClaimRegistration.ts`). Behavior and public surface are unchanged.
