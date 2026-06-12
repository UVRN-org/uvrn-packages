# @uvrn/store-sqlite — Changelog

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
