# Changelog

All notable changes to the Delta Engine SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Replaced retired Loosechain brand with UVRN in package copy and LICENSE.

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
  - `replayReceipt()` - Determinism verification (stub)
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
- Full replay/determinism verification implementation
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
