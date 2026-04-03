# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-16

Initial release. Temporal decay scoring for UVRN verification receipts.

### Added
- `computeDrift(receipt, profile, asOf?)` — core decay API
- `computeDriftFromInput(input)` — agent-style API returning snapshot, receipt, events
- `DRIFT_PROFILES` / `PROFILES` — built-in decay profiles (fast, moderate, threshold_short, etc.)
- `DriftMonitor` — continuous monitoring with threshold events
- Decay curves: LINEAR, SIGMOID, EXPONENTIAL
- Types: DriftSnapshot, DriftConfig, AgentDriftReceipt for @uvrn/canon and @uvrn/agent
