# Changelog

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

## [1.2.0] - 2026-06-05

### Added
- Added read-only canon tools for qualification checks and canon receipt reads.
- Added `delta_score_claim`, which returns a verifiable `MasterReceipt` from configured connector sources.
- Added a client-neutral plugin manifest and refreshed prompts for the nine-tool MCP surface.

## [1.1.0] - 2026-06-05

### Added
- Added stateless MCP tools for drift scoring, receipt comparison, and in-memory identity reputation lookup.
- Documented that drift and compare tools require already enriched/scored inputs; raw `DeltaReceipt` values are rejected.
- Added `RuntimeConfig` injection through `createServer(runtimeConfig?)` and `buildHandlers(cfg)`, with lazy zero-external defaults for stateful capabilities.

## [1.0.2] - 2026-03-08

### Fixed
- Type export corrections

## [1.0.0] - 2026-03-07

### Added
- MCP server for AI-native bundle processing
- Tool definitions for runDelta and validateBundle
- stdio transport support
