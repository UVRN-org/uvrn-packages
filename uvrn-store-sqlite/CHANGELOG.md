# @uvrn/store-sqlite — Changelog

## [5.1.1] - 2026-10-10

### Changed
- Version aligned to the UVRN 5.1 line (5.1.0 → 5.1.1): every public `@uvrn/*` package now ships on 5.1.x, with `@uvrn/probability` on 0.3.x. No API or behaviour changes in this entry.
- Peer ranges raised from `^5.0.0` to `^5.1.0`: `@uvrn/agent`, `@uvrn/canon`, `@uvrn/core`, `@uvrn/drift`, `@uvrn/identity`, `@uvrn/receipt`, `@uvrn/timeline`, `@uvrn/watch`.

## [5.1.0] - 2026-10-02

### Added
- `SqliteTrackRecordStore` implements the optional track-record methods `logForecast`,
  `listForecastLog`, `addMultiForecastResolution`, `listForecastResolutions`, backed by new
  additive tables `track_forecast_log` and `track_forecast_resolutions_multi`
  (`CREATE TABLE IF NOT EXISTS`; existing tables untouched). These throw a clear upgrade error
  when the `@uvrn/track-record` peer predates forecast logging.

### Changed
- Optional peer `@uvrn/track-record` raised from `^5.0.0` to `^5.1.0` (the forecast-log types are
  imported from it).

### Fixed (2026-10-06 release tests, before first publish of 5.1.0)
- Optional peer `better-sqlite3` accepts `^11.0.0 || ^12.0.0`; 12.x installs on Node 26.
- Main-entry type declarations no longer import optional peers, so a solo install type-checks.

### License
- **License:** MIT → **Apache-2.0** with a NOTICE file ("Built on UVRN" attribution; no rights to the UVRN name). Earlier published versions stay MIT.

## [5.0.2] - 2026-08-30

### Changed
- Optional peer and `/track-record` subpath point at the public `@uvrn/track-record`; the main
  entry and its `.d.ts` load no track-record code. (Entry backfilled at 5.1.0; see the root
  `CHANGELOG.md`.)

## [5.0.0] - 2026-08-16

### Changed
- Version line 5.0.0; `@uvrn/*` peer ranges hard-cut to `^5.0.0`; track-record support moved to the
  lazily loaded `/track-record` subpath. (Entry backfilled at 5.1.0.)

## [4.1.0] - 2026-07-19

### Closing release
- Program closing npm release 4.1.0 — ships node:sqlite driver + outbox readiness.

- Add explicit `{ driver: 'node:sqlite' }` selection backed by Node's synchronous
  `DatabaseSync` API (Node >= 23.4), with no native dependency.
- Keep `better-sqlite3` as the unchanged default and preserve compatible database injection.
- Run the full kill-and-restart and outbox suite against both drivers, including honest
  retry behavior: `pushToNetwork()` stops on transport/5xx failures but leaves retry timing
  and backoff to its caller.
- Document the driver matrix and transaction/pragma behavior. The internal port follows the
  ports-and-adapters boundaries in ADR-004/ADR-005.

## [4.0.0] - 2026-06-10 (v4 / fable-refactor-1; published to npm 2026-06-12)

Initial release (plan A3). One local SQLite file implements every UVRN store interface:

- `SqliteCanonStore` (`CanonStore`), `SqliteIdentityStore` (`IdentityStore`),
  `SqliteTimelineStore` (`TimelineStore` + `addSnapshot`/`addCanonEvent` write side),
  `SqliteWatchStore` (`WatchStore`, new v4 seam), `SqliteAgentStateStore`
  (`AgentStateStore`, new v4 seam).
- `SqliteReceiptStore`: local NetworkReceipt outbox with `pushToNetwork(client)` —
  oldest-first sync per SPEC/uvrn-network-v1.md §6 (2xx → synced; 5xx stops the run;
  4xx surfaced, never mutated-and-retried).
- `better-sqlite3` as a lazily-required optional peer dependency; injectable driver.
- Kill-and-restart acceptance suite: identity scores (through the real `IdentityRegistry`),
  watch subscriptions, agent state, and the receipt outbox all survive close-and-reopen.
