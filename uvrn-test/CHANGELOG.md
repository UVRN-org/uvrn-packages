# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-01

Initial release. Shared mocks, fixtures, and factory functions for UVRN development.

### Added
- Receipt, drift, canon, and farm factory functions with partial overrides
- `MockFarmConnector` aligned to the current `@uvrn/agent` connector contract
- `MockStore` for in-memory canon receipt storage and listing
- `MockSigner` for lightweight signing and verification in tests
- Pre-built stable, drifting, and critical fixtures
