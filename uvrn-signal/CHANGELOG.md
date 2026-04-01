# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-01

Initial release. Typed event bus for UVRN package-to-package coordination.

### Added
- `SignalBus` — typed pub/sub event bus wrapping Node `EventEmitter`
- `SignalBridge` — event forwarding bridge between bus instances
- `UVRNEventMap` and event payload types for drift, canon, agent, and watch signals
- Custom event map support with inferred payload types
