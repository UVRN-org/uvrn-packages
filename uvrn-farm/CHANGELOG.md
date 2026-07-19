# Changelog

## [Unreleased]

### Added
- Optional first-class `stanceValue`, `stanceLabel`, `stanceConfidence`, and `stanceEvidence` fields on the exported farm source shape (D1, ADR-011). Existing connector results remain source-compatible when the fields are absent.

## [4.0.0] - 2026-06-10 (unreleased)

### Added
- **Rate limiting enforced.** The previously declared-but-unenforced `ConnectorConfig.rateLimitPerMinute` is now enforced in `BaseConnector` via a sliding 60-second window. Requests that would exceed the limit reject with the new `RateLimitError` (extends `FarmConnectorError`, carries `limit` and `retryAfterMs`) before any network I/O. Unset by default — no limit unless configured.
- **Circuit breaker on `BaseConnector`.** Opens after `circuitBreakerThreshold` consecutive request failures (default `5`); while open, requests reject fast with the new `CircuitOpenError` (extends `FarmConnectorError`, carries `retryAfterMs`). After `circuitBreakerResetMs` (default `30_000`), the circuit goes half-open and admits a single probe — success closes it, failure reopens it.
- **Injectable clock.** New `ConnectorConfig.now` hook (defaults to `Date.now`) drives both guards so tests can advance time without sleeping.
- Protected `BaseConnector.withGuards(fn)` helper for custom connectors that bypass `requestJson()`.

### Changed
- `requestJson()` is now wrapped by the guards above. Existing connectors with no new config behave exactly as before, **except** that 5 consecutive failures now open the breaker for 30 seconds (previously consecutive failures never tripped anything). Constructor and config shapes are unchanged (all new fields optional).

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
