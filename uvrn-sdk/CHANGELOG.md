# Changelog

All notable changes to the Delta Engine SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-15

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
| 1.0.0   | 2026-01-15   | ✅ Active      | TBD         |

---

For upgrade guides and migration information, see [SDK_GUIDE.md](./docs/SDK_GUIDE.md).
