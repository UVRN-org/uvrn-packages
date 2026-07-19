# @uvrn/store-sqlite — Changelog

## [Unreleased]

- Add explicit `{ driver: 'node:sqlite' }` selection backed by Node's synchronous
  `DatabaseSync` API (Node >= 23.4), with no native dependency.
- Keep `better-sqlite3` as the unchanged default and preserve compatible database injection.
- Run the full kill-and-restart and outbox suite against both drivers, including honest
  retry behavior: `pushToNetwork()` stops on transport/5xx failures but leaves retry timing
  and backoff to its caller.
- Document the driver matrix and transaction/pragma behavior. The internal port follows the
  ports-and-adapters boundaries in ADR-004/ADR-005; this unit remains publish-ready but
  unpublished under D3.

## [4.0.0] - 2026-06-10 (unreleased, v4 / fable-refactor-1)

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
