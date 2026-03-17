# Changelog

All notable changes to @uvrn/core are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2026-03-17

### Added

- **hashReceiptPayloadWithoutTs(payload):** New export for replay determinism. Computes the hash of the receipt payload excluding the optional `ts` field. Used when comparing original vs replayed receipt so determinism is independent of timestamp context. The receipt’s `hash` field remains over the full payload for integrity.

### Changed

- README: Added "Validation (shared contract)" and "Replay determinism and timestamp" sections documenting bundle validation rules and replay timestamp policy.

## [1.5.1] - 2026-03-17

Publish fix: packed manifest no longer contains `workspace:` protocol; consumer installs work with npm/yarn.
