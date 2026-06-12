# Changelog

## [4.0.0] - 2026-06-10

Unreleased.

### Added
- `AgentStateStore` interface — injectable persistence seam for durable agent state (`loadState(agentId)` / `saveState(agentId, state)` over a `PersistedAgentState` snapshot: tracked claim registrations, last drift snapshots, receipt sequences, consecutive-failure counts, and `totalRuns`). `AgentConfig.stateStore` accepts a durable implementation. No storage ships in this package — the agent still emits unsigned `AgentDriftReceipt`s only.
- `InMemoryAgentStateStore` — default zero-dependency `AgentStateStore`, preserving the historical in-memory behavior.
- `PersistedAgentState` / `PersistedClaimState` types describing the durable state snapshot.
- `Agent.restore()` — loads persisted state from the configured store and rebuilds the claim map so registrations, snapshots, and failure counts survive restarts. State is saved at every state-changing point (register, unregister, after each run).
- `Scheduler.stop()` — clears every pending timer and forgets all claims (alias of `stopAll()`), guaranteeing clean shutdown with no leaked handles.

### Fixed
- Jest open-handles issue: `jest --forceExit` removed from the test script; the suite now exits cleanly because tests shut the scheduler down and assert `jest.getTimerCount() === 0` after `stop()`.

All changes are additive — existing constructors and call sites keep working without the new options.

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-16

Initial release. Continuous claim monitoring for the UVRN protocol.

### Added
- `Agent` — register claims, start/stop, runNow(), status()
- `Scheduler` — per-claim interval timers with jitter
- `FarmConnector` interface and `MockFarmConnector`
- `normalizeFarmResult()` — FARM result to completeness/parity/freshness
- Emitters: ConsoleEmitter, FileEmitter, WebhookEmitter, MultiEmitter
- Events: claim:registered, claim:scored, claim:threshold, receipt:emitted, etc.
- Re-exports PROFILES from @uvrn/drift
