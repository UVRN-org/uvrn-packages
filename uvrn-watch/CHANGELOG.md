# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-04-02

Initial release. Subscription and threshold alert routing for UVRN claim monitoring.

### Added
- `Watcher` for claim-threshold subscriptions with cooldown and once/every modes
- `DeliveryTarget` interface for custom delivery implementations
- `callback` in-process delivery path with zero external dependencies
- Reference webhook, Slack, and Discord delivery implementations
