# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-02

Initial release. Profile-driven normalization layer for UVRN farm sources.

### Added
- `normalize()` with built-in financial, research, news, and general profiles
- Transformer registration and retrieval for provider-specific normalization overrides
- Heuristic provider matching that preserves the existing `@uvrn/agent` farm source contract
