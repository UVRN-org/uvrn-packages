# Changelog

## [4.0.0] - 2026-06-10

Published to npm 2026-06-12.

### Added
- `WatchStore` interface — injectable persistence seam for subscriptions. The `Watcher` writes every subscription mutation (subscribe, unsubscribe, alert bookkeeping, once-mode removal) through the store; `WatcherOptions.store` accepts a durable implementation. No storage ships in this package.
- `InMemoryWatchStore` — default zero-dependency `WatchStore`, preserving the historical in-memory behavior.
- Delivery retry with exponential backoff for webhook/Slack/Discord and custom `DeliveryTarget` deliveries: `retryAttempts` (default 3 retries after the initial attempt) and `retryBackoffMs` (default 250 ms, doubling per retry) on `WatcherOptions`, with per-subscription overrides on `SubscribeOptions`. Injectable `sleep` on `WatcherOptions` for tests. Exhausted retries surface through the existing `console.error` reporting path.
- Webhook URL validation at subscribe time: `webhook`/`slack`/`discord` targets must parse via `new URL()` with an `http:`/`https:` protocol, otherwise `subscribe()` throws and the subscription is not registered.
- `Watcher.flush()` — awaits all queued store writes.
- Exported `DEFAULT_RETRY_ATTEMPTS` and `DEFAULT_RETRY_BACKOFF_MS` constants.

All changes are additive — existing constructors and call sites keep working without the new options.

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-02

Initial release. Subscription and threshold alert routing for UVRN claim monitoring.

### Added
- `Watcher` for claim-threshold subscriptions with cooldown and once/every modes
- `DeliveryTarget` interface for custom delivery implementations
- `callback` in-process delivery path with zero external dependencies
- Reference webhook, Slack, and Discord delivery implementations
