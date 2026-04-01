# Changelog

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
