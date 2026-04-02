# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-01

Initial release. Signer reputation registry and storage contract for UVRN.

### Added
- `IdentityRegistry` for reputation lookup, activity recording, and leaderboards
- `IdentityStore` interface for custom backend implementations
- `MockIdentityStore` in-memory implementation for zero-external usage
- v1 additive reputation scoring with accuracy, canon rate, and volume inputs
