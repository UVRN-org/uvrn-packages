# Changelog

All notable changes to the Delta Engine SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Replaced retired Loosechain brand with UVRN in package copy and LICENSE.

## [1.6.1] - 2026-03-28

### Added

- **MCP-first alignment:** Optional `apiKey` on SDK client config for consumers that pass API keys to HTTP adapters or MCP transports (additive, non-breaking).

## [1.6.0] - 2026-03-17

### Added

- **Validation parity:** `validateBundle` now delegates to @uvrn/core so pass/fail is identical across SDK, API, MCP, and CLI. Parity test suite runs identical fixtures through core and SDK and fails on any disagreement.
- **Replay timestamp policy:** Replay determinism is based on the canonical receipt payload **excluding** the optional `ts` field. When only timestamp context differs, replay is still `deterministic: true` and `ReplayResult.timestampNormalized` is set. Ensures replay verification is robust regardless of who added or omitted `ts`.
- **ReplayResult.timestampNormalized:** Optional flag indicating that full receipt hashes differed due to `ts` but normalized hashes matched.

### Breaking

- **validateBundle:** Stricter rules (aligned with core). Bundles that previously passed SDK but failed core will now fail SDK validation: e.g. single dataSpec, threshold=0, NaN metric, missing metric key, non-number metric value. Validation errors are returned with `field: 'bundle'` and the core error message.

### Changed

- README: Documented validation contract and replay determinism (including timestamp behavior). Added "Why this matters" for audit/compliance workflows.

## [1.5.3] - 2026-03-17

### Added
- **replayReceipt:** Full implementation. Replays a receipt's bundle through the engine to verify determinism. Requires the original bundle as input: `replayReceipt(receipt, bundle, executeFn)`. Validates inputs, runs `executeFn(bundle)`, and compares hash, `deltaFinal`, `outcome`, and rounds. Returns typed error codes: `MISSING_BUNDLE`, `INVALID_BUNDLE`, `BUNDLE_ID_MISMATCH`, `EXECUTION_FAILED`, `REPLAYED_RECEIPT_INVALID`. `ReplayResult` now includes `originalHash`, `recomputedHash`, and optional `details`.

### Breaking
- **replayReceipt:** Signature changed from `replayReceipt(receipt, executeFn)` to `replayReceipt(receipt, bundle, executeFn)`. The bundle that produced the receipt is required; callers must pass it explicitly.

## [1.5.2] - 2026-03-17

### Changed
- **Versioning:** `VERSION` is now read from `package.json` at runtime so it stays in sync with the published version (no more hardcoded 1.0.0). README documents the Versioning section and default-safe behavior.

## [1.5.1] - 2026-03-17

Publish fix: packed manifest no longer contains `workspace:` protocol; consumer installs work with npm/yarn. See root [CHANGELOG](../../CHANGELOG.md).

## [1.4.0] - 2026-03-17

Monorepo 1.4.0 release; version alignment. @uvrn/adapter has a breaking API change (private key hex instead of ethers Wallet); see adapter CHANGELOG if you use it.

## [1.0.3] - 2026-03-17

Monorepo 1.0.3 release; npm publish config and version alignment.

### Changed
- Version 1.0.3; `publishConfig.access: "public"` for @uvrn scope.

## [1.0.0] - 2026-01-15

First public npm release under `@uvrn/sdk` (2026-03-08).

### Added
- Initial release of Delta Engine SDK
- `DeltaEngineClient` with three execution modes:
  - CLI mode for process-based execution
  - HTTP mode for API-based execution
  - Local mode for direct execution
- `BundleBuilder` fluent API for bundle construction
- Comprehensive validation functions:
  - `validateBundle()` - Bundle structure validation
  - `validateReceipt()` - Receipt structure validation
  - `verifyReceiptHash()` - Hash integrity verification
  - `replayReceipt()` - Determinism verification (implemented in 1.5.3; requires receipt + bundle + executeFn)
- Custom error classes:
  - `DeltaEngineError` - Base error
  - `ValidationError` - Validation failures
  - `ExecutionError` - Execution failures
  - `NetworkError` - Network/HTTP failures
  - `ConfigurationError` - Configuration errors
- Full TypeScript type definitions
- Comprehensive documentation:
  - README with quick start
  - Complete SDK Guide
  - TypeScript examples
- ESM and CommonJS support

### Features
- Automatic retry logic for HTTP mode
- Configurable timeouts and retry counts
- Detailed validation error messages
- Receipt hash verification
- IDE autocomplete support
- >90% code coverage (unit tests)

### Dependencies
- Peer dependency on `@uvrn/core` ^1.0.0
- Node.js >= 18.0.0

---

## Future Releases

### Planned for 1.1.0
- ~~Full replay/determinism verification implementation~~ (done in 1.5.3)
- Bundle compression for large data sets
- Streaming support for large receipts
- Browser compatibility (if needed)
- Performance optimizations

### Planned for 1.2.0
- Advanced retry strategies
- Circuit breaker pattern for HTTP mode
- Metrics and telemetry hooks
- Receipt caching layer
- Batch execution optimizations

---

## Version Support

| Version | Release Date | Support Status | End of Life |
|---------|--------------|----------------|-------------|
| 1.0.3   | 2026-03-17   | ✅ Active      | TBD         |
| 1.0.0   | 2026-01-15   | ✅ Active      | TBD         |

---

For upgrade guides and migration information, see [SDK_GUIDE.md](./docs/SDK_GUIDE.md).
